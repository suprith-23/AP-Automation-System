"""Event system and publisher/subscriber structure for workflow events."""
import logging
from typing import Dict, Any, List, Callable
from sqlalchemy.orm import Session
from app.workflow.models import WorkflowEvent

logger = logging.getLogger("workflow.events")

# Dict mapping event name to list of listener functions
_listeners: Dict[str, List[Callable[[Session, int, Dict[str, Any]], None]]] = {}

def subscribe(event_type: str, callback: Callable[[Session, int, Dict[str, Any]], None]):
    """Registers a listener for a specific event type."""
    if event_type not in _listeners:
        _listeners[event_type] = []
    _listeners[event_type].append(callback)

def publish(db: Session, event_type: str, invoice_id: int, payload: Dict[str, Any]):
    """Publishes an event, persists it to DB, and executes any registered listeners."""
    logger.info(f"Publishing event {event_type} for Invoice {invoice_id}")
    
    # 1. Persist event
    try:
        evt = WorkflowEvent(
            event_type=event_type,
            invoice_id=invoice_id,
            payload=payload
        )
        db.add(evt)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist workflow event {event_type} for Invoice {invoice_id}: {str(e)}")

    # 2. Trigger listeners
    listeners = _listeners.get(event_type, [])
    for listener in listeners:
        try:
            listener(db, invoice_id, payload)
        except Exception as e:
            logger.error(f"Error executing listener {listener.__name__} for event {event_type}: {str(e)}")
