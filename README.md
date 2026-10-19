# 🛡️ ConsentGuard AI

> **개인 동의서 & 약관 리스크 실시간 방어 AI 에이전트**  
> 대한민국 개인정보보호법, 약관규제법, 전자상거래법 및 공정거래위원회 다크패턴 가이드라인에 특화된 실시간 약관 분석 및 원클릭 제어 솔루션입니다.

---

## 📌 1. 프로젝트 개요

사용자는 회원가입 및 결제 시 평균 5,000자 이상의 약관을 읽지 않고 **'전체 동의'**를 클릭하며, 이로 인해 불필요한 제3자 정보 제공(보험/금융사 TM), 이용자 저작권 귀속, 자동 유료 결제 전환(숨은 갱신) 등의 피해를 입습니다.

**ConsentGuard AI**는 단순 텍스트 요약을 넘어 실제 웹 DOM을 제어하고 동의 이력을 생명주기별로 관리하는 **Actionable AI Agent**입니다.

### ✨ 핵심 기능 (Core Features)
1. **실시간 신호등 리스크 진단**: 약관 및 동의서를 🟢 안전(`GREEN`), 🟡 주의(`YELLOW`), 🔴 위험/독소(`RED`) 3단계로 직관화하고 원문 근거(`evidence`)와 쉬운 한국어 해설 제공
2. **원클릭 '필수만 안전 동의' (`Actionable Agent`)**: 웹 DOM을 직접 제어하여 필수 항목만 체크하고 마케팅·제3자 제공 등 선택 항목은 자동 체크 해제 (React/Vue 가상 DOM 이벤트 동기화 지원)
3. **클라이언트 PII 마스킹 (`Zero-Retention`)**: LLM 전송 전 주민등록번호, 휴대전화번호, 이메일 등 개인식별정보를 클라이언트 단에서 정규식으로 즉시 마스킹 및 서버 무저장 휘발 처리
4. **온디바이스 동의 보관함 (`Consent Vault`) & 철회 자동화**: 가입 시점의 동의 이력을 브라우저 로컬(`IndexedDB`)에 암호화 기록하고, **개인정보보호법 제37조**에 기반한 '동의 철회 및 파기 요청서'를 원클릭 생성

---

## 🗂️ 2. 프로젝트 디렉토리 구조 (Monorepo Harness)

```text
consentGuard_Ai/
├── README.md                          # 프로젝트 메인 문서
├── AGENTS.md                          # AI 에이전트 개발 규칙 및 하네스 가이드
├── consentguard_ai.md                 # 마스터 기획 및 기술 설계서 (v1.0.0)
├── docs/
│   └── ARCHITECTURE.md                # 상세 기술 아키텍처 설계서 (LLD / 다이어그램)
├── consentguard_ai.html               # 인터랙티브 UI/UX 프로토타입 데모 (단독 실행 가능)
├── package.json                       # 루트 모노레포 워크스페이스 설정
├── .env.example                       # 환경변수 템플릿
│
├── packages/
│   └── shared-schema/                 # 프론트/백엔드 공용 TypeScript 인터페이스 & JSON 스키마
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
│
└── apps/
    ├── chrome-extension/              # Phase 1: 크롬 익스텐션 (Manifest V3)
    │   ├── public/
    │   │   └── manifest.json
    │   ├── src/
    │   │   ├── background/            # Service Worker (API 통신 및 상태 관리)
    │   │   ├── content/               # DOM 감지, 체크박스 제어, 플로팅 배지 마운트
    │   │   ├── popup/                 # 동의 이력 보관함(Vault) 및 철회 서식 생성 UI
    │   │   └── utils/
    │   │       ├── dom-parser.ts      # 체크박스 및 약관 텍스트 추출기
    │   │       ├── action-controller.ts # 원클릭 필수 동의 체크박스 제어기
    │   │       ├── pii-masker.ts      # 클라이언트 개인정보(주민번호/연락처 등) 마스킹
    │   │       └── vault-db.ts        # IndexedDB 래퍼
    │   ├── package.json
    │   └── tsconfig.json
    │
    └── api-server/                    # Phase 2: 공통 분석 백엔드 (Python FastAPI)
        ├── app/
        │   ├── main.py                # FastAPI 엔트리포인트
        │   ├── api/
        │   │   └── v1/
        │   │       └── clauses.py     # POST /analyze, POST /revoke-template
        │   ├── core/
        │   │   ├── config.py          # 환경 설정
        │   │   ├── prompt.py          # 시스템 프롬프트 및 스키마 정의
        │   │   └── security.py        # Zero-Retention 및 서버단 PII 필터링 검증
        │   └── services/
        │       ├── cache.py           # SHA-256 해시 기반 캐싱 (Redis / In-Memory)
        │       ├── rule_engine.py     # 1차 정규식 빠른 독소조항/다크패턴 필터링
        │       └── llm_client.py      # Gemini 3 Flash 연동 및 폴백 분석기
        ├── tests/
        │   └── test_api.py            # 백엔드 API 테스트 하네스
        └── requirements.txt
```

