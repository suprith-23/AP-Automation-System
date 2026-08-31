from sqlalchemy.orm import Session
from app.validation.pipeline import validate_invoice
from app.services.hsn_service import validate_hsn_with_db

class ValidationService:
    """Service wrapper to isolate validation rules engine executions and HSN lookups."""
    
    @staticmethod
    def validate(db: Session, invoice_dict: dict) -> dict:
        res = validate_invoice(
            invoice_dict, 
            hsn_lookup_fn=lambda code: validate_hsn_with_db(db, code)
        )
        
        from app.validation.service import ValidationService as DetailedValidationService
        detailed = DetailedValidationService().validate(invoice_dict, db=db)
        
        if detailed["overall_status"] == "FAILED":
            res["passed"] = False
            
        detailed_errors = []
        for field, errs in detailed.get("field_errors", {}).items():
            for err in errs:
                detailed_errors.append(f"{field}: {err}")
                
        res["errors"] = list(set(res["errors"] + detailed_errors))
        return res
