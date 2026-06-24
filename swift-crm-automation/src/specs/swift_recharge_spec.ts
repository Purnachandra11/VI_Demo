import { browser } from '@wdio/globals';
import { SwiftLoginPage } from '../pages/SwiftLoginPage';
import { RechargePage } from '../pages/RechargePage';
import { ViAppPage } from '../pages/ViAppPage';
import { ExcelDataService } from '../services/ExcelDataService';
import { ExcelReportService } from '../services/ExcelReportService';
import * as path from 'path';

import * as fs from 'fs';

const DATA_PATH = path.resolve('./data/Input_data.xlsx');
const SAMPLE_PATH = path.resolve('./Sample file/Input_data.xlsx');
const EXCEL_PATH = fs.existsSync(DATA_PATH) ? DATA_PATH : SAMPLE_PATH;

describe('SWIFT CRM – Recharge UAT', () => {
  let loginPage: SwiftLoginPage;
  let rechargePage: RechargePage;
  let viAppPage: ViAppPage;
  let excelDataService: ExcelDataService;
  let excelReportService: ExcelReportService;
  let isLoggedIn = false;
  let swiftRows: any[] = [];

  before(async () => {
    loginPage = new SwiftLoginPage();
    rechargePage = new RechargePage();
    viAppPage = new ViAppPage();
    excelDataService = new ExcelDataService(EXCEL_PATH);
    excelReportService = new ExcelReportService();

    const inputRows = excelDataService.getInputData();
    swiftRows = inputRows.filter(row => row.swift.toLowerCase() === 'yes');

    console.log('[Recharge UAT] Starting SWIFT CRM Recharge UAT');
    console.log(`[Recharge UAT] Found ${swiftRows.length} rows with SWIFT=Yes`);
  });

  after(async () => {
    if (excelReportService.getResultCount() > 0) {
      const reportPath = await excelReportService.writeReport();
      console.log(`[Recharge UAT] Report generated: ${reportPath}`);
    }
  });

  it('should process all recharge UAT tests', async () => {
    for (let index = 0; index < swiftRows.length; index++) {
      const row = swiftRows[index];
      const srNo = index + 1;

      console.log(`\n===== Test ${srNo} =====`);
      console.log(`MSISDN      : ${row.msisdn}`);
      console.log(`Recharge MRP: ${row.rechargeMRP}`);
      console.log(`Circle      : ${row.circle}`);
      console.log(`Vi App      : ${row.viApp}`);
      console.log(`========================`);

      // ── SWIFT CRM login (once per session) ─────────────────────────────────
      if (!isLoggedIn) {
        console.log('[Recharge UAT] Logging in to SWIFT CRM');
        await loginPage.login(row.username, row.password);
        isLoggedIn = true;
        console.log('[Recharge UAT] Login successful');
      }

      // ── SWIFT CRM recharge flow ─────────────────────────────────────────────
      console.log('[Recharge UAT] Entering MSISDN');
      await rechargePage.enterMSISDN(row.msisdn);

      console.log('[Recharge UAT] Clicking Recharge Offer button');
      await rechargePage.clickRechargeOfferButton();

      console.log('[Recharge UAT] Capturing subscriber information');
      const subscriberInfo = await rechargePage.captureSubscriberInfo(row.msisdn, srNo);

      if (subscriberInfo.circle && subscriberInfo.circle.toLowerCase() !== row.circle.toLowerCase()) {
        console.warn(`[Recharge UAT] Circle mismatch! Expected: ${row.circle}, Got: ${subscriberInfo.circle}`);
      } else {
        console.log(`[Recharge UAT] Circle verified: ${subscriberInfo.circle}`);
      }

      console.log('[Recharge UAT] Clicking Offer History tab');
      await rechargePage.clickOfferHistoryTab();

      console.log('[Recharge UAT] Scraping offer history');
      const offerHistoryItems = await rechargePage.scrapeOfferHistory(row.rechargeMRP);

      console.log('[Recharge UAT] Adding results to report');
      offerHistoryItems.forEach(item => {
        excelReportService.addUATResult({
          ...item,
          msisdn: row.msisdn,
          circle: subscriberInfo.circle
        });
      });

      console.log('[Recharge UAT] Adding screenshots to report');
      excelReportService.addScreenshots(rechargePage.getScreenshots());

      console.log(`[Recharge UAT] Test ${srNo} completed successfully`);

      // ── Vi App flow (conditional) ───────────────────────────────────────────
      const viAppFlag = (row.viApp ?? '').toString().toLowerCase();

      if (viAppFlag === 'yes') {
        console.log(`\n[Vi App] ✅ Vi App = Yes for MSISDN ${row.msisdn} — running Vi App flow`);

        try {
          // Pass an OTP only if provided via environment variable (e.g. CI/CD injection).
          // If the SIM is on the same device, the app auto-fills and no OTP is needed.
          const manualOtp = process.env.VI_APP_OTP ?? undefined;

          await viAppPage.runViAppFlow(row.msisdn, manualOtp);

          console.log(`[Vi App] ✅ Vi App flow completed for MSISDN ${row.msisdn}`);
        } catch (viError: any) {
          // Log but do not fail the whole suite — SWIFT results are already saved
          console.error(`[Vi App] ❌ Vi App flow failed for MSISDN ${row.msisdn}: ${viError.message}`);
        }
      } else {
        console.log(`[Vi App] ⏭  Vi App = "${row.viApp}" for MSISDN ${row.msisdn} — skipping Vi App verification`);
      }
    }
  });
});