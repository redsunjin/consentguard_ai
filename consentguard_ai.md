# ConsentGuard AI: 개인 동의서 AI 에이전트 마스터 기획 및 기술 설계서
> **Target Environment**: Antigravity IDE / Agentic Workflow  
> **Document Version**: v1.0.0  
> **Project Code**: `consent-guard-ai`

---

## 1. 프로젝트 개요 (Executive Summary)

### 1.1 배경 및 문제 정의
* **독소 조항 및 다크패턴 방치**: 사용자는 회원가입 및 결제 시 평균 5,000자 이상의 약관을 읽지 않고 '전체 동의'를 클릭하며, 이로 인해 불필요한 제3자 정보 제공(보험/금융사 TM), 저작권 귀속, 자동 유료 결제 전환(숨은 갱신) 등의 피해를 입음.
* **기존 솔루션의 한계**: 글로벌 도구(ToS;DR 등)는 대한민국 특유의 개인정보보호법 체계(`[필수]` vs `[선택]` 분리 동의, 제3자 제공 및 위탁 구분)를 반영하지 못하며, 단순 요약에 그쳐 실제 체크박스 제어(Action)까지 이어지지 않음.

### 1.2 핵심 가치 제안 (Value Proposition)
1. **실시간 신호등 리스크 진단**: 약관 및 동의서를 초록(안전), 노랑(주의), 빨강(위험/독소) 3단계로 직관화.
2. **원클릭 '필수만 안전 동의' (Actionable Agent)**: 웹 DOM을 직접 제어하여 필수 항목만 체크하고 마케팅·제3자 제공 등 선택 항목은 자동 해제.
3. **온디바이스 동의 보관함 (Consent Vault) & 철회 자동화**: 가입 시점의 동의 이력을 로컬(IndexedDB)에 기록하고, 개인정보보호법 제37조에 기반한 '동의 철회 및 파기 요청서'를 원클릭 생성.

---

## 2. 타깃 플랫폼 및 단계별 로드맵

| 단계 | 플랫폼 | 핵심 기술 스택 | 주요 타깃 시나리오 |
| :--- | :--- | :--- | :--- |
| **Phase 1 (MVP)** | **Chrome Extension (MV3)** | TypeScript, React/Tailwind, Manifest V3, IndexedDB | 데스크톱 웹 회원가입, 쇼핑몰 결제, SaaS 구독 동의 |
| **Phase 2** | **Common Backend API** | Python FastAPI, Redis (Cache), Gemini 3 Flash API | 크롬 확장 및 모바일 앱 공용 Stateless 분석 파이프라인 |
| **Phase 3** | **Mobile (iOS / Android)** | Safari Web Extension, OS Share Sheet + On-Device OCR | 모바일 브라우저 및 네이티브 앱(배달, 금융, SNS) 캡처 분석 |

---

## 3. 추천 프로젝트 디렉토리 구조 (Monorepo)

안티그래비티 환경에서 프론트엔드(익스텐션)와 백엔드(분석 서버)를 동시에 개발·테스트하기 위한 표준 워크스페이스 구조입니다.

```text
consent-guard-ai/
├── apps/
│   ├── chrome-extension/          # Phase 1: 크롬 익스텐션 (Manifest V3)
│   │   ├── public/
│   │   │   └── manifest.json
│   │   ├── src/
│   │   │   ├── background/        # Service Worker (API 통신 및 상태 관리)
│   │   │   ├── content/           # DOM 감지, 체크박스 제어, 플로팅 UI 마운트
│   │   │   ├── popup/             # 동의 이력 보관함(Vault) 및 철회 서식 생성 UI
│   │   │   ├── utils/
│   │   │   │   ├── dom-parser.ts  # 체크박스 및 약관 텍스트 추출기
│   │   │   │   ├── pii-masker.ts  # 클라이언트 단 개인정보(주민번호 등) 마스킹
│   │   │   │   └── vault-db.ts    # IndexedDB 래퍼
│   │   └── package.json
│   │
│   └── api-server/                # Phase 2: 공통 분석 백엔드 (FastAPI)
│       ├── app/
│       │   ├── main.py
│       │   ├── api/
│       │   │   └── v1/
│       │   │       └── clauses.py # /analyze, /preprocess-ocr, /revoke-template
│       │   ├── core/
│       │   │   ├── config.py
│       │   │   ├── prompt.py      # 시스템 프롬프트 및 스키마 정의
│       │   │   └── security.py    # Zero-Retention 및 PII 필터링 검증
│       │   ├── services/
│       │   │   ├── cache.py       # SHA-256 해시 기반 Redis 캐싱
│       │   │   ├── rule_engine.py # 1차 정규식 빠른 필터링
│       │   │   └── llm_client.py  # Gemini 3 Flash 연동
│       └── requirements.txt
│
└── packages/
    └── shared-schema/             # 공통 JSON 스키마 및 TypeScript 인터페이스
```

