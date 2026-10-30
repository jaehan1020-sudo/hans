import { describe, expect, it } from "vitest";
import {
  aggregate,
  applyFilterChange,
  filterOptions,
  inspectionRanking,
  round1,
  scopeRows,
  siteMetrics,
  statusOf,
  trend,
} from "../src/lib/calc";
import { fmtMoney, fmtPct, fmtPp } from "../src/lib/format";
import { filters, loadRows } from "./helpers";

const all = loadRows("csv");

describe("월별 전체 현장 (검산표)", () => {
  const cases: [string, number, number, string][] = [
    ["2026-09", 424063.4, 67.2, "9월"],
    ["2026-08", 395184.7, 62.7, "8월"],
    ["2026-07", 364718.5, 57.8, "7월"],
  ];
  for (const [month, earned, rate, label] of cases) {
    it(`${label} 누적기성액 ${earned}, 기성률 ${rate}%`, () => {
      const a = aggregate(all, month)!;
      expect(round1(a.earnedTotal)).toBe(earned);
      expect(round1(a.earnedRate!)).toBe(rate);
      expect(a.contractTotal).toBe(630700);
    });
  }

  it("9월 공정률 계획 73.2% · 실제 71.2% · 공정차이 -2.0pp", () => {
    const a = aggregate(all, "2026-09")!;
    expect(fmtPct(a.planned)).toBe("73.2%");
    expect(fmtPct(a.actual)).toBe("71.2%");
    expect(fmtPp(a.diff)).toBe("-2.0pp");
  });

  it("9월 당월기성액 28,878.7", () => {
    expect(fmtMoney(aggregate(all, "2026-09")!.monthlyEarned)).toBe("28,878.7");
  });

  it("9월 상태 정상 6 · 주의 3 · 점검 3", () => {
    expect(aggregate(all, "2026-09")!.counts).toEqual({ 정상: 6, 주의: 3, 점검: 3 });
  });

  it("2025-10: 당월기성액 계산 불가(누적액으로 대신하지 않음)", () => {
    const a = aggregate(all, "2025-10")!;
    expect(a.monthlyEarned).toBeNull();
    expect(fmtMoney(a.monthlyEarned)).toBe("계산 불가");
    expect(round1(a.earnedTotal)).toBe(105449.7);
    expect(fmtPct(a.planned)).toBe("19.4%");
    expect(fmtPct(a.actual)).toBe("19.6%");
    expect(fmtPp(a.diff)).toBe("+0.2pp");
  });

  it("2025-11 전체 당월기성액 20,408.1", () => {
    expect(fmtMoney(aggregate(all, "2025-11")!.monthlyEarned)).toBe("20,408.1");
  });

  it("월별 전체 점검 곳 수: 2025-10은 0, 2026-07·08은 4", () => {
    expect(aggregate(all, "2025-10")!.counts.점검).toBe(0);
    expect(aggregate(all, "2026-07")!.counts.점검).toBe(4);
    expect(aggregate(all, "2026-08")!.counts.점검).toBe(4);
  });
});

describe("현장별 (검산표 9월)", () => {
  const m = siteMetrics(all, "2026-09");
  it("12개 현장이 A~L 순으로 나옴", () => {
    expect(m.map((x) => x.siteId).join("")).toBe("ABCDEFGHIJKL");
  });
  it("D: 기성률 69.4% · 공정차이 -10.7pp · 점검 · 당월기성액 3,339.6", () => {
    const d = m.find((x) => x.siteId === "D")!;
    expect(fmtPct(d.earnedRate)).toBe("69.4%");
    expect(fmtPp(d.diff)).toBe("-10.7pp");
    expect(d.status).toBe("점검");
    expect(fmtMoney(d.monthlyEarned)).toBe("3,339.6");
  });
  it("H는 인력 배치 기록이 있어도 -1.8pp라 주의 (상태는 공정차이로만 판정)", () => {
    const h = m.find((x) => x.siteId === "H")!;
    expect(fmtPp(h.diff)).toBe("-1.8pp");
    expect(h.status).toBe("주의");
  });
  it("점검 순서 D(-10.7) → I(-7.6) → K(-5.4)", () => {
    const rank = inspectionRanking(m);
    expect(rank.map((x) => x.siteId)).toEqual(["D", "I", "K"]);
    expect(rank.map((x) => fmtPp(x.diff))).toEqual(["-10.7pp", "-7.6pp", "-5.4pp"]);
  });
  it("2025-10에는 점검 현장이 없음", () => {
    expect(inspectionRanking(siteMetrics(all, "2025-10"))).toHaveLength(0);
  });
  it("J의 7월 당월기성액은 0.0(정상값)", () => {
    const j = siteMetrics(all, "2026-07").find((x) => x.siteId === "J")!;
    expect(j.monthlyEarned).toBe(0);
    expect(fmtMoney(j.monthlyEarned)).toBe("0.0");
    expect(j.row.issueSummary).toContain("서류");
  });
  it("D의 최근 공정차이는 8월 -11.2pp → 9월 -10.7pp", () => {
    const aug = siteMetrics(all, "2026-08").find((x) => x.siteId === "D")!;
    expect(fmtPp(aug.diff)).toBe("-11.2pp");
  });
});

