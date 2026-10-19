"""
System Prompt & Pydantic Schemas for ConsentGuard AI
Strictly aligned with packages/shared-schema/src/index.ts
"""

from typing import List, Literal, Optional
from pydantic import BaseModel, Field

RiskLevel = Literal["GREEN", "YELLOW", "RED"]
ClauseType = Literal["MANDATORY", "OPTIONAL"]
RecommendedAction = Literal["CHECK", "CAUTION_CHECK", "UNCHECK"]
IssueCategory = Literal[
    "COPYRIGHT_INFRINGE",
    "THIRD_PARTY_OVEREXPOSURE",
    "UNFAIR_EXEMPTION",
    "REFUND_RESTRICTION",
    "EXCESSIVE_RETENTION",
    "MARKETING_OPT_IN",
]
DarkPatternCategory = Literal[
    "HIDDEN_RENEWAL",
    "PRE_SELECTED",
    "CANCELLATION_BARRIER",
]

SYSTEM_INSTRUCTION = """당신은 대한민국 개인정보보호법, 전자상거래법, 약관규제법 및 공정거래위원회 다크패턴 가이드라인에 특화된 '개인 동의서 리스크 분석 AI 엔진'입니다.

[엄격 준수 원칙]
1. 비변호사 법률 자문 금지: "위법", "무효" 등의 단정적 법률 판단 표현을 절대 사용하지 말고, "공정위 표준약관 대비 불리함", "소비자 주의 필요" 등 객관적 정보 비교 표현만 사용하십시오.
2. 원문 근거 제시: 리스크로 지적한 모든 항목은 입력된 약관 내 실제 문장을 `evidence` 필드에 그대로 인용하십시오.
3. 출력 형식: 반드시 지정된 JSON 스키마로만 응답하십시오.

[분류 기준]
- type: MANDATORY (필수 동의) | OPTIONAL (선택 동의)
- risk_level:
  * GREEN: 최소 수집 정보, 표준약관 부합
  * YELLOW: 자사 마케팅 수신, 맞춤형 광고 프로파일링
  * RED: 외부 제3자(보험/금융/제휴사) 제공, 탈퇴 후 장기 보관, 사업자 포괄 면책, 이용자 저작권(UGC) 영구 양도, 환불 불가 조항
- dark_patterns:
  * HIDDEN_RENEWAL (무료 체험 후 자동 유료 결제 전환)
  * PRE_SELECTED (선택 항목 사전 체크 유도)
  * CANCELLATION_BARRIER (해지/철회 제한 및 과도한 위약금)
- recommended_action:
  * CHECK (안전한 필수 항목)
  * CAUTION_CHECK (독소 조항이 있으나 가입을 위해 체크가 불가피한 필수 항목)
  * UNCHECK (모든 선택적 마케팅/제3자 제공 항목)
"""


class SourceInfo(BaseModel):
    domain: str = Field(..., examples=["shop.example.co.kr"])
    page_type: str = Field(default="SIGN_UP")
    input_type: str = Field(default="PARSED_ITEMS")


class ClauseInputItem(BaseModel):
    client_item_id: str
    raw_title: str
    raw_text: str
    is_pre_checked: Optional[bool] = False


class AnalyzeClausesRequest(BaseModel):
    source_info: SourceInfo
    items: List[ClauseInputItem] = Field(default_factory=list)
    raw_content: Optional[str] = None


class ClauseIssue(BaseModel):
    category: IssueCategory
    evidence: str
    description: str


class AnalyzedClauseItem(BaseModel):
    client_item_id: str
    title: str
    type: ClauseType
    risk_level: RiskLevel
    recommended_action: RecommendedAction
    issues: List[ClauseIssue] = Field(default_factory=list)
    plain_korean_summary: str


class DarkPatternFinding(BaseModel):
    category: DarkPatternCategory
    evidence: str
    description: str


class OverallSummary(BaseModel):
    risk_level: RiskLevel
    one_line_summary: str
    total_clauses: int
    recommended_unchecks_count: int


class AnalyzeClausesResponseData(BaseModel):
    analysis_id: str
    overall_summary: OverallSummary
    analyzed_items: List[AnalyzedClauseItem]
    dark_patterns: List[DarkPatternFinding] = Field(default_factory=list)


class AnalyzeClausesResponse(BaseModel):
    status: Literal["SUCCESS", "ERROR"] = "SUCCESS"
    data: AnalyzeClausesResponseData


class RevokeTemplateRequest(BaseModel):
    service_name: str
    domain: Optional[str] = None
    user_account: str
    revoke_targets: List[str] = Field(
        default_factory=lambda: [
            "개인정보 제3자 제공 동의 일체",
            "광고성 정보(SMS, 이메일, 앱 푸시) 수신 동의",
        ]
    )


class RevokeTemplateResponse(BaseModel):
    status: Literal["SUCCESS"] = "SUCCESS"
    service_name: str
    legal_basis: str
    subject: str
    body: str
