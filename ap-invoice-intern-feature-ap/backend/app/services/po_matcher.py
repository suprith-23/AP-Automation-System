"""Advanced Purchase Order and GRN Line Item Matching Engine."""
import logging
import re
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder
from app.models.po_item import PurchaseOrderItem, GRN, GRNItem

logger = logging.getLogger("po.matching")

class POMatchingEngine:
    def __init__(self, qty_tolerance: float = 0.05, price_tolerance: float = 0.02, tax_tolerance: float = 0.0, freight_tolerance: float = 50.0):
        self.qty_tolerance = qty_tolerance
        self.price_tolerance = price_tolerance
        self.tax_tolerance = tax_tolerance
        self.freight_tolerance = freight_tolerance

    def perform_matching(self, db: Session, invoice: Invoice, is_three_way: bool = True) -> Dict[str, Any]:
        """
        Performs 2-Way or 3-Way PO matching by delegating to the canonical MatchingEngine.
        """
        from app.models.settings import Settings
        
        # Load from DB settings if available
        qty = self.qty_tolerance
        price = self.price_tolerance
        tax = self.tax_tolerance
        freight = self.freight_tolerance
        
        settings = db.query(Settings).first()
        if settings:
            if settings.po_qty_tolerance_pct is not None:
                qty = settings.po_qty_tolerance_pct / 100.0
            if settings.po_price_tolerance_pct is not None:
                price = settings.po_price_tolerance_pct / 100.0
            if settings.po_tax_tolerance_pct is not None:
                tax = settings.po_tax_tolerance_pct / 100.0
            if settings.po_freight_tolerance_amount is not None:
                freight = settings.po_freight_tolerance_amount

        from app.matching.engine import MatchingEngine
        engine = MatchingEngine(
            db=db,
            qty_tolerance=qty,
            price_tolerance=price,
            tax_tolerance=tax,
            freight_tolerance=freight
        )
        return engine.perform_line_matching(db, invoice, is_three_way)

