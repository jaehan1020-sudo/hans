import Link from "next/link";
import type { SiteMetric } from "@/lib/calc";
import { fmtPct, fmtPp } from "@/lib/format";
import { diffColor, StatusBadge } from "./StatusBadge";

/** 첫 화면의 12개 현장 비교 요약표 (현장 ID 순) */
export function SiteSummaryTable({ metrics, month }: { metrics: SiteMetric[]; month: string }) {
  const counts = { 정상: 0, 주의: 0, 점검: 0 };
  for (const m of metrics) counts[m.status]++;
  return (
    <section className="rounded-xl border border-border-default bg-surface-card" aria-labelledby="summary-title">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-5 py-4">
        <div>
          <h2 id="summary-title" className="text-base font-bold">
            12개 현장 공정·기성 비교 요약표
          </h2>
          <p className="text-xs text-text-secondary">
            {month} 월말 기준 · 공정차이(pp) = 실제 공정률 - 계획 공정률
          </p>
        </div>
        <Link href="/compare" className="text-sm font-semibold text-brand hover:underline">
          현장별 비교표 전체 보기 →
        </Link>
      </div>
      {metrics.length === 0 ? (
        <p className="px-5 py-8 text-sm text-text-secondary" data-testid="summary-empty">
          선택한 월·범위에 자료가 없습니다. (자료 없음 · 계산 불가)
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="summary-table">
            <thead className="bg-surface-subtle text-xs text-text-secondary">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">현장</th>
                <th className="px-4 py-2 text-left font-semibold">상태</th>
                <th className="px-4 py-2 text-right font-semibold">계획 공정률</th>
                <th className="px-4 py-2 text-right font-semibold">실제 공정률</th>
                <th className="px-4 py-2 text-right font-semibold">공정차이(pp)</th>
                <th className="px-4 py-2 text-right font-semibold">기성률</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr
                  key={m.siteId}
                  data-site={m.siteId}
                  className={`border-t border-border-default ${m.status === "점검" ? "bg-status-critical-bg" : ""}`}
                >
                  <td className="px-4 py-2.5">
                    <span className="font-bold">현장 {m.siteId}</span>
                    <span className="ml-2 text-text-secondary">{m.row.siteName}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={m.status} />
                  </td>
                  <td className="num px-4 py-2.5 text-right">{fmtPct(m.row.plannedProgress)}</td>
                  <td className="num px-4 py-2.5 text-right">{fmtPct(m.row.actualProgress)}</td>
                  <td className={`num px-4 py-2.5 text-right font-bold ${diffColor(m.status)}`}>{fmtPp(m.diff)}</td>
                  <td className="num px-4 py-2.5 text-right">{fmtPct(m.earnedRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-4 border-t border-border-default px-5 py-3 text-xs text-text-secondary">
        <span>
          전체 현장: <b className="num">{metrics.length}개소</b>
        </span>
        <span>정상 {counts.정상}개소</span>
        <span>주의 {counts.주의}개소</span>
        <span>점검 {counts.점검}개소</span>
      </div>
    </section>
  );
}
