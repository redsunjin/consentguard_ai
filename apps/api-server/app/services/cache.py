"""
SHA-256 Hash-Based Zero-Retention Cache Service with TTL and Metrics
Stores only analysis results keyed by SHA-256 digest (never raw clause text).
"""

import time
from typing import Dict, Optional, Tuple
from app.core.config import settings
from app.core.prompt import AnalyzeClausesResponseData

_MEMORY_CACHE: Dict[str, Tuple[float, AnalyzeClausesResponseData]] = {}
_CACHE_STATS = {"hits": 0, "misses": 0}


def get_cached_analysis(digest: str) -> Optional[AnalyzeClausesResponseData]:
    entry = _MEMORY_CACHE.get(digest)
    if not entry:
        _CACHE_STATS["misses"] += 1
        return None

    expires_at, data = entry
    if time.time() > expires_at:
        _MEMORY_CACHE.pop(digest, None)
        _CACHE_STATS["misses"] += 1
        return None

    _CACHE_STATS["hits"] += 1
    return data


def set_cached_analysis(
    digest: str,
    data: AnalyzeClausesResponseData,
    ttl_seconds: Optional[int] = None,
) -> None:
    ttl = ttl_seconds if ttl_seconds is not None else settings.CACHE_TTL_SECONDS
    _MEMORY_CACHE[digest] = (time.time() + ttl, data)


def get_cache_stats() -> Dict[str, int]:
    return {
        "entries": len(_MEMORY_CACHE),
        "hits": _CACHE_STATS["hits"],
        "misses": _CACHE_STATS["misses"],
    }


def clear_cache() -> None:
    _MEMORY_CACHE.clear()
    _CACHE_STATS["hits"] = 0
    _CACHE_STATS["misses"] = 0
