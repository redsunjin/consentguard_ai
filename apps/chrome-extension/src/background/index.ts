/**
 * Background Service Worker (Manifest V3)
 * Content Script와 분석 백엔드 API 간의 브리지 역할 수행
 */

import type { AnalyzeClausesRequest, AnalyzeClausesResponse } from '@consent-guard/shared-schema';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';

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
