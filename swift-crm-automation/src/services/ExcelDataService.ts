import * as xlsx from 'xlsx';
import * as path from 'path';

export interface InputData {
  username: string;
  password: string;
  msisdn: string;
  circle: string;
  rechargeMRP: string;
  recharge: string;
  swift: string;
  inFlag: string;
  viApp: string;

}

export interface RechargePlan {
  srNo: number;
  newMRP: string;
  circle: string;
  mode: string;
  cat: string;
  benefit: string;
  rechargeNotification: string;
}

export class ExcelDataService {
  private workbook: xlsx.WorkBook;

  constructor(filePath: string) {
    const absolutePath = path.resolve(filePath);
    this.workbook = xlsx.readFile(absolutePath);
  }

  getInputData(): InputData[] {
    const sheet = this.workbook.Sheets['Input excel'];
    if (!sheet) throw new Error('Sheet "Input excel" not found in workbook');

    const rows = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });
    return rows.map((row: any) => ({
      username: String(row['Username'] ?? '').trim(),
      password: String(row['Password'] ?? '').trim(),
      msisdn: String(row['MSISDN'] ?? '').trim(),
      circle: String(row['CIRCLE'] ?? '').trim(),
      rechargeMRP: String(row['Recharge MRP'] ?? '').trim(),
      recharge: String(row['recharge'] ?? '').trim(),
      swift: String(row['SWIFT'] ?? '').trim(),
      inFlag: String(row['IN'] ?? '').trim(),
      viApp: String(row['Vi App'] ?? '').trim(),
    }));
  }

  getRechargePlans(): RechargePlan[] {
    const sheet = this.workbook.Sheets['Recharge Plans'];
    if (!sheet) throw new Error('Sheet "Recharge Plans" not found in workbook');

    const rows = xlsx.utils.sheet_to_json<any>(sheet, { defval: '' });
    return rows.map((row: any) => ({
      srNo: Number(row['Sr. No.'] ?? 0),
      newMRP: String(row['New MRP'] ?? '').trim(),
      circle: String(row['Circle'] ?? '').trim(),
      mode: String(row['Mode'] ?? '').trim(),
      cat: String(row['CAT'] ?? '').trim(),
      benefit: String(row['Benefit (Open)'] ?? '').trim(),
      rechargeNotification: String(row['Recharge Notification'] ?? '').trim(),
    }));
  }
}
