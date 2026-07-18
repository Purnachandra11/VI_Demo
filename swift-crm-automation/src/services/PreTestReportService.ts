// src/services/PreTestReportService.ts
//
// Dedicated report service for PreTest verification.
// Captures exactly 3 data sets scraped by RechargePage.runPreTestVerification():
//   1) Customer IN — Account Overview   (Steps 6–8: clickCustomerINProfile + captureAccountOverview)
//   2) Dedicated Account Table          (Steps 9–10: clickDedicatedAccount + scrapeOtherOffersDA)
//   3) Offer Tab Table                  (Steps 11–12: clickOfferTab + scrapeOtherOffersOfferTab)
//
// This service is intentionally separate from ExcelReportService.ts, which continues to
// own SWIFT / IN / Vi App / consolidated reporting untouched. PreTestReportService produces
// its own Excel + HTML + PDF + ZIP bundle per MSISDN, generated for every row regardless
// of PreTest pass/fail.

import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface AccountOverview {
  activationDate?: string;
  serviceRemovalOn?: string;
  supervisionExpiresOn?: string;
  mainBalance?: string;
  serviceFeeExpiresOn?: string;
  subscriberStatus?: string;
  creditClearanceOn?: string;
}

export interface DedicatedAccountEntry {
  daName?: string;
  daId?: string;
  startDate?: string;
  expiryDate?: string;
  daValue?: string;
  unit?: string;
  type?: string;
}

export interface OfferEntry {
  offerName?: string;
  offerId?: string;
  productId?: string;
  startDateTime?: string;
  endDateTime?: string;
  offerType?: string;
}

export interface UsageEntry {
  offer_name?: string;
  balance_left?: string;
  total_quota?: string;
  category?: string;
  expiry_date?: string;
}

export interface PreTestScreenshot {
  srNo: number;
  msisdn: string;
  screenshotFile: string;
  fullPath: string;
  capturedAt: string;
  stepName: string;
}

export interface PreTestReportResult {
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  status: 'Pass' | 'Fail';
  reason: string;
  // Customer IN identity fields (from captureSubscriberInfo)
  customerName?: string;
  coreBalance?: string;
  serviceValidity?: string;
  accountStatus?: string;
  userType?: string;
  // Customer IN — Account Overview (from captureAccountOverview)
  accountOverview: AccountOverview;
  // Dedicated Account Table (from scrapeOtherOffersDA)
  dedicatedAccounts: DedicatedAccountEntry[];
  // Offer Tab Table (from scrapeOtherOffersOfferTab)
  offers: OfferEntry[];
  // Total Usage — Voice / Data / SMS (from parseVoiceTab / parseDataTab / parseSMSTab)
  voice: UsageEntry[];
  data: UsageEntry[];
  sms: UsageEntry[];
  screenshots: PreTestScreenshot[];
}

export interface PreTestInputRow {
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  planBenefit?: string;
}

// ─── Service Class ────────────────────────────────────────────────────────

export class PreTestReportService {
  private preTestResults: PreTestReportResult[] = [];
  private inputRows: PreTestInputRow[] = [];
  private reportFileCache = new Map<string, { excelPath: string; htmlPath: string; pdfPath: string }>();

  // ── Data intake ──────────────────────────────────────────────────────────

  addPreTestResult(result: PreTestReportResult): void {
    this.preTestResults.push(result);
    console.log(
      `[PreTestReportService] Added PreTest result for MSISDN: ${result.msisdn} - Status: ${result.status} ` +
      `(Dedicated Accounts: ${result.dedicatedAccounts?.length || 0}, Offers: ${result.offers?.length || 0})`
    );
  }

  getPreTestResultCount(): number {
    return this.preTestResults.length;
  }

  addInputRows(rows: PreTestInputRow[]): void {
    this.inputRows = rows;
    console.log(`[PreTestReportService] Added ${rows.length} input row(s)`);
  }

  getInputRowCount(): number {
    return this.inputRows.length;
  }

  // ─── Shared Style & Head Helper ──────────────────────────────────────────

