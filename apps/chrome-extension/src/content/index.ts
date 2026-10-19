/**
 * Content Script Entrypoint
 * 페이지 내 약관 체크박스 그룹을 감지하고 Shadow DOM 플로팅 배지를 마운트
 */

import { detectConsentCheckboxes } from '../utils/dom-parser';
import { applyRecommendedActions } from '../utils/action-controller';
import { requestClauseAnalysis } from '../background/index';
import type { AnalyzedClauseItem } from '@consent-guard/shared-schema';

export async function initConsentGuardContentScript(): Promise<void> {
  const detected = detectConsentCheckboxes(document);
  if (!detected) return;

  // 기본 로컬 휴리스틱 분류 (서버 응답 전/오프라인 시 즉시 제어 지원)
  let currentAnalyzed: AnalyzedClauseItem[] = detected.items.map(({ payload }) => {
    const isOptional =
      payload.raw_title.includes('선택') ||
      payload.raw_title.includes('마케팅') ||
      payload.raw_title.includes('제3자');
    return {
      client_item_id: payload.client_item_id,
      title: payload.raw_title,
      type: isOptional ? 'OPTIONAL' : 'MANDATORY',
      risk_level: isOptional ? 'YELLOW' : 'GREEN',
      recommended_action: isOptional ? 'UNCHECK' : 'CHECK',
      issues: [],
      plain_korean_summary: isOptional
        ? '선택 동의 항목이므로 체크하지 않아도 가입이 가능합니다.'
        : '서비스 이용을 위한 필수 동의 항목입니다.',
    };
  });

  mountFloatingBadge(() => {
    applyRecommendedActions(detected, currentAnalyzed);
  });

  // 백엔드 정밀 분석 비동기 요청 (성공 시 분석 결과 갱신)
  try {
    const response = await requestClauseAnalysis({
      source_info: {
        domain: window.location.hostname || 'unknown',
        page_type: 'SIGN_UP',
        input_type: 'PARSED_ITEMS',
      },
      items: detected.items.map((entry) => entry.payload),
      raw_content: null,
    });
    if (response.status === 'SUCCESS' && response.data.analyzed_items.length > 0) {
      currentAnalyzed = response.data.analyzed_items;
    }
  } catch {
    // 오프라인 또는 로컬 서버 미기동 시 로컬 휴리스틱 결과 유지
  }
}

function mountFloatingBadge(onSafeSelect: () => void): void {
  if (document.getElementById('consentguard-root')) return;

  const host = document.createElement('div');
  host.id = 'consentguard-root';
  const shadow = host.attachShadow({ mode: 'open' });

  const button = document.createElement('button');
  button.textContent = '🛡️ 필수만 안전 동의';
  button.style.cssText = [
    'position: fixed',
    'bottom: 24px',
    'right: 24px',
    'z-index: 2147483647',
    'padding: 10px 16px',
    'border-radius: 12px',
    'border: none',
    'background: linear-gradient(90deg, #4f46e5, #10b981)',
    'color: #ffffff',
    'font-weight: 700',
    'font-size: 13px',
    'cursor: pointer',
    'box-shadow: 0 10px 25px rgba(79, 70, 229, 0.35)',
  ].join(';');

  button.addEventListener('click', onSafeSelect);
  shadow.appendChild(button);
  document.body.appendChild(host);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void initConsentGuardContentScript();
    });
  } else {
    void initConsentGuardContentScript();
  }
}
