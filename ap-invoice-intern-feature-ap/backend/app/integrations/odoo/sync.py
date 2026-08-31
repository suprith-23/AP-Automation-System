import logging
from datetime import datetime, date
from typing import Optional
from uuid import UUID

from sqlalchemy.orm import Session
from app.integrations.odoo.odoo_client import OdooClient
from app.integrations.odoo.mapping import map_invoice_to_odoo_bill
from app.integrations.odoo.exceptions import VendorResolutionError
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.po_item import PurchaseOrderItem, GRN, GRNItem
from app.workflow.exceptions import WorkflowException

logger = logging.getLogger("odoo.sync")


class OdooSyncService:
    def __init__(self, client: OdooClient, organization_id: Optional[str] = None):
        self.client = client
        # Tenant context for logging and data scoping
        self.organization_id = organization_id

    def _org_tag(self) -> str:
        return f"[org={self.organization_id or 'global'}]"

    def post_invoice_to_odoo(self, db: Session, invoice: Invoice) -> int:
        """
        Posts an approved invoice to Odoo as a vendor bill (account.move).
        Performs idempotency check using Odoo's 'ref' field.

        Raises VendorResolutionError if the seller cannot be matched to an
        existing Odoo partner — callers must catch this and route the invoice
        to the master-data exception queue instead of creating unverified records.
        """
        if not invoice.invoice_number:
            raise ValueError("Invoice invoice_number is missing; cannot post to Odoo.")

        org_tag = self._org_tag()
        logger.info(f"{org_tag} Checking for existing bill in Odoo with ref: {invoice.invoice_number}")

        # 1. Idempotency Check
        existing_moves = self.client.execute(
            "account.move",
            "search_read",
            [("ref", "=", invoice.invoice_number), ("move_type", "=", "in_invoice")],
            ["id"],
        )
        if existing_moves:
            logger.warning(
                f"{org_tag} Bill already exists in Odoo with ref '{invoice.invoice_number}' "
                f"(Odoo ID: {existing_moves[0]['id']}). Skipping creation."
            )
            return existing_moves[0]["id"]

        # 2. Vendor Lookup — GSTIN first, then name
        partner_id = None
        if invoice.seller_gstin:
            partners = self.client.execute(
                "res.partner",
                "search_read",
                [("vat", "=", invoice.seller_gstin)],
                ["id"],
            )
            if partners:
                partner_id = partners[0]["id"]

        if not partner_id and invoice.seller_name:
            partners = self.client.execute(
                "res.partner",
                "search_read",
                [("name", "ilike", invoice.seller_name)],
                ["id"],
            )
            if partners:
                partner_id = partners[0]["id"]

        if not partner_id:
            logger.info(f"{org_tag} Vendor NOT found in Odoo for invoice {invoice.id}. Creating new partner: {invoice.seller_name}")
            try:
                partner_payload = {
                    "name": invoice.seller_name or "New Vendor",
                    "vat": invoice.seller_gstin or "",
                    "is_company": True
                }
                partner_id = self.client.execute("res.partner", "create", partner_payload)
                logger.info(f"{org_tag} Created new partner in Odoo successfully. Partner ID: {partner_id}")
            except Exception as partner_err:
                logger.error(f"{org_tag} Failed to create partner in Odoo: {partner_err}")
                raise VendorResolutionError(
                    seller_name=invoice.seller_name or "",
                    seller_gstin=invoice.seller_gstin,
                    invoice_id=invoice.id,
                )

        # 3. Fetch line items
        lines = db.query(InvoiceItem).filter(InvoiceItem.invoice_id == invoice.id).all()

        # 4. Map and create vendor bill
        bill_payload = map_invoice_to_odoo_bill(invoice, partner_id, lines)
        try:
            bill_id = self.client.execute("account.move", "create", bill_payload)
            logger.info(f"{org_tag} Successfully created Vendor Bill in Odoo. Bill ID: {bill_id}")
            
            # Auto-post (confirm) and register payment in Odoo if paid in AP system
            if invoice.status == "PAID" or invoice.workflow_status == "payment_completed":
                logger.info(f"{org_tag} Invoice is PAID. Auto-confirming and registering payment in Odoo...")
                try:
                    # 1. Confirm the draft bill (moves state from draft to posted)
                    self.client.execute("account.move", "action_post", [bill_id])
                    logger.info(f"{org_tag} Successfully posted (confirmed) Odoo Bill ID: {bill_id}")
                    
                    # 2. Find default Bank/Cash journal
                    journals = self.client.execute(
                        "account.journal",
                        "search_read",
                        [("type", "in", ["bank", "cash"])],
                        ["id"]
                    )
                    journal_id = journals[0]["id"] if journals else None
                    
                    # 3. Create and execute the register payment wizard
                    wizard_context = {"active_model": "account.move", "active_ids": [bill_id]}
                    wizard_payload = {
                        "payment_date": date.today().isoformat(),
                        "amount": float(invoice.total_invoice_value or 0.0),
                    }
                    if journal_id:
                        wizard_payload["journal_id"] = journal_id
                        
                    wizard_id = self.client.execute(
                        "account.payment.register",
                        "create",
                        wizard_payload,
                        context=wizard_context
                    )
                    self.client.execute(
                        "account.payment.register",
                        "action_create_payments",
                        [wizard_id],
                        context=wizard_context
                    )
                    logger.info(f"{org_tag} Successfully registered payment for Odoo Bill ID: {bill_id}")
                except Exception as post_pay_err:
                    logger.error(f"{org_tag} Failed to auto-confirm/pay bill in Odoo: {post_pay_err}")
                    
            return bill_id
        except Exception as e:
            raise WorkflowException(f"Failed to post bill to Odoo: {str(e)}")

    def sync_reference_data(self, db: Session, organization_id: Optional[str] = None) -> None:
        """
        Pulls open POs (purchase.order) and stock receipts (stock.picking)
        from Odoo and synchronises them into local PostgreSQL tables.

        The `organization_id` parameter scopes all upserted rows so that each
        tenant only sees their own ERP data.
        """
        org_id = organization_id or self.organization_id
        org_tag = f"[org={org_id or 'global'}]"
        logger.info(f"{org_tag} Synchronising purchase orders from Odoo...")

        odoo_pos = self.client.execute(
            "purchase.order",
            "search_read",
            [(("state", "in", ["purchase", "done"]),)],
            ["name", "partner_id", "amount_total", "date_order", "state", "order_line"],
        )

        for opo in odoo_pos:
            partner_data = self.client.execute(
                "res.partner",
                "read",
                [opo["partner_id"][0]],
                ["name", "vat"],
            )
            vendor_name = partner_data[0]["name"] if partner_data else "Unknown Vendor"
            vendor_gstin = partner_data[0]["vat"] if partner_data and partner_data[0]["vat"] else None

            po_status = PurchaseOrderStatus.open
            if opo["state"] == "done":
                po_status = PurchaseOrderStatus.closed

            po_date_val = opo["date_order"]
            if isinstance(po_date_val, str):
                po_date_val = datetime.fromisoformat(po_date_val.replace("Z", "+00:00")).date()
            elif not po_date_val:
                po_date_val = date.today()

            # Scope upsert by po_number AND organization_id to prevent cross-tenant leakage
            query = db.query(PurchaseOrder).filter(PurchaseOrder.po_number == opo["name"])
            if org_id:
                query = query.filter(PurchaseOrder.organization_id == org_id)
            local_po = query.first()

            if not local_po:
                local_po = PurchaseOrder(
                    po_number=opo["name"],
                    vendor_name=vendor_name,
                    vendor_gstin=vendor_gstin,
                    po_amount=float(opo["amount_total"]),
                    po_date=po_date_val,
                    status=po_status,
                )
                if org_id and hasattr(local_po, "organization_id"):
                    local_po.organization_id = org_id
                db.add(local_po)
            else:
                local_po.vendor_name = vendor_name
                local_po.vendor_gstin = vendor_gstin
                local_po.po_amount = float(opo["amount_total"])
                local_po.po_date = po_date_val
                local_po.status = po_status

            db.commit()
            db.refresh(local_po)

            # Sync PO Lines
            if opo["order_line"]:
                lines_data = self.client.execute(
                    "purchase.order.line",
                    "read",
                    opo["order_line"],
                    ["name", "product_qty", "price_unit", "taxes_id", "price_subtotal"],
                )
                db.query(PurchaseOrderItem).filter(PurchaseOrderItem.po_id == local_po.id).delete()
                for i, line in enumerate(lines_data):
                    po_line = PurchaseOrderItem(
                        po_id=local_po.id,
                        item_number=i + 1,
                        description=line["name"],
                        quantity=float(line["product_qty"]),
                        unit_price=float(line["price_unit"]),
                        tax_rate=0.0,
                        total_amount=float(line["price_subtotal"]),
                    )
                    db.add(po_line)
                db.commit()

        # 2. GRN Sync
        logger.info(f"{org_tag} Synchronising goods receipts (GRNs) from Odoo...")
        odoo_receipts = self.client.execute(
            "stock.picking",
            "search_read",
            [(("state", "=", "done"), ("origin", "!=", False))],
            ["name", "origin", "date_done", "move_ids_without_package"],
        )

        for rec in odoo_receipts:
            grn_date_val = rec["date_done"]
            if isinstance(grn_date_val, str):
                grn_date_val = datetime.fromisoformat(grn_date_val.replace("Z", "+00:00")).date()
            elif not grn_date_val:
                grn_date_val = date.today()

            grn_q = db.query(GRN).filter(GRN.grn_number == rec["name"])
            if org_id and hasattr(GRN, "organization_id"):
                grn_q = grn_q.filter(GRN.organization_id == org_id)
            local_grn = grn_q.first()

            if not local_grn:
                local_grn = GRN(
                    grn_number=rec["name"],
                    po_number=rec["origin"],
                    received_date=grn_date_val,
                    received_by="Odoo Sync",
                )
                if org_id and hasattr(local_grn, "organization_id"):
                    local_grn.organization_id = org_id
                db.add(local_grn)
                db.commit()
                db.refresh(local_grn)

            if rec["move_ids_without_package"]:
                moves = self.client.execute(
                    "stock.move",
                    "read",
                    rec["move_ids_without_package"],
                    ["name", "quantity"],
                )
                db.query(GRNItem).filter(GRNItem.grn_id == local_grn.id).delete()
                for i, move in enumerate(moves):
                    grn_item = GRNItem(
                        grn_id=local_grn.id,
                        item_number=i + 1,
                        hsn_code=None,
                        quantity_received=float(move.get("quantity", 0.0) or 0.0),
                        quantity_accepted=float(move.get("quantity", 0.0) or 0.0),
                        quantity_rejected=0.0,
                    )
                    db.add(grn_item)
                db.commit()
