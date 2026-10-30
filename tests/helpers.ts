import fs from "node:fs";
import path from "node:path";
import { parseFileText, type ParsedFile } from "../src/lib/parse";
import { validateParsed, type ValidationResult } from "../src/lib/validate";
import { ALL, type Filters, type SiteRow } from "../src/lib/types";

const DATA_DIR = path.resolve(__dirname, "..", "data");

/** data 폴더의 원본은 읽기만 합니다. */
export function readData(...parts: string[]): string {
  return fs.readFileSync(path.join(DATA_DIR, ...parts), "utf8");
}

export function importFile(fileName: string, text: string): ValidationResult {
  const parsed = parseFileText(fileName, text);
  if ("unsupported" in parsed) throw new Error("unsupported file");
  return validateParsed(parsed as ParsedFile);
}

export function loadRows(kind: "csv" | "json" = "csv"): SiteRow[] {
  const name = kind === "csv" ? "현장공정기성.csv" : "현장공정기성.json";
  const res = importFile(name, readData(name));
  if (!res.ok) throw new Error("원본 자료 검사 실패: " + JSON.stringify(res.errors));
  return res.rows;
}

export function filters(patch: Partial<Filters> = {}): Filters {
  return { month: "2026-09", region: ALL, projectType: ALL, siteId: ALL, ...patch };
}
