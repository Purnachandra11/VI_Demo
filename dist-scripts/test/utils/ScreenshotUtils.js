"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenshotUtils = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const SIMToolkitConfig_1 = require("../config/SIMToolkitConfig");
const TIMESTAMP_PATTERN = /_(\d{8})_(\d{6})\.png$/;
/**  com.telecom.utils.ScreenshotUtils */
class ScreenshotUtils {
    constructor(driver) {
        this.driver = driver;
        this.counter = 0;
        this.filenames = [];
        this.descriptions = [];
        this.timestamps = [];
        if (!fs_1.default.existsSync(SIMToolkitConfig_1.SCREENSHOT_DIR)) {
            fs_1.default.mkdirSync(SIMToolkitConfig_1.SCREENSHOT_DIR, { recursive: true });
        }
        this.loadExistingScreenshots();
    }
    setTestStartTime() {
        this.testStartTime = new Date();
        console.log(`Test start time set: ${this.testStartTime.toISOString()}`);
    }
    setTestEndTime() {
        this.testEndTime = new Date();
        console.log(`Test end time set: ${this.testEndTime.toISOString()}`);
    }
    getTestStartTime() {
        return this.testStartTime;
    }
    getTestEndTime() {
        return this.testEndTime;
    }
    async clearScreenshots() {
        this.counter = 0;
        this.filenames.length = 0;
        this.descriptions.length = 0;
        this.timestamps.length = 0;
        if (fs_1.default.existsSync(SIMToolkitConfig_1.SCREENSHOT_DIR)) {
            for (const f of fs_1.default.readdirSync(SIMToolkitConfig_1.SCREENSHOT_DIR)) {
                if (f.endsWith('.png'))
                    fs_1.default.unlinkSync(path_1.default.join(SIMToolkitConfig_1.SCREENSHOT_DIR, f));
            }
        }
        console.log(`Cleared screenshot directory: ${SIMToolkitConfig_1.SCREENSHOT_DIR}`);
    }
    async captureScreenshot(stepName) {
        try {
            this.counter += 1;
            const stamp = formatTimestamp(new Date());
            const safe = stepName
                .toLowerCase()
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_]/g, '');
            const fileName = `${String(this.counter).padStart(3, '0')}_${safe}_${stamp}.png`;
            const filePath = path_1.default.join(SIMToolkitConfig_1.SCREENSHOT_DIR, fileName);
            const now = Date.now();
            const png = await this.driver.takeScreenshot();
            fs_1.default.writeFileSync(filePath, png, 'base64');
            this.filenames.push(fileName);
            this.descriptions.push(stepName);
            this.timestamps.push(now);
            console.log(`Screenshot saved: ${filePath}`);
            return filePath;
        }
        catch (e) {
            console.error(`Screenshot failed for ${stepName}: ${e.message}`);
            return null;
        }
    }
    async verifyRequiredScreenshots(simType) {
        const required = ['SIM Toolkit Launch'];
        if (simType !== SIMToolkitConfig_1.SIMType.SINGLE_SIM)
            required.push('SIM Selection Screen');
        required.push('Vi Menu Home', 'Flash Option', 'Roaming Menu', 'Vodafone IN', 'International');
        const files = fs_1.default.existsSync(SIMToolkitConfig_1.SCREENSHOT_DIR)
            ? fs_1.default.readdirSync(SIMToolkitConfig_1.SCREENSHOT_DIR).filter(f => f.endsWith('.png'))
            : [];
        const result = {};
        for (const req of required) {
            const key = req.toLowerCase().replace(/\s+/g, '_');
            result[req] = files.some(f => f.toLowerCase().includes(key));
        }
        return result;
    }
    /** Generate HTML screenshot report —  generateScreenshotReport() */
    async generateScreenshotReport() {
        try {
            if (!fs_1.default.existsSync(SIMToolkitConfig_1.REPORT_DIR))
                fs_1.default.mkdirSync(SIMToolkitConfig_1.REPORT_DIR, { recursive: true });
            const dialingNumber = process.env.APARTY_NUMBER || process.env.A_PARTY_NUMBER || 'unknown';
            const stamp = formatTimestamp(new Date());
            const reportPath = path_1.default.join(SIMToolkitConfig_1.REPORT_DIR, `Screenshot_Report_${dialingNumber}_${stamp}.html`);
            const shots = this.getScreenshotsInTestPeriod();
            const html = buildScreenshotHtml(dialingNumber, shots, this.testStartTime, this.testEndTime);
            fs_1.default.writeFileSync(reportPath, html, 'utf8');
            console.log(`Screenshot report saved: ${reportPath}`);
            console.log(`Screenshots in report: ${shots.length}`);
            return reportPath;
        }
        catch (e) {
            console.error(`Screenshot report generation failed: ${e.message}`);
            return null;
        }
    }
    printScreenshotSummary() {
        console.log(`   Total screenshots: ${this.filenames.length}`);
        if (!this.filenames.length) {
            console.log('   No screenshots found!');
            return;
        }
        for (let i = 0; i < Math.min(this.filenames.length, 10); i++) {
            console.log(`   ${i + 1}. ${this.descriptions[i]}`);
        }
        if (this.filenames.length > 10) {
            console.log(`   ... and ${this.filenames.length - 10} more`);
        }
    }
    getScreenshotCount() {
        return this.filenames.length;
    }
    getAllScreenshotPaths() {
        return this.filenames.map(f => path_1.default.join(SIMToolkitConfig_1.SCREENSHOT_DIR, f));
    }
    loadExistingScreenshots() {
        if (!fs_1.default.existsSync(SIMToolkitConfig_1.SCREENSHOT_DIR))
            return;
        const files = fs_1.default
            .readdirSync(SIMToolkitConfig_1.SCREENSHOT_DIR)
            .filter(f => f.endsWith('.png'))
            .sort();
        for (const file of files) {
            this.filenames.push(file);
            this.descriptions.push(file.replace(/^\d+_/, '').replace(TIMESTAMP_PATTERN, '').replace(/_/g, ' '));
            this.timestamps.push(extractTimestampFromFilename(file) || 0);
        }
        this.counter = files.length;
        if (files.length)
            console.log(`Loaded ${files.length} existing screenshots from disk`);
    }
    getScreenshotsInTestPeriod() {
        const all = this.filenames.map((filename, i) => ({
            filename,
            description: this.descriptions[i] || filename,
            timestamp: this.timestamps[i] || 0
        }));
        if (!this.testStartTime || !this.testEndTime)
            return all;
        const start = this.testStartTime.getTime() - 2000;
        const end = this.testEndTime.getTime() + 2000;
        return all.filter(s => s.timestamp >= start && s.timestamp <= end);
    }
}
exports.ScreenshotUtils = ScreenshotUtils;
function formatTimestamp(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function extractTimestampFromFilename(filename) {
    const m = filename.match(TIMESTAMP_PATTERN);
    if (!m)
        return null;
    const d = new Date(parseInt(m[1].slice(0, 4), 10), parseInt(m[1].slice(4, 6), 10) - 1, parseInt(m[1].slice(6, 8), 10), parseInt(m[2].slice(0, 2), 10), parseInt(m[2].slice(2, 4), 10), parseInt(m[2].slice(4, 6), 10));
    return isNaN(d.getTime()) ? null : d.getTime();
}
function relativeImagePath(filename) {
    return `../screenshots/${filename}`;
}
function buildScreenshotHtml(dialingNumber, shots, start, end) {
    const fmt = (d) => (d ? d.toLocaleString() : 'N/A');
    let body = shots
        .map((s, i) => `
    <div class="screenshot-box">
      <h3>${i + 1}. ${escapeHtml(s.description)}</h3>
      <div class="screenshot-meta">
        <strong>File:</strong> <code>${escapeHtml(s.filename)}</code><br>
        <strong>Captured at:</strong> ${new Date(s.timestamp).toLocaleString()}
      </div>
      <img src="${relativeImagePath(s.filename)}" alt="${escapeHtml(s.description)}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
      <div class="image-not-found" style="display:none">Image not found: ${escapeHtml(s.filename)}</div>
    </div>`)
        .join('');
    if (!shots.length) {
        body = `<div class="no-screenshots"><p>No screenshots found for the test period (${fmt(start)} → ${fmt(end)})</p></div>`;
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vi Screenshot Report - ${escapeHtml(dialingNumber)}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;background:#f5f7fa;padding:20px;margin:0}
h1{color:#2c3e50;border-bottom:3px solid #3498db;padding-bottom:10px}
.info-box,.screenshot-box{background:#fff;padding:20px;border-radius:8px;margin:15px 0;box-shadow:0 2px 4px rgba(0,0,0,.1)}
.info-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.info-item{background:#ecf0f1;padding:12px;border-radius:6px}
.screenshot-box img{max-width:400px;border:2px solid #bdc3c7;border-radius:4px;margin-top:10px}
.no-screenshots{text-align:center;padding:40px;color:#7f8c8d;background:#ecf0f1;border-radius:8px}
.image-not-found{color:#e74c3c;background:#ffeaea;padding:10px;border-radius:4px;margin-top:8px}
.footer{text-align:center;color:#7f8c8d;margin-top:30px;padding-top:20px;border-top:1px solid #ecf0f1}
</style></head><body>
<h1>Vi SIM Toolkit Screenshot Report — ${escapeHtml(dialingNumber)}</h1>
<div class="info-box"><h2>Test Information</h2><div class="info-grid">
<div class="info-item"><strong>Device Number</strong><span>${escapeHtml(dialingNumber)}</span></div>
<div class="info-item"><strong>Test Start</strong><span>${fmt(start)}</span></div>
<div class="info-item"><strong>Test End</strong><span>${fmt(end)}</span></div>
<div class="info-item"><strong>Total Screenshots</strong><span>${shots.length}</span></div>
</div></div>
<div class="info-box"><h2>Screenshots Captured During Test</h2>${body}</div>
<div class="footer"><p>Generated by WebdriverIO + TypeScript Automation Framework</p>
<p>Report generated: ${new Date().toLocaleString()}</p></div>
</body></html>`;
}
function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
