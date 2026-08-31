from typing import List, Optional
from uuid import UUID
from datetime import datetime
from sqlalchemy.orm import Session
from fastapi import HTTPException
import logging

logger = logging.getLogger("ap_automation.invoice_service")

from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.schemas.invoice import InvoiceCreate, InvoiceUpdate
from app.services.invoice_repository import InvoiceRepository
from app.services.validation_service import ValidationService
from app.services.matching_service import match_invoice_to_po
from app.services.audit_log_service import AuditService
from app.services.entity_resolver_service import resolve_entity_names


def create_invoice(db: Session, invoice: InvoiceCreate, organization_id: Optional[UUID] = None) -> Invoice:
    """
    Purpose:
        Creates a new invoice, checks for duplicates, runs initial validation and PO matching,
        saves nested line items atomically in a single transaction, and records structured audit events.
    Inputs:
        - db (Session): Active database session.
        - invoice (InvoiceCreate): Input invoice creation schema.
    Outputs:
        - Invoice: Created database invoice model instance.
    """
    invoice_dict = invoice.model_dump()
    items_data = invoice_dict.get("items") or []

    # Compute line item totals dynamically if they are missing or zero before validation
    for item in items_data:
        # Enforce is_service based on HSN prefix starting with "99" (Service Accounting Code)
        hsn = item.get("hsn_code")
        is_srv = item.get("is_service")
        if hsn and str(hsn).strip().startswith("99"):
            item["is_service"] = "Y"
        elif is_srv is True or (isinstance(is_srv, str) and is_srv.lower() in ("true", "y")):
            item["is_service"] = "Y"
        else:
            item["is_service"] = "N"

        qty = float(item.get("quantity") or 0.0)
        if item.get("is_service") == "Y" and qty == 0.0:
            qty = 1.0
            item["quantity"] = qty
        price = float(item.get("unit_price") or 0.0)
        
        # Calculate base total_amount (taxable value) if missing or zero
        if not item.get("total_amount") or float(item.get("total_amount")) == 0.0:
            discount = float(item.get("discount") or 0.0)
            other_charges = float(item.get("other_charges") or 0.0)
            item["total_amount"] = (qty * price) - discount + other_charges
            
        # Calculate total_item_value (post-tax value) if missing or zero
        if not item.get("total_item_value") or float(item.get("total_item_value")) == 0.0:
            total_amt = float(item.get("total_amount") or 0.0)
            cgst = float(item.get("cgst_amount") or 0.0)
            sgst = float(item.get("sgst_amount") or 0.0)
            igst = float(item.get("igst_amount") or 0.0)
            cess = float(item.get("cess_amount") or 0.0)
            state_cess = float(item.get("state_cess_amount") or 0.0)
            
            # If explicit tax amounts are not provided, estimate based on gst_rate
            if cgst == 0.0 and sgst == 0.0 and igst == 0.0:
                gst_rate = float(item.get("gst_rate") or 0.0)
                estimated_tax = total_amt * (gst_rate / 100.0)
                item["total_item_value"] = total_amt + estimated_tax
            else:
                item["total_item_value"] = total_amt + cgst + sgst + igst + cess + state_cess

    # Auto-resolve missing entity names from GSTINs before validation
    resolve_entity_names(db, invoice_dict)

    # Run validation service (pass HSN lookup callback and preserve items for HSN checks)
    validation_result = ValidationService.validate(db, invoice_dict)

    # Extract child items data
    items_data = invoice_dict.pop("items", None) or []

    # Perform duplicate check before committing to prevent DB integrity issues
    invoice_number = invoice_dict.get("invoice_number")
    seller_gstin = invoice_dict.get("seller_gstin")
    if invoice_number and seller_gstin:
        duplicate = (
            db.query(Invoice)
            .filter(
                Invoice.invoice_number == invoice_number,
                Invoice.seller_gstin == seller_gstin,
                Invoice.organization_id == organization_id
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail={"message": f"Duplicate invoice number {invoice_number} from this vendor already exists", "original_id": duplicate.id}
            )

    # Populate backward-compatible fields in matching payload
    matching_dict = invoice_dict.copy()
    if not matching_dict.get("vendor_name"):
        matching_dict["vendor_name"] = matching_dict.get("seller_name") or matching_dict.get("seller_gstin")
    if matching_dict.get("total_amount") is None:
        matching_dict["total_amount"] = matching_dict.get("total_invoice_value")

    # Run PO matching engine validation
    matching_result = match_invoice_to_po(db, matching_dict)

    # Initialize SQLAlchemy database instance
    # Whitelist only valid model columns — strips any pipeline-internal keys
    # (e.g. 'confidence', 'extraction_metadata') that leaked through the pipeline
    _valid_columns = set(Invoice.__table__.columns.keys())
    invoice_dict = {k: v for k, v in invoice_dict.items() if k in _valid_columns}
    db_invoice = Invoice(**invoice_dict)
    db_invoice.organization_id = organization_id

    # Sync compatibility fields on model instance
    db_invoice.vendor_name = db_invoice.seller_name or db_invoice.seller_gstin
    db_invoice.total_amount = db_invoice.total_invoice_value
    db_invoice.subtotal = db_invoice.total_taxable_value
    db_invoice.status = matching_result["status"]
    db_invoice.match_status = matching_result["status"]
    db_invoice.match_score = matching_result.get("match_score")

    # Combine errors from validator and matching engine
    all_errors = validation_result["errors"] + matching_result["errors"]
    passed = validation_result["passed"] and matching_result["matched"]

    # Set workflow statuses based on whether automated validation passed
    if passed:
        db_invoice.validation_status = "PASSED"
        db_invoice.workflow_status = InvoiceWorkflowStatus.pending_review
        db_invoice.validation_errors = []
    else:
        db_invoice.validation_status = "FAILED"
        db_invoice.workflow_status = InvoiceWorkflowStatus.validation_failed
        db_invoice.validation_errors = all_errors

    # Save transactional and atomic (Fixes database integrity/orphan invoices)
    db_invoice = InvoiceRepository.save_transactional(db, db_invoice, items_data)

    # Log Invoice Creation Event
    AuditService.log(
        db=db,
        action="INVOICE_CREATED",
        invoice_id=db_invoice.id,
        status_before=None,
        status_after=db_invoice.workflow_status.value if hasattr(db_invoice.workflow_status, "value") else db_invoice.workflow_status,
        performed_by="system",
        details={
            "invoice_number": db_invoice.invoice_number,
            "po_number": db_invoice.po_number,
            "seller_name": db_invoice.seller_name,
            "seller_gstin": db_invoice.seller_gstin,
            "buyer_name": db_invoice.buyer_name,
            "buyer_gstin": db_invoice.buyer_gstin,
            "shipping_name": db_invoice.shipping_name,
            "shipping_gstin": db_invoice.shipping_gstin,
            "total_invoice_value": db_invoice.total_invoice_value,
            "workflow_status": db_invoice.workflow_status.value if hasattr(db_invoice.workflow_status, "value") else db_invoice.workflow_status,
            "validation_status": db_invoice.validation_status,
            "match_status": db_invoice.match_status,
            "confidence_score": db_invoice.confidence_score,
            "source_type": db_invoice.source_type
        }
    )

    # Log validation event
    val_passed = (db_invoice.validation_status == "PASSED")
    AuditService.log(
        db=db,
        action="VALIDATION_COMPLETED" if val_passed else "VALIDATION_FAILED",
        invoice_id=db_invoice.id,
        status_before=None,
        status_after=db_invoice.workflow_status.value if hasattr(db_invoice.workflow_status, "value") else db_invoice.workflow_status,
        performed_by="system",
        details={
            "errors": db_invoice.validation_errors
        }
    )

    # Log PO matching event
    matching_passed = (db_invoice.match_status == "matched")
    AuditService.log(
        db=db,
        action="PO_MATCH_SUCCESS" if matching_passed else "PO_MATCH_FAILED",
        invoice_id=db_invoice.id,
        status_before=None,
        status_after=db_invoice.workflow_status.value if hasattr(db_invoice.workflow_status, "value") else db_invoice.workflow_status,
        performed_by="system",
        details={
            "status": db_invoice.match_status
        }
    )

    return db_invoice


def get_all_invoices(db: Session, page: Optional[int] = None, page_size: Optional[int] = None, organization_id: Optional[UUID] = None) -> List[Invoice]:
    """
    Purpose:
        Return every invoice in the database, optionally paginated, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - page (Optional[int]): Page number (1-indexed).
        - page_size (Optional[int]): Page size.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - List[Invoice]: List of retrieved invoices.
    """
    return InvoiceRepository.get_all(db, page=page, page_size=page_size, organization_id=organization_id)


def get_total_invoices_count(db: Session, organization_id: Optional[UUID] = None) -> int:
    """
    Purpose:
        Return count of all invoices, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - int: Total count of invoices.
    """
    return InvoiceRepository.get_total_count(db, organization_id=organization_id)


def get_invoice_by_id(db: Session, invoice_id: int, organization_id: Optional[UUID] = None) -> Invoice | None:
    """
    Purpose:
        Return one invoice by its primary key database ID, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key database ID.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - Invoice | None: Retrieved invoice, or None.
    """
    return InvoiceRepository.get_by_id(db, invoice_id, organization_id=organization_id)


def update_invoice(db: Session, invoice_id: int, invoice_update: InvoiceUpdate) -> Invoice | None:
    """
    Purpose:
        Update fields of an existing invoice and rerun validation checks and PO matching.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key ID of the invoice to update.
        - invoice_update (InvoiceUpdate): Invoice update schema container.
    Outputs:
        - Invoice | None: Updated invoice instance, or None if not found.
    """
    db_invoice = InvoiceRepository.get_by_id(db, invoice_id)

    if not db_invoice:
        return None

    # Capture state before modifying the record
    status_before = db_invoice.workflow_status.value if db_invoice.workflow_status else None

    update_data = invoice_update.model_dump(exclude_unset=True)

    # Exclude system-controlled workflow and validation fields from manual updates
    excluded_keys = {"workflow_status", "validation_status", "validation_errors", "match_status"}
    for key in excluded_keys:
        update_data.pop(key, None)

    for key, value in update_data.items():
        setattr(db_invoice, key, value)
    
    # Rerun validation using the updated fields
    updated_dict = {
        "id": db_invoice.id,
        "invoice_number": db_invoice.invoice_number,
        "vendor_name": db_invoice.vendor_name,
        "invoice_date": db_invoice.invoice_date,
        "due_date": db_invoice.due_date,
        "subtotal": db_invoice.subtotal,
        "tax_amount": db_invoice.tax_amount,
        "total_amount": db_invoice.total_amount,
        "currency": db_invoice.currency,
        "po_number": db_invoice.po_number,
        "seller_name": db_invoice.seller_name,
        "seller_gstin": db_invoice.seller_gstin,
        "buyer_name": db_invoice.buyer_name,
        "buyer_gstin": db_invoice.buyer_gstin,
        "shipping_name": db_invoice.shipping_name,
        "shipping_gstin": db_invoice.shipping_gstin,
        "total_invoice_value": db_invoice.total_invoice_value,
        "total_taxable_value": db_invoice.total_taxable_value,
        "total_cgst_value": db_invoice.total_cgst_value,
        "total_sgst_value": db_invoice.total_sgst_value,
        "total_igst_value": db_invoice.total_igst_value,
        "total_ces_value": db_invoice.total_ces_value,
        "total_st_ces_value": db_invoice.total_st_ces_value,
        "total_discount_value": db_invoice.total_discount_value,
        "round_off_amount": db_invoice.round_off_amount,
        "total_accessment_value": db_invoice.total_accessment_value,
        "total_gst_rate": db_invoice.total_gst_rate,
        "seller_gstin_pincode": db_invoice.seller_gstin_pincode,
        "buyer_gstin_pincode": db_invoice.buyer_gstin_pincode,
        "shipping_gstin_pincode": db_invoice.shipping_gstin_pincode,
        "items": [
            {
                "item_number": it.item_number,
                "item_barcode": it.item_barcode,
                "description": it.description,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "total_amount": it.total_amount,
                "gst_rate": it.gst_rate,
                "hsn_code": it.hsn_code,
            }
            for it in db_invoice.items
        ]
    }

    # Auto-resolve missing entity names from GSTINs before validation
    resolve_entity_names(db, updated_dict)

    # Sync the resolved names back to the db_invoice object so they are persisted
    db_invoice.seller_name = updated_dict.get("seller_name")
    db_invoice.buyer_name = updated_dict.get("buyer_name")
    db_invoice.shipping_name = updated_dict.get("shipping_name")

    # Run base validation logic
    validation_result = ValidationService.validate(db, updated_dict)

    # Run duplicate invoice detection (exclude the current invoice ID)
    if db_invoice.invoice_number and db_invoice.seller_gstin:
        duplicate = (
            db.query(Invoice)
            .filter(
                Invoice.invoice_number == db_invoice.invoice_number,
                Invoice.seller_gstin == db_invoice.seller_gstin,
                Invoice.organization_id == db_invoice.organization_id,
                Invoice.id != invoice_id
            )
            .first()
        )
        if duplicate:
            raise HTTPException(
                status_code=400,
                detail={"message": f"Duplicate invoice number {db_invoice.invoice_number} from this vendor already exists", "original_id": duplicate.id}
            )
    
    # Populate backward-compatible matching payload
    matching_dict = updated_dict.copy()
    if not matching_dict.get("vendor_name"):
        matching_dict["vendor_name"] = db_invoice.seller_name or db_invoice.seller_gstin
    if matching_dict.get("total_amount") is None:
        matching_dict["total_amount"] = db_invoice.total_invoice_value

    # Run PO matching engine validation
    matching_result = match_invoice_to_po(db, matching_dict)

    # Sync compatibility fields
    db_invoice.status = matching_result["status"]
    db_invoice.match_status = matching_result["status"]
    db_invoice.match_score = matching_result.get("match_score")
    db_invoice.vendor_name = db_invoice.seller_name or db_invoice.seller_gstin
    db_invoice.total_amount = db_invoice.total_invoice_value
    db_invoice.subtotal = db_invoice.total_taxable_value

    # Combine errors and check if passed
    all_errors = validation_result["errors"] + matching_result["errors"]
    passed = validation_result["passed"] and matching_result["matched"]

    # Update statuses and validation outcomes based on results
    if passed:
        db_invoice.validation_status = "PASSED"
        db_invoice.validation_errors = []
        if db_invoice.workflow_status == InvoiceWorkflowStatus.validation_failed:
            db_invoice.workflow_status = InvoiceWorkflowStatus.pending_review
    else:
        db_invoice.validation_status = "FAILED"
        db_invoice.validation_errors = all_errors
        db_invoice.workflow_status = InvoiceWorkflowStatus.validation_failed

    # Extract items data to save atomically, preserving all canonical fields
    items_to_save = [
        {
            "item_number": it.item_number,
            "item_barcode": it.item_barcode,
            "sl_no": it.sl_no,
            "is_service": it.is_service,
            "description": it.description,
            "hsn_code": it.hsn_code,
            "quantity": it.quantity,
            "unit": it.unit,
            "unit_price": it.unit_price,
            "total_amount": it.total_amount,
            "discount": it.discount,
            "assessable_value": it.assessable_value,
            "gst_rate": it.gst_rate,
            "igst_amount": it.igst_amount,
            "cgst_amount": it.cgst_amount,
            "sgst_amount": it.sgst_amount,
            "cess_rate": it.cess_rate,
            "cess_amount": it.cess_amount,
            "cess_non_advalorem_amount": it.cess_non_advalorem_amount,
            "state_cess_rate": it.state_cess_rate,
            "state_cess_amount": it.state_cess_amount,
            "other_charges": it.other_charges,
            "total_item_value": it.total_item_value,
        }
        for it in db_invoice.items
    ]

    db_invoice = InvoiceRepository.save_transactional(db, db_invoice, items_to_save)

    # Capture state after modifications have committed to database
    status_after = db_invoice.workflow_status.value if db_invoice.workflow_status else None
    
    # Log main update action or status change
    action_type = "STATUS_CHANGED" if status_before != status_after else "INVOICE_UPDATED"
    AuditService.log(
        db=db,
        action=action_type,
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="reviewer",
        details={
            "invoice_number": db_invoice.invoice_number,
            "po_number": db_invoice.po_number,
            "seller_name": db_invoice.seller_name,
            "seller_gstin": db_invoice.seller_gstin,
            "buyer_name": db_invoice.buyer_name,
            "buyer_gstin": db_invoice.buyer_gstin,
            "shipping_name": db_invoice.shipping_name,
            "shipping_gstin": db_invoice.shipping_gstin,
            "total_invoice_value": db_invoice.total_invoice_value,
            "workflow_status": status_after,
            "validation_status": db_invoice.validation_status,
            "match_status": db_invoice.match_status,
            "confidence_score": db_invoice.confidence_score,
            "source_type": db_invoice.source_type,
            "updated_fields": list(update_data.keys())
        }
    )

    # Log validation event
    val_passed = (db_invoice.validation_status == "PASSED")
    AuditService.log(
        db=db,
        action="VALIDATION_COMPLETED" if val_passed else "VALIDATION_FAILED",
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="reviewer",
        details={
            "errors": db_invoice.validation_errors
        }
    )

    # Log PO matching event
    matching_passed = (db_invoice.match_status == "matched")
    AuditService.log(
        db=db,
        action="PO_MATCH_SUCCESS" if matching_passed else "PO_MATCH_FAILED",
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="reviewer",
        details={
            "status": db_invoice.match_status
        }
    )

    return db_invoice


def delete_invoice(db: Session, invoice_id: int) -> Invoice | None:
    """
    Purpose:
        Delete an invoice if it exists and write a persistent deletion log.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key ID of the invoice.
    Outputs:
        - Invoice | None: Deleted invoice instance, or None if not found.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)

    if invoice:
        # Capture all details locally before deleting the SQLAlchemy instance
        status_before = invoice.workflow_status.value if invoice.workflow_status else None
        invoice_number = invoice.invoice_number
        po_number = invoice.po_number
        seller_name = invoice.seller_name
        seller_gstin = invoice.seller_gstin
        buyer_name = invoice.buyer_name
        buyer_gstin = invoice.buyer_gstin
        shipping_name = invoice.shipping_name
        shipping_gstin = invoice.shipping_gstin
        total_invoice_value = invoice.total_invoice_value
        validation_status = invoice.validation_status
        match_status = invoice.match_status
        confidence_score = invoice.confidence_score
        source_type = invoice.source_type

        InvoiceRepository.delete(db, invoice)

        # Log deleted invoice successfully
        AuditService.log(
            db=db,
            action="INVOICE_DELETED",
            invoice_id=invoice_id,
            status_before=status_before,
            status_after=None,
            performed_by="system",
            details={
                "invoice_number": invoice_number,
                "po_number": po_number,
                "seller_name": seller_name,
                "seller_gstin": seller_gstin,
                "buyer_name": buyer_name,
                "buyer_gstin": buyer_gstin,
                "shipping_name": shipping_name,
                "shipping_gstin": shipping_gstin,
                "total_invoice_value": total_invoice_value,
                "workflow_status": None,
                "validation_status": validation_status,
                "match_status": match_status,
                "confidence_score": confidence_score,
                "source_type": source_type
            }
        )

    return invoice


def get_reviewer_queue(db: Session, page: Optional[int] = None, page_size: Optional[int] = None, organization_id: Optional[UUID] = None) -> List[Invoice]:
    """
    Purpose:
        Fetches reviewer queue, optionally paginated, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - page (Optional[int]): Page number (1-indexed).
        - page_size (Optional[int]): Page size.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - List[Invoice]: List of reviewer-queue invoices.
    """
    return InvoiceRepository.get_reviewer_queue(db, page=page, page_size=page_size, organization_id=organization_id)


def get_reviewer_queue_count(db: Session, organization_id: Optional[UUID] = None) -> int:
    """
    Purpose:
        Returns total reviewer queue count, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - int: Reviewer queue count.
    """
    return InvoiceRepository.get_reviewer_queue_count(db, organization_id=organization_id)


def submit_invoice_for_approval(db: Session, invoice_id: int) -> Invoice:
    """
    Purpose:
        Transitions an invoice to 'pending_approval' if it has no validation errors.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key ID of the invoice.
    Outputs:
        - Invoice: Transitioned invoice instance.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)

    # Check 1: Ensure invoice exists
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not Found"
        )

    status_before = invoice.workflow_status.value if invoice.workflow_status else None

    # Check 2: Ensure invoice is in the correct state to be submitted
    if invoice.workflow_status == InvoiceWorkflowStatus.pending_approval:
        return invoice

    allowed_statuses = {
        InvoiceWorkflowStatus.validation_pending,
        InvoiceWorkflowStatus.pending_review,
        InvoiceWorkflowStatus.validation_failed
    }
    if invoice.workflow_status not in allowed_statuses:
        raise HTTPException(
            status_code=404,
            detail=f"Cannot submit invoice in '{invoice.workflow_status}' state for approval."
        )
    
    # Check 3: Ensure all validation errors have been resolved or reviewed
    # We allow forwarding to the Approver even if there are validation/matching errors (e.g. Non-PO),
    # since the Approver can perform manual override reviews with detailed justification.
    pass
    
    # Transition status
    invoice.workflow_status = InvoiceWorkflowStatus.pending_approval
    invoice.status = "UNDER_REVIEW"
    
    db.commit()
    db.refresh(invoice)
    
    # Log submission event
    AuditService.log(
        db=db,
        action="REVIEWER_APPROVED",
        invoice_id=invoice.id,
        status_before=status_before,
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
        performed_by="reviewer",
        details={
            "invoice_number": invoice.invoice_number,
            "po_number": invoice.po_number,
            "seller_name": invoice.seller_name,
            "seller_gstin": invoice.seller_gstin,
            "buyer_name": invoice.buyer_name,
            "buyer_gstin": invoice.buyer_gstin,
            "shipping_name": invoice.shipping_name,
            "shipping_gstin": invoice.shipping_gstin,
            "total_invoice_value": invoice.total_invoice_value,
            "workflow_status": invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
            "validation_status": invoice.validation_status,
            "match_status": invoice.match_status,
            "confidence_score": invoice.confidence_score,
            "source_type": invoice.source_type
        }
    )
    
    return invoice


