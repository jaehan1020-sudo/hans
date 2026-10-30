import { clean } from "./calc";
import type { ParsedFile, RawRecord, RawValue } from "./parse";
import {
  FIELDS,
  MONTH_END,
  MONTH_START,
  NUMERIC_FIELDS,
  PROJECT_TYPES,
  REGIONS,
  type FieldName,
  type SiteRow,
} from "./types";

export interface Issue {
  /** 파일의 행 번호. 파일 전체에 대한 문제는 null. */
  row: number | null;
  column: string | null;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  format: "csv" | "json";
  rows: SiteRow[];
  /** 화면에 보여줄 오류(최대 10건) */
  errors: Issue[];
  errorCount: number;
  warnings: string[];
  /** 형식별 안내 문구 */
  notice: string;
}

export const MAX_SHOWN_ERRORS = 10;

const SITE_CONSTANT_FIELDS: FieldName[] = [
  "siteName",
  "region",
  "projectType",
  "contractAmount",
  "startDate",
  "contractEndDate",
];

const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function isValidDate(s: string): boolean {
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(d).padStart(2, "0")}`;
}

function isBlank(v: RawValue): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

interface RowResult {
  row: SiteRow | null;
  issues: Issue[];
}

function readNumber(v: RawValue, format: "csv" | "json"): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  // CSV의 숫자는 문자로 읽히지만, JSON에서는 숫자 형식이어야 합니다.
  if (format === "csv" && typeof v === "string" && NUMBER_RE.test(v.trim())) return Number(v.trim());
  return null;
}

function checkRecord(rec: RawRecord, format: "csv" | "json"): RowResult {
  const issues: Issue[] = [];
  const add = (column: string, message: string) => issues.push({ row: rec.rowNo, column, message });
  const v = rec.values;

  for (const f of FIELDS) {
    if (isBlank(v[f])) add(f, "필수 값이 비어 있습니다. (빈 칸을 0으로 바꾸지 않습니다)");
  }

  const num: Partial<Record<FieldName, number>> = {};
  for (const f of NUMERIC_FIELDS) {
    if (isBlank(v[f])) continue;
    const n = readNumber(v[f], format);
    if (n === null) add(f, "숫자가 아니거나 유한한 값이 아닙니다.");
    else num[f] = n;
  }

  const str = (f: FieldName): string => (isBlank(v[f]) ? "" : String(v[f]).trim());

  const month = str("month");
  if (month) {
    if (!MONTH_RE.test(month)) add("month", "YYYY-MM 형식이 아닙니다.");
    else if (month < MONTH_START || month > MONTH_END)
      add("month", `${MONTH_START}~${MONTH_END} 범위를 벗어났습니다.`);
  }
  const siteId = str("siteId");
  if (siteId && !/^[A-L]$/.test(siteId)) add("siteId", "현장 ID는 A~L 한 글자여야 합니다.");

  if (num.contractAmount !== undefined && !(num.contractAmount > 0)) add("contractAmount", "0보다 커야 합니다.");
  for (const f of ["plannedProgress", "actualProgress"] as const) {
    const n = num[f];
    if (n !== undefined && (n < 0 || n > 100)) add(f, `0~100 범위를 벗어났습니다. (값: ${n})`);
  }
  if (num.cumulativeEarned !== undefined) {
    if (num.cumulativeEarned < 0) add("cumulativeEarned", "0 이상이어야 합니다.");
    else if (num.contractAmount !== undefined && num.cumulativeEarned > num.contractAmount)
      add("cumulativeEarned", "계약금액을 넘을 수 없습니다.");
  }

  const region = str("region");
  if (region && !REGIONS.includes(region)) add("region", `알 수 없는 지역입니다. (${region})`);
  const ptype = str("projectType");
  if (ptype && !PROJECT_TYPES.includes(ptype)) add("projectType", `알 수 없는 공사 유형입니다. (${ptype})`);

  const start = str("startDate");
  const end = str("contractEndDate");
  const startOk = start !== "" && isValidDate(start);
  const endOk = end !== "" && isValidDate(end);
  if (start && !startOk) add("startDate", "YYYY-MM-DD 형식의 올바른 날짜가 아닙니다.");
  if (end && !endOk) add("contractEndDate", "YYYY-MM-DD 형식의 올바른 날짜가 아닙니다.");
  if (startOk && endOk && !(start < end)) add("startDate", "착공일이 계약상 준공일보다 앞서야 합니다.");
  if (startOk && MONTH_RE.test(month) && lastDayOfMonth(month) < start)
    add("month", "월말 기준일이 착공일보다 앞입니다.");

  if (issues.length > 0) return { row: null, issues };
  return {
    row: {
      month,
      siteId,
      siteName: str("siteName"),
      contractAmount: num.contractAmount as number,
      plannedProgress: num.plannedProgress as number,
      actualProgress: num.actualProgress as number,
      cumulativeEarned: num.cumulativeEarned as number,
      region,
      projectType: ptype,
      startDate: start,
      contractEndDate: end,
      currentWork: str("currentWork"),
      issueCategory: str("issueCategory"),
      issueSummary: str("issueSummary"),
      actionPlan: str("actionPlan"),
    },
    issues,
  };
}

function checkMetadata(meta: Record<string, unknown> | undefined): Issue[] {
  const out: Issue[] = [];
  const add = (column: string, message: string) => out.push({ row: null, column, message });
  if (!meta || typeof meta !== "object") {
    add("metadata", "metadata가 없습니다.");
    return out;
  }
  if (meta.schemaVersion !== "2.0") add("metadata.schemaVersion", `schemaVersion은 2.0이어야 합니다. (값: ${String(meta.schemaVersion)})`);
  if (meta.moneyUnit !== "백만원") add("metadata.moneyUnit", `금액 단위는 백만원이어야 합니다. (값: ${String(meta.moneyUnit)})`);
  if (meta.progressUnit !== "percent_0_100")
    add("metadata.progressUnit", `공정률 단위는 percent_0_100이어야 합니다. (값: ${String(meta.progressUnit)})`);
  const req = meta.requiredFields;
  if (!Array.isArray(req)) add("metadata.requiredFields", "필수 열 목록이 없습니다.");
  else {
    const missing = FIELDS.filter((f) => !req.includes(f));
    if (missing.length > 0) add("metadata.requiredFields", `필수 열 목록에 빠진 열: ${missing.join(", ")}`);
  }
  return out;
}

export const NOTICE_CSV = "CSV에는 메타데이터가 없어서 데이터설명서의 단위(금액 백만원, 비율 %)와 열 기준을 따릅니다.";
export const NOTICE_JSON = "JSON의 metadata(schemaVersion 2.0, 금액·공정률 단위, 필수 열)를 확인했습니다.";

export function validateParsed(parsed: ParsedFile, opts: { skipMetadata?: boolean } = {}): ValidationResult {
  const all: Issue[] = [];
  const warnings: string[] = [];
  const notice = parsed.format === "csv" ? NOTICE_CSV : NOTICE_JSON;

  for (const fe of parsed.fileErrors) all.push({ row: null, column: fe.column, message: fe.message });
  if (parsed.format === "json" && parsed.fileErrors.length === 0 && !opts.skipMetadata)
    all.push(...checkMetadata(parsed.metadata));

  const rows: SiteRow[] = [];
  const rowNos = new Map<SiteRow, number>();
  if (parsed.fileErrors.length === 0) {
    const seen = new Map<string, number>();
    for (const rec of parsed.records) {
      const res = checkRecord(rec, parsed.format);
      all.push(...res.issues);
      if (!res.row) continue;
      const key = `${res.row.month}|${res.row.siteId}`;
      const first = seen.get(key);
      if (first !== undefined) {
        all.push({
          row: rec.rowNo,
          column: "month+siteId",
          message: `같은 월·현장(${res.row.month}/${res.row.siteId})이 ${first}행에도 있어 중복입니다.`,
        });
        continue;
      }
      seen.set(key, rec.rowNo);
      rows.push(res.row);
      rowNos.set(res.row, rec.rowNo);
    }
    if (parsed.records.length === 0) all.push({ row: null, column: null, message: "자료 행이 없습니다." });

    // 같은 현장의 고정 정보는 전 기간 같아야 합니다.
    const firstBySite = new Map<string, SiteRow>();
    for (const r of rows) {
      const first = firstBySite.get(r.siteId);
      if (!first) {
        firstBySite.set(r.siteId, r);
        continue;
      }
      for (const f of SITE_CONSTANT_FIELDS) {
        if (r[f] !== first[f])
          all.push({
            row: rowNos.get(r) ?? null,
            column: f,
            message: `현장 ${r.siteId}의 ${f} 값이 ${rowNos.get(first)}행(${String(first[f])})과 다릅니다.`,
          });
      }
    }

    // 누적 공정률·누적기성액은 줄어들 수 없습니다(교육 자료 기준).
    const bySite = new Map<string, SiteRow[]>();
    for (const r of rows) {
      const list = bySite.get(r.siteId) ?? [];
      list.push(r);
      bySite.set(r.siteId, list);
    }
    for (const list of bySite.values()) {
      list.sort((a, b) => (a.month < b.month ? -1 : 1));
      for (let i = 1; i < list.length; i++) {
        for (const f of ["plannedProgress", "actualProgress", "cumulativeEarned"] as const) {
          if (clean(list[i][f]) < clean(list[i - 1][f]))
            all.push({
              row: rowNos.get(list[i]) ?? null,
              column: f,
              message: `${list[i - 1].month}(${list[i - 1][f]})보다 ${list[i].month}(${list[i][f]})이 줄었습니다. 누적 값은 줄 수 없습니다.`,
            });
        }
      }
    }

    // 월별 누락은 오류가 아니라 경고입니다.
    if (all.length === 0) {
      const months = new Set(rows.map((r) => r.month));
      const expected = bySite.size * 12;
      const missing = expected - rows.length;
      if (missing > 0 || months.size < 12)
        warnings.push(
          `월별 자료가 ${Math.max(missing, 0)}건 빠져 있습니다. 확인 가능한 행만 집계하고, 전월이 없는 당월기성액은 "계산 불가"로 표시합니다.`,
        );
    }
  }

  const errorCount = all.length;
  return {
    ok: errorCount === 0,
    format: parsed.format,
    rows: errorCount === 0 ? rows : [],
    errors: all.slice(0, MAX_SHOWN_ERRORS),
    errorCount,
    warnings,
    notice,
  };
}

/** AI 요청 창구가 받은 행 목록을 같은 규칙으로 검사합니다(JSON 형식·metadata 없음). */
export function validateRowObjects(records: unknown[]): ValidationResult {
  const parsed: ParsedFile = {
    format: "json",
    fileErrors: [],
    records: records.map((r, i) => ({
      rowNo: i + 1,
      values: (r && typeof r === "object" ? r : {}) as Record<string, RawValue>,
    })),
  };
  return validateParsed(parsed, { skipMetadata: true });
}
