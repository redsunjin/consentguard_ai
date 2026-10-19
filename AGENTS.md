# 🤖 AGENTS.md — ConsentGuard AI 개발 하네스 가이드

이 문서는 AI 에이전트(Antigravity 등)와 개발자가 **ConsentGuard AI** 프로젝트를 일관된 아키텍처와 품질 기준으로 개발·검증하기 위한 **하네스(Harness) 규칙 및 실행 지침**입니다.

---

## 1. 핵심 아키텍처 불변 원칙 (Core Invariants)

1. **법률 자문 금지 원칙 (변호사법 제109조 방어)**
   - 프롬프트, 규칙 엔진, UI 텍스트 어디에서도 `"위법"`, `"불법"`, `"법적 무효"`와 같은 단정적 법률 판단 표현을 사용하지 않습니다.
   - 반드시 `"공정위 표준약관 대비 불리할 수 있음"`, `"소비자 주의 필요"`, `"권리 제한 소지"` 등 객관적 비교/주의 표현만 사용합니다.
2. **Zero-Retention & 클라이언트 선(先) 마스킹**
   - 클라이언트(`apps/chrome-extension/src/utils/pii-masker.ts`)와 서버(`apps/api-server/app/core/security.py`) 양단에서 주민등록번호, 전화번호, 이메일을 마스킹합니다.
   - 서버는 원문 텍스트를 영구 저장소에 기록하지 않으며, 캐시 키는 반드시 정규화된 텍스트의 `SHA-256` 해시만 사용합니다.
3. **단일 진실 공급원 (Single Source of Truth)**
   - API 요청/응답 스키마는 `packages/shared-schema/src/index.ts` 및 `apps/api-server/app/core/prompt.py`의 정의를 기준으로 동기화합니다.
4. **DOM 제어 호환성 보장**
   - 체크박스 상태 변경(`apps/chrome-extension/src/utils/action-controller.ts`) 시 단순 `element.checked = true/false` 할당에 그치지 않고, React/Vue/Angular 등 가상 DOM 프레임워크가 상태를 감지할 수 있도록 `input`, `change`, `click` 이벤트를 순서대로 디스패치합니다.

---

## 2. 모듈별 역할 및 작업 경계

| 워크스페이스 경로 | 역할 | 주요 검증 방법 |
| :--- | :--- | :--- |
| `packages/shared-schema` | TypeScript 인터페이스 및 데이터 계약 정의 | `npm run typecheck` |
| `apps/chrome-extension` | DOM 약관 파서, 원클릭 체크박스 제어, PII 마스커, IndexedDB Vault | `npm run typecheck` |
| `apps/api-server` | FastAPI 엔드포인트, 정규식 1차 룰 엔진, Gemini 3 Flash 연동, 해시 캐시 | `pytest` |
| `consentguard_ai.html` | 단독 실행형 UI/UX 프로토타입 데모 | 브라우저 렌더링 확인 |

---

## 3. 개발 및 검증 커맨드 (Harness Commands)

### 백엔드 검증 (`apps/api-server`)
```powershell
# 의존성 설치
pip install -r apps/api-server/requirements.txt

# 단위/통합 테스트 실행
pytest apps/api-server/tests

# 개발 서버 기동
uvicorn app.main:app --app-dir apps/api-server --reload --port 8000
```

### 프론트엔드/스키마 검증 (`packages/shared-schema`, `apps/chrome-extension`)
```powershell
# 루트에서 타입 체크 실행
npm run typecheck
```

---

## 4. 작업 단계별 체크리스트 (Step-by-Step Workflow)

1. **Step 1 (Schema)**: 새로운 리스크 카테고리나 다크패턴 유형 추가 시 `packages/shared-schema/src/index.ts`와 `apps/api-server/app/core/prompt.py`를 동시에 업데이트합니다.
2. **Step 2 (Rule Engine + LLM)**: `apps/api-server/app/services/rule_engine.py`에 정규식 패턴을 먼저 추가하여 비용 없이 탐지 가능한 독소 조항을 1차 필터링하고, 복합 문맥은 `llm_client.py`로 위임합니다.
3. **Step 3 (Extension DOM)**: `dom-parser.ts`와 `action-controller.ts` 수정 시 국내 주요 회원가입 폼(전체 동의 마스터 체크박스 + 개별 필수/선택 체크박스 구조) 케이스를 깨뜨리지 않는지 확인합니다.
4. **Step 4 (Vault & Revocation)**: 동의 보관함(`vault-db.ts`)은 항상 브라우저 로컬 `IndexedDB`에만 저장하며 외부 서버로 동기화하지 않습니다.
