"use client";

import { useRouter } from "next/navigation";
import type { SiteMetric } from "@/lib/calc";
import { fmtPct, fmtPp } from "@/lib/format";
import { useDashboard } from "@/state/DashboardContext";
import { StatusBadge } from "./StatusBadge";

/** 점검 현장 순위. 줄을 누르면 현장별 비교표로 이동해 그 현장 줄을 강조하고 기록을 펼칩니다. */
export function InspectionRank({ ranking }: { ranking: SiteMetric[] }) {
  const router = useRouter();
  const { setFocusSiteId } = useDashboard();

  return (
    <section className="rounded-xl border border-border-default bg-surface-card p-5" aria-labelledby="rank-title">
      <h2 id="rank-title" className="text-base font-bold">
        점검 현장 순위
      </h2>
      <p className="mb-3 text-xs text-text-secondary">공정차이가 작은 순(같으면 현장 ID 순) · 줄을 누르면 비교표로 이동합니다</p>
      {ranking.length === 0 ? (
        <div
          className="rounded-lg border border-status-normal-border bg-status-normal-bg px-4 py-6 text-center text-sm"
          data-testid="state-no-inspection"
        >
          <div className="font-bold text-status-normal">점검 대상 없음</div>
          <div className="mt-1 text-xs text-text-secondary">고른 월·범위에 공정차이 -5.0pp 이하인 현장이 없습니다.</div>
        </div>
      ) : (
        <ol className="flex flex-col gap-3" data-testid="rank-list">
          {ranking.map((m, i) => (
            <li key={m.siteId}>
              <button
                type="button"
                data-site={m.siteId}
                onClick={() => {
                  setFocusSiteId(m.siteId);
                  router.push("/compare");
                }}
                className="w-full rounded-lg border border-status-critical-border bg-surface-card p-3 text-left hover:bg-status-critical-bg"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-critical text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm font-bold">{m.siteId} 현장</span>
                    <span className="text-xs text-text-secondary">{m.row.siteName}</span>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
                <div className="num mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  <span>
                    계획 <b>{fmtPct(m.row.plannedProgress)}</b>
                  </span>
                  <span>
                    실제 <b>{fmtPct(m.row.actualProgress)}</b>
                  </span>
                  <span className="text-status-critical">
                    공정차이 <b className="text-sm">{fmtPp(m.diff)}</b>
                  </span>
                  <span>
                    기성률 <b>{fmtPct(m.earnedRate)}</b>
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
