"""SLA monitor and deadlines manager."""
import logging
from typing import List
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.workflow.models import SLARecord
from app.workflow.exceptions import SLAException

logger = logging.getLogger("workflow.sla")

class SLAMonitor:
    @staticmethod
    def start_sla(db: Session, invoice_id: int, sla_type: str, duration_hours: int = 48) -> SLARecord:
        """Create a new SLA timer record for an invoice."""
        existing = db.query(SLARecord).filter(
            SLARecord.invoice_id == invoice_id,
            SLARecord.sla_type == sla_type.upper(),
            SLARecord.resolved_at == None
        ).first()
        
        if existing:
            return existing

        deadline = datetime.utcnow() + timedelta(hours=duration_hours)
        record = SLARecord(
            invoice_id=invoice_id,
            sla_type=sla_type.upper(),
            deadline=deadline,
            breached=False
        )
        db.add(record)
        db.commit()
        db.refresh(record)
        logger.info(f"SLA tracking started for Invoice {invoice_id} [Type: {sla_type.upper()}]. Deadline: {deadline}.")
        return record

    @staticmethod
    def resolve_sla(db: Session, invoice_id: int, sla_type: str) -> None:
        """Mark an SLA record resolved."""
        records = db.query(SLARecord).filter(
            SLARecord.invoice_id == invoice_id,
            SLARecord.sla_type == sla_type.upper(),
            SLARecord.resolved_at == None
        ).all()
        for r in records:
            r.resolved_at = datetime.utcnow()
        db.commit()

    @staticmethod
    def check_and_escalate_sla_breaches(db: Session) -> List[SLARecord]:
        """Verify all unresolved SLAs and mark as breached if past deadline."""
        now = datetime.utcnow()
        breached_records = db.query(SLARecord).filter(
            SLARecord.deadline < now,
            SLARecord.breached == False,
            SLARecord.resolved_at == None
        ).all()

        for record in breached_records:
            record.breached = True
            record.breached_at = now
            logger.warning(f"SLA Breached for Invoice {record.invoice_id} [Type: {record.sla_type}]!")
            
            try:
                from app.models.invoice import Invoice
                from app.core.metrics import WORKFLOW_SLA_BREACH
                invoice = db.query(Invoice).filter(Invoice.id == record.invoice_id).first()
                if invoice:
                    tenant_id = str(invoice.organization_id) if invoice.organization_id else "global"
                    role = "reviewer"
                    if "approval" in record.sla_type.lower():
                        role = "approver"
                    WORKFLOW_SLA_BREACH.labels(role=role, tenant_id=tenant_id).inc()
            except Exception:
                pass
                
        db.commit()
        return breached_records
