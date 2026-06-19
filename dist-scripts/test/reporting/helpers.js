"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESULTS_TEMP_DIR = exports.REPORT_DIR = void 0;
exports.ensureReportDir = ensureReportDir;
exports.ensureTempDir = ensureTempDir;
exports.fileStamp = fileStamp;
exports.dialingNumber = dialingNumber;
exports.str = str;
exports.int = int;
exports.dbl = dbl;
exports.lng = lng;
exports.bool = bool;
exports.cleanNetworkType = cleanNetworkType;
exports.balanceCell = balanceCell;
exports.rowStyle = rowStyle;
exports.createHeaderStyle = createHeaderStyle;
exports.createDataStyle = createDataStyle;
exports.createSuccessStyle = createSuccessStyle;
exports.createFailedStyle = createFailedStyle;
exports.createPartialStyle = createPartialStyle;
exports.writeHeaders = writeHeaders;
exports.autoSize = autoSize;
exports.statusClass = statusClass;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const wdio_shared_1 = require("../../config/wdio.shared");
exports.REPORT_DIR = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', 'comprehensive-reports');
exports.RESULTS_TEMP_DIR = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', '.results-temp');
function ensureReportDir() {
    if (!fs_1.default.existsSync(exports.REPORT_DIR)) {
        fs_1.default.mkdirSync(exports.REPORT_DIR, { recursive: true });
    }
}
function ensureTempDir() {
    if (!fs_1.default.existsSync(exports.RESULTS_TEMP_DIR)) {
        fs_1.default.mkdirSync(exports.RESULTS_TEMP_DIR, { recursive: true });
    }
}
function fileStamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function dialingNumber() {
    return (process.env.APARTY_NUMBER || process.env.aPartyNumber || 'unknown').replace(/\D/g, '') || 'unknown';
}
function str(v) {
    return v == null ? '' : String(v);
}
function int(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return Math.round(v);
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
}
function dbl(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return v;
    const n = parseFloat(String(v));
    return Number.isFinite(n) ? n : 0;
}
function lng(v) {
    if (v == null)
        return 0;
    if (typeof v === 'number')
        return Math.round(v);
    const n = parseInt(String(v), 10);
    return Number.isFinite(n) ? n : 0;
}
function bool(v) {
    if (v == null)
        return false;
    if (typeof v === 'boolean')
        return v;
    const s = String(v).toLowerCase();
    return s === 'true' || s === 'yes' || s === '1';
}
function cleanNetworkType(networkType) {
    if (!networkType)
        return 'Unknown';
    let cleaned = networkType.replace(/,\s*(Unknown|UNKNOWN|unknown)\s*$/i, '');
    cleaned = cleaned.replace(/^,\s*|\s*,$/g, '');
    return cleaned.trim() || 'Unknown';
}
function balanceCell(v) {
    if (v == null)
        return '';
    if (typeof v === 'number')
        return `₹${v}`;
    const s = str(v);
    return s.startsWith('₹') ? s : s;
}
function rowStyle(_workbook, finalStatus) {
    const s = finalStatus.toUpperCase();
    if (s.includes('SUCCESS') && !s.includes('PARTIAL'))
        return createSuccessStyle();
    if (s.includes('FAILED') || s.includes('ERROR'))
        return createFailedStyle();
    if (s.includes('PARTIAL') || s.includes('UNVERIFIED'))
        return createPartialStyle();
    return createDataStyle();
}
function createHeaderStyle(_workbook) {
    return {
        font: { bold: true, color: { argb: 'FFFFFFFF' } },
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E79' } },
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: thinBorder()
    };
}
function createDataStyle() {
    return {
        border: thinBorder(),
        alignment: { wrapText: true, vertical: 'top' }
    };
}
function createSuccessStyle() {
    return {
        ...createDataStyle(),
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6EFCE' } },
        font: { color: { argb: 'FF006100' } }
    };
}
function createFailedStyle() {
    return {
        ...createDataStyle(),
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } },
        font: { color: { argb: 'FF9C0006' } }
    };
}
function createPartialStyle() {
    return {
        ...createDataStyle(),
        fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } },
        font: { color: { argb: 'FF9C6500' } }
    };
}
function thinBorder() {
    const s = 'thin';
    return { top: { style: s }, left: { style: s }, bottom: { style: s }, right: { style: s } };
}
function writeHeaders(sheet, headers, headerStyle) {
    const row = sheet.addRow(headers);
    row.eachCell((cell) => {
        cell.style = headerStyle;
    });
}
function autoSize(sheet, colCount) {
    for (let i = 1; i <= colCount; i++) {
        sheet.getColumn(i).width = Math.min(42, Math.max(12, sheet.getColumn(i).width || 14));
    }
}
function statusClass(finalStatus) {
    const s = finalStatus.toUpperCase();
    if (s.includes('SUCCESS') && !s.includes('PARTIAL'))
        return 'success';
    if (s.includes('FAILED') || s.includes('ERROR'))
        return 'failed';
    if (s.includes('PARTIAL') || s.includes('UNVERIFIED'))
        return 'partial';
    return '';
}
