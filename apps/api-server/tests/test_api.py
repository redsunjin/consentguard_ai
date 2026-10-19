"""
Test Harness for ConsentGuard AI Backend API & Security Rules
"""

import sys
from pathlib import Path

# Ensure apps/api-server is on sys.path when running pytest from root or api-server
API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.core.prompt import ClauseInputItem
from app.core.security import compute_normalized_sha256, sanitize_pii
from app.services.rule_engine import analyze_items_with_rules


def test_pii_sanitizer_masks_sensitive_data():
    raw = "주민번호 900101-1234567, 연락처 010-1234-5678, 이메일 test@example.com 입니다."
    masked = sanitize_pii(raw)
    assert "900101-1234567" not in masked
    assert "010-1234-5678" not in masked
    assert "test@example.com" not in masked
    assert "[MASKED_RRN]" in masked
    assert "[MASKED_PHONE]" in masked
    assert "[MASKED_EMAIL]" in masked


def test_sha256_normalizes_whitespace():
    h1 = compute_normalized_sha256("제1조  회사의   면책")
    h2 = compute_normalized_sha256("제1조 회사의 면책\n")
    assert h1 == h2


def test_rule_engine_detects_toxic_clauses_and_recommends_actions():
    items = [
        ClauseInputItem(
            client_item_id="chk_1",
            raw_title="[필수] 서비스 이용약관 동의",
            raw_text="제14조(회사의 면책) 회사는 회선 장애로 인한 손해를 배상하지 않으며, 게시물의 저작재산권은 회사에 영구 귀속됩니다.",
        ),
        ClauseInputItem(
            client_item_id="chk_2",
            raw_title="[선택] 개인정보 제3자 제공 동의",
            raw_text="맞춤형 보험 안내를 위해 14개 제휴 보험사에 이름, 연락처를 제공합니다. 보유기간 3년.",
        ),
    ]

    result = analyze_items_with_rules(items)
    assert result.overall_summary.risk_level == "RED"
    assert result.overall_summary.total_clauses == 2
    assert result.overall_summary.recommended_unchecks_count == 1

    item1 = result.analyzed_items[0]
    assert item1.type == "MANDATORY"
    assert item1.risk_level == "RED"
    assert item1.recommended_action == "CAUTION_CHECK"

    item2 = result.analyzed_items[1]
    assert item2.type == "OPTIONAL"
    assert item2.risk_level == "RED"
    assert item2.recommended_action == "UNCHECK"
