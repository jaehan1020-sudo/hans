import { FIELDS } from "./types";

export type RawValue = string | number | boolean | null | undefined;

export interface RawRecord {
  /** 파일에서 보이는 행 번호. CSV는 헤더가 1행, JSON은 records의 순서(1부터). */
  rowNo: number;
  values: Record<string, RawValue>;
}

export interface ParsedFile {
  format: "csv" | "json";
  records: RawRecord[];
  /** 파일 구조 자체의 문제(열 없음, JSON 형식 오류 등). 행 번호 없이 보여줍니다. */
  fileErrors: { column: string | null; message: string }[];
  metadata?: Record<string, unknown>;
}

/** RFC 4180 방식의 CSV 읽기: 따옴표 안의 쉼표·줄바꿈·"" 와 맨 앞 BOM을 처리합니다. */
export function parseCsvText(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
    } else if (ch === ",") {
      row.push(field);
      field = "";
      i++;
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      field += ch;
      i++;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // 파일 끝의 빈 줄은 무시합니다.
  while (rows.length > 0 && rows[rows.length - 1].every((c) => c === "")) rows.pop();
  return rows;
}

export function parseCsvFile(text: string): ParsedFile {
  const table = parseCsvText(text);
  const fileErrors: ParsedFile["fileErrors"] = [];
  if (table.length === 0) {
    return { format: "csv", records: [], fileErrors: [{ column: null, message: "파일이 비어 있습니다." }] };
  }
  const header = table[0].map((h) => h.trim());
  for (const f of FIELDS) {
    if (!header.includes(f)) fileErrors.push({ column: f, message: "필수 열이 없습니다." });
  }
  const records: RawRecord[] = [];
  for (let i = 1; i < table.length; i++) {
    const values: Record<string, RawValue> = {};
    header.forEach((h, idx) => {
      values[h] = table[i][idx] ?? "";
    });
    records.push({ rowNo: i + 1, values });
  }
  return { format: "csv", records, fileErrors };
}

export function parseJsonFile(text: string): ParsedFile {
  let data: unknown;
  try {
    data = JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch {
    return {
      format: "json",
      records: [],
      fileErrors: [{ column: null, message: "JSON 형식이 올바르지 않습니다." }],
    };
  }
  const obj = data as { metadata?: Record<string, unknown>; records?: unknown };
  if (!obj || typeof obj !== "object" || !Array.isArray(obj.records)) {
    return {
      format: "json",
      records: [],
      fileErrors: [{ column: "records", message: "records 목록이 없습니다." }],
    };
  }
  const records: RawRecord[] = obj.records.map((rec, i) => ({
    rowNo: i + 1,
    values: (rec && typeof rec === "object" ? rec : {}) as Record<string, RawValue>,
  }));
  return { format: "json", records, fileErrors: [], metadata: obj.metadata };
}

/** 파일 이름·내용으로 CSV/JSON을 구분해 읽습니다. */
export function parseFileText(fileName: string, text: string): ParsedFile | { unsupported: true } {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".csv")) return parseCsvFile(text);
  if (lower.endsWith(".json")) return parseJsonFile(text);
  return { unsupported: true };
}
