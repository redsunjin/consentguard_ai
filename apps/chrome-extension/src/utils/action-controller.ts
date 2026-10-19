/**
 * F-02. 원클릭 체크박스 제어기 (action-controller.ts)
 * 분석 결과에 따라 필수 항목만 체크하고 선택 항목은 해제하며 가상 DOM 이벤트를 동기화
 */

import type { AnalyzedClauseItem } from '@consent-guard/shared-schema';
import type { ParsedConsentGroup } from './dom-parser';

function setCheckboxState(checkbox: HTMLInputElement, shouldBeChecked: boolean): void {
  if (checkbox.checked === shouldBeChecked) return;
  checkbox.checked = shouldBeChecked;
  checkbox.dispatchEvent(new Event('input', { bubbles: true }));
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  checkbox.dispatchEvent(new Event('click', { bubbles: true }));
}

export function applyRecommendedActions(
  group: ParsedConsentGroup,
  analyzedItems: AnalyzedClauseItem[]
): { checkedCount: number; uncheckedCount: number } {
  // 1. 전체 동의 마스터 체크박스가 체크되어 있다면 우선 해제
  if (group.masterCheckbox && group.masterCheckbox.checked) {
    setCheckboxState(group.masterCheckbox, false);
  }

  const actionMap = new Map<string, AnalyzedClauseItem>(
    analyzedItems.map((item) => [item.client_item_id, item])
  );

  let checkedCount = 0;
  let uncheckedCount = 0;

  // 2. 개별 체크박스 상태 제어
  for (const entry of group.items) {
    const analyzed = actionMap.get(entry.payload.client_item_id);
    if (!analyzed) continue;

    const shouldCheck =
      analyzed.recommended_action === 'CHECK' ||
      analyzed.recommended_action === 'CAUTION_CHECK';

    setCheckboxState(entry.checkbox, shouldCheck);
    if (shouldCheck) {
      checkedCount++;
    } else {
      uncheckedCount++;
    }
  }

  return { checkedCount, uncheckedCount };
}
