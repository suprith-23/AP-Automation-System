"""Service module for resolving entity names based on GSTINs."""

from sqlalchemy.orm import Session
from app.models.purchase_order import PurchaseOrder
from app.models.invoice import Invoice

def resolve_entity_names(db: Session, invoice_data: dict) -> None:
    """
    Purpose:
        Auto-resolves seller_name, buyer_name, and shipping_name from the database
        or fallback patterns if they are missing but their corresponding GSTINs are provided.
    Inputs:
        - db (Session): The database connection session.
        - invoice_data (dict): A dictionary containing invoice fields to be updated in-place.
    Outputs:
        - None: Modifies invoice_data in-place.
    """
    # 1. Resolve seller_name
    seller_gstin = invoice_data.get("seller_gstin")
    seller_name = invoice_data.get("seller_name")
    if seller_gstin and not (seller_name and str(seller_name).strip()):
        resolved = False
        
        # Look up vendor name from matching PO if po_number is provided
        po_number = invoice_data.get("po_number")
        if po_number:
            po = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == str(po_number).strip()).first()
            if po and po.vendor_name:
                if po.vendor_gstin:
                    if po.vendor_gstin == seller_gstin:
                        invoice_data["seller_name"] = po.vendor_name
                        resolved = True
                else:
                    # Fallback for legacy POs where vendor_name holds the GSTIN or vendor name matches seller_gstin
                    if po.vendor_name == seller_gstin:
                        invoice_data["seller_name"] = po.vendor_name
                        resolved = True
        
        # If not resolved by PO, check for other POs with the same vendor_gstin
        if not resolved:
            po = db.query(PurchaseOrder).filter(PurchaseOrder.vendor_gstin == seller_gstin).first()
            if po and po.vendor_name:
                invoice_data["seller_name"] = po.vendor_name
                resolved = True

        # If not resolved from PO, check existing invoices with non-empty seller_name
        if not resolved:
            prev_inv = (
                db.query(Invoice)
                .filter(Invoice.seller_gstin == seller_gstin)
                .filter(Invoice.seller_name.isnot(None))
                .filter(Invoice.seller_name != "")
                .first()
            )
            if prev_inv:
                invoice_data["seller_name"] = prev_inv.seller_name
                resolved = True
                
        # If still not resolved, fall back to vendor_name compatibility field if present
        if not resolved and invoice_data.get("vendor_name"):
            invoice_data["seller_name"] = invoice_data.get("vendor_name")
            resolved = True
            
        # Hard fallback: keep as None if not resolved to avoid database pollution
        if not resolved:
            invoice_data["seller_name"] = None

    # 2. Resolve buyer_name
    buyer_gstin = invoice_data.get("buyer_gstin")
    buyer_name = invoice_data.get("buyer_name")
    if buyer_gstin and not (buyer_name and str(buyer_name).strip()):
        resolved = False
        
        # Check existing invoices
        prev_inv = (
            db.query(Invoice)
            .filter(Invoice.buyer_gstin == buyer_gstin)
            .filter(Invoice.buyer_name.isnot(None))
            .filter(Invoice.buyer_name != "")
            .first()
        )
        if prev_inv:
            invoice_data["buyer_name"] = prev_inv.buyer_name
            resolved = True
            
        # Hard fallback: keep as None if not resolved to avoid database pollution
        if not resolved:
            invoice_data["buyer_name"] = None

    # 3. Resolve shipping_name
    shipping_gstin = invoice_data.get("shipping_gstin")
    shipping_name = invoice_data.get("shipping_name")
    if shipping_gstin and not (shipping_name and str(shipping_name).strip()):
        resolved = False
        
        # Check if shipping GSTIN matches buyer GSTIN (most common case)
        if shipping_gstin == buyer_gstin:
            invoice_data["shipping_name"] = invoice_data.get("buyer_name")
            resolved = True
            
        if not resolved:
            # Check existing invoices
            prev_inv = (
                db.query(Invoice)
                .filter(Invoice.shipping_gstin == shipping_gstin)
                .filter(Invoice.shipping_name.isnot(None))
                .filter(Invoice.shipping_name != "")
                .first()
            )
            if prev_inv:
                invoice_data["shipping_name"] = prev_inv.shipping_name
                resolved = True
                
        # Hard fallback: keep as None if not resolved to avoid database pollution
        if not resolved:
            invoice_data["shipping_name"] = None
