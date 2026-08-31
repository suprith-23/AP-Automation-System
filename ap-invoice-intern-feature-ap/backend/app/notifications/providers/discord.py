"""Discord Notification Provider."""
import logging
from typing import Any, Dict
import httpx

logger = logging.getLogger("discord.notification")

class DiscordProvider:
    """
    Transforms business events into rich Discord embeds and sends them.
    """

    COLOR_MAP = {
        "INFO": 3447003,      # Blue
        "WARNING": 16776960,  # Yellow
        "ERROR": 15158332,    # Red
        "SUCCESS": 3066993,   # Green
    }

    @staticmethod
    def send_notification(webhook_url: str, event_type: str, invoice_id: str, message: str, severity: str, metadata: Dict[str, Any]) -> bool:
        """
        Sends a message to Discord with a short timeout.
        Returns True if successful.
        """
        if not webhook_url:
            return False

        color = DiscordProvider.COLOR_MAP.get(severity.upper(), 3447003)
        
        embed = {
            "title": f"[{severity.upper()}] {event_type.replace('_', ' ').title()}",
            "description": message,
            "color": color,
            "fields": [
                {"name": "Invoice ID", "value": str(invoice_id), "inline": True},
            ],
            "footer": {"text": "AP Automation System Notification"}
        }

        for k, v in metadata.items():
            if v and len(str(v)) < 1024:
                embed["fields"].append({"name": str(k).title(), "value": str(v), "inline": True})

        payload = {
            "embeds": [embed]
        }

        try:
            with httpx.Client(timeout=5.0) as client:
                resp = client.post(webhook_url, json=payload)
                resp.raise_for_status()
                return True
        except Exception as e:
            logger.error(f"Failed to send Discord notification: {str(e)}")
            return False
