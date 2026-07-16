// TypeScript port of com.telecom.utils.ScreenshotUtils
import * as fs from 'fs';
import * as path from 'path';
import { SIMToolkitConfig, SIMType } from '../config/SIMToolkitConfig';

interface ScreenshotInfo {
    filename: string;
    description: string;
    timestamp: number;
}

const TIMESTAMP_PATTERN = /_(\d{8})_(\d{6})\.png$/;

function pad2(n: number): string {
    return n.toString().padStart(2, '0');
}

function formatTimestampForFile(d: Date): string {
    return (
        `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}_` +
        `${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`
    );
}

function formatDisplay(d: Date): string {
    return (
        `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ` +
        `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`
    );
}

export class ScreenshotUtils {
    private screenshotCounter = 0;
    private capturedScreenshots: string[] = [];
    private screenshotDescriptions: string[] = [];
    private screenshotTimestamps: number[] = [];
    private testStartTime?: Date;
    private testEndTime?: Date;

    constructor() {
        this.createScreenshotDir();
        this.loadExistingScreenshots();
    }

    setTestStartTime(): void {
        this.testStartTime = new Date();
        console.log(`⏰ Test start time set: ${this.testStartTime}`);
    }

    setTestEndTime(): void {
        this.testEndTime = new Date();
        console.log(`⏰ Test end time set: ${this.testEndTime}`);
    }

    getTestStartTime(): Date | undefined {
        return this.testStartTime;
    }

    getTestEndTime(): Date | undefined {
        return this.testEndTime;
    }

    private createScreenshotDir(): void {
        if (!fs.existsSync(SIMToolkitConfig.SCREENSHOT_DIR)) {
            try {
                fs.mkdirSync(SIMToolkitConfig.SCREENSHOT_DIR, { recursive: true });
                console.log(`📁 Created screenshot directory: ${SIMToolkitConfig.SCREENSHOT_DIR}`);
            } catch {
                console.error(`❌ Failed to create screenshot directory: ${SIMToolkitConfig.SCREENSHOT_DIR}`);
            }
        }
    }

    private loadExistingScreenshots(): void {
        const dir = SIMToolkitConfig.SCREENSHOT_DIR;
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            console.log(`📁 Screenshot directory not found or is not a directory: ${dir}`);
            return;
        }

        const files = fs
            .readdirSync(dir)
            .filter((f) => f.endsWith('.png'))
            .sort();

