import { describe, expect, it } from "vitest";
import { parseCsvText } from "../src/lib/parse";
import { buildCsv } from "../src/lib/exportCsv";
import { filters, importFile, loadRows, readData } from "./helpers";

describe("정상 파일 가져오기", () => {
  it("CSV 144행·12개 현장·15개 열", () => {
    const res = importFile("현장공정기성.csv", readData("현장공정기성.csv"));
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(144);
    expect(new Set(res.rows.map((r) => r.siteId)).size).toBe(12);
    expect(res.format).toBe("csv");
    expect(res.notice).toContain("메타데이터가 없어서");
  });
  it("JSON 144행, metadata 확인", () => {
    const res = importFile("현장공정기성.json", readData("현장공정기성.json"));
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(144);
    expect(res.notice).toContain("schemaVersion 2.0");
  });
  it("CSV와 JSON을 차례로 가져와도 144행 (교체 방식, 누적 아님)", () => {
    // 가져오기는 '이어 붙이기'가 아니라 검사 통과한 행 전체로 교체합니다.
    let current = loadRows("csv");
    current = loadRows("json");
    expect(current).toHaveLength(144);
  });
  it("CSV와 JSON의 값이 같다", () => {
    const a = loadRows("csv");
    const b = loadRows("json");
    expect(b).toEqual(a);
  });
  it("month는 문자열, siteId는 문자로 읽는다", () => {
    const r = loadRows("csv")[0];
    expect(typeof r.month).toBe("string");
    expect(r.month).toBe("2025-10");
    expect(r.siteId).toBe("A");
    expect(typeof r.contractAmount).toBe("number");
  });
});

describe("오류 파일 3종은 모두 거부 (data/검증용_오류데이터)", () => {
  it("오류_중복키.csv: 146행 중복 키", () => {
    const res = importFile("오류_중복키.csv", readData("검증용_오류데이터", "오류_중복키.csv"));
    expect(res.ok).toBe(false);
    expect(res.rows).toHaveLength(0);
    expect(res.errorCount).toBe(1);
    expect(res.errors[0].row).toBe(146);
    expect(res.errors[0].message).toContain("중복");
  });
  it("오류_공정률101.csv: 134행 actualProgress 범위", () => {
    const res = importFile("오류_공정률101.csv", readData("검증용_오류데이터", "오류_공정률101.csv"));
    expect(res.ok).toBe(false);
    expect(res.errorCount).toBe(1);
    expect(res.errors[0].row).toBe(134);
    expect(res.errors[0].column).toBe("actualProgress");
    expect(res.errors[0].message).toContain("0~100");
  });
  it("오류_공정률빈값.csv: 134행 빈 값을 0으로 바꾸지 않고 오류", () => {
    const res = importFile("오류_공정률빈값.csv", readData("검증용_오류데이터", "오류_공정률빈값.csv"));
    expect(res.ok).toBe(false);
    expect(res.errorCount).toBe(1);
    expect(res.errors[0].row).toBe(134);
    expect(res.errors[0].column).toBe("actualProgress");
    expect(res.errors[0].message).toContain("비어");
  });
});

