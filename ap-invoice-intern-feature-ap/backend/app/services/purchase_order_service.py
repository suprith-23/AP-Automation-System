"""Business logic for purchase order operations with tenant isolation."""

from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List

from app.models.purchase_order import PurchaseOrder
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderUpdate
from fastapi import HTTPException


def create_purchase_order(db: Session, po: PurchaseOrderCreate, organization_id: Optional[UUID] = None) -> PurchaseOrder:
    """
    Purpose:
        Creates a new Purchase Order record in the database.
    Inputs:
        - db (Session): The database connection session.
        - po (PurchaseOrderCreate): Schema containing purchase order creation details.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - PurchaseOrder: The created database model instance.
    """
    # Check if a Purchase Order with the same po_number already exists.
    query = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == po.po_number)
    if organization_id is not None:
        query = query.filter(PurchaseOrder.organization_id == organization_id)
    
    existing = query.first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"PO Number {po.po_number} already exists"
        )
    db_po = PurchaseOrder(**po.model_dump())
    db_po.organization_id = organization_id
    db.add(db_po)
    db.commit()
    db.refresh(db_po)
    return db_po


def get_all_purchase_orders(db: Session, page: int = None, page_size: int = None, organization_id: Optional[UUID] = None) -> List[PurchaseOrder]:
    """
    Purpose:
        Returns purchase orders stored in the database, optionally paginated.
    Inputs:
        - db (Session): The database connection session.
        - page (int): Optional page number.
        - page_size (int): Optional number of records per page.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - list[PurchaseOrder]: List of purchase order model instances.
    """
    query = db.query(PurchaseOrder)
    if organization_id is not None:
        query = query.filter(PurchaseOrder.organization_id == organization_id)
    if page is not None and page_size is not None:
        return query.offset((page - 1) * page_size).limit(page_size).all()
    return query.all()


def get_purchase_order_by_id(db: Session, po_id: int, organization_id: Optional[UUID] = None) -> PurchaseOrder | None:
    """
    Purpose:
        Returns one purchase order by its primary key database ID.
    Inputs:
        - db (Session): The database connection session.
        - po_id (int): Primary key ID of the purchase order.
        - organization_id (Optional[UUID]): Org ID for tenant isolation.
    Outputs:
        - PurchaseOrder | None: The found purchase order model instance or None.
    """
    query = db.query(PurchaseOrder).filter(PurchaseOrder.id == po_id)
    if organization_id is not None:
        query = query.filter(PurchaseOrder.organization_id == organization_id)
    return query.first()


def delete_purchase_order(db: Session, po_id: int, organization_id: Optional[UUID] = None) -> PurchaseOrder | None:
    """
    Purpose:
        Deletes a purchase order record from the database.
    """
    db_po = get_purchase_order_by_id(db, po_id, organization_id)
    if db_po:
        db.delete(db_po)
        db.commit()
    return db_po


def update_purchase_order(db: Session, po_id: int, po_update: PurchaseOrderUpdate, organization_id: Optional[UUID] = None) -> PurchaseOrder | None:
    """
    Purpose:
        Updates specified fields of an existing Purchase Order record.
    """
    db_po = get_purchase_order_by_id(db, po_id, organization_id)
    if not db_po:
        return None

    update_data = po_update.model_dump(exclude_unset=True)

    # Validate po_number uniqueness
    if "po_number" in update_data and update_data["po_number"] is not None:
        query = db.query(PurchaseOrder).filter(
            PurchaseOrder.po_number == update_data["po_number"],
            PurchaseOrder.id != po_id
        )
        if organization_id is not None:
            query = query.filter(PurchaseOrder.organization_id == organization_id)
        
        existing = query.first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Purchase order with number '{update_data['po_number']}' already exists."
            )
    for key, value in update_data.items():
        setattr(db_po, key, value)
    db.commit()
    db.refresh(db_po)
    return db_po
