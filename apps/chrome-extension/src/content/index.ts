/**
 * Content Script Entrypoint
 * 페이지 내 약관 체크박스 그룹을 감지하고 Shadow DOM 플로팅 배지를 마운트
 */

import { detectConsentCheckboxes } from '../utils/dom-parser';
import { applyRecommendedActions } from '../utils/action-controller';
import type { AnalyzedClauseItem } from '@consent-guard/shared-schema';

export function initConsentGuardContentScript(): void {
  const detected = detectConsentCheckboxes(document);
  if (!detected) return;

  // 기본 로컬 휴리스틱 분류 (서버 응답 전/오프라인 시 즉시 제어 지원)
  const fallbackAnalyzed: AnalyzedClauseItem[] = detected.items.map(({ payload }) => {
    const isOptional = payload.raw_title.includes('선택') || payload.raw_title.includes('마케팅') || payload.raw_title.includes('제3자');
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
    applyRecommendedActions(detected, fallbackAnalyzed);
  });
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