        if (files.length > 0) {
            for (const file of files) {
                this.capturedScreenshots.push(file);
                const desc = file
                    .replace(/^\d+_/, '')
                    .replace(/_\d{8}_\d{6}\.png$/, '')
                    .replace(/_/g, ' ');
                this.screenshotDescriptions.push(desc);
                this.screenshotTimestamps.push(this.extractTimestampFromFilename(file));
            }
            this.screenshotCounter = files.length;
            console.log(`📂 Loaded ${files.length} existing screenshots from disk`);
        } else {
            console.log(`📂 No existing screenshots found in directory: ${dir}`);
        }
    }

    private extractTimestampFromFilename(filename: string): number {
        try {
            const match = TIMESTAMP_PATTERN.exec(filename);
            if (match) {
                const dateStr = match[1]; // yyyyMMdd
                const timeStr = match[2]; // HHmmss
                const year = Number(dateStr.slice(0, 4));
                const month = Number(dateStr.slice(4, 6)) - 1;
                const day = Number(dateStr.slice(6, 8));
                const hour = Number(timeStr.slice(0, 2));
                const min = Number(timeStr.slice(2, 4));
                const sec = Number(timeStr.slice(4, 6));
                return new Date(year, month, day, hour, min, sec).getTime();
            }
        } catch (e) {
            console.error(`❌ Error parsing timestamp from filename: ${filename} - ${(e as Error).message}`);
        }
        return 0;
    }

    /**
     * Capture a screenshot via the active WebdriverIO `driver` session.
     */
    async captureScreenshot(stepName: string): Promise<string | null> {
        if (typeof driver === 'undefined' || !driver) {
            console.error(`❌ Driver is not available, cannot capture screenshot for: ${stepName}`);
            return null;
        }

        try {
            this.screenshotCounter++;

            const now = new Date();
            const timestamp = formatTimestampForFile(now);
            const currentTime = now.getTime();

            const sanitizedStepName = stepName
                .toLowerCase()
                .replace(/ /g, '_')
                .replace(/[^a-z0-9_]/g, '');

            const fileName = `${this.screenshotCounter.toString().padStart(3, '0')}_${sanitizedStepName}_${timestamp}.png`;

            if (!fs.existsSync(SIMToolkitConfig.SCREENSHOT_DIR)) {
                fs.mkdirSync(SIMToolkitConfig.SCREENSHOT_DIR, { recursive: true });
            }

            const destPath = path.join(SIMToolkitConfig.SCREENSHOT_DIR, fileName);

            // WebdriverIO's saveScreenshot writes the PNG directly to disk
            await driver.saveScreenshot(destPath);

            this.capturedScreenshots.push(fileName);
            this.screenshotDescriptions.push(stepName);
            this.screenshotTimestamps.push(currentTime);

            console.log(`📸 Screenshot saved: ${path.resolve(destPath)}`);
            return path.resolve(destPath);
        } catch (e) {
            console.error(`❌ Screenshot failed for ${stepName}: ${(e as Error).message}`);
            return null;
        }
    }

    private getScreenshotsInTestPeriod(): ScreenshotInfo[] {
        const testScreenshots: ScreenshotInfo[] = [];

        if (!this.testStartTime || !this.testEndTime) {
            console.log('⚠️ Test start/end time not set. Showing all screenshots.');
            for (let i = 0; i < this.capturedScreenshots.length; i++) {
                testScreenshots.push({
                    filename: this.capturedScreenshots[i],
                    description: this.screenshotDescriptions[i],
                    timestamp: this.screenshotTimestamps[i]
                });
            }
            return testScreenshots;
        }

        const startTime = this.testStartTime.getTime();
        const endTime = this.testEndTime.getTime();

        console.log(`🔍 Filtering screenshots from ${this.testStartTime} to ${this.testEndTime}`);

        for (let i = 0; i < this.capturedScreenshots.length; i++) {
            const screenshotTime = this.screenshotTimestamps[i];
            if (screenshotTime >= startTime - 2000 && screenshotTime <= endTime + 2000) {
                testScreenshots.push({
                    filename: this.capturedScreenshots[i],
                    description: this.screenshotDescriptions[i],
                    timestamp: screenshotTime
                });
            }
        }

        console.log(`📊 Found ${testScreenshots.length} screenshots in test period`);
        return testScreenshots;
    }

    private getRelativeImagePath(filename: string): string {
        try {
            const screenshotFile = path.join(SIMToolkitConfig.SCREENSHOT_DIR, filename);
            const reportDir = SIMToolkitConfig.REPORT_DIR;

            if (!fs.existsSync(reportDir)) {
                return `file:///${path.resolve(screenshotFile).replace(/\\/g, '/')}`;
            }

            const screenshotPath = path.resolve(screenshotFile);
            const reportPath = path.resolve(reportDir);

            if (screenshotPath.startsWith(reportPath)) {
                return screenshotPath.slice(reportPath.length).replace(/\\/g, '/');
            }

            return `../${path.basename(SIMToolkitConfig.SCREENSHOT_DIR)}/${filename}`;
        } catch {
            console.error(`❌ Error calculating relative path for: ${filename}`);
            return filename;
        }
    }

    generateScreenshotReport(): void {
        try {
            const reportDir = SIMToolkitConfig.REPORT_DIR;
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
                console.log(`📁 Created report directory: ${reportDir}`);
            }

            const dialingNumber = process.env.aPartyNumber || 'unknown';
            const timestamp = formatTimestampForFile(new Date());
            const reportPath = path.join(reportDir, `Screenshot_Report_${dialingNumber}_${timestamp}.html`);

            const testScreenshots = this.getScreenshotsInTestPeriod();

            const style = `
body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f7fa; padding: 20px; margin: 0; }
h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
.info-box { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.info-box h2 { color: #2980b9; margin-top: 0; }
.info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 15px; margin-top: 15px; }
.info-item { background: #ecf0f1; padding: 15px; border-radius: 6px; }
.info-item strong { display: block; color: #34495e; margin-bottom: 5px; }
.screenshot-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
.screenshot-box h3 { color: #2980b9; margin-top: 0; border-bottom: 2px solid #ecf0f1; padding-bottom: 8px; }
.screenshot-meta { color: #7f8c8d; font-size: 14px; margin: 8px 0; }
.screenshot-box img { max-width: 400px; height: auto; border: 2px solid #bdc3c7; border-radius: 4px; margin-top: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); transition: transform 0.2s; }
.screenshot-box img:hover { transform: scale(1.02); }
.screenshot-box code { background: #ecf0f1; padding: 4px 8px; border-radius: 4px; color: #e74c3c; font-size: 12px; }
.footer { text-align: center; color: #7f8c8d; margin-top: 30px; padding: 20px; border-top: 1px solid #ecf0f1; }
.no-screenshots { text-align: center; padding: 40px; color: #7f8c8d; font-style: italic; background: #ecf0f1; border-radius: 8px; margin: 20px 0; }
.image-container { position: relative; }
.image-not-found { color: #e74c3c; background: #ffeaea; padding: 10px; border-radius: 4px; margin-top: 10px; }
`;

            let infoItems = `
<div class="info-item"><strong>Device Number</strong><span>${dialingNumber === 'unknown' ? 'Not Specified' : dialingNumber}</span></div>`;
            if (this.testStartTime) {
                infoItems += `<div class="info-item"><strong>Test Start Time</strong><span>${formatDisplay(this.testStartTime)}</span></div>`;
            }
            if (this.testEndTime) {
                infoItems += `<div class="info-item"><strong>Test End Time</strong><span>${formatDisplay(this.testEndTime)}</span></div>`;
            }
            infoItems += `<div class="info-item"><strong>📸 Total Screenshots in Test Period</strong><span>${testScreenshots.length}</span></div>`;

            let screenshotsHtml: string;
            if (testScreenshots.length === 0) {
                screenshotsHtml = `<div class="no-screenshots"><p>⚠️ No screenshots found for the specified test period</p><p>Test Period: ${
                    this.testStartTime ? formatDisplay(this.testStartTime) : ''
                } to ${this.testEndTime ? formatDisplay(this.testEndTime) : ''}</p></div>`;
            } else {
                screenshotsHtml = testScreenshots
                    .map((info, i) => {
                        const imagePath = this.getRelativeImagePath(info.filename);
                        return `
<div class="screenshot-box">
  <h3>${i + 1}. ${info.description}</h3>
  <div class="screenshot-meta">
    <strong>File:</strong> <code>${info.filename}</code><br>
    <strong>Captured at:</strong> ${formatDisplay(new Date(info.timestamp))}
  </div>
  <div class="image-container">
    <img src="${imagePath}" alt="${info.description}"
      onerror="this.style.display='none';this.parentElement.innerHTML+='<div class=\\'image-not-found\\'>❌ Image not found: ${info.filename}</div>';">
  </div>
</div>`;
                    })
                    .join('');
            }

            const html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vi SIM Toolkit Screenshot Report - ${dialingNumber}</title>
<style>${style}</style></head><body>
<h1>📱 Vi SIM Toolkit Screenshot Report - ${dialingNumber}</h1>
<div class="info-box"><h2>Test Information</h2><div class="info-grid">${infoItems}</div></div>
<div class="info-box"><h2>Screenshots Captured During Test</h2>${screenshotsHtml}</div>
<div class="footer">
  <p>📂 Report saved in: ${SIMToolkitConfig.REPORT_DIR}</p>
  <p>Generated by Vi SIM Toolkit Automation Framework</p>
  <p>Report generated: ${formatDisplay(new Date())}</p>
</div>
</body></html>`;

            fs.writeFileSync(reportPath, html, 'utf-8');
            console.log(`✅ Screenshot report saved: ${reportPath}`);
            console.log(`📊 Screenshots in report: ${testScreenshots.length}`);
        } catch (e) {
            console.error(`❌ Screenshot report generation failed: ${(e as Error).message}`);
        }
    }

    verifyRequiredScreenshots(simType: SIMType): Map<string, boolean> {
        const results = new Map<string, boolean>();
        const required = this.getRequiredScreenshots(simType);

        const dir = SIMToolkitConfig.SCREENSHOT_DIR;
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
            for (const req of required) {
                results.set(req, false);
            }
            return results;
        }

        const actualFiles = fs.readdirSync(dir).filter((f) => f.endsWith('.png'));

        for (const req of required) {
            const key = req.toLowerCase().replace(/ /g, '_');
            const found = actualFiles.some((f) => f.toLowerCase().includes(key));
            results.set(req, found);
        }
        return results;
    }

    clearScreenshots(): void {
        try {
            const dir = SIMToolkitConfig.SCREENSHOT_DIR;
            if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
                for (const f of fs.readdirSync(dir)) {
                    fs.rmSync(path.join(dir, f), { force: true });
                }
                console.log(`🧹 Cleared screenshot directory: ${dir}`);
            }

            this.capturedScreenshots = [];
            this.screenshotDescriptions = [];
            this.screenshotTimestamps = [];
            this.screenshotCounter = 0;
        } catch (e) {
            console.error(`❌ Clear screenshots failed: ${(e as Error).message}`);
        }
    }

    printScreenshotSummary(): void {
        const size = this.capturedScreenshots.length;
        console.log(`   Total screenshots: ${size}`);
        if (size === 0) {
            console.log('   ⚠️ No screenshots found!');
        } else {
            for (let i = 0; i < Math.min(size, 10); i++) {
                console.log(`   ${i + 1}. ${this.screenshotDescriptions[i]}`);
            }
            if (size > 10) {
                console.log(`   ... and ${size - 10} more`);
            }
        }
    }

    private getRequiredScreenshots(simType: SIMType): string[] {
        const list = ['SIM Toolkit Launch'];
        if (simType !== SIMType.SINGLE_SIM) {
            list.push('SIM Selection Screen');
        }
        list.push('Vi Menu Home', 'Flash Option', 'Roaming Menu', 'Vodafone IN', 'International');
        return list;
    }

    getScreenshotCount(): number {
        return this.capturedScreenshots.length;
    }

    getAllScreenshotPaths(): string[] {
        return this.capturedScreenshots.map((filename) =>
            path.resolve(path.join(SIMToolkitConfig.SCREENSHOT_DIR, filename))
        );
    }
}
