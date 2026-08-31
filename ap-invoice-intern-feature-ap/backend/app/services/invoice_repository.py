from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from app.models.invoice import Invoice, InvoiceWorkflowStatus
from app.models.invoice_item import InvoiceItem

class InvoiceRepository:
    """Isolates and encapsulates all SQLAlchemy database query and write operations for Invoices with tenant isolation."""

    @staticmethod
    def get_by_id(db: Session, invoice_id: int, organization_id: Optional[UUID] = None) -> Invoice | None:
        query = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.id == invoice_id)
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        return query.first()

    @staticmethod
    def get_by_number(db: Session, invoice_number: str, organization_id: Optional[UUID] = None) -> Invoice | None:
        query = db.query(Invoice).options(joinedload(Invoice.items)).filter(Invoice.invoice_number == invoice_number)
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        return query.first()

    @staticmethod
    def get_all(db: Session, page: Optional[int] = None, page_size: Optional[int] = None, organization_id: Optional[UUID] = None) -> List[Invoice]:
        query = db.query(Invoice)
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        query = query.order_by(Invoice.id.desc())
        if page is not None and page_size is not None:
            return query.offset((page - 1) * page_size).limit(page_size).all()
        return query.all()

    @staticmethod
    def get_total_count(db: Session, organization_id: Optional[UUID] = None) -> int:
        query = db.query(Invoice)
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        return query.count()

    @staticmethod
    def get_reviewer_queue(db: Session, page: Optional[int] = None, page_size: Optional[int] = None, organization_id: Optional[UUID] = None) -> List[Invoice]:
        query = db.query(Invoice).filter(
            Invoice.workflow_status.in_([
                InvoiceWorkflowStatus.validation_failed,
                InvoiceWorkflowStatus.pending_review
            ])
        )
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        query = query.order_by(Invoice.id.desc())
        if page is not None and page_size is not None:
            return query.offset((page - 1) * page_size).limit(page_size).all()
        return query.all()

    @staticmethod
    def get_reviewer_queue_count(db: Session, organization_id: Optional[UUID] = None) -> int:
        query = db.query(Invoice).filter(
            Invoice.workflow_status.in_([
                InvoiceWorkflowStatus.validation_failed,
                InvoiceWorkflowStatus.pending_review
            ])
        )
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        return query.count()

    @staticmethod
    def get_approver_queue(db: Session, page: Optional[int] = None, page_size: Optional[int] = None, organization_id: Optional[UUID] = None) -> List[Invoice]:
        query = db.query(Invoice).filter(
            Invoice.workflow_status == InvoiceWorkflowStatus.pending_approval
        )
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        query = query.order_by(Invoice.id.desc())
        if page is not None and page_size is not None:
            return query.offset((page - 1) * page_size).limit(page_size).all()
        return query.all()

    @staticmethod
    def get_approver_queue_count(db: Session, organization_id: Optional[UUID] = None) -> int:
        query = db.query(Invoice).filter(
            Invoice.workflow_status == InvoiceWorkflowStatus.pending_approval
        )
        if organization_id is not None:
            query = query.filter(Invoice.organization_id == organization_id)
        return query.count()

    @staticmethod
    def delete(db: Session, db_invoice: Invoice) -> None:
        db.delete(db_invoice)
        db.commit()

    @staticmethod
    def save_transactional(db: Session, db_invoice: Invoice, items_data: List[dict]) -> Invoice:
        try:
            is_update = db_invoice.id is not None
            
            db.add(db_invoice)
            db.flush()
            
            if is_update:
                existing_items = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == db_invoice.id).all()
                existing_items_map = {item.item_number: item for item in existing_items if item.item_number is not None}
                items_to_keep = set()
                
                for idx, item_data in enumerate(items_data):
                    item_num = item_data.get("item_number")
                    match_key = item_num if item_num is not None else (idx + 1)
                    
                    if match_key in existing_items_map:
                        db_item = existing_items_map[match_key]
                        for key, value in item_data.items():
                            setattr(db_item, key, value)
                        items_to_keep.add(db_item.id)
                    else:
                        db_item = InvoiceItem(invoice_id=db_invoice.id, **item_data)
                        if item_num is None:
                            db_item.item_number = match_key
                        db.add(db_item)
                        db.flush()
                        items_to_keep.add(db_item.id)
                
                for item in existing_items:
                    if item.id not in items_to_keep:
                        db.delete(item)
            else:
                for idx, item_data in enumerate(items_data):
                    if "item_number" not in item_data or item_data["item_number"] is None:
                        item_data["item_number"] = idx + 1
                    db_item = InvoiceItem(invoice_id=db_invoice.id, **item_data)
                    db.add(db_item)
                
            db.commit()
            db.refresh(db_invoice)
            return db_invoice
        except IntegrityError as e:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"Duplicate invoice number or constraint error during transactional commit."
            )
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Database transaction failed: {str(e)}"
            )
