from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.models.prompt_version import PromptVersion
from app.schemas.prompt_version import (
    PromptVersionResponse, PromptVersionCreate, PromptVersionUpdate,
    PromptTestRequest, PromptTestResponse
)
from app.ai.extraction.stage8_llm import Stage8LLM
import os
import json

from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/prompts",
    tags=["Prompts"],
    dependencies=[Depends(RoleChecker(["Admin"]))]
)

# Helper function to seed default prompts if table is empty
def seed_default_prompts(db: Session):
    count = db.query(PromptVersion).count()
    if count == 0:
        # Load from file if possible, else use default content
        default_content = ""
        backend_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        v3_path = os.path.join(backend_root, "prompts", "invoice_extraction_v3.txt")
        if os.path.exists(v3_path):
            with open(v3_path, "r", encoding="utf-8") as f:
                default_content = f.read()
        else:
            default_content = "You are an expert OCR parser. Extract values from this invoice:\n1. invoice_number\n2. seller_name\n3. seller_gstin\n4. total_invoice_value\n5. items"

        defaults = [
            PromptVersion(version="v3.8", content=default_content, notes="Optimized extraction for GST compliant tax invoices with HSN mapping", author="Admin", is_active=True),
            PromptVersion(version="v3.7", content=default_content.replace("v3.8", "v3.7"), notes="Fixed CGST/SGST parsing errors", author="Admin", is_active=False),
        ]
        db.add_all(defaults)
        db.commit()

@router.get("/", response_model=List[PromptVersionResponse])
def get_prompt_versions(db: Session = Depends(get_db)):
    seed_default_prompts(db)
    return db.query(PromptVersion).order_by(PromptVersion.created_at.desc()).all()

@router.post("/", response_model=PromptVersionResponse)
def create_prompt_version(prompt_in: PromptVersionCreate, db: Session = Depends(get_db)):
    # Check if version already exists
    existing = db.query(PromptVersion).filter(PromptVersion.version == prompt_in.version).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prompt version already exists.")
    
    db_prompt = PromptVersion(
        version=prompt_in.version,
        content=prompt_in.content,
        notes=prompt_in.notes,
        author=prompt_in.author or "Admin",
        is_active=prompt_in.is_active or False
    )
    
    if db_prompt.is_active:
        # Deactivate all other prompts
        db.query(PromptVersion).update({PromptVersion.is_active: False})
        
    db.add(db_prompt)
    db.commit()
    db.refresh(db_prompt)
    return db_prompt

@router.put("/{prompt_id}", response_model=PromptVersionResponse)
def update_prompt_version(prompt_id: int, prompt_in: PromptVersionUpdate, db: Session = Depends(get_db)):
    prompt = db.query(PromptVersion).filter(PromptVersion.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found.")
        
    for field, value in prompt_in.dict(exclude_unset=True).items():
        if field == "is_active" and value is True:
            # Deactivate all other prompts
            db.query(PromptVersion).update({PromptVersion.is_active: False})
        setattr(prompt, field, value)
        
    db.commit()
    db.refresh(prompt)
    return prompt

@router.post("/{prompt_id}/activate", response_model=PromptVersionResponse)
def activate_prompt_version(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(PromptVersion).filter(PromptVersion.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found.")
        
    db.query(PromptVersion).update({PromptVersion.is_active: False})
    prompt.is_active = True
    db.commit()
    db.refresh(prompt)
    return prompt

@router.delete("/{prompt_id}")
def delete_prompt_version(prompt_id: int, db: Session = Depends(get_db)):
    prompt = db.query(PromptVersion).filter(PromptVersion.id == prompt_id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt version not found.")
    db.delete(prompt)
    db.commit()
    return {"message": "Prompt version deleted successfully"}

@router.post("/test", response_model=PromptTestResponse)
async def test_prompt_custom(req: PromptTestRequest):
    # Dummy/Sample compressed JSON of an invoice
    sample_context = req.sample_ocr_text or json.dumps({
        "invoice_number": "INV-2026-999",
        "date": "2026-07-08",
        "seller_name": "Testing Services Ltd",
        "seller_gstin": "27AAAAA1111A1Z1",
        "total_amount": 11800.0,
        "items": [
            {"description": "AI Pipeline Assessment", "amount": 10000.0, "hsn": "9983"},
        ]
    })    
    # We replace placeholder tokens with the sample context
    final_prompt = req.prompt_content.replace("{OCR_TEXT}", sample_context).replace("{ocr_text}", sample_context).replace("{COMPRESSED_CONTEXT}", sample_context)

    # Use the registry — same automatic provider selection as the main pipeline
    try:
        import httpx
        from app.ai.providers.registry import build_provider_order
        from app.ai.extraction.stage8_llm import normalize_and_parse_json

        providers = build_provider_order()  # no DB model preference for prompt test
        if not providers:
            return PromptTestResponse(
                extracted_json={},
                raw_response="",
                success=False,
                error="No AI provider API keys are configured.",
            )

        raw_content = ""
        async with httpx.AsyncClient(timeout=60.0) as client:
            for provider, api_key in providers:
                try:
                    raw_content = await provider.call_api(client, final_prompt, api_key)
                    if raw_content.strip():
                        break
                except Exception:
                    continue

        if not raw_content.strip():
            raise Exception("All configured AI providers failed to extract data.")

        parsed_data = normalize_and_parse_json(raw_content)
        return PromptTestResponse(
            extracted_json=parsed_data,
            raw_response=raw_content[:200] + "...",
            success=True,
        )

    except Exception as e:
        return PromptTestResponse(
            extracted_json={},
            raw_response="",
            success=False,
            error=str(e),
        )

