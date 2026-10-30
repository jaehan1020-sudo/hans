import Link from "next/link";

/** 상태 화면: 자료 없음 (처음 열었을 때, 새로고침 후) */
export function EmptyData({ context }: { context?: string }) {
  return (
    <section
      className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border-strong bg-surface-card px-6 py-16 text-center"
      data-testid="state-no-data"
    >
      <span aria-hidden="true" className="material-symbols-outlined text-text-muted" style={{ fontSize: 40 }}>
        inbox
      </span>
      <h2 className="text-lg font-bold">자료를 먼저 가져오세요</h2>
      <p className="max-w-md text-sm text-text-secondary">
        {context ?? "아직 가져온 자료가 없습니다."} CSV 또는 JSON 파일을 가져오면 2026년 9월·전체 현장 현황이 보입니다.
        새로고침하면 자료가 지워져 파일을 다시 가져와야 합니다.
      </p>
      <Link
        href="/import"
        className="mt-2 inline-flex items-center gap-2 rounded-xl bg-sidebar-active px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
      >
        <span aria-hidden="true" className="material-symbols-outlined">cloud_upload</span>
        자료 가져오기로 가기
      </Link>
    </section>
  );
}
