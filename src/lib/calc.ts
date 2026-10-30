import { ALL, MONTH_START, PROJECT_TYPES, REGIONS, type Filters, type SiteRow, type Status } from "./types";

/** 컴퓨터의 소수 계산 오차(예: -5.000000000000007)만 없앱니다. 값을 반올림하는 것이 아닙니다. */
export function clean(x: number): number {
  return Math.round(x * 1e9) / 1e9;
}

/** 소수 첫째 자리 반올림(0에서 먼 쪽으로). 표시할 때만 씁니다. */
export function round1(x: number): number {
  const v = clean(x);
  const r = Math.sign(v) * Math.round(Math.abs(v) * 10 + 1e-9) / 10;
  return r === 0 ? 0 : r;
}

export function statusOf(diff: number): Status {
  const d = clean(diff);
  if (d >= 0) return "정상";
  if (d > -5) return "주의";
  return "점검";
}

export function prevMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, "0")}`;
}

export function monthsBetween(start: string, end: string): string[] {
  const out: string[] = [];
  let cur = start;
  let guard = 0;
  while (cur <= end && guard++ < 240) {
    out.push(cur);
    const [y, m] = cur.split("-").map(Number);
    cur = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  }
  return out;
}

export interface SiteMetric {
  siteId: string;
  row: SiteRow;
  earnedRate: number | null;
  diff: number;
  status: Status;
  /** 바로 전월 행이 있을 때만 값이 있습니다. 첫 달·전월 없음은 null(계산 불가). */
  monthlyEarned: number | null;
}

function rowKey(month: string, siteId: string): string {
  return `${month}|${siteId}`;
}

export function indexRows(rows: SiteRow[]): Map<string, SiteRow> {
  const m = new Map<string, SiteRow>();
  for (const r of rows) m.set(rowKey(r.month, r.siteId), r);
  return m;
}

/** rows는 이미 지역·유형·현장 필터가 적용된 전체 월 자료입니다. */
export function siteMetrics(rows: SiteRow[], month: string): SiteMetric[] {
  const idx = indexRows(rows);
  const pm = prevMonth(month);
  return rows
    .filter((r) => r.month === month)
    .sort((a, b) => (a.siteId < b.siteId ? -1 : a.siteId > b.siteId ? 1 : 0))
    .map((row) => {
      const prev = idx.get(rowKey(pm, row.siteId));
      const diff = row.actualProgress - row.plannedProgress;
      return {
        siteId: row.siteId,
        row,
        earnedRate: row.contractAmount > 0 ? (row.cumulativeEarned / row.contractAmount) * 100 : null,
        diff,
        status: statusOf(diff),
        monthlyEarned: prev ? row.cumulativeEarned - prev.cumulativeEarned : null,
      };
    });
}

export interface Aggregate {
  month: string;
  siteCount: number;
  contractTotal: number;
  earnedTotal: number;
  earnedRate: number | null;
  planned: number | null;
  actual: number | null;
  diff: number | null;
  monthlyEarned: number | null;
  counts: Record<Status, number>;
}

/** 선택한 한 달의 범위 집계. 그 달 행이 없으면 null(자료 없음). */
export function aggregate(rows: SiteRow[], month: string): Aggregate | null {
  const metrics = siteMetrics(rows, month);
  if (metrics.length === 0) return null;
  const contractTotal = metrics.reduce((s, m) => s + m.row.contractAmount, 0);
  const earnedTotal = metrics.reduce((s, m) => s + m.row.cumulativeEarned, 0);
  const hasDen = contractTotal > 0;
  const planned = hasDen
    ? metrics.reduce((s, m) => s + m.row.contractAmount * m.row.plannedProgress, 0) / contractTotal
    : null;
  const actual = hasDen
    ? metrics.reduce((s, m) => s + m.row.contractAmount * m.row.actualProgress, 0) / contractTotal
    : null;
  const allHavePrev = metrics.every((m) => m.monthlyEarned !== null);
  const counts: Record<Status, number> = { 정상: 0, 주의: 0, 점검: 0 };
  for (const m of metrics) counts[m.status]++;
  return {
    month,
    siteCount: metrics.length,
    contractTotal,
    earnedTotal,
    earnedRate: hasDen ? (earnedTotal / contractTotal) * 100 : null,
    planned,
    actual,
    diff: planned !== null && actual !== null ? actual - planned : null,
    monthlyEarned: allHavePrev ? metrics.reduce((s, m) => s + (m.monthlyEarned as number), 0) : null,
    counts,
  };
}

export interface TrendPoint {
  month: string;
  /** null이면 그 달 선택 범위에 자료가 없음 */
  agg: Aggregate | null;
}

export function trend(rows: SiteRow[], endMonth: string, startMonth: string = MONTH_START): TrendPoint[] {
  return monthsBetween(startMonth, endMonth).map((month) => ({ month, agg: aggregate(rows, month) }));
}

/** 점검 현장(-5pp 이하)을 공정차이 오름차순, 같으면 현장 ID 순으로 나열합니다. */
export function inspectionRanking(metrics: SiteMetric[]): SiteMetric[] {
  return metrics
    .filter((m) => m.status === "점검")
    .sort((a, b) => {
      const d = clean(a.diff) - clean(b.diff);
      if (d !== 0) return d;
      return a.siteId < b.siteId ? -1 : a.siteId > b.siteId ? 1 : 0;
    });
}

// ---- 필터 ----

/** 지역·유형·현장 필터를 적용한 전체 월 자료 */
export function scopeRows(all: SiteRow[], f: Filters): SiteRow[] {
  return all.filter(
    (r) =>
      (f.region === ALL || r.region === f.region) &&
      (f.projectType === ALL || r.projectType === f.projectType) &&
      (f.siteId === ALL || r.siteId === f.siteId),
  );
}

function uniqSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

/** 데이터설명서에 적힌 순서(인천·경기·충남…)로 정렬하고, 모르는 값은 뒤에 가나다순으로 둡니다. */
function uniqInOrder(values: string[], order: string[]): string[] {
  const rank = (v: string) => (order.indexOf(v) === -1 ? order.length : order.indexOf(v));
  return Array.from(new Set(values)).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

export interface FilterOptions {
  months: string[];
  regions: string[];
  projectTypes: string[];
  sites: { siteId: string; siteName: string }[];
}

/** 각 선택 칸에는 다른 선택 안에서 고를 수 있는 값만 보여줍니다. */
export function filterOptions(all: SiteRow[], f: Filters): FilterOptions {
  const regionBase = all.filter((r) => f.projectType === ALL || r.projectType === f.projectType);
  const typeBase = all.filter((r) => f.region === ALL || r.region === f.region);
  const siteBase = all.filter(
    (r) =>
      (f.region === ALL || r.region === f.region) && (f.projectType === ALL || r.projectType === f.projectType),
  );
  const siteMap = new Map<string, string>();
  for (const r of siteBase) if (!siteMap.has(r.siteId)) siteMap.set(r.siteId, r.siteName);
  return {
    months: uniqSorted(all.map((r) => r.month)),
    regions: uniqInOrder(regionBase.map((r) => r.region), REGIONS),
    projectTypes: uniqInOrder(typeBase.map((r) => r.projectType), PROJECT_TYPES),
    sites: Array.from(siteMap, ([siteId, siteName]) => ({ siteId, siteName })).sort((a, b) =>
      a.siteId < b.siteId ? -1 : 1,
    ),
  };
}

/** 선택을 바꾼 뒤, 선택한 현장이 범위에서 빠지면 현장을 전체로 되돌립니다. */
export function applyFilterChange(all: SiteRow[], prev: Filters, patch: Partial<Filters>): Filters {
  const next = { ...prev, ...patch };
  if (next.siteId !== ALL) {
    const inScope = all.some(
      (r) =>
        r.siteId === next.siteId &&
        (next.region === ALL || r.region === next.region) &&
        (next.projectType === ALL || r.projectType === next.projectType),
    );
    if (!inScope) next.siteId = ALL;
  }
  return next;
}
