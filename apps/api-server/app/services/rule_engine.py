"""
First-Pass Rule Engine for ConsentGuard AI
Fast regex/keyword detection for toxic clauses and dark patterns.
"""

import re
import uuid
from typing import List
from app.core.prompt import (
    AnalyzeClausesResponseData,
    AnalyzedClauseItem,
    ClauseInputItem,
    ClauseIssue,
    DarkPatternFinding,
    OverallSummary,
    RiskLevel,
)
from app.core.security import sanitize_pii


def analyze_items_with_rules(items: List[ClauseInputItem]) -> AnalyzeClausesResponseData:
    analyzed_items: List[AnalyzedClauseItem] = []
    dark_patterns: List[DarkPatternFinding] = []
    highest_risk: RiskLevel = "GREEN"
    unchecks_count = 0

    for item in items:
        clean_title = sanitize_pii(item.raw_title)
        clean_text = sanitize_pii(item.raw_text)
        combined = f"{clean_title} {clean_text}"

        is_optional = (
            "[선택]" in clean_title
            or "선택" in clean_title
            or ("필수" not in clean_title and any(k in combined for k in ["마케팅", "광고", "이벤트", "제3자"]))
        )
        clause_type = "OPTIONAL" if is_optional else "MANDATORY"

        issues: List[ClauseIssue] = []
        risk_level: RiskLevel = "GREEN"

        # 1. Copyright Infringement / UGC Transfer
        if any(k in combined for k in ["저작재산권", "영구 귀속", "영구히 귀속", "영구히 양도", "저작인격권"]):
            risk_level = "RED"
            issues.append(
                ClauseIssue(
                    category="COPYRIGHT_INFRINGE",
                    evidence=_extract_sentence(clean_text, ["저작", "귀속", "양도"]),
                    description="공정위 표준약관 대비 이용자 게시물의 상업적 권리를 과도하게 제한할 소지가 있어 소비자 주의가 필요합니다.",
                )
            )

        # 2. Blanket Exemption
        if any(k in combined for k in ["일체의 책임을 부담하지", "배상하지 않으며", "책임을 면합니다"]):
            risk_level = "RED"
            issues.append(
                ClauseIssue(
                    category="UNFAIR_EXEMPTION",
                    evidence=_extract_sentence(clean_text, ["책임", "배상", "면합"]),
                    description="사업자의 귀책사유에 대한 손해배상 책임을 포괄적으로 배제하는 조항으로 소비자 주의가 필요합니다.",
                )
            )

        # 3. Third-Party Overexposure (Insurance / Financial TM)
        if any(k in combined for k in ["제3자", "보험", "제휴", "금융"]):
            risk_level = "RED"
            issues.append(
                ClauseIssue(
                    category="THIRD_PARTY_OVEREXPOSURE",
                    evidence=_extract_sentence(clean_text, ["제3자", "보험", "제휴", "제공"]),
                    description="외부 제휴사 및 금융·보험사로 연락처가 제공되어 텔레마케팅에 노출될 수 있으므로 주의가 필요합니다.",
                )
            )

        # 4. Refund Restriction
        if any(k in combined for k in ["환불이 일체 불가", "환불 불가", "위약금 30%"]):
            risk_level = "RED"
            issues.append(
                ClauseIssue(
                    category="REFUND_RESTRICTION",
                    evidence=_extract_sentence(clean_text, ["환불", "취소", "위약금"]),
                    description="전자상거래법 및 소비자분쟁해결기준 대비 청약철회 권리가 불리하게 제한될 소지가 있습니다.",
                )
            )
            dark_patterns.append(
                DarkPatternFinding(
                    category="CANCELLATION_BARRIER",
                    evidence=_extract_sentence(clean_text, ["환불", "위약금"]),
                    description="중도 해지 또는 청약철회를 과도하게 제한하는 조건이 포함되어 있습니다.",
                )
            )

        # 5. Marketing / Night-time Ads
        if any(k in combined for k in ["광고", "마케팅", "SMS", "푸시", "할인 쿠폰"]):
            if risk_level == "GREEN":
                risk_level = "YELLOW"
            issues.append(
                ClauseIssue(
                    category="MARKETING_OPT_IN",
                    evidence=_extract_sentence(clean_text, ["광고", "마케팅", "수신", "쿠폰"]),
                    description="광고성 정보 수신 동의가 포함되어 있으며 미동의 시에도 기본 서비스 가입이 가능합니다.",
                )
            )

        # Dark Pattern: Hidden Renewal
        if any(k in combined for k in ["자동 정기 결제", "별도 통지 없이", "자동 결제 전환"]):
            dark_patterns.append(
                DarkPatternFinding(
                    category="HIDDEN_RENEWAL",
                    evidence=_extract_sentence(clean_text, ["자동", "결제", "전환"]),
                    description="무료 체험 기간 종료 후 유료 정기 결제로 자동 전환되는 조건이 포함되어 있습니다.",
                )
            )

        # Dark Pattern: Pre-selected optional item
        if clause_type == "OPTIONAL" and item.is_pre_checked:
            dark_patterns.append(
                DarkPatternFinding(
                    category="PRE_SELECTED",
                    evidence=clean_title,
                    description="선택 동의 항목이 사전에 체크된 상태로 표시되어 소비자 주의를 요합니다.",
                )
            )

        # Recommended Action
        if clause_type == "OPTIONAL":
            recommended_action = "UNCHECK"
            unchecks_count += 1
        elif risk_level == "RED":
            recommended_action = "CAUTION_CHECK"
        else:
            recommended_action = "CHECK"

        # Update highest risk
        if risk_level == "RED":
            highest_risk = "RED"
        elif risk_level == "YELLOW" and highest_risk == "GREEN":
            highest_risk = "YELLOW"

        summary = _build_plain_summary(clause_type, risk_level, issues)
        clean_display_title = re.sub(r"^\[(필수|선택)\]\s*", "", clean_title).strip() or clean_title

        analyzed_items.append(
            AnalyzedClauseItem(
                client_item_id=item.client_item_id,
                title=clean_display_title,
                type=clause_type,
                risk_level=risk_level,
                recommended_action=recommended_action,
                issues=issues,
                plain_korean_summary=summary,
            )
        )

    one_line_summary = _build_overall_summary(highest_risk, analyzed_items, unchecks_count)

    return AnalyzeClausesResponseData(
        analysis_id=f"anly_{uuid.uuid4().hex[:8]}",
        overall_summary=OverallSummary(
            risk_level=highest_risk,
            one_line_summary=one_line_summary,
            total_clauses=len(analyzed_items),
            recommended_unchecks_count=unchecks_count,
        ),
        analyzed_items=analyzed_items,
        dark_patterns=dark_patterns,
    )


def _extract_sentence(text: str, keywords: List[str]) -> str:
    sentences = [s.strip() for s in re.split(r"[.\n]", text) if s.strip()]
    for sentence in sentences:
        if any(k in sentence for k in keywords):
            return sentence
    return text[:100].strip()


def _build_plain_summary(clause_type: str, risk_level: RiskLevel, issues: List[ClauseIssue]) -> str:
    if issues:
        return issues[0].description
    if clause_type == "OPTIONAL":
        return "체크하지 않아도 서비스 가입이 가능한 선택 동의 항목입니다."
    return "서비스 가입 및 이용을 위한 기본적인 필수 동의 항목입니다."


def _build_overall_summary(
    overall_risk: RiskLevel, items: List[AnalyzedClauseItem], unchecks_count: int
) -> str:
    if overall_risk == "RED":
        return f"주의가 필요한 독소/위험 조항이 발견되었으며, 선택 항목 {unchecks_count}건은 체크 해제를 권장합니다."
    if overall_risk == "YELLOW":
        return f"마케팅 등 선택 항목 {unchecks_count}건이 포함되어 있어 필수 항목만 동의하는 것을 권장합니다."
    return "전반적으로 표준약관에 부합하는 안전한 동의 항목으로 구성되어 있습니다."
