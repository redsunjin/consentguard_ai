"""
Test Harness for ConsentGuard AI Backend API & Security Rules
Supports both `pytest` and `python -m unittest`.
"""

import asyncio
import sys
import unittest
from pathlib import Path

# Ensure apps/api-server is on sys.path when running pytest or unittest from root
API_ROOT = Path(__file__).resolve().parents[1]
if str(API_ROOT) not in sys.path:
    sys.path.insert(0, str(API_ROOT))

from app.api.v1.clauses import analyze_clauses, generate_revoke_template
from app.core.prompt import (
    AnalyzeClausesRequest,
    ClauseInputItem,
    RevokeTemplateRequest,
    SourceInfo,
)
from app.core.security import (
    compute_normalized_sha256,
    sanitize_legal_expressions,
    sanitize_pii,
)
from app.main import health_check
from app.services.cache import clear_cache, get_cache_stats
from app.services.rule_engine import analyze_items_with_rules


class ConsentGuardBackendTestCase(unittest.TestCase):
    def setUp(self):
        clear_cache()

    def test_pii_sanitizer_masks_sensitive_data(self):
        raw = "주민번호 900101-1234567, 연락처 010-1234-5678, 이메일 test@example.com 입니다."
        masked = sanitize_pii(raw)
        self.assertNotIn("900101-1234567", masked)
        self.assertNotIn("010-1234-5678", masked)
        self.assertNotIn("test@example.com", masked)
        self.assertIn("[MASKED_RRN]", masked)
        self.assertIn("[MASKED_PHONE]", masked)
        self.assertIn("[MASKED_EMAIL]", masked)

    def test_lawyer_act_compliance_filter(self):
        raw = "이 약관은 위법이며 법적 무효인 불법 조항입니다."
        filtered = sanitize_legal_expressions(raw)
        self.assertNotIn("위법", filtered)
        self.assertNotIn("법적 무효", filtered)
        self.assertNotIn("불법", filtered)

    def test_sha256_normalizes_whitespace(self):
        h1 = compute_normalized_sha256("제1조  회사의   면책")
        h2 = compute_normalized_sha256("제1조 회사의 면책\n")
        self.assertEqual(h1, h2)

    def test_rule_engine_detects_toxic_clauses_and_recommends_actions(self):
        items = [
            ClauseInputItem(
                client_item_id="chk_1",
                raw_title="[필수] 서비스 이용약관 동의",
                raw_text="제14조(회사의 면책) 회사는 회선 장애로 인한 손해를 배상하지 않으며, 게시물의 저작재산권은 회사에 영구 귀속됩니다. 탈퇴 후에도 게시물은 삭제되지 않으며 영구 보관됩니다.",
            ),
            ClauseInputItem(
                client_item_id="chk_2",
                raw_title="[선택] 개인정보 제3자 제공 동의",
                raw_text="맞춤형 보험 안내를 위해 14개 제휴 보험사에 이름, 연락처를 제공합니다. 보유기간 3년.",
                is_pre_checked=True,
            ),
        ]

        result = analyze_items_with_rules(items)
        self.assertEqual(result.overall_summary.risk_level, "RED")
        self.assertEqual(result.overall_summary.total_clauses, 2)
        self.assertEqual(result.overall_summary.recommended_unchecks_count, 1)

        item1_categories = {issue.category for issue in result.analyzed_items[0].issues}
        self.assertIn("COPYRIGHT_INFRINGE", item1_categories)
        self.assertIn("UNFAIR_EXEMPTION", item1_categories)
        self.assertIn("EXCESSIVE_RETENTION", item1_categories)

        dp_categories = {dp.category for dp in result.dark_patterns}
        self.assertIn("PRE_SELECTED", dp_categories)

    def test_api_endpoints_and_sha256_cache_hits(self):
        req = AnalyzeClausesRequest(
            source_info=SourceInfo(
                domain="shop.example.co.kr",
                page_type="SIGN_UP",
                input_type="PARSED_ITEMS",
            ),
            items=[
                ClauseInputItem(
                    client_item_id="chk_1",
                    raw_title="[필수] 이용약관",
                    raw_text="환불이 일체 불가하며 위약금 30%를 공제합니다.",
                )
            ],
        )
        res1 = asyncio.run(analyze_clauses(req))
        self.assertEqual(res1.status, "SUCCESS")
        stats_after_miss = get_cache_stats()
        self.assertEqual(stats_after_miss["misses"], 1)
        self.assertEqual(stats_after_miss["hits"], 0)

        # Second identical request must hit SHA-256 cache
        res2 = asyncio.run(analyze_clauses(req))
        self.assertEqual(res2.data.analysis_id, res1.data.analysis_id)
        stats_after_hit = get_cache_stats()
        self.assertEqual(stats_after_hit["hits"], 1)

        health = asyncio.run(health_check())
        self.assertEqual(health["status"], "ok")
        self.assertEqual(health["cache_stats"]["hits"], 1)

        revoke_req = RevokeTemplateRequest(
            service_name="넥서스클럽",
            user_account="user@korea.com",
        )
        revoke_res = asyncio.run(generate_revoke_template(revoke_req))
        self.assertEqual(revoke_res.status, "SUCCESS")
        self.assertIn("제37조", revoke_res.subject)


if __name__ == "__main__":
    unittest.main()
