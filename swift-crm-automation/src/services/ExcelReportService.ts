// src/services/ExcelReportService.ts
// FIX: Proper HTML and PDF generation for SIM_Recharge_Report and Analysis_Report

import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────

export interface ViAppResult {
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  viAppFlag: string;
  ran: boolean;
  status: 'Pass' | 'Fail' | 'Skip' | 'Error' | 'Mismatch';
  matchedPlanMRP?: string;
  expectedBenefit?: string;
  expectedNotification?: string;
  lastRechargeLabel?: string;
  lastRechargeAmount?: string;
  mrpActualNumeric?: string;
  mrpMatched?: boolean;
  packEndsOnDate?: string;
  mainBalance?: string;
  serviceValidity?: string;
  repeatRechargeTitle?: string;
  actualBenefit?: string;
  benefitMatched?: boolean;
  smsDateIsToday?: boolean;
  smsMatched?: boolean;
  screenshotCount: number;
  screenshots: string[];
  remarks?: string;
}

export interface INResult {
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  status: 'Pass' | 'Fail' | 'Error';
  customerName: string;
  coreBalance: string;
  serviceValidity: string;
  accountStatus: string;
  userType: string;
  activationDate: string;
  serviceRemovalOn: string;
  supervisionExpiresOn: string;
  mainBalance: string;
  serviceFeeExpiresOn: string;
  subscriberStatus: string;
  creditClearanceOn: string;
  dedicatedAccounts: any[];
  offers: any[];
  screenshotCount: number;
  screenshots: string[];
  remarks?: string;
}

export interface PreTestResult {
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  status: 'Pass' | 'Fail';
  reason: string;
  customerName?: string;
  coreBalance?: string;
  serviceValidity?: string;
  accountStatus?: string;
  userType?: string;
  accountOverview?: any;
  voice: any[];
  data: any[];
  sms: any[];
  dedicatedAccounts?: any[];
  offers?: any[];
  screenshotCount: number;
  screenshots: string[];
}

interface UATResult {
  srNo: number;
  transactionId: string;
  activationDateTime: string;
  validity: string;
  mrp: string;
  activationMode: string;
  currentCoreBalance: string;
  etopupTransactionId: string;
  retailerMsisdn: string;
  name: string;
  category: string;
  benefits: string;
  detailValidity: string;
  msisdn: string;
  circle: string;
  planName: string;
  rechargeNotification: string;
  inStatus: string;
  swiftStatus: string;
  viAppStatus: string;
  reason?: string;
  screenshots: string[];
  accountStatus?: string;
  userType?: string;
  allOfferHistory?: any[];
  voiceUsage?: any[];
  dataUsage?: any[];
  smsUsage?: any[];
  unlimitedOffers?: any[];
  vasOffers?: any[];
  upssPromotional?: any[];
}

interface ScreenshotIndex {
  srNo: number;
  msisdn: string;
  screenshotFile: string;
  fullPath: string;
  capturedAt: string;
  stepName: string;
}

interface InputRow {
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  recharge: string;
  swift: string;
  inFlag: string;
  viApp: string;
  planBenefit: string;
  rechargeNotification: string;
}

export interface UpssPromoHistoryItem {
  msisdn: string;
  applied_date: string;
  start_date: string;
  promotion_name: string;
  description: string;
  mode_of_activation: string;
  promotion_status: string;
}

// ─── Analysis Report Interfaces ──────────────────────────────────────────

// export interface AnalysisReportData {
//   testCase: {
//     name: string;
//     msisdn: string;
//     testDate: string;
//     overallStatus: 'Pass' | 'Fail';
//     swiftStatus: 'Pass' | 'Fail' | 'Skip';
//     inStatus: 'Pass' | 'Fail' | 'Skip';
//   };
//   comparison: Array<{
//     parameter: string;
//     expected: string;
//     actual: string;
//     status: 'Pass' | 'Fail';
//   }>;
//   swiftAnalysis: {
//     executionFlow: Array<{ step: string; value: string; status?: 'Pass' | 'Fail' }>;
//     results: Array<{ field: string; expected: string; actual: string; status: 'Pass' | 'Fail' }>;
//     voiceUsage: Array<{ offerName: string; balanceLeft: string; category: string; expiryDate: string; status: string }>;
//     dataUsage: Array<{ msisdn: string; note: string; status: string }>;
//     smsUsage: Array<{ msisdn: string; note: string; status: string }>;
//     vasUsage?: Array<{ vasName: string; category: string; activationDate: string; expiryDate: string; status: string }>;
//     failures: Array<{ type: string; expected: string; actual: string; severity: string }>;
//     overallStatus: 'Pass' | 'Fail';
//   };
//   inAnalysis: {
//     executionFlow: Array<{ step: string; value: string; status?: 'Pass' | 'Fail' }>;
//     results: Array<{ field: string; value: string; expected: string; status: 'Pass' | 'Fail' }>;
//     dedicatedAccounts: Array<{ daName: string; daId: string; startDate: string; expiryDate: string; daValue: string; unit: string; type: string }>;
//     offers: Array<{ offerName: string; offerId: string; startDateTime: string; endDateTime: string; offerType: string }>;
//     failures: Array<{ type: string; expected: string; actual: string; severity: string }>;
//     overallStatus: 'Pass' | 'Fail';
//   };
//   rootCause: {
//     expectedPlan: string;
//     actualPlan: string;
//     issues: string[];
//     summary: string;
//   };
//   timeline: Array<{ timestamp: string; event: string; system: string }>;
//   screenshots: Array<{ srNo: number; file: string; capturedAt: string; stepName: string }>;
//   recommendations: Array<{ priority: string; issue: string; recommendation: string; owner: string }>;
//   appendix: {
//     inputData: Record<string, string>;
//     uatResults: Record<string, string>;
//     swiftVoiceUsage: Array<Record<string, string>>;
//     inResults: Record<string, string>;
//     inDedicatedAccounts: Array<Record<string, string>>;
//     inOffers: Array<Record<string, string>>;
//   };
// }

export interface AnalysisReportData {
  testCase: {
    name: string;
    msisdn: string;
    testDate: string;
    overallStatus: 'Pass' | 'Fail';
    swiftStatus: 'Pass' | 'Fail' | 'Skip';
    inStatus: 'Pass' | 'Fail' | 'Skip';
    // ─── NEW: PreTest and VI App status ──────────────────────────────
    preTestStatus: 'Pass' | 'Fail' | 'Skip';
    viAppStatus: 'Pass' | 'Fail' | 'Skip' | 'Error';
  };
  comparison: Array<{
    parameter: string;
    expected: string;
    actual: string;
    status: 'Pass' | 'Fail';
  }>;
  swiftAnalysis: {
    executionFlow: Array<{ step: string; value: string; status?: 'Pass' | 'Fail' }>;
    results: Array<{ field: string; expected: string; actual: string; status: 'Pass' | 'Fail' }>;
    voiceUsage: Array<{ offerName: string; balanceLeft: string; category: string; expiryDate: string; status: string }>;
    dataUsage: Array<{ msisdn: string; note: string; status: string }>;
    smsUsage: Array<{ msisdn: string; note: string; status: string }>;
    vasUsage?: Array<{ vasName: string; category: string; activationDate: string; expiryDate: string; status: string }>;
    failures: Array<{ type: string; expected: string; actual: string; severity: string }>;
    overallStatus: 'Pass' | 'Fail';
  };
  inAnalysis: {
    executionFlow: Array<{ step: string; value: string; status?: 'Pass' | 'Fail' }>;
    results: Array<{ field: string; value: string; expected: string; status: 'Pass' | 'Fail' }>;
    dedicatedAccounts: Array<{ daName: string; daId: string; startDate: string; expiryDate: string; daValue: string; unit: string; type: string }>;
    offers: Array<{ offerName: string; offerId: string; startDateTime: string; endDateTime: string; offerType: string }>;
    failures: Array<{ type: string; expected: string; actual: string; severity: string }>;
    overallStatus: 'Pass' | 'Fail';
  };
  rootCause: {
    expectedPlan: string;
    actualPlan: string;
    issues: string[];
    summary: string;
  };
  timeline: Array<{ timestamp: string; event: string; system: string }>;
  screenshots: Array<{ srNo: number; file: string; capturedAt: string; stepName: string }>;
  recommendations: Array<{ priority: string; issue: string; recommendation: string; owner: string }>;
  // ─── NEW: PreTest Data ──────────────────────────────────────────────
  preTestSummary?: {
    status: 'Pass' | 'Fail';
    reason: string;
    customerName: string;
    coreBalance: string;
    serviceValidity: string;
    accountStatus: string;
    userType: string;
    dedicatedAccounts: any[];
    offers: any[];
    voice: any[];
    data: any[];
    sms: any[];
  };
  preTestCombined?: any[];
  // ─── NEW: VI App Data ──────────────────────────────────────────────
  viAppResult?: ViAppResult;
  appendix: {
    inputData: Record<string, string>;
    uatResults: Record<string, string>;
    swiftVoiceUsage: Array<Record<string, string>>;
    inResults: Record<string, string>;
    inDedicatedAccounts: Array<Record<string, string>>;
    inOffers: Array<Record<string, string>>;
  };
}

// ─── Service Class ────────────────────────────────────────────────────────

export class ExcelReportService {
  private uatResults: UATResult[] = [];
  private inResults: INResult[] = [];
  private screenshotIndex: ScreenshotIndex[] = [];
  private inputRows: InputRow[] = [];
  private rowScreenshots: Map<string, string[]> = new Map();
  private viAppResults: ViAppResult[] = [];
  private reportFileCache = new Map<string, { excelPath: string; htmlPath: string; pdfPath: string }>();
  private upssPromoHistory: UpssPromoHistoryItem[] = [];
  private preTestResults: PreTestResult[] = [];
  private analysisReports: AnalysisReportData[] = [];

  // ── Helper: Deduplicate Array ──────────────────────────────────────────

  private deduplicateArray<T>(arr: T[], keyFn: (item: T) => string): T[] {
    const seen = new Map<string, T>();
    for (const item of arr) {
      const key = keyFn(item);
      if (!seen.has(key)) {
        seen.set(key, item);
      }
    }
    return Array.from(seen.values());
  }

  // ── Helper: Safely get unique values from any array ────────────────────

