import type { Status } from "@/lib/types";

const STYLE: Record<Status, string> = {
  정상: "border-status-normal-border bg-status-normal-bg text-status-normal",
  주의: "border-status-caution-border bg-status-caution-bg text-status-caution",
  점검: "border-status-critical-border bg-status-critical-bg text-status-critical",
};
const DOT: Record<Status, string> = {
  정상: "bg-status-normal",
  주의: "bg-status-caution",
  점검: "bg-status-critical",
};

/** 상태는 색만으로 구분하지 않고 글자를 함께 씁니다. */
export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${STYLE[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT[status]}`} aria-hidden />
      {status}
    </span>
  );
}

export function diffColor(status: Status): string {
  return status === "점검" ? "text-status-critical" : status === "주의" ? "text-status-caution" : "text-status-normal";
}
