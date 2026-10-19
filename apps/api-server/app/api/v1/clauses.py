"""
REST API Endpoints for ConsentGuard AI (/v1/clauses)
"""

from datetime import date
from fastapi import APIRouter, HTTPException
from app.core.prompt import (
    AnalyzeClausesRequest,
    AnalyzeClausesResponse,
    ClauseInputItem,
    RevokeTemplateRequest,
    RevokeTemplateResponse,
)
from app.core.security import compute_normalized_sha256, sanitize_pii
from app.services.cache import get_cached_analysis, set_cached_analysis
from app.services.llm_client import analyze_clauses_hybrid

router = APIRouter(prefix="/v1/clauses", tags=["clauses"])


@router.post("/analyze", response_model=AnalyzeClausesResponse)
async def analyze_clauses(payload: AnalyzeClausesRequest) -> AnalyzeClausesResponse:
    items = list(payload.items)

    # Support raw_content fallback if items list is empty
    if not items and payload.raw_content:
        items = [
            ClauseInputItem(
                client_item_id="raw_1",
                raw_title="직접 입력 약관",
                raw_text=payload.raw_content,
            )
        ]

    if not items:
        raise HTTPException(status_code=400, detail="분석할 약관 항목(items 또는 raw_content)이 비어 있습니다.")

    # Compute Zero-Retention SHA-256 cache key
    combined_for_hash = "|".join(f"{i.client_item_id}:{i.raw_title}:{i.raw_text}" for i in items)
    cache_key = compute_normalized_sha256(combined_for_hash)

    cached = get_cached_analysis(cache_key)
    if cached:
        return AnalyzeClausesResponse(status="SUCCESS", data=cached)

    analyzed_data = await analyze_clauses_hybrid(items)
    set_cached_analysis(cache_key, analyzed_data)

    return AnalyzeClausesResponse(status="SUCCESS", data=analyzed_data)


@router.post("/revoke-template", response_model=RevokeTemplateResponse)
async def generate_revoke_template(payload: RevokeTemplateRequest) -> RevokeTemplateResponse:
    service_name = sanitize_pii(payload.service_name.strip()) or "대상 서비스"
    user_account = payload.user_account.strip() or "이용자 계정"
    targets_bullet = "\n".join(f"   - {t}" for t in payload.revoke_targets)
    today_str = date.today().isoformat()

    subject = f"[개인정보보호법 제37조] {service_name} 개인정보 제3자 제공 및 마케팅 동의 철회 요청"
    body = (
        f"수신: {service_name} 개인정보보호책임자\n"
        f"참조: 고객지원센터\n\n"
        f"제목: {subject}\n\n"
        f"본인은 개인정보보호법 제37조(개인정보의 처리정지 등) 및 정보통신망 이용촉진 및 정보보호 등에 관한 법률에 의거하여, "
        f"귀사 '{service_name}' 이용 시 동의하였던 아래 선택 항목에 대한 동의를 전면 철회하며 관련 개인정보의 즉각적인 파기를 요청합니다.\n\n"
        f"1. 철회 신청 항목:\n{targets_bullet}\n"
        f"2. 이용자 계정: {user_account}\n"
        f"3. 요청 근거: 개인정보보호법 제37조 제1항(정보주체의 처리정지 요구권)\n\n"
        f"본 요청을 접수한 날로부터 10일 이내에 법정 처리 결과를 회신해 주시기 바랍니다.\n\n"
        f"요청일자: {today_str}\n"
        f"정보주체: 이용자 본인"
    )

    return RevokeTemplateResponse(
        status="SUCCESS",
        service_name=service_name,
        legal_basis="개인정보보호법 제37조 제1항",
        subject=subject,
        body=body,
    )