def run_invoice_matching(db: Session, invoice_id: int) -> Invoice:
    """
    Purpose:
        Manually trigger the PO matching check for a specific invoice.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key ID of the invoice.
    Outputs:
        - Invoice: Match-validated invoice instance.
    """
    db_invoice = InvoiceRepository.get_by_id(db, invoice_id)
    if not db_invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    status_before = db_invoice.workflow_status.value if db_invoice.workflow_status else None
    
    updated_dict = {
        "invoice_number": db_invoice.invoice_number,
        "vendor_name": db_invoice.vendor_name,
        "invoice_date": db_invoice.invoice_date,
        "due_date": db_invoice.due_date,
        "subtotal": db_invoice.subtotal,
        "tax_amount": db_invoice.tax_amount,
        "total_amount": db_invoice.total_amount,
        "currency": db_invoice.currency,
        "po_number": db_invoice.po_number,
        "seller_gstin": db_invoice.seller_gstin,
        "buyer_gstin": db_invoice.buyer_gstin,
        "shipping_gstin": db_invoice.shipping_gstin,
        "total_invoice_value": db_invoice.total_invoice_value,
        "total_taxable_value": db_invoice.total_taxable_value,
        "total_cgst_value": db_invoice.total_cgst_value,
        "total_sgst_value": db_invoice.total_sgst_value,
        "total_igst_value": db_invoice.total_igst_value,
        "total_ces_value": db_invoice.total_ces_value,
        "total_st_ces_value": db_invoice.total_st_ces_value,
        "total_discount_value": db_invoice.total_discount_value,
        "round_off_amount": db_invoice.round_off_amount,
        "total_accessment_value": db_invoice.total_accessment_value,
        "total_gst_rate": db_invoice.total_gst_rate,
        "seller_gstin_pincode": db_invoice.seller_gstin_pincode,
        "buyer_gstin_pincode": db_invoice.buyer_gstin_pincode,
        "shipping_gstin_pincode": db_invoice.shipping_gstin_pincode,
        "items": [
            {
                "item_number": it.item_number,
                "item_barcode": it.item_barcode,
                "description": it.description,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "total_amount": it.total_amount,
                "gst_rate": it.gst_rate,
                "hsn_code": it.hsn_code,
            }
            for it in db_invoice.items
        ]
    }
    
    validation_result = ValidationService.validate(db, updated_dict)

    # Sync compatibility fields for matching engine payload
    matching_dict = updated_dict.copy()
    if not matching_dict.get("vendor_name"):
        matching_dict["vendor_name"] = db_invoice.seller_name or db_invoice.seller_gstin
    if matching_dict.get("total_amount") is None:
        matching_dict["total_amount"] = db_invoice.total_invoice_value

    matching_result = match_invoice_to_po(db, matching_dict)
    
    db_invoice.status = matching_result["status"]
    db_invoice.match_status = matching_result["status"]
    db_invoice.match_score = matching_result.get("match_score")
    db_invoice.vendor_name = db_invoice.seller_name or db_invoice.seller_gstin
    db_invoice.total_amount = db_invoice.total_invoice_value
    db_invoice.subtotal = db_invoice.total_taxable_value

    all_errors = validation_result["errors"] + matching_result["errors"]
    passed = validation_result["passed"] and matching_result["matched"]
    
    if passed:
        db_invoice.validation_status = "PASSED"
        db_invoice.validation_errors = []
        if db_invoice.workflow_status == InvoiceWorkflowStatus.validation_failed:
            db_invoice.workflow_status = InvoiceWorkflowStatus.pending_review
    else:
        db_invoice.validation_status = "FAILED"
        db_invoice.validation_errors = all_errors
        db_invoice.workflow_status = InvoiceWorkflowStatus.validation_failed
        
    db.commit()
    db.refresh(db_invoice)
    status_after = db_invoice.workflow_status.value if db_invoice.workflow_status else None

    # Log validation event
    val_passed = (db_invoice.validation_status == "PASSED")
    AuditService.log(
        db=db,
        action="VALIDATION_COMPLETED" if val_passed else "VALIDATION_FAILED",
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="system",
        details={
            "errors": db_invoice.validation_errors
        }
    )

    # Log PO matching event
    matching_passed = (db_invoice.match_status == "matched")
    AuditService.log(
        db=db,
        action="PO_MATCH_SUCCESS" if matching_passed else "PO_MATCH_FAILED",
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="system",
        details={
            "status": db_invoice.match_status
        }
    )

    # Log status change or match run action
    action_type = "STATUS_CHANGED" if status_before != status_after else "INVOICE_UPDATED"
    AuditService.log(
        db=db,
        action=action_type,
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="system",
        details={
            "invoice_number": db_invoice.invoice_number,
            "po_number": db_invoice.po_number,
            "seller_name": db_invoice.seller_name,
            "seller_gstin": db_invoice.seller_gstin,
            "buyer_name": db_invoice.buyer_name,
            "buyer_gstin": db_invoice.buyer_gstin,
            "shipping_name": db_invoice.shipping_name,
            "shipping_gstin": db_invoice.shipping_gstin,
            "total_invoice_value": db_invoice.total_invoice_value,
            "workflow_status": status_after,
            "validation_status": db_invoice.validation_status,
            "match_status": db_invoice.match_status,
            "confidence_score": db_invoice.confidence_score,
            "source_type": db_invoice.source_type
        }
    )

    return db_invoice


