from typing import List
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db, set_tenant_context
from app.models.user import User
from app.core.security.security import oauth2_scheme
from app.core.security.jwt import decode_token

def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    """Dependency to retrieve and validate the current authenticated user."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    if not token:
        token = request.cookies.get("access_token")
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    payload = decode_token(token)
    if payload is None or payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    user_id = payload.get("user_id")
    if not user_id:
        raise credentials_exception
        
    import uuid
    try:
        user_uuid = uuid.UUID(user_id) if isinstance(user_id, str) else user_id
    except ValueError:
        raise credentials_exception
        
    user = db.query(User).filter(User.id == user_uuid).first()
    if user is None:
        raise credentials_exception
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user account"
        )
        
    if user.role != "Super Admin" and user.organization_id:
        from app.models.organization import Organization
        org = db.query(Organization).filter(Organization.id == user.organization_id).first()
        if org and org.status == "Suspended":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Organization is suspended"
            )

    # Set PostgreSQL RLS session context so row-level security policies fire correctly.
    if user.role == "Super Admin":
        set_tenant_context(db, "BYPASS_RLS_SUPERADMIN")
    else:
        set_tenant_context(db, str(user.organization_id) if user.organization_id else "")

    return user


class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = [r.lower() for r in allowed_roles]
        if any(r in ["admin", "reviewer", "approver"] for r in self.allowed_roles):
            if "super admin" not in self.allowed_roles:
                self.allowed_roles.append("super admin")

    def __call__(self, user: User = Depends(get_current_user)) -> User:
        if user.role.lower() not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not authorized to access this resource"
            )
        return user


# Reusable dependency helpers
require_super_admin = RoleChecker(["Super Admin"])
require_admin = RoleChecker(["Admin"])
require_reviewer = RoleChecker(["Reviewer", "Admin"])
require_approver = RoleChecker(["Approver", "Admin"])
require_staff = RoleChecker(["Reviewer", "Approver", "Admin"])