  private getHTMLHead(title: string, isPDF = false): string {
    const pageRules = isPDF ? `
    @page { size: A4; margin: 1.5cm 1.5cm 2cm 1.5cm; }
    @page :first { margin: 0; @bottom-center { content: none; } }
    body { margin: 0; padding: 0; }
    .page-break { page-break-after: always; }
    .section { page-break-inside: auto; }
    ` : '';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    ${pageRules}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: ${isPDF ? 'white' : '#f5f5f5'}; padding: ${isPDF ? '0' : '20px'}; color: #333; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: ${isPDF ? '20px 30px' : '30px'}; border-radius: ${isPDF ? '0' : '8px'}; ${isPDF ? '' : 'box-shadow: 0 2px 10px rgba(0,0,0,0.1);'} }
    h1 { color: #f38328; border-bottom: 3px solid #f38328; padding-bottom: 10px; margin-bottom: 15px; font-size: 22px; }
    h2 { color: #333; margin: 25px 0 10px 0; padding: 8px 0; border-bottom: 2px solid #eee; font-size: 16px; page-break-after: avoid; }
    h3 { color: #555; margin: 18px 0 10px 0; font-size: 14px; page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; font-size: 11px; page-break-inside: avoid; max-width: 100%; }
    th { background: #f38328; color: white; padding: 8px 10px; text-align: left; font-weight: 600; font-size: 10px; }
    td { padding: 6px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
    tr:nth-child(even) { background: #f9f9f9; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 10px; font-weight: 600; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-fail { background: #fdecea; color: #c0392b; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 15px 0 25px 0; }
    .summary-item { background: #f8f5f0; padding: 12px; border-radius: 6px; text-align: center; border-left: 4px solid #f38328; }
    .summary-item .number { font-size: 24px; font-weight: 700; color: #f38328; }
    .summary-item .label { font-size: 11px; color: #888; margin-top: 4px; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #888; }
    .info-box { background: #f8f5f0; padding: 12px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #f38328; font-size: 11px; }
    .info-box strong { color: #f38328; }
    .header-row { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; }
    .header-row .mrp-badge { background: #f38328; color: white; padding: 4px 14px; border-radius: 20px; font-weight: 600; font-size: 13px; }
    .in-details-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px; margin: 10px 0; }
    .in-detail-item { background: #f8f5f0; padding: 6px 10px; border-radius: 4px; border-left: 3px solid #f38328; }
    .in-detail-item strong { display: block; font-size: 10px; color: #888; text-transform: uppercase; }
    .in-detail-item span { font-size: 12px; font-weight: 500; }
    .screenshot-container { display: flex; flex-direction: column; gap: 15px; margin: 15px 0 25px 0; }
    .screenshot-item { background: #faf8f5; border: 1px solid #e0ddd8; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }
    .screenshot-item .screenshot-image { width: 100%; max-width: 100%; height: auto; display: block; margin: 0 auto; background: #f0f0f0; }
    .screenshot-item .screenshot-image img { width: 100%; height: auto; max-height: 500px; object-fit: contain; display: block; background: #ffffff; }
    .screenshot-item .screenshot-caption { padding: 10px 15px; background: #f5f3f0; border-top: 1px solid #e0ddd8; font-size: 11px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .screenshot-item .screenshot-caption .step-name { font-weight: 600; color: #f38328; }
    .screenshot-item .screenshot-caption .step-detail-text { color: #555; }
    .screenshot-item .screenshot-caption .step-time { color: #888; font-size: 10px; }
    .screenshot-counter { background: #f38328; color: white; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .no-screenshots { color: #888; font-style: italic; padding: 20px; text-align: center; background: #f9f9f9; border-radius: 8px; }
    .no-data { color: #888; font-style: italic; padding: 12px; }
    ${isPDF ? `
    .cover { width: 210mm; height: 297mm; margin: 0; position: relative; overflow: hidden; page-break-after: always; background: linear-gradient(135deg, #faf8f5 0%, #fff 50%, #f8f5f0 100%); }
    .cover::before { content: ''; position: absolute; top: 0; right: 0; width: 200px; height: 200px; background: linear-gradient(135deg, #f38328 0%, transparent 60%); opacity: 0.15; }
    .cover::after { content: ''; position: absolute; bottom: 0; left: 0; width: 300px; height: 300px; background: linear-gradient(315deg, #f38328 0%, transparent 60%); opacity: 0.1; }
    .cover-content { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; width: 80%; z-index: 1; }
    .cover-icon { font-size: 48px; color: #f38328; margin-bottom: 20px; }
    .cover-title { font-size: 28px; font-weight: 700; color: #333; margin-bottom: 10px; }
    .cover-subtitle { font-size: 14px; color: #888; margin-bottom: 40px; }
    .cover-meta { font-size: 12px; color: #555; line-height: 2.2; }
    .cover-meta strong { color: #f38328; }
    .cover-footer { position: absolute; bottom: 40px; left: 0; width: 100%; text-align: center; font-size: 11px; color: #999; z-index: 1; }
    .cover-decoration { position: absolute; top: 40px; left: 40px; width: 60px; height: 60px; border: 3px solid #f38328; opacity: 0.3; border-radius: 8px; z-index: 0; }
    .cover-decoration-2 { position: absolute; bottom: 100px; right: 40px; width: 80px; height: 80px; border: 3px solid #f38328; opacity: 0.2; border-radius: 50%; z-index: 0; }
    ` : ''}
  </style>
</head>`;
  }

  private getPDFCover(title: string, subtitle: string, metaItems: { label: string; value: string }[]): string {
  const metaHTML = metaItems.map(m => `<p><strong>${m.label}:</strong> ${m.value}</p>`).join('');
  return `
  <div class="cover">
    <div class="cover-decoration"></div>
    <div class="cover-decoration-2"></div>
    <div class="cover-content">
      <!-- Brand Logo Section -->
      <a class="brandWrap" href="index.html" style="text-decoration: none; display: flex; flex-direction: column; align-items: center; margin-bottom: 30px;">
        <div class="logoContainer" style="display: flex; align-items: center; gap: 12px;">
          <img src="./vi-logo.svg" alt="VI Logo" class="viLogo" style="height: 40px; width: auto;">
          <img src="https://qdegrees.com/img/logo.svg" alt="QDegrees Logo" class="brandLogo qdegreesLogo" style="height: 30px; width: auto;">
        </div>
        <span class="logoTagline" style="font-size: 11px; font-weight: 500; color: #999; margin-top: 2px; letter-spacing: .2px;">VI Sim Automation Platform</span>
      </a>
      <div class="cover-icon">&#9878;</div>
      <div class="cover-title">${title}</div>
      <div class="cover-subtitle">${subtitle}</div>
      <div class="cover-meta">${metaHTML}</div>
    </div>
    <div class="cover-footer">Generated by VI Sim Automation Platform &mdash; &copy; 2026 QDegrees Services Pvt. Ltd.</div>
  </div>`;
}

  // ─── File Path / Zip Helpers ──────────────────────────────────────────────

  private getSingleReportPaths(reportKey: string, reportBaseName: string, reportsDir: string): { excelPath: string; htmlPath: string; pdfPath: string } {
    const cachedPaths = this.reportFileCache.get(reportKey);
    if (cachedPaths) {
      return cachedPaths;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${reportBaseName}_${timestamp}`;
    const excelPath = path.join(reportsDir, `${baseName}.xlsx`);
    const htmlPath = path.join(reportsDir, `${baseName}.html`);
    const pdfPath = path.join(reportsDir, `${baseName}.pdf`);

    const paths = { excelPath, htmlPath, pdfPath };
    this.reportFileCache.set(reportKey, paths);
    return paths;
  }

  private safeDeleteFile(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      return;
    }
    try {
      fs.unlinkSync(filePath);
    } catch (error: any) {
      const message = error && error.message ? error.message : String(error);
      console.warn(`[PreTestReportService] Could not remove previous report file ${filePath}: ${message}`);
    }
  }

  private async createZipBundle(files: string[], zipPath: string): Promise<void> {
    const JSZip = require('jszip');
    const zip = new JSZip();

    files.filter((filePath) => fs.existsSync(filePath)).forEach((filePath) => {
      const fileName = path.basename(filePath);
      zip.file(fileName, fs.readFileSync(filePath));
    });

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(zipPath, buffer);
    console.log(`[PreTestReportService] ZIP bundle created: ${zipPath}`);
  }

  private async convertHTMLToPDF(htmlContent: string, outputPath: string): Promise<void> {
    const tempHtmlPath = outputPath.replace('.pdf', '_temp.html');
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    try {
      const { chromium } = require('playwright');
      const browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle' });
      await page.pdf({
        path: outputPath,
        format: 'A4',
        printBackground: true,
        margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' }
      });
      await browser.close();
      console.log(`[PreTestReportService] PDF generated via Playwright: ${outputPath}`);
    } catch (playwrightErr) {
      console.warn('[PreTestReportService] Playwright not available, trying puppeteer...');
      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
        const page = await browser.newPage();
        await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });
        await page.pdf({
          path: outputPath,
          format: 'A4',
          printBackground: true,
          margin: { top: '15mm', right: '15mm', bottom: '20mm', left: '15mm' }
        });
        await browser.close();
        console.log(`[PreTestReportService] PDF generated via Puppeteer: ${outputPath}`);
      } catch (puppeteerErr: any) {
        console.error('[PreTestReportService] Neither Playwright nor Puppeteer available.');
        console.error('[PreTestReportService] Install one of them: npm install playwright OR npm install puppeteer');
        throw new Error(`PDF conversion failed: ${puppeteerErr.message}`);
      }
    } finally {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
  }

  // ─── Shared Section Renderer (used by both HTML + PDF) ────────────────────
  // Renders: Customer IN - Account Overview | Dedicated Account Table | Offer Tab Table

  private renderPreTestSections(pt: PreTestReportResult): string {
    const ao = pt.accountOverview || {};
    const statusBadge = pt.status === 'Pass' ? 'badge-pass' : 'badge-fail';

    let html = `
    <div class="info-box">
      <strong>PreTest Status:</strong> <span class="badge ${statusBadge}">${pt.status}</span>
      <strong style="margin-left: 20px;">Reason:</strong> ${pt.reason || 'N/A'}
    </div>

    <h3>Customer IN &mdash; Identity</h3>
    <div class="in-details-grid">
      <div class="in-detail-item"><strong>Customer Name</strong><span>${pt.customerName || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Core Balance</strong><span>${pt.coreBalance || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Service Validity</strong><span>${pt.serviceValidity || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Account Status</strong><span>${pt.accountStatus || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>User Type</strong><span>${pt.userType || 'N/A'}</span></div>
    </div>

    <h3>Customer IN &mdash; Account Overview</h3>
    <div class="in-details-grid">
      <div class="in-detail-item"><strong>Activation Date</strong><span>${ao.activationDate || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Service Removal On</strong><span>${ao.serviceRemovalOn || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Supervision Expires On</strong><span>${ao.supervisionExpiresOn || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Main Balance</strong><span>${ao.mainBalance || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Service Fee Expires On</strong><span>${ao.serviceFeeExpiresOn || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Subscriber Status</strong><span>${ao.subscriberStatus || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Credit Clearance On</strong><span>${ao.creditClearanceOn || 'N/A'}</span></div>
    </div>

    <h3>Dedicated Account Table (${pt.dedicatedAccounts?.length || 0})</h3>
    ${(!pt.dedicatedAccounts || pt.dedicatedAccounts.length === 0) ? `<div class="no-data">No dedicated account entries found.</div>` : `
    <table>
      <thead>
        <tr><th>DA Name</th><th>DA ID</th><th>Start Date</th><th>Expiry Date</th><th>DA Value</th><th>Unit</th><th>Type</th></tr>
      </thead>
      <tbody>
        ${pt.dedicatedAccounts.map((da) => `
        <tr>
          <td>${da.daName || 'N/A'}</td>
          <td>${da.daId || 'N/A'}</td>
          <td>${da.startDate || 'N/A'}</td>
          <td>${da.expiryDate || 'N/A'}</td>
          <td>${da.daValue || 'N/A'}</td>
          <td>${da.unit || 'N/A'}</td>
          <td>${da.type || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}

    <h3>Offer Tab Table (${pt.offers?.length || 0})</h3>
    ${(!pt.offers || pt.offers.length === 0) ? `<div class="no-data">No offer tab entries found.</div>` : `
    <table>
      <thead>
        <tr><th>Offer Name</th><th>Offer ID</th><th>Product ID</th><th>Start Date &amp; Time</th><th>End Date &amp; Time</th><th>Offer Type</th></tr>
      </thead>
      <tbody>
        ${pt.offers.map((offer) => `
        <tr>
          <td>${offer.offerName || 'N/A'}</td>
          <td>${offer.offerId || 'N/A'}</td>
          <td>${offer.productId || 'N/A'}</td>
          <td>${offer.startDateTime || 'N/A'}</td>
          <td>${offer.endDateTime || 'N/A'}</td>
          <td>${offer.offerType || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}

    <h3>Total Usage &mdash; Voice / Call (${pt.voice?.length || 0})</h3>
    ${(!pt.voice || pt.voice.length === 0) ? `<div class="no-data">No active voice/call usage.</div>` : `
    <table>
      <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
      <tbody>
        ${pt.voice.map((v) => `
        <tr>
          <td>${v.offer_name || 'N/A'}</td>
          <td>${v.balance_left || 'N/A'}</td>
          <td>${v.category || 'N/A'}</td>
          <td>${v.expiry_date || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}

    <h3>Total Usage &mdash; Data (${pt.data?.length || 0})</h3>
    ${(!pt.data || pt.data.length === 0) ? `<div class="no-data">No active data usage.</div>` : `
    <table>
      <thead><tr><th>Offer Name</th><th>Total Quota</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
      <tbody>
        ${pt.data.map((d) => `
        <tr>
          <td>${d.offer_name || 'N/A'}</td>
          <td>${d.total_quota || 'N/A'}</td>
          <td>${d.balance_left || 'N/A'}</td>
          <td>${d.category || 'N/A'}</td>
          <td>${d.expiry_date || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}

    <h3>Total Usage &mdash; SMS (${pt.sms?.length || 0})</h3>
    ${(!pt.sms || pt.sms.length === 0) ? `<div class="no-data">No active SMS usage.</div>` : `
    <table>
      <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
      <tbody>
        ${pt.sms.map((s) => `
        <tr>
          <td>${s.offer_name || 'N/A'}</td>
          <td>${s.balance_left || 'N/A'}</td>
          <td>${s.category || 'N/A'}</td>
          <td>${s.expiry_date || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`}
    `;

    return html;
  }

  private renderScreenshots(screenshots: PreTestScreenshot[]): string {
    if (!screenshots || screenshots.length === 0) {
      return `<div class="no-screenshots">No screenshots found for this MSISDN.</div>`;
    }

    return `<div class="screenshot-container">
      ${screenshots.map((s, index) => {
        const imageSrc = s.fullPath || `/screenshots/${s.screenshotFile}`;
        const stepName = s.stepName || 'Screenshot';
        const capturedTime = s.capturedAt ? new Date(s.capturedAt).toLocaleString() : '';
        return `
      <div class="screenshot-item">
        <div class="screenshot-image">
          <img src="${imageSrc}" alt="${stepName}" loading="lazy">
        </div>
        <div class="screenshot-caption">
          <span>
            <span class="screenshot-counter">#${index + 1}</span>
            <span class="step-name">${stepName}</span>
            <span class="step-detail-text">&mdash; ${s.screenshotFile}</span>
          </span>
          <span class="step-time">${capturedTime}</span>
        </div>
      </div>`;
      }).join('')}
    </div>`;
  }

  // ─── HTML Report (interactive, screen viewing) ────────────────────────────

  private generateIndividualHTMLReport(row: PreTestInputRow): string {
    const rowPreTest = this.preTestResults.filter(r => r.msisdn === row.msisdn);
    const totalDA = rowPreTest.reduce((sum, pt) => sum + (pt.dedicatedAccounts?.length || 0), 0);
    const totalOffers = rowPreTest.reduce((sum, pt) => sum + (pt.offers?.length || 0), 0);
    const totalVoice = rowPreTest.reduce((sum, pt) => sum + (pt.voice?.length || 0), 0);
    const totalData = rowPreTest.reduce((sum, pt) => sum + (pt.data?.length || 0), 0);
    const totalSms = rowPreTest.reduce((sum, pt) => sum + (pt.sms?.length || 0), 0);
    const totalScreenshots = rowPreTest.reduce((sum, pt) => sum + (pt.screenshots?.length || 0), 0);
    const overallStatus = rowPreTest.length > 0 && rowPreTest.every(r => r.status === 'Pass') ? 'Pass' : 'Fail';

    let html = `${this.getHTMLHead(`PreTest Report - ${row.msisdn}`)}
<body>
  <div class="container">
    <div class="header-row">
      <h1>PreTest Verification Report</h1>
      <span class="mrp-badge">MRP &#8377;${row.rechargeMRP}</span>
    </div>

    <div class="summary-grid">
      <div class="summary-item"><div class="number">${row.msisdn}</div><div class="label">MSISDN</div></div>
      <div class="summary-item"><div class="number">${row.circle}</div><div class="label">Circle</div></div>
      <div class="summary-item"><div class="number">${overallStatus}</div><div class="label">PreTest Status</div></div>
      <div class="summary-item"><div class="number">${totalDA}</div><div class="label">Dedicated Accounts</div></div>
      <div class="summary-item"><div class="number">${totalOffers}</div><div class="label">Offers</div></div>
      <div class="summary-item"><div class="number">${totalVoice}</div><div class="label">Voice Entries</div></div>
      <div class="summary-item"><div class="number">${totalData}</div><div class="label">Data Entries</div></div>
      <div class="summary-item"><div class="number">${totalSms}</div><div class="label">SMS Entries</div></div>
      <div class="summary-item"><div class="number">${totalScreenshots}</div><div class="label">Screenshots</div></div>
    </div>
`;

    if (rowPreTest.length === 0) {
      html += `<p style="color: #888;">No PreTest results found for this MSISDN.</p>`;
    } else {
      rowPreTest.forEach((pt) => {
        html += this.renderPreTestSections(pt);
      });
    }

    html += `
    <h2>Screenshots (${totalScreenshots})</h2>
    ${this.renderScreenshots(rowPreTest.flatMap(pt => pt.screenshots || []))}

    <div class="footer">
      <p>Report generated by VI Sim Automation Platform</p>
      <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  // ─── PDF Report (with cover page) ──────────────────────────────────────────

  private generateIndividualPDFHTMLReport(row: PreTestInputRow): string {
    const rowPreTest = this.preTestResults.filter(r => r.msisdn === row.msisdn);
    const totalDA = rowPreTest.reduce((sum, pt) => sum + (pt.dedicatedAccounts?.length || 0), 0);
    const totalOffers = rowPreTest.reduce((sum, pt) => sum + (pt.offers?.length || 0), 0);
    const totalVoice = rowPreTest.reduce((sum, pt) => sum + (pt.voice?.length || 0), 0);
    const totalData = rowPreTest.reduce((sum, pt) => sum + (pt.data?.length || 0), 0);
    const totalSms = rowPreTest.reduce((sum, pt) => sum + (pt.sms?.length || 0), 0);
    const totalScreenshots = rowPreTest.reduce((sum, pt) => sum + (pt.screenshots?.length || 0), 0);
    const overallStatus = rowPreTest.length > 0 && rowPreTest.every(r => r.status === 'Pass') ? 'Pass' : 'Fail';

    const cover = this.getPDFCover(
      'PreTest Verification Report',
      `MSISDN ${row.msisdn} &mdash; Circle ${row.circle}`,
      [
        { label: 'Recharge MRP', value: `&#8377;${row.rechargeMRP}` },
        { label: 'PreTest Status', value: overallStatus },
        { label: 'Dedicated Accounts', value: String(totalDA) },
        { label: 'Offers', value: String(totalOffers) },
        { label: 'Voice / Data / SMS Entries', value: `${totalVoice} / ${totalData} / ${totalSms}` },
        { label: 'Generated', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
      ]
    );

    let html = `${this.getHTMLHead(`PreTest Report - ${row.msisdn}`, true)}
<body>
${cover}
  <div class="container">
    <h1>PreTest Verification &mdash; ${row.msisdn}</h1>
`;

    if (rowPreTest.length === 0) {
      html += `<p style="color: #888;">No PreTest results found for this MSISDN.</p>`;
    } else {
      rowPreTest.forEach((pt, idx) => {
        html += `<div class="section">${this.renderPreTestSections(pt)}</div>`;
        if (idx < rowPreTest.length - 1) html += `<div class="page-break"></div>`;
      });
    }

    html += `
    <div class="section page-break">
      <h2>Screenshots (${totalScreenshots})</h2>
      ${this.renderScreenshots(rowPreTest.flatMap(pt => pt.screenshots || []))}
    </div>

    <div class="footer">
      <p>Report generated by VI Sim Automation Platform</p>
      <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  // ─── Excel Sheet Builders ───────────────────────────────────────────────

  private buildSheets(msisdn: string) {
    const rowPreTest = this.preTestResults.filter(r => r.msisdn === msisdn);

    const summarySheetData = rowPreTest.map((pt) => ({
      'MSISDN': pt.msisdn,
      'Circle': pt.circle,
      'Recharge MRP': pt.rechargeMRP,
      'PreTest Status': pt.status,
      'Reason': pt.reason,
      'Customer Name': pt.customerName || 'N/A',
      'Core Balance': pt.coreBalance || 'N/A',
      'Service Validity': pt.serviceValidity || 'N/A',
      'Account Status': pt.accountStatus || 'N/A',
      'User Type': pt.userType || 'N/A',
      'Dedicated Accounts': pt.dedicatedAccounts?.length || 0,
      'Offers': pt.offers?.length || 0,
      'Voice Entries': pt.voice?.length || 0,
      'Data Entries': pt.data?.length || 0,
      'SMS Entries': pt.sms?.length || 0,
      'Screenshot Count': pt.screenshots?.length || 0
    }));

    const accountOverviewSheetData = rowPreTest.map((pt) => ({
      'MSISDN': pt.msisdn,
      'Activation Date': pt.accountOverview?.activationDate || 'N/A',
      'Service Removal On': pt.accountOverview?.serviceRemovalOn || 'N/A',
      'Supervision Expires On': pt.accountOverview?.supervisionExpiresOn || 'N/A',
      'Main Balance': pt.accountOverview?.mainBalance || 'N/A',
      'Service Fee Expires On': pt.accountOverview?.serviceFeeExpiresOn || 'N/A',
      'Subscriber Status': pt.accountOverview?.subscriberStatus || 'N/A',
      'Credit Clearance On': pt.accountOverview?.creditClearanceOn || 'N/A'
    }));

    const daSheetData: any[] = [];
    rowPreTest.forEach((pt) => {
      (pt.dedicatedAccounts || []).forEach((da) => {
        daSheetData.push({
          'MSISDN': pt.msisdn,
          'DA Name': da.daName || 'N/A',
          'DA ID': da.daId || 'N/A',
          'Start Date': da.startDate || 'N/A',
          'Expiry Date': da.expiryDate || 'N/A',
          'DA Value': da.daValue || 'N/A',
          'Unit': da.unit || 'N/A',
          'Type': da.type || 'N/A'
        });
      });
    });

    const offersSheetData: any[] = [];
    rowPreTest.forEach((pt) => {
      (pt.offers || []).forEach((offer) => {
        offersSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': offer.offerName || 'N/A',
          'Offer ID': offer.offerId || 'N/A',
          'Product ID': offer.productId || 'N/A',
          'Start Date & Time': offer.startDateTime || 'N/A',
          'End Date & Time': offer.endDateTime || 'N/A',
          'Offer Type': offer.offerType || 'N/A'
        });
      });
    });

    const voiceSheetData: any[] = [];
    rowPreTest.forEach((pt) => {
      (pt.voice || []).forEach((v) => {
        voiceSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': v.offer_name || 'N/A',
          'Balance Left': v.balance_left || 'N/A',
          'Category': v.category || 'N/A',
          'Expiry Date': v.expiry_date || 'N/A'
        });
      });
    });

    const dataSheetData: any[] = [];
    rowPreTest.forEach((pt) => {
      (pt.data || []).forEach((d) => {
        dataSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': d.offer_name || 'N/A',
          'Total Quota': d.total_quota || 'N/A',
          'Balance Left': d.balance_left || 'N/A',
          'Category': d.category || 'N/A',
          'Expiry Date': d.expiry_date || 'N/A'
        });
      });
    });

    const smsSheetData: any[] = [];
    rowPreTest.forEach((pt) => {
      (pt.sms || []).forEach((s) => {
        smsSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': s.offer_name || 'N/A',
          'Balance Left': s.balance_left || 'N/A',
          'Category': s.category || 'N/A',
          'Expiry Date': s.expiry_date || 'N/A'
        });
      });
    });

    const screenshotSheetData: any[] = [];
    rowPreTest.forEach((pt) => {
      (pt.screenshots || []).forEach((s) => {
        screenshotSheetData.push({
          'Sr. No.': s.srNo,
          'MSISDN': s.msisdn,
          'File': s.screenshotFile,
          'Captured At': s.capturedAt,
          'Step Name': s.stepName || 'General'
        });
      });
    });

    return { summarySheetData, accountOverviewSheetData, daSheetData, offersSheetData, voiceSheetData, dataSheetData, smsSheetData, screenshotSheetData };
  }

  // ─── Generate Individual Excel + HTML + PDF Report for a Single Row ──────

  async writeIndividualReport(row: PreTestInputRow): Promise<{ excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }> {
    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const finalReportsDir = path.resolve('./finalreports');
    if (!fs.existsSync(finalReportsDir)) {
      fs.mkdirSync(finalReportsDir, { recursive: true });
    }

    const msisdn = row.msisdn || 'unknown';
    const circle = row.circle || 'unknown';
    const rechargeMRP = row.rechargeMRP || 'unknown';
    const reportBaseName = `PreTest_Report_${msisdn}_${circle}_MRP${rechargeMRP}`;
    const { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath } = this.getSingleReportPaths(
      `pretest-individual:${msisdn}:${circle}:${rechargeMRP}`,
      reportBaseName,
      reportsDir
    );

    const { summarySheetData, accountOverviewSheetData, daSheetData, offersSheetData, voiceSheetData, dataSheetData, smsSheetData, screenshotSheetData } = this.buildSheets(msisdn);

    // ── Create the workbook ──────────────────────────────────────────────
    const workbook = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(summarySheetData.length ? summarySheetData : [{ 'MSISDN': msisdn, 'Note': 'No PreTest result recorded' }]),
      'PreTest Summary'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(accountOverviewSheetData.length ? accountOverviewSheetData : [{ 'MSISDN': msisdn, 'Note': 'No account overview captured' }]),
      'Customer IN - Account Overview'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(daSheetData.length ? daSheetData : [{ 'MSISDN': msisdn, 'Note': 'No dedicated account entries' }]),
      'Dedicated Account Table'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(offersSheetData.length ? offersSheetData : [{ 'MSISDN': msisdn, 'Note': 'No offer tab entries' }]),
      'Offer Tab Table'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(voiceSheetData.length ? voiceSheetData : [{ 'MSISDN': msisdn, 'Note': 'No active voice/call usage' }]),
      'Voice Usage'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(dataSheetData.length ? dataSheetData : [{ 'MSISDN': msisdn, 'Note': 'No active data usage' }]),
      'Data Usage'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(smsSheetData.length ? smsSheetData : [{ 'MSISDN': msisdn, 'Note': 'No active SMS usage' }]),
      'SMS Usage'
    );
    xlsx.utils.book_append_sheet(
      workbook,
      xlsx.utils.json_to_sheet(screenshotSheetData.length ? screenshotSheetData : [{ 'MSISDN': msisdn, 'Note': 'No screenshots captured' }]),
      'Screenshots'
    );

    xlsx.writeFile(workbook, excelFilepath);
    console.log(`[PreTestReportService] Individual Excel report: ${excelFilepath}`);

    // ── Generate Interactive HTML report ─────────────────────────────────
    const htmlContent = this.generateIndividualHTMLReport(row);
    fs.writeFileSync(htmlFilepath, htmlContent, 'utf8');
    console.log(`[PreTestReportService] Individual HTML report: ${htmlFilepath}`);

    // ── Generate PDF report ──────────────────────────────────────────────
    try {
      const pdfHTMLContent = this.generateIndividualPDFHTMLReport(row);
      await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
      console.log(`[PreTestReportService] Individual PDF report: ${pdfFilepath}`);
    } catch (err: any) {
      console.error(`[PreTestReportService] PDF generation failed: ${err.message}`);
    }

    const zipPath = path.join(finalReportsDir, `${path.basename(excelFilepath, '.xlsx')}.zip`);
    await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
  }

  // ─── Generate All Individual Reports (one per input row) ─────────────────

  async writeAllIndividualReports(): Promise<Array<{ row: PreTestInputRow; excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }>> {
    const results: Array<{ row: PreTestInputRow; excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }> = [];

    for (const row of this.inputRows) {
      const paths = await this.writeIndividualReport(row);
      results.push({ row, ...paths });
    }

    return results;
  }

  // ─── Consolidated Report Across All MSISDNs ───────────────────────────────

  async writeConsolidatedReport(): Promise<{ excelPath: string; htmlPath: string; pdfPath: string }> {
    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const reportBaseName = `PreTest_Report_Consolidated`;
    const { excelPath, htmlPath, pdfPath } = this.getSingleReportPaths('pretest-consolidated', reportBaseName, reportsDir);

    const workbook = xlsx.utils.book_new();

    const allSummary = this.preTestResults.map((pt) => ({
      'MSISDN': pt.msisdn,
      'Circle': pt.circle,
      'Recharge MRP': pt.rechargeMRP,
      'PreTest Status': pt.status,
      'Reason': pt.reason,
      'Customer Name': pt.customerName || 'N/A',
      'Dedicated Accounts': pt.dedicatedAccounts?.length || 0,
      'Offers': pt.offers?.length || 0,
      'Voice Entries': pt.voice?.length || 0,
      'Data Entries': pt.data?.length || 0,
      'SMS Entries': pt.sms?.length || 0,
      'Screenshot Count': pt.screenshots?.length || 0
    }));

    const allAccountOverview = this.preTestResults.map((pt) => ({
      'MSISDN': pt.msisdn,
      'Activation Date': pt.accountOverview?.activationDate || 'N/A',
      'Service Removal On': pt.accountOverview?.serviceRemovalOn || 'N/A',
      'Supervision Expires On': pt.accountOverview?.supervisionExpiresOn || 'N/A',
      'Main Balance': pt.accountOverview?.mainBalance || 'N/A',
      'Service Fee Expires On': pt.accountOverview?.serviceFeeExpiresOn || 'N/A',
      'Subscriber Status': pt.accountOverview?.subscriberStatus || 'N/A',
      'Credit Clearance On': pt.accountOverview?.creditClearanceOn || 'N/A'
    }));

    const allDA: any[] = [];
    this.preTestResults.forEach((pt) => (pt.dedicatedAccounts || []).forEach((da) => allDA.push({
      'MSISDN': pt.msisdn, 'DA Name': da.daName || 'N/A', 'DA ID': da.daId || 'N/A',
      'Start Date': da.startDate || 'N/A', 'Expiry Date': da.expiryDate || 'N/A',
      'DA Value': da.daValue || 'N/A', 'Unit': da.unit || 'N/A', 'Type': da.type || 'N/A'
    })));

    const allOffers: any[] = [];
    this.preTestResults.forEach((pt) => (pt.offers || []).forEach((offer) => allOffers.push({
      'MSISDN': pt.msisdn, 'Offer Name': offer.offerName || 'N/A', 'Offer ID': offer.offerId || 'N/A',
      'Product ID': offer.productId || 'N/A', 'Start Date & Time': offer.startDateTime || 'N/A',
      'End Date & Time': offer.endDateTime || 'N/A', 'Offer Type': offer.offerType || 'N/A'
    })));

    const allVoice: any[] = [];
    this.preTestResults.forEach((pt) => (pt.voice || []).forEach((v) => allVoice.push({
      'MSISDN': pt.msisdn, 'Offer Name': v.offer_name || 'N/A', 'Balance Left': v.balance_left || 'N/A',
      'Category': v.category || 'N/A', 'Expiry Date': v.expiry_date || 'N/A'
    })));

    const allData: any[] = [];
    this.preTestResults.forEach((pt) => (pt.data || []).forEach((d) => allData.push({
      'MSISDN': pt.msisdn, 'Offer Name': d.offer_name || 'N/A', 'Total Quota': d.total_quota || 'N/A',
      'Balance Left': d.balance_left || 'N/A', 'Category': d.category || 'N/A', 'Expiry Date': d.expiry_date || 'N/A'
    })));

    const allSms: any[] = [];
    this.preTestResults.forEach((pt) => (pt.sms || []).forEach((s) => allSms.push({
      'MSISDN': pt.msisdn, 'Offer Name': s.offer_name || 'N/A', 'Balance Left': s.balance_left || 'N/A',
      'Category': s.category || 'N/A', 'Expiry Date': s.expiry_date || 'N/A'
    })));

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allSummary.length ? allSummary : [{ 'Note': 'No PreTest results recorded' }]), 'PreTest Summary');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allAccountOverview.length ? allAccountOverview : [{ 'Note': 'No data' }]), 'Customer IN - Account Overview');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allDA.length ? allDA : [{ 'Note': 'No data' }]), 'Dedicated Account Table');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allOffers.length ? allOffers : [{ 'Note': 'No data' }]), 'Offer Tab Table');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allVoice.length ? allVoice : [{ 'Note': 'No data' }]), 'Voice Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allData.length ? allData : [{ 'Note': 'No data' }]), 'Data Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allSms.length ? allSms : [{ 'Note': 'No data' }]), 'SMS Usage');

    xlsx.writeFile(workbook, excelPath);
    console.log(`[PreTestReportService] Consolidated Excel report: ${excelPath}`);

    let html = `${this.getHTMLHead('PreTest Consolidated Report')}
<body>
  <div class="container">
    <h1>PreTest Verification &mdash; Consolidated Report</h1>
    <div class="summary-grid">
      <div class="summary-item"><div class="number">${this.preTestResults.length}</div><div class="label">Total PreTests</div></div>
      <div class="summary-item"><div class="number">${this.preTestResults.filter(r => r.status === 'Pass').length}</div><div class="label">Passed</div></div>
      <div class="summary-item"><div class="number">${this.preTestResults.filter(r => r.status === 'Fail').length}</div><div class="label">Failed</div></div>
    </div>
`;
    this.preTestResults.forEach((pt) => {
      html += `<h2>${pt.msisdn} &mdash; ${pt.circle}</h2>`;
      html += this.renderPreTestSections(pt);
    });
    html += `
    <div class="footer">
      <p>Report generated by VI Sim Automation Platform</p>
      <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
    </div>
  </div>
</body>
</html>`;

    fs.writeFileSync(htmlPath, html, 'utf8');
    console.log(`[PreTestReportService] Consolidated HTML report: ${htmlPath}`);

    try {
      await this.convertHTMLToPDF(html, pdfPath);
      console.log(`[PreTestReportService] Consolidated PDF report: ${pdfPath}`);
    } catch (err: any) {
      console.error(`[PreTestReportService] Consolidated PDF generation failed: ${err.message}`);
    }

    return { excelPath, htmlPath, pdfPath };
  }
}