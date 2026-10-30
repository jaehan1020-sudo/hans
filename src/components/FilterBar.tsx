"use client";

import { useState } from "react";
import { aggregate } from "@/lib/calc";
import { buildCsv } from "@/lib/exportCsv";
import { ALL } from "@/lib/types";
import { useDashboard } from "@/state/DashboardContext";
import { StatusBadge } from "./StatusBadge";

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-text-secondary">
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-[130px] rounded-lg border border-border-strong bg-surface-card px-3 py-2 text-sm font-semibold text-text-primary"
      >
        {children}
      </select>
    </label>
  );
}

/** 월·지역·공사 유형·현장 선택. 모든 페이지가 같은 선택을 씁니다. */
export function FilterBar({ showExport = false }: { showExport?: boolean }) {
  const { rows, filters, options, scoped, setFilters } = useDashboard();
  const [message, setMessage] = useState<string | null>(null);
  const agg = aggregate(scoped, filters.month);

  function exportCsv() {
    if (!rows) return;
    const out = buildCsv(rows, filters);
    if (out.dataRows === 0) {
      setMessage("내보낼 자료가 없습니다.");
      return;
    }
    const blob = new Blob([out.content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = out.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setMessage(`${out.fileName} (데이터 ${out.dataRows}행)을 내려받았습니다.`);
  }

  return (
    <section className="rounded-xl border border-border-default bg-surface-card p-4" aria-label="관제 필터">
      <div className="flex flex-wrap items-end gap-4">
        <Select label="기준월" value={filters.month} onChange={(v) => setFilters({ month: v })}>
          {options.months.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>
        <Select label="지역" value={filters.region} onChange={(v) => setFilters({ region: v })}>
          <option value={ALL}>전체 지역</option>
          {options.regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        <Select label="공사 유형" value={filters.projectType} onChange={(v) => setFilters({ projectType: v })}>
          <option value={ALL}>전체 유형</option>
          {options.projectTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select label="현장" value={filters.siteId} onChange={(v) => setFilters({ siteId: v })}>
          <option value={ALL}>전체 현장 ({options.sites.length}곳)</option>
          {options.sites.map((s) => (
            <option key={s.siteId} value={s.siteId}>
              {s.siteId} · {s.siteName}
            </option>
          ))}
        </Select>
        {showExport && (
          <button
            type="button"
            onClick={exportCsv}
            className="ml-auto inline-flex items-center gap-2 rounded-lg bg-text-primary px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            <span aria-hidden="true" className="material-symbols-outlined">download</span>
            CSV 내보내기
          </button>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span className="font-medium">종합 판정</span>
        {agg ? (
          <>
            <span className="inline-flex items-center gap-1">
              <StatusBadge status="정상" /> <b className="num">{agg.counts.정상}곳</b>
            </span>
            <span className="inline-flex items-center gap-1">
              <StatusBadge status="주의" /> <b className="num">{agg.counts.주의}곳</b>
            </span>
            <span className="inline-flex items-center gap-1">
              <StatusBadge status="점검" /> <b className="num">{agg.counts.점검}곳</b>
            </span>
          </>
        ) : (
          <span>자료 없음 · 계산 불가</span>
        )}
        {message && (
          <span role="status" className="ml-auto text-text-primary" data-testid="export-message">
            {message}
          </span>
        )}
      </div>
    </section>
  );
}
