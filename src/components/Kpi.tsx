import { type Aggregate } from "@/lib/calc";
import { fmtAmount, fmtMoney, fmtPct, fmtPp, NA } from "@/lib/format";

function Card({
  title,
  value,
  sub,
  tone,
  testId,
}: {
  title: string;
  value: string;
  sub?: React.ReactNode;
  tone?: string;
  testId: string;
}) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-card p-5" data-testid={testId}>
      <div className="text-xs font-medium text-text-secondary">{title}</div>
      <div className={`num mt-2 text-3xl font-bold ${tone ?? "text-text-primary"}`}>{value}</div>
      {sub && <div className="mt-3 border-t border-border-default pt-2 text-xs text-text-secondary">{sub}</div>}
    </div>
  );
}

/** 큰 숫자 4개: 전체 기성률, 계획·실제 공정률, 공정차이 */
export function Kpi({ agg }: { agg: Aggregate | null }) {
  if (!agg) {
    return (
      <div
        className="rounded-xl border border-border-default bg-surface-card p-6 text-sm text-text-secondary"
        data-testid="kpi-empty"
      >
        선택한 월·범위에 자료가 없습니다. 기성률·공정률·공정차이: <b>{NA}</b> (0%로 대신하지 않습니다)
      </div>
    );
  }
  const diffTone =
    agg.diff === null ? undefined : agg.diff <= -5 ? "text-status-critical" : agg.diff < 0 ? "text-status-caution" : "text-status-normal";
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card
        testId="kpi-earned-rate"
        title="전체 기성률"
        value={fmtPct(agg.earnedRate)}
        sub={
          <>
            누적기성액 <b className="num">{fmtMoney(agg.earnedTotal)}</b> / 계약금액{" "}
            <b className="num">{fmtAmount(agg.contractTotal)}</b> 백만원
            <br />
            당월기성액 <b className="num">{fmtMoney(agg.monthlyEarned)}</b>
            {agg.monthlyEarned === null ? "" : " 백만원"}
          </>
        }
      />
      <Card testId="kpi-planned" title="계획 공정률" value={fmtPct(agg.planned)} sub="계약금액 가중 평균" />
      <Card testId="kpi-actual" title="실제 공정률" value={fmtPct(agg.actual)} sub="계약금액 가중 평균" />
      <Card
        testId="kpi-diff"
        title="공정차이 (실제 - 계획)"
        value={fmtPp(agg.diff)}
        tone={diffTone}
        sub={
          <span data-testid="kpi-counts">
            정상 <b className="num">{agg.counts.정상}</b>곳 · 주의 <b className="num">{agg.counts.주의}</b>곳 · 점검{" "}
            <b className="num">{agg.counts.점검}</b>곳
          </span>
        }
      />
    </div>
  );
}