describe("그 밖의 검사 항목", () => {
  const good = readData("현장공정기성.csv");
  const lines = good.replace(/^﻿/, "").split(/\r?\n/).filter(Boolean);
  const header = lines[0];

  it("열이 빠지면 거부", () => {
    const noCol = header.replace(",actionPlan", "");
    const res = importFile("x.csv", [noCol, ...lines.slice(1)].join("\n"));
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.column === "actionPlan")).toBe(true);
  });
  it("숫자가 아닌 값(abc)은 거부", () => {
    const row = lines[1].split(",");
    row[3] = "abc";
    const res = importFile("x.csv", [header, row.join(","), ...lines.slice(2)].join("\n"));
    expect(res.ok).toBe(false);
    expect(res.errors[0].column).toBe("contractAmount");
  });
  it("누적 공정률이 줄어들면 거부", () => {
    const idx = lines.findIndex((l) => l.startsWith("2026-09,A,"));
    const row = lines[idx].split(",");
    row[5] = "1";
    const res = importFile("x.csv", [...lines.slice(0, idx), row.join(","), ...lines.slice(idx + 1)].join("\n"));
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.message.includes("줄었습니다"))).toBe(true);
  });
  it("같은 현장의 계약금액이 달라지면 거부", () => {
    const idx = lines.findIndex((l) => l.startsWith("2026-09,A,"));
    const row = lines[idx].split(",");
    row[3] = "90000";
    const res = importFile("x.csv", [...lines.slice(0, idx), row.join(","), ...lines.slice(idx + 1)].join("\n"));
    expect(res.ok).toBe(false);
    expect(res.errors.some((e) => e.column === "contractAmount")).toBe(true);
  });
  it("오류가 10건을 넘으면 10건만 보여주고 전체 건수를 센다", () => {
    const broken = lines.map((l, i) => {
      if (i === 0 || i > 12) return l;
      const c = l.split(",");
      c[4] = "999";
      return c.join(",");
    });
    const res = importFile("x.csv", broken.join("\n"));
    expect(res.ok).toBe(false);
    expect(res.errors.length).toBe(10);
    expect(res.errorCount).toBeGreaterThan(10);
  });
  it("JSON metadata의 단위가 다르면 거부", () => {
    const j = JSON.parse(readData("현장공정기성.json"));
    j.metadata.moneyUnit = "원";
    const res = importFile("x.json", JSON.stringify(j));
    expect(res.ok).toBe(false);
    expect(res.errors[0].column).toBe("metadata.moneyUnit");
  });
  it("JSON 형식이 깨지면 거부", () => {
    const res = importFile("x.json", "{ not json");
    expect(res.ok).toBe(false);
  });
  it("월 하나가 통째로 빠지면 오류가 아니라 경고", () => {
    const kept = lines.filter((l, i) => i === 0 || !l.startsWith("2026-03,"));
    const res = importFile("x.csv", kept.join("\n"));
    expect(res.ok).toBe(true);
    expect(res.rows).toHaveLength(132);
    expect(res.warnings.length).toBe(1);
  });
  it("따옴표 안의 쉼표·줄바꿈·큰따옴표를 읽는다", () => {
    const t = parseCsvText('a,b\r\n"x,1","y\nz ""q"""\r\n');
    expect(t).toEqual([
      ["a", "b"],
      ["x,1", 'y\nz "q"'],
    ]);
  });
});

describe("CSV 내보내기", () => {
  const all = loadRows("csv");
  const body = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

  it("9월 D만: 데이터 1행, 끝 4개 열 69.4 · -10.7 · 점검 · 3339.6", () => {
    const out = buildCsv(all, filters({ siteId: "D" }));
    const lines = body(out.content);
    expect(out.dataRows).toBe(1);
    expect(lines).toHaveLength(2);
    expect(lines[0].endsWith("기성률(%),공정차이(pp),상태,당월기성액(백만원)")).toBe(true);
    expect(lines[1].endsWith("69.4,-10.7,점검,3339.6")).toBe(true);
    expect(out.fileName).toBe("현장공정기성_2026-09_D.csv");
  });
  it("9월 인천·공동주택: 데이터 2행 (A·G)", () => {
    const out = buildCsv(all, filters({ region: "인천", projectType: "공동주택" }));
    expect(out.dataRows).toBe(2);
    expect(body(out.content)).toHaveLength(3);
  });
  it("UTF-8 BOM으로 시작하고 원본 15개 열 + 추가 4개 열", () => {
    const out = buildCsv(all, filters());
    expect(out.content.charCodeAt(0)).toBe(0xfeff);
    expect(out.dataRows).toBe(12);
    expect(body(out.content)[0].split(",")).toHaveLength(19);
  });
  it("2025-10은 당월기성액 칸에 '계산 불가'를 적고 0·빈칸으로 바꾸지 않음", () => {
    const out = buildCsv(all, filters({ month: "2025-10", siteId: "D" }));
    expect(body(out.content)[1].endsWith(",계산 불가")).toBe(true);
  });
  it("범위에 행이 없으면 데이터 0행", () => {
    expect(buildCsv(all, filters({ region: "인천", projectType: "물류시설" })).dataRows).toBe(0);
  });
  it("내보낸 CSV를 다시 읽으면 같은 값(따옴표 처리 포함)", () => {
    const out = buildCsv(all, filters({ month: "2026-07", siteId: "J" }));
    const t = parseCsvText(out.content);
    expect(t).toHaveLength(2);
    expect(t[1][1]).toBe("J");
    expect(t[1][t[1].length - 1]).toBe("0.0");
  });
});
