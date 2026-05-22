import os
import time
from app.services.execution_service import execution_service
import logging

logger = logging.getLogger(__name__)

class GSuiteService:
    def __init__(self):
        self.credentials_configured = False
        # In a real production environment, you would check for credentials.json here.
        # For now, we operate in powerful "Draft Mode".

    async def draft_email(self, to: str, subject: str, body: str) -> str:
        """Drafts an email and saves it to the workspace"""
        filename = f"email_draft_{int(time.time())}.eml"
        content = f"""To: {to}
Subject: {subject}
Date: {time.strftime('%a, %d %b %Y %H:%M:%S %z')}
MIME-Version: 1.0
Content-Type: text/plain; charset=utf-8

{body}
"""
        filepath = execution_service.save_code(filename, content)
        logger.info(f"[GSuite] Email draft saved to: {filepath}")
        return filename

    async def draft_calendar_event(self, title: str, date: str, time_str: str, description: str) -> str:
        """Drafts a calendar event (.ics) and saves it to the workspace"""
        filename = f"event_{title.replace(' ', '_')}_{int(time.time())}.ics"
        
        # Basic .ics format
        content = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//AI Platform Jarvis//EN
BEGIN:VEVENT
DTSTART:{date}T{time_str.replace(':', '')}00
DTEND:{date}T{time_str.replace(':', '')}00
SUMMARY:{title}
DESCRIPTION:{description}
END:VEVENT
END:VCALENDAR
"""
        filepath = execution_service.save_code(filename, content)
        logger.info(f"[GSuite] Calendar event saved to: {filepath}")
        return filename

# Singleton
gsuite_service = GSuiteService()