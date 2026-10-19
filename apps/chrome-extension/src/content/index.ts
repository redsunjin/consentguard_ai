/**
 * Content Script Entrypoint
 * 페이지 내 약관 체크박스 그룹을 감지하고 Shadow DOM 플로팅 어시스턴트 패널을 마운트
 */

import { detectConsentCheckboxes, observeConsentDOM, type ParsedConsentGroup } from '../utils/dom-parser';
import { applyRecommendedActions } from '../utils/action-controller';
import { saveVaultRecord } from '../utils/vault-db';
import { requestClauseAnalysis } from '../background/index';
import type {
  AnalyzeClausesResponseData,
  AnalyzedClauseItem,
  RiskLevel,
} from '@consent-guard/shared-schema';

function buildLocalFallbackAnalysis(detected: ParsedConsentGroup): AnalyzeClausesResponseData {
  let unchecksCount = 0;

  const analyzedItems: AnalyzedClauseItem[] = detected.items.map(({ payload }) => {
    const combined = `${payload.raw_title} ${payload.raw_text}`;
    const isOptional =
      payload.raw_title.includes('선택') ||
      (!payload.raw_title.includes('필수') &&
        ['마케팅', '광고', '제3자', '이벤트'].some((k) => combined.includes(k)));

    const isRed = ['제3자', '보험', '영구 귀속', '영구히 양도', '환불 불가', '면책'].some((k) =>
      combined.includes(k)
    );
    const isYellow = isOptional || ['마케팅', '광고', 'SMS', '푸시'].some((k) => combined.includes(k));

    const riskLevel: RiskLevel = isRed ? 'RED' : isYellow ? 'YELLOW' : 'GREEN';
    if (isOptional) unchecksCount++;

    return {
      client_item_id: payload.client_item_id,
      title: payload.raw_title,
      type: isOptional ? 'OPTIONAL' : 'MANDATORY',
      risk_level: riskLevel,
      recommended_action: isOptional ? 'UNCHECK' : riskLevel === 'RED' ? 'CAUTION_CHECK' : 'CHECK',
      issues: [],
      plain_korean_summary: isOptional
        ? '선택 동의 항목이므로 체크하지 않아도 서비스 가입이 가능합니다.'
        : riskLevel === 'RED'
          ? '필수 항목이나 이용자 권리 제한 소지가 있는 조항이 포함되어 있어 주의가 필요합니다.'
          : '서비스 가입 및 이용을 위한 기본적인 필수 동의 항목입니다.',
    };
  });

  const highestRisk: RiskLevel = analyzedItems.some((i) => i.risk_level === 'RED')
    ? 'RED'
    : analyzedItems.some((i) => i.risk_level === 'YELLOW')
      ? 'YELLOW'
      : 'GREEN';

  return {
    analysis_id: `local_${Date.now()}`,
    overall_summary: {
      risk_level: highestRisk,
      one_line_summary:
        highestRisk === 'RED'
          ? `주의가 필요한 위험 조항이 감지되었으며 선택 항목 ${unchecksCount}건의 해제를 권장합니다.`
          : `전체 ${analyzedItems.length}개 약관 중 선택 항목 ${unchecksCount}건의 해제를 권장합니다.`,
      total_clauses: analyzedItems.length,
      recommended_unchecks_count: unchecksCount,
    },
    analyzed_items: analyzedItems,
    dark_patterns: [],
  };
}

export async function initConsentGuardContentScript(): Promise<void> {
  const detected = detectConsentCheckboxes(document);
  if (detected) {
    await setupAssistantForGroup(detected);
  } else {
    observeConsentDOM((dynamicGroup) => {
      void setupAssistantForGroup(dynamicGroup);
    });
  }
}

async function setupAssistantForGroup(detected: ParsedConsentGroup): Promise<void> {
  let currentData = buildLocalFallbackAnalysis(detected);

  const ui = mountShadowAssistantUI(currentData, async () => {
    const result = applyRecommendedActions(detected, currentData.analyzed_items);
    await recordConsentToVault(detected, currentData);
    return result;
  });

  try {
    const response = await requestClauseAnalysis({
      source_info: {
        domain: window.location.hostname || 'localhost',
        page_type: 'SIGN_UP',
        input_type: 'PARSED_ITEMS',
      },
      items: detected.items.map((entry) => entry.payload),
      raw_content: null,
    });
    if (response.status === 'SUCCESS' && response.data.analyzed_items.length > 0) {
      currentData = response.data;
      ui.update(currentData);
    }
  } catch {
    // 오프라인 또는 로컬 서버 미기동 시 로컬 휴리스틱 결과 유지
  }
}

async function recordConsentToVault(
  detected: ParsedConsentGroup,
  analysis: AnalyzeClausesResponseData
): Promise<void> {
  try {
    const mandatoryItems: string[] = [];
    const consentedOptionals: string[] = [];
    const rejectedOptionals: string[] = [];

    for (const entry of detected.items) {
      const matched = analysis.analyzed_items.find(
        (a) => a.client_item_id === entry.payload.client_item_id
      );
      const title = matched?.title || entry.payload.raw_title;
      if (matched?.type === 'OPTIONAL') {
        if (entry.checkbox.checked) consentedOptionals.push(title);
        else rejectedOptionals.push(title);
      } else {
        mandatoryItems.push(title);
      }
    }

    await saveVaultRecord({
      id: `v_${Date.now()}`,
      domain: window.location.hostname || 'local-page',
      serviceName: document.title || window.location.hostname || '웹 서비스',
      consentedAt: new Date().toISOString(),
      overallRiskLevel: analysis.overall_summary.risk_level,
      mandatoryItems,
      consentedOptionals,
      rejectedOptionals,
    });
  } catch {
    // IndexedDB 접근 제한 환경(file:// 등) 예외 무시
  }
}

