import { browser } from '@wdio/globals';
import { ViAppPage } from '../pages/ViAppPage';
import { ExcelDataService } from '../services/ExcelDataService';
import { ExcelReportService, ViAppResult } from '../services/ExcelReportService';
import * as path from 'path';
import * as fs from 'fs';

// ── Paths ──────────────────────────────────────────────────────────────────
const DATA_PATH = path.resolve('./data/Input_data.xlsx');
const SAMPLE_PATH = path.resolve('./Sample file/Input_data.xlsx');
const EXCEL_PATH = fs.existsSync(DATA_PATH) ? DATA_PATH : SAMPLE_PATH;

describe('VI App Recharge UAT', () => {
  let viAppPage: ViAppPage;
  let excelDataService: ExcelDataService;
  let excelReportService: ExcelReportService;
  let allRows: any[] = [];

  before(async () => {
    viAppPage = new ViAppPage();
    excelDataService = new ExcelDataService(EXCEL_PATH);
    excelReportService = new ExcelReportService();

    // All Sheet1 rows — Vi App = Yes are run, Vi App = No are recorded as skipped
    allRows = excelDataService.getInputData();
    excelReportService.addInputRows(
      allRows.map(r => ({
        msisdn: r.msisdn,
        circle: r.circle,
        rechargeMRP: r.rechargeMRP,
        recharge: r.recharge,
        swift: r.swift,
        inFlag: r.inFlag,
        viApp: r.viApp,
        planBenefit: '',
        rechargeNotification: '',
      }))
    );

    const yesCount = allRows.filter(r => (r.viApp ?? '').toLowerCase() === 'yes').length;
    console.log(`[VI App] Loaded ${allRows.length} input rows (Vi App = Yes: ${yesCount}, No: ${allRows.length - yesCount})`);
  });

  after(async () => {
    if (excelReportService.getViAppResultCount() > 0 || excelReportService.getResultCount() > 0) {
      const excelPath = await excelReportService.writeReport();
      const pdfPath = await excelReportService.writePDFReport();
      console.log(`[VI App] ✅ Excel report: ${excelPath}`);
      console.log(`[VI App] ✅ PDF/HTML report: ${pdfPath}`);
    } else {
      console.warn('[VI App] No results recorded — skipping report generation');
    }
  });

  it('should process all VI App test cases (running Yes rows, skipping No rows)', async () => {
    for (let index = 0; index < allRows.length; index++) {
      const row = allRows[index];
      const srNo = index + 1;
      const viAppFlag = (row.viApp ?? '').toString().trim();
      const isYes = viAppFlag.toLowerCase() === 'yes';

      console.log(`\n[VI App] === Row ${srNo} ===`);
      console.log(`MSISDN     : ${row.msisdn}`);
      console.log(`Circle     : ${row.circle}`);
      console.log(`Recharge MRP: ${row.rechargeMRP}`);
      console.log(`Vi App     : ${viAppFlag || '(blank)'}`);
      console.log(`========================`);

      // ── Vi App = No -> skip this row entirely, record as Skip ────────────
      if (!isYes) {
        console.log(`[VI App] ⏭ Vi App="${viAppFlag}" — skipping verification for ${row.msisdn}`);
        const skipped: ViAppResult = {
          msisdn: row.msisdn,
          circle: row.circle,
          rechargeMRP: row.rechargeMRP,
          viAppFlag: viAppFlag || 'No',
          ran: false,
          status: 'Skip',
          screenshotCount: 0,
          screenshots: [],
          remarks: 'Skipped — Vi App flag is not "Yes"',
        };
        excelReportService.addViAppResult(skipped);
        continue;
      }

      // ── Vi App = Yes -> find the matching Sheet2 plan, then run the flow ─
      const matchedPlan = excelDataService.findMatchingPlan(row.rechargeMRP, row.circle);
      if (!matchedPlan) {
        console.warn(`[VI App] ⚠️ No matching Sheet2 plan found for MRP ${row.rechargeMRP} / Circle ${row.circle}`);
      } else {
        console.log(`[VI App] Matched Sheet2 plan: New MRP ₹${matchedPlan.newMRP} (Sr. No. ${matchedPlan.srNo})`);
      }

      try {
        const manualOtp = process.env.VI_APP_OTP;
        const flowResult = await viAppPage.runViAppFlow(
          row.msisdn,
          row.rechargeMRP,
          row.circle,
          matchedPlan
            ? {
                newMRP: matchedPlan.newMRP,
                benefit: matchedPlan.benefit,
                rechargeNotification: matchedPlan.rechargeNotification,
              }
            : undefined,
          manualOtp
        );

        const bothMatched = flowResult.mrpMatched === true && flowResult.benefitMatched === true;
        const anyChecked = flowResult.mrpMatched !== undefined || flowResult.benefitMatched !== undefined;

        const status: ViAppResult['status'] = flowResult.error
          ? 'Error'
          : bothMatched
          ? 'Pass'
          : anyChecked
          ? 'Mismatch'
          : 'Fail';

        const result: ViAppResult = {
          msisdn: row.msisdn,
          circle: row.circle,
          rechargeMRP: row.rechargeMRP,
          viAppFlag: 'Yes',
          ran: true,
          status,
          matchedPlanMRP: matchedPlan?.newMRP,
          expectedBenefit: matchedPlan?.benefit,
          expectedNotification: matchedPlan?.rechargeNotification,
          lastRechargeLabel: flowResult.pack?.lastRechargeLabel,
          lastRechargeAmount: flowResult.pack?.lastRechargeAmount,
          mrpActualNumeric: flowResult.pack?.lastRechargeAmountNumeric,
          mrpMatched: flowResult.mrpMatched,
          packEndsOnDate: flowResult.pack?.packEndsOnDate,
          mainBalance: flowResult.pack?.mainBalance,
          serviceValidity: flowResult.pack?.serviceValidity,
          repeatRechargeTitle: flowResult.repeatRecharge?.packTitle,
          actualBenefit: flowResult.repeatRecharge?.benefitText,
          benefitMatched: flowResult.benefitMatched,
          screenshotCount: flowResult.screenshots.length,
          screenshots: flowResult.screenshots,
          remarks: flowResult.error
            ? `Error: ${flowResult.error}`
            : matchedPlan
            ? undefined
            : 'No matching Sheet2 plan found for this MRP/Circle',
        };

        excelReportService.addViAppResult(result);

        console.log(
          flowResult.error
            ? `[VI App] ❌ Row ${srNo} failed: ${flowResult.error}`
            : `[VI App] ✅ Row ${srNo} completed — status: ${status}`
        );
      } catch (error: any) {
        console.error(`[VI App] ❌ Row ${srNo} threw an unexpected error:`, error);
        excelReportService.addViAppResult({
          msisdn: row.msisdn,
          circle: row.circle,
          rechargeMRP: row.rechargeMRP,
          viAppFlag: 'Yes',
          ran: true,
          status: 'Error',
          screenshotCount: 0,
          screenshots: [],
          remarks: `Unexpected error: ${error?.message ?? String(error)}`,
        });
        // Continue to next row rather than aborting the whole suite
      }
    }
  });
});