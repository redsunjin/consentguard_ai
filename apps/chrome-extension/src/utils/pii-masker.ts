/**
 * F-03. 클라이언트 PII 마스킹 (pii-masker.ts)
 * 약관 외 입력 폼에 기입된 사용자 개인정보가 LLM으로 전송되지 않도록 클라이언트에서 정규식으로 사전 치환
 */

const RRN_REGEX = /\b\d{6}-[1-4]\d{6}\b/g;
const PHONE_REGEX = /\b01[016789]-\d{3,4}-\d{4}\b/g;
const EMAIL_REGEX = /\b[\w.-]+@[\w.-]+\.\w+\b/g;

export function maskPII(rawText: string): string {
  if (!rawText) return '';
  return rawText
    .replace(RRN_REGEX, '[MASKED_RRN]')
    .replace(PHONE_REGEX, '[MASKED_PHONE]')
    .replace(EMAIL_REGEX, '[MASKED_EMAIL]');
}
