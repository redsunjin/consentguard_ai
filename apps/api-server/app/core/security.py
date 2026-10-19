"""
Security, Zero-Retention PII Sanitizer & Lawyer Act Art. 109 Compliance Filter
Ensures no personal identifiable information reaches LLM endpoints or logs,
and prevents definitive legal advice expressions in outputs.
"""

import hashlib
import re

RRN_PATTERN = re.compile(r"\b\d{6}-[1-4]\d{6}\b")
PHONE_PATTERN = re.compile(r"\b01[016789]-\d{3,4}-\d{4}\b")
EMAIL_PATTERN = re.compile(r"\b[\w.-]+@[\w.-]+\.\w+\b")

# 변호사법 제109조 방어를 위한 단정적 법률 판단 표현 치환 사전
LEGAL_EXPRESSION_REPLACEMENTS = {
    "법적 무효": "표준약관 대비 효력 제한 소지",
    "당연 무효": "표준약관 대비 불리할 소지",
    "불법적인": "소비자 권익 침해 소지가 있는",
    "불법입니다": "주의가 필요합니다",
    "불법": "소비자 주의 필요",
    "위법한": "공정위 기준 대비 불리할 수 있는",
    "위법입니다": "표준약관 대비 불리할 수 있습니다",
    "위법": "표준약관 대비 불리할 소지",
}


def sanitize_pii(text: str) -> str:
    """Mask Korean RRN, mobile phone numbers, and email addresses."""
    if not text:
        return ""
    masked = RRN_PATTERN.sub("[MASKED_RRN]", text)
    masked = PHONE_PATTERN.sub("[MASKED_PHONE]", masked)
    masked = EMAIL_PATTERN.sub("[MASKED_EMAIL]", masked)
    return masked


def sanitize_legal_expressions(text: str) -> str:
    """Replace definitive legal judgment words with objective consumer caution phrasing."""
    if not text:
        return ""
    result = text
    for forbidden, replacement in LEGAL_EXPRESSION_REPLACEMENTS.items():
        result = result.replace(forbidden, replacement)
    return result


def compute_normalized_sha256(text: str) -> str:
    """Compute SHA-256 hash of normalized clause text for Zero-Retention caching."""
    normalized = re.sub(r"\s+", " ", (text or "").strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
