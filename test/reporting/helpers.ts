import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { PROJECT_ROOT } from '../../config/wdio.shared';

type CellStyle = Partial<ExcelJS.Style>;

export const REPORT_DIR = path.join(PROJECT_ROOT, 'test-output', 'comprehensive-reports');
export const RESULTS_TEMP_DIR = path.join(PROJECT_ROOT, 'test-output', '.results-temp');

export function ensureReportDir(): void {
  if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
  }
}

export function ensureTempDir(): void {
  if (!fs.existsSync(RESULTS_TEMP_DIR)) {
    fs.mkdirSync(RESULTS_TEMP_DIR, { recursive: true });
  }
}

export function fileStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function dialingNumber(): string {
  return (process.env.APARTY_NUMBER || process.env.aPartyNumber || 'unknown').replace(/\D/g, '') || 'unknown';
}

export function str(v: unknown): string {
  return v == null ? '' : String(v);
}

export function int(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v);
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

export function dbl(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

export function lng(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === 'number') return Math.round(v);
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : 0;
}

export function bool(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  return s === 'true' || s === 'yes' || s === '1';
}

export function cleanNetworkType(networkType: string): string {
  if (!networkType) return 'Unknown';
  let cleaned = networkType.replace(/,\s*(Unknown|UNKNOWN|unknown)\s*$/i, '');
  cleaned = cleaned.replace(/^,\s*|\s*,$/g, '');
  return cleaned.trim() || 'Unknown';
}

export function balanceCell(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number') return `₹${v}`;
  const s = str(v);
  return s.startsWith('₹') ? s : s;
}

export function rowStyle(_workbook: ExcelJS.Workbook, finalStatus: string): CellStyle {
  const s = finalStatus.toUpperCase();
  if (s.includes('SUCCESS') && !s.includes('PARTIAL')) return createSuccessStyle();
  if (s.includes('FAILED') || s.includes('ERROR')) return createFailedStyle();
  if (s.includes('PARTIAL') || s.includes('UNVERIFIED')) return createPartialStyle();
  return createDataStyle();
}

export function createHeaderStyle(_workbook?: ExcelJS.Workbook): CellStyle {
  return {
    font: { bold: true, color: { argb: 'FFFFFFFF' } },
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    border: thinBorder()
  };
}

export function createDataStyle(): CellStyle {
  return {
    border: thinBorder(),
    alignment: { wrapText: true, vertical: 'top' }
  };
}

export function createSuccessStyle(): CellStyle {
  return {
    ...createDataStyle(),
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } },
    font: { color: { argb: 'FF006100' } }
  };
}

export function createFailedStyle(): CellStyle {
  return {
    ...createDataStyle(),
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } },
    font: { color: { argb: 'FF9C0006' } }
  };
}

export function createPartialStyle(): CellStyle {
  return {
    ...createDataStyle(),
    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } },
    font: { color: { argb: 'FF9C6500' } }
  };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const s: ExcelJS.BorderStyle = 'thin';
  return { top: { style: s }, left: { style: s }, bottom: { style: s }, right: { style: s } };
}

export function writeHeaders(
  sheet: ExcelJS.Worksheet,
  headers: string[],
  headerStyle: CellStyle
): void {
  const row = sheet.addRow(headers);
  row.eachCell((cell) => {
    cell.style = headerStyle;
  });
}

export function autoSize(sheet: ExcelJS.Worksheet, colCount: number): void {
  for (let i = 1; i <= colCount; i++) {
    sheet.getColumn(i).width = Math.min(42, Math.max(12, sheet.getColumn(i).width || 14));
  }
}

export function statusClass(finalStatus: string): string {
  const s = finalStatus.toUpperCase();
  if (s.includes('SUCCESS') && !s.includes('PARTIAL')) return 'success';
  if (s.includes('FAILED') || s.includes('ERROR')) return 'failed';
  if (s.includes('PARTIAL') || s.includes('UNVERIFIED')) return 'partial';
  return '';
}
