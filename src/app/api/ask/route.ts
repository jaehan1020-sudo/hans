import {
  AI_TIMEOUT_MS,
  GEMINI_MODEL,
  MAX_BODY_BYTES,
  MAX_QUESTION_LENGTH,
  MAX_ROWS,
  RESPONSE_SCHEMA,
  SYSTEM_INSTRUCTION,
  buildAnswer,
  buildUserPrompt,
  mockAiAnswer,
  parseAiText,
} from "@/lib/ai";
import { scopeRows } from "@/lib/calc";
import { ALL, type Filters } from "@/lib/types";
import { validateRowObjects } from "@/lib/validate";

export const runtime = "nodejs";
export const maxDuration = 30;

type ErrorCode = "bad_request" | "too_large" | "no_key" | "timeout" | "ai_failed";

function fail(status: number, error: ErrorCode, message: string) {
  return Response.json({ ok: false, error, message }, { status });
}

function asScope(v: unknown): Filters | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const month = o.month;
  if (typeof month !== "string" || !/^\d{4}-\d{2}$/.test(month)) return null;
  const pick = (x: unknown) => (typeof x === "string" && x.length > 0 && x.length <= 20 ? x : ALL);
  return { month, region: pick(o.region), projectType: pick(o.projectType), siteId: pick(o.siteId) };
}

export async function POST(req: Request) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    return fail(413, "too_large", "보낸 자료가 너무 큽니다.");

  let body: { question?: unknown; scope?: unknown; rows?: unknown };
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "bad_request", "요청 형식이 올바르지 않습니다.");
  }

  const question = typeof body.question === "string" ? body.question.trim() : "";
  if (question === "") return fail(400, "bad_request", "질문을 입력하세요.");
  if (question.length > MAX_QUESTION_LENGTH)
    return fail(400, "bad_request", `질문은 ${MAX_QUESTION_LENGTH}자까지 입력할 수 있습니다.`);

  const scope = asScope(body.scope);
  if (!scope) return fail(400, "bad_request", "범위 정보가 올바르지 않습니다.");
  if (!Array.isArray(body.rows) || body.rows.length === 0 || body.rows.length > MAX_ROWS)
    return fail(400, "bad_request", "자료 행이 올바르지 않습니다.");

  const checked = validateRowObjects(body.rows);
  if (!checked.ok) return fail(400, "bad_request", "자료 행이 검사를 통과하지 못했습니다.");

  // 보낸 행 중 선택 월까지, 같은 범위의 행만 사용합니다.
  const rowsInScope = scopeRows(checked.rows, scope).filter((r) => r.month <= scope.month);
  if (rowsInScope.length === 0) return fail(400, "bad_request", "선택한 범위에 자료가 없습니다.");

  if (process.env.AI_MOCK === "1") {
    const raw = mockAiAnswer(question, scope, rowsInScope);
    return Response.json({ ok: true, ...buildAnswer(raw, scope, rowsInScope, true) });
  }

  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return fail(503, "no_key", "AI 연결 설정(API 키)이 없습니다.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
          contents: [{ role: "user", parts: [{ text: buildUserPrompt(question, scope, rowsInScope) }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) {
      // 오류 내용에 키나 요청 내용이 섞일 수 있어 상태 번호만 남기고 자세한 내용은 돌려주지 않습니다.
      console.error(`Gemini API 오류: HTTP ${res.status}`);
      return fail(502, "ai_failed", res.status === 429 ? "AI 사용 한도를 넘었습니다." : "AI 연결에 실패했습니다.");
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const answerText = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    if (answerText.trim() === "") return fail(502, "ai_failed", "AI가 빈 답변을 돌려주었습니다.");
    return Response.json({ ok: true, ...buildAnswer(parseAiText(answerText), scope, rowsInScope, false) });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return fail(504, "timeout", "AI 응답 시간이 30초를 넘었습니다.");
    console.error("Gemini API 호출 실패");
    return fail(502, "ai_failed", "AI 연결에 실패했습니다.");
  } finally {
    clearTimeout(timer);
  }
}