---

## 🚀 3. 빠른 시작 (Quick Start)

### 3.1 인터랙티브 프로토타입 데모 즉시 실행
별도의 빌드 없이 브라우저에서 [`consentguard_ai.html`](./consentguard_ai.html) 파일을 열면 다음 3가지 시나리오를 즉시 체험할 수 있습니다.
* **모드 1 (웹 익스텐션 시뮬레이션)**: 가상 쇼핑몰 회원가입 화면에서 `'필수만 안전 동의' 1초 적용하기` 시연
* **모드 2 (모바일 OCR & 동의 보관함)**: 모바일 앱 캡처 OCR 시뮬레이션 및 개인정보보호법 제37조 철회 통지서 생성
* **모드 3 (실시간 커스텀 약관 분석)**: 헬스장 환불 불가, UGC 저작권 귀속, 표준 SaaS 약관 프리셋 및 직접 입력 분석

### 3.2 백엔드 API 서버 실행 (`apps/api-server`)
```bash
cd apps/api-server
python -m venv .venv
# Windows PowerShell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 서버 실행 (http://localhost:8000/docs 에서 Swagger UI 확인)
uvicorn app.main:app --reload --port 8000
```

### 3.3 백엔드 테스트 하네스 실행
```bash
cd apps/api-server
pytest
```

### 3.4 프론트엔드 / 크롬 익스텐션 워크스페이스 설치 및 빌드
```bash
npm install
npm run typecheck
npm run build
# 빌드 산출물: apps/chrome-extension/dist (chrome://extensions '압축해제된 확장 프로그램 로드' 지원)
```

---

## 🔌 4. 핵심 API 명세 요약

| 메서드 | 엔드포인트 | 설명 |
| :--- | :--- | :--- |
| `GET` | `/health` | 서버 상태, Zero-Retention 여부 및 캐시 Hit/Miss 메트릭 확인 |
| `POST` | `/v1/clauses/analyze` | 약관 항목 리스트 또는 원문 텍스트 리스크 종합 분석 |
| `POST` | `/v1/clauses/preprocess-ocr` | 모바일 앱 스크린샷 OCR 텍스트 정제·파싱 및 리스크 분석 |
| `POST` | `/v1/clauses/revoke-template` | 개인정보보호법 제37조 기반 동의 철회 및 파기 요청서 생성 |

상세 요청/응답 JSON 페이로드 및 시스템 프롬프트 설계는 [`consentguard_ai.md`](./consentguard_ai.md) 및 [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)에서 확인할 수 있습니다.

---

## ⚖️ 5. 법적 컴플라이언스 및 보안 아키텍처

1. **변호사법 제109조 준수**:
   * 단정적 법률 판단("위법", "무효" 등) 표현을 배제하고 *"공정거래위원회 표준약관 대비 불리함"*, *"소비자 주의 필요"* 등 객관적 정보 비교 표현만 사용합니다.
   * *"본 서비스는 공정거래위원회 표준약관 기준에 따른 텍스트 요약 도구이며, 법률 자문을 대신하지 않습니다."* 고지를 상시 포함합니다.
2. **Zero-Retention (무저장 휘발성 아키텍처)**:
   * 요청받은 약관 원문을 DB에 저장하지 않고 메모리에서 즉시 휘발 처리합니다.
   * 캐싱 시 원문 대신 `SHA-256(정규화된 약관 텍스트)` 해시값만 키로 사용하여 프라이버시를 보호하고 응답 속도를 단축합니다.

---

## 🗺️ 6. 단계별 로드맵

- [x] **Phase 0**: 마스터 기획서(`consentguard_ai.md`), 상세 아키텍처 설계서(`docs/ARCHITECTURE.md`), 인터랙티브 데모(`consentguard_ai.html`) 및 하네스 구축 (PR #1)
- [x] **Phase 1 (MVP)**: Chrome Extension (MV3) Shadow DOM 플로팅 어시스턴트, IndexedDB Vault 팝업, SPA DOM 파서 및 빌드 파이프라인 완성 (PR #2)
- [x] **Phase 2**: FastAPI 6대 리스크 카테고리 룰 엔진, 변호사법 제109조 방어 필터, SHA-256 해시 캐시 TTL/메트릭 및 Gemini 3 Flash 파이프라인 고도화 (PR #3)
- [x] **Phase 3**: 모바일 캡처 OCR 전처리·분석 파이프라인(`POST /v1/clauses/preprocess-ocr`) 및 통합 검증 완료 (PR #4)

