"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { fmtAmount, fmtPct } from "@/lib/format";
import { parseFileText } from "@/lib/parse";
import { validateParsed, type ValidationResult } from "@/lib/validate";
import { useDashboard } from "@/state/DashboardContext";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

interface Checked {
  fileName: string;
  result: ValidationResult;
}

export default function ImportPage() {
  const router = useRouter();
  const { rows, info, replaceData } = useDashboard();
  const inputRef = useRef<HTMLInputElement>(null);
  const [checked, setChecked] = useState<Checked | null>(null);
  const [fileProblem, setFileProblem] = useState<string | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function handleFile(file: File | undefined) {
    setCancelled(false);
    setFileProblem(null);
    setChecked(null);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileProblem("파일이 10MB를 넘습니다. 지금 자료는 그대로 유지됩니다.");
      return;
    }
    const text = await file.text();
    const parsed = parseFileText(file.name, text);
    if ("unsupported" in parsed) {
      setFileProblem("CSV 또는 JSON 파일만 가져올 수 있습니다. 지금 자료는 그대로 유지됩니다.");
      return;
    }
    setChecked({ fileName: file.name, result: validateParsed(parsed) });
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    void handleFile(file);
    // 같은 파일을 다시 골라도 반응하도록 선택값을 비웁니다.
    e.target.value = "";
  }

  function apply() {
    if (!checked || !checked.result.ok) return;
    replaceData(checked.result.rows, {
      fileName: checked.fileName,
      format: checked.result.format,
      rowCount: checked.result.rows.length,
    });
    setChecked(null);
    router.push("/");
  }

  function cancel() {
    setChecked(null);
    setFileProblem(null);
    setCancelled(true);
  }

  const res = checked?.result;
  const sites = res?.ok ? new Set(res.rows.map((r) => r.siteId)).size : 0;
  const months = res?.ok ? Array.from(new Set(res.rows.map((r) => r.month))).sort() : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-bold">자료 가져오기 및 검증</h2>
        <p className="mt-1 text-sm text-text-secondary">
          CSV 또는 JSON 파일을 고르면 먼저 검사하고 미리 보여 줍니다. &ldquo;가져오기&rdquo;를 눌러야 지금 자료가 새 자료 전체로 바뀝니다.
          오류가 있거나 취소하면 지금 자료는 그대로입니다.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(300px,2fr)_3fr]">
        <div className="rounded-xl border border-border-default bg-surface-card p-5">
          <h3 className="text-sm font-bold">1. 파일 고르기</h3>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void handleFile(e.dataTransfer.files?.[0]);
            }}
            className={`mt-3 flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center ${
              dragging ? "border-brand bg-brand-soft" : "border-border-strong"
            }`}
          >
            <span aria-hidden="true" className="material-symbols-outlined text-text-muted" style={{ fontSize: 36 }}>
              cloud_upload
            </span>
            <p className="text-sm">파일을 끌어다 놓거나 아래 버튼으로 고르세요</p>
            <p className="text-xs text-text-secondary">.csv 또는 .json (최대 10MB)</p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json"
              onChange={onInputChange}
              className="sr-only"
              id="file-input"
              data-testid="file-input"
            />
            <label
              htmlFor="file-input"
              className="mt-1 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-text-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              <span aria-hidden="true" className="material-symbols-outlined">search</span>
              파일 찾아보기
            </label>
          </div>
          <div className="mt-4 rounded-lg bg-surface-subtle p-3 text-xs text-text-secondary" data-testid="current-data">
            {rows && info ? (
              <>
                지금 자료: <b className="num">{info.fileName}</b> · {info.rowCount}행. 가져오기를 누르면 이 자료가 새 파일의 자료
                전체로 바뀝니다(이어 붙이지 않습니다).
              </>
            ) : (
              <>지금 자료: 없음.</>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border-default bg-surface-card p-5">
          <h3 className="text-sm font-bold">2. 검사 결과</h3>
          {!checked && !fileProblem && !cancelled && (
            <p className="mt-3 text-sm text-text-secondary" data-testid="import-idle">
              파일을 고르면 여기에 검사 결과가 나옵니다.
            </p>
          )}
          {cancelled && (
            <p className="mt-3 rounded-lg bg-surface-subtle p-3 text-sm" role="status" data-testid="import-cancelled">
              가져오기를 취소했습니다. 지금 자료는 그대로 유지됩니다.
            </p>
          )}
          {fileProblem && (
            <div
              className="mt-3 rounded-lg border border-status-critical-border bg-status-critical-bg p-4 text-sm text-status-critical"
              role="alert"
              data-testid="import-error"
            >
              {fileProblem}
            </div>
          )}
          {checked && res && !res.ok && (
            <div
              className="mt-3 rounded-lg border border-status-critical-border bg-status-critical-bg p-4"
              role="alert"
              data-testid="import-error"
            >
              <div className="text-sm font-bold text-status-critical">
                {checked.fileName}: 오류 {res.errorCount}건 — 가져올 수 없습니다
              </div>
              <ul className="mt-2 flex flex-col gap-1 text-sm">
                {res.errors.map((e, i) => (
                  <li key={i} data-testid="import-error-item">
                    <b className="num">
                      {e.row !== null ? `${e.row}행` : "파일 전체"}
                      {e.column ? ` · ${e.column}` : ""}
                    </b>
                    {" — "}
                    {e.message}
                  </li>
                ))}
              </ul>
              {res.errorCount > res.errors.length && (
                <p className="mt-1 text-sm" data-testid="import-error-more">
                  외 {res.errorCount - res.errors.length}건
                </p>
              )}
              <p className="mt-3 text-sm font-semibold text-text-primary">
                지금 자료는 그대로 유지됩니다.
                {rows && info ? ` (${info.fileName} · ${info.rowCount}행)` : ""}
              </p>
              <p className="mt-1 text-xs text-text-secondary">
                행 번호는 파일에서 보이는 번호입니다(CSV는 헤더가 1행, JSON은 records의 순서).
              </p>
            </div>
          )}
          {checked && res && res.ok && (
            <div className="mt-3" data-testid="import-ok">
              <div className="rounded-lg border border-status-normal-border bg-status-normal-bg px-3 py-2 text-sm font-semibold text-status-normal">
                검사 통과 · {checked.fileName}
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div className="rounded-lg bg-surface-subtle p-3">
                  <dt className="text-xs text-text-secondary">행 수</dt>
                  <dd className="num text-lg font-bold" data-testid="preview-rows">
                    {res.rows.length}행
                  </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                  <dt className="text-xs text-text-secondary">현장 수</dt>
                  <dd className="num text-lg font-bold" data-testid="preview-sites">
                    {sites}개 현장
                  </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                  <dt className="text-xs text-text-secondary">월 범위</dt>
                  <dd className="num text-lg font-bold" data-testid="preview-months">
                    {months[0]}~{months[months.length - 1]}
                  </dd>
                </div>
                <div className="rounded-lg bg-surface-subtle p-3">
                  <dt className="text-xs text-text-secondary">오류</dt>
                  <dd className="num text-lg font-bold">0건</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-text-secondary" data-testid="import-notice">
                {res.notice}
              </p>
              {res.warnings.map((w, i) => (
                <p
                  key={i}
                  className="mt-2 rounded-lg border border-status-caution-border bg-status-caution-bg px-3 py-2 text-xs text-status-caution"
                  data-testid="import-warning"
                >
                  경고: {w}
                </p>
              ))}
            </div>
          )}
        </div>
      </section>

      {checked && res && res.ok && (
        <>
          <section className="rounded-xl border border-border-default bg-surface-card" aria-labelledby="preview-title">
            <div className="border-b border-border-default px-5 py-4">
              <h3 id="preview-title" className="text-sm font-bold">
                3. 미리보기 (처음 5행)
              </h3>
              <p className="text-xs text-text-secondary">
                전체 {res.rows.length}행 중 처음 5행입니다. 가져오기를 누르면 전체 {res.rows.length}행으로 바뀝니다.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="preview-table">
                <thead className="bg-surface-subtle text-xs text-text-secondary">
                  <tr>
                    {["월", "현장", "현장명", "지역/유형", "계약금액(백만원)", "계획 공정률", "실제 공정률", "누적기성액(백만원)"].map((h, i) => (
                      <th key={h} className={`px-3 py-2 font-semibold ${i >= 4 ? "text-right" : "text-left"}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {res.rows.slice(0, 5).map((r) => (
                    <tr key={`${r.month}${r.siteId}`} className="border-t border-border-default">
                      <td className="num px-3 py-2">{r.month}</td>
                      <td className="px-3 py-2 font-bold">{r.siteId}</td>
                      <td className="px-3 py-2">{r.siteName}</td>
                      <td className="px-3 py-2">
                        {r.region} / {r.projectType}
                      </td>
                      <td className="num px-3 py-2 text-right">{fmtAmount(r.contractAmount)}</td>
                      <td className="num px-3 py-2 text-right">{fmtPct(r.plannedProgress)}</td>
                      <td className="num px-3 py-2 text-right">{fmtPct(r.actualProgress)}</td>
                      <td className="num px-3 py-2 text-right">{r.cumulativeEarned.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border-default bg-surface-card p-5">
            <div>
              <div className="text-sm font-bold">검증된 자료를 가져올 준비가 끝났습니다</div>
              <div className="text-xs text-text-secondary">
                가져오기를 누르면 지금 자료 전체가 이 파일의 {res.rows.length}행으로 바뀌고, 선택은 {months[months.length - 1]}·전체 현장으로 시작합니다.
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancel}
                data-testid="btn-cancel"
                className="rounded-lg border border-border-strong px-4 py-2.5 text-sm font-semibold hover:bg-surface-subtle"
              >
                취소 (지금 자료 유지)
              </button>
              <button
                type="button"
                onClick={apply}
                data-testid="btn-apply"
                className="rounded-lg bg-sidebar-active px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                가져오기
              </button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
