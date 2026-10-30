"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { siteMetrics } from "@/lib/calc";
import { fmtAmount, fmtMoney, fmtPct, fmtPp } from "@/lib/format";
import { useDashboard } from "@/state/DashboardContext";
import { EmptyData } from "@/components/EmptyData";
import { FilterBar } from "@/components/FilterBar";
import { diffColor, StatusBadge } from "@/components/StatusBadge";

export default function ComparePage() {
  const { rows, filters, scoped, focusSiteId, setFocusSiteId } = useDashboard();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // 점검 순위에서 넘어온 현장은 강조하고 기록을 펼친 뒤 스크롤합니다.
  useEffect(() => {
    if (!focusSiteId) return;
    setHighlight(focusSiteId);
    setOpen((prev) => new Set(prev).add(focusSiteId));
    setFocusSiteId(null);
    setTimeout(() => rowRefs.current[focusSiteId]?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
  }, [focusSiteId, setFocusSiteId]);

  if (!rows) return <EmptyData context="현장별 비교표를 보려면 자료가 필요합니다." />;

  const metrics = siteMetrics(scoped, filters.month);
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-6">
      <FilterBar showExport />
      <section className="rounded-xl border border-border-default bg-surface-card" aria-labelledby="compare-title">
        <div className="border-b border-border-default px-5 py-4">
          <h2 id="compare-title" className="text-base font-bold">
            현장별 비교표
          </h2>
          <p className="text-xs text-text-secondary">
            {filters.month} 월말 기준 · 금액은 백만원 · 행을 누르면 공사기간·기록된 상황·대응 계획이 펼쳐집니다
          </p>
        </div>
        {metrics.length === 0 ? (
          <p className="px-5 py-8 text-sm text-text-secondary">선택한 월·범위에 자료가 없습니다. (자료 없음 · 계산 불가)</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm" data-testid="compare-table">
              <thead className="bg-surface-subtle text-xs text-text-secondary">
                <tr>
                  {["현장", "지역", "유형", "당월 주요 공종", "계약금액", "누적기성액", "기성률", "계획", "실제", "공정차이", "당월기성액", "상태", ""].map(
                    (h, i) => (
                      <th key={i} className={`px-3 py-2 font-semibold ${i >= 4 && i <= 10 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {metrics.map((m) => {
                  const isOpen = open.has(m.siteId);
                  const isHi = highlight === m.siteId;
                  return (
                    <Fragment key={m.siteId}>
                      <tr
                        ref={(el) => {
                          rowRefs.current[m.siteId] = el;
                        }}
                        data-site={m.siteId}
                        data-highlight={isHi ? "true" : undefined}
                        onClick={() => toggle(m.siteId)}
                        className={`cursor-pointer border-t border-border-default hover:bg-surface-subtle ${
                          isHi ? "bg-status-critical-bg outline outline-2 -outline-offset-2 outline-status-critical" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5">
                          <div className="font-bold">현장 {m.siteId}</div>
                          <div className="text-xs text-text-secondary">{m.row.siteName}</div>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5">{m.row.region}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{m.row.projectType}</td>
                        <td className="min-w-[140px] px-3 py-2.5">{m.row.currentWork}</td>
                        <td className="num px-3 py-2.5 text-right">{fmtAmount(m.row.contractAmount)}</td>
                        <td className="num px-3 py-2.5 text-right">{fmtMoney(m.row.cumulativeEarned)}</td>
                        <td className="num px-3 py-2.5 text-right">{fmtPct(m.earnedRate)}</td>
                        <td className="num px-3 py-2.5 text-right">{fmtPct(m.row.plannedProgress)}</td>
                        <td className="num px-3 py-2.5 text-right">{fmtPct(m.row.actualProgress)}</td>
                        <td className={`num px-3 py-2.5 text-right font-bold ${diffColor(m.status)}`}>{fmtPp(m.diff)}</td>
                        <td className="num px-3 py-2.5 text-right" data-testid={`monthly-${m.siteId}`}>
                          {fmtMoney(m.monthlyEarned)}
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="px-3 py-2.5">
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-label={`현장 ${m.siteId} 기록 ${isOpen ? "접기" : "펼치기"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggle(m.siteId);
                            }}
                            className="rounded-lg border border-border-strong p-1 hover:bg-surface-subtle"
                          >
                            <span aria-hidden="true" className="material-symbols-outlined">{isOpen ? "expand_less" : "expand_more"}</span>
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr data-detail={m.siteId} className="bg-surface-bg">
                          <td colSpan={13} className="px-5 py-4">
                            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                              <div className="rounded-lg border border-border-default bg-surface-card p-4">
                                <div className="text-xs font-semibold text-text-secondary">공사기간</div>
                                <div className="num mt-1 text-sm font-bold">
                                  {m.row.startDate} ~ {m.row.contractEndDate}
                                </div>
                                <div className="mt-1 text-xs text-text-secondary">
                                  끝나는 날은 계약상 준공일입니다. 예정일이며 실제 완료일이 아닙니다.
                                </div>
                              </div>
                              <div className="rounded-lg border border-border-default bg-surface-card p-4">
                                <div className="text-xs font-semibold text-text-secondary">
                                  기록된 상황 <span className="ml-1 rounded bg-surface-subtle px-1.5 py-0.5">{m.row.issueCategory}</span>
                                </div>
                                <p className="mt-1 text-sm">{m.row.issueSummary}</p>
                              </div>
                              <div className="rounded-lg border border-border-default bg-surface-card p-4">
                                <div className="text-xs font-semibold text-text-secondary">대응 계획 (기록된 예정 대응)</div>
                                <p className="mt-1 text-sm">{m.row.actionPlan}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