function mountShadowAssistantUI(
  initialData: AnalyzeClausesResponseData,
  onApplySafeConsent: () => Promise<{ checkedCount: number; uncheckedCount: number }>
): { update: (data: AnalyzeClausesResponseData) => void } {
  const existing = document.getElementById('consentguard-root');
  if (existing) existing.remove();

  const host = document.createElement('div');
  host.id = 'consentguard-root';
  const shadow = host.attachShadow({ mode: 'open' });

  const wrapper = document.createElement('div');
  shadow.appendChild(wrapper);
  document.body.appendChild(host);

  let isExpanded = false;
  let statusMessage = '';
  let latestData = initialData;

  function render(): void {
    const risk = latestData.overall_summary.risk_level;
    const badgeColor =
      risk === 'RED' ? '#ef4444' : risk === 'YELLOW' ? '#f59e0b' : '#10b981';

    wrapper.innerHTML = `
      <style>
        .cg-container {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 2147483647;
          font-family: -apple-system, BlinkMacSystemFont, "Pretendard", sans-serif;
          color: #f8fafc;
        }
        .cg-fab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.15);
          background: #0f172a;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          box-shadow: 0 10px 25px rgba(15, 23, 42, 0.5);
        }
        .cg-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${badgeColor};
        }
        .cg-panel {
          width: 340px;
          background: #0f172a;
          border: 1px solid #334155;
          border-radius: 16px;
          padding: 16px;
          margin-bottom: 10px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
        }
        .cg-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #1e293b;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .cg-summary {
          font-size: 12px;
          line-height: 1.5;
          color: #cbd5e1;
          background: #1e293b;
          padding: 10px;
          border-radius: 10px;
          margin-bottom: 12px;
        }
        .cg-btn-primary {
          width: 100%;
          padding: 10px 14px;
          border: none;
          border-radius: 10px;
          background: linear-gradient(90deg, #4f46e5, #10b981);
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          cursor: pointer;
          margin-bottom: 8px;
        }
        .cg-items {
          max-height: 180px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-top: 8px;
        }
        .cg-item {
          font-size: 11px;
          padding: 8px;
          border-radius: 8px;
          background: #1e293b;
          border-left: 3px solid #64748b;
        }
        .cg-disclaimer {
          margin-top: 10px;
          padding-top: 8px;
          border-top: 1px solid #1e293b;
          font-size: 10px;
          color: #64748b;
        }
      </style>
      <div class="cg-container">
        ${
          isExpanded
            ? `
          <div class="cg-panel">
            <div class="cg-header">
              <span style="font-weight:700;font-size:13px;">🛡️ ConsentGuard AI (${risk})</span>
              <button id="cg-close" style="background:none;border:none;color:#94a3b8;cursor:pointer;">✕</button>
            </div>
            <div class="cg-summary">${latestData.overall_summary.one_line_summary}</div>
            <button id="cg-apply-btn" class="cg-btn-primary">
              '필수만 안전 동의' 1초 적용하기
            </button>
            ${
              statusMessage
                ? `<div style="font-size:11px;color:#34d399;text-align:center;margin-bottom:6px;">${statusMessage}</div>`
                : ''
            }
            <div class="cg-items">
              ${latestData.analyzed_items
                .map(
                  (item) => `
                <div class="cg-item" style="border-left-color:${
                  item.risk_level === 'RED'
                    ? '#ef4444'
                    : item.risk_level === 'YELLOW'
                      ? '#f59e0b'
                      : '#10b981'
                }">
                  <div style="font-weight:600;color:#f1f5f9;margin-bottom:2px;">
                    [${item.type === 'MANDATORY' ? '필수' : '선택'}] ${item.title}
                  </div>
                  <div style="color:#94a3b8;">${item.plain_korean_summary}</div>
                </div>
              `
                )
                .join('')}
            </div>
            <div class="cg-disclaimer">
              공정위 표준약관 기준 요약 도구 (법률 자문 아님 · Zero-Retention)
            </div>
          </div>
        `
            : ''
        }
        <button id="cg-fab-toggle" class="cg-fab">
          <span class="cg-dot"></span>
          <span>🛡️ ConsentGuard (${risk})</span>
        </button>
      </div>
    `;

    shadow.getElementById('cg-fab-toggle')?.addEventListener('click', () => {
      isExpanded = !isExpanded;
      render();
    });

    shadow.getElementById('cg-close')?.addEventListener('click', () => {
      isExpanded = false;
      render();
    });

    shadow.getElementById('cg-apply-btn')?.addEventListener('click', async () => {
      const counts = await onApplySafeConsent();
      statusMessage = `✅ 필수 ${counts.checkedCount}건 체크 · 선택 ${counts.uncheckedCount}건 해제 완료!`;
      render();
    });
  }

  render();

  return {
    update(newData: AnalyzeClausesResponseData) {
      latestData = newData;
      render();
    },
  };
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
