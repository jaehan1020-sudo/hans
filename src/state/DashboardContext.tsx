"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { AiAnswer } from "@/lib/ai";
import { applyFilterChange, filterOptions, scopeRows, type FilterOptions } from "@/lib/calc";
import { ALL, DEFAULT_MONTH, type Filters, type SiteRow } from "@/lib/types";

export interface ImportInfo {
  fileName: string;
  format: "csv" | "json";
  rowCount: number;
}

export type AskState =
  | { status: "idle" }
  | { status: "loading"; question: string }
  | { status: "done"; question: string; answer: AiAnswer }
  | { status: "error"; question: string; message: string };

interface DashboardCtx {
  /** 가져온 자료 전체(144행). 처음에는 null(자료 없음). */
  rows: SiteRow[] | null;
  info: ImportInfo | null;
  filters: Filters;
  options: FilterOptions;
  /** 지역·유형·현장 필터를 적용한 전체 월 자료 */
  scoped: SiteRow[];
  setFilters: (patch: Partial<Filters>) => void;
  /** 검사를 통과한 자료로 지금 자료 전체를 바꿉니다(이어 붙이지 않음). */
  replaceData: (rows: SiteRow[], info: ImportInfo) => void;
  focusSiteId: string | null;
  setFocusSiteId: (id: string | null) => void;
  ask: AskState;
  askAi: (question: string) => Promise<void>;
}

const Ctx = createContext<DashboardCtx | null>(null);

const EMPTY_OPTIONS: FilterOptions = { months: [], regions: [], projectTypes: [], sites: [] };

function initialFilters(rows: SiteRow[] | null): Filters {
  const months = rows ? Array.from(new Set(rows.map((r) => r.month))).sort() : [];
  const month = months.includes(DEFAULT_MONTH) ? DEFAULT_MONTH : (months[months.length - 1] ?? DEFAULT_MONTH);
  return { month, region: ALL, projectType: ALL, siteId: ALL };
}

const CLIENT_TIMEOUT_MS = 35_000;

export function DashboardProvider({ children }: { children: ReactNode }) {
  const [rows, setRows] = useState<SiteRow[] | null>(null);
  const [info, setInfo] = useState<ImportInfo | null>(null);
  const [filters, setFiltersState] = useState<Filters>(initialFilters(null));
  const [focusSiteId, setFocusSiteId] = useState<string | null>(null);
  const [ask, setAsk] = useState<AskState>({ status: "idle" });

  const rowsRef = useRef<SiteRow[] | null>(null);
  const filtersRef = useRef<Filters>(filters);
  const abortRef = useRef<AbortController | null>(null);

  const clearAsk = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setAsk({ status: "idle" });
  }, []);

  const setFilters = useCallback(
    (patch: Partial<Filters>) => {
      const cur = rowsRef.current;
      if (!cur) return;
      const next = applyFilterChange(cur, filtersRef.current, patch);
      if (JSON.stringify(next) === JSON.stringify(filtersRef.current)) return;
      filtersRef.current = next;
      setFiltersState(next);
      // 월·지역·유형·현장을 바꾸면 이전 답변을 지우고, 진행 중인 요청의 응답도 버립니다.
      clearAsk();
    },
    [clearAsk],
  );

  const replaceData = useCallback(
    (next: SiteRow[], nextInfo: ImportInfo) => {
      rowsRef.current = next;
      const f = initialFilters(next);
      filtersRef.current = f;
      setRows(next);
      setInfo(nextInfo);
      setFiltersState(f);
      setFocusSiteId(null);
      clearAsk();
    },
    [clearAsk],
  );

  const askAi = useCallback(async (question: string) => {
    const cur = rowsRef.current;
    if (!cur) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const f = filtersRef.current;
    const key = JSON.stringify(f);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, CLIENT_TIMEOUT_MS);
    setAsk({ status: "loading", question });
    const stale = () => JSON.stringify(filtersRef.current) !== key || abortRef.current !== controller;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          scope: f,
          rows: scopeRows(cur, f).filter((r) => r.month <= f.month),
        }),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => null);
      // 요청 중에 범위가 바뀌었다면 늦게 온 응답을 새 범위에 표시하지 않습니다.
      if (stale()) return;
      if (res.ok && data?.ok) setAsk({ status: "done", question, answer: data as AiAnswer });
      else setAsk({ status: "error", question, message: data?.message ?? "AI 연결에 실패했습니다." });
    } catch {
      if (timedOut && !stale()) {
        setAsk({ status: "error", question, message: "AI 응답 시간이 지났습니다." });
        return;
      }
      if (controller.signal.aborted || stale()) return;
      setAsk({ status: "error", question, message: "서버에 연결하지 못했습니다." });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const options = useMemo(() => (rows ? filterOptions(rows, filters) : EMPTY_OPTIONS), [rows, filters]);
  const scoped = useMemo(() => (rows ? scopeRows(rows, filters) : []), [rows, filters]);

  const value: DashboardCtx = {
    rows,
    info,
    filters,
    options,
    scoped,
    setFilters,
    replaceData,
    focusSiteId,
    setFocusSiteId,
    ask,
    askAi,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDashboard(): DashboardCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("DashboardProvider 안에서만 쓸 수 있습니다.");
  return v;
}