---

## 4. 기능 명세 및 모듈 설계 (Feature Specifications)

### F-01. 웹 DOM 약관 감지기 (`dom-parser.ts`)
* **트리거 조건**: 페이지 내 `input[type="checkbox"]`가 2개 이상 존재하고, 인접 텍스트에 `동의`, `약관`, `필수`, `선택`, `개인정보`, `제3자` 키워드가 포함된 컨테이너 식별.
* **추출 데이터**:
  * `client_item_id`: DOM 요소 고유 참조 ID 또는 CSS Selector 경로.
  * `raw_title`: 체크박스 `<label>` 텍스트.
  * `raw_text`: 인라인 스크롤 박스 텍스트 또는 `보기`/`전문보기` 모달 내 텍스트.

### F-02. 원클릭 체크박스 제어기 (`action-controller.ts`)
* **동작 로직**:
  1. `전체 동의` 마스터 체크박스가 체크되어 있다면 우선 해제하거나 개별 제어 모드로 전환.
  2. 분석 결과 `recommended_action === 'CHECK'` 또는 `CAUTION_CHECK`(필수 항목)인 체크박스는 `checked = true`로 설정 후 `change`, `click`, `input` 이벤트 디스패치(React/Vue 가상 DOM 상태 동기화 보장).
  3. `recommended_action === 'UNCHECK'`(선택 항목)인 체크박스는 `checked = false`로 설정.

### F-03. 클라이언트 PII 마스킹 (`pii-masker.ts`)
* 약관 외 입력 폼에 기입된 사용자 개인정보가 LLM으로 전송되지 않도록 클라이언트에서 정규식으로 사전 치환:
  * 주민등록번호/외국인등록번호: `\d{6}-[1-4]\d{6}` $\rightarrow$ `[MASKED_RRN]`
  * 휴대전화번호: `01[016789]-\d{3,4}-\d{4}` $\rightarrow$ `[MASKED_PHONE]`
  * 이메일: `[\w.-]+@[\w.-]+\.\w+` $\rightarrow$ `[MASKED_EMAIL]`

### F-04. 로컬 동의 보관함 (`vault-db.ts`)
* 서버 DB가 아닌 브라우저 내장 `IndexedDB`를 사용하여 프라이버시 침해 소지를 원천 제거.
* **저장 스키마 (`VaultRecord`)**:
  ```typescript
  interface VaultRecord {
    id: string;                 // UUID
    domain: string;             // 예: shop.nexus-club.kr
    serviceName: string;        // 사이트 메타 타이틀
    consentedAt: string;        // ISO 8601 Timestamp
    overallRiskLevel: 'GREEN' | 'YELLOW' | 'RED';
    mandatoryItems: string[];   // 동의한 필수 항목 리스트
    consentedOptionals: string[]; // 사용자가 체크한 선택 항목
    rejectedOptionals: string[];  // 에이전트가 차단한 선택 항목
  }
  ```

---

## 5. 백엔드 API 상세 명세 (REST API Specification)

### 5.1 약관 종합 분석 API
* **Endpoint**: `POST /v1/clauses/analyze`
* **Headers**:
  * `Authorization: Bearer <TOKEN>`
  * `X-Client-Platform: CHROME_EXT | IOS_SAFARI | IOS_APP | ANDROID_APP`

#### Request Payload
```json
{
  "source_info": {
    "domain": "shop.example.co.kr",
    "page_type": "SIGN_UP",
    "input_type": "PARSED_ITEMS"
  },
  "items": [
    {
      "client_item_id": "chk_1",
      "raw_title": "[필수] 서비스 이용약관 동의",
      "raw_text": "제14조(회사의 면책) 회사는 회선 장애로 인한 손해를 배상하지 않으며, 게시물의 저작재산권은 회사에 영구 귀속됩니다."
    },
    {
      "client_item_id": "chk_2",
      "raw_title": "[선택] 개인정보 제3자 제공 동의",
      "raw_text": "맞춤형 보험 안내를 위해 14개 제휴 보험사에 이름, 연락처를 제공합니다. 보유기간 3년."
    }
  ],
  "raw_content": null
}
```

