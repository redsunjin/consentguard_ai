"""
Gemini 3 Flash LLM Client with Rule-Engine Fallback
"""

import json
from typing import List
import httpx
from app.core.config import settings
from app.core.prompt import (
    AnalyzeClausesResponseData,
    ClauseInputItem,
    SYSTEM_INSTRUCTION,
)
from app.core.security import sanitize_pii
from app.services.rule_engine import analyze_items_with_rules


async def analyze_clauses_hybrid(items: List[ClauseInputItem]) -> AnalyzeClausesResponseData:
    """
    Executes fast rule-based analysis and enriches via Gemini 3 Flash API
    when GEMINI_API_KEY is configured. Always falls back safely to the deterministic rule engine.
    """
    baseline = analyze_items_with_rules(items)

    if not settings.GEMINI_API_KEY:
        return baseline

    sanitized_items = [
        {
            "client_item_id": item.client_item_id,
            "raw_title": sanitize_pii(item.raw_title),
            "raw_text": sanitize_pii(item.raw_text),
            "is_pre_checked": bool(item.is_pre_checked),
        }
        for item in items
    ]

    api_url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    )

    prompt_text = (
        "다음 약관 항목 리스트를 분석하여 AnalyzeClausesResponseData JSON 스키마로 응답하십시오:\n"
        f"{json.dumps(sanitized_items, ensure_ascii=False)}"
    )

    payload = {
        "contents": [{"parts": [{"text": prompt_text}]}],
        "systemInstruction": {"parts": [{"text": SYSTEM_INSTRUCTION}]},
        "generationConfig": {
            "temperature": 0.0,
            "responseMimeType": "application/json",
        },
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(api_url, json=payload)
            response.raise_for_status()
            body = response.json()
            candidate_text = (
                body.get("candidates", [{}])[0]
                .get("content", {})
                .get("parts", [{}])[0]
                .get("text")
            )
            if not candidate_text:
                return baseline
            parsed_json = json.loads(candidate_text)
            return AnalyzeClausesResponseData.model_validate(parsed_json)
    except Exception:
        return baseline
