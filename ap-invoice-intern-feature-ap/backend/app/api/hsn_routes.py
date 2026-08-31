"""HSN Master Data API routes."""

import os
import json
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.hsn_master import HSNMaster
from app.schemas.hsn import (
    HSNCreate,
    HSNResponse,
    HSNBulkUpsertRequest,
    HSNBulkUpsertResponse
)
from app.services.hsn_service import bulk_upsert_hsn_codes

from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/hsn",
    tags=["HSN Master Data"],
    dependencies=[Depends(get_current_user)]
)


@router.post(
    "/bulk",
    response_model=HSNBulkUpsertResponse,
    status_code=status.HTTP_200_OK
)
def bulk_upsert_hsn_route(
    payload: HSNBulkUpsertRequest,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    """
    Purpose:
        Bulk upsert HSN codes into the master records table.
    Inputs:
        - payload (HSNBulkUpsertRequest): List of HSN codes and metadata to upsert.
        - db (Session): Database connection session.
    Outputs:
        - HSNBulkUpsertResponse: Count of inserted/updated records and summary message.
    """
    try:
        return bulk_upsert_hsn_codes(db, payload.hsn_codes)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to perform bulk upsert: {str(exc)}"
        )


@router.post(
    "/seed",
    response_model=HSNBulkUpsertResponse,
    status_code=status.HTTP_200_OK
)
def seed_hsn_from_file_route(
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    """
    Purpose:
        Trigger a bulk seed operation from the local dummy_hsn.json file.
    Inputs:
        - db (Session): Database connection session.
    Outputs:
        - HSNBulkUpsertResponse: Count of records loaded from file.
    """
    current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    hsn_file = os.path.join(current_dir, "seed", "dummy_hsn.json")
    if not os.path.exists(hsn_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Seed file not found at {hsn_file}"
        )
    
    try:
        with open(hsn_file, "r") as f:
            hsn_data = json.load(f)
        
        hsn_list = [HSNCreate(**item) for item in hsn_data]
        return bulk_upsert_hsn_codes(db, hsn_list)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to seed HSN codes from file: {str(exc)}"
        )


@router.get(
    "",
    response_model=List[HSNResponse]
)
def list_hsn_codes_route(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """
    Purpose:
        List all HSN codes in the master database with pagination.
    Inputs:
        - skip (int): Number of records to skip.
        - limit (int): Maximum number of records to return.
        - db (Session): Database connection session.
    Outputs:
        - List[HSNResponse]: Paginated list of HSN codes.
    """
    records = db.query(HSNMaster).offset(skip).limit(limit).all()
    return records


@router.get(
    "/{hsn_code}",
    response_model=HSNResponse
)
def get_hsn_details_route(
    hsn_code: str,
    db: Session = Depends(get_db)
):
    """
    Purpose:
        Retrieve details of a specific HSN code.
    Inputs:
        - hsn_code (str): The HSN/SAC code to look up.
        - db (Session): Database connection session.
    Outputs:
        - HSNResponse: The detailed HSN record.
    """
    cleaned_code = str(hsn_code).strip()
    record = db.query(HSNMaster).filter(HSNMaster.hsn_code == cleaned_code).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"HSN code '{cleaned_code}' not found in master records"
        )
    return record
