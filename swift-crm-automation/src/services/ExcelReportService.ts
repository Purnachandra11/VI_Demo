// src/services/ExcelReportService.ts
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

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
  screenshots: string[];
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

export class ExcelReportService {
  private uatResults: UATResult[] = [];
  private screenshotIndex: ScreenshotIndex[] = [];
  private inputRows: InputRow[] = [];
  private rowScreenshots: Map<string, string[]> = new Map();

  addUATResult(result: Omit<UATResult, 'srNo'>): void {
    const srNo = this.uatResults.length + 1;
    this.uatResults.push({ ...result, srNo });
    console.log(`[ExcelReportService] Added UAT result #${srNo} for MSISDN: ${result.msisdn}`);
  }

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
      // Track screenshots per MSISDN
      if (!this.rowScreenshots.has(screenshot.msisdn)) {
        this.rowScreenshots.set(screenshot.msisdn, []);
      }
      this.rowScreenshots.get(screenshot.msisdn)!.push(screenshot.screenshotFile);
    });
    console.log(`[ExcelReportService] Added ${screenshots.length} screenshots`);
  }

  addInputRows(rows: InputRow[]): void {
    this.inputRows = rows;
    console.log(`[ExcelReportService] Added ${rows.length} input rows`);
  }

  // Generate HTML for PDF report
  generateHTMLReport(): string {
    const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    
    let html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>UAT Recharge Report</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #f38328; border-bottom: 3px solid #f38328; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { color: #333; margin: 20px 0 10px 0; padding: 8px 0; border-bottom: 2px solid #eee; }
    h3 { color: #555; margin: 15px 0 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0 20px 0; font-size: 13px; }
    th { background: #f38328; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
    td { padding: 8px 12px; border-bottom: 1px solid #eee; }
    tr:nth-child(even) { background: #f9f9f9; }
    tr:hover { background: #fff5ef; }
    .status-pass { color: #2e7d32; font-weight: 600; }
    .status-fail { color: #c0392b; font-weight: 600; }
    .status-skip { color: #888; font-weight: 600; }
    .badge { display: inline-block; padding: 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; }
    .badge-pass { background: #e8f5e9; color: #2e7d32; }
    .badge-fail { background: #fdecea; color: #c0392b; }
    .badge-skip { background: #f5f5f5; color: #888; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 15px 0 25px 0; }
    .summary-item { background: #f8f5f0; padding: 15px; border-radius: 8px; text-align: center; border-left: 4px solid #f38328; }
    .summary-item .number { font-size: 28px; font-weight: 700; color: #f38328; }
    .summary-item .label { font-size: 12px; color: #888; margin-top: 4px; }
    .screenshot-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin: 10px 0; }
    .screenshot-item { border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
    .screenshot-item img { width: 100%; height: 100px; object-fit: cover; }
    .screenshot-item .caption { padding: 5px 8px; font-size: 11px; text-align: center; background: #f5f5f5; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #888; }
    .step-detail { background: #faf8f5; padding: 10px 15px; border-radius: 6px; margin: 5px 0; border-left: 3px solid #f38328; }
    .step-detail strong { color: #f38328; }
  </style>
</head>
<body>
<div class="container">
  <h1>📊 UAT Recharge Automation Report</h1>
  <p style="color: #888; margin-bottom: 20px;">Generated: ${timestamp}</p>

  <!-- Summary -->
  <div class="summary-grid">
    <div class="summary-item">
      <div class="number">${this.inputRows.length}</div>
      <div class="label">Total Test Cases</div>
    </div>
    <div class="summary-item">
      <div class="number">${this.uatResults.length}</div>
      <div class="label">Executed</div>
    </div>
    <div class="summary-item">
      <div class="number">${this.uatResults.filter(r => r.inStatus === 'Pass' || r.swiftStatus === 'Pass').length}</div>
      <div class="label">Passed</div>
    </div>
    <div class="summary-item">
      <div class="number">${this.uatResults.filter(r => r.inStatus === 'Fail' || r.swiftStatus === 'Fail').length}</div>
      <div class="label">Failed</div>
    </div>
    <div class="summary-item">
      <div class="number">${this.screenshotIndex.length}</div>
      <div class="label">Screenshots</div>
    </div>
  </div>

  <h2>📋 Input Test Data</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>MSISDN</th>
        <th>Circle</th>
        <th>Recharge MRP</th>
        <th>Recharge</th>
        <th>SWIFT</th>
        <th>IN</th>
        <th>Vi App</th>
      </tr>
    </thead>
    <tbody>
`;

    this.inputRows.forEach((row, idx) => {
      html += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${row.msisdn}</strong></td>
          <td>${row.circle}</td>
          <td>₹${row.rechargeMRP}</td>
          <td>${row.recharge === 'yes' ? '✅ Yes' : '❌ No'}</td>
          <td>${row.swift === 'yes' ? '✅ Yes' : '❌ No'}</td>
          <td>${row.inFlag === 'yes' ? '✅ Yes' : '❌ No'}</td>
          <td>${row.viApp === 'yes' ? '✅ Yes' : '❌ No'}</td>
        </tr>
      `;
    });

    html += `
    </tbody>
  </table>

  <h2>📱 UAT Execution Results</h2>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>MSISDN</th>
        <th>Circle</th>
        <th>MRP</th>
        <th>Plan Name</th>
        <th>IN Status</th>
        <th>SWIFT Status</th>
        <th>Vi App</th>
        <th>Screenshots</th>
      </tr>
    </thead>
    <tbody>
`;

    this.uatResults.forEach((result) => {
      const inStatus = result.inStatus || 'Skip';
      const swiftStatus = result.swiftStatus || 'Skip';
      const inBadge = inStatus === 'Pass' ? 'badge-pass' : (inStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      const swiftBadge = swiftStatus === 'Pass' ? 'badge-pass' : (swiftStatus === 'Fail' ? 'badge-fail' : 'badge-skip');
      
      html += `
        <tr>
          <td>${result.srNo}</td>
          <td><strong>${result.msisdn}</strong></td>
          <td>${result.circle}</td>
          <td>₹${result.mrp}</td>
          <td>${result.planName || 'N/A'}</td>
          <td><span class="badge ${inBadge}">${inStatus}</span></td>
          <td><span class="badge ${swiftBadge}">${swiftStatus}</span></td>
          <td>${result.viAppStatus || 'Skip'}</td>
          <td>${result.screenshots ? result.screenshots.length : 0}</td>
        </tr>
      `;
    });

    html += `
    </tbody>
  </table>

  <h2>📸 Screenshots</h2>
  <div class="screenshot-grid">
`;

    this.screenshotIndex.forEach((s) => {
      html += `
        <div class="screenshot-item">
          <img src="${s.fullPath}" alt="${s.screenshotFile}" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22150%22 height=%22100%22%3E%3Crect fill=%22%23f0f0f0%22 width=%22150%22 height=%22100%22/%3E%3Ctext x=%2250%22 y=%2250%22 font-size=%2212%22 fill=%22%23999%22%3ENo image%3C/text%3E%3C/svg%3E'">
          <div class="caption">${s.stepName || 'Step'} - ${s.msisdn}</div>
        </div>
      `;
    });

    html += `
  </div>

  <h2>📋 Detailed Steps</h2>
`;

    // Detailed steps for each MSISDN
    this.uatResults.forEach((result) => {
      html += `
    <h3>MSISDN: ${result.msisdn}</h3>
    <div class="step-detail">
      <strong>Transaction ID:</strong> ${result.transactionId}<br>
      <strong>Activation:</strong> ${result.activationDateTime}<br>
      <strong>Validity:</strong> ${result.validity}<br>
      <strong>Benefits:</strong> ${result.benefits}<br>
      <strong>Recharge Notification:</strong> ${result.rechargeNotification || 'N/A'}<br>
      <strong>IN Status:</strong> ${result.inStatus || 'Skip'}<br>
      <strong>SWIFT Status:</strong> ${result.swiftStatus || 'Skip'}
    </div>
  `;
    });

    html += `
  <div class="footer">
    <p>Report generated by VI Sim Automation Platform</p>
    <p>© 2026 QDegrees Services Pvt. Ltd.</p>
  </div>
</div>
</body>
</html>`;

    return html;
  }

  async writeReport(): Promise<string> {
    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `UAT_Recharge_Report_${timestamp}.xlsx`;
    const filepath = path.join(reportsDir, filename);

    // Sheet 1: Input Data
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

    // Sheet 2: UAT Results
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
      'Screenshots': (result.screenshots || []).join(', ')
    }));

    // Sheet 3: Screenshots with MSISDN
    const screenshotSheetData = this.screenshotIndex.map((screenshot) => ({
      'Sr. No.': screenshot.srNo,
      'MSISDN': screenshot.msisdn,
      'File': screenshot.screenshotFile,
      'URL': `/screenshots/${screenshot.screenshotFile}`,
      'Captured At': screenshot.capturedAt,
      'Step Name': screenshot.stepName || 'General'
    }));

    // Sheet 4: Summary
    const summaryData = [{
      'Total Excel Rows': this.inputRows.length,
      'Matched & Executed Rows': this.uatResults.length,
      'Screenshots': this.screenshotIndex.length,
      'Generated': new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    }];

    const workbook = xlsx.utils.book_new();
    
    const inputSheet = xlsx.utils.json_to_sheet(inputSheetData);
    xlsx.utils.book_append_sheet(workbook, inputSheet, 'Input Data');
    
    const uatSheet = xlsx.utils.json_to_sheet(uatSheetData);
    xlsx.utils.book_append_sheet(workbook, uatSheet, 'UAT Results');
    
    const screenshotSheet = xlsx.utils.json_to_sheet(screenshotSheetData);
    xlsx.utils.book_append_sheet(workbook, screenshotSheet, 'Screenshots');

    const summarySheet = xlsx.utils.json_to_sheet(summaryData);
    xlsx.utils.book_append_sheet(workbook, summarySheet, 'Summary');

    xlsx.writeFile(workbook, filepath);
    
    console.log(`[ExcelReportService] Excel report written to: ${filepath}`);
    console.log(`  - ${this.inputRows.length} input rows`);
    console.log(`  - ${this.uatResults.length} UAT results`);
    console.log(`  - ${this.screenshotIndex.length} screenshots`);
    
    return filepath;
  }

  async writePDFReport(): Promise<string> {
    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `UAT_Recharge_Report_${timestamp}.html`;
    const filepath = path.join(reportsDir, filename);

    const htmlContent = this.generateHTMLReport();
    fs.writeFileSync(filepath, htmlContent, 'utf8');
    
    console.log(`[ExcelReportService] HTML report (for PDF) written to: ${filepath}`);
    
    return filepath;
  }

  getResultCount(): number {
    return this.uatResults.length;
  }

  getScreenshotCount(): number {
    return this.screenshotIndex.length;
  }

  getInputRowCount(): number {
    return this.inputRows.length;
  }
}