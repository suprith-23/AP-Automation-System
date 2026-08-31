"""Payment Management Service."""
import logging
from datetime import date, datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.models.invoice import Invoice
from app.models.payment import PaymentSchedule, PaymentTransaction, CreditDebitNote

logger = logging.getLogger("payment.manager")

class PaymentManager:
    def initialize_payment_schedule(
        self,
        db: Session,
        invoice: Invoice,
        discount_percentage: float = 0.0,
        discount_days: int = 0
    ) -> PaymentSchedule:
        """
        Creates a payment schedule for an approved invoice, calculating early discount terms.
        """
        total = invoice.total_invoice_value or invoice.total_amount or 0.0
        due = invoice.due_date or (date.today() + timedelta(days=30))

        # Calculate early discount terms
        discount_deadline = None
        if discount_percentage > 0.0 and discount_days > 0 and invoice.invoice_date:
            discount_deadline = invoice.invoice_date + timedelta(days=discount_days)

        # Check if schedule already exists
        sched = db.query(PaymentSchedule).filter(PaymentSchedule.invoice_id == invoice.id).first()
        if not sched:
            sched = PaymentSchedule(
                invoice_id=invoice.id,
                due_date=due,
                early_discount_deadline=discount_deadline,
                early_discount_percentage=discount_percentage,
                total_amount=total,
                outstanding_balance=total,
                status="Awaiting Scheduling",
                priority="Medium",
                risk_level="Low"
            )
            db.add(sched)
        else:
            sched.due_date = due
            sched.early_discount_deadline = discount_deadline
            sched.early_discount_percentage = discount_percentage
            sched.total_amount = total
            sched.outstanding_balance = total - sched.paid_amount - sched.discount_applied
            if sched.status == "UNPAID":
                sched.status = "Awaiting Scheduling"

        # Update invoice workflow status to payment_queue
        invoice.workflow_status = "payment_queue"

        db.commit()
        db.refresh(sched)
        return sched

    def schedule_payment(self, db: Session, invoice_id: int, scheduled_date: date) -> Dict[str, Any]:
        """
        Schedules payment for a specific date.
        """
        sched = db.query(PaymentSchedule).filter(PaymentSchedule.invoice_id == invoice_id).first()
        if not sched:
            raise ValueError("Payment schedule not found. Ensure the invoice is approved.")

        sched.scheduled_date = scheduled_date
        sched.status = "SCHEDULED"
        db.commit()
        return {"invoice_id": invoice_id, "scheduled_date": scheduled_date.isoformat(), "status": "SCHEDULED"}

    def record_payment_transaction(
        self,
        db: Session,
        invoice_id: int,
        amount_paid: float,
        payment_method: str,
        reference_number: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Records a payment transaction, checks for early discounts, and adjusts outstanding balance.
        """
        sched = db.query(PaymentSchedule).filter(PaymentSchedule.invoice_id == invoice_id).first()
        if not sched:
            raise ValueError("Payment schedule not found.")

        # Check early discount eligibility
        discount_amt = 0.0
        today = date.today()
        if sched.early_discount_deadline and today <= sched.early_discount_deadline and sched.discount_applied == 0.0:
            discount_amt = round(sched.total_amount * sched.early_discount_percentage, 2)
            sched.discount_applied = discount_amt
            logger.info(f"Early payment discount of {discount_amt} applied for invoice {invoice_id}")

        # Update paid amounts and balances
        sched.paid_amount = round(sched.paid_amount + amount_paid, 2)
        sched.outstanding_balance = round(sched.total_amount - sched.paid_amount - sched.discount_applied, 2)

        # Ensure outstanding balance doesn't drop below zero due to rounding
        if sched.outstanding_balance < 0.0:
            sched.outstanding_balance = 0.0

        # Update status
        if sched.outstanding_balance <= 0.0:
            sched.status = "PAID"
            # Update Invoice model status
            inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if inv:
                inv.status = "PAID"
        else:
            sched.status = "PARTIALLY_PAID"

        db.commit()

        # Add transaction record
        tx = PaymentTransaction(
            payment_schedule_id=sched.id,
            amount_paid=amount_paid,
            reference_number=reference_number,
            payment_method=payment_method
        )
        db.add(tx)
        db.commit()

        return {
            "invoice_id": invoice_id,
            "amount_paid": amount_paid,
            "discount_applied": discount_amt,
            "outstanding_balance": sched.outstanding_balance,
            "status": sched.status
        }

    def apply_credit_debit_note(
        self,
        db: Session,
        invoice_id: int,
        note_number: str,
        note_type: str, # CREDIT, DEBIT
        amount: float,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Applies a credit or debit note to adjust the outstanding balance.
        """
        sched = db.query(PaymentSchedule).filter(PaymentSchedule.invoice_id == invoice_id).first()
        if not sched:
            raise ValueError("Payment schedule not found.")

        note_type = note_type.upper()
        if note_type not in ["CREDIT", "DEBIT"]:
            raise ValueError("Note type must be CREDIT or DEBIT.")

        # Create note record
        note = CreditDebitNote(
            note_number=note_number,
            invoice_id=invoice_id,
            note_type=note_type,
            amount=amount,
            reason=reason
        )
        db.add(note)

        # Adjust balances
        if note_type == "CREDIT":
            # Credit note reduces what we owe
            sched.total_amount = round(sched.total_amount - amount, 2)
        else:
            # Debit note increases what we owe
            sched.total_amount = round(sched.total_amount + amount, 2)

        sched.outstanding_balance = round(sched.total_amount - sched.paid_amount - sched.discount_applied, 2)
        if sched.outstanding_balance < 0.0:
            sched.outstanding_balance = 0.0

        if sched.outstanding_balance <= 0.0:
            sched.status = "PAID"
            inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if inv:
                inv.status = "PAID"
        elif sched.paid_amount > 0.0:
            sched.status = "PARTIALLY_PAID"
        else:
            sched.status = "UNPAID"

        db.commit()
        return {
            "invoice_id": invoice_id,
            "note_number": note_number,
            "new_total_amount": sched.total_amount,
            "new_outstanding_balance": sched.outstanding_balance,
            "status": sched.status
        }
