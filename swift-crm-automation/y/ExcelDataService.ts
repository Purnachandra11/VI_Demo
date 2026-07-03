import * as xlsx from 'xlsx';
import * as path from 'path';

export interface InputData {
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
      msisdn: String(row['MSISDN'] ?? '').trim(),
      circle: String(row['CIRCLE'] ?? '').trim(),
      rechargeMRP: String(row['Recharge MRP'] ?? '').trim(),
      recharge: String(row['Recharge'] ?? '').trim(),
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

  /**
   * Find a matching recharge plan by MRP and Circle
   * 
   * @param rechargeMRP - The recharge MRP from Sheet 1 (e.g., "149")
   * @param circle - The circle from Sheet 1 (e.g., "ODI")
   * @returns The matching RechargePlan or null if not found
   * 
   * Search order:
   * 1. Exact match (MRP + Circle)
   * 2. MRP only (any circle)
   * 3. Circle partial match
   */
  findMatchingPlan(rechargeMRP: string, circle: string): RechargePlan | null {
    const plans = this.getRechargePlans();
    
    // Normalize inputs
    const normalizedMRP = rechargeMRP.trim();
    const normalizedCircle = circle.trim().toUpperCase();
    
    console.log(`[ExcelDataService] Looking for plan: MRP=${normalizedMRP}, Circle=${normalizedCircle}`);
    
    // 1. Try exact match by MRP and Circle
    let matchedPlan = plans.find(plan => {
      const planMRP = plan.newMRP.trim();
      const planCircle = plan.circle.trim().toUpperCase();
      return planMRP === normalizedMRP && planCircle === normalizedCircle;
    });
    
    if (matchedPlan) {
      console.log(`[ExcelDataService] ✅ Found exact match: MRP=${matchedPlan.newMRP}, Circle=${matchedPlan.circle}`);
      return matchedPlan;
    }
    
    // 2. Try match by MRP only (any circle)
    matchedPlan = plans.find(plan => {
      const planMRP = plan.newMRP.trim();
      return planMRP === normalizedMRP;
    });
    
    if (matchedPlan) {
      console.log(`[ExcelDataService] ⚠️ Found MRP match (circle fallback): MRP=${matchedPlan.newMRP}, Circle=${matchedPlan.circle}`);
      return matchedPlan;
    }
    
    // 3. Try match by Circle (partial match)
    matchedPlan = plans.find(plan => {
      const planCircle = plan.circle.trim().toUpperCase();
      // Check if the plan circle contains the input circle or vice versa
      return planCircle.includes(normalizedCircle) || normalizedCircle.includes(planCircle);
    });
    
    if (matchedPlan) {
      console.log(`[ExcelDataService] ⚠️ Found partial circle match: MRP=${matchedPlan.newMRP}, Circle=${matchedPlan.circle}`);
      return matchedPlan;
    }
    
    // 4. No match found
    console.warn(`[ExcelDataService] ❌ No matching plan found for MRP=${normalizedMRP}, Circle=${normalizedCircle}`);
    return null;
  }

  /**
   * Get a recharge plan by its serial number
   */
  getPlanBySrNo(srNo: number): RechargePlan | null {
    const plans = this.getRechargePlans();
    return plans.find(plan => plan.srNo === srNo) || null;
  }

  /**
   * Get all recharge plans for a specific circle
   */
  getPlansByCircle(circle: string): RechargePlan[] {
    const plans = this.getRechargePlans();
    const normalizedCircle = circle.trim().toUpperCase();
    return plans.filter(plan => {
      const planCircle = plan.circle.trim().toUpperCase();
      return planCircle.includes(normalizedCircle) || normalizedCircle.includes(planCircle);
    });
  }

  /**
   * Get all recharge plans with a specific MRP
   */
  getPlansByMRP(mrp: string): RechargePlan[] {
    const plans = this.getRechargePlans();
    const normalizedMRP = mrp.trim();
    return plans.filter(plan => plan.newMRP.trim() === normalizedMRP);
  }

  /**
   * Get all recharge plans (cached)
   */
  getAllPlans(): RechargePlan[] {
    return this.getRechargePlans();
  }
}