// src/services/ExcelReportService.ts
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// ─── Interfaces ───────────────────────────────────────────────────────────

// ExcelReportService.ts - Updated ViAppResult interface

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
  // 👈 ADD SMS FIELDS
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

export interface AnalysisReportData {
  testCase: {
    name: string;
    msisdn: string;
    testDate: string;
    overallStatus: 'Pass' | 'Fail';
    swiftStatus: 'Pass' | 'Fail' | 'Skip';
    inStatus: 'Pass' | 'Fail' | 'Skip';
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

  // ── UAT Results ──────────────────────────────────────────────────────────

  addUATResult(result: Omit<UATResult, 'srNo'>): void {
    const srNo = this.uatResults.length + 1;
    this.uatResults.push({ ...result, srNo });
    console.log(`[ExcelReportService] Added UAT result #${srNo} for MSISDN: ${result.msisdn}`);
  }

  // ── IN Results ──────────────────────────────────────────────────────────

  addINResult(result: INResult): void {
    // Ensure status is only Pass or Fail
    if (result.status !== 'Pass' && result.status !== 'Fail') {
      result.status = 'Fail';
    }
    this.inResults.push(result);
    console.log(`[ExcelReportService] Added IN result for MSISDN: ${result.msisdn} - Status: ${result.status}`);
  }

  getINResultCount(): number {
    return this.inResults.length;
  }

  // ── PreTest Results ─────────────────────────────────────────────────────

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
  // If SMS date is NOT today, the test should FAIL
  // Regardless of other checks passing
  if (result.status === 'Mismatch' && result.smsDateIsToday === false) {
    result.status = 'Fail';
  }
  
  // Also ensure that if status is 'Mismatch' for any other reason, convert to 'Fail'
  if (result.status === 'Mismatch') {
    result.status = 'Fail';
  }
  
  this.viAppResults.push(result);
  console.log(`[ExcelReportService] Added VI App result for MSISDN: ${result.msisdn} - Status: ${result.status}`);

  console.log(`[ExcelReportService] VI App Results count in consolidated: ${this.viAppResults.length}`);
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
        // Only allow Pass or Fail
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
          // Only allow Pass, Fail, or Skip
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

  // ─── Shared Style & Head Helper ────────────────────────────────────────

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
      .flow-box { background: #f5f8fa; padding: 15px; border-radius: 6px; margin: 10px 0; font-family: monospace; font-size: 13px; line-height: 1.8; border: 1px solid #e0e0e0; }
      .flow-step { padding: 4px 0; }
      .root-cause-box { background: #fdecea; padding: 20px; border-radius: 8px; border-left: 4px solid #c0392b; margin: 15px 0; }
      .root-cause-box h3 { color: #c0392b; }
      .recommendation-high { background: #ffebee; border-left: 4px solid #c62828; padding: 12px; margin: 8px 0; border-radius: 4px; }
      .recommendation-medium { background: #fff3e0; border-left: 4px solid #e65100; padding: 12px; margin: 8px 0; border-radius: 4px; }
      .recommendation-low { background: #f5f5f5; border-left: 4px solid #888; padding: 12px; margin: 8px 0; border-radius: 4px; }
      .verdict-box { text-align: center; padding: 30px; background: #fdecea; border-radius: 8px; border: 2px solid #c0392b; margin: 20px 0; }
      .verdict-box .verdict-status { font-size: 48px; }
      .verdict-box .verdict-text { font-size: 24px; font-weight: 700; color: #c0392b; }
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

  // ─── Cover Page Helper ─────────────────────────────────────────────────

  private getPDFCover(title: string, subtitle: string, metaItems: { label: string; value: string }[]): string {
    const metaHTML = metaItems.map(m => `<p><strong>${m.label}:</strong> ${m.value}</p>`).join('');
    return `
    <div class="cover">
      <div class="cover-decoration"></div>
      <div class="cover-decoration-2"></div>
      <div class="cover-content">
        <div class="cover-icon">&#9670;</div>
        <h1 class="cover-title" style="border:none;color:#333;padding:0;margin-bottom:10px;">${title}</h1>
        <p class="cover-subtitle">${subtitle}</p>
        <div class="cover-meta">
          ${metaHTML}
        </div>
      </div>
      <div class="cover-footer">
        Report generated by VI Sim Automation Platform<br>
        &copy; 2026 QDegrees Services Pvt. Ltd.
      </div>
    </div>`;
  }

  // ─── Generate Interactive HTML Report for a Single Row ────────────────

  generateIndividualHTMLReport(row: InputRow): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === row.msisdn);
    const uatResultsForRow = this.uatResults.filter(r => r.msisdn === row.msisdn);
    const inResultsForRow = this.inResults.filter(r => r.msisdn === row.msisdn);
    const viAppResultsForRow = this.viAppResults.filter(r => r.msisdn === row.msisdn);

    let html = this.getHTMLHead(`UAT Recharge Report - ${row.msisdn}`, false) + `
  <body>
  <div class="container">
    <div class="header-row">
      <h1>UAT Recharge Report</h1>
      <span class="mrp-badge">&#8377;${row.rechargeMRP}</span>
    </div>
    <p style="color: #888; margin-bottom: 20px;">MSISDN: <strong>${row.msisdn}</strong> | Circle: <strong>${row.circle}</strong> | Generated: ${timestamp}</p>

    <!-- Summary -->
    <div class="summary-grid">
      <div class="summary-item">
        <div class="number">${row.rechargeMRP}</div>
        <div class="label">Recharge MRP</div>
      </div>
      <div class="summary-item">
        <div class="number">${uatResultsForRow.length}</div>
        <div class="label">UAT Results</div>
      </div>
      <div class="summary-item">
        <div class="number">${inResultsForRow.length}</div>
        <div class="label">IN Results</div>
      </div>
      <div class="summary-item">
        <div class="number">${viAppResultsForRow.length}</div>
        <div class="label">VI App Results</div>
      </div>
      <div class="summary-item">
        <div class="number">${rowScreenshots.length}</div>
        <div class="label">Screenshots</div>
      </div>
    </div>

    <!-- Input Data -->
    <h2>Test Case Details</h2>
    <table>
      <thead>
        <tr>
          <th>Field</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><strong>MSISDN</strong></td><td>${row.msisdn}</td></tr>
        <tr><td><strong>Circle</strong></td><td>${row.circle}</td></tr>
        <tr><td><strong>Recharge MRP</strong></td><td>&#8377;${row.rechargeMRP}</td></tr>
        <tr><td><strong>Recharge</strong></td><td>${row.recharge === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
        <tr><td><strong>SWIFT</strong></td><td>${row.swift === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
        <tr><td><strong>IN</strong></td><td>${row.inFlag === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
        <tr><td><strong>Vi App</strong></td><td>${row.viApp === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
        <tr><td><strong>Plan Benefit</strong></td><td>${row.planBenefit || 'N/A'}</td></tr>
        <tr><td><strong>Recharge Notification</strong></td><td>${row.rechargeNotification || 'N/A'}</td></tr>
      </tbody>
    </table>

    <!-- Tabs -->
    <div class="tab-container">
      <button class="tab-btn active" onclick="switchTab('swift')">SWIFT Results</button>
      <button class="tab-btn" onclick="switchTab('pretest')">PreTest Results</button>
      <button class="tab-btn" onclick="switchTab('in')">IN Results</button>
      <button class="tab-btn" onclick="switchTab('screenshots')">Screenshots</button>
    </div>

    <!-- Tab 1: SWIFT Results -->
    <div id="tab-swift" class="tab-content active">
      <h2>SWIFT UAT Execution Results</h2>
  `;

    if (uatResultsForRow.length === 0) {
      html += `<p style="color: #888;">No SWIFT UAT results found for this MSISDN.</p>`;
    } else {
      html += `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Transaction ID</th>
            <th>Activation</th>
            <th>Validity</th>
            <th>IN</th>
            <th>SWIFT</th>
            <th>Vi App</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
      `;
      uatResultsForRow.forEach((result) => {
        const inBadge = result.inStatus === 'Pass' ? 'badge-pass' : (result.inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
        const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
        html += `
            <tr>
              <td>${result.srNo}</td>
              <td><small>${result.transactionId}</small></td>
              <td>${result.activationDateTime}</td>
              <td>${result.validity}</td>
              <td><span class="badge ${inBadge}">${result.inStatus || 'Skip'}</span></td>
              <td><span class="badge ${swiftBadge}">${result.swiftStatus || 'Skip'}</span></td>
              <td>${result.viAppStatus || 'Skip'}</td>
              <td><small>${result.reason || 'N/A'}</small></td>
            </tr>
          `;
      });
      html += `
        </tbody>
      </table>
      `;

      html += `<h3>Offer History Details</h3>`;
      uatResultsForRow.forEach((result) => {
        if (result.allOfferHistory && result.allOfferHistory.length > 0) {
          html += `
      <div class="info-box">
        <strong>Transaction ID:</strong> ${result.transactionId}<br>
        <strong>Activation:</strong> ${result.activationDateTime}<br>
        <strong>Validity:</strong> ${result.validity}<br>
        <strong>Benefits:</strong> ${result.benefits}<br>
        <strong>Recharge Notification:</strong> ${result.rechargeNotification || 'N/A'}<br>
        <strong>IN Status:</strong> ${result.inStatus || 'Skip'}<br>
        <strong>SWIFT Status:</strong> ${result.swiftStatus || 'Skip'}
      </div>
            `;
        }
      });
    }
    html += `
    </div>

    <!-- Tab: PreTest Total Usage -->
    <div id="tab-pretest" class="tab-content">
      <h2>PreTest — Total Usage (Voice / Data / SMS)</h2>
  `;
    const rowPreTestResultsHTML = this.preTestResults.filter(r => r.msisdn === row.msisdn);
    if (rowPreTestResultsHTML.length === 0) {
      html += `<p style="color: #888;">No PreTest results found for this MSISDN.</p>`;
    } else {
      rowPreTestResultsHTML.forEach((pt) => {
        const statusBadge = pt.status === 'Pass' ? 'badge-pass' : 'badge-fail';
        html += `
      <div class="info-box">
        <strong>Status:</strong> <span class="badge ${statusBadge}">${pt.status}</span>
        <strong style="margin-left: 20px;">Reason:</strong> ${pt.reason}
      </div>
      <h3>Voice Usage (${pt.voice.length})</h3>
      ${pt.voice.length === 0 ? '<p style="color:#888;">No active voice offers.</p>' : `
      <table>
        <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${pt.voice.map((v: any) => `
          <tr>
            <td>${v.offer_name || 'N/A'}</td>
            <td>${v.balance_left || 'N/A'}</td>
            <td>${v.category || 'N/A'}</td>
            <td>${v.expiry_date || 'N/A'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
      <h3>Data Usage (${pt.data.length})</h3>
      ${pt.data.length === 0 ? '<p style="color:#888;">No active data offers.</p>' : `
      <table>
        <thead><tr><th>Offer Name</th><th>Total Quota</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${pt.data.map((d: any) => `
          <tr>
            <td>${d.offer_name || 'N/A'}</td>
            <td>${d.total_quota || 'N/A'}</td>
            <td>${d.balance_left || 'N/A'}</td>
            <td>${d.category || 'N/A'}</td>
            <td>${d.expiry_date || 'N/A'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
      <h3>SMS Usage (${pt.sms.length})</h3>
      ${pt.sms.length === 0 ? '<p style="color:#888;">No active SMS offers.</p>' : `
      <table>
        <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${pt.sms.map((s: any) => `
          <tr>
            <td>${s.offer_name || 'N/A'}</td>
            <td>${s.balance_left || 'N/A'}</td>
            <td>${s.category || 'N/A'}</td>
            <td>${s.expiry_date || 'N/A'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`}
  `;
      });
    }
    html += `
    </div>

    <!-- Tab: IN Results -->
    <div id="tab-in" class="tab-content">
      <h2>IN Test Results</h2>
  `;

    if (inResultsForRow.length === 0) {
      html += `<p style="color: #888;">No IN test results found for this MSISDN.</p>`;
    } else {
      inResultsForRow.forEach((inResult) => {
        const statusBadge = inResult.status === 'Pass' ? 'badge-pass' : 'badge-fail';

        html += `
      <div class="info-box">
        <strong>Status:</strong> <span class="badge ${statusBadge}">${inResult.status}</span>
        <strong style="margin-left: 20px;">Customer:</strong> ${inResult.customerName || 'N/A'}
        <strong style="margin-left: 20px;">Circle:</strong> ${inResult.circle || 'N/A'}
      </div>

      <h3>Account Overview</h3>
      <div class="in-details-grid">
        <div class="in-detail-item"><strong>Activation Date</strong><span>${inResult.activationDate || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Removal On</strong><span>${inResult.serviceRemovalOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Supervision Expires On</strong><span>${inResult.supervisionExpiresOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Main Balance</strong><span>${inResult.mainBalance || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Fee Expires On</strong><span>${inResult.serviceFeeExpiresOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Subscriber Status</strong><span>${inResult.subscriberStatus || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Credit Clearance On</strong><span>${inResult.creditClearanceOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Core Balance</strong><span>${inResult.coreBalance || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Validity</strong><span>${inResult.serviceValidity || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Account Status</strong><span>${inResult.accountStatus || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>User Type</strong><span>${inResult.userType || 'N/A'}</span></div>
      </div>
  `;

        if (inResult.dedicatedAccounts && inResult.dedicatedAccounts.length > 0) {
          html += `
      <h3>Dedicated Accounts (${inResult.dedicatedAccounts.length})</h3>
      <table>
        <thead>
          <tr>
            <th>DA Name</th>
            <th>DA ID</th>
            <th>Start Date</th>
            <th>Expiry Date</th>
            <th>DA Value</th>
            <th>Unit</th>
            <th>Type</th>
          </tr>
        </thead>
        <tbody>
      `;
          inResult.dedicatedAccounts.forEach((da: any) => {
            html += `
            <tr>
              <td>${da.daName || 'N/A'}</td>
              <td>${da.daId || 'N/A'}</td>
              <td>${da.startDate || 'N/A'}</td>
              <td>${da.expiryDate || 'N/A'}</td>
              <td>${da.daValue || 'N/A'}</td>
              <td>${da.unit || 'N/A'}</td>
              <td>${da.type || 'N/A'}</td>
            </tr>
              `;
          });
          html += `
        </tbody>
      </table>
            `;
        }

        if (inResult.offers && inResult.offers.length > 0) {
          html += `
      <h3>Offers (${inResult.offers.length})</h3>
      <table>
        <thead>
          <tr>
            <th>Offer Name</th>
            <th>Offer ID</th>
            <th>Product ID</th>
            <th>Start Date & Time</th>
            <th>End Date & Time</th>
            <th>Offer Type</th>
          </tr>
        </thead>
        <tbody>
      `;
          inResult.offers.forEach((offer: any) => {
            html += `
            <tr>
              <td>${offer.offerName || 'N/A'}</td>
              <td>${offer.offerId || 'N/A'}</td>
              <td>${offer.productId || 'N/A'}</td>
              <td>${offer.startDateTime || 'N/A'}</td>
              <td>${offer.endDateTime || 'N/A'}</td>
              <td>${offer.offerType || 'N/A'}</td>
            </tr>
              `;
          });
          html += `
        </tbody>
      </table>
            `;
        }
      });
    }

    html += `
    </div>

    <!-- Tab: Screenshots -->
    <div id="tab-screenshots" class="tab-content">
      <h2>Screenshots (${rowScreenshots.length})</h2>
      <div class="screenshot-container">
  `;

    if (rowScreenshots.length === 0) {
      html += `<div class="no-screenshots">No screenshots found for this MSISDN.</div>`;
    } else {
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
        </div>
          `;
      });
    }

    html += `
      </div>
    </div>

    <div class="footer">
      <p>Report generated by VI Sim Automation Platform</p>
      <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
    </div>
  </div>

  <script>
  function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => {
      el.classList.remove('active');
    });
    document.getElementById('tab-' + tabName).classList.add('active');

    document.querySelectorAll('.tab-btn').forEach(el => {
      el.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(el => {
      if (el.textContent.toLowerCase().includes(tabName.toLowerCase())) {
        el.classList.add('active');
      }
    });
  }
  </script>
  <style>
    .tab-container { display: flex; gap: 10px; margin: 15px 0; flex-wrap: wrap; }
    .tab-btn { padding: 8px 20px; background: #f0f0f0; border: none; border-radius: 20px; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.3s; }
    .tab-btn:hover { background: #e0e0e0; }
    .tab-btn.active { background: #f38328; color: white; }
    .tab-content { display: none; }
    .tab-content.active { display: block; }
  </style>
  </body>
  </html>`;

    return html;
  }

  // ─── Generate PDF HTML Report for a Single Row ──────────────────────

  generateIndividualPDFHTMLReport(row: InputRow): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === row.msisdn);
    const uatResultsForRow = this.uatResults.filter(r => r.msisdn === row.msisdn);
    const inResultsForRow = this.inResults.filter(r => r.msisdn === row.msisdn);
    const viAppResultsForRow = this.viAppResults.filter(r => r.msisdn === row.msisdn);

    let html = this.getHTMLHead(`UAT Recharge Report PDF - ${row.msisdn}`, true);

    html += this.getPDFCover(
      'UAT Recharge Report',
      `Individual Test Case Report for MSISDN ${row.msisdn}`,
      [
        { label: 'MSISDN', value: row.msisdn },
        { label: 'Circle', value: row.circle },
        { label: 'Recharge MRP', value: `&#8377;${row.rechargeMRP}` },
        { label: 'Generated', value: timestamp },
        { label: 'UAT Results', value: String(uatResultsForRow.length) },
        { label: 'IN Results', value: String(inResultsForRow.length) },
        { label: 'VI App Results', value: String(viAppResultsForRow.length) },
        { label: 'Screenshots', value: String(rowScreenshots.length) }
      ]
    );

    html += `
  <body>
  <div class="container">
    <!-- Page 1: Summary & Input Data -->
    <div class="section">
      <div class="header-row">
        <h1>UAT Recharge Report</h1>
        <span class="mrp-badge">&#8377;${row.rechargeMRP}</span>
      </div>
      <p style="color: #888; margin-bottom: 20px;">MSISDN: <strong>${row.msisdn}</strong> | Circle: <strong>${row.circle}</strong> | Generated: ${timestamp}</p>

      <div class="summary-grid">
        <div class="summary-item"><div class="number">${row.rechargeMRP}</div><div class="label">Recharge MRP</div></div>
        <div class="summary-item"><div class="number">${uatResultsForRow.length}</div><div class="label">UAT Results</div></div>
        <div class="summary-item"><div class="number">${inResultsForRow.length}</div><div class="label">IN Results</div></div>
        <div class="summary-item"><div class="number">${viAppResultsForRow.length}</div><div class="label">VI App Results</div></div>
        <div class="summary-item"><div class="number">${rowScreenshots.length}</div><div class="label">Screenshots</div></div>
      </div>

      <h2>Test Case Details</h2>
      <table>
        <thead><tr><th>Field</th><th>Value</th></tr></thead>
        <tbody>
          <tr><td><strong>MSISDN</strong></td><td>${row.msisdn}</td></tr>
          <tr><td><strong>Circle</strong></td><td>${row.circle}</td></tr>
          <tr><td><strong>Recharge MRP</strong></td><td>&#8377;${row.rechargeMRP}</td></tr>
          <tr><td><strong>Recharge</strong></td><td>${row.recharge === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
          <tr><td><strong>SWIFT</strong></td><td>${row.swift === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
          <tr><td><strong>IN</strong></td><td>${row.inFlag === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
          <tr><td><strong>Vi App</strong></td><td>${row.viApp === 'yes' ? '&#10003; Yes' : '&#10007; No'}</td></tr>
          <tr><td><strong>Plan Benefit</strong></td><td>${row.planBenefit || 'N/A'}</td></tr>
          <tr><td><strong>Recharge Notification</strong></td><td>${row.rechargeNotification || 'N/A'}</td></tr>
        </tbody>
      </table>
    </div>

    <!-- Page 2: SWIFT Results -->
    <div class="section page-break">
      <h2>SWIFT UAT Execution Results</h2>
  `;

    if (uatResultsForRow.length === 0) {
      html += `<p style="color: #888;">No SWIFT UAT results found for this MSISDN.</p>`;
    } else {
      html += `
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Transaction ID</th>
            <th>Activation</th>
            <th>Validity</th>
            <th>IN</th>
            <th>SWIFT</th>
            <th>Vi App</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
        `;
      uatResultsForRow.forEach((result) => {
        const inBadge = result.inStatus === 'Pass' ? 'badge-pass' : (result.inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
        const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
        html += `
          <tr>
            <td>${result.srNo}</td>
            <td><small>${result.transactionId}</small></td>
            <td>${result.activationDateTime}</td>
            <td>${result.validity}</td>
            <td><span class="badge ${inBadge}">${result.inStatus || 'Skip'}</span></td>
            <td><span class="badge ${swiftBadge}">${result.swiftStatus || 'Skip'}</span></td>
            <td>${result.viAppStatus || 'Skip'}</td>
            <td><small>${result.reason || 'N/A'}</small></td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;

      const resultsWithHistory = uatResultsForRow.filter(r => r.allOfferHistory && r.allOfferHistory.length > 0);
      if (resultsWithHistory.length > 0) {
        html += `<h3>Offer History Details</h3>`;
        resultsWithHistory.forEach((result) => {
          html += `
      <div class="info-box">
        <strong>Transaction ID:</strong> ${result.transactionId}<br>
        <strong>Activation:</strong> ${result.activationDateTime}<br>
        <strong>Validity:</strong> ${result.validity}<br>
        <strong>Benefits:</strong> ${result.benefits}<br>
        <strong>Recharge Notification:</strong> ${result.rechargeNotification || 'N/A'}<br>
        <strong>IN Status:</strong> ${result.inStatus || 'Skip'}<br>
        <strong>SWIFT Status:</strong> ${result.swiftStatus || 'Skip'}
      </div>`;
        });
      }
    }

    html += `
    </div>

    <!-- Page 3: PreTest Results -->
    <div class="section page-break">
      <h2>PreTest — Total Usage (Voice / Data / SMS)</h2>
  `;
    const rowPreTestResultsPDF = this.preTestResults.filter(r => r.msisdn === row.msisdn);
    if (rowPreTestResultsPDF.length === 0) {
      html += `<p style="color: #888;">No PreTest results found for this MSISDN.</p>`;
    } else {
      rowPreTestResultsPDF.forEach((pt) => {
        const statusBadge = pt.status === 'Pass' ? 'badge-pass' : 'badge-fail';
        html += `
      <div class="info-box">
        <strong>Status:</strong> <span class="badge ${statusBadge}">${pt.status}</span>
        <strong style="margin-left: 20px;">Reason:</strong> ${pt.reason}
      </div>
      <h3>Voice Usage (${pt.voice.length})</h3>
      ${pt.voice.length === 0 ? '<p style="color:#888;">No active voice offers.</p>' : `
      <table>
        <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${pt.voice.map((v: any) => `<tr><td>${v.offer_name || 'N/A'}</td><td>${v.balance_left || 'N/A'}</td><td>${v.category || 'N/A'}</td><td>${v.expiry_date || 'N/A'}</td></tr>`).join('')}
        </tbody>
      </table>`}
      <h3>Data Usage (${pt.data.length})</h3>
      ${pt.data.length === 0 ? '<p style="color:#888;">No active data offers.</p>' : `
      <table>
        <thead><tr><th>Offer Name</th><th>Total Quota</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${pt.data.map((d: any) => `<tr><td>${d.offer_name || 'N/A'}</td><td>${d.total_quota || 'N/A'}</td><td>${d.balance_left || 'N/A'}</td><td>${d.category || 'N/A'}</td><td>${d.expiry_date || 'N/A'}</td></tr>`).join('')}
        </tbody>
      </table>`}
      <h3>SMS Usage (${pt.sms.length})</h3>
      ${pt.sms.length === 0 ? '<p style="color:#888;">No active SMS offers.</p>' : `
      <table>
        <thead><tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th></tr></thead>
        <tbody>
          ${pt.sms.map((s: any) => `<tr><td>${s.offer_name || 'N/A'}</td><td>${s.balance_left || 'N/A'}</td><td>${s.category || 'N/A'}</td><td>${s.expiry_date || 'N/A'}</td></tr>`).join('')}
        </tbody>
      </table>`}
  `;
      });
    }
    html += `
    </div>

    <!-- Page 4: VI App Results -->
    <div class="section page-break">
      <h2>VI App Results</h2>
  `;
    if (viAppResultsForRow.length === 0) {
      html += `<p style="color: #888;">No VI App results found for this MSISDN.</p>`;
    } else {
      viAppResultsForRow.forEach((result) => {
  const statusBadge = result.status === 'Pass' ? 'badge-pass' :
    (result.status === 'Fail' ? 'badge-fail' : 'badge-error');
  html += `
  <div class="info-box">
    <strong>Status:</strong> <span class="badge ${statusBadge}">${result.status}</span>
    <strong style="margin-left: 20px;">MRP Matched:</strong> ${result.mrpMatched ? '&#10003; Yes' : '&#10007; No'}
    <strong style="margin-left: 20px;">Benefit Matched:</strong> ${result.benefitMatched ? '&#10003; Yes' : '&#10007; No'}
    <br>
    <strong>SMS Date Today:</strong> ${result.smsDateIsToday ? '✅ Yes' : '❌ No'}
    <strong style="margin-left: 20px;">SMS Matched:</strong> ${result.smsMatched ? '✅ Yes' : '❌ No'}
  </div>
      // viAppResultsForRow.forEach((result) => {
      //   const statusBadge = result.status === 'Pass' ? 'badge-pass' :
      //     (result.status === 'Fail' ? 'badge-fail' : 'badge-error');
      //   html += `
      // <div class="info-box">
      //   <strong>Status:</strong> <span class="badge ${statusBadge}">${result.status}</span>
      //   <strong style="margin-left: 20px;">MRP Matched:</strong> ${result.mrpMatched ? '&#10003; Yes' : '&#10007; No'}
      //   <strong style="margin-left: 20px;">Benefit Matched:</strong> ${result.benefitMatched ? '&#10003; Yes' : '&#10007; No'}
      // </div>
      // <div class="in-details-grid">
      //   <div class="in-detail-item"><strong>Last Recharge Amount</strong><span>${result.lastRechargeAmount || 'N/A'}</span></div>
      //   <div class="in-detail-item"><strong>Actual Benefit</strong><span>${result.actualBenefit || 'N/A'}</span></div>
      //   <div class="in-detail-item"><strong>Matched Plan MRP</strong><span>${result.matchedPlanMRP || 'N/A'}</span></div>
      //   <div class="in-detail-item"><strong>Expected Benefit</strong><span>${result.expectedBenefit || 'N/A'}</span></div>
      //   <div class="in-detail-item"><strong>Pack Ends On</strong><span>${result.packEndsOnDate || 'N/A'}</span></div>
      //   <div class="in-detail-item"><strong>Main Balance</strong><span>${result.mainBalance || 'N/A'}</span></div>
      //   <div class="in-detail-item"><strong>Service Validity</strong><span>${result.serviceValidity || 'N/A'}</span></div>
      // </div>`;
        if (result.remarks) {
          html += `<p style="margin-top: 10px; font-size: 11px; color: #666;"><strong>Remarks:</strong> ${result.remarks}</p>`;
        }
      });
    }

    html += `
    </div>

    <!-- Page 5+: IN Results -->
    <div class="section page-break">
      <h2>IN Test Results</h2>
  `;

    if (inResultsForRow.length === 0) {
      html += `<p style="color: #888;">No IN test results found for this MSISDN.</p>`;
    } else {
      inResultsForRow.forEach((inResult) => {
        const statusBadge = inResult.status === 'Pass' ? 'badge-pass' : 'badge-fail';

        html += `
      <div class="info-box">
        <strong>Status:</strong> <span class="badge ${statusBadge}">${inResult.status}</span>
        <strong style="margin-left: 20px;">Customer:</strong> ${inResult.customerName || 'N/A'}
        <strong style="margin-left: 20px;">Circle:</strong> ${inResult.circle || 'N/A'}
      </div>

      <h3>Account Overview</h3>
      <div class="in-details-grid">
        <div class="in-detail-item"><strong>Activation Date</strong><span>${inResult.activationDate || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Removal On</strong><span>${inResult.serviceRemovalOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Supervision Expires On</strong><span>${inResult.supervisionExpiresOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Main Balance</strong><span>${inResult.mainBalance || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Fee Expires On</strong><span>${inResult.serviceFeeExpiresOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Subscriber Status</strong><span>${inResult.subscriberStatus || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Credit Clearance On</strong><span>${inResult.creditClearanceOn || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Core Balance</strong><span>${inResult.coreBalance || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Service Validity</strong><span>${inResult.serviceValidity || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>Account Status</strong><span>${inResult.accountStatus || 'N/A'}</span></div>
        <div class="in-detail-item"><strong>User Type</strong><span>${inResult.userType || 'N/A'}</span></div>
      </div>
  `;

        if (inResult.dedicatedAccounts && inResult.dedicatedAccounts.length > 0) {
          html += `
      <h3>Dedicated Accounts (${inResult.dedicatedAccounts.length})</h3>
      <table>
        <thead>
          <tr><th>DA Name</th><th>DA ID</th><th>Start Date</th><th>Expiry Date</th><th>DA Value</th><th>Unit</th><th>Type</th></tr>
        </thead>
        <tbody>
        `;
          inResult.dedicatedAccounts.forEach((da: any) => {
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

        if (inResult.offers && inResult.offers.length > 0) {
          html += `
      <h3>Offers (${inResult.offers.length})</h3>
      <table>
        <thead>
          <tr><th>Offer Name</th><th>Offer ID</th><th>Product ID</th><th>Start Date & Time</th><th>End Date & Time</th><th>Offer Type</th></tr>
        </thead>
        <tbody>
        `;
          inResult.offers.forEach((offer: any) => {
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
      });
    }

    html += `
    </div>

    <!-- Screenshots Section -->
    <div class="section page-break">
      <h2>Screenshots (${rowScreenshots.length})</h2>
      <div class="screenshot-container">
  `;

    if (rowScreenshots.length === 0) {
      html += `<div class="no-screenshots">No screenshots found for this MSISDN.</div>`;
    } else {
      rowScreenshots.forEach((s, index) => {
        const imageSrc = s.fullPath || `/screenshots/${s.screenshotFile}`;
        const stepName = s.stepName || 'Screenshot';
        const capturedTime = s.capturedAt ? new Date(s.capturedAt).toLocaleString() : '';

        html += `
        <div class="screenshot-item">
          <div class="screenshot-image">
            <img src="${imageSrc}" alt="${stepName}">
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
    }

    html += `
      </div>
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

  // ─── Generate Consolidated PDF HTML Report ────────────────────────────

  generateConsolidatedPDFHTMLReport(): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let html = this.getHTMLHead('UAT Recharge Report - Consolidated', true);

    html += this.getPDFCover(
      'UAT Recharge Report',
      'Consolidated Summary Report',
      [
        { label: 'Total Test Cases', value: String(this.inputRows.length) },
        { label: 'UAT Results', value: String(this.uatResults.length) },
        { label: 'IN Results', value: String(this.inResults.length) },
        { label: 'VI App Results', value: String(this.viAppResults.length) },
        { label: 'Total Screenshots', value: String(this.screenshotIndex.length) },
        { label: 'Generated', value: timestamp }
      ]
    );

    html += `
  <body>
  <div class="container">
    <!-- Summary Page -->
    <div class="section">
      <h1>UAT Recharge Report &mdash; Consolidated Summary</h1>
      <p style="color: #888; margin-bottom: 20px;">Generated: ${timestamp}</p>

      <div class="summary-grid">
        <div class="summary-item"><div class="number">${this.inputRows.length}</div><div class="label">Total Test Cases</div></div>
        <div class="summary-item"><div class="number">${this.uatResults.length}</div><div class="label">UAT Results</div></div>
        <div class="summary-item"><div class="number">${this.inResults.length}</div><div class="label">IN Results</div></div>
        <div class="summary-item"><div class="number">${this.viAppResults.length}</div><div class="label">VI App Results</div></div>
        <div class="summary-item"><div class="number">${this.screenshotIndex.length}</div><div class="label">Screenshots</div></div>
      </div>

      <h2>Test Case Summary</h2>
      <table>
        <thead>
          <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>Recharge</th><th>SWIFT</th><th>IN</th><th>Vi App</th></tr>
        </thead>
        <tbody>
  `;

    this.inputRows.forEach((row, idx) => {
      html += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${row.msisdn}</strong></td>
            <td>${row.circle}</td>
            <td>&#8377;${row.rechargeMRP}</td>
            <td>${row.recharge === 'yes' ? '&#10003;' : '&#10007;'}</td>
            <td>${row.swift === 'yes' ? '&#10003;' : '&#10007;'}</td>
            <td>${row.inFlag === 'yes' ? '&#10003;' : '&#10007;'}</td>
            <td>${row.viApp === 'yes' ? '&#10003;' : '&#10007;'}</td>
          </tr>`;
    });

    html += `
        </tbody>
      </table>
    </div>

    <!-- UAT Results Page -->
    <div class="section page-break">
      <h2>UAT Execution Results (SWIFT)</h2>
      <table>
        <thead>
          <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>IN Status</th><th>SWIFT Status</th><th>Vi App</th></tr>
        </thead>
        <tbody>
  `;

    this.uatResults.forEach((result) => {
      const inBadge = result.inStatus === 'Pass' ? 'badge-pass' : (result.inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      html += `
          <tr>
            <td>${result.srNo}</td>
            <td><strong>${result.msisdn}</strong></td>
            <td>${result.circle}</td>
            <td>&#8377;${result.mrp}</td>
            <td><span class="badge ${inBadge}">${result.inStatus || 'Skip'}</span></td>
            <td><span class="badge ${swiftBadge}">${result.swiftStatus || 'Skip'}</span></td>
            <td>${result.viAppStatus || 'Skip'}</td>
          </tr>`;
    });

    html += `
        </tbody>
      </table>
    </div>

    <!-- IN Results Page -->
    <div class="section page-break">
      <h2>IN Results Summary</h2>
      <table>
        <thead>
          <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>Status</th><th>Customer Name</th><th>Core Balance</th><th>Dedicated Accounts</th><th>Offers</th></tr>
        </thead>
        <tbody>
  `;

    this.inResults.forEach((result, idx) => {
      const statusBadge = result.status === 'Pass' ? 'badge-pass' : 'badge-fail';
      html += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${result.msisdn}</strong></td>
            <td>${result.circle}</td>
            <td>&#8377;${result.rechargeMRP}</td>
            <td><span class="badge ${statusBadge}">${result.status}</span></td>
            <td>${result.customerName || 'N/A'}</td>
            <td>${result.coreBalance || 'N/A'}</td>
            <td>${(result.dedicatedAccounts || []).length}</td>
            <td>${(result.offers || []).length}</td>
          </tr>`;
    });

    html += `
        </tbody>
      </table>
    </div>

    <!-- VI App Results Page -->
    <div class="section page-break">
      <h2>VI App Results Summary</h2>
  `;

    if (this.viAppResults.length === 0) {
      html += `<p style="color: #888;">No VI App results found.</p>`;
    } else {
      html += `
      <table>
        <thead>
          <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>Status</th><th>MRP Matched</th><th>Benefit Matched</th></tr>
        </thead>
        <tbody>
  `;
      this.viAppResults.forEach((result, idx) => {
        const statusBadge = result.status === 'Pass' ? 'badge-pass' : 'badge-fail';
        html += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${result.msisdn}</strong></td>
            <td>${result.circle}</td>
            <td>&#8377;${result.rechargeMRP}</td>
            <td><span class="badge ${statusBadge}">${result.status}</span></td>
            <td>${result.mrpMatched ? 'Yes' : 'No'}</td>
            <td>${result.benefitMatched ? 'Yes' : 'No'}</td>
          </tr>`;
      });
      html += `
        </tbody>
      </table>`;
    }

    html += `
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

  // ─── Generate Analysis HTML Report ──────────────────────────────────

  private generateAnalysisHTMLReport(data: AnalysisReportData): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Analysis Report - ${data.testCase.msisdn}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; color: #333; line-height: 1.5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #f38328; border-bottom: 3px solid #f38328; padding-bottom: 10px; margin-bottom: 20px; font-size: 24px; }
    h2 { color: #333; margin: 25px 0 10px 0; padding: 8px 0; border-bottom: 2px solid #eee; font-size: 18px; }
    h3 { color: #555; margin: 18px 0 10px 0; font-size: 15px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; font-size: 12px; }
    th { background: #f38328; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f9f9f9; }
    .badge { display: inline-block; padding: 3px 12px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-fail { background: #fdecea; color: #c0392b; }
    .badge-critical { background: #fdecea; color: #c0392b; font-weight: 700; }
    .badge-high { background: #ffebee; color: #c62828; }
    .badge-medium { background: #fff3e0; color: #e65100; }
    .badge-low { background: #f5f5f5; color: #888; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0 25px 0; }
    .summary-item { background: #f8f5f0; padding: 15px; border-radius: 6px; text-align: center; border-left: 4px solid #f38328; }
    .summary-item .number { font-size: 28px; font-weight: 700; color: #f38328; }
    .summary-item .label { font-size: 12px; color: #888; margin-top: 4px; }
    .info-box { background: #f8f5f0; padding: 15px; border-radius: 6px; margin: 10px 0; border-left: 4px solid #f38328; }
    .info-box strong { color: #f38328; }
    .flow-box { background: #f5f8fa; padding: 15px; border-radius: 6px; margin: 10px 0; font-family: monospace; font-size: 13px; line-height: 1.8; border: 1px solid #e0e0e0; }
    .flow-step { padding: 4px 0; }
    .root-cause-box { background: #fdecea; padding: 20px; border-radius: 8px; border-left: 4px solid #c0392b; margin: 15px 0; }
    .root-cause-box h3 { color: #c0392b; }
    .recommendation-high { background: #ffebee; border-left: 4px solid #c62828; padding: 12px; margin: 8px 0; border-radius: 4px; }
    .recommendation-medium { background: #fff3e0; border-left: 4px solid #e65100; padding: 12px; margin: 8px 0; border-radius: 4px; }
    .recommendation-low { background: #f5f5f5; border-left: 4px solid #888; padding: 12px; margin: 8px 0; border-radius: 4px; }
    .verdict-box { text-align: center; padding: 30px; background: #fdecea; border-radius: 8px; border: 2px solid #c0392b; margin: 20px 0; }
    .verdict-box .verdict-status { font-size: 48px; }
    .verdict-box .verdict-text { font-size: 24px; font-weight: 700; color: #c0392b; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 11px; color: #888; }
  </style>
</head>
<body>
<div class="container">
  <h1>FINAL ANALYSIS REPORT - SWIFT + IN Recharge UAT Execution</h1>
  <p style="color: #888; margin-bottom: 20px;">MSISDN: <strong>${data.testCase.msisdn}</strong> | Test Date: <strong>${data.testCase.testDate}</strong> | Generated: ${timestamp}</p>

  <!-- Executive Summary -->
  <h2>📋 Executive Summary</h2>
  <div class="summary-grid">
    <div class="summary-item">
      <div class="number">${data.testCase.name}</div>
      <div class="label">Test Case</div>
    </div>
    <div class="summary-item">
      <div class="number">${data.testCase.msisdn}</div>
      <div class="label">MSISDN</div>
    </div>
    <div class="summary-item">
      <div class="number">${data.testCase.testDate}</div>
      <div class="label">Test Date</div>
    </div>
    <div class="summary-item" style="border-left-color: ${data.testCase.overallStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">
      <div class="number" style="color: ${data.testCase.overallStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">${data.testCase.overallStatus === 'Pass' ? '✅ PASS' : '❌ FAILED'}</div>
      <div class="label">Overall Status</div>
    </div>
    <div class="summary-item" style="border-left-color: ${data.testCase.swiftStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">
      <div class="number" style="color: ${data.testCase.swiftStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">${data.testCase.swiftStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</div>
      <div class="label">SWIFT Status</div>
    </div>
    <div class="summary-item" style="border-left-color: ${data.testCase.inStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">
      <div class="number" style="color: ${data.testCase.inStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">${data.testCase.inStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</div>
      <div class="label">IN Status</div>
    </div>
  </div>

  <!-- Comparison -->
  <h2>1. Expected vs Actual - Side by Side Comparison</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Parameter</th><th>Expected (Input Data)</th><th>Actual (UAT/SWIFT/IN)</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${data.comparison.map((c, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${c.parameter}</strong></td>
          <td>${c.expected}</td>
          <td>${c.actual}</td>
          <td><span class="badge ${c.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${c.status === 'Pass' ? '✅' : '❌'} ${c.status}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- SWIFT Analysis -->
  <h2>2. Detailed SWIFT Analysis - <span style="color: ${data.testCase.swiftStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">${data.testCase.swiftStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</span></h2>
  
  <h3>SWIFT Test Execution Flow</h3>
  <div class="flow-box">
    ${data.swiftAnalysis.executionFlow.map((step, idx) => `
      <div class="flow-step">
        ${idx + 1}. ${step.step} ${step.value ? `──► ${step.value}` : ''} ${step.status ? `<span class="badge ${step.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${step.status === 'Pass' ? '✅' : '❌'}</span>` : ''}
      </div>
    `).join('')}
  </div>

  <h3>SWIFT UAT Results Table</h3>
  <table>
    <thead>
      <tr><th>Field</th><th>Expected</th><th>Actual</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${data.swiftAnalysis.results.map(r => `
        <tr>
          <td><strong>${r.field}</strong></td>
          <td>${r.expected}</td>
          <td>${r.actual}</td>
          <td><span class="badge ${r.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${r.status === 'Pass' ? '✅' : '❌'}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${data.swiftAnalysis.voiceUsage.length > 0 ? `
    <h3>SWIFT Voice Usage</h3>
    <table>
      <thead>
        <tr><th>Offer Name</th><th>Balance Left</th><th>Category</th><th>Expiry Date</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.swiftAnalysis.voiceUsage.map(v => `
          <tr>
            <td>${v.offerName}</td>
            <td>${v.balanceLeft}</td>
            <td>${v.category}</td>
            <td>${v.expiryDate}</td>
            <td><span class="badge ${v.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${v.status === 'Pass' ? '✅' : '❌'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p><strong>Verdict:</strong> ${data.swiftAnalysis.voiceUsage.every(v => v.status === 'Pass')
      ? 'Voice component correctly provisioned with Unlimited calls. ✅'
      : 'Voice component did not match expected unlimited calling benefits. ❌'}</p>
  ` : ''}

  ${data.swiftAnalysis.dataUsage.length > 0 ? `
    <h3>SWIFT Data Usage</h3>
    <table>
      <thead>
        <tr><th>MSISDN</th><th>Note</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.swiftAnalysis.dataUsage.map(d => `
          <tr>
            <td>${d.msisdn}</td>
            <td>${d.note}</td>
            <td><span class="badge ${d.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${d.status === 'Pass' ? '✅' : '❌'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  ${data.swiftAnalysis.smsUsage.length > 0 ? `
    <h3>SWIFT SMS Usage</h3>
    <table>
      <thead>
        <tr><th>MSISDN</th><th>Note</th><th>Status</th></tr>
      </thead>
      <tbody>
        ${data.swiftAnalysis.smsUsage.map(s => `
          <tr>
            <td>${s.msisdn}</td>
            <td>${s.note}</td>
            <td><span class="badge ${s.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${s.status === 'Pass' ? '✅' : '❌'}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  ` : ''}

  <h3>SWIFT Failure Reasons Summary</h3>
  <table>
    <thead>
      <tr><th>#</th><th>Failure Type</th><th>Expected</th><th>Actual</th><th>Severity</th></tr>
    </thead>
    <tbody>
      ${data.swiftAnalysis.failures.map((f, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${f.type}</td>
          <td>${f.expected}</td>
          <td>${f.actual}</td>
          <td><span class="badge badge-${f.severity.toLowerCase()}">${f.severity}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="info-box">
    <strong>SWIFT Overall Status:</strong> <span class="badge ${data.testCase.swiftStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${data.testCase.swiftStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</span>
  </div>

  <!-- IN Analysis -->
  <h2>3. Detailed IN Analysis - <span style="color: ${data.testCase.inStatus === 'Pass' ? '#2e7d32' : '#c0392b'};">${data.testCase.inStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</span></h2>

  <h3>IN Test Execution Flow</h3>
  <div class="flow-box">
    ${data.inAnalysis.executionFlow.map((step, idx) => `
      <div class="flow-step">
        ${idx + 1}. ${step.step} ${step.value ? `──► ${step.value}` : ''} ${step.status ? `<span class="badge ${step.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${step.status === 'Pass' ? '✅' : '❌'}</span>` : ''}
      </div>
    `).join('')}
  </div>

  <h3>IN Results Table</h3>
  <table>
    <thead>
      <tr><th>Field</th><th>Value</th><th>Expected</th><th>Status</th></tr>
    </thead>
    <tbody>
      ${data.inAnalysis.results.map(r => `
        <tr>
          <td><strong>${r.field}</strong></td>
          <td>${r.value}</td>
          <td>${r.expected}</td>
          <td><span class="badge ${r.status === 'Pass' ? 'badge-pass' : 'badge-fail'}">${r.status === 'Pass' ? '✅' : '❌'}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  ${data.inAnalysis.dedicatedAccounts.length > 0 ? `
    <h3>IN Dedicated Accounts</h3>
    <table>
      <thead>
        <tr><th>DA Name</th><th>DA ID</th><th>Start Date</th><th>Expiry Date</th><th>DA Value</th><th>Unit</th><th>Type</th></tr>
      </thead>
      <tbody>
        ${data.inAnalysis.dedicatedAccounts.map(da => `
          <tr>
            <td>${da.daName}</td>
            <td>${da.daId}</td>
            <td>${da.startDate}</td>
            <td>${da.expiryDate}</td>
            <td>${da.daValue}</td>
            <td>${da.unit}</td>
            <td>${da.type}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p><strong>Analysis:</strong> ${data.inAnalysis.overallStatus === 'Pass'
      ? 'Dedicated account values match expected plan quotas.'
      : 'DA values reflect wrong quotas and/or validity for the expected plan.'}</p>
    <p><strong>Verdict:</strong> ${data.inAnalysis.overallStatus === 'Pass'
      ? '<strong>PASS</strong> - Quotas and validity match expected plan'
      : '<strong>FAIL</strong> - Wrong quotas and validity'}</p>
  ` : ''}

  ${data.inAnalysis.offers.length > 0 ? `
    <h3>IN Offers</h3>
    <table>
      <thead>
        <tr><th>Offer Name</th><th>Offer ID</th><th>Start Date & Time</th><th>End Date & Time</th><th>Offer Type</th></tr>
      </thead>
      <tbody>
        ${data.inAnalysis.offers.map(o => `
          <tr>
            <td>${o.offerName}</td>
            <td>${o.offerId}</td>
            <td>${o.startDateTime}</td>
            <td>${o.endDateTime}</td>
            <td>${o.offerType}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p><strong>Analysis:</strong> ${data.inAnalysis.overallStatus === 'Pass'
      ? 'Offer validity periods match expected plan duration.'
      : 'Voice/data offers show activation with wrong validity period.'}</p>
    <p><strong>Verdict:</strong> ${data.inAnalysis.overallStatus === 'Pass'
      ? '✅ <strong>PASS</strong> - Validity period matches expected plan'
      : '❌ <strong>FAIL</strong> - Wrong validity period'}</p>
  ` : ''}

  <h3>IN Failure Reasons Summary</h3>
  <table>
    <thead>
      <tr><th>#</th><th>Failure Type</th><th>Expected</th><th>Actual</th><th>Severity</th></tr>
    </thead>
    <tbody>
      ${data.inAnalysis.failures.map((f, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${f.type}</td>
          <td>${f.expected}</td>
          <td>${f.actual}</td>
          <td><span class="badge badge-${f.severity.toLowerCase()}">${f.severity}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="info-box">
    <strong>IN Overall Status:</strong> <span class="badge ${data.testCase.inStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${data.testCase.inStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</span>
  </div>

  <!-- Root Cause Analysis -->
  <h2>4. Root Cause Analysis</h2>
  <div class="root-cause-box">
    <h3>🔴 CRITICAL ISSUE: WRONG PRODUCT PROVISIONED</h3>
    <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 4px;">
      <p><strong>Expected Plan:</strong> ${data.rootCause.expectedPlan}</p>
      <p><strong>Actual Plan:</strong> ${data.rootCause.actualPlan}</p>
    </div>
    <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 4px;">
      <h4>Issues Identified:</h4>
      <ul style="margin-left: 20px; line-height: 2;">
        ${data.rootCause.issues.map(issue => `<li>${issue}</li>`).join('')}
      </ul>
    </div>
    <div style="margin: 15px 0; padding: 15px; background: white; border-radius: 4px;">
      <p>${data.rootCause.summary}</p>
    </div>
  </div>

  <!-- Timeline -->
  <h2>5. Test Execution Timeline</h2>
  <table>
    <thead>
      <tr><th>#</th><th>Timestamp</th><th>Event</th><th>System</th></tr>
    </thead>
    <tbody>
      ${data.timeline.map((t, idx) => `
        <tr>
          <td>${idx + 1}</td>
          <td>${t.timestamp}</td>
          <td>${t.event}</td>
          <td><span class="badge" style="background: #e3f2fd; color: #1565c0;">${t.system}</span></td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Screenshots -->
  <h2>6. Screenshot Summary</h2>
  <div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
    <div class="summary-item">
      <div class="number">${data.screenshots.length}</div>
      <div class="label">Total Screenshots</div>
    </div>
    <div class="summary-item">
      <div class="number">${data.screenshots.filter(s => s.stepName.includes('IN')).length}</div>
      <div class="label">IN System</div>
    </div>
    <div class="summary-item">
      <div class="number">${data.screenshots.filter(s => s.stepName.includes('SWIFT')).length}</div>
      <div class="label">SWIFT System</div>
    </div>
  </div>

  <table>
    <thead>
      <tr><th>Sr. No.</th><th>File</th><th>Captured At</th><th>Step Name</th></tr>
    </thead>
    <tbody>
      ${data.screenshots.map(s => `
        <tr>
          <td>${s.srNo}</td>
          <td><code>${s.file}</code></td>
          <td>${s.capturedAt}</td>
          <td>${s.stepName}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Final Verdict -->
  <h2>7. Final Verdict</h2>
  <div class="verdict-box">
    <div class="verdict-status">${data.testCase.overallStatus === 'Pass' ? '✅' : '❌'}</div>
    <div class="verdict-text">${data.testCase.overallStatus === 'Pass' ? 'PASSED' : 'FAILED'}</div>
    <div style="margin-top: 15px; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 500px; margin-left: auto; margin-right: auto;">
      <div style="background: white; padding: 10px; border-radius: 4px;">
        <strong>SWIFT:</strong> <span class="badge ${data.testCase.swiftStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${data.testCase.swiftStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</span>
      </div>
      <div style="background: white; padding: 10px; border-radius: 4px;">
        <strong>IN:</strong> <span class="badge ${data.testCase.inStatus === 'Pass' ? 'badge-pass' : 'badge-fail'}">${data.testCase.inStatus === 'Pass' ? '✅ PASS' : '❌ FAIL'}</span>
      </div>
    </div>
  </div>

  <!-- Recommendations -->
  <h2>8. Recommendations</h2>
  
  <h3>🔴 High Priority - Immediate Action</h3>
  ${data.recommendations.filter(r => r.priority === 'High' || r.priority === 'Critical').map(r => `
    <div class="recommendation-high">
      <strong>${r.issue}</strong><br>
      <span style="color: #555;">${r.recommendation}</span><br>
      <span style="font-size: 11px; color: #888;">Owner: ${r.owner}</span>
    </div>
  `).join('') || '<p style="color: #888;">No high priority recommendations.</p>'}

  <h3>🟡 Medium Priority</h3>
  ${data.recommendations.filter(r => r.priority === 'Medium').map(r => `
    <div class="recommendation-medium">
      <strong>${r.issue}</strong><br>
      <span style="color: #555;">${r.recommendation}</span><br>
      <span style="font-size: 11px; color: #888;">Owner: ${r.owner}</span>
    </div>
  `).join('') || '<p style="color: #888;">No medium priority recommendations.</p>'}

  <h3>🟢 Low Priority</h3>
  ${data.recommendations.filter(r => r.priority === 'Low').map(r => `
    <div class="recommendation-low">
      <strong>${r.issue}</strong><br>
      <span style="color: #555;">${r.recommendation}</span><br>
      <span style="font-size: 11px; color: #888;">Owner: ${r.owner}</span>
    </div>
  `).join('') || '<p style="color: #888;">No low priority recommendations.</p>'}

  <!-- Footer -->
  <div class="footer">
    <p>Report generated by VI Sim Automation Platform</p>
    <p>&copy; 2026 QDegrees Services Pvt. Ltd.</p>
  </div>
</div>
</body>
</html>`;

    return html;
  }

  // ─── Generate Analysis PDF Report ────────────────────────────────────

  private generateAnalysisPDFReport(data: AnalysisReportData): string {
    return this.generateAnalysisHTMLReport(data);
  }

  // ─── Write Analysis Report ──────────────────────────────────────────

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

    // ── Sheet 1: Executive Summary ────────────────────────────────────────
    const summaryData = [{
      'Test Case': analysisData.testCase.name,
      'MSISDN': analysisData.testCase.msisdn,
      'Test Date': analysisData.testCase.testDate,
      'Overall Status': analysisData.testCase.overallStatus,
      'SWIFT Status': analysisData.testCase.swiftStatus,
      'IN Status': analysisData.testCase.inStatus,
      'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }];
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryData), 'Executive Summary');

    // ── Sheet 2: Expected vs Actual Comparison ────────────────────────────
    const comparisonData = analysisData.comparison.map((c, idx) => ({
      '#': idx + 1,
      'Parameter': c.parameter,
      'Expected': c.expected,
      'Actual': c.actual,
      'Status': c.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(comparisonData), 'Comparison');

    // ── Sheet 3: SWIFT Analysis ────────────────────────────────────────────
    const swiftResultsData = analysisData.swiftAnalysis.results.map((r, idx) => ({
      '#': idx + 1,
      'Field': r.field,
      'Expected': r.expected,
      'Actual': r.actual,
      'Status': r.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(swiftResultsData), 'SWIFT Results');

    // ── Sheet 4: SWIFT Voice Usage ────────────────────────────────────────
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

    // ── Sheet 5: SWIFT Failures ────────────────────────────────────────────
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

    // ── Sheet 6: IN Analysis ──────────────────────────────────────────────
    const inResultsData = analysisData.inAnalysis.results.map((r, idx) => ({
      '#': idx + 1,
      'Field': r.field,
      'Value': r.value,
      'Expected': r.expected,
      'Status': r.status
    }));
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inResultsData), 'IN Results');

    // ── Sheet 7: IN Dedicated Accounts ────────────────────────────────────
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

    // ── Sheet 8: IN Offers ─────────────────────────────────────────────────
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

    // ── Sheet 9: IN Failures ──────────────────────────────────────────────
    if (analysisData.inAnalysis.failures.length > 0) {
      const failureData = analysisData.inAnalysis.failures.map((f, idx) => ({
        '#': idx + 1,
        'Failure Type': f.type,
        'Expected': f.expected,
        'Actual': f.actual,
        'Severity': f.severity
      }));
      // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(failureData), 'IN Failures');
    }

    // ── Sheet 10: Root Cause Analysis ──────────────────────────────────────
    const rootCauseData = [{
      'Expected Plan': analysisData.rootCause.expectedPlan,
      'Actual Plan': analysisData.rootCause.actualPlan,
      'Issues': analysisData.rootCause.issues.join('; '),
      'Summary': analysisData.rootCause.summary
    }];
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rootCauseData), 'Root Cause');

    // ── Sheet 11: Timeline ──────────────────────────────────────────────────
    const timelineData = analysisData.timeline.map((t, idx) => ({
      '#': idx + 1,
      'Timestamp': t.timestamp,
      'Event': t.event,
      'System': t.system
    }));
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(timelineData), 'Timeline');

    // ── Sheet 12: Screenshots ──────────────────────────────────────────────
    const screenshotData = analysisData.screenshots.map((s) => ({
      'Sr. No.': s.srNo,
      'File': s.file,
      'Captured At': s.capturedAt,
      'Step Name': s.stepName
    }));
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(screenshotData), 'Screenshots');

    // ── Sheet 13: Recommendations ──────────────────────────────────────────
    const recommendationData = analysisData.recommendations.map((r, idx) => ({
      '#': idx + 1,
      'Priority': r.priority,
      'Issue': r.issue,
      'Recommendation': r.recommendation,
      'Owner': r.owner
    }));
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(recommendationData), 'Recommendations');

    // ── Sheet 14: Appendix - Input Data ──────────────────────────────────
    const inputDataArray = Object.entries(analysisData.appendix.inputData).map(([key, value]) => ({
      'Field': key,
      'Value': value
    }));
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inputDataArray), 'Appendix Input Data');

    // ── Sheet 15: Appendix - UAT Results ──────────────────────────────────
    const uatDataArray = Object.entries(analysisData.appendix.uatResults).map(([key, value]) => ({
      'Field': key,
      'Value': value
    }));
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(uatDataArray), 'Appendix UAT Results');

    // ── Write Excel file ──────────────────────────────────────────────────
    xlsx.writeFile(workbook, excelFilepath);
    console.log(`[ExcelReportService] Analysis Excel report: ${excelFilepath}`);

    // ── Generate HTML report ──────────────────────────────────────────────
    const htmlContent = this.generateAnalysisHTMLReport(analysisData);
    fs.writeFileSync(htmlFilepath, htmlContent, 'utf8');
    console.log(`[ExcelReportService] Analysis HTML report: ${htmlFilepath}`);

    // ── Generate PDF report ──────────────────────────────────────────────
    try {
      const pdfHTMLContent = this.generateAnalysisPDFReport(analysisData);
      await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
      console.log(`[ExcelReportService] Analysis PDF report: ${pdfFilepath}`);
    } catch (err: any) {
      console.error(`[ExcelReportService] PDF generation failed: ${err.message}`);
    }

    const zipPath = path.join(finalReportsDir, `${reportBaseName}.zip`);
    await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
  }

  // ─── HTML to PDF Conversion Helper ──────────────────────────────────────

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
    const { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath } = this.getSingleReportPaths(
      `individual:${msisdn}:${circle}:${rechargeMRP}`,
      reportBaseName,
      reportsDir
    );

    // Get results for this specific MSISDN
    const rowUatResults = this.uatResults.filter(r => r.msisdn === msisdn);
    const rowInResults = this.inResults.filter(r => r.msisdn === msisdn);
    const rowViAppResults = this.viAppResults.filter(r => r.msisdn === msisdn);
    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === msisdn);
    const rowPreTestResults = this.preTestResults.filter(r => r.msisdn === msisdn);
    const rowUpssPromoHistory = this.upssPromoHistory.filter(u => u.msisdn === msisdn);

    // ── Build all sheet-data arrays first ──

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

    const uatSheetData = rowUatResults.map((result) => ({
      'Sr. No.': result.srNo,
      'Transaction Id': result.transactionId || 'N/A',
      'Activation Date & Time': result.activationDateTime || new Date().toLocaleString(),
      'Validity': result.validity || 'N/A',
      'MRP': result.mrp || 'N/A',
      'Activation Mode': result.activationMode || 'N/A',
      'Current Core Balance': result.currentCoreBalance || '0.00',
      'eTOP UP Transaction Id': result.etopupTransactionId || 'N/A',
      'Retailer MSISDN': result.retailerMsisdn || 'N/A',
      'Name': result.name || 'N/A',
      'Category': result.category || 'Recharge',
      'Benefits': result.benefits || 'N/A',
      'Detail Validity': result.detailValidity || 'N/A',
      // 'IN Status': result.inStatus || 'Skip',
      // 'SWIFT Status': result.swiftStatus || 'Skip',
      // 'Vi App Status': result.viAppStatus || 'Skip',
      'Reason': result.reason || 'N/A'
    }));

    const inSheetData = rowInResults.map((result) => ({
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      // 'Status': result.status,
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
      // 'Screenshot Count': result.screenshotCount,
      'Remarks': result.remarks || 'N/A'
    }));

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

    const upssPromoSheetData = rowUpssPromoHistory.map((item, idx) => ({
      'Sr No.': idx + 1,
      'Applied Date': item.applied_date,
      'Start Date': item.start_date,
      'Promotion Name': item.promotion_name,
      'Description': item.description,
      'Mode of Activation': item.mode_of_activation,
      'Promotion Status': item.promotion_status
    }));

    // ── PreTest Combined Sheet ──────────────────────────────────────────────
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

    // ── PreTest Dedicated Accounts Sheet ──────────────────────────────
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

    // ── PreTest Offers Sheet ──────────────────────────────────────────────
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

    // ── PreTest Individual Sheets ──────────────────────────────────────

    const preTestSummarySheetData = rowPreTestResults.map((pt) => ({
      'MSISDN': pt.msisdn,
      'Circle': pt.circle,
      'Recharge MRP': pt.rechargeMRP,
      'PreTest Status': pt.status,
      'Reason': pt.reason,
      'Voice Entries': pt.voice.length,
      'Data Entries': pt.data.length,
      'SMS Entries': pt.sms.length,
      'Screenshot Count': pt.screenshotCount
    }));

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

    const viAppSheetData = rowViAppResults.map((result) => ({
  'Status': result.status,
  'MRP Matched': result.mrpMatched ? 'Yes' : 'No',
  'Benefit Matched': result.benefitMatched ? 'Yes' : 'No',
  'SMS Date Today': result.smsDateIsToday ? 'Yes' : 'No',
  'SMS Matched': result.smsMatched ? 'Yes' : 'No',
  'Last Recharge Label': result.lastRechargeLabel || 'N/A',
  'Last Recharge Amount': result.lastRechargeAmount || 'N/A',
  'MRP Actual Numeric': result.mrpActualNumeric || 'N/A',
  'Pack Ends On Date': result.packEndsOnDate || 'N/A',
  'Main Balance': result.mainBalance || 'N/A',
  'Service Validity': result.serviceValidity || 'N/A',
  'Repeat Recharge Title': result.repeatRechargeTitle || 'N/A',
  'Actual Benefit': result.actualBenefit || 'N/A',
  'Matched Plan MRP': result.matchedPlanMRP || 'N/A',
  'Expected Benefit': result.expectedBenefit || 'N/A',
  'Expected Notification': result.expectedNotification || 'N/A',
  'Screenshot Count': result.screenshotCount,
  'Remarks': result.remarks || 'N/A'
}));

// Also add a summary row at the top
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
}] : [];

if (viAppSummaryData.length > 0) {
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSummaryData), 'VI App Summary');
}

    const screenshotSheetData = rowScreenshots.map((screenshot) => ({
      'Sr. No.': screenshot.srNo,
      'File': screenshot.screenshotFile,
      'Captured At': screenshot.capturedAt,
      'Step Name': screenshot.stepName || 'General'
    }));

    const summaryData = [{
      'MSISDN': msisdn,
      'Circle': circle,
      'Recharge MRP': rechargeMRP,
      'UAT Results': rowUatResults.length,
      'IN Results': rowInResults.length,
      'VI App Results': rowViAppResults.length,
      'Screenshots': rowScreenshots.length,
      'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }];

    const workbook = xlsx.utils.book_new();

    // ── SWIFT USAGE SHEETS (FILTERED for this MSISDN) ──────────────────────

    // ── ADD REMAINING SHEETS ──────────────────────────────────────────────────

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inputSheetData), 'Input Data');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(uatSheetData), 'UAT Results');
     // ── Voice Usage Sheet ──
    const rowVoiceUsage = rowUatResults.flatMap(r => r.voiceUsage || []);
    if (rowVoiceUsage.length > 0) {
      const voiceSheetData = rowVoiceUsage.map((v: any) => ({
        'MSISDN': msisdn,
        'Offer Name': v.offer_name || 'N/A',
        'Balance Left': v.balance_left || 'N/A',
        'Category': v.category || 'N/A',
        'Expiry Date': v.expiry_date || 'N/A'
      }));
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(voiceSheetData), 'SWIFT Voice Usage');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'MSISDN': msisdn, 'Note': 'No voice usage data available' }]), 'SWIFT Voice Usage');
    }

    // ── Data Usage Sheet ──
    const rowDataUsage = rowUatResults.flatMap(r => r.dataUsage || []);
    if (rowDataUsage.length > 0) {
      const dataSheetData = rowDataUsage.map((d: any) => ({
        'MSISDN': msisdn,
        'Offer Name': d.offer_name || 'N/A',
        'Total Quota': d.total_quota || 'N/A',
        'Balance Left': d.balance_left || 'N/A',
        'Category': d.category || 'N/A',
        'Expiry Date': d.expiry_date || 'N/A'
      }));
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(dataSheetData), 'SWIFT Data Usage');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'MSISDN': msisdn, 'Note': 'No data usage data available' }]), 'SWIFT Data Usage');
    }

    // ── SMS Usage Sheet ──
    const rowSmsUsage = rowUatResults.flatMap(r => r.smsUsage || []);
    if (rowSmsUsage.length > 0) {
      const smsSheetData = rowSmsUsage.map((s: any) => ({
        'MSISDN': msisdn,
        'Offer Name': s.offer_name || 'N/A',
        'Balance Left': s.balance_left || 'N/A',
        'Category': s.category || 'N/A',
        'Expiry Date': s.expiry_date || 'N/A'
      }));
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(smsSheetData), 'SWIFT SMS Usage');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'MSISDN': msisdn, 'Note': 'No SMS usage data available' }]), 'SWIFT SMS Usage');
    }

    // ── Unlimited Offers Sheet ──
    const rowUnlimitedOffers = rowUatResults.flatMap(r => r.unlimitedOffers || []);
    if (rowUnlimitedOffers.length > 0) {
      const unlimitedSheetData = rowUnlimitedOffers.map((u: any) => ({
        'MSISDN': msisdn,
        'Offer Name': u.offer_name || 'N/A',
        'Category': u.category || 'N/A',
        'Expiry Date': u.expiry_date || 'N/A'
      }));
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(unlimitedSheetData), 'SWIFT Unlimited Offers');
    }

    // ── VAS Offers Sheet ──
    const rowVasOffers = rowUatResults.flatMap(r => r.vasOffers || []);
    if (rowVasOffers.length > 0) {
      const vasSheetData = rowVasOffers.map((v: any) => ({
        'MSISDN': msisdn,
        'Offer Name': v.offer_name || 'N/A',
        'Category': v.category || 'N/A',
        'Expiry Date': v.expiry_date || 'N/A'
      }));
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(vasSheetData), 'SWIFT VAS Offers');
    }

    if (upssPromoSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(upssPromoSheetData), 'UPSS Promotional History');
    }

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inSheetData), 'IN Results');
    
    
    if (daSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daSheetData), 'IN Dedicated Accounts');
    }
    
    
    
    if (offersSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersSheetData), 'IN Offers');
    }
    
    if (preTestSummarySheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSummarySheetData), 'PreTest Summary');
    }
    
    if (preTestVoiceSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestVoiceSheetData), 'PreTest Voice Usage');
    }
    
    if (preTestDataSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestDataSheetData), 'PreTest Data Usage');
    }
    
    if (preTestSMSSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSMSSheetData), 'PreTest SMS Usage');
    }

    // PreTest Dedicated Accounts sheet
    if (preTestDASheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestDASheetData), 'PreTest Dedicated Accounts');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'MSISDN': msisdn, 'Note': 'No dedicated account entries' }]), 'PreTest Dedicated Accounts');
    }

    // PreTest Offers sheet
    if (preTestOffersSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestOffersSheetData), 'PreTest Offers');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'MSISDN': msisdn, 'Note': 'No offer tab entries' }]), 'PreTest Offers');
    }
    
    // PreTest Combined sheet
    if (preTestCombinedSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestCombinedSheetData), 'PreTest Combined');
    }
    
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(screenshotSheetData), 'Screenshots');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryData), 'Summary');

    xlsx.writeFile(workbook, excelFilepath);
    console.log(`[ExcelReportService] Individual Excel report: ${excelFilepath}`);

    // ── Generate Interactive HTML report ─────────────────────────────────
    const htmlContent = this.generateIndividualHTMLReport(row);
    fs.writeFileSync(htmlFilepath, htmlContent, 'utf8');
    console.log(`[ExcelReportService] Individual HTML report: ${htmlFilepath}`);

    // ── Generate PDF report ──────────────────────────────────────────────
    try {
      const pdfHTMLContent = this.generateIndividualPDFHTMLReport(row);
      await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
      console.log(`[ExcelReportService] Individual PDF report: ${pdfFilepath}`);
    } catch (err: any) {
      console.error(`[ExcelReportService] PDF generation failed: ${err.message}`);
    }

    const zipPath = path.join(finalReportsDir, `${path.basename(excelFilepath, '.xlsx')}.zip`);
    await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

    try {
      (global as any).setSwiftLatestReport?.(zipPath);
    } catch (_) {}

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
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

    const { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath } = this.getSingleReportPaths(
      'consolidated',
      'SIM_Recharge_Report_Consolidated',
      reportsDir
    );

    // ── Build Excel sheets ───────────────────────────────────────────────
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

    const uatSheetData = this.uatResults.map((result) => ({
      'Sr. No.': result.srNo,
      'Transaction Id': result.transactionId || 'N/A',
      'Activation Date & Time': result.activationDateTime || new Date().toLocaleString(),
      'Validity': result.validity || 'N/A',
      'MRP': result.mrp || 'N/A',
      'Activation Mode': result.activationMode || 'N/A',
      'Current Core Balance': result.currentCoreBalance || '0.00',
      'eTOP UP Transaction Id': result.etopupTransactionId || 'N/A',
      'Retailer MSISDN': result.retailerMsisdn || 'N/A',
      'Name': result.name || 'N/A',
      'Category': result.category || 'Recharge',
      'Benefits': result.benefits || 'N/A',
      'Detail Validity': result.detailValidity || 'N/A',
      'MSISDN': result.msisdn,
      'Circle': result.circle || 'N/A',
      'Plan Name': result.planName || 'N/A',
      'Recharge Notification': result.rechargeNotification || 'N/A',
      // 'IN Status': result.inStatus || 'Skip',
      'SWIFT Status': result.swiftStatus || 'Skip',
      // 'Vi App Status': result.viAppStatus || 'Skip',
      'Reason': result.reason || 'N/A'
    }));

    const upssPromoSheetData = this.upssPromoHistory.map((item, idx) => ({
      'Sr No.': idx + 1,
      'MSISDN': item.msisdn,
      'Applied Date': item.applied_date,
      'Start Date': item.start_date,
      'Promotion Name': item.promotion_name,
      'Description': item.description,
      'Mode of Activation': item.mode_of_activation,
      'Promotion Status': item.promotion_status
    }));

    const inSheetData = this.inResults.map((result, idx) => ({
      '#': idx + 1,
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      // 'Status': result.status,
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
      'Screenshot Count': result.screenshotCount,
      'Remarks': result.remarks || 'N/A'
    }));

    const daSheetData: any[] = [];
    this.inResults.forEach((result) => {
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

    const offersSheetData: any[] = [];
    this.inResults.forEach((result) => {
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

    // ── PreTest Dedicated Accounts for consolidated ──────────────────────
    const preTestDASheetDataAll: any[] = [];
    this.preTestResults.forEach((pt) => {
      if (pt.dedicatedAccounts && pt.dedicatedAccounts.length > 0) {
        pt.dedicatedAccounts.forEach((da: any) => {
          preTestDASheetDataAll.push({
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

    // ── PreTest Offers for consolidated ──────────────────────────────────
    const preTestOffersSheetDataAll: any[] = [];
    this.preTestResults.forEach((pt) => {
      if (pt.offers && pt.offers.length > 0) {
        pt.offers.forEach((offer: any) => {
          preTestOffersSheetDataAll.push({
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

    // ── PreTest Combined sheet for consolidated report ──────────────────
    const preTestCombinedSheetDataAll: any[] = [];

    this.preTestResults.forEach((pt) => {
      preTestCombinedSheetDataAll.push({
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
          preTestCombinedSheetDataAll.push({
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
          preTestCombinedSheetDataAll.push({
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
          preTestCombinedSheetDataAll.push({
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
        preTestCombinedSheetDataAll.push({
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

    // ── PreTest individual sheets for consolidated ──────────────────────
    const preTestSummarySheetDataAll = this.preTestResults.map((pt, idx) => ({
      '#': idx + 1,
      'MSISDN': pt.msisdn,
      'Circle': pt.circle,
      'Recharge MRP': pt.rechargeMRP,
      'PreTest Status': pt.status,
      'Reason': pt.reason,
      'Voice Entries': pt.voice.length,
      'Data Entries': pt.data.length,
      'SMS Entries': pt.sms.length,
      'Screenshot Count': pt.screenshotCount
    }));

    const preTestVoiceSheetDataAll: any[] = [];
    this.preTestResults.forEach((pt) => {
      pt.voice.forEach((v: any) => {
        preTestVoiceSheetDataAll.push({
          'MSISDN': pt.msisdn, 'Offer Name': v.offer_name || 'N/A', 'Balance Left': v.balance_left || 'N/A',
          'Category': v.category || 'N/A', 'Expiry Date': v.expiry_date || 'N/A'
        });
      });
    });

    const preTestDataSheetDataAll: any[] = [];
    this.preTestResults.forEach((pt) => {
      pt.data.forEach((d: any) => {
        preTestDataSheetDataAll.push({
          'MSISDN': pt.msisdn, 'Offer Name': d.offer_name || 'N/A', 'Total Quota': d.total_quota || 'N/A',
          'Balance Left': d.balance_left || 'N/A', 'Category': d.category || 'N/A', 'Expiry Date': d.expiry_date || 'N/A'
        });
      });
    });

    const preTestSMSSheetDataAll: any[] = [];
    this.preTestResults.forEach((pt) => {
      pt.sms.forEach((s: any) => {
        preTestSMSSheetDataAll.push({
          'MSISDN': pt.msisdn, 'Offer Name': s.offer_name || 'N/A', 'Balance Left': s.balance_left || 'N/A',
          'Category': s.category || 'N/A', 'Expiry Date': s.expiry_date || 'N/A'
        });
      });
    });

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
    'Last Recharge Amount': result.lastRechargeAmount || 'N/A',
    'MRP Matched': result.mrpMatched ? 'Yes' : 'No',
    'Benefit Matched': result.benefitMatched ? 'Yes' : 'No',
    'SMS Date Today': result.smsDateIsToday ? 'Yes' : 'No',
    'SMS Matched': result.smsMatched ? 'Yes' : 'No',
    'Screenshot Count': result.screenshotCount,
    'Remarks': result.remarks || 'N/A'
}));

    const screenshotSheetData = this.screenshotIndex.map((screenshot) => ({
      'Sr. No.': screenshot.srNo,
      'MSISDN': screenshot.msisdn,
      'File': screenshot.screenshotFile,
      'URL': `/screenshots/${screenshot.screenshotFile}`,
      'Captured At': screenshot.capturedAt,
      'Step Name': screenshot.stepName || 'General'
    }));

    const summaryData = [{
      'Total Excel Rows': this.inputRows.length,
      'UAT Results': this.uatResults.length,
      'IN Results': this.inResults.length,
      'VI App Results': this.viAppResults.length,
      'Total Screenshots': this.screenshotIndex.length,
      'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }];

    const workbook = xlsx.utils.book_new();

    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inputSheetData), 'Input Data');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(uatSheetData), 'UAT Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inSheetData), 'IN Results');
    
    if (preTestDASheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestDASheetDataAll), 'PreTest Dedicated Accounts');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'Note': 'No dedicated account entries' }]), 'PreTest Dedicated Accounts');
    }

    if (preTestOffersSheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestOffersSheetDataAll), 'PreTest Offers');
    } else {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'Note': 'No offer tab entries' }]), 'PreTest Offers');
    }
    
    if (preTestCombinedSheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestCombinedSheetDataAll), 'PreTest Combined');
    }
    
    if (daSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daSheetData), 'IN Dedicated Accounts');
    }
    if (upssPromoSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(upssPromoSheetData), 'UPSS Promotional History');
    }
    if (offersSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersSheetData), 'IN Offers');
    }
    if (preTestSummarySheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSummarySheetDataAll), 'PreTest Summary');
    }
    if (preTestVoiceSheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestVoiceSheetDataAll), 'PreTest Voice Usage');
    }
    if (preTestDataSheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestDataSheetDataAll), 'PreTest Data Usage');
    }
    if (preTestSMSSheetDataAll.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(preTestSMSSheetDataAll), 'PreTest SMS Usage');
    }

    // ── Add VI App Results sheet ──────────────────────────────────────────────
if (viAppSheetData.length > 0) {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');
} else {
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet([{ 'Note': 'No VI App results available' }]), 'VI App Results');
}
    // xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(screenshotSheetData), 'Screenshots');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(summaryData), 'Summary');

    xlsx.writeFile(workbook, excelFilepath);
    console.log(`[ExcelReportService] Consolidated Excel report: ${excelFilepath}`);

    // ── Generate consolidated interactive HTML ───────────────────────────
    let html = this.getHTMLHead('UAT Recharge Report - Consolidated', false) + `
  <body>
  <div class="container">
    <h1>UAT Recharge Report &mdash; Consolidated Summary</h1>
    <p style="color: #888; margin-bottom: 20px;">Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>

    <div class="summary-grid">
      <div class="summary-item"><div class="number">${this.inputRows.length}</div><div class="label">Total Test Cases</div></div>
      <div class="summary-item"><div class="number">${this.uatResults.length}</div><div class="label">UAT Results</div></div>
      <div class="summary-item"><div class="number">${this.inResults.length}</div><div class="label">IN Results</div></div>
      <div class="summary-item"><div class="number">${this.viAppResults.length}</div><div class="label">VI App Results</div></div>
      <div class="summary-item"><div class="number">${this.screenshotIndex.length}</div><div class="label">Screenshots</div></div>
    </div>

    <div class="download-links">
      <h2>Individual Reports</h2>
      <p>Individual reports for each MSISDN have been generated:</p>
      <ul style="margin: 10px 0 20px 20px; line-height: 1.8;">
  `;
    this.inputRows.forEach(row => {
      html += `<li><strong>${row.msisdn}</strong> &mdash; SIM_Recharge_Report_${row.msisdn}_${row.circle}_MRP${row.rechargeMRP}_*.xlsx / .html / .pdf</li>`;
    });
    html += `
      </ul>
    </div>

    <h2>Input Test Data</h2>
    <table>
      <thead>
        <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>Recharge MRP</th><th>Recharge</th><th>SWIFT</th><th>IN</th><th>Vi App</th></tr>
      </thead>
      <tbody>
  `;

    this.inputRows.forEach((row, idx) => {
      html += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${row.msisdn}</strong></td>
            <td>${row.circle}</td>
            <td>&#8377;${row.rechargeMRP}</td>
            <td>${row.recharge === 'yes' ? '&#10003;' : '&#10007;'}</td>
            <td>${row.swift === 'yes' ? '&#10003;' : '&#10007;'}</td>
            <td>${row.inFlag === 'yes' ? '&#10003;' : '&#10007;'}</td>
            <td>${row.viApp === 'yes' ? '&#10003;' : '&#10007;'}</td>
          </tr>`;
    });

    html += `
      </tbody>
    </table>

    <h2>UAT Execution Results (SWIFT)</h2>
    <table>
      <thead>
        <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>IN Status</th><th>SWIFT Status</th><th>Vi App</th></tr>
      </thead>
      <tbody>
  `;

    this.uatResults.forEach((result) => {
      const inBadge = result.inStatus === 'Pass' ? 'badge-pass' : (result.inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      html += `
          <tr>
            <td>${result.srNo}</td>
            <td><strong>${result.msisdn}</strong></td>
            <td>${result.circle}</td>
            <td>&#8377;${result.mrp}</td>
            <td><span class="badge ${inBadge}">${result.inStatus || 'Skip'}</span></td>
            <td><span class="badge ${swiftBadge}">${result.swiftStatus || 'Skip'}</span></td>
            <td>${result.viAppStatus || 'Skip'}</td>
          </tr>`;
    });

    html += `
      </tbody>
    </table>

    <h2>IN Results Summary</h2>
    <table>
      <thead>
        <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>Status</th><th>Customer Name</th><th>Core Balance</th><th>Dedicated Accounts</th><th>Offers</th></tr>
      </thead>
      <tbody>
  `;

    this.inResults.forEach((result, idx) => {
      const statusBadge = result.status === 'Pass' ? 'badge-pass' : 'badge-fail';
      html += `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${result.msisdn}</strong></td>
            <td>${result.circle}</td>
            <td>&#8377;${result.rechargeMRP}</td>
            <td><span class="badge ${statusBadge}">${result.status}</span></td>
            <td>${result.customerName || 'N/A'}</td>
            <td>${result.coreBalance || 'N/A'}</td>
            <td>${(result.dedicatedAccounts || []).length}</td>
            <td>${(result.offers || []).length}</td>
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

    fs.writeFileSync(htmlFilepath, html, 'utf8');
    console.log(`[ExcelReportService] Consolidated HTML report: ${htmlFilepath}`);

    // ── Generate consolidated PDF ────────────────────────────────────────
    try {
      const pdfHTMLContent = this.generateConsolidatedPDFHTMLReport();
      await this.convertHTMLToPDF(pdfHTMLContent, pdfFilepath);
      console.log(`[ExcelReportService] Consolidated PDF report: ${pdfFilepath}`);
    } catch (err: any) {
      console.error(`[ExcelReportService] Consolidated PDF generation failed: ${err.message}`);
    }

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath };
  }

  // ─── Helper Methods ──────────────────────────────────────────────────────

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

  // ─── Legacy writeReport (backward compatible) ──────────────────────────

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

  // ─── PDF Report Generation (returns actual PDF path now) ────────────────

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