#### Response Payload (`200 OK`)
```json
{
  "status": "SUCCESS",
  "data": {
    "analysis_id": "anly_98123a",
    "overall_summary": {
      "risk_level": "RED",
      "one_line_summary": "필수 약관에 저작권 귀속 및 면책 조항이 있으며, 14개 보험사 제3자 제공이 포함되어 있습니다.",
      "total_clauses": 2,
      "recommended_unchecks_count": 1
    },
    "analyzed_items": [
      {
        "client_item_id": "chk_1",
        "title": "서비스 이용약관 동의",
        "type": "MANDATORY",
        "risk_level": "RED",
        "recommended_action": "CAUTION_CHECK",
        "issues": [
          {
            "category": "COPYRIGHT_INFRINGE",
            "evidence": "게시물의 저작재산권은 회사에 영구 귀속됩니다.",
            "description": "이용자 게시물의 상업적 권리를 회사가 독점 귀속하는 불리한 조항입니다."
          }
        ],
        "plain_korean_summary": "가입에 필수이나, 내가 올린 리뷰나 사진의 저작권을 회사가 무상으로 영구 사용할 수 있습니다."
      },
      {
        "client_item_id": "chk_2",
        "title": "개인정보 제3자 제공 동의",
        "type": "OPTIONAL",
        "risk_level": "RED",
        "recommended_action": "UNCHECK",
        "issues": [
          {
            "category": "THIRD_PARTY_OVEREXPOSURE",
            "evidence": "14개 제휴 보험사에 이름, 연락처를 제공합니다. 보유기간 3년.",
            "description": "다수의 금융/보험사로 연락처가 제공되어 텔레마케팅에 노출될 수 있습니다."
          }
        ],
        "plain_korean_summary": "체크하지 않아도 가입 가능하며, 체크 시 14개 보험사에서 가입 권유 전화가 올 수 있습니다."
      }
    ],
    "dark_patterns": []
  }
}
```

### 5.2 동의 철회 및 파기 요청서 생성 API
* **Endpoint**: `POST /v1/clauses/revoke-template`
* **역할**: 개인정보보호법 제37조(개인정보의 처리정지 등)에 의거한 공식 철회 이메일 텍스트 반환.

---

## 6. AI 엔진 프롬프트 및 스키마 설계

* **Target Model**: `gemini-3-flash-preview`
* **Generation Config**:
  * `temperature`: `0.0` (일관된 판정 보장)
  * `response_mime_type`: `"application/json"`

### 시스템 프롬프트 (System Instruction)
```text
당신은 대한민국 개인정보보호법, 전자상거래법, 약관규제법 및 공정거래위원회 다크패턴 가이드라인에 특화된 '개인 동의서 리스크 분석 AI 엔진'입니다.

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
```

---

## 7. 법적 컴플라이언스 및 보안 아키텍처

1. **변호사법 제109조 리스크 방어**:
   * UI 하단 및 익스텐션 스토어 설명란에 상시 고지: *"본 서비스는 공정거래위원회 표준약관 기준에 따른 텍스트 요약 도구이며, 법률 자문을 대신하지 않습니다."*
2. **Zero-Retention (무저장 휘발성 아키텍처)**:
   * 백엔드 서버는 요청받은 약관 원문을 DB에 저장하지 않고 메모리에서 즉시 휘발 처리.
   * 캐싱 시에는 원문 대신 `SHA-256(정규화된 약관 텍스트)` 해시값만 Redis 키로 사용하여 동일 약관 재분석 시 50ms 이내 응답 및 LLM 비용 70% 절감.

---

## 8. 안티그래비티(Antigravity) 구현 체크리스트

안티그래비티 에이전트에게 아래 순서로 구현을 지시하십시오:

- [x] **Step 1**: `packages/shared-schema`에 요청/응답 TypeScript 인터페이스 및 Pydantic 모델 생성
- [x] **Step 2**: `apps/api-server`에 FastAPI 보일러플레이트 및 Gemini 3 Flash 연동 엔드포인트(`POST /v1/clauses/analyze`) 구현
- [x] **Step 3**: `apps/chrome-extension`에 Manifest V3 설정 및 페이지 내 체크박스 그룹을 탐지하는 Content Script 구현
- [x] **Step 4**: Content Script에서 Shadow DOM 기반 플로팅 배지 및 `[필수만 안전 동의]` 원클릭 제어 함수 연결
- [x] **Step 5**: IndexedDB 기반 Consent Vault(보관함) 및 동의 철회 이메일 클립보드 복사 UI 연결