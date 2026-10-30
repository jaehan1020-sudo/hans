"use client";

import { aggregate, inspectionRanking, siteMetrics, trend } from "@/lib/calc";
import { fmtMoney, NA } from "@/lib/format";
import { useDashboard } from "@/state/DashboardContext";
import { EmptyData } from "@/components/EmptyData";
import { FilterBar } from "@/components/FilterBar";
import { InspectionRank } from "@/components/InspectionRank";
import { Kpi } from "@/components/Kpi";
import { SiteSummaryTable } from "@/components/SiteSummaryTable";
import { TrendChart, TrendLegend } from "@/components/TrendChart";

export default function SummaryPage() {
  const { rows, filters, scoped } = useDashboard();
  if (!rows) return <EmptyData context="현황 요약을 보려면 자료가 필요합니다." />;

  const metrics = siteMetrics(scoped, filters.month);
  const agg = aggregate(scoped, filters.month);
  const ranking = inspectionRanking(metrics);
  const points = trend(scoped, filters.month);
  const first = points[0];

  return (
    <div className="flex flex-col gap-6">
      <FilterBar showExport />
      <SiteSummaryTable metrics={metrics} month={filters.month} />
      <Kpi agg={agg} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(320px,2fr)_3fr]">
        <InspectionRank ranking={ranking} />
        <section className="rounded-xl border border-border-default bg-surface-card p-5" aria-labelledby="trend-title">
          <h2 id="trend-title" className="text-base font-bold">
            계획·실제 공정률 추이와 월별 기성
          </h2>
          <p className="mb-3 text-xs text-text-secondary">
            {first?.month} ~ {filters.month} ({points.length}개월) · 같은 지역·유형·현장 범위로 매월 따로 집계
          </p>
          <TrendLegend />
          <TrendChart points={points} selectedMonth={filters.month} />
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-border-default pt-3 text-xs text-text-secondary">
            <span data-testid="trend-cumulative">
              {filters.month} 누적: <b className="num">{fmtMoney(agg?.earnedTotal)}</b> 백만원
            </span>
            <span data-testid="trend-monthly">
              {filters.month} 당월기성액: <b className="num">{fmtMoney(agg?.monthlyEarned)}</b>
              {agg?.monthlyEarned === null || agg === null ? "" : " 백만원"}
            </span>
          </div>
          {first?.agg && first.agg.monthlyEarned === null && (
            <p
              className="mt-3 rounded-lg border border-status-critical-border bg-status-critical-bg px-3 py-2 text-xs text-status-critical"
              data-testid="first-month-note"
            >
              * {first.month}의 당월기성액은 바로 전월 자료가 없어 &lsquo;{NA}&rsquo;로 표시합니다. 누적액을 당월액으로 대신하지 않습니다.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
