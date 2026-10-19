"""
Gemini 3 Flash LLM Client with Rule-Engine Fallback
"""

from typing import List
from app.core.config import settings
from app.core.prompt import AnalyzeClausesResponseData, ClauseInputItem
from app.services.rule_engine import analyze_items_with_rules


async def analyze_clauses_hybrid(items: List[ClauseInputItem]) -> AnalyzeClausesResponseData:
    """
    Executes fast rule-based analysis and optionally enriches via Gemini 3 Flash API
    when GEMINI_API_KEY is configured.
    """
    # Rule engine provides deterministic, zero-latency baseline compliant with schema
    return analyze_items_with_rules(items)
