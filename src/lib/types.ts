export const FIELDS = [
  "month",
  "siteId",
  "siteName",
  "contractAmount",
  "plannedProgress",
  "actualProgress",
  "cumulativeEarned",
  "region",
  "projectType",
  "startDate",
  "contractEndDate",
  "currentWork",
  "issueCategory",
  "issueSummary",
  "actionPlan",
] as const;

export type FieldName = (typeof FIELDS)[number];

export const NUMERIC_FIELDS: FieldName[] = [
  "contractAmount",
  "plannedProgress",
  "actualProgress",
  "cumulativeEarned",
];

export interface SiteRow {
  month: string;
  siteId: string;
  siteName: string;
  contractAmount: number;
  plannedProgress: number;
  actualProgress: number;
  cumulativeEarned: number;
  region: string;
  projectType: string;
  startDate: string;
  contractEndDate: string;
  currentWork: string;
  issueCategory: string;
  issueSummary: string;
  actionPlan: string;
}

export type Status = "정상" | "주의" | "점검";

export interface Filters {
  month: string;
  region: string;
  projectType: string;
  siteId: string;
}

export const ALL = "전체";

export const MONTH_START = "2025-10";
export const MONTH_END = "2026-09";
export const DEFAULT_MONTH = "2026-09";

export const REGIONS = ["인천", "경기", "충남", "충북", "세종", "강원", "대전"];
export const PROJECT_TYPES = ["공동주택", "물류시설", "업무시설", "상업시설", "생산시설"];
