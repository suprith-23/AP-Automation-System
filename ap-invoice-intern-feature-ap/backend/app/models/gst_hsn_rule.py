"""GSTHsnRule model — DB-backed list of RCM and Blocked-ITC HSN prefixes."""
from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base


class GSTHsnRule(Base):
    """Organisation-scoped HSN/SAC prefix rules.

    rule_type values:
      "RCM"         — Reverse Charge Mechanism applies to this HSN prefix
      "BLOCKED_ITC" — Input Tax Credit is blocked for this HSN prefix
    """
    __tablename__ = "gst_hsn_rules"

    id = Column(Integer, primary_key=True, index=True)
    organization_id = Column(
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    hsn_prefix = Column(String, nullable=False, index=True)
    rule_type = Column(String, nullable=False, index=True)  # "RCM" | "BLOCKED_ITC"

    organization = relationship("Organization")
