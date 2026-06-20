import { browser, expect } from '@wdio/globals';
import { SwiftLoginPage } from '../pages/SwiftLoginPage';
import { ExcelDataService } from '../services/ExcelDataService';
import * as path from 'path';

const EXCEL_PATH = path.resolve('./data/Input_data.xlsx');

describe('SWIFT CRM – Login Flow', () => {
  let loginPage: SwiftLoginPage;
  let excelService: ExcelDataService;

  before(async () => {
    loginPage = new SwiftLoginPage();
    excelService = new ExcelDataService(EXCEL_PATH);
  });

  const excelServiceTemp = new ExcelDataService(
    path.resolve('./data/Input_data.xlsx')
  );
  const inputRows = excelServiceTemp.getInputData();

  const testData = {
    username: 'COR4055772',
    password: 'Test@123456789!',
    url: 'https://swiftcrm.vodafoneidea.in/swift-portal/login'
};

  inputRows.forEach((row, index) => {
    if (row.swift.toLowerCase() !== 'yes') {
      it.skip(
        `[Row ${index + 1}] MSISDN ${row.msisdn} — SWIFT flag is "${row.swift}", skipping`,
        () => {}
      );
      return;
    }

    it(
      `[Row ${index + 1}] Login with user "${row.username}" (MSISDN: ${row.msisdn})`,
      async () => {
        console.log('\n===== TEST DATA =====');
        console.log(`Username   : ${row.username}`);
        console.log(`MSISDN     : ${row.msisdn}`);
        console.log(`Circle     : ${row.circle}`);
        console.log(`Recharge   : ₹${row.rechargeMRP}`);
        console.log(`SWIFT Flag : ${row.swift}`);
        console.log('=====================\n');

        await loginPage.login(row.username, row.password);

        const profileTab = await $('a#ac_agent_profile');
        await expect(profileTab).toBeDisplayed();

        const color = await profileTab.getCSSProperty('color');
        console.log(`[Assertion] My Profile tab color: ${color.value}`);

        console.log(`PASSED – User "${row.username}" successfully logged into SWIFT CRM.`);
      }
    );
  });
});
