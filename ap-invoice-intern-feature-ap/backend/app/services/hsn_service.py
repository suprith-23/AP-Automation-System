"""Service logic for HSN code validations."""

from typing import List
from sqlalchemy.orm import Session
from app.models.hsn_master import HSNMaster
from app.schemas.hsn import HSNCreate

def validate_hsn_with_db(db: Session, hsn_input: str) -> dict:
    """
    Purpose:
        Validate if an HSN code is structurally valid and exists in the hsn_master database table.
    Inputs:
        - db (Session): SQLAlchemy database session.
        - hsn_input (str): The HSN code string to validate.
    Outputs:
        - dict: A dictionary containing validation result flags, official tax rate, and optional error message.
    """
    # 1. Clean the input by stripping leading/trailing whitespace
    if hsn_input is None:
        return {
            "is_valid": False,
            "tax_rate": None,
            "cgst_rate": None,
            "sgst_rate": None,
            "igst_rate": None,
            "description": None,
            "error_message": "HSN code is missing"
        }
        
    cleaned_hsn = str(hsn_input).strip()
    
    # 2. Check if the code consists of digits only
    if not cleaned_hsn.isdigit():
        return {
            "is_valid": False,
            "tax_rate": None,
            "cgst_rate": None,
            "sgst_rate": None,
            "igst_rate": None,
            "description": None,
            "error_message": f"HSN code '{cleaned_hsn}' must be entirely numeric"
        }
    
    # 3. Check if the code is exactly 4, 6, or 8 digits
    valid_lengths = [4, 6, 8]
    if len(cleaned_hsn) not in valid_lengths:
        return {
            "is_valid": False,
            "tax_rate": None,
            "cgst_rate": None,
            "sgst_rate": None,
            "igst_rate": None,
            "description": None,
            "error_message": f"HSN code length is {len(cleaned_hsn)}, but must be 4, 6, or 8 digits"
        }
        
    # 4. Query the database for the HSN code record
    hsn_record = db.query(HSNMaster).filter(HSNMaster.hsn_code == cleaned_hsn).first()
    
    # 5. Return success if found, else return failure
    if not hsn_record:
        return {
            "is_valid": False,
            "tax_rate": None,
            "cgst_rate": None,
            "sgst_rate": None,
            "igst_rate": None,
            "description": None,
            "error_message": f"HSN code '{cleaned_hsn}' does not exist in master records"
        }
        
    return {
        "is_valid": True,
        "tax_rate": hsn_record.tax_rate,
        "cgst_rate": hsn_record.cgst_rate,
        "sgst_rate": hsn_record.sgst_rate,
        "igst_rate": hsn_record.igst_rate,
        "description": hsn_record.description,
        "error_message": None
    }


def bulk_upsert_hsn_codes(db: Session, hsn_list: List[HSNCreate]) -> dict:
    """
    Purpose:
        Bulk upsert a list of HSN codes in the database. If an HSN code already exists,
        its fields are updated. If it is new, a new master record is inserted. Splits CGST/SGST/IGST
        from the total tax rate if they are not explicitly specified.
    Inputs:
        - db (Session): Active database session.
        - hsn_list (List[HSNCreate]): List of HSN validation creation schemas.
    Outputs:
        - dict: Summary counts containing:
            - inserted_count: Total newly inserted HSN records.
            - updated_count: Total updated HSN records.
            - message: Text description of the operations performed.
    """
    inserted = 0
    updated = 0
    
    for hsn_data in hsn_list:
        code = str(hsn_data.hsn_code).strip()
        
        # Calculate split rates if they are None but tax_rate is present
        tax_rate = hsn_data.tax_rate
        cgst = hsn_data.cgst_rate
        sgst = hsn_data.sgst_rate
        igst = hsn_data.igst_rate
        
        if tax_rate is not None:
            if cgst is None:
                cgst = tax_rate / 2.0
            if sgst is None:
                sgst = tax_rate / 2.0
            if igst is None:
                igst = tax_rate
        
        existing = db.query(HSNMaster).filter(HSNMaster.hsn_code == code).first()
        if existing:
            existing.description = hsn_data.description
            existing.tax_rate = tax_rate
            existing.cgst_rate = cgst
            existing.sgst_rate = sgst
            existing.igst_rate = igst
            updated += 1
        else:
            new_hsn = HSNMaster(
                hsn_code=code,
                description=hsn_data.description,
                tax_rate=tax_rate,
                cgst_rate=cgst,
                sgst_rate=sgst,
                igst_rate=igst
            )
            db.add(new_hsn)
            inserted += 1
            
    db.commit()
    return {
        "inserted_count": inserted,
        "updated_count": updated,
        "message": f"Successfully processed {inserted + updated} HSN codes. (Inserted: {inserted}, Updated: {updated})"
    }
