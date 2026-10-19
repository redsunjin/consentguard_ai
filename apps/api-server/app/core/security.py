"""
Security & Zero-Retention PII Sanitizer for ConsentGuard AI
Ensures no personal identifiable information reaches LLM endpoints or logs.
"""

import hashlib
import re

RRN_PATTERN = re.compile(r"\b\d{6}-[1-4]\d{6}\b")
PHONE_PATTERN = re.compile(r"\b01[016789]-\d{3,4}-\d{4}\b")
EMAIL_PATTERN = re.compile(r"\b[\w.-]+@[\w.-]+\.\w+\b")


def sanitize_pii(text: str) -> str:
    """Mask Korean RRN, mobile phone numbers, and email addresses."""
    if not text:
        return ""
    masked = RRN_PATTERN.sub("[MASKED_RRN]", text)
    masked = PHONE_PATTERN.sub("[MASKED_PHONE]", masked)
    masked = EMAIL_PATTERN.sub("[MASKED_EMAIL]", masked)
    return masked


def compute_normalized_sha256(text: str) -> str:
    """Compute SHA-256 hash of normalized clause text for Zero-Retention caching."""
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
