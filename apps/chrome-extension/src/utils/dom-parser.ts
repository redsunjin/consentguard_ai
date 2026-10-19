/**
 * F-01. 웹 DOM 약관 감지기 (dom-parser.ts)
 * 페이지 내 체크박스 및 약관 텍스트를 감지·추출
 */

import type { ClauseInputItem } from '@consent-guard/shared-schema';
import { maskPII } from './pii-masker';

const CONSENT_KEYWORDS = ['동의', '약관', '필수', '선택', '개인정보', '제3자', '마케팅', '수신'];
const MASTER_KEYWORDS = ['전체 동의', '모두 동의', '전체동의', '일괄 동의'];

export interface ParsedConsentGroup {
  masterCheckbox: HTMLInputElement | null;
  items: Array<{
    checkbox: HTMLInputElement;
    payload: ClauseInputItem;
  }>;
}

export function detectConsentCheckboxes(root: Document | HTMLElement = document): ParsedConsentGroup | null {
  const checkboxes = Array.from(root.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
  if (checkboxes.length < 2) {
    return null;
  }

  let masterCheckbox: HTMLInputElement | null = null;
  const items: ParsedConsentGroup['items'] = [];

  checkboxes.forEach((checkbox, index) => {
    const container = checkbox.closest('label, div, li') || checkbox.parentElement;
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
    const rawText = maskPII(rawContext);

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
