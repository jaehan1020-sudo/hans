"use client";

import { useState } from "react";
import { MAX_QUESTION_LENGTH } from "@/lib/ai";
import { fmtPct, fmtPp } from "@/lib/format";
import { useDashboard } from "@/state/DashboardContext";
import { EmptyData } from "@/components/EmptyData";
import { FilterBar } from "@/components/FilterBar";
import { diffColor, StatusBadge } from "@/components/StatusBadge";

const EXAMPLES = ["D가 늦어진 원인과 대응은?", "K의 점검 이유와 기록된 대응은?", "실제 준공일·미수금은?"];

export default function AskPage() {
  const { rows, filters, ask, askAi } = useDashboard();
  const [text, setText] = useState("");

  if (!rows) return <EmptyData context="AI에게 묻으려면 자료가 필요합니다." />;

  const loading = ask.status === "loading";
  const send = (q: string) => {
    const question = q.trim();
    if (!question || loading) return;
    setText(question);
    void askAi(question);
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-xl border border-border-default bg-surface-card p-5">
        <div className="text-sm font-bold">현재 분석 범위</div>
        <p className="mt-1 text-sm" data-testid="ask-scope">
          {filters.month} · {filters.region === "전체" ? "전체 지역" : filters.region} ·{" "}
          {filters.projectType === "전체" ? "전체 유형" : filters.projectType} ·{" "}
          {filters.siteId === "전체" ? "전체 현장" : `현장 ${filters.siteId}`}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          계산은 프로그램이 하고, AI는 그 숫자와 현장에 기록된 상황·대응 계획을 근거로 설명합니다. 범위를 바꾸면 이전 답변은 지워집니다.
        </p>
      </section>

      <FilterBar />

      <section aria-label="예시 질문">
        <div className="mb-2 text-xs font-semibold text-text-secondary">예시 질문</div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {EXAMPLES.map((q) => (
            <button
              key={q}
              type="button"
              disabled={loading}
              onClick={() => send(q)}
              className="rounded-xl border border-border-default bg-surface-card px-4 py-3 text-left text-sm font-medium hover:border-brand disabled:opacity-50"
            >
              &ldquo;{q}&rdquo;
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-border-default bg-surface-card p-5" aria-live="polite" data-testid="ask-result">
        {ask.status === "idle" && (
          <p className="text-sm text-text-secondary">예시 질문을 누르거나 아래에 질문을 입력하세요.</p>
        )}

        {ask.status !== "idle" && (
          <div className="mb-4 ml-auto w-fit max-w-[80%] rounded-xl bg-text-primary px-4 py-2 text-sm font-semibold text-white">
            {ask.question}
          </div>
        )}

        {ask.status === "loading" && (
          <div className="flex items-center gap-3 rounded-lg bg-surface-subtle p-4 text-sm" data-testid="state-ai-loading">
            <span aria-hidden="true" className="material-symbols-outlined animate-spin">progress_activity</span>
            <div>
              <div className="font-bold">AI 답변 기다리는 중…</div>
              <div className="text-xs text-text-secondary">대시보드는 계속 쓸 수 있습니다.</div>
            </div>
          </div>
        )}

        {ask.status === "error" && (
          <div
            className="rounded-lg border border-status-critical-border bg-status-critical-bg p-4"
            role="alert"
            data-testid="state-ai-error"
          >
            <div className="text-sm font-bold text-status-critical">AI 연결 실패</div>
            <div className="mt-1 text-sm">{ask.message}</div>
            <div className="mt-2 text-xs text-text-secondary">대시보드와 CSV는 계속 쓸 수 있습니다.</div>
          </div>
        )}

        {ask.status === "done" && (
          <article data-testid="ai-answer">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border-default pb-3 text-sm">
              <span>
                기준 월: <b className="num" data-testid="answer-month">{ask.answer.baseMonth}</b>
              </span>
              <span>
                근거 현장:{" "}
                <b className="num" data-testid="answer-sites">
                  {ask.answer.evidence.length > 0 ? ask.answer.evidence.map((e) => e.siteId).join(", ") : "없음"}
                </b>
              </span>
              {ask.answer.mock && (
                <span
                  className="rounded-full border border-status-caution-border bg-status-caution-bg px-2.5 py-0.5 text-xs font-semibold text-status-caution"
                  data-testid="badge-mock"
                >
                  모의 응답
                </span>
              )}
            </div>

            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed" data-testid="answer-text">
              {ask.answer.answer}
            </p>

            {ask.answer.notInData && (
              <p
                className="mt-3 rounded-lg border border-status-caution-border bg-status-caution-bg px-3 py-2 text-sm text-status-caution"
                data-testid="answer-not-in-data"
              >
                자료 없음: 이 질문의 답은 가져온 자료에 없습니다. 계약상 준공일은 예정일이며 실제 완료일이 아닙니다.
              </p>
            )}

            {ask.answer.evidence.length > 0 && (
              <div className="mt-4">
                <div className="mb-1 text-xs font-semibold text-text-secondary">근거 숫자 (프로그램이 계산)</div>
                <div className="overflow-x-auto rounded-lg border border-border-default">
                  <table className="w-full text-sm" data-testid="evidence-table">
                    <thead className="bg-surface-subtle text-xs text-text-secondary">
                      <tr>
                        <th className="px-3 py-2 text-left">현장</th>
                        <th className="px-3 py-2 text-left">월</th>
                        <th className="px-3 py-2 text-right">계획</th>
                        <th className="px-3 py-2 text-right">실제</th>
                        <th className="px-3 py-2 text-right">공정차이</th>
                        <th className="px-3 py-2 text-right">기성률</th>
                        <th className="px-3 py-2 text-left">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ask.answer.evidence.map((e) => (
                        <tr key={`${e.siteId}${e.month}`} className="border-t border-border-default">
                          <td className="px-3 py-2 font-bold">
                            {e.siteId} <span className="font-normal text-text-secondary">{e.siteName}</span>
                          </td>
                          <td className="num px-3 py-2">{e.month}</td>
                          <td className="num px-3 py-2 text-right">{fmtPct(e.planned)}</td>
                          <td className="num px-3 py-2 text-right">{fmtPct(e.actual)}</td>
                          <td className={`num px-3 py-2 text-right font-bold ${diffColor(e.status)}`}>{fmtPp(e.diff)}</td>
                          <td className="num px-3 py-2 text-right">{fmtPct(e.earnedRate)}</td>
                          <td className="px-3 py-2">
                            <StatusBadge status={e.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {ask.answer.records.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2" data-testid="answer-records">
                {ask.answer.records.flatMap((rec) =>
                  rec.fields.map((f) => (
                    <div key={`${rec.siteId}${rec.month}${f.field}`} className="rounded-lg border border-border-default p-3">
                      <div className="text-xs font-semibold text-text-secondary">
                        {f.label} · {rec.siteId} · {rec.month}
                      </div>
                      <p className="mt-1 text-sm">{f.text}</p>
                    </div>
                  )),
                )}
              </div>
            )}
          </article>
        )}
      </section>

      <form
        className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-card p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="ask-input" className="text-xs font-semibold text-text-secondary">
          질문 입력 (최대 {MAX_QUESTION_LENGTH}자)
        </label>
        <div className="flex gap-3">
          <input
            id="ask-input"
            type="text"
            value={text}
            maxLength={MAX_QUESTION_LENGTH}
            onChange={(e) => setText(e.target.value)}
            placeholder="현황 숫자와 현장 기록에 대해 질문하세요 (예: K 현장 점검 이유는?)"
            className="min-w-0 flex-1 rounded-lg border border-border-strong px-3 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={loading || text.trim() === ""}
            className="inline-flex items-center gap-2 rounded-lg bg-text-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            전송
            <span aria-hidden="true" className="material-symbols-outlined">send</span>
          </button>
        </div>
        <p className="text-xs text-text-secondary">
          AI 연결이 안 되어도 대시보드와 CSV는 계속 쓸 수 있습니다. 실제 준공일·미수금처럼 자료에 없는 내용은 &ldquo;자료 없음&rdquo;으로 답합니다.
        </p>
      </form>
    </div>
  );
}
