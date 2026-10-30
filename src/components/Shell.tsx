"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useDashboard } from "@/state/DashboardContext";

const NAV = [
  { href: "/", label: "현황 요약", icon: "dashboard" },
  { href: "/compare", label: "현장별 비교표", icon: "table_chart" },
  { href: "/import", label: "자료 가져오기", icon: "cloud_upload" },
  { href: "/ask", label: "AI에게 묻기", icon: "smart_toy" },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { info, rows } = useDashboard();
  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col bg-sidebar text-white">
        <div className="px-5 pb-4 pt-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sidebar-active">
              <span aria-hidden="true" className="material-symbols-outlined">apartment</span>
            </span>
            <div>
              <div className="text-sm font-bold leading-tight">현장 공정·기성</div>
              <div className="text-[11px] text-slate-400">교육용 가상 자료</div>
            </div>
          </div>
        </div>
        <nav className="mt-4 flex flex-col gap-1 px-3" aria-label="주 메뉴">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  active ? "bg-sidebar-active text-white" : "text-slate-300 hover:bg-white/10"
                }`}
              >
                <span aria-hidden="true" className="material-symbols-outlined">{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto px-5 pb-5 text-[11px] leading-relaxed text-slate-400">
          금액은 백만원, 비율은 %, 차이는 pp입니다.
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border-default bg-surface-card px-6 py-3">
          <h1 className="text-base font-bold">현장별 공정·기성 대시보드</h1>
          <div className="flex items-center gap-2 text-xs text-text-secondary" data-testid="data-info">
            {rows && info ? (
              <span>
                가져온 자료: <span className="num">{info.fileName}</span> · {info.rowCount}행 ({info.format.toUpperCase()})
              </span>
            ) : (
              <span>가져온 자료 없음</span>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1280px] p-6">{children}</main>
      </div>
    </div>
  );
}
