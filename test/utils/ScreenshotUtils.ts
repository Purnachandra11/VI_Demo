import fs from 'fs';
import path from 'path';
import type { AndroidDriver } from '../types/driver';
import { SCREENSHOT_DIR, REPORT_DIR, SIMType } from '../config/SIMToolkitConfig';

interface ScreenshotInfo {
  filename: string;
  description: string;
  timestamp: number;
}

const TIMESTAMP_PATTERN = /_(\d{8})_(\d{6})\.png$/;

/**  com.telecom.utils.ScreenshotUtils */
export class ScreenshotUtils {
  private counter = 0;
  private readonly filenames: string[] = [];
  private readonly descriptions: string[] = [];
  private readonly timestamps: number[] = [];
  private testStartTime?: Date;
  private testEndTime?: Date;

  constructor(private readonly driver: AndroidDriver) {
    if (!fs.existsSync(SCREENSHOT_DIR)) {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    }
    this.loadExistingScreenshots();
  }

  setTestStartTime(): void {
    this.testStartTime = new Date();
    console.log(`Test start time set: ${this.testStartTime.toISOString()}`);
  }

  setTestEndTime(): void {
    this.testEndTime = new Date();
    console.log(`Test end time set: ${this.testEndTime.toISOString()}`);
  }

  getTestStartTime(): Date | undefined {
    return this.testStartTime;
  }

  getTestEndTime(): Date | undefined {
    return this.testEndTime;
  }

  async clearScreenshots(): Promise<void> {
    this.counter = 0;
    this.filenames.length = 0;
    this.descriptions.length = 0;
    this.timestamps.length = 0;
    if (fs.existsSync(SCREENSHOT_DIR)) {
      for (const f of fs.readdirSync(SCREENSHOT_DIR)) {
        if (f.endsWith('.png')) fs.unlinkSync(path.join(SCREENSHOT_DIR, f));
      }
    }
    console.log(`Cleared screenshot directory: ${SCREENSHOT_DIR}`);
  }

  async captureScreenshot(stepName: string): Promise<string | null> {
    try {
      this.counter += 1;
      const stamp = formatTimestamp(new Date());
      const safe = stepName
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');

      const fileName = `${String(this.counter).padStart(3, '0')}_${safe}_${stamp}.png`;
      const filePath = path.join(SCREENSHOT_DIR, fileName);
      const now = Date.now();

      const png = await this.driver.takeScreenshot();
      fs.writeFileSync(filePath, png, 'base64');

      this.filenames.push(fileName);
      this.descriptions.push(stepName);
      this.timestamps.push(now);

      console.log(`Screenshot saved: ${filePath}`);
      return filePath;
    } catch (e) {
      console.error(`Screenshot failed for ${stepName}: ${(e as Error).message}`);
      return null;
    }
  }

  async verifyRequiredScreenshots(simType: SIMType): Promise<Record<string, boolean>> {
    const required = ['SIM Toolkit Launch'];
    if (simType !== SIMType.SINGLE_SIM) required.push('SIM Selection Screen');
    required.push('Vi Menu Home', 'Flash Option', 'Roaming Menu', 'Vodafone IN', 'International');

    const files = fs.existsSync(SCREENSHOT_DIR)
      ? fs.readdirSync(SCREENSHOT_DIR).filter(f => f.endsWith('.png'))
      : [];

    const result: Record<string, boolean> = {};
    for (const req of required) {
      const key = req.toLowerCase().replace(/\s+/g, '_');
      result[req] = files.some(f => f.toLowerCase().includes(key));
    }
    return result;
  }

  /** Generate HTML screenshot report —  generateScreenshotReport() */
  async generateScreenshotReport(): Promise<string | null> {
    try {
      if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

      const dialingNumber =
        process.env.APARTY_NUMBER || process.env.A_PARTY_NUMBER || 'unknown';
      const stamp = formatTimestamp(new Date());
      const reportPath = path.join(
        REPORT_DIR,
        `Screenshot_Report_${dialingNumber}_${stamp}.html`
      );

      const shots = this.getScreenshotsInTestPeriod();
      const html = buildScreenshotHtml(dialingNumber, shots, this.testStartTime, this.testEndTime);
      fs.writeFileSync(reportPath, html, 'utf8');

      console.log(`Screenshot report saved: ${reportPath}`);
      console.log(`Screenshots in report: ${shots.length}`);
      return reportPath;
    } catch (e) {
      console.error(`Screenshot report generation failed: ${(e as Error).message}`);
      return null;
    }
  }

  printScreenshotSummary(): void {
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

  getScreenshotCount(): number {
    return this.filenames.length;
  }

  getAllScreenshotPaths(): string[] {
    return this.filenames.map(f => path.join(SCREENSHOT_DIR, f));
  }

  private loadExistingScreenshots(): void {
    if (!fs.existsSync(SCREENSHOT_DIR)) return;
    const files = fs
      .readdirSync(SCREENSHOT_DIR)
      .filter(f => f.endsWith('.png'))
      .sort();

    for (const file of files) {
      this.filenames.push(file);
      this.descriptions.push(
        file.replace(/^\d+_/, '').replace(TIMESTAMP_PATTERN, '').replace(/_/g, ' ')
      );
      this.timestamps.push(extractTimestampFromFilename(file) || 0);
    }
    this.counter = files.length;
    if (files.length) console.log(`Loaded ${files.length} existing screenshots from disk`);
  }

  private getScreenshotsInTestPeriod(): ScreenshotInfo[] {
    const all: ScreenshotInfo[] = this.filenames.map((filename, i) => ({
      filename,
      description: this.descriptions[i] || filename,
      timestamp: this.timestamps[i] || 0
    }));

    if (!this.testStartTime || !this.testEndTime) return all;

    const start = this.testStartTime.getTime() - 2000;
    const end = this.testEndTime.getTime() + 2000;
    return all.filter(s => s.timestamp >= start && s.timestamp <= end);
  }
}

function formatTimestamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function extractTimestampFromFilename(filename: string): number | null {
  const m = filename.match(TIMESTAMP_PATTERN);
  if (!m) return null;
  const d = new Date(
    parseInt(m[1].slice(0, 4), 10),
    parseInt(m[1].slice(4, 6), 10) - 1,
    parseInt(m[1].slice(6, 8), 10),
    parseInt(m[2].slice(0, 2), 10),
    parseInt(m[2].slice(2, 4), 10),
    parseInt(m[2].slice(4, 6), 10)
  );
  return isNaN(d.getTime()) ? null : d.getTime();
}

function relativeImagePath(filename: string): string {
  return `../screenshots/${filename}`;
}

function buildScreenshotHtml(
  dialingNumber: string,
  shots: ScreenshotInfo[],
  start?: Date,
  end?: Date
): string {
  const fmt = (d?: Date) => (d ? d.toLocaleString() : 'N/A');

  let body = shots
    .map(
      (s, i) => `
    <div class="screenshot-box">
      <h3>${i + 1}. ${escapeHtml(s.description)}</h3>
      <div class="screenshot-meta">
        <strong>File:</strong> <code>${escapeHtml(s.filename)}</code><br>
        <strong>Captured at:</strong> ${new Date(s.timestamp).toLocaleString()}
      </div>
      <img src="${relativeImagePath(s.filename)}" alt="${escapeHtml(s.description)}"
        onerror="this.style.display='none';this.nextElementSibling.style.display='block';">
      <div class="image-not-found" style="display:none">Image not found: ${escapeHtml(s.filename)}</div>
    </div>`
    )
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
