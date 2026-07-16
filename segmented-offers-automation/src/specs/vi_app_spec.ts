// vi_app_spec.ts - Updated with SMS date validation

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

      // ── Vi App = No -> skip this row entirely ────────────────────────────
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

      // ── Vi App = Yes -> run the flow ─────────────────────────────────────
      const matchedPlan = excelDataService.findMatchingPlan(row.rechargeMRP, row.circle);
      if (!matchedPlan) {
        console.warn(`[VI App] ⚠️ No matching Sheet2 plan found for MRP ${row.rechargeMRP} / Circle ${row.circle}`);
      } else {
        console.log(`[VI App] Matched Sheet2 plan: New MRP ₹${matchedPlan.newMRP} (Sr. No. ${matchedPlan.srNo})`);
      }

      try {
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
            : undefined
        );

        // ── Determine status based on ALL checks ────────────────────────────
        const smsDatePass = flowResult.smsDateIsToday === true;
        const smsMatched = flowResult.smsMatched === true;
        const mrpMatched = flowResult.mrpMatched === true;
        const benefitMatched = flowResult.benefitMatched === true;

        // All critical checks must pass for a PASS status
        // SMS date is now a CRITICAL check
        const allPassed = smsDatePass && mrpMatched && benefitMatched;
        const anyChecked = smsMatched || mrpMatched || benefitMatched;

        let status: ViAppResult['status'] = flowResult.error
            ? 'Error'
            : allPassed
            ? 'Pass'
            : (mrpMatched && benefitMatched && !smsDatePass)  
            ? 'Mismatch'  
            : (mrpMatched || benefitMatched || smsMatched)
            ? 'Mismatch'  
            : 'Fail';

        // ── Build remarks with SMS date info ────────────────────────────────
        let remarks = flowResult.error
          ? `Error: ${flowResult.error}`
          : !flowResult.smsDateIsToday
          ? `SMS date is NOT today (${flowResult.sms?.smsDate || 'unknown date'})`
          : matchedPlan
          ? undefined
          : 'No matching Sheet2 plan found for this MRP/Circle';

        // Add additional remarks if multiple issues
        if (!flowResult.error && !flowResult.smsDateIsToday && !mrpMatched) {
          remarks = `SMS date is NOT today (${flowResult.sms?.smsDate || 'unknown date'}) AND MRP mismatch`;
        }

        // ── Create result object with SMS fields ─────────────────────────────
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
          // 👇 SMS FIELDS
          smsDateIsToday: flowResult.smsDateIsToday,
          smsMatched: flowResult.smsMatched,
          screenshotCount: flowResult.screenshots.length,
          screenshots: flowResult.screenshots,
          remarks: remarks,
        };

        excelReportService.addViAppResult(result);

        // ── Log the result with SMS status ──────────────────────────────────
        console.log(
          flowResult.error
            ? `[VI App] ❌ Row ${srNo} failed: ${flowResult.error}`
            : `[VI App] ✅ Row ${srNo} completed — status: ${status}`
        );
        console.log(`[VI App]   SMS Date Today: ${smsDatePass ? '✅ YES' : '❌ NO'}`);
        console.log(`[VI App]   SMS Matched: ${smsMatched ? '✅ YES' : '❌ NO'}`);
        console.log(`[VI App]   MRP Matched: ${mrpMatched ? '✅ YES' : '❌ NO'}`);
        console.log(`[VI App]   Benefit Matched: ${benefitMatched ? '✅ YES' : '❌ NO'}`);

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
      }
    }
  });
});