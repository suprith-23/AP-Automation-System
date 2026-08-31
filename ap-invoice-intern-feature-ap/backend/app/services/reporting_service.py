"""Reporting and Export Service."""
import io
import csv
import logging
from typing import Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.tds import TDSLedgerEntry
from app.models.payment import PaymentSchedule, PaymentTransaction
from app.models.exception_record import InvoiceException
from app.models.audit_log import AuditLog

logger = logging.getLogger("reporting.service")

class ReportingService:
    def generate_csv_report(self, db: Session, report_type: str) -> str:
        """
        Generates a CSV report from live backend tables.
        Supported types: invoices, gst, tds, payments, exceptions, audit.
        """
        output = io.StringIO()
        writer = csv.writer(output)

        report_type = report_type.lower()

        if report_type == "invoices":
            writer.writerow(["Invoice ID", "Invoice Number", "Seller Name", "Seller GSTIN", "Total Amount", "Workflow Status", "Date"])
            records = db.query(Invoice).all()
            for r in records:
                writer.writerow([
                    r.id, r.invoice_number, r.seller_name or r.vendor_name,
                    r.seller_gstin, r.total_invoice_value or r.total_amount,
                    r.status, r.invoice_date
                ])

        elif report_type == "gst":
            writer.writerow(["Invoice Number", "Seller GSTIN", "Buyer GSTIN", "Taxable Value", "CGST", "SGST", "IGST", "Total GST Rate"])
            records = db.query(Invoice).all()
            for r in records:
                writer.writerow([
                    r.invoice_number, r.seller_gstin, r.buyer_gstin,
                    r.total_taxable_value, r.total_cgst_value, r.total_sgst_value,
                    r.total_igst_value, r.total_gst_rate
                ])

        elif report_type == "tds":
            writer.writerow(["ID", "Invoice ID", "Vendor GSTIN", "Vendor PAN", "Section Code", "Taxable Amount", "TDS Rate", "TDS Deducted", "Created At"])
            records = db.query(TDSLedgerEntry).all()
            for r in records:
                writer.writerow([
                    r.id, r.invoice_id, r.vendor_gstin, r.vendor_pan,
                    r.section_code, r.taxable_amount, r.tds_rate, r.tds_amount,
                    r.created_at.isoformat() if r.created_at else ""
                ])

        elif report_type == "payments":
            writer.writerow(["Schedule ID", "Invoice ID", "Due Date", "Total Amount", "Discount Applied", "Paid Amount", "Outstanding Balance", "Status"])
            records = db.query(PaymentSchedule).all()
            for r in records:
                writer.writerow([
                    r.id, r.invoice_id, r.due_date, r.total_amount,
                    r.discount_applied, r.paid_amount, r.outstanding_balance, r.status
                ])

        elif report_type == "exceptions":
            writer.writerow(["Exception ID", "Invoice ID", "Exception Type", "Error Message", "Status", "Created At"])
            records = db.query(InvoiceException).all()
            for r in records:
                writer.writerow([
                    r.id, r.invoice_id, r.exception_type, r.error_message,
                    r.status, r.created_at.isoformat() if r.created_at else ""
                ])

        elif report_type == "audit":
            writer.writerow(["Log ID", "Invoice ID", "Action", "Status Before", "Status After", "Performed By", "Timestamp"])
            records = db.query(AuditLog).all()
            for r in records:
                writer.writerow([
                    r.id, r.invoice_id, r.action, r.status_before,
                    r.status_after, r.performed_by, r.timestamp.isoformat() if r.timestamp else ""
                ])

        else:
            raise ValueError(f"Unknown report type: {report_type}")

        return output.getvalue()
