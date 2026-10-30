import { round1 } from "./calc";

export const NA = "계산 불가";

function group(n: number, digits: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 금액(백만원), 소수 첫째 자리. 예: 424,063.4 */
export function fmtMoney(x: number | null | undefined): string {
  if (x === null || x === undefined) return NA;
  return group(round1(x), 1);
}

/** 계약금액처럼 정수로 적힌 금액. 예: 630,700 */
export function fmtAmount(x: number | null | undefined): string {
  if (x === null || x === undefined) return NA;
  return Number.isInteger(x) ? group(x, 0) : group(round1(x), 1);
}

/** 비율(%), 소수 첫째 자리. 예: 67.2% */
export function fmtPct(x: number | null | undefined): string {
  if (x === null || x === undefined) return NA;
  return `${round1(x).toFixed(1)}%`;
}

/** 공정차이(pp). 예: -2.0pp, +0.2pp, 0.0pp */
export function fmtPp(x: number | null | undefined): string {
  if (x === null || x === undefined) return NA;
  const r = round1(x);
  const sign = r > 0 ? "+" : "";
  return `${sign}${r.toFixed(1)}pp`;
}

/** 소수 첫째 자리 숫자만(CSV용). */
export function num1(x: number): string {
  return round1(x).toFixed(1);
}

/** 2026-09 → 26.09 */
export function shortMonth(month: string): string {
  return `${month.slice(2, 4)}.${month.slice(5, 7)}`;
}
