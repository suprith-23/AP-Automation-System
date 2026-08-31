"""Request schema for the AI extraction endpoint."""

from pydantic import BaseModel


class InvoiceRequest(BaseModel):
    """Raw invoice fields sent to the extractor."""

    inv_no: str
    supplier: str
    amt: str
