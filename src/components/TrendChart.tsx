import type { TrendPoint } from "@/lib/calc";
import { fmtMoney, fmtPct, shortMonth, NA } from "@/lib/format";

const W = 720;
const H = 320;
const L = 44;
const R = 64;
const T = 16;
const B = 34;
const PW = W - L - R;
const PH = H - T - B;

function niceMax(v: number): number {
  if (v <= 0) return 1000;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * mag;
}

/** 시작 월~선택 월의 계획·실제 공정률(선)과 월별 당월기성액(막대). 직접 그린 SVG입니다. */
export function TrendChart({ points, selectedMonth }: { points: TrendPoint[]; selectedMonth: string }) {
  const n = points.length;
  const slot = PW / Math.max(n, 1);
  const x = (i: number) => L + slot * (i + 0.5);
  const y = (pct: number) => T + PH * (1 - pct / 100);
  const barMax = niceMax(Math.max(0, ...points.map((p) => p.agg?.monthlyEarned ?? 0)));
  const barW = Math.min(slot * 0.5, 34);

  const line = (pick: (p: TrendPoint) => number | null) => {
    const segs: string[][] = [];
    let cur: string[] = [];
    points.forEach((p, i) => {
      const v = pick(p);
      if (v === null) {
        if (cur.length) segs.push(cur);
        cur = [];
      } else cur.push(`${x(i).toFixed(1)},${y(v).toFixed(1)}`);
    });
    if (cur.length) segs.push(cur);
    return segs;
  };
  const plannedSegs = line((p) => p.agg?.planned ?? null);
  const actualSegs = line((p) => p.agg?.actual ?? null);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`계획·실제 공정률 추이와 월별 당월기성액, ${points[0]?.month ?? ""}부터 ${selectedMonth}까지`}
      data-testid="trend-chart"
    >
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={y(g)} y2={y(g)} stroke="#E2E8F0" strokeWidth={1} />
          <text x={L - 6} y={y(g) + 3} textAnchor="end" fontSize={10} fill="#94A3B8" fontFamily="JetBrains Mono, monospace">
            {g}%
          </text>
        </g>
      ))}
      {[0, 0.5, 1].map((g) => (
        <text
          key={g}
          x={W - R + 6}
          y={T + PH * (1 - g) + 3}
          fontSize={10}
          fill="#64748B"
          fontFamily="JetBrains Mono, monospace"
        >
          {Math.round(barMax * g).toLocaleString("en-US")}
        </text>
      ))}
      <text x={W - R + 6} y={T - 8} fontSize={9} fill="#64748B">
        백만원
      </text>

      {points.map((p, i) => {
        const selected = p.month === selectedMonth;
        const monthly = p.agg?.monthlyEarned ?? null;
        const bh = monthly === null ? 0 : (PH * monthly) / barMax;
        const title = p.agg
          ? `${p.month} · 계획 ${fmtPct(p.agg.planned)} · 실제 ${fmtPct(p.agg.actual)} · 당월기성액 ${fmtMoney(monthly)}${monthly === null ? "" : " 백만원"}`
          : `${p.month} · 자료 없음`;
        return (
          <g key={p.month} data-testid={`trend-month-${p.month}`}>
            <title>{title}</title>
            {monthly !== null && (
              <rect
                x={x(i) - barW / 2}
                y={T + PH - bh}
                width={barW}
                height={bh}
                rx={2}
                fill={selected ? "#2563eb" : "#bfdbfe"}
              />
            )}
            {p.agg && monthly === null && (
              <text x={x(i)} y={T + PH - 6} textAnchor="middle" fontSize={9} fill="#E11D48" data-testid="bar-na">
                {NA}
              </text>
            )}
            {!p.agg && (
              <text x={x(i)} y={T + PH - 6} textAnchor="middle" fontSize={9} fill="#94A3B8">
                자료 없음
              </text>
            )}
            <text
              x={x(i)}
              y={H - 12}
              textAnchor="middle"
              fontSize={10}
              fill={selected ? "#0F172A" : "#94A3B8"}
              fontWeight={selected ? 700 : 400}
              fontFamily="JetBrains Mono, monospace"
            >
              {shortMonth(p.month)}
            </text>
          </g>
        );
      })}

      {plannedSegs.map((s, k) => (
        <polyline key={`p${k}`} points={s.join(" ")} fill="none" stroke="#64748B" strokeWidth={2} strokeDasharray="4 4" />
      ))}
      {actualSegs.map((s, k) => (
        <polyline key={`a${k}`} points={s.join(" ")} fill="none" stroke="#1d4ed8" strokeWidth={2.5} />
      ))}
      {points.map((p, i) =>
        p.agg && p.agg.actual !== null ? (
          <circle
            key={p.month}
            cx={x(i)}
            cy={y(p.agg.actual)}
            r={p.month === selectedMonth ? 4.5 : 3}
            fill={p.month === selectedMonth ? "#E11D48" : "#1d4ed8"}
          />
        ) : null,
      )}
    </svg>
  );
}

export function TrendLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
      <span className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line x1="0" y1="3" x2="22" y2="3" stroke="#64748B" strokeWidth="2" strokeDasharray="4 3" />
        </svg>
        계획 공정률(%)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <svg width="22" height="6" aria-hidden>
          <line x1="0" y1="3" x2="22" y2="3" stroke="#1d4ed8" strokeWidth="2.5" />
        </svg>
        실제 공정률(%)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="inline-block h-3 w-3 rounded-sm bg-blue-200" aria-hidden />
        당월 기성액(백만원)
      </span>
    </div>
  );
}
