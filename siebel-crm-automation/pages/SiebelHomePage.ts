// test/pages/SiebelHomePage.ts (NEEDS UPDATE)

import { browser, $ } from '@wdio/globals';
import { SiebelHelper } from '../utils/SiebelHelper';

export class SiebelHomePage {

  async verifyHomePageLoaded(): Promise<boolean> {
    console.log('🏠 Verifying Home page loaded...');
    try {
      await browser.waitUntil(
        async () => {
          const homeTab = await $('//*[@id="ui-id-126"]');
          return await homeTab.isDisplayed();
        },
        { timeout: 30000, interval: 1000 }
      );
      console.log('   ✅ Home page loaded successfully');
      return true;
    } catch (error) {
      console.log('   ❌ Home page not loaded');
      return false;
    }
  }

  async clickBillingAndAccountTab(): Promise<void> {
    console.log('💰 Clicking Billing & Account tab...');
    try {
      const billingTab = await $('//*[@id="ui-id-535"]');
      await billingTab.waitForClickable({ timeout: 15000 });
      await billingTab.click();
      await browser.pause(3000);
      console.log('   ✅ Billing & Account tab clicked');
    } catch (error) {
      console.log('   ⚠️ Could not find Billing & Account tab, trying alternative...');
      await SiebelHelper.safeClick('//*[contains(text(), "Billing") or contains(text(), "Account")]');
    }
  }

  async getHomeTabText(): Promise<string> {
    try {
      const homeTab = await $('//*[@id="ui-id-126"]');
      return await homeTab.getText();
    } catch {
      return '';
    }
  }
}