import { indexRows, prevMonth, scopeRows, siteMetrics } from "./calc";
import { NA, num1 } from "./format";
import { ALL, FIELDS, type Filters, type SiteRow } from "./types";

export const EXTRA_HEADERS = ["기성률(%)", "공정차이(pp)", "상태", "당월기성액(백만원)"] as const;

function esc(v: string | number): string {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export interface CsvExport {
  /** UTF-8 BOM으로 시작하는 파일 내용 */
  content: string;
  fileName: string;
  /** 헤더를 뺀 데이터 행 수 */
  dataRows: number;
}

/**
 * 지금 고른 월·지역·유형·현장과 같은 범위를 내보냅니다.
 * 원본 15개 열 뒤에 기성률·공정차이·상태·당월기성액 4개 열을 더합니다.
 * 당월기성액은 내보내는 행 밖의 전월 자료로도 계산합니다.
 */
export function buildCsv(all: SiteRow[], f: Filters): CsvExport {
  const scoped = scopeRows(all, f);
  const metrics = siteMetrics(scoped, f.month);
  const idx = indexRows(all);
  const lines: string[] = [[...FIELDS, ...EXTRA_HEADERS].map(esc).join(",")];
  for (const m of metrics) {
    // 필터는 지역·유형·현장만 바꾸므로 같은 현장의 전월 행은 all에도 있습니다.
    const prev = idx.get(`${prevMonth(f.month)}|${m.siteId}`);
    const monthly = prev ? m.row.cumulativeEarned - prev.cumulativeEarned : null;
    const original = FIELDS.map((k) => esc(m.row[k]));
    const extra = [
      m.earnedRate === null ? NA : num1(m.earnedRate),
      num1(m.diff),
      m.status,
      monthly === null ? NA : num1(monthly),
    ].map(esc);
    lines.push([...original, ...extra].join(","));
  }
  const parts = [f.month, f.region, f.projectType, f.siteId].filter((p, i) => i === 0 || p !== ALL);
  return {
    content: "﻿" + lines.join("\r\n") + "\r\n",
    fileName: `현장공정기성_${parts.join("_")}.csv`,
    dataRows: metrics.length,
  };
}
