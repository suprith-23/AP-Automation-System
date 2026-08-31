"""Purchase order API routes with tenant isolation."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.purchase_order import PurchaseOrderCreate, PurchaseOrderUpdate, PurchaseOrderResponse
from app.services.purchase_order_service import (
    create_purchase_order,
    get_all_purchase_orders,
    get_purchase_order_by_id,
    update_purchase_order,
    delete_purchase_order,
)
from app.dependencies import get_current_user, RoleChecker

router = APIRouter(
    prefix="/purchase-orders",
    tags=["Purchase Orders"],
    dependencies=[Depends(get_current_user)]
)


@router.post(
    "",
    response_model=PurchaseOrderResponse,
    include_in_schema=False
)
@router.post(
    "/",
    response_model=PurchaseOrderResponse
)
def create_purchase_order_route(
    po: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    return create_purchase_order(db, po, organization_id=org_id)


@router.get(
    "",
    response_model=List[PurchaseOrderResponse],
    include_in_schema=False
)
@router.get(
    "/",
    response_model=List[PurchaseOrderResponse]
)
def list_purchase_orders_route(
    db: Session = Depends(get_db),
    page: Optional[int] = None,
    page_size: Optional[int] = None,
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    
    # --- DIAGNOSTIC LOG ---
    from app.models.purchase_order import PurchaseOrder
    print("\n=== list_purchase_orders API CALLED ===", flush=True)
    print(f"Current User: {current_user.email}, Role: {current_user.role}, Org ID: {org_id}", flush=True)
    try:
        all_pos = db.query(PurchaseOrder).all()
        print(f"Total POs in DB: {len(all_pos)}", flush=True)
        for p in all_pos[:5]:
            print(f" - PO: {p.po_number}, Org ID: {p.organization_id}", flush=True)
    except Exception as e:
        print(f"Failed to query database: {e}", flush=True)
    print("=================================\n", flush=True)
    # ----------------------
    
    return get_all_purchase_orders(db, page=page, page_size=page_size, organization_id=org_id)


@router.get(
    "/{po_id}",
    response_model=PurchaseOrderResponse
)
def get_purchase_order_route(
    po_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    po = get_purchase_order_by_id(db, po_id, organization_id=org_id)
    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )
    return po


@router.put(
    "/{po_id}",
    response_model=PurchaseOrderResponse
)
def update_purchase_order_route(
    po_id: int,
    po_update: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    po = update_purchase_order(db, po_id, po_update, organization_id=org_id)
    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )
    return po


@router.delete(
    "/{po_id}"
)
def delete_purchase_order_route(
    po_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(RoleChecker(["Admin"]))
):
    org_id = current_user.organization_id if current_user.role != "Super Admin" else None
    po = delete_purchase_order(db, po_id, organization_id=org_id)
    if not po:
        raise HTTPException(
            status_code=404,
            detail="Purchase order not found"
        )
    return {
        "message": "Purchase order deleted successfully"
    }
