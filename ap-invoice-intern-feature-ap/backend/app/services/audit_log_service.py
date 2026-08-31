"""Business logic for creating and querying audit logs with tenant isolation."""

from typing import List, Optional
from uuid import UUID
import logging
from sqlalchemy.orm import Session
from app.models.audit_log import AuditLog

logger = logging.getLogger("ap_automation.audit_log_service")


def create_audit_log(
    db: Session,
    action: str,
    invoice_id: Optional[int] = None,
    status_before: Optional[str] = None,
    status_after: Optional[str] = None,
    performed_by: str = "system",
    details: Optional[dict] = None,
    organization_id: Optional[UUID] = None
) -> AuditLog | None:
    """
    Purpose:
        Create and persist a new audit log record in the database.
    """
    org_id = organization_id
    if invoice_id and not org_id:
        try:
            from app.models.invoice import Invoice
            inv = db.query(Invoice).filter(Invoice.id == invoice_id).first()
            if inv:
                org_id = inv.organization_id
        except Exception:
            pass

    # Tag Super Admin distinctly
    if performed_by and performed_by != "system" and not performed_by.endswith(" (Super Admin)"):
        try:
            from app.models.user import User
            sa_user = db.query(User).filter(
                ((User.name == performed_by) | (User.email == performed_by)) & 
                (User.role == "Super Admin")
            ).first()
            if sa_user:
                performed_by = f"{performed_by} (Super Admin)"
        except Exception:
            pass

    # Create the database model instance
    db_log = AuditLog(
        invoice_id=invoice_id,
        organization_id=org_id,
        action=action,
        status_before=status_before,
        status_after=status_after,
        performed_by=performed_by,
        details=details
    )
    
    # Add to transaction session
    try:
        db.add(db_log)
        db.commit()
        db.refresh(db_log)
        return db_log
    except Exception:
        db.rollback()
        logger.exception("Failed to persist audit log for action '%s'", action)
        return None


def get_all_audit_logs(
    db: Session,
    limit: int = 100,
    offset: int = 0,
    organization_id: Optional[UUID] = None
) -> List[AuditLog]:
    """
    Purpose:
        Retrieve all audit logs from the database, filtered by organization, ordered by latest timestamp.
    """
    query = db.query(AuditLog)
    if organization_id is not None:
        query = query.filter(AuditLog.organization_id == organization_id)
    return (
        query.order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


def get_audit_logs_by_invoice(
    db: Session,
    invoice_id: int,
    organization_id: Optional[UUID] = None
) -> List[AuditLog]:
    """
    Purpose:
        Retrieve all audit logs related to a specific invoice, filtered by organization.
    """
    query = db.query(AuditLog).filter(AuditLog.invoice_id == invoice_id)
    if organization_id is not None:
        query = query.filter(AuditLog.organization_id == organization_id)
    return (
        query.order_by(AuditLog.timestamp.desc())
        .all()
    )


class AuditService:
    """Service wrapper to isolate auditing and trace logs coordination (Backward Compatible)."""
    
    @staticmethod
    def log(
        db: Session,
        action: str,
        invoice_id: Optional[int] = None,
        status_before: Optional[str] = None,
        status_after: Optional[str] = None,
        performed_by: str = "system",
        details: Optional[dict] = None,
        organization_id: Optional[UUID] = None
    ):
        """Log a workflow action or system event with optional invoice details."""
        return create_audit_log(
            db=db,
            action=action,
            invoice_id=invoice_id,
            status_before=status_before,
            status_after=status_after,
            performed_by=performed_by,
            details=details,
            organization_id=organization_id
        )
