import os
os.environ["DATABASE_URL"] = "sqlite:///:memory:"

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import uuid4

# Setup test DB
from app.core.database import Base
from app.models.invoice import Invoice
from app.models.invoice_item import InvoiceItem
from app.models.organization import Organization
from app.models.vendor import Vendor
from app.services.invoice_repository import InvoiceRepository

# In-memory SQLite
engine = create_engine("sqlite:///:memory:")
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


def test_save_transactional_upsert(db):
    org_id = uuid4()
    # Mock organization (might not be needed if foreign key enforcement is off in sqlite, but good to have)
    org = Organization(id=org_id, name="Test Org", code="ORG1")
    db.add(org)
    db.commit()

    # Initial save
    invoice = Invoice(invoice_number="INV-001", organization_id=org_id)
    items_data = [
        {"item_number": 1, "description": "Item 1", "quantity": 10},
        {"item_number": 2, "description": "Item 2", "quantity": 20},
    ]
    saved_invoice = InvoiceRepository.save_transactional(db, invoice, items_data)

    # Assert initial save
    assert saved_invoice.id is not None
    assert len(saved_invoice.items) == 2
    item1_id = saved_invoice.items[0].id
    item2_id = saved_invoice.items[1].id
    assert item1_id is not None

    # Upsert: Update item 1, delete item 2, insert item 3
    new_items_data = [
        {"item_number": 1, "description": "Item 1 Updated", "quantity": 15},
        {"item_number": 3, "description": "Item 3", "quantity": 30},
    ]
    updated_invoice = InvoiceRepository.save_transactional(db, saved_invoice, new_items_data)

    assert len(updated_invoice.items) == 2

    # Verify Item 1 was updated (same ID)
    item1 = next(item for item in updated_invoice.items if item.item_number == 1)
    assert item1.id == item1_id
    assert item1.description == "Item 1 Updated"
    assert item1.quantity == 15

    # Verify Item 3 is new
    item3 = next(item for item in updated_invoice.items if item.item_number == 3)
    assert item3.id is not None
    assert item3.id != item1_id
    assert item3.id != item2_id


def test_composite_unique_constraint(db):
    org1_id = uuid4()
    org2_id = uuid4()

    # SQLite does enforce unique constraints.
    # We create two invoices with the same invoice number but different orgs
    invoice1 = Invoice(invoice_number="DUP-001", organization_id=org1_id, seller_gstin="GSTIN1")
    InvoiceRepository.save_transactional(db, invoice1, [])

    # This should succeed since it's a different org
    invoice2 = Invoice(invoice_number="DUP-001", organization_id=org2_id, seller_gstin="GSTIN1")
    InvoiceRepository.save_transactional(db, invoice2, [])

    # This should fail (same org, same invoice number, same seller)
    invoice3 = Invoice(invoice_number="DUP-001", organization_id=org1_id, seller_gstin="GSTIN1")

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        InvoiceRepository.save_transactional(db, invoice3, [])

    assert exc_info.value.status_code == 409