def update_invoice_fields(db: Session, invoice_id: int, updates: dict, actor: str) -> Invoice:
    """
    Purpose:
        Manually correct low-confidence extraction fields, re-running validation and PO matching.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    # Check workflow stage limit
    if invoice.workflow_status in [InvoiceWorkflowStatus.pending_approval, InvoiceWorkflowStatus.approved, InvoiceWorkflowStatus.released_for_payment, InvoiceWorkflowStatus.paid]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot edit fields of an invoice in '{invoice.workflow_status}' state."
        )
    
    # Log original extracted value + corrected value + editor identity on every field edit
    for field, new_val in updates.items():
        if field == "items" and isinstance(new_val, list):
            from app.models.invoice_item import InvoiceItem
            old_items = [{"description": it.description, "quantity": it.quantity, "unit_price": it.unit_price} for it in invoice.items]
            db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).delete()
            for it_idx, it_data in enumerate(new_val):
                item_obj = InvoiceItem(
                    invoice_id=invoice.id,
                    description=it_data.get("description"),
                    quantity=float(it_data.get("quantity") or 0.0),
                    unit_price=float(it_data.get("unit_price") or 0.0),
                    total_amount=float(it_data.get("total_amount") or 0.0),
                    gst_rate=float(it_data.get("gst_rate") or 0.0),
                    hsn_code=it_data.get("hsn_code"),
                    item_number=it_data.get("item_number") or (it_idx + 1)
                )
                db.add(item_obj)
            AuditService.log(
                db=db,
                action="LINE_ITEMS_MANUALLY_CORRECTED",
                invoice_id=invoice.id,
                status_before=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
                status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
                performed_by=actor,
                details={
                    "field": "items",
                    "original_value": str(old_items),
                    "corrected_value": str(new_val)
                }
            )
        elif hasattr(invoice, field):
            old_val = getattr(invoice, field)
            if field == "invoice_date" and isinstance(new_val, str) and new_val.strip():
                try:
                    from datetime import datetime
                    new_val = datetime.strptime(new_val.strip(), "%Y-%m-%d").date()
                except Exception as date_err:
                    logger.error(f"Failed to parse invoice_date string {new_val}: {date_err}")
            if old_val != new_val:
                AuditService.log(
                    db=db,
                    action="FIELD_MANUALLY_CORRECTED",
                    invoice_id=invoice.id,
                    status_before=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
                    status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
                    performed_by=actor,
                    details={
                        "field": field,
                        "original_value": str(old_val),
                        "corrected_value": str(new_val)
                    }
                )
                setattr(invoice, field, new_val)
                
    db.commit()
    db.refresh(invoice)
    
    # Re-run matching and validation
    run_invoice_matching(db, invoice_id)
    db.refresh(invoice)
    return invoice


def get_approver_queue(db: Session, page: Optional[int] = None, page_size: Optional[int] = None, organization_id: Optional[UUID] = None) -> List[Invoice]:
    """
    Purpose:
        Fetches all invoices awaiting manager approval, optionally paginated, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - page (Optional[int]): Page number (1-indexed).
        - page_size (Optional[int]): Page size.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - List[Invoice]: List of approver-queue invoices.
    """
    return InvoiceRepository.get_approver_queue(db, page=page, page_size=page_size, organization_id=organization_id)


def get_approver_queue_count(db: Session, organization_id: Optional[UUID] = None) -> int:
    """
    Purpose:
        Returns total count of approver queue, filtered by organization.
    Inputs:
        - db (Session): Active database session.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - int: Count of invoices in approver queue.
    """
    return InvoiceRepository.get_approver_queue_count(db, organization_id=organization_id)


def approve_invoice(db: Session, invoice_id: int, justification: str = "") -> Invoice:
    """
    Purpose:
        Transitions an invoice status to 'approved' if it is in the approval queue.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key ID of the invoice.
        - justification (str): Overriding justification note.
    Outputs:
        - Invoice: Approved invoice instance.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)
    
    # Enforce justification for PO mismatch overrides
    if invoice and invoice.match_status != "matched" and not justification:
        raise HTTPException(
            status_code=400,
            detail="A justification is required to override and approve an unmatched invoice."
        )
    
    # Check 1: Ensure invoice exists
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
        
    status_before = invoice.workflow_status.value if invoice.workflow_status else None

    # Check 2: Ensure invoice is currently in a state that can be approved
    allowed_statuses = {
        InvoiceWorkflowStatus.pending_approval,
        InvoiceWorkflowStatus.pending_review,
        InvoiceWorkflowStatus.validation_failed,
        InvoiceWorkflowStatus.validation_pending
    }
    if invoice.workflow_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve invoice in '{invoice.workflow_status}' state."
        )

    # Check 3: validation_failed → approved requires an explicit override policy.
    # The org Settings must have workflow_manual_override = True AND a non-empty
    # justification must be provided.  This prevents silently approving invoices
    # that failed GST/amount validation.
    if invoice.workflow_status == InvoiceWorkflowStatus.validation_failed:
        from app.models.settings import Settings as SettingsModel
        import logging as _logging
        _override_logger = _logging.getLogger("invoice_service.override")

        settings = None
        if invoice.organization_id:
            settings = SettingsModel.get_for_organization(db, invoice.organization_id)
        else:
            settings = db.query(SettingsModel).first()

        override_allowed = settings.workflow_manual_override if settings else False

        if not override_allowed:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Invoice failed validation and the organisation's override policy "
                    "is disabled (Settings → Workflow → Manual Override). "
                    "Enable override in settings or resolve validation errors before approving."
                ),
            )
        if not justification or len(justification.strip()) < 10:
            raise HTTPException(
                status_code=400,
                detail=(
                    "A detailed justification (≥10 characters) is required to approve an invoice "
                    "with active validation failures. Provide the reason via the 'justification' parameter."
                ),
            )

        # Audit the override decision so it is traceable
        _override_logger.warning(
            f"VALIDATION_FAILED OVERRIDE: invoice_id={invoice.id} "
            f"org={invoice.organization_id} "
            f"justification='{justification[:200]}'"
        )
        from app.services.audit_log_service import create_audit_log
        create_audit_log(
            db=db,
            action="VALIDATION_OVERRIDE_APPROVE",
            performed_by="invoice_service",
            details={
                "invoice_id": invoice.id,
                "previous_status": "validation_failed",
                "justification": justification,
            },
        )
        
    # Transition status
    invoice.workflow_status = InvoiceWorkflowStatus.approved
    invoice.status = "APPROVED"
    
    db.commit()
    db.refresh(invoice)

    # Propagate to Payment Queue by creating/updating PaymentSchedule record
    try:
        from app.models.payment import PaymentSchedule
        from datetime import date, timedelta
        
        due_val = invoice.due_date
        if not due_val:
            due_val = date.today() + timedelta(days=30)
        elif not isinstance(due_val, date):
            try:
                due_val = datetime.strptime(str(due_val), "%Y-%m-%d").date()
            except Exception:
                due_val = date.today() + timedelta(days=30)

        amt_val = float(invoice.total_invoice_value or invoice.total_amount or 0.0)
        
        sched = db.query(PaymentSchedule).filter(PaymentSchedule.invoice_id == invoice.id).first()
        if not sched:
            sched = PaymentSchedule(
                invoice_id=invoice.id,
                due_date=due_val,
                total_amount=amt_val,
                outstanding_balance=amt_val,
                status="Awaiting Scheduling",
                priority="High" if amt_val > 100000 else "Medium",
                risk_level="Low",
                payment_method="Bank Transfer",
                erp_status="Synced",
                audit_history=[{
                    "timestamp": datetime.utcnow().isoformat(),
                    "actor": "manager",
                    "action": "APPROVED_ADDED_TO_PAYMENT_QUEUE",
                    "details": f"Invoice #{invoice.invoice_number} approved and added to payment queue."
                }]
            )
            db.add(sched)
        else:
            sched.status = "Awaiting Scheduling"
            sched.total_amount = amt_val
            sched.outstanding_balance = max(0.0, amt_val - (sched.paid_amount or 0.0))
        db.commit()
    except Exception as sched_err:
        logger.error(f"Error creating PaymentSchedule for approved invoice {invoice.id}: {sched_err}", exc_info=True)
    
    # Trigger ERP Integration sync asynchronously via Celery to avoid blocking the approve response
    try:
        from app.workers.tasks import sync_invoice_to_erp
        sync_invoice_to_erp.delay(invoice.id)
        logger.info(f"Dispatched ERP sync task for invoice {invoice.id}")
    except Exception as erp_err:
        # Non-fatal: ERP sync failure should never block approval
        logger.error(f"Failed to dispatch ERP sync task for invoice {invoice.id}: {erp_err}", exc_info=True)

    
    # Log approval event
    AuditService.log(
        db=db,
        action="APPROVER_APPROVED",
        invoice_id=invoice.id,
        status_before=status_before,
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
        performed_by="manager",
        details={
            "invoice_number": invoice.invoice_number,
            "po_number": invoice.po_number,
            "seller_name": invoice.seller_name,
            "seller_gstin": invoice.seller_gstin,
            "buyer_name": invoice.buyer_name,
            "buyer_gstin": invoice.buyer_gstin,
            "shipping_name": invoice.shipping_name,
            "shipping_gstin": invoice.shipping_gstin,
            "total_invoice_value": invoice.total_invoice_value,
            "workflow_status": invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
            "validation_status": invoice.validation_status,
            "match_status": invoice.match_status,
            "confidence_score": invoice.confidence_score,
            "source_type": invoice.source_type,
            "justification": justification
        }
    )
    
    return invoice


