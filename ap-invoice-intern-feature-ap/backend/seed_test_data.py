"""Seed script to populate testing organizations, super admins, organization admins, reviewers, and approvers for manual testing.
Run this inside the backend docker container.
"""

import os
import sys

# Add current directory to path to enable app imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.env import init_env
init_env()

from app.core.database import SessionLocal
from app.models.organization import Organization
from app.models.user import User
from app.core.security.hashing import hash_password



def seed_test_data():
    print(f"Connecting to database and initializing tables...")
    db = SessionLocal()
    try:
        # 1. Seed Super Admin
        super_admin_email = "superadmin@company.com"
        super_admin = db.query(User).filter(User.email == super_admin_email).first()
        if not super_admin:
            super_admin = User(
                name="Global Super Admin",
                email=super_admin_email,
                password_hash=hash_password("SuperAdmin123!"),
                role="Super Admin",
                designation="Global Administrator",
                status="Active",
                is_active=True,
                employee_id="SA001"
            )
            db.add(super_admin)
            print(f"Created Super Admin: {super_admin_email} / SuperAdmin123!")
        else:
            print(f"Super Admin already exists: {super_admin_email}")

        # 2. Seed Organization 1 (Alpha Corp)
        org1_code = "ALPHA"
        org1 = db.query(Organization).filter(Organization.code == org1_code).first()
        if not org1:
            org1 = Organization(
                name="Alpha Corporation",
                code=org1_code,
                gst_number="27AAACA1234A1Z1",
                address="123 Alpha Industrial Area, Bangalore",
                status="Active"
            )
            db.add(org1)
            db.flush()
            print(f"Created Organization: {org1.name} (Code: {org1_code})")
        else:
            print(f"Organization '{org1.name}' already exists.")

        # 3. Seed Organization 2 (Beta Industries)
        org2_code = "BETA"
        org2 = db.query(Organization).filter(Organization.code == org2_code).first()
        if not org2:
            org2 = Organization(
                name="Beta Industries Ltd",
                code=org2_code,
                gst_number="29BBBCB5678B2Z2",
                address="456 Beta Tech Park, Mumbai",
                status="Active"
            )
            db.add(org2)
            db.flush()
            print(f"Created Organization: {org2.name} (Code: {org2_code})")
        else:
            print(f"Organization '{org2.name}' already exists.")

        db.commit()

        # Helper to seed users for an organization
        def seed_org_users(org: Organization, suffix: str):
            users_to_create = [
                {
                    "name": f"Admin {suffix}",
                    "email": f"admin@{suffix.lower()}.com",
                    "role": "Admin",
                    "designation": "Org Administrator",
                    "employee_id": f"ADM-{suffix}"
                },
                {
                    "name": f"Reviewer {suffix}",
                    "email": f"reviewer@{suffix.lower()}.com",
                    "role": "Reviewer",
                    "designation": "Data Reviewer",
                    "employee_id": f"REV-{suffix}"
                },
                {
                    "name": f"Approver {suffix}",
                    "email": f"approver@{suffix.lower()}.com",
                    "role": "Approver",
                    "designation": "Finance Approver",
                    "employee_id": f"APP-{suffix}"
                }
            ]

            for u_def in users_to_create:
                existing = db.query(User).filter(User.email == u_def["email"]).first()
                if not existing:
                    user = User(
                        name=u_def["name"],
                        email=u_def["email"],
                        password_hash=hash_password("Password123!"),
                        role=u_def["role"],
                        designation=u_def["designation"],
                        status="Active",
                        is_active=True,
                        employee_id=u_def["employee_id"],
                        department="Finance",
                        organization_id=org.id
                    )
                    db.add(user)
                    print(f"  Created user: {user.email} (Role: {user.role}) / Password123!")
                else:
                    print(f"  User {u_def['email']} already exists.")

        print(f"\nSeeding users for {org1.name}:")
        seed_org_users(org1, "Alpha")

        print(f"\nSeeding users for {org2.name}:")
        seed_org_users(org2, "Beta")

        # 4. Seed placeholder approval rule
        from app.models.approval import ApprovalRule
        rule = db.query(ApprovalRule).first()
        if not rule:
            # -- PLACEHOLDER, replace before prod: routing ANY invoice to a single Approver role
            rule = ApprovalRule(
                department=None,
                cost_center=None,
                min_amount=0.0,
                max_amount=None,
                auto_approve=None,
                approvers=["Approver"],
                sla_hours=48
            )
            db.add(rule)
            print("  Created placeholder approval rule: ANY amount -> single Approver")
        else:
            print("  Placeholder approval rule already exists.")

        db.commit()
        print("\nDatabase seeding completed successfully!")
        
    except Exception as e:
        db.rollback()
        print(f"\nError seeding data: {e}", file=sys.stderr)
    finally:
        db.close()


if __name__ == "__main__":
    seed_test_data()
