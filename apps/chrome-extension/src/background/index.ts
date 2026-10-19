/**
 * Background Service Worker (Manifest V3)
 * Content Script / Popup UI와 분석 백엔드 API 간의 브리지 역할 수행
 */

import type {
  AnalyzeClausesRequest,
  AnalyzeClausesResponse,
  RevokeTemplateRequest,
  RevokeTemplateResponse,
} from '@consent-guard/shared-schema';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

export type ExtensionMessage =
  | { type: 'CG_ANALYZE_CLAUSES'; payload: AnalyzeClausesRequest }
  | { type: 'CG_GENERATE_REVOKE'; payload: RevokeTemplateRequest };

export async function requestClauseAnalysis(
  payload: AnalyzeClausesRequest,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<AnalyzeClausesResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/clauses/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'CHROME_EXT',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Clause analysis failed with status ${response.status}`);
  }

  return (await response.json()) as AnalyzeClausesResponse;
}

export async function requestRevokeTemplate(
  payload: RevokeTemplateRequest,
  apiBaseUrl: string = DEFAULT_API_BASE_URL
): Promise<RevokeTemplateResponse> {
  const response = await fetch(`${apiBaseUrl}/v1/clauses/revoke-template`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Client-Platform': 'CHROME_EXT',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Revoke template generation failed with status ${response.status}`);
  }

  return (await response.json()) as RevokeTemplateResponse;
}

// Chrome Runtime Message Listener (CORS 우회 프록시)
const chromeGlobal = (globalThis as { chrome?: { runtime?: { onMessage?: { addListener: Function } } } }).chrome;
if (chromeGlobal?.runtime?.onMessage) {
  chromeGlobal.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: unknown,
      sendResponse: (res: { ok: boolean; data?: unknown; error?: string }) => void
    ) => {
      if (message?.type === 'CG_ANALYZE_CLAUSES') {
        requestClauseAnalysis(message.payload)
          .then((data) => sendResponse({ ok: true, data }))
          .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
        return true;
      }
      if (message?.type === 'CG_GENERATE_REVOKE') {
        requestRevokeTemplate(message.payload)
          .then((data) => sendResponse({ ok: true, data }))
          .catch((err: Error) => sendResponse({ ok: false, error: err.message }));
        return true;
      }
      return false;
    }
  );
}
