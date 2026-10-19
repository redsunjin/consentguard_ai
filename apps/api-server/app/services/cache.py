"""
SHA-256 Hash-Based Zero-Retention Cache Service
Stores only analysis results keyed by SHA-256 digest (never raw clause text).
"""

from typing import Dict, Optional
from app.core.prompt import AnalyzeClausesResponseData

_MEMORY_CACHE: Dict[str, AnalyzeClausesResponseData] = {}


def get_cached_analysis(digest: str) -> Optional[AnalyzeClausesResponseData]:
    return _MEMORY_CACHE.get(digest)


def set_cached_analysis(digest: str, data: AnalyzeClausesResponseData) -> None:
    _MEMORY_CACHE[digest] = data