describe("상태 경계값", () => {
  it("정확히 0.0은 정상, 정확히 -5.0은 점검", () => {
    expect(statusOf(0)).toBe("정상");
    expect(statusOf(-5)).toBe("점검");
    expect(statusOf(-4.9999)).toBe("주의");
  });
  it("계획 70일 때 실제 70 → 정상, 65.1 → 주의, 65 → 점검", () => {
    expect(statusOf(70 - 70)).toBe("정상");
    expect(statusOf(65.1 - 70)).toBe("주의");
    expect(statusOf(65 - 70)).toBe("점검");
  });
  it("컴퓨터 계산 오차가 있어도 -5.0은 점검 (64.9 - 69.9)", () => {
    expect(statusOf(64.9 - 69.9)).toBe("점검");
  });
  it("-0.0은 0.0으로 표시", () => {
    expect(fmtPp(-0.04)).toBe("0.0pp");
    expect(fmtPp(0.05)).toBe("+0.1pp");
  });
});

describe("필터", () => {
  it("9월 인천: 113,211.9 / 185,100 = 61.2% (현장 2곳)", () => {
    const a = aggregate(scopeRows(all, filters({ region: "인천" })), "2026-09")!;
    expect(a.siteCount).toBe(2);
    expect(fmtMoney(a.earnedTotal)).toBe("113,211.9");
    expect(a.contractTotal).toBe(185100);
    expect(fmtPct(a.earnedRate)).toBe("61.2%");
  });
  it("인천·공동주택은 A·G 2곳", () => {
    const rows = scopeRows(all, filters({ region: "인천", projectType: "공동주택" }));
    expect(siteMetrics(rows, "2026-09").map((x) => x.siteId)).toEqual(["A", "G"]);
  });
  it("지역·유형·현장 선택 칸에는 고를 수 있는 값만 나옴", () => {
    const o = filterOptions(all, filters({ region: "인천", projectType: "공동주택" }));
    expect(o.sites.map((s) => s.siteId)).toEqual(["A", "G"]);
    expect(o.regions).toContain("인천");
    expect(o.projectTypes).toEqual(["공동주택"]);
    expect(o.months).toHaveLength(12);
  });
  it("지역·유형 선택 칸은 다른 선택 안에서 고를 수 있는 값만, 데이터설명서 순서로 나옴", () => {
    expect(filterOptions(all, filters()).regions).toEqual(["인천", "경기", "충남", "충북", "세종", "강원", "대전"]);
    expect(filterOptions(all, filters({ projectType: "공동주택" })).regions).toEqual(["인천", "경기", "강원"]);
    expect(filterOptions(all, filters({ region: "경기" })).projectTypes).toEqual(["공동주택", "물류시설", "업무시설"]);
  });
  it("지역을 바꿔 선택한 현장이 범위에서 빠지면 현장을 전체로 되돌림", () => {
    const prev = filters({ region: "인천", projectType: "공동주택", siteId: "A" });
    expect(applyFilterChange(all, prev, { region: "경기" }).siteId).toBe("전체");
  });
  it("현장이 범위 안에 있으면 유지", () => {
    const prev = filters({ region: "인천", siteId: "A" });
    expect(applyFilterChange(all, prev, { projectType: "공동주택" }).siteId).toBe("A");
  });
  it("자료가 없는 범위는 null(0%로 대신하지 않음)", () => {
    expect(aggregate(scopeRows(all, filters({ region: "인천", projectType: "물류시설" })), "2026-09")).toBeNull();
  });
});

describe("추이", () => {
  it("9월 선택 시 2025-10~2026-09 12개월", () => {
    const t = trend(all, "2026-09");
    expect(t).toHaveLength(12);
    expect(t[0].month).toBe("2025-10");
    expect(t[0].agg!.monthlyEarned).toBeNull();
    expect(t[11].agg!.monthlyEarned).toBeCloseTo(28878.7, 1);
  });
  it("2025-10 선택 시 1개월", () => {
    expect(trend(all, "2025-10")).toHaveLength(1);
  });
  it("D만 선택해도 매월 따로 집계", () => {
    const t = trend(scopeRows(all, filters({ siteId: "D" })), "2026-09");
    expect(fmtPct(t[11].agg!.earnedRate)).toBe("69.4%");
    expect(t[1].agg!.monthlyEarned).not.toBeNull();
  });
});
