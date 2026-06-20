import { browser } from '@wdio/globals';
import { SwiftLoginPage } from '../pages/SwiftLoginPage';
import { RechargePage } from '../pages/RechargePage';
import { ExcelDataService } from '../services/ExcelDataService';
import { ExcelReportService } from '../services/ExcelReportService';
import * as path from 'path';

const EXCEL_PATH = path.resolve('./data/Input_data.xlsx');

describe('SWIFT CRM – Recharge UAT', () => {
  let loginPage: SwiftLoginPage;
  let rechargePage: RechargePage;
  let excelDataService: ExcelDataService;
  let excelReportService: ExcelReportService;
  let isLoggedIn = false;
  let swiftRows: any[] = [];

  before(async () => {
    loginPage = new SwiftLoginPage();
    rechargePage = new RechargePage();
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
      console.log(`MSISDN: ${row.msisdn}`);
      console.log(`Recharge MRP: ${row.rechargeMRP}`);
      console.log(`Circle: ${row.circle}`);
      console.log(`========================`);

      if (!isLoggedIn) {
        console.log('[Recharge UAT] Logging in to SWIFT CRM');
        await loginPage.login(row.username, row.password);
        isLoggedIn = true;
        console.log('[Recharge UAT] Login successful');
      }

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
    }
  });
});