  private getUniqueItems(arr: any[], fields: string[]): any[] {
    if (!arr || arr.length === 0) return [];
    
    const seen = new Set<string>();
    const unique: any[] = [];
    
    for (const item of arr) {
      let keyParts: string[] = [];
      for (const field of fields) {
        const value = item[field] || item[field.toLowerCase()] || '';
        keyParts.push(String(value).trim());
      }
      const key = keyParts.join('|');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(item);
      }
    }
    return unique;
  }

  // ── HTML to PDF Conversion Helper ──────────────────────────────────────

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
      console.log(`[ExcelReportService] PDF generated via Playwright: ${outputPath}`);
    } catch (playwrightErr) {
      console.warn('[ExcelReportService] Playwright not available, trying puppeteer...');
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
        console.log(`[ExcelReportService] PDF generated via Puppeteer: ${outputPath}`);
      } catch (puppeteerErr: any) {
        console.error('[ExcelReportService] Neither Playwright nor Puppeteer available.');
        console.error('[ExcelReportService] Install one of them: npm install playwright OR npm install puppeteer');
        throw new Error(`PDF conversion failed: ${puppeteerErr.message}`);
      }
    } finally {
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
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
    .badge-skip { background: #f5f5f5; color: #888; }
    .badge-error { background: #fff3e0; color: #e65100; }
    .badge-critical { background: #fdecea; color: #c0392b; font-weight: 700; }
    .badge-high { background: #ffebee; color: #c62828; }
    .badge-medium { background: #fff3e0; color: #e65100; }
    .badge-low { background: #f5f5f5; color: #888; }
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
        <span class="logoTagline" style="font-size: 11px; font-weight: 500; color: #888; margin-top: 2px; letter-spacing: .2px;">VI Sim Automation Platform</span>
      </a>
      <div class="cover-icon">&#128640;</div>
      <div class="cover-title">${title}</div>
      <div class="cover-subtitle">${subtitle}</div>
      <div class="cover-meta">${metaHTML}</div>
    </div>
    <div class="cover-footer">Generated by VI Sim Automation Platform &mdash; &copy; 2026 QDegrees Services Pvt. Ltd.</div>
  </div>`;
}

  // ─── Generate Full HTML for Individual Report ──────────────────────────────

  private generateIndividualHTMLReport(row: InputRow): string {
    const msisdn = row.msisdn || 'unknown';
    const circle = row.circle || 'unknown';
    const rechargeMRP = row.rechargeMRP || 'unknown';

    const rowUatResults = this.uatResults.filter(r => r.msisdn === msisdn);
    const rowInResults = this.inResults.filter(r => r.msisdn === msisdn);
    const rowViAppResults = this.viAppResults.filter(r => r.msisdn === msisdn);
    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === msisdn);

    let html = `${this.getHTMLHead(`SIM Recharge Report - ${msisdn}`)}
<body>
  <div class="container">
    <div class="header-row">
      <h1>SIM Recharge Report</h1>
      <span class="mrp-badge">MRP &#8377;${rechargeMRP}</span>
    </div>

    <div class="summary-grid">
      <div class="summary-item"><div class="number">${msisdn}</div><div class="label">MSISDN</div></div>
      <div class="summary-item"><div class="number">${circle}</div><div class="label">Circle</div></div>
      <div class="summary-item"><div class="number">&#8377;${rechargeMRP}</div><div class="label">Recharge MRP</div></div>
      <div class="summary-item"><div class="number">${rowUatResults.length}</div><div class="label">UAT Results</div></div>
      <div class="summary-item"><div class="number">${rowInResults.length}</div><div class="label">IN Results</div></div>
      <div class="summary-item"><div class="number">${rowViAppResults.length}</div><div class="label">VI App Results</div></div>
      <div class="summary-item"><div class="number">${rowScreenshots.length}</div><div class="label">Screenshots</div></div>
    </div>

    <h2>Input Data</h2>
    <div class="in-details-grid">
      <div class="in-detail-item"><strong>MSISDN</strong><span>${row.msisdn}</span></div>
      <div class="in-detail-item"><strong>Circle</strong><span>${row.circle}</span></div>
      <div class="in-detail-item"><strong>Recharge MRP</strong><span>&#8377;${row.rechargeMRP}</span></div>
      <div class="in-detail-item"><strong>Recharge</strong><span>${row.recharge === 'yes' ? 'Yes' : 'No'}</span></div>
      <div class="in-detail-item"><strong>SWIFT</strong><span>${row.swift === 'yes' ? 'Yes' : 'No'}</span></div>
      <div class="in-detail-item"><strong>IN</strong><span>${row.inFlag === 'yes' ? 'Yes' : 'No'}</span></div>
      <div class="in-detail-item"><strong>Vi App</strong><span>${row.viApp === 'yes' ? 'Yes' : 'No'}</span></div>
      <div class="in-detail-item"><strong>Plan Benefit</strong><span>${row.planBenefit || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Recharge Notification</strong><span>${row.rechargeNotification || 'N/A'}</span></div>
    </div>

    <h2>SWIFT Results</h2>`;
    
    if (rowUatResults.length === 0) {
      html += `<p class="no-data">No SWIFT UAT results found.</p>`;
    } else {
      html += `
      <table>
        <thead>
          <tr><th>#</th><th>Transaction ID</th><th>Activation</th><th>Validity</th><th>MRP</th><th>Benefits</th></tr>
        </thead>
        <tbody>`;
      rowUatResults.forEach((result) => {
        html += `
          <tr>
            <td>${result.srNo}</td>
            <td><small>${result.transactionId}</small></td>
            <td>${result.activationDateTime}</td>
            <td>${result.validity}</td>
            <td>&#8377;${result.mrp}</td>
            <td><small>${result.benefits ? result.benefits.substring(0, 50) + '...' : 'N/A'}</small></td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── SWIFT Voice Usage ──────────────────────────────────────────────
    html += `<h2>SWIFT Voice Usage</h2>`;
    const rowVoiceUsage = rowUatResults.flatMap(r => r.voiceUsage || []);
    const uniqueVoiceUsage = this.getUniqueItems(rowVoiceUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    if (uniqueVoiceUsage.length === 0) {
      html += `<p class="no-data">No voice usage data available.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>`;
      uniqueVoiceUsage.forEach((v: any) => {
        html += `
          <tr>
            <td>${v.offer_name || v.offerName || 'N/A'}</td>
            <td>${v.balance_left || v.balanceLeft || 'N/A'}</td>
            <td>${v.category || 'N/A'}</td>
            <td>${v.expiry_date || v.expiryDate || 'N/A'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── SWIFT Data Usage ──────────────────────────────────────────────
    html += `<h2>SWIFT Data Usage</h2>`;
    const rowDataUsage = rowUatResults.flatMap(r => r.dataUsage || []);
    const uniqueDataUsage = this.getUniqueItems(rowDataUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    if (uniqueDataUsage.length === 0) {
      html += `<p class="no-data">No data usage data available.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Offer Name</th><th>Total Quota</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>`;
      uniqueDataUsage.forEach((d: any) => {
        html += `
          <tr>
            <td>${d.offer_name || d.offerName || 'N/A'}</td>
            <td>${d.total_quota || d.totalQuota || 'N/A'}</td>
            <td>${d.balance_left || d.balanceLeft || 'N/A'}</td>
            <td>${d.category || 'N/A'}</td>
            <td>${d.expiry_date || d.expiryDate || 'N/A'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── SWIFT SMS Usage ──────────────────────────────────────────────
    html += `<h2>SWIFT SMS Usage</h2>`;
    const rowSmsUsage = rowUatResults.flatMap(r => r.smsUsage || []);
    const uniqueSmsUsage = this.getUniqueItems(rowSmsUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    if (uniqueSmsUsage.length === 0) {
      html += `<p class="no-data">No SMS usage data available.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>`;
      uniqueSmsUsage.forEach((s: any) => {
        html += `
          <tr>
            <td>${s.offer_name || s.offerName || 'N/A'}</td>
            <td>${s.balance_left || s.balanceLeft || 'N/A'}</td>
            <td>${s.category || 'N/A'}</td>
            <td>${s.expiry_date || s.expiryDate || 'N/A'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── SWIFT VAS Offers ──────────────────────────────────────────────
    html += `<h2>SWIFT VAS Offers</h2>`;
    const rowVasOffers = rowUatResults.flatMap(r => r.vasOffers || []);
    const uniqueVasOffers = this.getUniqueItems(rowVasOffers, ['name', 'offer_name', 'offerName', 'type', 'activation_date', 'activationDate']);
    if (uniqueVasOffers.length === 0) {
      html += `<p class="no-data">No VAS offers found.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Name</th><th>Type</th><th>Activation Date</th><th>Next Charging Date</th></tr></thead>
        <tbody>`;
      uniqueVasOffers.forEach((v: any) => {
        html += `
          <tr>
            <td>${v.name || v.offer_name || v.offerName || 'N/A'}</td>
            <td>${v.type || v.offer_type || v.category || 'N/A'}</td>
            <td>${v.activation_date || v.activationDate || 'N/A'}</td>
            <td>${v.next_charging_date || v.nextChargingDate || 'N/A'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── IN Results ──────────────────────────────────────────────────────
    html += `<h2>IN Results</h2>`;
    if (rowInResults.length === 0) {
      html += `<p class="no-data">No IN results found.</p>`;
    } else {
      rowInResults.forEach((result) => {
        html += `
      <div class="in-details-grid">
        <div class="in-detail-item"><strong>Customer Name</strong><span>${result.customerName || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Core Balance</strong><span>${result.coreBalance || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Validity</strong><span>${result.serviceValidity || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Account Status</strong><span>${result.accountStatus || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>User Type</strong><span>${result.userType || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Activation Date</strong><span>${result.activationDate || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Removal On</strong><span>${result.serviceRemovalOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Supervision Expires On</strong><span>${result.supervisionExpiresOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Main Balance</strong><span>${result.mainBalance || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Fee Expires On</strong><span>${result.serviceFeeExpiresOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Subscriber Status</strong><span>${result.subscriberStatus || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Credit Clearance On</strong><span>${result.creditClearanceOn || 'N/A'}</span></div>
      </div>`;
      });
    }

    // ─── IN Dedicated Accounts ──────────────────────────────────────────
    html += `<h2>IN Dedicated Accounts</h2>`;
    const rowDa = rowInResults.flatMap(r => r.dedicatedAccounts || []);
    if (rowDa.length === 0) {
      html += `<p class="no-data">No dedicated accounts found.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>DA Name</th><th>DA ID</th><th>Start Date</th><th>Expiry Date</th><th>DA Value</th><th>Unit</th><th>Type</th></tr></thead>
        <tbody>`;
      rowDa.forEach((da: any) => {
        html += `
          <tr>
            <td>${da.daName || 'N/A'}</td>
            <td>${da.daId || 'N/A'}</td>
            <td>${da.startDate || 'N/A'}</td>
            <td>${da.expiryDate || 'N/A'}</td>
            <td>${da.daValue || 'N/A'}</td>
            <td>${da.unit || 'N/A'}</td>
            <td>${da.type || 'N/A'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── IN Offers ──────────────────────────────────────────────────────
    html += `<h2>IN Offers</h2>`;
    const rowOffers = rowInResults.flatMap(r => r.offers || []);
    if (rowOffers.length === 0) {
      html += `<p class="no-data">No offers found.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Offer Name</th><th>Offer ID</th><th>Product ID</th><th>Start Date & Time</th><th>End Date & Time</th><th>Offer Type</th></tr></thead>
        <tbody>`;
      rowOffers.forEach((offer: any) => {
        html += `
          <tr>
            <td>${offer.offerName || 'N/A'}</td>
            <td>${offer.offerId || 'N/A'}</td>
            <td>${offer.productId || 'N/A'}</td>
            <td>${offer.startDateTime || 'N/A'}</td>
            <td>${offer.endDateTime || 'N/A'}</td>
            <td>${offer.offerType || 'N/A'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── VI App Results ──────────────────────────────────────────────────
    html += `<h2>VI App Results</h2>`;
    if (rowViAppResults.length === 0) {
      html += `<p class="no-data">No VI App results found.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Status</th><th>Matched Plan MRP</th><th>Expected Benefit</th><th>Actual Benefit</th><th>MRP Matched</th><th>Benefit Matched</th></tr></thead>
        <tbody>`;
      rowViAppResults.forEach((result) => {
        const statusBadge = result.status === 'Pass' ? 'badge-pass' : (result.status === 'Fail' ? 'badge-fail' : 'badge-skip');
        html += `
          <tr>
            <td><span class="badge ${statusBadge}">${result.status}</span></td>
            <td>${result.matchedPlanMRP || 'N/A'}</td>
            <td>${result.expectedBenefit || 'N/A'}</td>
            <td>${result.actualBenefit || 'N/A'}</td>
            <td>${result.mrpMatched ? 'Yes' : 'No'}</td>
            <td>${result.benefitMatched ? 'Yes' : 'No'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── Screenshots ──────────────────────────────────────────────────────
    html += `<h2>Screenshots (${rowScreenshots.length})</h2>`;
    if (rowScreenshots.length === 0) {
      html += `<p class="no-data">No screenshots captured.</p>`;
    } else {
      html += `<div class="screenshot-container">`;
      rowScreenshots.forEach((s, index) => {
        const imageSrc = s.fullPath || `/screenshots/${s.screenshotFile}`;
        const stepName = s.stepName || 'Screenshot';
        const capturedTime = s.capturedAt ? new Date(s.capturedAt).toLocaleString() : '';
        html += `
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
      });
      html += `</div>`;
    }

    html += `
    <div class="footer">
      <p>Report generated by VI Sim Automation Platform</p>
      <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  // ─── Generate Full HTML for Analysis Report ──────────────────────────────

  private generateAnalysisHTMLReport(analysisData: AnalysisReportData): string {
    const msisdn = analysisData.testCase.msisdn;
    const overallStatus = analysisData.testCase.overallStatus;
    const statusBadge = overallStatus === 'Pass' ? 'badge-pass' : 'badge-fail';

    let html = `${this.getHTMLHead(`Analysis Report - ${msisdn}`)}
<body>
  <div class="container">
    <div class="header-row">
      <h1>Analysis Report</h1>
      <span class="mrp-badge">${overallStatus}</span>
    </div>

    <div class="summary-grid">
      <div class="summary-item"><div class="number">${msisdn}</div><div class="label">MSISDN</div></div>
      <div class="summary-item"><div class="number">${analysisData.testCase.testDate}</div><div class="label">Test Date</div></div>
      <div class="summary-item"><div class="number">${overallStatus}</div><div class="label">Overall Status</div></div>
      <div class="summary-item"><div class="number">${analysisData.testCase.swiftStatus}</div><div class="label">SWIFT Status</div></div>
      <div class="summary-item"><div class="number">${analysisData.testCase.inStatus}</div><div class="label">IN Status</div></div>
    </div>

    <div class="info-box">
      <strong>Overall Status:</strong> <span class="badge ${statusBadge}">${overallStatus}</span>
      <strong style="margin-left: 20px;">SWIFT Status:</strong> <span class="badge ${analysisData.testCase.swiftStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${analysisData.testCase.swiftStatus}</span>
      <strong style="margin-left: 20px;">IN Status:</strong> <span class="badge ${analysisData.testCase.inStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${analysisData.testCase.inStatus}</span>
    </div>

    <h2>Comparison</h2>
    <table>
      <thead><tr><th>Parameter</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead>
      <tbody>`;
    analysisData.comparison.forEach((c) => {
      const statusBadgeC = c.status === 'Pass' ? 'badge-pass' : 'badge-fail';
      html += `
        <tr>
          <td><strong>${c.parameter}</strong></td>
          <td>${c.expected}</td>
          <td>${c.actual}</td>
          <td><span class="badge ${statusBadgeC}">${c.status}</span></td>
        </tr>`;
    });
    html += `
      </tbody>
    </table>

    <h2>SWIFT Analysis</h2>
    <h3>SWIFT Results</h3>
    <table>
      <thead><tr><th>Field</th><th>Expected</th><th>Actual</th><th>Status</th></tr></thead>
      <tbody>`;
    analysisData.swiftAnalysis.results.forEach((r) => {
      const statusBadgeR = r.status === 'Pass' ? 'badge-pass' : 'badge-fail';
      html += `
        <tr>
          <td><strong>${r.field}</strong></td>
          <td>${r.expected}</td>
          <td>${r.actual}</td>
          <td><span class="badge ${statusBadgeR}">${r.status}</span></td>
        </tr>`;
    });
    html += `
      </tbody>
    </table>

    <h3>SWIFT Failures</h3>`;
    if (analysisData.swiftAnalysis.failures.length === 0) {
      html += `<p class="no-data">No SWIFT failures found.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Failure Type</th><th>Expected</th><th>Actual</th><th>Severity</th></tr></thead>
        <tbody>`;
      analysisData.swiftAnalysis.failures.forEach((f) => {
        const severityBadge = f.severity === 'Critical' ? 'badge-critical' : f.severity === 'High' ? 'badge-high' : 'badge-medium';
        html += `
          <tr>
            <td><strong>${f.type}</strong></td>
            <td>${f.expected}</td>
            <td>${f.actual}</td>
            <td><span class="badge ${severityBadge}">${f.severity}</span></td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    html += `
    <h2>IN Analysis</h2>
    <h3>IN Results</h3>
    <table>
      <thead><tr><th>Field</th><th>Value</th><th>Expected</th><th>Status</th></tr></thead>
      <tbody>`;
    analysisData.inAnalysis.results.forEach((r) => {
      const statusBadgeR = r.status === 'Pass' ? 'badge-pass' : 'badge-fail';
      html += `
        <tr>
          <td><strong>${r.field}</strong></td>
          <td>${r.value}</td>
          <td>${r.expected}</td>
          <td><span class="badge ${statusBadgeR}">${r.status}</span></td>
        </tr>`;
    });
    html += `
      </tbody>
    </table>

    <h3>IN Failures</h3>`;
    if (analysisData.inAnalysis.failures.length === 0) {
      html += `<p class="no-data">No IN failures found.</p>`;
    } else {
      html += `
      <table>
        <thead><tr><th>Failure Type</th><th>Expected</th><th>Actual</th><th>Severity</th></tr></thead>
        <tbody>`;
      analysisData.inAnalysis.failures.forEach((f) => {
        const severityBadge = f.severity === 'Critical' ? 'badge-critical' : f.severity === 'High' ? 'badge-high' : 'badge-medium';
        html += `
          <tr>
            <td><strong>${f.type}</strong></td>
            <td>${f.expected}</td>
            <td>${f.actual}</td>
            <td><span class="badge ${severityBadge}">${f.severity}</span></td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    // ─── Root Cause ──────────────────────────────────────────────────────
    html += `
    <h2>Root Cause Analysis</h2>
    <div class="in-details-grid">
      <div class="in-detail-item"><strong>Expected Plan</strong><span>${analysisData.rootCause.expectedPlan}</span></div>
      <div class="in-detail-item"><strong>Actual Plan</strong><span>${analysisData.rootCause.actualPlan}</span></div>
      <div class="in-detail-item"><strong>Summary</strong><span>${analysisData.rootCause.summary}</span></div>
    </div>`;

    if (analysisData.rootCause.issues.length > 0) {
      html += `
      <h3>Issues</h3>
      <ul>`;
      analysisData.rootCause.issues.forEach((issue) => {
        html += `<li>${issue}</li>`;
      });
      html += `
      </ul>`;
    }

    // ─── Recommendations ──────────────────────────────────────────────────
    html += `
    <h2>Recommendations</h2>
    <table>
      <thead><tr><th>Priority</th><th>Issue</th><th>Recommendation</th><th>Owner</th></tr></thead>
      <tbody>`;
    analysisData.recommendations.forEach((r) => {
      const priorityBadge = r.priority === 'Critical' ? 'badge-critical' : r.priority === 'High' ? 'badge-high' : r.priority === 'Medium' ? 'badge-medium' : 'badge-low';
      html += `
        <tr>
          <td><span class="badge ${priorityBadge}">${r.priority}</span></td>
          <td>${r.issue}</td>
          <td>${r.recommendation}</td>
          <td>${r.owner}</td>
        </tr>`;
    });
    html += `
      </tbody>
    </table>

    <h2>Timeline</h2>
    <table>
      <thead><tr><th>Timestamp</th><th>Event</th><th>System</th></tr></thead>
      <tbody>`;
    analysisData.timeline.forEach((t) => {
      html += `
        <tr>
          <td>${t.timestamp}</td>
          <td>${t.event}</td>
          <td>${t.system}</td>
        </tr>`;
    });
    html += `
      </tbody>
    </table>

    <div class="footer">
      <p>Report generated by VI Sim Automation Platform</p>
      <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
    </div>
  </div>
</body>
</html>`;

    return html;
  }

  // ─── Generate PDF HTML for Individual Report ──────────────────────────────

  private generateIndividualPDFHTMLReport(row: InputRow): string {
    const msisdn = row.msisdn || 'unknown';
    const circle = row.circle || 'unknown';
    const rechargeMRP = row.rechargeMRP || 'unknown';

    const rowUatResults = this.uatResults.filter(r => r.msisdn === msisdn);
    const rowInResults = this.inResults.filter(r => r.msisdn === msisdn);
    const rowViAppResults = this.viAppResults.filter(r => r.msisdn === msisdn);
    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === msisdn);
    const rowPreTestResults = this.preTestResults.filter(r => r.msisdn === msisdn);

    const preTestStatus = rowPreTestResults.length > 0 && rowPreTestResults.every(r => r.status === 'Pass') ? 'Pass' : 'Fail';

    const cover = this.getPDFCover(
      'SIM Recharge Report',
      `MSISDN ${msisdn} &mdash; Circle ${circle}`,
      [
        { label: 'Recharge MRP', value: `&#8377;${rechargeMRP}` },
        { label: 'PreTest Status', value: preTestStatus },
        { label: 'UAT Results', value: String(rowUatResults.length) },
        { label: 'IN Results', value: String(rowInResults.length) },
        { label: 'VI App Results', value: String(rowViAppResults.length) },
        { label: 'Screenshots', value: String(rowScreenshots.length) },
        { label: 'Generated', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
      ]
    );

    // Get the full HTML content and wrap it with cover
    const fullHTML = this.generateIndividualHTMLReport(row);
    // Extract body content
    const bodyMatch = fullHTML.match(/<body>([\s\S]*)<\/body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';

    return `${this.getHTMLHead(`SIM Recharge Report - ${msisdn}`, true)}
<body>
${cover}
${bodyContent}
</body>
</html>`;
  }

  // ─── Generate PDF HTML for Analysis Report ────────────────────────────────

  private generateAnalysisPDFHTMLReport(analysisData: AnalysisReportData): string {
    const msisdn = analysisData.testCase.msisdn;
    const overallStatus = analysisData.testCase.overallStatus;

    const cover = this.getPDFCover(
      'Analysis Report',
      `MSISDN ${msisdn}`,
      [
        { label: 'Test Date', value: analysisData.testCase.testDate },
        { label: 'Overall Status', value: overallStatus },
        { label: 'SWIFT Status', value: analysisData.testCase.swiftStatus },
        { label: 'IN Status', value: analysisData.testCase.inStatus },
        { label: 'Generated', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) }
      ]
    );

    const fullHTML = this.generateAnalysisHTMLReport(analysisData);
    const bodyMatch = fullHTML.match(/<body>([\s\S]*)<\/body>/);
    const bodyContent = bodyMatch ? bodyMatch[1] : '';

    return `${this.getHTMLHead(`Analysis Report - ${msisdn}`, true)}
<body>
${cover}
${bodyContent}
</body>
</html>`;
  }

  // ─── UAT Results ──────────────────────────────────────────────────────────

  addUATResult(result: Omit<UATResult, 'srNo'>): void {
    const srNo = this.uatResults.length + 1;
    this.uatResults.push({ ...result, srNo });
    console.log(`[ExcelReportService] Added UAT result #${srNo} for MSISDN: ${result.msisdn}`);
  }

  // ─── IN Results ──────────────────────────────────────────────────────────

  addINResult(result: INResult): void {
    if (result.status !== 'Pass' && result.status !== 'Fail') {
      result.status = 'Fail';
    }
    this.inResults.push(result);
    console.log(`[ExcelReportService] Added IN result for MSISDN: ${result.msisdn} - Status: ${result.status}`);
  }

  getINResultCount(): number {
    return this.inResults.length;
  }

  // ─── PreTest Results ─────────────────────────────────────────────────────

  addPreTestResult(result: PreTestResult): void {
    this.preTestResults.push(result);
    console.log(`[ExcelReportService] Added PreTest result for MSISDN: ${result.msisdn} - Status: ${result.status} (Voice: ${result.voice.length}, Data: ${result.data.length}, SMS: ${result.sms.length}, DA: ${result.dedicatedAccounts?.length || 0}, Offers: ${result.offers?.length || 0})`);
  }

  getPreTestResultCount(): number {
    return this.preTestResults.length;
  }

  // ── UPSS Promotional History ───────────────────────────────────────────

  addUpssPromoHistory(msisdn: string, items: any[]): void {
    if (!items || items.length === 0) return;
    items.forEach((item) => {
      this.upssPromoHistory.push({
        msisdn,
        applied_date: item.applied_date || 'N/A',
        start_date: item.start_date || 'N/A',
        promotion_name: item.promotion_name || 'N/A',
        description: item.description || 'N/A',
        mode_of_activation: item.mode_of_activation || 'N/A',
        promotion_status: item.promotion_status || 'N/A',
      });
    });
    console.log(`[ExcelReportService] Added ${items.length} UPSS promo history entries for MSISDN: ${msisdn}`);
  }

  getUpssPromoHistoryCount(): number {
    return this.upssPromoHistory.length;
  }

  // ── VI App Results ─────────────────────────────────────────────────────

  addViAppResult(result: ViAppResult): void {
    if (result.status === 'Mismatch' && result.smsDateIsToday === false) {
      result.status = 'Fail';
    }
    if (result.status === 'Mismatch') {
      result.status = 'Fail';
    }
    this.viAppResults.push(result);
    console.log(`[ExcelReportService] Added VI App result for MSISDN: ${result.msisdn} - Status: ${result.status}`);
  }

  getViAppResultCount(): number {
    return this.viAppResults.length;
  }

  // ── Screenshots ─────────────────────────────────────────────────────────

  addScreenshots(screenshots: ScreenshotIndex[]): void {
    screenshots.forEach(screenshot => {
      const existing = this.screenshotIndex.find(
        s => s.screenshotFile === screenshot.screenshotFile
      );
      if (!existing) {
        this.screenshotIndex.push({
          ...screenshot,
          srNo: this.screenshotIndex.length + 1
        });
      }
      if (!this.rowScreenshots.has(screenshot.msisdn)) {
        this.rowScreenshots.set(screenshot.msisdn, []);
      }
      this.rowScreenshots.get(screenshot.msisdn)!.push(screenshot.screenshotFile);
    });
    console.log(`[ExcelReportService] Added ${screenshots.length} screenshots`);
  }

  // ── Input Rows ─────────────────────────────────────────────────────────

  addInputRows(rows: InputRow[]): void {
    this.inputRows = rows;
    console.log(`[ExcelReportService] Added ${rows.length} input rows`);
  }

  // ── Analysis Reports ──────────────────────────────────────────────────

  addAnalysisReport(report: AnalysisReportData): void {
    this.analysisReports.push(report);
    console.log(`[ExcelReportService] Added analysis report for MSISDN: ${report.testCase.msisdn}`);
  }

  updateResultStatuses(
    msisdn: string,
    updates: { inStatus?: string; swiftStatus?: string },
  ): void {
    if (updates.inStatus) {
      const inResult = this.inResults.find((r) => r.msisdn === msisdn);
      if (inResult) {
        const status = updates.inStatus === 'Pass' ? 'Pass' : 'Fail';
        inResult.status = status;
        inResult.remarks = status === 'Pass'
          ? 'IN test passed — plan validated'
          : 'IN test failed — wrong plan provisioned';
      }
    }

    if (updates.swiftStatus) {
      for (const uatResult of this.uatResults) {
        if (uatResult.msisdn === msisdn) {
          const status = updates.swiftStatus === 'Pass' ? 'Pass' : 
                        updates.swiftStatus === 'Skip' ? 'Skip' : 'Fail';
          uatResult.swiftStatus = status;
        }
      }
    }
  }

  // ── Getters ────────────────────────────────────────────────────────────

  getResultCount(): number {
    return this.uatResults.length;
  }

  getScreenshotCount(): number {
    return this.screenshotIndex.length;
  }

  getInputRowCount(): number {
    return this.inputRows.length;
  }

  // ─── Write Individual Report ────────────────────────────────────────────

  async writeIndividualReport(row: InputRow): Promise<{ excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }> {
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
    const reportBaseName = `SIM_Recharge_Report_${msisdn}_${circle}_MRP${rechargeMRP}`;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${reportBaseName}_${timestamp}`;
    
    const excelFilepath = path.join(reportsDir, `${baseName}.xlsx`);
    const htmlFilepath = path.join(reportsDir, `${baseName}.html`);
    const pdfFilepath = path.join(reportsDir, `${baseName}.pdf`);

    // Get results for this specific MSISDN
    const rowUatResults = this.uatResults.filter(r => r.msisdn === msisdn);
    const rowInResults = this.inResults.filter(r => r.msisdn === msisdn);
    const rowViAppResults = this.viAppResults.filter(r => r.msisdn === msisdn);
    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === msisdn);
    const rowPreTestResults = this.preTestResults.filter(r => r.msisdn === msisdn);
    const rowUpssPromoHistory = this.upssPromoHistory.filter(u => u.msisdn === msisdn);

    // ─── Helper: Extract validity from plan benefit ──────────────────────
    const extractValidityFromPlan = (planBenefit: string): number => {
      if (!planBenefit) return 0;
      const parts = planBenefit.split(/\|\|/).map(p => p.trim());
      const validityPart = parts[1] || parts[0] || '';
      const match = validityPart.match(/(\d+)\s*D/i);
      return match ? parseInt(match[1], 10) : 0;
    };

    const expectedValidityDays = extractValidityFromPlan(row.planBenefit || '');

    // ─── Sheet 1: Summary ──────────────────────────────────────────────────
    const summarySheetData = [{
      'MSISDN': msisdn,
      'Circle': circle,
      'Recharge MRP': rechargeMRP,
      'Expected Plan Benefit': row.planBenefit || 'N/A',
      'Expected Validity': expectedValidityDays > 0 ? `${expectedValidityDays} Days` : 'N/A',
      'UAT Results': rowUatResults.length,
      'IN Results': rowInResults.length,
      'VI App Results': rowViAppResults.length,
      'Screenshots': rowScreenshots.length,
      'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }];

    // ─── Sheet 2: Input Data ──────────────────────────────────────────────
    const inputSheetData = [{
      'MSISDN': row.msisdn,
      'CIRCLE': row.circle,
      'Recharge MRP': row.rechargeMRP,
      'Recharge': row.recharge,
      'SWIFT': row.swift,
      'IN': row.inFlag,
      'Vi App': row.viApp,
      'Plan Benefit': row.planBenefit || 'N/A',
      'Recharge Notification': row.rechargeNotification || 'N/A'
    }];

    // ─── Sheet 3: SWIFT Results ───────────────────────────────────────────
    const swiftResultsSheetData = rowUatResults.map((result) => ({
      'Sr. No.': result.srNo,
      'Transaction Id': result.transactionId || 'N/A',
      'Activation Date & Time': result.activationDateTime || new Date().toLocaleString(),
      'Validity': result.validity || 'N/A',
      'MRP': result.mrp || 'N/A',
      'Activation Mode': result.activationMode || 'N/A',
      'Current Core Balance': (rowInResults.length > 0 ? rowInResults[0].coreBalance : '0') || result.currentCoreBalance || '0.00',
      'eTOP UP Transaction Id': result.etopupTransactionId || 'N/A',
      'Retailer MSISDN': result.retailerMsisdn || 'N/A',
      'Name': result.name || 'N/A',
      'Category': result.category || 'Recharge',
      'Benefits': result.benefits || 'N/A',
      'Detail Validity': result.detailValidity || 'N/A',
      'Reason': result.reason || 'N/A'
    }));

    // ─── Sheet 4: SWIFT Voice Usage (DEDUPLICATED) ──────────────────────
    const rawVoiceUsage = rowUatResults.flatMap(r => r.voiceUsage || []);
    const uniqueVoiceUsage = this.getUniqueItems(rawVoiceUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    const voiceSheetData = uniqueVoiceUsage.length > 0 ? uniqueVoiceUsage.map((v: any) => ({
      'MSISDN': msisdn,
      'Offer Name': v.offer_name || v.offerName || 'N/A',
      'Balance Left': v.balance_left || v.balanceLeft || 'N/A',
      'Category': v.category || 'N/A',
      'Expiry Date': v.expiry_date || v.expiryDate || 'N/A'
    })) : [{ 'MSISDN': msisdn, 'Offer Name': 'No voice usage data', 'Balance Left': 'N/A', 'Category': 'N/A', 'Expiry Date': 'N/A' }];

    // ─── Sheet 5: SWIFT Data Usage (DEDUPLICATED) ────────────────────────
    const rawDataUsage = rowUatResults.flatMap(r => r.dataUsage || []);
    const uniqueDataUsage = this.getUniqueItems(rawDataUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    const dataSheetData = uniqueDataUsage.length > 0 ? uniqueDataUsage.map((d: any) => ({
      'MSISDN': msisdn,
      'Offer Name': d.offer_name || d.offerName || 'N/A',
      'Total Quota': d.total_quota || d.totalQuota || 'N/A',
      'Balance Left': d.balance_left || d.balanceLeft || 'N/A',
      'Category': d.category || 'N/A',
      'Expiry Date': d.expiry_date || d.expiryDate || 'N/A'
    })) : [{ 'MSISDN': msisdn, 'Offer Name': 'No data usage data', 'Total Quota': 'N/A', 'Balance Left': 'N/A', 'Category': 'N/A', 'Expiry Date': 'N/A' }];

    // ─── Sheet 6: SWIFT SMS Usage (DEDUPLICATED) ────────────────────────
    const rawSmsUsage = rowUatResults.flatMap(r => r.smsUsage || []);
    const uniqueSmsUsage = this.getUniqueItems(rawSmsUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    const smsSheetData = uniqueSmsUsage.length > 0 ? uniqueSmsUsage.map((s: any) => ({
      'MSISDN': msisdn,
      'Offer Name': s.offer_name || s.offerName || 'N/A',
      'Balance Left': s.balance_left || s.balanceLeft || 'N/A',
      'Category': s.category || 'N/A',
      'Expiry Date': s.expiry_date || s.expiryDate || 'N/A'
    })) : [{ 'MSISDN': msisdn, 'Offer Name': 'No SMS usage data', 'Balance Left': 'N/A', 'Category': 'N/A', 'Expiry Date': 'N/A' }];

    // ─── Sheet 7: SWIFT Unlimited Offers ──────────────────────────────────
    const rawUnlimitedOffers = rowUatResults.flatMap(r => r.unlimitedOffers || []);
    const uniqueUnlimitedOffers = this.getUniqueItems(rawUnlimitedOffers, ['offer_name', 'offerName', 'mrp', 'benefits']);
    const unlimitedSheetData = uniqueUnlimitedOffers.length > 0 ? uniqueUnlimitedOffers.map((u: any) => ({
      'MSISDN': msisdn,
      'MRP': u.mrp || 'N/A',
      'Activation Date': u.activation_date || u.activationDate || 'N/A',
      'Validity': u.validity || 'N/A',
      'Benefits': u.benefits || 'N/A'
    })) : [{ 'MSISDN': msisdn, 'Note': 'No unlimited offers found' }];

    // ─── Sheet 8: SWIFT VAS Offers (DEDUPLICATED) ───────────────────────
    const rawVasOffers = rowUatResults.flatMap(r => r.vasOffers || []);
    const uniqueVasOffers = this.getUniqueItems(rawVasOffers, ['name', 'offer_name', 'offerName', 'type', 'activation_date', 'activationDate']);
    const vasSheetData = uniqueVasOffers.length > 0 ? uniqueVasOffers.map((v: any) => ({
      'MSISDN': msisdn,
      'MRP': v.mrp || 'N/A',
      'Name': v.name || v.offer_name || v.offerName || 'N/A',
      'Type': v.type || v.offer_type || v.category || 'N/A',
      'Activation Date': v.activation_date || v.activationDate || 'N/A',
      'Next Charging Date': v.next_charging_date || v.nextChargingDate || 'N/A'
    })) : [{ 'MSISDN': msisdn, 'Note': 'No VAS offers found' }];

    // ─── Sheet 9: SWIFT UPSS Promotional History ──────────────────────────
    const upssSheetData = rowUpssPromoHistory.length > 0 ? rowUpssPromoHistory.map((item, idx) => ({
      'Sr No.': idx + 1,
      'MSISDN': item.msisdn,
      'Applied Date': item.applied_date,
      'Start Date': item.start_date,
      'Promotion Name': item.promotion_name,
      'Description': item.description,
      'Mode of Activation': item.mode_of_activation,
      'Promotion Status': item.promotion_status
    })) : [{ 'MSISDN': msisdn, 'Note': 'No UPSS promotional history found' }];

    // ─── Sheet 10: IN Results ─────────────────────────────────────────────
    const inSheetData = rowInResults.map((result) => ({
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      'Customer Name': result.customerName || 'N/A',
      'Core Balance': result.coreBalance || 'N/A',
      'Service Validity': result.serviceValidity || 'N/A',
      'Account Status': result.accountStatus || 'N/A',
      'User Type': result.userType || 'N/A',
      'Activation Date': result.activationDate || 'N/A',
      'Service Removal On': result.serviceRemovalOn || 'N/A',
      'Supervision Expires On': result.supervisionExpiresOn || 'N/A',
      'Main Balance': result.mainBalance || 'N/A',
      'Service Fee Expires On': result.serviceFeeExpiresOn || 'N/A',
      'Subscriber Status': result.subscriberStatus || 'N/A',
      'Credit Clearance On': result.creditClearanceOn || 'N/A',
      'Dedicated Accounts': (result.dedicatedAccounts || []).length,
      'Offers': (result.offers || []).length,
      'Remarks': result.remarks || 'N/A'
    }));

    // ─── Sheet 11: IN Dedicated Accounts ──────────────────────────────────
    const daSheetData: any[] = [];
    rowInResults.forEach((result) => {
      if (result.dedicatedAccounts && result.dedicatedAccounts.length > 0) {
        result.dedicatedAccounts.forEach((da: any) => {
          daSheetData.push({
            'MSISDN': result.msisdn,
            'DA Name': da.daName || 'N/A',
            'DA ID': da.daId || 'N/A',
            'Start Date': da.startDate || 'N/A',
            'Expiry Date': da.expiryDate || 'N/A',
            'DA Value': da.daValue || 'N/A',
            'Unit': da.unit || 'N/A',
            'Type': da.type || 'N/A'
          });
        });
      }
    });
    if (daSheetData.length === 0) {
      daSheetData.push({ 'MSISDN': msisdn, 'Note': 'No dedicated accounts found' });
    }

    // ─── Sheet 12: IN Offers ──────────────────────────────────────────────
    const offersSheetData: any[] = [];
    rowInResults.forEach((result) => {
      if (result.offers && result.offers.length > 0) {
        result.offers.forEach((offer: any) => {
          offersSheetData.push({
            'MSISDN': result.msisdn,
            'Offer Name': offer.offerName || 'N/A',
            'Offer ID': offer.offerId || 'N/A',
            'Product ID': offer.productId || 'N/A',
            'Start Date & Time': offer.startDateTime || 'N/A',
            'End Date & Time': offer.endDateTime || 'N/A',
            'Offer Type': offer.offerType || 'N/A'
          });
        });
      }
    });
    if (offersSheetData.length === 0) {
      offersSheetData.push({ 'MSISDN': msisdn, 'Note': 'No offers found' });
    }

    // ─── Sheet 13: PreTest Summary ────────────────────────────────────────
    const preTestSummarySheetData = rowPreTestResults.map((pt) => ({
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
      'Voice Entries': pt.voice.length,
      'Data Entries': pt.data.length,
      'SMS Entries': pt.sms.length,
      'Dedicated Accounts': (pt.dedicatedAccounts || []).length,
      'Offers': (pt.offers || []).length,
      'Screenshot Count': pt.screenshotCount
    }));
    if (preTestSummarySheetData.length === 0) {
      preTestSummarySheetData.push({ 'MSISDN': msisdn, 'Note': 'No PreTest results found' });
    }

    // ─── Sheet 14: PreTest Voice Usage ────────────────────────────────────
    const preTestVoiceSheetData: any[] = [];
    rowPreTestResults.forEach((pt) => {
      pt.voice.forEach((v: any) => {
        preTestVoiceSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': v.offer_name || 'N/A',
          'Balance Left': v.balance_left || 'N/A',
          'Category': v.category || 'N/A',
          'Expiry Date': v.expiry_date || 'N/A'
        });
      });
    });
    if (preTestVoiceSheetData.length === 0) {
      preTestVoiceSheetData.push({ 'MSISDN': msisdn, 'Note': 'No voice usage data' });
    }

    // ─── Sheet 15: PreTest Data Usage ─────────────────────────────────────
    const preTestDataSheetData: any[] = [];
    rowPreTestResults.forEach((pt) => {
      pt.data.forEach((d: any) => {
        preTestDataSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': d.offer_name || 'N/A',
          'Total Quota': d.total_quota || 'N/A',
          'Balance Left': d.balance_left || 'N/A',
          'Category': d.category || 'N/A',
          'Expiry Date': d.expiry_date || 'N/A'
        });
      });
    });
    if (preTestDataSheetData.length === 0) {
      preTestDataSheetData.push({ 'MSISDN': msisdn, 'Note': 'No data usage data' });
    }

    // ─── Sheet 16: PreTest SMS Usage ──────────────────────────────────────
    const preTestSMSSheetData: any[] = [];
    rowPreTestResults.forEach((pt) => {
      pt.sms.forEach((s: any) => {
        preTestSMSSheetData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': s.offer_name || 'N/A',
          'Balance Left': s.balance_left || 'N/A',
          'Category': s.category || 'N/A',
          'Expiry Date': s.expiry_date || 'N/A'
        });
      });
    });
    if (preTestSMSSheetData.length === 0) {
      preTestSMSSheetData.push({ 'MSISDN': msisdn, 'Note': 'No SMS usage data' });
    }

    // ─── Sheet 17: PreTest Dedicated Accounts ─────────────────────────────
    const preTestDASheetData: any[] = [];
    rowPreTestResults.forEach((pt) => {
      if (pt.dedicatedAccounts && pt.dedicatedAccounts.length > 0) {
        pt.dedicatedAccounts.forEach((da: any) => {
          preTestDASheetData.push({
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
      }
    });
    if (preTestDASheetData.length === 0) {
      preTestDASheetData.push({ 'MSISDN': msisdn, 'Note': 'No dedicated accounts found' });
    }

    // ─── Sheet 18: PreTest Offers ─────────────────────────────────────────
    const preTestOffersSheetData: any[] = [];
    rowPreTestResults.forEach((pt) => {
      if (pt.offers && pt.offers.length > 0) {
        pt.offers.forEach((offer: any) => {
          preTestOffersSheetData.push({
            'MSISDN': pt.msisdn,
            'Offer Name': offer.offerName || 'N/A',
            'Offer ID': offer.offerId || 'N/A',
            'Product ID': offer.productId || 'N/A',
            'Start Date & Time': offer.startDateTime || 'N/A',
            'End Date & Time': offer.endDateTime || 'N/A',
            'Offer Type': offer.offerType || 'N/A'
          });
        });
      }
    });
    if (preTestOffersSheetData.length === 0) {
      preTestOffersSheetData.push({ 'MSISDN': msisdn, 'Note': 'No offers found' });
    }

    // ─── Sheet 19: PreTest Combined ───────────────────────────────────────
    const preTestCombinedSheetData: any[] = [];
    rowPreTestResults.forEach((pt) => {
      preTestCombinedSheetData.push({
        'MSISDN': pt.msisdn,
        'Circle': pt.circle,
        'Recharge MRP': pt.rechargeMRP,
        'PreTest Status': pt.status,
        'Reason': pt.reason,
        'Type': '--- SUMMARY ---',
        'Offer Name': '',
        'Balance Left': '',
        'Total Quota': '',
        'Category': '',
        'Expiry Date': ''
      });

      if (pt.voice.length > 0) {
        pt.voice.forEach((v: any) => {
          preTestCombinedSheetData.push({
            'MSISDN': pt.msisdn,
            'Circle': pt.circle,
            'Recharge MRP': pt.rechargeMRP,
            'PreTest Status': pt.status,
            'Reason': pt.reason,
            'Type': 'VOICE',
            'Offer Name': v.offer_name || 'N/A',
            'Balance Left': v.balance_left || 'N/A',
            'Total Quota': 'N/A',
            'Category': v.category || 'N/A',
            'Expiry Date': v.expiry_date || 'N/A'
          });
        });
      }

      if (pt.data.length > 0) {
        pt.data.forEach((d: any) => {
          preTestCombinedSheetData.push({
            'MSISDN': pt.msisdn,
            'Circle': pt.circle,
            'Recharge MRP': pt.rechargeMRP,
            'PreTest Status': pt.status,
            'Reason': pt.reason,
            'Type': 'DATA',
            'Offer Name': d.offer_name || 'N/A',
            'Balance Left': d.balance_left || 'N/A',
            'Total Quota': d.total_quota || 'N/A',
            'Category': d.category || 'N/A',
            'Expiry Date': d.expiry_date || 'N/A'
          });
        });
      }

      if (pt.sms.length > 0) {
        pt.sms.forEach((s: any) => {
          preTestCombinedSheetData.push({
            'MSISDN': pt.msisdn,
            'Circle': pt.circle,
            'Recharge MRP': pt.rechargeMRP,
            'PreTest Status': pt.status,
            'Reason': pt.reason,
            'Type': 'SMS',
            'Offer Name': s.offer_name || 'N/A',
            'Balance Left': s.balance_left || 'N/A',
            'Total Quota': 'N/A',
            'Category': s.category || 'N/A',
            'Expiry Date': s.expiry_date || 'N/A'
          });
        });
      }

      if (pt.voice.length > 0 || pt.data.length > 0 || pt.sms.length > 0) {
        preTestCombinedSheetData.push({
          'MSISDN': '',
          'Circle': '',
          'Recharge MRP': '',
          'PreTest Status': '',
          'Reason': '',
          'Type': '--- END ---',
          'Offer Name': '',
          'Balance Left': '',
          'Total Quota': '',
          'Category': '',
          'Expiry Date': ''
        });
      }
    });
    if (preTestCombinedSheetData.length === 0) {
      preTestCombinedSheetData.push({ 'MSISDN': msisdn, 'Note': 'No PreTest data available' });
    }

    // ─── Sheet 20: VI App Results ─────────────────────────────────────────
    const viAppSheetData = rowViAppResults.map((result) => ({
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      'Vi App Flag': result.viAppFlag,
      'Ran': result.ran ? 'Yes' : 'No',
      'Status': result.status,
      'Matched Plan MRP': result.matchedPlanMRP || 'N/A',
      'Expected Benefit': result.expectedBenefit || 'N/A',
      'Actual Benefit': result.actualBenefit || 'N/A',
      'MRP Matched': result.mrpMatched ? 'Yes' : 'No',
      'Benefit Matched': result.benefitMatched ? 'Yes' : 'No',
      'Last Recharge Amount': result.lastRechargeAmount || 'N/A',
      'Pack Ends On Date': result.packEndsOnDate || 'N/A',
      'Main Balance': result.mainBalance || 'N/A',
      'Service Validity': result.serviceValidity || 'N/A',
      'Screenshot Count': result.screenshotCount,
      'Remarks': result.remarks || 'N/A'
    }));
    if (viAppSheetData.length === 0) {
      viAppSheetData.push({ 'MSISDN': msisdn, 'Note': 'No VI App results available' });
    }

    // ─── Sheet 21: VI App Summary ─────────────────────────────────────────
    const viAppSummaryData = rowViAppResults.length > 0 ? [{
      'MSISDN': msisdn,
      'Recharge MRP': rechargeMRP,
      'Circle': circle,
      'Total VI App Results': rowViAppResults.length,
      'Pass Count': rowViAppResults.filter(r => r.status === 'Pass').length,
      'Fail Count': rowViAppResults.filter(r => r.status === 'Fail').length,
      'Skip Count': rowViAppResults.filter(r => r.status === 'Skip').length,
      'Error Count': rowViAppResults.filter(r => r.status === 'Error').length,
      'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }] : [{ 'MSISDN': msisdn, 'Note': 'No VI App results available' }];

    // ─── Sheet 22: Screenshots ────────────────────────────────────────────
    const screenshotSheetData = rowScreenshots.map((screenshot) => ({
      'Sr. No.': screenshot.srNo,
      'MSISDN': screenshot.msisdn,
      'File': screenshot.screenshotFile,
      'Captured At': screenshot.capturedAt,
      'Step Name': screenshot.stepName || 'General'
    }));
    if (screenshotSheetData.length === 0) {
      screenshotSheetData.push({ 'MSISDN': msisdn, 'Note': 'No screenshots captured' });
    }

    // ─── Create Workbook ──────────────────────────────────────────────────
    const workbook = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summarySheetData), 'Summary');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inputSheetData), 'Input Data');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(swiftResultsSheetData), 'Swift Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(voiceSheetData), 'SWIFT Voice Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(dataSheetData), 'SWIFT Data Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(smsSheetData), 'SWIFT SMS Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(unlimitedSheetData), 'SWIFT Unlimited Offers');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(vasSheetData), 'SWIFT VAS Offers');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(upssSheetData), 'Swift UPSS Promotional History');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inSheetData), 'IN Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daSheetData), 'IN Dedicated Accounts');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersSheetData), 'IN Offers');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSummarySheetData), 'PreTest Summary');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestVoiceSheetData), 'PreTest Voice Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestDataSheetData), 'PreTest Data Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSMSSheetData), 'PreTest SMS Usage');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestDASheetData), 'PreTest Dedicated Accounts');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestOffersSheetData), 'PreTest Offers');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestCombinedSheetData), 'PreTest Combined');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSummaryData), 'VI App Summary');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(screenshotSheetData), 'Screenshots');

    xlsx.writeFile(workbook, excelFilepath);
    console.log(`[ExcelReportService] Individual Excel report: ${excelFilepath}`);

    // ─── Generate Full HTML report ────────────────────────────────────────
    const htmlContent = this.generateIndividualHTMLReport(row);
    fs.writeFileSync(htmlFilepath, htmlContent, 'utf8');
    console.log(`[ExcelReportService] Individual HTML report: ${htmlFilepath}`);

    // ─── Generate PDF report ──────────────────────────────────────────────
    try {
      const pdfHTMLContent = this.generateIndividualPDFHTMLReport(row);
      await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
      console.log(`[ExcelReportService] Individual PDF report: ${pdfFilepath}`);
    } catch (err: any) {
      console.error(`[ExcelReportService] PDF generation failed: ${err.message}`);
      // Create a fallback PDF with basic info
      try {
        const fallbackHTML = `<html><body><h1>SIM Recharge Report - ${msisdn}</h1><p>Generated: ${new Date().toLocaleString()}</p><p>PDF generation failed, please check the Excel file for details.</p></body></html>`;
        await this.convertHTMLToPDF(fallbackHTML, pdfFilepath);
        console.log(`[ExcelReportService] Fallback PDF created: ${pdfFilepath}`);
      } catch (_) {
        console.warn(`[ExcelReportService] Could not create fallback PDF for ${msisdn}`);
      }
    }

    // ─── Generate ZIP Bundle ──────────────────────────────────────────────
    const zipPath = path.join(finalReportsDir, `${baseName}.zip`);
    await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
  }

  // ─── Write Analysis Report ──────────────────────────────────────────────

  // async writeAnalysisReport(analysisData: AnalysisReportData): Promise<{ excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }> {
  //   const reportsDir = path.resolve('./reports');
  //   if (!fs.existsSync(reportsDir)) {
  //     fs.mkdirSync(reportsDir, { recursive: true });
  //   }

  //   const finalReportsDir = path.resolve('./finalreports');
  //   if (!fs.existsSync(finalReportsDir)) {
  //     fs.mkdirSync(finalReportsDir, { recursive: true });
  //   }

  //   const msisdn = analysisData.testCase.msisdn;
  //   const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  //   const reportBaseName = `Analysis_Report_${msisdn}_${timestamp}`;
  //   const excelFilepath = path.join(reportsDir, `${reportBaseName}.xlsx`);
  //   const htmlFilepath = path.join(reportsDir, `${reportBaseName}.html`);
  //   const pdfFilepath = path.join(reportsDir, `${reportBaseName}.pdf`);

  //   const workbook = xlsx.utils.book_new();

  //   // ─── Sheet 1: Executive Summary ────────────────────────────────────────
  //   const summaryData = [{
  //     'Test Case': analysisData.testCase.name,
  //     'MSISDN': analysisData.testCase.msisdn,
  //     'Test Date': analysisData.testCase.testDate,
  //     'Overall Status': analysisData.testCase.overallStatus,
  //     'SWIFT Status': analysisData.testCase.swiftStatus,
  //     'IN Status': analysisData.testCase.inStatus,
  //     'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  //   }];
  //   xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryData), 'Executive Summary');

  //   // ─── Sheet 2: Comparison ──────────────────────────────────────────────
  //   const comparisonData = analysisData.comparison.map((c, idx) => ({
  //     '#': idx + 1,
  //     'Parameter': c.parameter,
  //     'Expected': c.expected,
  //     'Actual': c.actual,
  //     'Status': c.status
  //   }));
  //   xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(comparisonData), 'Comparison');

  //   // ─── Sheet 3: SWIFT Results ──────────────────────────────────────────
  //   const swiftResultsData = analysisData.swiftAnalysis.results.map((r, idx) => ({
  //     '#': idx + 1,
  //     'Field': r.field,
  //     'Expected': r.expected,
  //     'Actual': r.actual,
  //     'Status': r.status
  //   }));
  //   xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(swiftResultsData), 'SWIFT Results');

  //   // ─── Sheet 4: SWIFT Voice Usage ──────────────────────────────────────
  //   if (analysisData.swiftAnalysis.voiceUsage.length > 0) {
  //     const voiceData = analysisData.swiftAnalysis.voiceUsage.map((v, idx) => ({
  //       '#': idx + 1,
  //       'Offer Name': v.offerName,
  //       'Balance Left': v.balanceLeft,
  //       'Category': v.category,
  //       'Expiry Date': v.expiryDate,
  //       'Status': v.status
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(voiceData), 'SWIFT Voice Usage');
  //   }

  //   // ─── Sheet 5: SWIFT Data Usage ──────────────────────────────────────
  //   if (analysisData.swiftAnalysis.dataUsage.length > 0) {
  //     const dataUsageData = analysisData.swiftAnalysis.dataUsage.map((d, idx) => ({
  //       '#': idx + 1,
  //       'MSISDN': d.msisdn,
  //       'Note': d.note,
  //       'Status': d.status
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(dataUsageData), 'SWIFT Data Usage');
  //   }

  //   // ─── Sheet 6: SWIFT SMS Usage ────────────────────────────────────────
  //   if (analysisData.swiftAnalysis.smsUsage.length > 0) {
  //     const smsUsageData = analysisData.swiftAnalysis.smsUsage.map((s, idx) => ({
  //       '#': idx + 1,
  //       'MSISDN': s.msisdn,
  //       'Note': s.note,
  //       'Status': s.status
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(smsUsageData), 'SWIFT SMS Usage');
  //   }

  //   // ─── Sheet 7: SWIFT VAS Usage ────────────────────────────────────────
  //   if (analysisData.swiftAnalysis.vasUsage && analysisData.swiftAnalysis.vasUsage.length > 0) {
  //     const vasData = analysisData.swiftAnalysis.vasUsage.map((v, idx) => ({
  //       '#': idx + 1,
  //       'VAS Name': v.vasName,
  //       'Category': v.category,
  //       'Activation Date': v.activationDate,
  //       'Expiry Date': v.expiryDate,
  //       // 'Status': v.status
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(vasData), 'SWIFT VAS Usage');
  //   }

  //   // ─── Sheet 8: SWIFT Failures ──────────────────────────────────────────
  //   if (analysisData.swiftAnalysis.failures.length > 0) {
  //     const failureData = analysisData.swiftAnalysis.failures.map((f, idx) => ({
  //       '#': idx + 1,
  //       'Failure Type': f.type,
  //       'Expected': f.expected,
  //       'Actual': f.actual,
  //       'Severity': f.severity
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(failureData), 'SWIFT Failures');
  //   }

  //   // ─── Sheet 9: IN Results ──────────────────────────────────────────────
  //   const inResultsData = analysisData.inAnalysis.results.map((r, idx) => ({
  //     '#': idx + 1,
  //     'Field': r.field,
  //     'Value': r.value,
  //     'Expected': r.expected,
  //     'Status': r.status
  //   }));
  //   xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inResultsData), 'IN Results');

  //   // ─── Sheet 10: IN Dedicated Accounts ──────────────────────────────────
  //   if (analysisData.inAnalysis.dedicatedAccounts.length > 0) {
  //     const daData = analysisData.inAnalysis.dedicatedAccounts.map((da, idx) => ({
  //       '#': idx + 1,
  //       'DA Name': da.daName,
  //       'DA ID': da.daId,
  //       'Start Date': da.startDate,
  //       'Expiry Date': da.expiryDate,
  //       'DA Value': da.daValue,
  //       'Unit': da.unit,
  //       'Type': da.type
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daData), 'IN Dedicated Accounts');
  //   }

  //   // ─── Sheet 11: IN Offers ──────────────────────────────────────────────
  //   if (analysisData.inAnalysis.offers.length > 0) {
  //     const offersData = analysisData.inAnalysis.offers.map((o, idx) => ({
  //       '#': idx + 1,
  //       'Offer Name': o.offerName,
  //       'Offer ID': o.offerId,
  //       'Start Date & Time': o.startDateTime,
  //       'End Date & Time': o.endDateTime,
  //       'Offer Type': o.offerType
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersData), 'IN Offers');
  //   }

  //   // ─── Sheet 12: IN Failures ─────────────────────────────────────────────
  //   if (analysisData.inAnalysis.failures.length > 0) {
  //     const failureData = analysisData.inAnalysis.failures.map((f, idx) => ({
  //       '#': idx + 1,
  //       'Failure Type': f.type,
  //       'Expected': f.expected,
  //       'Actual': f.actual,
  //       'Severity': f.severity
  //     }));
  //     xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(failureData), 'IN Failures');
  //   }

  //   xlsx.writeFile(workbook, excelFilepath);
  //   console.log(`[ExcelReportService] Analysis Excel report: ${excelFilepath}`);

  //   // ─── Generate HTML report ─────────────────────────────────────────────
  //   const htmlContent = this.generateAnalysisHTMLReport(analysisData);
  //   fs.writeFileSync(htmlFilepath, htmlContent, 'utf8');
  //   console.log(`[ExcelReportService] Analysis HTML report: ${htmlFilepath}`);

  //   // ─── Generate PDF report ──────────────────────────────────────────────
  //   try {
  //     const pdfHTMLContent = this.generateAnalysisPDFHTMLReport(analysisData);
  //     await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
  //     console.log(`[ExcelReportService] Analysis PDF report: ${pdfFilepath}`);
  //   } catch (err: any) {
  //     console.error(`[ExcelReportService] Analysis PDF generation failed: ${err.message}`);
  //     try {
  //       const fallbackHTML = `<html><body><h1>Analysis Report - ${msisdn}</h1><p>Generated: ${new Date().toLocaleString()}</p><p>PDF generation failed, please check the Excel file for details.</p></body></html>`;
  //       await this.convertHTMLToPDF(fallbackHTML, pdfFilepath);
  //       console.log(`[ExcelReportService] Analysis Fallback PDF created: ${pdfFilepath}`);
  //     } catch (_) {
  //       console.warn(`[ExcelReportService] Could not create fallback PDF for analysis ${msisdn}`);
  //     }
  //   }

  //   // ─── Generate ZIP Bundle ──────────────────────────────────────────────
  //   const zipPath = path.join(finalReportsDir, `${reportBaseName}.zip`);
  //   await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

  //   return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
  // }

  async writeAnalysisReport(analysisData: AnalysisReportData): Promise<{ excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }> {
  const reportsDir = path.resolve('./reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }

  const finalReportsDir = path.resolve('./finalreports');
  if (!fs.existsSync(finalReportsDir)) {
    fs.mkdirSync(finalReportsDir, { recursive: true });
  }

  const msisdn = analysisData.testCase.msisdn;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportBaseName = `Analysis_Report_${msisdn}_${timestamp}`;
  const excelFilepath = path.join(reportsDir, `${reportBaseName}.xlsx`);
  const htmlFilepath = path.join(reportsDir, `${reportBaseName}.html`);
  const pdfFilepath = path.join(reportsDir, `${reportBaseName}.pdf`);

  const workbook = xlsx.utils.book_new();

  // ─── Sheet 1: Executive Summary (UPDATED with PreTest and VI App) ──────
  const summaryData = [{
    'Test Case': analysisData.testCase.name,
    'MSISDN': analysisData.testCase.msisdn,
    'Test Date': analysisData.testCase.testDate,
    'Overall Status': analysisData.testCase.overallStatus,
    'SWIFT Status': analysisData.testCase.swiftStatus,
    'IN Status': analysisData.testCase.inStatus,
    'PreTest Status': analysisData.testCase.preTestStatus || 'Skip',
    'VI App Status': analysisData.testCase.viAppStatus || 'Skip',
    'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
  }];
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryData), 'Executive Summary');

  // ─── Sheet 2: Comparison ──────────────────────────────────────────────
  const comparisonData = analysisData.comparison.map((c, idx) => ({
    '#': idx + 1,
    'Parameter': c.parameter,
    'Expected': c.expected,
    'Actual': c.actual,
    'Status': c.status
  }));
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(comparisonData), 'Comparison');

  // ─── Sheet 3: SWIFT Results ──────────────────────────────────────────
  const swiftResultsData = analysisData.swiftAnalysis.results.map((r, idx) => ({
    '#': idx + 1,
    'Field': r.field,
    'Expected': r.expected,
    'Actual': r.actual,
    'Status': r.status
  }));
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(swiftResultsData), 'SWIFT Results');

  // ─── Sheet 4: SWIFT Voice Usage ──────────────────────────────────────
  if (analysisData.swiftAnalysis.voiceUsage.length > 0) {
    const voiceData = analysisData.swiftAnalysis.voiceUsage.map((v, idx) => ({
      '#': idx + 1,
      'Offer Name': v.offerName,
      'Balance Left': v.balanceLeft,
      'Category': v.category,
      'Expiry Date': v.expiryDate,
      'Status': v.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(voiceData), 'SWIFT Voice Usage');
  }

  // ─── Sheet 5: SWIFT Data Usage ──────────────────────────────────────
  if (analysisData.swiftAnalysis.dataUsage.length > 0) {
    const dataUsageData = analysisData.swiftAnalysis.dataUsage.map((d, idx) => ({
      '#': idx + 1,
      'MSISDN': d.msisdn,
      'Note': d.note,
      'Status': d.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(dataUsageData), 'SWIFT Data Usage');
  }

  // ─── Sheet 6: SWIFT SMS Usage ────────────────────────────────────────
  if (analysisData.swiftAnalysis.smsUsage.length > 0) {
    const smsUsageData = analysisData.swiftAnalysis.smsUsage.map((s, idx) => ({
      '#': idx + 1,
      'MSISDN': s.msisdn,
      'Note': s.note,
      'Status': s.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(smsUsageData), 'SWIFT SMS Usage');
  }

  // ─── Sheet 7: SWIFT VAS Usage ────────────────────────────────────────
  if (analysisData.swiftAnalysis.vasUsage && analysisData.swiftAnalysis.vasUsage.length > 0) {
    const vasData = analysisData.swiftAnalysis.vasUsage.map((v, idx) => ({
      '#': idx + 1,
      'VAS Name': v.vasName,
      'Category': v.category,
      'Activation Date': v.activationDate,
      'Expiry Date': v.expiryDate,
      // 'Status': v.status || 'Pass'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(vasData), 'SWIFT VAS Usage');
  }

  // ─── Sheet 8: SWIFT Failures ──────────────────────────────────────────
  if (analysisData.swiftAnalysis.failures.length > 0) {
    const failureData = analysisData.swiftAnalysis.failures.map((f, idx) => ({
      '#': idx + 1,
      'Failure Type': f.type,
      'Expected': f.expected,
      'Actual': f.actual,
      'Severity': f.severity
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(failureData), 'SWIFT Failures');
  }

  // ─── Sheet 9: IN Results ──────────────────────────────────────────────
  const inResultsData = analysisData.inAnalysis.results.map((r, idx) => ({
    '#': idx + 1,
    'Field': r.field,
    'Value': r.value,
    'Expected': r.expected,
    'Status': r.status
  }));
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inResultsData), 'IN Results');

  // ─── Sheet 10: IN Dedicated Accounts ──────────────────────────────────
  if (analysisData.inAnalysis.dedicatedAccounts.length > 0) {
    const daData = analysisData.inAnalysis.dedicatedAccounts.map((da, idx) => ({
      '#': idx + 1,
      'DA Name': da.daName,
      'DA ID': da.daId,
      'Start Date': da.startDate,
      'Expiry Date': da.expiryDate,
      'DA Value': da.daValue,
      'Unit': da.unit,
      'Type': da.type
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daData), 'IN Dedicated Accounts');
  }

  // ─── Sheet 11: IN Offers ──────────────────────────────────────────────
  if (analysisData.inAnalysis.offers.length > 0) {
    const offersData = analysisData.inAnalysis.offers.map((o, idx) => ({
      '#': idx + 1,
      'Offer Name': o.offerName,
      'Offer ID': o.offerId,
      'Start Date & Time': o.startDateTime,
      'End Date & Time': o.endDateTime,
      'Offer Type': o.offerType
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersData), 'IN Offers');
  }

  // ─── Sheet 12: IN Failures ─────────────────────────────────────────────
  if (analysisData.inAnalysis.failures.length > 0) {
    const failureData = analysisData.inAnalysis.failures.map((f, idx) => ({
      '#': idx + 1,
      'Failure Type': f.type,
      'Expected': f.expected,
      'Actual': f.actual,
      'Severity': f.severity
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(failureData), 'IN Failures');
  }

  // ─── NEW: Sheet 13: PreTest Summary ──────────────────────────────────
  if (analysisData.preTestSummary) {
    const preTestSummaryData = [{
      'MSISDN': analysisData.testCase.msisdn,
      'PreTest Status': analysisData.preTestSummary.status,
      'Reason': analysisData.preTestSummary.reason,
      'Customer Name': analysisData.preTestSummary.customerName,
      'Core Balance': analysisData.preTestSummary.coreBalance,
      'Service Validity': analysisData.preTestSummary.serviceValidity,
      'Account Status': analysisData.preTestSummary.accountStatus,
      'User Type': analysisData.preTestSummary.userType,
      'Dedicated Accounts': analysisData.preTestSummary.dedicatedAccounts?.length || 0,
      'Offers': analysisData.preTestSummary.offers?.length || 0,
      'Voice Entries': analysisData.preTestSummary.voice?.length || 0,
      'Data Entries': analysisData.preTestSummary.data?.length || 0,
      'SMS Entries': analysisData.preTestSummary.sms?.length || 0,
    }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSummaryData), 'PreTest Summary');
  }

  // ─── NEW: Sheet 14: PreTest Combined ──────────────────────────────────
  if (analysisData.preTestCombined && analysisData.preTestCombined.length > 0) {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(analysisData.preTestCombined), 'PreTest Combined');
  }

  // ─── NEW: Sheet 15: PreTest Dedicated Accounts ──────────────────────
  if (analysisData.preTestSummary?.dedicatedAccounts && analysisData.preTestSummary.dedicatedAccounts.length > 0) {
    const daData = analysisData.preTestSummary.dedicatedAccounts.map((da, idx) => ({
      '#': idx + 1,
      'DA Name': da.daName || 'N/A',
      'DA ID': da.daId || 'N/A',
      'Start Date': da.startDate || 'N/A',
      'Expiry Date': da.expiryDate || 'N/A',
      'DA Value': da.daValue || 'N/A',
      'Unit': da.unit || 'N/A',
      'Type': da.type || 'N/A'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daData), 'PreTest Dedicated Accounts');
  }

  // ─── NEW: Sheet 16: PreTest Offers ──────────────────────────────────
  if (analysisData.preTestSummary?.offers && analysisData.preTestSummary.offers.length > 0) {
    const offersData = analysisData.preTestSummary.offers.map((offer, idx) => ({
      '#': idx + 1,
      'Offer Name': offer.offerName || 'N/A',
      'Offer ID': offer.offerId || 'N/A',
      'Product ID': offer.productId || 'N/A',
      'Start Date & Time': offer.startDateTime || 'N/A',
      'End Date & Time': offer.endDateTime || 'N/A',
      'Offer Type': offer.offerType || 'N/A'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersData), 'PreTest Offers');
  }

  // ─── NEW: Sheet 17: VI App Results ──────────────────────────────────
  if (analysisData.viAppResult) {
    const viAppData = [{
      'MSISDN': analysisData.viAppResult.msisdn,
      'Circle': analysisData.viAppResult.circle,
      'Recharge MRP': analysisData.viAppResult.rechargeMRP,
      'Vi App Flag': analysisData.viAppResult.viAppFlag,
      'Ran': analysisData.viAppResult.ran ? 'Yes' : 'No',
      'Status': analysisData.viAppResult.status,
      'Matched Plan MRP': analysisData.viAppResult.matchedPlanMRP || 'N/A',
      'Expected Benefit': analysisData.viAppResult.expectedBenefit || 'N/A',
      'Actual Benefit': analysisData.viAppResult.actualBenefit || 'N/A',
      'MRP Matched': analysisData.viAppResult.mrpMatched ? 'Yes' : 'No',
      'Benefit Matched': analysisData.viAppResult.benefitMatched ? 'Yes' : 'No',
      'SMS Date Today': analysisData.viAppResult.smsDateIsToday ? 'Yes' : 'No',
      'SMS Matched': analysisData.viAppResult.smsMatched ? 'Yes' : 'No',
      'Last Recharge Amount': analysisData.viAppResult.lastRechargeAmount || 'N/A',
      'Pack Ends On Date': analysisData.viAppResult.packEndsOnDate || 'N/A',
      'Main Balance': analysisData.viAppResult.mainBalance || 'N/A',
      'Service Validity': analysisData.viAppResult.serviceValidity || 'N/A',
      'Screenshot Count': analysisData.viAppResult.screenshotCount,
      'Remarks': analysisData.viAppResult.remarks || 'N/A'
    }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppData), 'VI App Results');
  }

  // ─── NEW: Sheet 18: VI App Summary ──────────────────────────────────
  if (analysisData.viAppResult) {
    const viAppSummaryData = [{
      'MSISDN': analysisData.testCase.msisdn,
      'Recharge MRP': analysisData.viAppResult.rechargeMRP,
      'Circle': analysisData.viAppResult.circle,
      'VI App Flag': analysisData.viAppResult.viAppFlag,
      'Status': analysisData.viAppResult.status,
      'MRP Matched': analysisData.viAppResult.mrpMatched ? 'Yes' : 'No',
      'Benefit Matched': analysisData.viAppResult.benefitMatched ? 'Yes' : 'No',
      'SMS Date Today': analysisData.viAppResult.smsDateIsToday ? 'Yes' : 'No',
      'SMS Matched': analysisData.viAppResult.smsMatched ? 'Yes' : 'No',
      'Screenshot Count': analysisData.viAppResult.screenshotCount
    }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSummaryData), 'VI App Summary');
  }

  // ─── Sheet 19: Timeline ──────────────────────────────────────────────
  if (analysisData.timeline.length > 0) {
    const timelineData = analysisData.timeline.map((t, idx) => ({
      '#': idx + 1,
      'Timestamp': t.timestamp,
      'Event': t.event,
      'System': t.system
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(timelineData), 'Timeline');
  }

  // ─── Sheet 20: Recommendations ──────────────────────────────────────
  // if (analysisData.recommendations.length > 0) {
  //   const recData = analysisData.recommendations.map((r, idx) => ({
  //     '#': idx + 1,
  //     'Priority': r.priority,
  //     'Issue': r.issue,
  //     'Recommendation': r.recommendation,
  //     'Owner': r.owner
  //   }));
  //   // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(recData), 'Recommendations');
  // }

  xlsx.writeFile(workbook, excelFilepath);
  console.log(`[ExcelReportService] Analysis Excel report: ${excelFilepath}`);

  // ─── Generate HTML report ─────────────────────────────────────────────
  const htmlContent = this.generateAnalysisHTMLReport(analysisData);
  fs.writeFileSync(htmlFilepath, htmlContent, 'utf8');
  console.log(`[ExcelReportService] Analysis HTML report: ${htmlFilepath}`);

  // ─── Generate PDF report ──────────────────────────────────────────────
  try {
    const pdfHTMLContent = this.generateAnalysisPDFHTMLReport(analysisData);
    await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
    console.log(`[ExcelReportService] Analysis PDF report: ${pdfFilepath}`);
  } catch (err: any) {
    console.error(`[ExcelReportService] Analysis PDF generation failed: ${err.message}`);
    try {
      const fallbackHTML = `<html><body><h1>Analysis Report - ${msisdn}</h1><p>Generated: ${new Date().toLocaleString()}</p><p>PDF generation failed, please check the Excel file for details.</p></body></html>`;
      await this.convertHTMLToPDF(fallbackHTML, pdfFilepath);
      console.log(`[ExcelReportService] Analysis Fallback PDF created: ${pdfFilepath}`);
    } catch (_) {
      console.warn(`[ExcelReportService] Could not create fallback PDF for analysis ${msisdn}`);
    }
  }

  // ─── Generate ZIP Bundle ──────────────────────────────────────────────
  const zipPath = path.join(finalReportsDir, `${reportBaseName}.zip`);
  await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

  return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
}

  // ─── Create ZIP Bundle ──────────────────────────────────────────────────

  private async createZipBundle(files: string[], zipPath: string): Promise<void> {
    const JSZip = require('jszip');
    const zip = new JSZip();

    files.filter((filePath) => fs.existsSync(filePath)).forEach((filePath) => {
      const fileName = path.basename(filePath);
      zip.file(fileName, fs.readFileSync(filePath));
    });

    const buffer = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(zipPath, buffer);
    console.log(`[ExcelReportService] ZIP bundle created: ${zipPath}`);
  }

  // ─── Write All Individual Reports ──────────────────────────────────────

  async writeAllIndividualReports(): Promise<Array<{ row: InputRow; excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }>> {
    const results: Array<{ row: InputRow; excelPath: string; htmlPath: string; pdfPath: string; zipPath: string }> = [];

    for (const row of this.inputRows) {
      const report = await this.writeIndividualReport(row);
      results.push({ row, ...report });
      console.log(`[ExcelReportService] Generated all reports for MSISDN: ${row.msisdn}`);
    }

    console.log(`[ExcelReportService] Generated ${results.length} individual reports`);
    return results;
  }

  // ─── Write Consolidated Report ──────────────────────────────────────────

  async writeConsolidatedReport(): Promise<{ excelPath: string; htmlPath: string; pdfPath: string }> {
    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const excelFilepath = path.join(reportsDir, `SIM_Recharge_Report_Consolidated_${timestamp}.xlsx`);
    const htmlFilepath = path.join(reportsDir, `SIM_Recharge_Report_Consolidated_${timestamp}.html`);
    const pdfFilepath = path.join(reportsDir, `SIM_Recharge_Report_Consolidated_${timestamp}.pdf`);

    const workbook = xlsx.utils.book_new();

    // ─── Helper: Extract validity from plan benefit ──────────────────────
    const extractValidityFromPlan = (planBenefit: string): number => {
      if (!planBenefit) return 0;
      const parts = planBenefit.split(/\|\|/).map(p => p.trim());
      const validityPart = parts[1] || parts[0] || '';
      const match = validityPart.match(/(\d+)\s*D/i);
      return match ? parseInt(match[1], 10) : 0;
    };

    // ─── Sheet 1: Summary ──────────────────────────────────────────────────
    const allSummaryData = this.inputRows.map((row) => {
      const rowUatResults = this.uatResults.filter(r => r.msisdn === row.msisdn);
      const rowInResults = this.inResults.filter(r => r.msisdn === row.msisdn);
      const rowViAppResults = this.viAppResults.filter(r => r.msisdn === row.msisdn);
      const rowPreTestResults = this.preTestResults.filter(r => r.msisdn === row.msisdn);
      
      const preTestStatus = rowPreTestResults.length > 0 && rowPreTestResults.every(r => r.status === 'Pass') ? 'Pass' : 'Fail';
      
      return {
        'MSISDN': row.msisdn,
        'Circle': row.circle,
        'Recharge MRP': row.rechargeMRP,
        'PreTest Status': preTestStatus,
        'UAT Results': rowUatResults.length,
        'IN Results': rowInResults.length,
        'VI App Results': rowViAppResults.length,
        'Screenshots': this.screenshotIndex.filter(s => s.msisdn === row.msisdn).length
      };
    });
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allSummaryData), 'Summary');

    // ─── Sheet 2: Input Data ──────────────────────────────────────────────
    const inputSheetData = this.inputRows.map((row, idx) => ({
      '#': idx + 1,
      'MSISDN': row.msisdn,
      'CIRCLE': row.circle,
      'Recharge MRP': row.rechargeMRP,
      'Recharge': row.recharge,
      'SWIFT': row.swift,
      'IN': row.inFlag,
      'Vi App': row.viApp,
      'Plan Benefit': row.planBenefit || 'N/A',
      'Recharge Notification': row.rechargeNotification || 'N/A'
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inputSheetData), 'Input Data');

    // ─── Sheet 3: Swift Results ──────────────────────────────────────────
    const swiftResultsSheetData = this.uatResults.map((result) => {
      const inResult = this.inResults.find(r => r.msisdn === result.msisdn);
      const coreBalance = inResult?.coreBalance || result.currentCoreBalance || '0.00';
      
      return {
        'Sr. No.': result.srNo,
        'MSISDN': result.msisdn,
        'Transaction Id': result.transactionId || 'N/A',
        'Activation Date & Time': result.activationDateTime || 'N/A',
        'Validity': result.validity || 'N/A',
        'MRP': result.mrp || 'N/A',
        'Activation Mode': result.activationMode || 'N/A',
        'Current Core Balance': coreBalance,
        'eTOP UP Transaction Id': result.etopupTransactionId || 'N/A',
        'Retailer MSISDN': result.retailerMsisdn || 'N/A',
        'Name': result.name || 'N/A',
        'Category': result.category || 'N/A',
        'Benefits': result.benefits || 'N/A',
        'Detail Validity': result.detailValidity || 'N/A',
        'Reason': result.reason || 'N/A'
      };
    });
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(swiftResultsSheetData), 'Swift Results');

    // ─── Sheet 4: SWIFT Voice Usage (DEDUPLICATED) ──────────────────────
    const rawAllVoiceUsage: any[] = [];
    this.uatResults.forEach((r) => {
      (r.voiceUsage || []).forEach((v: any) => {
        rawAllVoiceUsage.push(v);
      });
    });
    const uniqueAllVoiceUsage = this.getUniqueItems(rawAllVoiceUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    const allVoiceUsage = uniqueAllVoiceUsage.length > 0 ? uniqueAllVoiceUsage.map((v: any) => ({
      'MSISDN': v.msisdn || '',
      'Offer Name': v.offer_name || v.offerName || 'N/A',
      'Balance Left': v.balance_left || v.balanceLeft || 'N/A',
      'Category': v.category || 'N/A',
      'Expiry Date': v.expiry_date || v.expiryDate || 'N/A'
    })) : [{ 'Note': 'No voice usage data available' }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allVoiceUsage), 'SWIFT Voice Usage');

    // ─── Sheet 5: SWIFT Data Usage (DEDUPLICATED) ──────────────────────
    const rawAllDataUsage: any[] = [];
    this.uatResults.forEach((r) => {
      (r.dataUsage || []).forEach((d: any) => {
        rawAllDataUsage.push(d);
      });
    });
    const uniqueAllDataUsage = this.getUniqueItems(rawAllDataUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    const allDataUsage = uniqueAllDataUsage.length > 0 ? uniqueAllDataUsage.map((d: any) => ({
      'MSISDN': d.msisdn || '',
      'Offer Name': d.offer_name || d.offerName || 'N/A',
      'Total Quota': d.total_quota || d.totalQuota || 'N/A',
      'Balance Left': d.balance_left || d.balanceLeft || 'N/A',
      'Category': d.category || 'N/A',
      'Expiry Date': d.expiry_date || d.expiryDate || 'N/A'
    })) : [{ 'Note': 'No data usage data available' }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allDataUsage), 'SWIFT Data Usage');

    // ─── Sheet 6: SWIFT SMS Usage (DEDUPLICATED) ──────────────────────
    const rawAllSmsUsage: any[] = [];
    this.uatResults.forEach((r) => {
      (r.smsUsage || []).forEach((s: any) => {
        rawAllSmsUsage.push(s);
      });
    });
    const uniqueAllSmsUsage = this.getUniqueItems(rawAllSmsUsage, ['offer_name', 'offerName', 'category', 'expiry_date', 'expiryDate']);
    const allSmsUsage = uniqueAllSmsUsage.length > 0 ? uniqueAllSmsUsage.map((s: any) => ({
      'MSISDN': s.msisdn || '',
      'Offer Name': s.offer_name || s.offerName || 'N/A',
      'Balance Left': s.balance_left || s.balanceLeft || 'N/A',
      'Category': s.category || 'N/A',
      'Expiry Date': s.expiry_date || s.expiryDate || 'N/A'
    })) : [{ 'Note': 'No SMS usage data available' }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allSmsUsage), 'SWIFT SMS Usage');

    // ─── Sheet 7: SWIFT Unlimited Offers ──────────────────────────────────
    const rawAllUnlimited: any[] = [];
    this.uatResults.forEach((r) => {
      (r.unlimitedOffers || []).forEach((u: any) => {
        rawAllUnlimited.push(u);
      });
    });
    const uniqueAllUnlimited = this.getUniqueItems(rawAllUnlimited, ['offer_name', 'offerName', 'mrp', 'benefits']);
    const allUnlimited = uniqueAllUnlimited.length > 0 ? uniqueAllUnlimited.map((u: any) => ({
      'MSISDN': u.msisdn || '',
      'MRP': u.mrp || 'N/A',
      'Activation Date': u.activation_date || u.activationDate || 'N/A',
      'Validity': u.validity || 'N/A',
      'Benefits': u.benefits || 'N/A'
    })) : [{ 'Note': 'No unlimited offers found' }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allUnlimited), 'SWIFT Unlimited Offers');

    // ─── Sheet 8: SWIFT VAS Offers (DEDUPLICATED) ──────────────────────
    const rawAllVas: any[] = [];
    this.uatResults.forEach((r) => {
      (r.vasOffers || []).forEach((v: any) => {
        rawAllVas.push(v);
      });
    });
    const uniqueAllVas = this.getUniqueItems(rawAllVas, ['name', 'offer_name', 'offerName', 'type', 'activation_date', 'activationDate']);
    const allVas = uniqueAllVas.length > 0 ? uniqueAllVas.map((v: any) => ({
      'MSISDN': v.msisdn || '',
      'MRP': v.mrp || 'N/A',
      'Name': v.name || v.offer_name || v.offerName || 'N/A',
      'Type': v.type || v.offer_type || v.category || 'N/A',
      'Activation Date': v.activation_date || v.activationDate || 'N/A',
      'Next Charging Date': v.next_charging_date || v.nextChargingDate || 'N/A'
    })) : [{ 'Note': 'No VAS offers found' }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allVas), 'SWIFT VAS Offers');

    // ─── Sheet 9: Swift UPSS Promotional History ──────────────────────────
    const upssSheetData = this.upssPromoHistory.map((item, idx) => ({
      'Sr No.': idx + 1,
      'MSISDN': item.msisdn,
      'Applied Date': item.applied_date,
      'Start Date': item.start_date,
      'Promotion Name': item.promotion_name,
      'Description': item.description,
      'Mode of Activation': item.mode_of_activation,
      'Promotion Status': item.promotion_status
    }));
    if (upssSheetData.length === 0) {
      upssSheetData.push({ 'Note': 'No UPSS promotional history found' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(upssSheetData), 'Swift UPSS Promotional History');

    // ─── Sheet 10: IN Results ─────────────────────────────────────────────
    const inSheetData = this.inResults.map((result, idx) => ({
      '#': idx + 1,
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      'Customer Name': result.customerName || 'N/A',
      'Core Balance': result.coreBalance || 'N/A',
      'Service Validity': result.serviceValidity || 'N/A',
      'Account Status': result.accountStatus || 'N/A',
      'User Type': result.userType || 'N/A',
      'Activation Date': result.activationDate || 'N/A',
      'Service Removal On': result.serviceRemovalOn || 'N/A',
      'Supervision Expires On': result.supervisionExpiresOn || 'N/A',
      'Main Balance': result.mainBalance || 'N/A',
      'Service Fee Expires On': result.serviceFeeExpiresOn || 'N/A',
      'Subscriber Status': result.subscriberStatus || 'N/A',
      'Credit Clearance On': result.creditClearanceOn || 'N/A',
      'Dedicated Accounts': (result.dedicatedAccounts || []).length,
      'Offers': (result.offers || []).length,
      'IN Status': result.status,
      'Remarks': result.remarks || 'N/A'
    }));
    if (inSheetData.length === 0) {
      inSheetData.push({ 'Note': 'No IN results available' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inSheetData), 'IN Results');

    // ─── Sheet 11: IN Dedicated Accounts ──────────────────────────────────
    const allDa: any[] = [];
    this.inResults.forEach((result) => {
      if (result.dedicatedAccounts) {
        result.dedicatedAccounts.forEach((da: any) => {
          allDa.push({
            'MSISDN': result.msisdn,
            'DA Name': da.daName || 'N/A',
            'DA ID': da.daId || 'N/A',
            'Start Date': da.startDate || 'N/A',
            'Expiry Date': da.expiryDate || 'N/A',
            'DA Value': da.daValue || 'N/A',
            'Unit': da.unit || 'N/A',
            'Type': da.type || 'N/A'
          });
        });
      }
    });
    if (allDa.length === 0) {
      allDa.push({ 'Note': 'No dedicated accounts found' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allDa), 'IN Dedicated Accounts');

    // ─── Sheet 12: IN Offers ──────────────────────────────────────────────
    const allOffers: any[] = [];
    this.inResults.forEach((result) => {
      if (result.offers) {
        result.offers.forEach((offer: any) => {
          allOffers.push({
            'MSISDN': result.msisdn,
            'Offer Name': offer.offerName || 'N/A',
            'Offer ID': offer.offerId || 'N/A',
            'Product ID': offer.productId || 'N/A',
            'Start Date & Time': offer.startDateTime || 'N/A',
            'End Date & Time': offer.endDateTime || 'N/A',
            'Offer Type': offer.offerType || 'N/A'
          });
        });
      }
    });
    if (allOffers.length === 0) {
      allOffers.push({ 'Note': 'No offers found' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allOffers), 'IN Offers');

    // ─── Sheet 13: PreTest Summary ──────────────────────────────────────
    const preTestSummaryData = this.preTestResults.map((pt, idx) => ({
      '#': idx + 1,
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
      'Voice Entries': pt.voice.length,
      'Data Entries': pt.data.length,
      'SMS Entries': pt.sms.length,
      'Dedicated Accounts': (pt.dedicatedAccounts || []).length,
      'Offers': (pt.offers || []).length,
      'Screenshot Count': pt.screenshotCount
    }));
    if (preTestSummaryData.length === 0) {
      preTestSummaryData.push({ 'Note': 'No PreTest results available' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSummaryData), 'PreTest Summary');

    // ─── Sheet 14: PreTest Voice Usage ──────────────────────────────────
    const allPreTestVoice: any[] = [];
    this.preTestResults.forEach((pt) => {
      pt.voice.forEach((v: any) => {
        allPreTestVoice.push({
          'MSISDN': pt.msisdn,
          'Offer Name': v.offer_name || 'N/A',
          'Balance Left': v.balance_left || 'N/A',
          'Category': v.category || 'N/A',
          'Expiry Date': v.expiry_date || 'N/A'
        });
      });
    });
    if (allPreTestVoice.length === 0) {
      allPreTestVoice.push({ 'Note': 'No voice usage data' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allPreTestVoice), 'PreTest Voice Usage');

    // ─── Sheet 15: PreTest Data Usage ──────────────────────────────────
    const allPreTestData: any[] = [];
    this.preTestResults.forEach((pt) => {
      pt.data.forEach((d: any) => {
        allPreTestData.push({
          'MSISDN': pt.msisdn,
          'Offer Name': d.offer_name || 'N/A',
          'Total Quota': d.total_quota || 'N/A',
          'Balance Left': d.balance_left || 'N/A',
          'Category': d.category || 'N/A',
          'Expiry Date': d.expiry_date || 'N/A'
        });
      });
    });
    if (allPreTestData.length === 0) {
      allPreTestData.push({ 'Note': 'No data usage data' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allPreTestData), 'PreTest Data Usage');

    // ─── Sheet 16: PreTest SMS Usage ──────────────────────────────────
    const allPreTestSMS: any[] = [];
    this.preTestResults.forEach((pt) => {
      pt.sms.forEach((s: any) => {
        allPreTestSMS.push({
          'MSISDN': pt.msisdn,
          'Offer Name': s.offer_name || 'N/A',
          'Balance Left': s.balance_left || 'N/A',
          'Category': s.category || 'N/A',
          'Expiry Date': s.expiry_date || 'N/A'
        });
      });
    });
    if (allPreTestSMS.length === 0) {
      allPreTestSMS.push({ 'Note': 'No SMS usage data' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allPreTestSMS), 'PreTest SMS Usage');

    // ─── Sheet 17: PreTest Dedicated Accounts ──────────────────────────────
    const allPreTestDA: any[] = [];
    this.preTestResults.forEach((pt) => {
      if (pt.dedicatedAccounts) {
        pt.dedicatedAccounts.forEach((da: any) => {
          allPreTestDA.push({
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
      }
    });
    if (allPreTestDA.length === 0) {
      allPreTestDA.push({ 'Note': 'No dedicated accounts found' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allPreTestDA), 'PreTest Dedicated Accounts');

    // ─── Sheet 18: PreTest Offers ──────────────────────────────────────────
    const allPreTestOffers: any[] = [];
    this.preTestResults.forEach((pt) => {
      if (pt.offers) {
        pt.offers.forEach((offer: any) => {
          allPreTestOffers.push({
            'MSISDN': pt.msisdn,
            'Offer Name': offer.offerName || 'N/A',
            'Offer ID': offer.offerId || 'N/A',
            'Product ID': offer.productId || 'N/A',
            'Start Date & Time': offer.startDateTime || 'N/A',
            'End Date & Time': offer.endDateTime || 'N/A',
            'Offer Type': offer.offerType || 'N/A'
          });
        });
      }
    });
    if (allPreTestOffers.length === 0) {
      allPreTestOffers.push({ 'Note': 'No offers found' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allPreTestOffers), 'PreTest Offers');

    // ─── Sheet 19: PreTest Combined ──────────────────────────────────────
    const allPreTestCombined: any[] = [];
    this.preTestResults.forEach((pt) => {
      allPreTestCombined.push({
        'MSISDN': pt.msisdn,
        'Circle': pt.circle,
        'Recharge MRP': pt.rechargeMRP,
        'PreTest Status': pt.status,
        'Reason': pt.reason,
        'Type': '--- SUMMARY ---',
        'Offer Name': '',
        'Balance Left': '',
        'Total Quota': '',
        'Category': '',
        'Expiry Date': ''
      });

      pt.voice.forEach((v: any) => {
        allPreTestCombined.push({
          'MSISDN': pt.msisdn,
          'Circle': pt.circle,
          'Recharge MRP': pt.rechargeMRP,
          'PreTest Status': pt.status,
          'Reason': pt.reason,
          'Type': 'VOICE',
          'Offer Name': v.offer_name || 'N/A',
          'Balance Left': v.balance_left || 'N/A',
          'Total Quota': 'N/A',
          'Category': v.category || 'N/A',
          'Expiry Date': v.expiry_date || 'N/A'
        });
      });

      pt.data.forEach((d: any) => {
        allPreTestCombined.push({
          'MSISDN': pt.msisdn,
          'Circle': pt.circle,
          'Recharge MRP': pt.rechargeMRP,
          'PreTest Status': pt.status,
          'Reason': pt.reason,
          'Type': 'DATA',
          'Offer Name': d.offer_name || 'N/A',
          'Balance Left': d.balance_left || 'N/A',
          'Total Quota': d.total_quota || 'N/A',
          'Category': d.category || 'N/A',
          'Expiry Date': d.expiry_date || 'N/A'
        });
      });

      pt.sms.forEach((s: any) => {
        allPreTestCombined.push({
          'MSISDN': pt.msisdn,
          'Circle': pt.circle,
          'Recharge MRP': pt.rechargeMRP,
          'PreTest Status': pt.status,
          'Reason': pt.reason,
          'Type': 'SMS',
          'Offer Name': s.offer_name || 'N/A',
          'Balance Left': s.balance_left || 'N/A',
          'Total Quota': 'N/A',
          'Category': s.category || 'N/A',
          'Expiry Date': s.expiry_date || 'N/A'
        });
      });

      if (pt.voice.length > 0 || pt.data.length > 0 || pt.sms.length > 0) {
        allPreTestCombined.push({
          'MSISDN': '',
          'Circle': '',
          'Recharge MRP': '',
          'PreTest Status': '',
          'Reason': '',
          'Type': '--- END ---',
          'Offer Name': '',
          'Balance Left': '',
          'Total Quota': '',
          'Category': '',
          'Expiry Date': ''
        });
      }
    });
    if (allPreTestCombined.length === 0) {
      allPreTestCombined.push({ 'Note': 'No PreTest data available' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(allPreTestCombined), 'PreTest Combined');

    // ─── Sheet 20: VI App Results ──────────────────────────────────────────
    const viAppSheetData = this.viAppResults.map((result, idx) => ({
      'Sr. No.': idx + 1,
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      'Vi App Flag': result.viAppFlag,
      'Ran': result.ran ? 'Yes' : 'No',
      'Status': result.status,
      'Matched Plan MRP': result.matchedPlanMRP || 'N/A',
      'Expected Benefit': result.expectedBenefit || 'N/A',
      'Actual Benefit': result.actualBenefit || 'N/A',
      'MRP Matched': result.mrpMatched ? 'Yes' : 'No',
      'Benefit Matched': result.benefitMatched ? 'Yes' : 'No',
      'Last Recharge Amount': result.lastRechargeAmount || 'N/A',
      'Pack Ends On Date': result.packEndsOnDate || 'N/A',
      'Main Balance': result.mainBalance || 'N/A',
      'Service Validity': result.serviceValidity || 'N/A',
      'Screenshot Count': result.screenshotCount,
      'Remarks': result.remarks || 'N/A'
    }));
    if (viAppSheetData.length === 0) {
      viAppSheetData.push({ 'Note': 'No VI App results available' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');

    // ─── Sheet 21: VI App Summary ──────────────────────────────────────────
    const viAppSummaryData = this.inputRows.map((row) => {
      const rowViAppResults = this.viAppResults.filter(r => r.msisdn === row.msisdn);
      return {
        'MSISDN': row.msisdn,
        'Recharge MRP': row.rechargeMRP,
        'Circle': row.circle,
        'VI App Flag': row.viApp,
        'Total VI App Results': rowViAppResults.length,
        'Pass Count': rowViAppResults.filter(r => r.status === 'Pass').length,
        'Fail Count': rowViAppResults.filter(r => r.status === 'Fail').length,
        'Skip Count': rowViAppResults.filter(r => r.status === 'Skip').length,
        'Error Count': rowViAppResults.filter(r => r.status === 'Error').length
      };
    });
    if (viAppSummaryData.length === 0) {
      viAppSummaryData.push({ 'Note': 'No VI App results available' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSummaryData), 'VI App Summary');

    // ─── Sheet 22: Screenshots ──────────────────────────────────────────────
    const screenshotSheetData = this.screenshotIndex.map((screenshot) => ({
      'Sr. No.': screenshot.srNo,
      'MSISDN': screenshot.msisdn,
      'File': screenshot.screenshotFile,
      'Captured At': screenshot.capturedAt,
      'Step Name': screenshot.stepName || 'General'
    }));
    if (screenshotSheetData.length === 0) {
      screenshotSheetData.push({ 'Note': 'No screenshots captured' });
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(screenshotSheetData), 'Screenshots');

    xlsx.writeFile(workbook, excelFilepath);
    console.log(`[ExcelReportService] Consolidated Excel report: ${excelFilepath}`);

    // ─── Generate consolidated HTML ────────────────────────────────────────
    // (Simplified - just a placeholder for consolidated)
    const consolidatedHTML = `<html><body><h1>Consolidated SIM Recharge Report</h1><p>Generated: ${new Date().toLocaleString()}</p><p>${this.inputRows.length} rows processed</p></body></html>`;
    fs.writeFileSync(htmlFilepath, consolidatedHTML, 'utf8');
    console.log(`[ExcelReportService] Consolidated HTML report: ${htmlFilepath}`);

    // ─── Generate consolidated PDF ─────────────────────────────────────────
    try {
      await this.convertHTMLToPDF(consolidatedHTML, pdfFilepath);
      console.log(`[ExcelReportService] Consolidated PDF report: ${pdfFilepath}`);
    } catch (err: any) {
      console.error(`[ExcelReportService] Consolidated PDF generation failed: ${err.message}`);
    }

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath };
  }

  // ─── Legacy writeReport ──────────────────────────────────────────────────

  async writeReport(): Promise<string> {
    if (this.inputRows.length > 1) {
      await this.writeAllIndividualReports();
      const consolidated = await this.writeConsolidatedReport();
      return consolidated.excelPath;
    }

    if (this.inputRows.length === 1) {
      const result = await this.writeIndividualReport(this.inputRows[0]);
      return result.excelPath;
    }

    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filepath = path.join(reportsDir, `SIM_Recharge_Report_${timestamp}.xlsx`);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'Message': 'No data available' }]), 'Empty');
    xlsx.writeFile(workbook, filepath);
    return filepath;
  }

  // ─── PDF Report Generation ──────────────────────────────────────────────

  async writePDFReport(): Promise<string> {
    if (this.inputRows.length > 1) {
      await this.writeAllIndividualReports();
      const consolidated = await this.writeConsolidatedReport();
      return consolidated.pdfPath;
    }

    if (this.inputRows.length === 1) {
      const result = await this.writeIndividualReport(this.inputRows[0]);
      return result.pdfPath;
    }

    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfPath = path.join(reportsDir, `SIM_Recharge_Report_${timestamp}.pdf`);

    try {
      const emptyHTML = `<!DOCTYPE html><html><body><h1>No data available</h1></body></html>`;
      await this.convertHTMLToPDF(emptyHTML, pdfPath);
    } catch {
      fs.writeFileSync(pdfPath, '', 'utf8');
    }
    return pdfPath;
  }
}

// ─── Utility Functions ────────────────────────────────────────────────────

function parseIndianDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  
  // Try to parse "12 Aug '26" format
  const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})/);
  if (match) {
    const day = parseInt(match[1], 10);
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const month = monthMap[match[2]];
    if (month === undefined) return null;
    const year = 2000 + parseInt(match[3], 10);
    return new Date(year, month, day);
  }
  
  // Try to parse "16 Jul '26 07.20 PM" format
  const fullMatch = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})\s+(\d{1,2})\.(\d{2})\s+(AM|PM)/i);
  if (fullMatch) {
    const day = parseInt(fullMatch[1], 10);
    const monthMap: Record<string, number> = {
      'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
      'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
    };
    const month = monthMap[fullMatch[2]];
    if (month === undefined) return null;
    const year = 2000 + parseInt(fullMatch[3], 10);
    let hour = parseInt(fullMatch[4], 10);
    const minute = parseInt(fullMatch[5], 10);
    const meridiem = fullMatch[6].toUpperCase();
    
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    
    return new Date(year, month, day, hour, minute);
  }
  
  return null;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}