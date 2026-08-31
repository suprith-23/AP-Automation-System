"""Payment tracking database models."""
from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, DateTime, Boolean, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base

class PaymentSchedule(Base):
    """Details on scheduled payments, priority, risk, assignments, and milestones."""
    __tablename__ = "payment_schedules"

    id = Column(Integer, primary_key=True, index=True)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    due_date = Column(Date, nullable=False)
    scheduled_date = Column(Date, nullable=True)
    early_discount_deadline = Column(Date, nullable=True)
    early_discount_percentage = Column(Float, default=0.0, nullable=False) # e.g. 0.02 for 2%
    total_amount = Column(Float, nullable=False)
    discount_applied = Column(Float, default=0.0, nullable=False)
    paid_amount = Column(Float, default=0.0, nullable=False)
    outstanding_balance = Column(Float, nullable=False)
    status = Column(String, default="Awaiting Scheduling", nullable=False) # Awaiting Scheduling, Scheduled, Queued, Processing, Payment Sent, Payment Confirmed, Failed, Retry Pending, Cancelled, Completed, Reconciled, ERP Updated, Notification Sent
    
    # Extended fields
    priority = Column(String, default="Medium", nullable=False) # Low, Medium, High, Critical, Urgent
    risk_level = Column(String, default="Low", nullable=False) # Low, Medium, High
    payment_method = Column(String, default="Bank Transfer", nullable=False) # Bank Transfer, NEFT, RTGS, UPI, ACH, etc.
    erp_status = Column(String, default="Pending", nullable=False) # Pending, Synced, Failed
    assigned_user = Column(String, nullable=True)
    expected_date = Column(Date, nullable=True)
    gateway_name = Column(String, default="Razorpay", nullable=False)
    audit_history = Column(JSON, default=lambda: [], nullable=False)

    invoice = relationship("Invoice")

class PaymentTransaction(Base):
    """Immutable ledger of payment payouts made."""
    __tablename__ = "payment_transactions"

    id = Column(Integer, primary_key=True, index=True)
    payment_schedule_id = Column(Integer, ForeignKey("payment_schedules.id", ondelete="CASCADE"), nullable=False)
    amount_paid = Column(Float, nullable=False)
    reference_number = Column(String, nullable=True) # Transaction ID
    payment_method = Column(String, nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow, nullable=False)
    gateway_response = Column(JSON, default=lambda: {}, nullable=True)

    schedule = relationship("PaymentSchedule", backref="transactions")

class CreditDebitNote(Base):
    """Credit or Debit notes applied to outstanding balances."""
    __tablename__ = "credit_debit_notes"

    id = Column(Integer, primary_key=True, index=True)
    note_number = Column(String, unique=True, index=True, nullable=False)
    invoice_id = Column(Integer, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False)
    note_type = Column(String, nullable=False) # CREDIT, DEBIT
    amount = Column(Float, nullable=False)
    reason = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    invoice = relationship("Invoice")

class PaymentGatewayConfig(Base):
    """Configuration for plug-and-play payment gateways (Razorpay, Stripe, etc.)"""
    __tablename__ = "payment_gateway_configs"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False) # Razorpay, Stripe, Cashfree, PayPal, Wise
    is_enabled = Column(Boolean, default=False, nullable=False)
    credentials = Column(JSON, default=lambda: {}, nullable=False)
    timeout_seconds = Column(Integer, default=30, nullable=False)
    supported_currencies = Column(JSON, default=lambda: ["INR"], nullable=False)
    daily_limit = Column(Float, default=1000000.0, nullable=False)
    test_status = Column(String, default="Never Tested", nullable=False)
    last_tested_at = Column(DateTime, nullable=True)
