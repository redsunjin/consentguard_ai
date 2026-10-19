/**
 * F-01. 웹 DOM 약관 감지기 (dom-parser.ts)
 * 페이지 내 체크박스 및 인라인 약관 박스(Pattern A), 모달(Pattern B), SPA 동적 폼(Pattern C) 감지·추출
 */

import type { ClauseInputItem } from '@consent-guard/shared-schema';
import { maskPII } from './pii-masker';

const CONSENT_KEYWORDS = ['동의', '약관', '필수', '선택', '개인정보', '제3자', '마케팅', '수신', '이용'];
const MASTER_KEYWORDS = ['전체 동의', '모두 동의', '전체동의', '일괄 동의', '약관 전체'];

export interface ParsedConsentGroup {
  masterCheckbox: HTMLInputElement | null;
  items: Array<{
    checkbox: HTMLInputElement;
    payload: ClauseInputItem;
  }>;
}

function extractAdjacentTermsText(checkbox: HTMLInputElement, container: Element | null): string {
  if (!container) return '';

  // Pattern A: 인라인 스크롤 영역 (textarea, overflow box, terms container) 탐색
  const parentSection = container.parentElement;
  const scrollBox =
    container.querySelector('textarea, [class*="terms"], [class*="clause"], [style*="overflow"]') ||
    parentSection?.querySelector('textarea, [class*="terms"], [class*="clause"], [style*="overflow"]');

  let detailText = '';
  if (scrollBox) {
    if (scrollBox instanceof HTMLTextAreaElement) {
      detailText = scrollBox.value || scrollBox.textContent || '';
    } else {
      detailText = scrollBox.textContent || '';
    }
  }

  const baseText = (container.textContent || '').trim().replace(/\s+/g, ' ');
  const combined = detailText ? `${baseText}\n${detailText.trim().replace(/\s+/g, ' ')}` : baseText;
  return combined.slice(0, 2500);
}

export function detectConsentCheckboxes(root: Document | HTMLElement = document): ParsedConsentGroup | null {
  const checkboxes = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  if (checkboxes.length < 2) {
    return null;
  }

  let masterCheckbox: HTMLInputElement | null = null;
  const items: ParsedConsentGroup['items'] = [];

  checkboxes.forEach((checkbox, index) => {
    const container = checkbox.closest('label, div, li, tr') || checkbox.parentElement;
    const rawContext = (container?.textContent || '').trim().replace(/\s+/g, ' ');

    if (!rawContext) return;

    const isConsentRelated = CONSENT_KEYWORDS.some((kw) => rawContext.includes(kw));
    if (!isConsentRelated) return;

    const isMaster = MASTER_KEYWORDS.some((kw) => rawContext.includes(kw));
    if (isMaster && !masterCheckbox) {
      masterCheckbox = checkbox;
      return;
    }

    const clientItemId = checkbox.id || `cg_chk_${index}`;
    if (!checkbox.dataset.cgItemId) {
      checkbox.dataset.cgItemId = clientItemId;
    }

    const lines = rawContext.split('\n').map((l) => l.trim()).filter(Boolean);
    const rawTitle = maskPII(lines[0] || rawContext.slice(0, 80));
    const fullExtractedText = extractAdjacentTermsText(checkbox, container);
    const rawText = maskPII(fullExtractedText || rawContext);

    items.push({
      checkbox,
      payload: {
        client_item_id: clientItemId,
        raw_title: rawTitle,
        raw_text: rawText,
        is_pre_checked: checkbox.checked,
      },
    });
  });

  if (items.length === 0) {
    return null;
  }

  return { masterCheckbox, items };
}

/**
 * Pattern C: SPA(React/Vue/Next.js) 동적 렌더링 폼 감지를 위한 디바운스 MutationObserver
 */
export function observeConsentDOM(onDetected: (group: ParsedConsentGroup) => void): MutationObserver | null {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const observer = new MutationObserver(() => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const detected = detectConsentCheckboxes(document);
      if (detected) {
        onDetected(detected);
      }
    }, 300);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  return observer;
}
