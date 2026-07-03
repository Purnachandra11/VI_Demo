// src/services/ExcelReportService.ts
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

  // ── UAT Results ──────────────────────────────────────────────────────────

  addUATResult(result: Omit<UATResult, 'srNo'>): void {
    const srNo = this.uatResults.length + 1;
    this.uatResults.push({ ...result, srNo });
    console.log(`[ExcelReportService] Added UAT result #${srNo} for MSISDN: ${result.msisdn}`);
  }

  // ── IN Results ──────────────────────────────────────────────────────────

  addINResult(result: INResult): void {
    this.inResults.push(result);
    console.log(`[ExcelReportService] Added IN result for MSISDN: ${result.msisdn} - Status: ${result.status}`);
  }

  getINResultCount(): number {
    return this.inResults.length;
  }

  // ── UPSS Promotional History ─────────────────────────────────────────────

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

  // ── VI App Results ───────────────────────────────────────────────────────

  addViAppResult(result: ViAppResult): void {
    this.viAppResults.push(result);
    console.log(`[ExcelReportService] Added VI App result for MSISDN: ${result.msisdn} - Status: ${result.status}`);
  }

  getViAppResultCount(): number {
    return this.viAppResults.length;
  }

  // ── Screenshots ──────────────────────────────────────────────────────────

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

  // ── Input Rows ───────────────────────────────────────────────────────────

  addInputRows(rows: InputRow[]): void {
    this.inputRows = rows;
    console.log(`[ExcelReportService] Added ${rows.length} input rows`);
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  getResultCount(): number {
    return this.uatResults.length;
  }

  getScreenshotCount(): number {
    return this.screenshotIndex.length;
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
    .badge-skip { background: #f5f5f5; color: #888; }
    .badge-error { background: #fff3e0; color: #e65100; }
    .badge-mismatch { background: #fff8e1; color: #f57f17; }
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

  // ─── Cover Page Helper ───────────────────────────────────────────────────

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

  // ─── Generate Interactive HTML Report for a Single Row ───────────────────

  generateIndividualHTMLReport(row: InputRow, uatResult?: UATResult, inResult?: INResult, viAppResult?: ViAppResult): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    // Get screenshots for this MSISDN
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

  <!-- Tabs for SWIFT and IN Results -->
  <div class="tab-container">
    <button class="tab-btn active" onclick="switchTab('swift')">SWIFT Results</button>
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
        const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : 
                     (result.swiftStatus === 'Mismatch' ? 'badge-mismatch' : 
                     (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip'));
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

      // Offer History Details
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

  <!-- Tab 2: IN Results -->
  <div id="tab-in" class="tab-content">
    <h2>IN Test Results</h2>
`;

    if (inResultsForRow.length === 0) {
      html += `<p style="color: #888;">No IN test results found for this MSISDN.</p>`;
    } else {
      inResultsForRow.forEach((inResult) => {
        const statusBadge = inResult.status === 'Pass' ? 'badge-pass' : 
                           (inResult.status === 'Fail' ? 'badge-fail' : 'badge-error');
        
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

        // Dedicated Accounts
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

        // Offers
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

  <!-- Tab 3: Screenshots -->
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

  // ─── Generate PDF HTML Report for a Single Row (Print-Optimized) ────────

  generateIndividualPDFHTMLReport(row: InputRow): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    const rowScreenshots = this.screenshotIndex.filter(s => s.msisdn === row.msisdn);
    const uatResultsForRow = this.uatResults.filter(r => r.msisdn === row.msisdn);
    const inResultsForRow = this.inResults.filter(r => r.msisdn === row.msisdn);
    const viAppResultsForRow = this.viAppResults.filter(r => r.msisdn === row.msisdn);
    
    let html = this.getHTMLHead(`UAT Recharge Report PDF - ${row.msisdn}`, true);

    // Cover page
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
        const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : 
                     (result.swiftStatus === 'Mismatch' ? 'badge-mismatch' : 
                     (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip'));
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

      // Offer History
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

    // VI App Results
    html += `
  </div>

  <div class="section page-break">
    <h2>VI App Results</h2>
`;
    if (viAppResultsForRow.length === 0) {
      html += `<p style="color: #888;">No VI App results found for this MSISDN.</p>`;
    } else {
      viAppResultsForRow.forEach((result) => {
        const statusBadge = result.status === 'Pass' ? 'badge-pass' : 
                           (result.status === 'Fail' ? 'badge-fail' : 
                           (result.status === 'Mismatch' ? 'badge-mismatch' : 'badge-error'));
        html += `
    <div class="info-box">
      <strong>Status:</strong> <span class="badge ${statusBadge}">${result.status}</span>
      <strong style="margin-left: 20px;">MRP Matched:</strong> ${result.mrpMatched ? '&#10003; Yes' : '&#10007; No'}
      <strong style="margin-left: 20px;">Benefit Matched:</strong> ${result.benefitMatched ? '&#10003; Yes' : '&#10007; No'}
    </div>
    <div class="in-details-grid">
      <div class="in-detail-item"><strong>Last Recharge Amount</strong><span>${result.lastRechargeAmount || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Actual Benefit</strong><span>${result.actualBenefit || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Matched Plan MRP</strong><span>${result.matchedPlanMRP || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Expected Benefit</strong><span>${result.expectedBenefit || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Pack Ends On</strong><span>${result.packEndsOnDate || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Main Balance</strong><span>${result.mainBalance || 'N/A'}</span></div>
      <div class="in-detail-item"><strong>Service Validity</strong><span>${result.serviceValidity || 'N/A'}</span></div>
    </div>`;
        if (result.remarks) {
          html += `<p style="margin-top: 10px; font-size: 11px; color: #666;"><strong>Remarks:</strong> ${result.remarks}</p>`;
        }
      });
    }

    // IN Results
    html += `
  </div>

  <!-- Page 3+: IN Results -->
  <div class="section page-break">
    <h2>IN Test Results</h2>
`;

    if (inResultsForRow.length === 0) {
      html += `<p style="color: #888;">No IN test results found for this MSISDN.</p>`;
    } else {
      inResultsForRow.forEach((inResult) => {
        const statusBadge = inResult.status === 'Pass' ? 'badge-pass' : 
                           (inResult.status === 'Fail' ? 'badge-fail' : 'badge-error');
        
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

  // ─── Generate Consolidated PDF HTML Report ──────────────────────────────

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
      const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : 
                   (result.swiftStatus === 'Mismatch' ? 'badge-mismatch' : 
                   (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip'));
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
      const statusBadge = result.status === 'Pass' ? 'badge-pass' : 
                         (result.status === 'Fail' ? 'badge-fail' : 'badge-error');
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
  <div class="section page-break">
    <h2>UAT Execution Results (SWIFT)</h2>
    <table>
      <thead>
        <tr><th>#</th><th>MSISDN</th><th>Circle</th><th>MRP</th><th>IN Status</th><th>SWIFT Status</th><th>Vi App</th><th>Reason</th></tr>
      </thead>
      <tbody>
`;

    this.uatResults.forEach((result) => {
      const inBadge = result.inStatus === 'Pass' ? 'badge-pass' : (result.inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      const swiftBadge = result.swiftStatus === 'Pass' ? 'badge-pass' : 
                   (result.swiftStatus === 'Mismatch' ? 'badge-mismatch' : 
                   (result.swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip'));
      html += `
        <tr>
          <td>${result.srNo}</td>
          <td><strong>${result.msisdn}</strong></td>
          <td>${result.circle}</td>
          <td>&#8377;${result.mrp}</td>
          <td><span class="badge ${inBadge}">${result.inStatus || 'Skip'}</span></td>
          <td><span class="badge ${swiftBadge}">${result.swiftStatus || 'Skip'}</span></td>
          <td>${result.viAppStatus || 'Skip'}</td>
          <td><small>${result.reason || 'N/A'}</small></td>
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

    // Avoid deleting prior report files when they may still be open/locked by Excel or another process.
    // Each run writes a fresh timestamped file, so cleanup is not required for correctness.

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
      console.warn(`[ExcelReportService] Could not remove previous report file ${filePath}: ${message}`);
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
    console.log(`[ExcelReportService] ZIP bundle created: ${zipPath}`);
  }

  // ─── Generate Individual Excel + HTML + PDF Report for a Single Row ─────

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

    // ── Generate Excel file ──────────────────────────────────────────────
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
      'IN Status': result.inStatus || 'Skip',
      'SWIFT Status': result.swiftStatus || 'Skip',
      'Vi App Status': result.viAppStatus || 'Skip',
      // 'Screenshots': (result.screenshots || []).join(', ')
      'Reason': result.reason || 'N/A'
    }));

    const inSheetData = rowInResults.map((result) => ({
      'MSISDN': result.msisdn,
      'Circle': result.circle,
      'Recharge MRP': result.rechargeMRP,
      'Status': result.status,
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

    const rowUpssPromoHistory = this.upssPromoHistory.filter(u => u.msisdn === msisdn);

      const upssPromoSheetData = rowUpssPromoHistory.map((item, idx) => ({
        'Sr No.': idx + 1,
        'Applied Date': item.applied_date,
        'Start Date': item.start_date,
        'Promotion Name': item.promotion_name,
        'Description': item.description,
        'Mode of Activation': item.mode_of_activation,
        'Promotion Status': item.promotion_status
      }));

    const viAppSheetData = rowViAppResults.map((result) => ({
      'Status': result.status,
      'MRP Matched': result.mrpMatched ? 'Yes' : 'No',
      'Benefit Matched': result.benefitMatched ? 'Yes' : 'No',
      'Last Recharge Amount': result.lastRechargeAmount || 'N/A',
      'Actual Benefit': result.actualBenefit || 'N/A',
      'Matched Plan MRP': result.matchedPlanMRP || 'N/A',
      'Expected Benefit': result.expectedBenefit || 'N/A',
      'Screenshot Count': result.screenshotCount,
      'Remarks': result.remarks || 'N/A'
    }));
    

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
    
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inputSheetData), 'Input Data');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(uatSheetData), 'UAT Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(inSheetData), 'IN Results');
    if (daSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daSheetData), 'IN Dedicated Accounts');
    }
    if (upssPromoSheetData.length > 0) {
  xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(upssPromoSheetData), 'UPSS Promotional History');
}
    if (offersSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersSheetData), 'IN Offers');
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(screenshotSheetData), 'Screenshots');
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
      // If PDF generation fails, still return the path but log the error
      // The caller can decide to retry
    }

    const zipPath = path.join(finalReportsDir, `${path.basename(excelFilepath, '.xlsx')}.zip`);
    await this.createZipBundle([excelFilepath, htmlFilepath, pdfFilepath], zipPath);

    try {
      (global as any).setSwiftLatestReport?.(zipPath);
    } catch (_) {}

    return { excelPath: excelFilepath, htmlPath: htmlFilepath, pdfPath: pdfFilepath, zipPath };
  }

  // ─── Generate All Individual Reports ─────────────────────────────────────

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

  // ─── Generate Consolidated Report (Excel + HTML + PDF) ──────────────────

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
      'IN Status': result.inStatus || 'Skip',
      'SWIFT Status': result.swiftStatus || 'Skip',
      'Vi App Status': result.viAppStatus || 'Skip',
      // 'Screenshots': (result.screenshots || []).join(', ')
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
      'Status': result.status,
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
      'MRP Matched': result.mrpMatched ? '&#10003; Yes' : '&#10007; No',
      'Benefit Matched': result.benefitMatched ? '&#10003; Yes' : '&#10007; No',
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
    if (daSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(daSheetData), 'IN Dedicated Accounts');
    }
    if (upssPromoSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(upssPromoSheetData), 'UPSS Promotional History');
    }
    if (offersSheetData.length > 0) {
      xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(offersSheetData), 'IN Offers');
    }
    xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(viAppSheetData), 'VI App Results');
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
      const statusBadge = result.status === 'Pass' ? 'badge-pass' : 
                         (result.status === 'Fail' ? 'badge-fail' : 'badge-error');
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

  // ─── HTML to PDF Conversion Helper ───────────────────────────────────────

  private async convertHTMLToPDF(htmlContent: string, outputPath: string): Promise<void> {
    // Write HTML to temporary file
    const tempHtmlPath = outputPath.replace('.pdf', '_temp.html');
    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

    try {
      // Try playwright first (more modern, Chromium-based)
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
      // Clean up temp HTML file
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
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

    // Fallback: generate empty PDF
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
      // If PDF generation fails, create empty file as placeholder
      fs.writeFileSync(pdfPath, '', 'utf8');
    }
    return pdfPath;
  }
}