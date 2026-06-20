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
}

interface ScreenshotIndex {
  srNo: number;
  msisdn: string;
  screenshotFile: string;
  fullPath: string;
  capturedAt: string;
}

export class ExcelReportService {
  private uatResults: UATResult[] = [];
  private screenshotIndex: ScreenshotIndex[] = [];

  addUATResult(result: Omit<UATResult, 'srNo'>): void {
    const srNo = this.uatResults.length + 1;
    this.uatResults.push({ ...result, srNo });
    console.log(`[ExcelReportService] Added UAT result #${srNo}`);
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
    });
    console.log(`[ExcelReportService] Added ${screenshots.length} screenshots`);
  }

  async writeReport(): Promise<string> {
    const reportsDir = path.resolve('./reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `UAT_Recharge_Report_${timestamp}.xlsx`;
    const filepath = path.join(reportsDir, filename);

    const uatSheetData = this.uatResults.map(result => ({
      'Sr. No.': result.srNo,
      'Transaction Id': result.transactionId,
      'Activation Date & Time': result.activationDateTime,
      'Validity': result.validity,
      'MRP': result.mrp,
      'Activation Mode': result.activationMode,
      'Current Core Balance': result.currentCoreBalance,
      'eTOP UP Transaction Id': result.etopupTransactionId,
      'Retailer MSISDN': result.retailerMsisdn,
      'Name': result.name,
      'Category': result.category,
      'Benefits': result.benefits,
      'Detail Validity': result.detailValidity,
      'MSISDN': result.msisdn,
      'Circle': result.circle
    }));

    const screenshotSheetData = this.screenshotIndex.map(screenshot => ({
      'Sr. No.': screenshot.srNo,
      'MSISDN': screenshot.msisdn,
      'Screenshot File': screenshot.screenshotFile,
      'Full Path': screenshot.fullPath,
      'Captured At': screenshot.capturedAt
    }));

    const workbook = xlsx.utils.book_new();
    
    const uatSheet = xlsx.utils.json_to_sheet(uatSheetData);
    xlsx.utils.book_append_sheet(workbook, uatSheet, 'UAT Results');
    
    const screenshotSheet = xlsx.utils.json_to_sheet(screenshotSheetData);
    xlsx.utils.book_append_sheet(workbook, screenshotSheet, 'Screenshots');

    xlsx.writeFile(workbook, filepath);
    
    console.log(`[ExcelReportService] Report written to: ${filepath}`);
    return filepath;
  }

  getResultCount(): number {
    return this.uatResults.length;
  }

  getScreenshotCount(): number {
    return this.screenshotIndex.length;
  }
}
