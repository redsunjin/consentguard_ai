/**
 * ConsentGuard AI - Shared Schema & TypeScript Interfaces
 * Single Source of Truth for Chrome Extension & FastAPI Backend
 */

export type RiskLevel = 'GREEN' | 'YELLOW' | 'RED';

export type ClauseType = 'MANDATORY' | 'OPTIONAL';

export type RecommendedAction = 'CHECK' | 'CAUTION_CHECK' | 'UNCHECK';

export type IssueCategory =
  | 'COPYRIGHT_INFRINGE'
  | 'THIRD_PARTY_OVEREXPOSURE'
  | 'UNFAIR_EXEMPTION'
  | 'REFUND_RESTRICTION'
  | 'EXCESSIVE_RETENTION'
  | 'MARKETING_OPT_IN';

export type DarkPatternCategory =
  | 'HIDDEN_RENEWAL'
  | 'PRE_SELECTED'
  | 'CANCELLATION_BARRIER';

export type ClientPlatform =
  | 'CHROME_EXT'
  | 'IOS_SAFARI'
  | 'IOS_APP'
  | 'ANDROID_APP';

export type PageType = 'SIGN_UP' | 'CHECKOUT' | 'SUBSCRIPTION' | 'GENERAL';

export type InputType = 'PARSED_ITEMS' | 'RAW_TEXT' | 'OCR_TEXT';

export interface SourceInfo {
  domain: string;
  page_type: PageType;
  input_type: InputType;
}

export interface ClauseInputItem {
  client_item_id: string;
  raw_title: string;
  raw_text: string;
  is_pre_checked?: boolean;
}

export interface AnalyzeClausesRequest {
  source_info: SourceInfo;
  items: ClauseInputItem[];
  raw_content?: string | null;
}

export interface ClauseIssue {
  category: IssueCategory;
  evidence: string;
  description: string;
}

export interface AnalyzedClauseItem {
  client_item_id: string;
  title: string;
  type: ClauseType;
  risk_level: RiskLevel;
  recommended_action: RecommendedAction;
  issues: ClauseIssue[];
  plain_korean_summary: string;
}

export interface DarkPatternFinding {
  category: DarkPatternCategory;
  evidence: string;
  description: string;
}

export interface OverallSummary {
  risk_level: RiskLevel;
  one_line_summary: string;
  total_clauses: number;
  recommended_unchecks_count: number;
}

export interface AnalyzeClausesResponseData {
  analysis_id: string;
  overall_summary: OverallSummary;
  analyzed_items: AnalyzedClauseItem[];
  dark_patterns: DarkPatternFinding[];
}

export interface AnalyzeClausesResponse {
  status: 'SUCCESS' | 'ERROR';
  data: AnalyzeClausesResponseData;
}

export interface RevokeTemplateRequest {
  service_name: string;
  domain?: string;
  user_account: string;
  revoke_targets: string[];
}

export interface RevokeTemplateResponse {
  status: 'SUCCESS';
  service_name: string;
  legal_basis: string;
  subject: string;
  body: string;
}

/**
 * Local Consent Vault Record (IndexedDB Schema)
 */
export interface VaultRecord {
  id: string;
  domain: string;
  serviceName: string;
  consentedAt: string;
  overallRiskLevel: RiskLevel;
  mandatoryItems: string[];
  consentedOptionals: string[];
  rejectedOptionals: string[];
}
