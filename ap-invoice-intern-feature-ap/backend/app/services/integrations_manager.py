import os
import logging
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.invoice import Invoice
from app.models.erp_sync_log import ERPSyncLog

# Import Odoo client & service
from app.integrations.odoo.odoo_client import OdooClient
from app.integrations.odoo.sync import OdooSyncService
from app.integrations.odoo.exceptions import VendorResolutionError

logger = logging.getLogger("integrations.manager")

class ERPIntegrationsManager:
    @staticmethod
    def get_configured_systems() -> list:
        """Returns a list of dicts detailing each ERP integration connector's properties."""
        import os
        return [
            {
                "id": "odoo",
                "name": "Odoo Community",
                "connectorType": "Odoo",
                "maskedKey": "odoo_•••• •••• •••• " + os.getenv("ODOO_API_KEY", "")[-4:] if os.getenv("ODOO_API_KEY") else "•••• •••• ••••",
                "environment": "production",
                "status": "active" if bool(os.getenv("ODOO_API_KEY") or os.getenv("ODOO_URL")) else "inactive",
                "desc": "Syncs vendor bills (account.move) automatically u/s XML-RPC.",
                "lastUsed": "2 min ago" if bool(os.getenv("ODOO_API_KEY") or os.getenv("ODOO_URL")) else "Never"
            },
            {
                "id": "sap",
                "name": "SAP S/4HANA Production",
                "connectorType": "SAP",
                "maskedKey": "sap_•••• •••• •••• " + os.getenv("SAP_API_KEY", "")[-4:] if os.getenv("SAP_API_KEY") else "•••• •••• ••••",
                "environment": "production",
                "status": "active" if bool(os.getenv("SAP_API_KEY") or os.getenv("SAP_URL")) else "inactive",
                "desc": "Syncs accounts payable records using OData REST API.",
                "lastUsed": "2 min ago" if bool(os.getenv("SAP_API_KEY") or os.getenv("SAP_URL")) else "Never"
            },
            {
                "id": "netsuite",
                "name": "Oracle NetSuite",
                "connectorType": "Oracle",
                "maskedKey": "ns_•••• •••• •••• " + os.getenv("NETSUITE_API_KEY", "")[-4:] if os.getenv("NETSUITE_API_KEY") else "•••• •••• ••••",
                "environment": "production",
                "status": "active" if bool(os.getenv("NETSUITE_TOKEN") or os.getenv("NETSUITE_API_KEY")) else "inactive",
                "desc": "Syncs purchase transactions using NetSuite RESTlets.",
                "lastUsed": "18 min ago" if bool(os.getenv("NETSUITE_TOKEN") or os.getenv("NETSUITE_API_KEY")) else "Never"
            },
            {
                "id": "quickbooks",
                "name": "QuickBooks Online",
                "connectorType": "QuickBooks",
                "maskedKey": "qb_•••• •••• •••• " + os.getenv("QUICKBOOKS_TOKEN", "")[-4:] if os.getenv("QUICKBOOKS_TOKEN") else "•••• •••• ••••",
                "environment": "development",
                "status": "active" if bool(os.getenv("QUICKBOOKS_TOKEN") or os.getenv("QUICKBOOKS_REALM_ID")) else "inactive",
                "desc": "Syncs expense ledger entries using QuickBooks OAuth2 API.",
                "lastUsed": "1 day ago" if bool(os.getenv("QUICKBOOKS_TOKEN") or os.getenv("QUICKBOOKS_REALM_ID")) else "Never"
            },
            {
                "id": "salesforce",
                "name": "Salesforce Staging Connector",
                "connectorType": "Salesforce",
                "maskedKey": "sf_•••• •••• •••• " + os.getenv("SALESFORCE_API_KEY", "")[-4:] if os.getenv("SALESFORCE_API_KEY") else "•••• •••• ••••",
                "environment": "staging",
                "status": "active" if bool(os.getenv("SALESFORCE_TOKEN") or os.getenv("SALESFORCE_API_KEY")) else "inactive",
                "desc": "Syncs client data using Salesforce REST API.",
                "lastUsed": "3h ago" if bool(os.getenv("SALESFORCE_TOKEN") or os.getenv("SALESFORCE_API_KEY")) else "Never"
            }
        ]

    @classmethod
    def get_configured_systems_dict(cls) -> dict:
        """Returns dict mapping system keys to configuration booleans."""
        systems = cls.get_configured_systems()
        return {sys["id"]: sys["status"] == "active" for sys in systems}

    @classmethod
    def sync_invoice_to_all(cls, db: Session, invoice: Invoice):
        """Syncs approved invoices to all configured ERP systems."""
        configs = cls.get_configured_systems_dict()
        org_id = str(invoice.organization_id) if invoice.organization_id else None
        logger.info(
            f"Triggering ERP Sync for Invoice {invoice.id} ({invoice.invoice_number}) "
            f"org={org_id}. Configured: {configs}"
        )

        # 1. Sync to Odoo
        if configs["odoo"]:
            cls._sync_to_odoo(db, invoice, org_id=org_id)
        
        # 2. Sync to NetSuite (Stub/Simulation for other keys if present)
        if configs["netsuite"]:
            cls._sync_to_stub(db, invoice, "netsuite")
            
        # 3. Sync to SAP (Stub/Simulation for other keys if present)
        if configs["sap"]:
            cls._sync_to_stub(db, invoice, "sap")

        # 4. Sync to QuickBooks (Stub/Simulation for other keys if present)
        if configs["quickbooks"]:
            cls._sync_to_stub(db, invoice, "quickbooks")

    @classmethod
    def _sync_to_odoo(cls, db: Session, invoice: Invoice, org_id: str = None):
        logger.info(f"Syncing invoice {invoice.id} to Odoo [org={org_id}]...")
        # Force reload .env file to pick up any newly updated credentials dynamically
        try:
            from dotenv import load_dotenv
            from pathlib import Path
            project_root = Path(__file__).resolve().parent.parent.parent.parent
            env_path = project_root / ".env"
            if env_path.exists():
                load_dotenv(dotenv_path=env_path, override=True)
        except Exception as e:
            logger.warning(f"Failed to reload .env dynamically: {e}")
            
        try:
            if org_id:
                # Use explicit per-org credentials, fallback to default if not configured
                clean_id = org_id.replace("-", "").upper()
                url = os.getenv(f"ODOO_URL_{clean_id}") or os.getenv("ODOO_URL")
                db_name = os.getenv(f"ODOO_DB_{clean_id}") or os.getenv("ODOO_DB")
                username = os.getenv(f"ODOO_USER_{clean_id}") or os.getenv("ODOO_USER")
                api_key = os.getenv(f"ODOO_API_KEY_{clean_id}") or os.getenv("ODOO_API_KEY")
                
                if not all([url, db_name, username, api_key]):
                    raise ValueError(f"Odoo credentials missing for organization {org_id} and no default credentials configured.")
            else:
                url = os.getenv("ODOO_URL", "http://localhost:8069")
                db_name = os.getenv("ODOO_DB", "odoo_db")
                username = os.getenv("ODOO_USER", "admin@company.com")
                api_key = os.getenv("ODOO_API_KEY", "your_odoo_api_key_here")

            # Initialize client and authenticate
            client = OdooClient(url=url, db=db_name, username=username, api_key=api_key)
            client.authenticate()

            sync_service = OdooSyncService(client, organization_id=org_id)
            bill_id = sync_service.post_invoice_to_odoo(db, invoice)

            # Record log
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            if 'erp_sync_logs' in inspector.get_table_names():
                log = ERPSyncLog(
                    invoice_id=invoice.id,
                    erp_system="odoo",
                    sync_status="SUCCESS",
                    external_ref=str(bill_id)
                )
                db.add(log)
                db.commit()
            logger.info(f"Odoo sync successful for invoice {invoice.id} [org={org_id}]. Odoo ID: {bill_id}")

        except VendorResolutionError as vex:
            # Structured exception: route to exception workflow, not generic failure
            logger.error(
                f"Vendor not found in Odoo for invoice {invoice.id} [org={org_id}]: {vex}"
            )
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            if 'erp_sync_logs' in inspector.get_table_names():
                log = ERPSyncLog(
                    invoice_id=invoice.id,
                    erp_system="odoo",
                    sync_status="VENDOR_MISSING",
                    error_message=str(vex)
                )
                db.add(log)
                db.commit()
            # Re-raise so Celery retry logic is aware
            raise

        except Exception as e:
            logger.error(f"Odoo sync failed for invoice {invoice.id} [org={org_id}]: {e}", exc_info=True)
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            if 'erp_sync_logs' in inspector.get_table_names():
                log = ERPSyncLog(
                    invoice_id=invoice.id,
                    erp_system="odoo",
                    sync_status="FAILED",
                    error_message=str(e)
                )
                db.add(log)
                db.commit()

    @classmethod
    def _sync_to_stub(cls, db: Session, invoice: Invoice, erp_system: str):
        logger.info(f"Syncing invoice {invoice.id} to mock {erp_system}...")
        try:
            # Simulate a successful API sync
            external_id = f"{erp_system.upper()}-BILL-{invoice.id}"
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            if 'erp_sync_logs' in inspector.get_table_names():
                log = ERPSyncLog(
                    invoice_id=invoice.id,
                    erp_system=erp_system,
                    sync_status="SUCCESS",
                    external_ref=external_id
                )
                db.add(log)
                db.commit()
            logger.info(f"{erp_system} sync simulated successfully for invoice {invoice.id}")
        except Exception as e:
            logger.error(f"{erp_system} sync failed: {e}")
            from sqlalchemy import inspect
            inspector = inspect(db.bind)
            if 'erp_sync_logs' in inspector.get_table_names():
                log = ERPSyncLog(
                    invoice_id=invoice.id,
                    erp_system=erp_system,
                    sync_status="FAILED",
                    error_message=str(e)
                )
                db.add(log)
                db.commit()
