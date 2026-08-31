"""Custom exception for unresolved Odoo vendor lookups."""


class VendorResolutionError(RuntimeError):
    """
    Raised when an invoice's seller cannot be matched to an existing partner
    in Odoo.  Instead of silently creating an unverified partner record,
    callers should route the invoice to the exception queue for master-data
    review.
    """
    def __init__(self, seller_name: str, seller_gstin: str | None, invoice_id: int | None = None):
        self.seller_name = seller_name
        self.seller_gstin = seller_gstin
        self.invoice_id = invoice_id
        super().__init__(
            f"Odoo vendor not found for seller='{seller_name}' "
            f"GSTIN='{seller_gstin}' (invoice_id={invoice_id}). "
            f"Route invoice to exception queue for master-data review."
        )
