import { browser } from '@wdio/globals';
import { ViAppPage } from '../pages/ViAppPage';
import { ExcelDataService } from '../services/ExcelDataService';
import * as path from 'path';

const EXCEL_PATH = path.resolve('./Sample file/Input_data.xlsx');

describe('VI App Recharge UAT', () => {
  let viAppPage: ViAppPage;
  let excelDataService: ExcelDataService;
  let testRows: any[] = [];

  before(async () => {
    viAppPage = new ViAppPage();
    excelDataService = new ExcelDataService(EXCEL_PATH);

    // Get all rows where Vi App is Yes
    testRows = excelDataService.getInputData().filter(row => 
      row.viApp && row.viApp.toLowerCase() === 'yes'
    );

    console.log(`[VI App] Found ${testRows.length} test rows with Vi App = Yes`);
  });

  it('should process all VI App test cases', async () => {
    for (let index = 0; index < testRows.length; index++) {
      const row = testRows[index];
      const srNo = index + 1;
      console.log(`\n[VI App] === Test ${srNo} ===`);
      console.log(`MSISDN: ${row.msisdn}`);
      console.log('========================');

      try {
        // Pass OTP from env if available
        const manualOtp = process.env.VI_APP_OTP;
        await viAppPage.runViAppFlow(row.msisdn, manualOtp);
        console.log(`[VI App] Test ${srNo} completed successfully!`);
      } catch (error) {
        console.error(`[VI App] Test ${srNo} failed:`, error);
        throw error;
      }
    }
  });
});