def release_invoice_for_payment(db: Session, invoice_id: int, actor: str = "manager") -> Invoice:
    """
    Purpose:
        Releases an approved invoice for payment, enforcing validation that details haven't changed.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.workflow_status != InvoiceWorkflowStatus.approved:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot release invoice in '{invoice.workflow_status}' state. Must be approved."
        )
        
    # Check if invoice data changed since approval
    from app.models.audit_log import AuditLog
    approval_log = db.query(AuditLog).filter(
        AuditLog.invoice_id == invoice_id,
        AuditLog.action == "APPROVER_APPROVED"
    ).order_by(AuditLog.timestamp.desc()).first()
    
    if approval_log and approval_log.details:
        details = approval_log.details
        changed = []
        if details.get("total_invoice_value") != invoice.total_invoice_value:
            changed.append("total_invoice_value")
        if details.get("seller_gstin") != invoice.seller_gstin:
            changed.append("seller_gstin")
        if details.get("invoice_number") != invoice.invoice_number:
            changed.append("invoice_number")
            
        if changed:
            raise HTTPException(
                status_code=400,
                detail=f"Invoice details changed since approval: {', '.join(changed)}. Re-confirmation is required."
            )
            
    status_before = invoice.workflow_status.value if invoice.workflow_status else None
    
    invoice.workflow_status = InvoiceWorkflowStatus.released_for_payment
    invoice.status = "RELEASED_FOR_PAYMENT"
    
    db.commit()
    db.refresh(invoice)
    
    AuditService.log(
        db=db,
        action="APPROVER_RELEASED_FOR_PAYMENT",
        invoice_id=invoice.id,
        status_before=status_before,
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
        performed_by=actor,
        details={
            "invoice_number": invoice.invoice_number,
            "total_invoice_value": invoice.total_invoice_value,
            "seller_gstin": invoice.seller_gstin
        }
    )
    
    return invoice


def confirm_invoice_payment(db: Session, invoice_id: int, actor: str = "manager") -> Invoice:
    """
    Purpose:
        Confirms payment for a released invoice, moving it to 'paid' status.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
        
    if invoice.workflow_status != InvoiceWorkflowStatus.released_for_payment:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot confirm payment for invoice in '{invoice.workflow_status}' state. Must be released_for_payment."
        )
        
    status_before = invoice.workflow_status.value if invoice.workflow_status else None
    
    invoice.workflow_status = InvoiceWorkflowStatus.paid
    invoice.status = "PAID"
    
    db.commit()
    db.refresh(invoice)
    
    AuditService.log(
        db=db,
        action="APPROVER_CONFIRMED_PAYMENT",
        invoice_id=invoice.id,
        status_before=status_before,
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
        performed_by=actor,
        details={
            "invoice_number": invoice.invoice_number,
            "total_invoice_value": invoice.total_invoice_value,
            "seller_gstin": invoice.seller_gstin
        }
    )
    
    return invoice


