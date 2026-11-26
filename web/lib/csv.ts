/** Đọc/ghi CSV tối giản (RFC 4180), đủ cho file xuất từ Google Sheets và Excel. */

/** Tự nhận dấu phân cách (phẩy, chấm phẩy, tab) theo dòng tiêu đề. */
export function parseCsv(text: string): string[][] {
  const s = text.replace(/^﻿/, '');
  const count: Record<string, number> = { ',': 0, ';': 0, '\t': 0 };
  for (let i = 0, quoted = false; i < s.length; i++) {
    const c = s[i];
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === '\n' || c === '\r')) break;
    else if (!quoted && c in count) count[c]++;
  }
  const sep = Object.entries(count).sort((a, b) => b[1] - a[1])[0][0];

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c !== '"') cell += c;
      else if (s[i + 1] === '"') { cell += '"'; i++; }
      else quoted = false;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Giá trị giữ nguyên dạng chữ khi mở bằng Excel (SĐT, MST không mất số 0 đầu). */
export const asText = (v: string | null | undefined) => (v ? { text: v } : '');
export type Cell = string | number | boolean | null | undefined | { text: string };

function esc(v: Cell) {
  if (v == null) return '';
  let s: string;
  if (typeof v === 'object') s = `\t${v.text}`;
  else {
    s = String(v);
    // chặn công thức độc hại khi mở bằng bảng tính (CSV injection)
    if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  }
  return /[",\n\r\t;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Có BOM để Excel hiển thị đúng tiếng Việt. */
export function toCsv(header: string[], rows: Cell[][]) {
  return '﻿' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}
