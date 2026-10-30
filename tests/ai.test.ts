import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "../src/app/api/ask/route";
import { buildAiContext, buildAnswer, buildUserPrompt, parseAiText } from "../src/lib/ai";
import { scopeRows } from "../src/lib/calc";
import { filters, loadRows } from "./helpers";

const all = loadRows("csv");

function inScope(f = filters()) {
  return scopeRows(all, f).filter((r) => r.month <= f.month);
}

function req(body: unknown, raw = false) {
  return new Request("http://localhost/api/ask", {
    method: "POST",
    body: raw ? (body as string) : JSON.stringify(body),
  });
}

function payload(question: string, f = filters()) {
  return { question, scope: f, rows: inScope(f) };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("AI에 보낼 자료 구성", () => {
  it("원문 기록과 프로그램이 계산한 요약을 구분해서 담는다", () => {
    const ctx = buildAiContext(inScope(), filters());
    expect(ctx.rawRecords).toHaveLength(12);
    expect(ctx.rawRecords[0]).toHaveProperty("issueSummary");
    expect(ctx.computed.overall?.earnedRate).toBe(67.2);
    expect(ctx.computed.overall?.diff).toBe(-2);
    expect(ctx.computed.inspectionOrder).toEqual(["D", "I", "K"]);
    expect(ctx.monthlySummary).toHaveLength(12);
    expect(ctx.monthlySummary[0].monthlyEarned).toBe("계산 불가");
    expect(ctx.siteHistory).toBeUndefined();
  });
  it("현장을 하나 고르면 그 현장의 월별 기록도 담는다", () => {
    const f = filters({ siteId: "D" });
    const ctx = buildAiContext(inScope(f), f);
    expect(ctx.siteHistory).toHaveLength(12);
    expect(ctx.rawRecords).toHaveLength(1);
  });
  it("선택 월 이후의 자료는 보내지 않는다", () => {
    const f = filters({ month: "2026-03" });
    const ctx = buildAiContext(inScope(f), f);
    expect(ctx.monthlySummary).toHaveLength(6);
  });
  it("프롬프트에서 계산 요약과 원문 기록이 따로 표시되고 자료 구역으로 감싸진다", () => {
    const p = buildUserPrompt("D가 늦어진 원인과 대응은?", filters(), inScope());
    expect(p).toContain("[프로그램이 계산한 요약]");
    expect(p).toContain("[원문 기록]");
    expect(p.match(/<자료>/g)).toHaveLength(2);
  });
});

describe("AI 답변 읽기와 근거 확인", () => {
  it("JSON 답변을 읽는다", () => {
    const raw = parseAiText('{"answer":"설명","references":[{"siteId":"D","month":"2026-09","fields":["issueSummary"]}],"notInData":false}');
    expect(raw.answer).toBe("설명");
    expect(raw.references).toHaveLength(1);
  });
  it("JSON이 아니면 글 전체를 답변으로 쓴다", () => {
    expect(parseAiText("그냥 글입니다").answer).toBe("그냥 글입니다");
  });
  it("보낸 범위 밖의 현장·월을 인용하면 근거로 표시하지 않는다", () => {
    const f = filters({ siteId: "D" });
    const raw = {
      answer: "x",
      notInData: false,
      references: [
        { siteId: "A", month: "2026-09", fields: ["issueSummary" as const] },
        { siteId: "D", month: "2026-10", fields: ["issueSummary" as const] },
        { siteId: "D", month: "2026-09", fields: ["issueSummary" as const, "hack" as never] },
      ],
    };
    const a = buildAnswer(raw, f, inScope(f), false);
    expect(a.evidence.map((e) => e.siteId + e.month)).toEqual(["D2026-09"]);
    expect(a.records).toHaveLength(1);
    expect(a.records[0].fields.map((x) => x.field)).toEqual(["issueSummary"]);
  });
  it("근거 숫자는 프로그램이 계산한 값 (D 계획 86.5 · 실제 75.8 · -10.7pp · 기성률 69.4%)", () => {
    const a = buildAnswer(
      { answer: "x", notInData: false, references: [{ siteId: "D", month: "2026-09", fields: ["issueSummary"] }] },
      filters(),
      inScope(),
      false,
    );
    const e = a.evidence[0];
    expect(e.planned).toBe(86.5);
    expect(e.actual).toBe(75.8);
    expect(e.diff).toBeCloseTo(-10.7, 6);
    expect(e.earnedRate!).toBeCloseTo(69.4, 1);
    expect(e.status).toBe("점검");
  });
});

describe("AI 요청 창구 /api/ask", () => {
  it("모의 응답: 'D가 늦어진 원인과 대응은?' → 기록대로 설명, '모의 응답' 표시", async () => {
    vi.stubEnv("AI_MOCK", "1");
    const res = await POST(req(payload("D가 늦어진 원인과 대응은?")));
    const j = await res.json();
    expect(res.status).toBe(200);
    expect(j.mock).toBe(true);
    expect(j.baseMonth).toBe("2026-09");
    expect(j.answer).toContain("기록된 상황");
    expect(j.answer).toContain("계획된 대응");
    expect(j.evidence[0].siteId).toBe("D");
    expect(j.records[0].fields.map((x: { label: string }) => x.label)).toEqual(["기록된 상황", "계획된 대응"]);
    const d = all.find((r) => r.month === "2026-09" && r.siteId === "D")!;
    expect(j.records[0].fields[0].text).toBe(d.issueSummary);
  });
  it("모의 응답: 실제 준공일·미수금은 자료 없음, 계약상 준공일과 구분", async () => {
    vi.stubEnv("AI_MOCK", "1");
    const j = await (await POST(req(payload("실제 준공일·미수금은?")))).json();
    expect(j.notInData).toBe(true);
    expect(j.answer).toContain("알 수 없");
    expect(j.answer).toContain("계약상 준공일");
    expect(j.answer).toContain("실제 완료일이 아닙니다");
  });
  it("키가 없으면 AI 연결 실패 신호(503)", async () => {
    vi.stubEnv("AI_MOCK", "");
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await POST(req(payload("D가 늦어진 원인과 대응은?")));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("no_key");
  });
  it("질문이 500자를 넘으면 거부", async () => {
    vi.stubEnv("AI_MOCK", "1");
    const res = await POST(req(payload("가".repeat(501))));
    expect(res.status).toBe(400);
  });
  it("질문이 비어 있으면 거부", async () => {
    vi.stubEnv("AI_MOCK", "1");
    expect((await POST(req(payload("   ")))).status).toBe(400);
  });
  it("자료 행이 검사를 통과하지 못하면 거부", async () => {
    vi.stubEnv("AI_MOCK", "1");
    const p = payload("D?");
    p.rows = p.rows.map((r) => ({ ...r })); // 다른 검사가 쓰는 원본 객체를 바꾸지 않도록 복사
    p.rows[0].actualProgress = 101;
    expect((await POST(req(p))).status).toBe(400);
  });
  it("요청이 너무 크면 거부(413)", async () => {
    vi.stubEnv("AI_MOCK", "1");
    const res = await POST(req("x".repeat(210_000), true));
    expect(res.status).toBe(413);
  });
  it("실제 호출 경로: Gemini 응답을 읽어 근거를 붙이고, 키는 헤더로만 보낸다 (가짜 서버)", async () => {
    vi.stubEnv("AI_MOCK", "");
    vi.stubEnv("GEMINI_API_KEY", "TEST_KEY_NOT_REAL");
    const fetchMock = vi.fn(async () =>
      Response.json({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: "기록된 상황을 설명합니다.",
                    references: [{ siteId: "D", month: "2026-09", fields: ["issueSummary", "actionPlan"] }],
                    notInData: false,
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await POST(req(payload("D가 늦어진 원인과 대응은?")));
    const j = await res.json();
    expect(j.mock).toBe(false);
    expect(j.evidence[0].siteId).toBe("D");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("gemini-3.8-flash:generateContent");
    expect(url).not.toContain("TEST_KEY_NOT_REAL");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("TEST_KEY_NOT_REAL");
    expect(JSON.stringify(j)).not.toContain("TEST_KEY_NOT_REAL");
  });
  it("Gemini가 오류를 돌려주면 502, 응답에 키·세부 내용이 없다", async () => {
    vi.stubEnv("AI_MOCK", "");
    vi.stubEnv("GEMINI_API_KEY", "TEST_KEY_NOT_REAL");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("secret detail", { status: 500 })));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(payload("D?")));
    const text = await res.text();
    expect(res.status).toBe(502);
    expect(text).not.toContain("secret detail");
    expect(text).not.toContain("TEST_KEY_NOT_REAL");
    spy.mockRestore();
  });
  it("한도 초과(429)는 별도 안내", async () => {
    vi.stubEnv("AI_MOCK", "");
    vi.stubEnv("GEMINI_API_KEY", "TEST_KEY_NOT_REAL");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("quota", { status: 429 })));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await POST(req(payload("D?")));
    expect(res.status).toBe(502);
    expect((await res.json()).message).toContain("한도");
    spy.mockRestore();
  });
  it("시간 초과 신호(AbortError)는 504", async () => {
    vi.stubEnv("AI_MOCK", "");
    vi.stubEnv("GEMINI_API_KEY", "TEST_KEY_NOT_REAL");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const e = new Error("aborted");
        e.name = "AbortError";
        throw e;
      }),
    );
    const res = await POST(req(payload("D?")));
    expect(res.status).toBe(504);
    expect((await res.json()).error).toBe("timeout");
  });
});