def reject_invoice(db: Session, invoice_id: int, reason: str = "") -> Invoice:
    """
    Purpose:
        Transitions an invoice status to 'rejected' if it is in the approval queue.
    Inputs:
        - db (Session): Active database session.
        - invoice_id (int): Primary key ID of the invoice.
        - reason (str): Text explaining the rejection reason.
    Outputs:
        - Invoice: Rejected invoice instance.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)
    
    # Check 1: Ensure invoice exists
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
        
    status_before = invoice.workflow_status.value if invoice.workflow_status else None

    # Check 2: Ensure invoice is currently in a state that can be rejected
    allowed_statuses = {
        InvoiceWorkflowStatus.pending_approval,
        InvoiceWorkflowStatus.pending_review,
        InvoiceWorkflowStatus.validation_failed
    }
    if invoice.workflow_status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject invoice in '{invoice.workflow_status}' state."
        )
        
    # Transition status
    invoice.workflow_status = InvoiceWorkflowStatus.rejected
    invoice.status = "REJECTED"
    
    db.commit()
    db.refresh(invoice)
    
    # Log rejection event
    AuditService.log(
        db=db,
        action="APPROVER_REJECTED",
        invoice_id=invoice.id,
        status_before=status_before,
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
        performed_by="manager",
        details={
            "invoice_number": invoice.invoice_number,
            "po_number": invoice.po_number,
            "seller_name": invoice.seller_name,
            "seller_gstin": invoice.seller_gstin,
            "buyer_name": invoice.buyer_name,
            "buyer_gstin": invoice.buyer_gstin,
            "shipping_name": invoice.shipping_name,
            "shipping_gstin": invoice.shipping_gstin,
            "total_invoice_value": invoice.total_invoice_value,
            "workflow_status": invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
            "validation_status": invoice.validation_status,
            "match_status": invoice.match_status,
            "confidence_score": invoice.confidence_score,
            "source_type": invoice.source_type,
            "rejection_reason": reason
        }
    )
    
    return invoice


async def reprocess_invoice(db: Session, invoice_id: int) -> Invoice | None:
    """
    Purpose:
        Reprocesses an existing invoice by re-running OCR and AI extraction on its associated document file if found,
        running validation and PO matching, updating the record, and persisting to DB.
    """
    from datetime import datetime, timedelta
    import anyio
    from app.models.document import Document
    from app.models.job import Job
    from app.ingestion.storage import get_storage_provider
    from app.ai.services.ocr_service import extract_text_from_file_pipeline
    from app.ai.extraction.pipeline import ExtractionPipeline
    from app.validation.service import ValidationService as OldValidationService
    from app.matching.service import POMatchingService as OldPOMatchingService
    from app.workflow.service import WorkflowService as OldWorkflowService
    from app.schemas.invoice import InvoiceCreate

    db_invoice = InvoiceRepository.get_by_id(db, invoice_id)
    if not db_invoice:
        return None

    status_before = db_invoice.workflow_status.value if db_invoice.workflow_status else None

    # Try to find associated Document
    document = None
    if db_invoice.invoice_number:
        document = db.query(Document).filter(Document.filename.like(f"%{db_invoice.invoice_number}%")).first()
    if not document and db_invoice.extraction_timestamp:
        t_start = db_invoice.extraction_timestamp - timedelta(minutes=15)
        t_end = db_invoice.extraction_timestamp + timedelta(minutes=15)
        document = db.query(Document).filter(
            Document.uploaded_at >= t_start,
            Document.uploaded_at <= t_end
        ).first()
    if not document:
        # Fallback to latest uploaded document
        document = db.query(Document).order_by(Document.uploaded_at.desc()).first()

    file_bytes = None
    if document:
        try:
            storage_provider = get_storage_provider()
            file_bytes = storage_provider.get(document.storage_path)
        except Exception:
            file_bytes = None

    invoice_data = None
    confidence_data = None
    avg_confidence = None
    raw_text = db_invoice.raw_ocr_text
    source_type = db_invoice.source_type

    if file_bytes:
        # Run OCR Stage
        ocr_res = await anyio.to_thread.run_sync(
            extract_text_from_file_pipeline, file_bytes, document.filename
        )
        raw_text = ocr_res["raw_text"]
        ocr_result = ocr_res["ocr_result"]
        source_type = ocr_res["source_type"]

        # Run Extraction
        extraction_res = await ExtractionPipeline.process(ocr_result)
        invoice_data = extraction_res.get("invoice_data", {})
        confidence_data = extraction_res.get("confidence", {})

        if not invoice_data:
            invoice_data = {k: v for k, v in extraction_res.items() if k != "confidence"}
        if not confidence_data:
            confidence_data = {k: 0.9 for k in invoice_data.keys() if k != "items"}

        conf_scores = [v for v in confidence_data.values() if isinstance(v, (int, float))]
        avg_confidence = sum(conf_scores) / len(conf_scores) if conf_scores else 1.0

    if not invoice_data:
        # Fallback to existing extracted json or existing values
        invoice_data = db_invoice.extracted_json or {
            "invoice_number": db_invoice.invoice_number,
            "po_number": db_invoice.po_number,
            "seller_name": db_invoice.seller_name,
            "seller_gstin": db_invoice.seller_gstin,
            "buyer_name": db_invoice.buyer_name,
            "buyer_gstin": db_invoice.buyer_gstin,
            "total_invoice_value": db_invoice.total_invoice_value,
            "total_taxable_value": db_invoice.total_taxable_value,
            "total_cgst_value": db_invoice.total_cgst_value,
            "total_sgst_value": db_invoice.total_sgst_value,
            "total_igst_value": db_invoice.total_igst_value,
            "items": [
                {
                    "item_number": it.item_number,
                    "item_barcode": it.item_barcode,
                    "description": it.description,
                    "quantity": it.quantity,
                    "unit_price": it.unit_price,
                    "total_amount": it.total_amount,
                    "gst_rate": it.gst_rate,
                    "hsn_code": it.hsn_code,
                }
                for it in db_invoice.items
            ]
        }
        confidence_data = db_invoice.confidence_json
        avg_confidence = db_invoice.confidence_score

    # Auto-resolve missing entity names from GSTINs before validation
    resolve_entity_names(db, invoice_data)

    # Save to db_invoice fields
    items_data = invoice_data.pop("items", None) or []
    for k, v in invoice_data.items():
        if hasattr(db_invoice, k):
            setattr(db_invoice, k, v)

    db_invoice.raw_ocr_text = raw_text
    db_invoice.extracted_json = invoice_data
    db_invoice.confidence_json = confidence_data
    db_invoice.confidence_score = avg_confidence
    db_invoice.source_type = source_type
    db_invoice.extraction_timestamp = datetime.utcnow()

    # Rerun Validation
    val_report = OldValidationService().validate(invoice_data, db=db)
    db_invoice.validation_status = val_report["overall_status"]
    flat_errors = []
    for field, errs in val_report.get("field_errors", {}).items():
        for err in errs:
            flat_errors.append(f"{field}: {err}")
    db_invoice.validation_errors = flat_errors

    # Rerun Matching
    match_report = OldPOMatchingService().match_and_persist(db, db_invoice.id)
    db_invoice.status = match_report.get("status", "unmatched")
    db_invoice.match_status = match_report.get("status", "unmatched")
    db_invoice.match_score = match_report.get("match_score", 0.0)

    # Evaluate FSM / Auto-approval
    OldWorkflowService().evaluate_auto_approval(db, db_invoice.id)

    # Save line items
    # Format items to fit expected dictionary structure for save_transactional
    items_to_save = []
    for it in items_data:
        items_to_save.append({
            "item_number": it.get("item_number"),
            "item_barcode": it.get("item_barcode"),
            "description": it.get("description"),
            "quantity": it.get("quantity"),
            "unit_price": it.get("unit_price"),
            "total_amount": it.get("total_amount"),
            "gst_rate": it.get("gst_rate"),
            "hsn_code": it.get("hsn_code"),
            "is_service": it.get("is_service")
        })

    db_invoice = InvoiceRepository.save_transactional(db, db_invoice, items_to_save)

    status_after = db_invoice.workflow_status.value if db_invoice.workflow_status else None
    
    # Log Audit
    AuditService.log(
        db=db,
        action="INVOICE_REPROCESSED",
        invoice_id=db_invoice.id,
        status_before=status_before,
        status_after=status_after,
        performed_by="system",
        details={
            "invoice_number": db_invoice.invoice_number,
            "po_number": db_invoice.po_number,
            "seller_name": db_invoice.seller_name,
            "validation_status": db_invoice.validation_status,
            "match_status": db_invoice.match_status,
        }
    )

    return db_invoice


def reopen_invoice(db: Session, invoice_id: int, actor: str) -> Invoice:
    """
    Transitions a resolved (approved/paid) invoice back to the review stage.
    """
    invoice = InvoiceRepository.get_by_id(db, invoice_id)
    if not invoice:
        raise HTTPException(
            status_code=404,
            detail="Invoice not found"
        )
    status_before = invoice.workflow_status.value if invoice.workflow_status else None
    invoice.workflow_status = InvoiceWorkflowStatus.pending_review
    invoice.status = "PENDING"
    db.commit()
    db.refresh(invoice)
    AuditService.log(
        db=db,
        action="INVOICE_REOPENED",
        invoice_id=invoice.id,
        status_before=status_before,
        status_after=invoice.workflow_status.value if hasattr(invoice.workflow_status, "value") else invoice.workflow_status,
        performed_by=actor,
        details={
            "invoice_number": invoice.invoice_number,
            "message": "Invoice re-opened to Review stage"
        }
    )
    return invoice

