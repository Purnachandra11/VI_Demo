// test/pages/BillingAccountPage.ts (NEEDS UPDATE - add more methods)

import { browser, $ } from '@wdio/globals';
import { SiebelHelper } from '../utils/SiebelHelper';

export class BillingAccountPage {

  async clickBillingAccountTab(): Promise<void> {
    console.log('💰 Clicking Billing/Account tab...');
    try {
      const billingTab = await $('//*[@id="ui-id-535"]');
      await billingTab.waitForClickable({ timeout: 15000 });
      await billingTab.click();
      await browser.pause(3000);
      console.log('   ✅ Billing/Account tab clicked');
    } catch (error) {
      console.log('   ⚠️ Could not click Billing/Account tab');
      await SiebelHelper.safeClick('//*[contains(text(), "Billing") or contains(text(), "Account")]');
    }
  }

  async verifyInvoiceDetailsSection(): Promise<boolean> {
    console.log('📋 Verifying Invoice Details section...');
    try {
      const invoiceSection = await $('//*[contains(text(), "Invoice") or contains(text(), "Bill")]');
      const isDisplayed = await invoiceSection.isDisplayed();
      console.log(`   ✅ Invoice section ${isDisplayed ? 'found' : 'not found'}`);
      return isDisplayed;
    } catch (error) {
      console.log('   ⚠️ Invoice section not found');
      return false;
    }
  }

  async getLatestInvoiceRow(): Promise<{ invoiceId: string; date: string } | null> {
    console.log('🔍 Getting latest invoice...');
    try {
      const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');
      
      for (const row of invoiceRows) {
        const rowClass = await row.getAttribute('class');
        if (rowClass?.includes('jqgfirstrow')) continue;
        
        const dateCell = await row.$('td[@aria-describedby="s_5_l_Statement_Date"]');
        const date = await dateCell.getText();
        
        const invoiceCell = await row.$('td[@aria-describedby="s_5_l_Invoice_Number"]');
        const invoiceId = await invoiceCell.getText();
        
        if (invoiceId && invoiceId.trim()) {
          console.log(`   ✅ Found invoice: ${invoiceId} | Date: ${date}`);
          return { invoiceId: invoiceId.trim(), date: date.trim() };
        }
      }
      
      console.log('   ⚠️ No invoices found');
      return null;
    } catch (error) {
      console.log('   ⚠️ Could not fetch invoices:', error);
      return null;
    }
  }

  async clickDetailedButton(): Promise<void> {
    console.log('🔍 Clicking Detailed button...');
    try {
      const detailedBtn = await $('//*[@id="s_5_1_0_0_Ctrl"]');
      await detailedBtn.waitForClickable({ timeout: 10000 });
      await detailedBtn.click();
      console.log('   ✅ Detailed button clicked');
      await browser.pause(3000);
    } catch (error) {
      console.log('   ⚠️ Could not click Detailed button:', error);
    }
  }

  async switchToPDFTab(): Promise<void> {
    console.log('📑 Switching to PDF tab...');
    try {
      const allHandles = await browser.getWindowHandles();
      if (allHandles.length > 1) {
        await browser.switchToWindow(allHandles[1]);
        console.log('   ✅ Switched to new tab');
      } else {
        console.log('   ⚠️ No new tab detected');
      }
      await browser.pause(2000);
    } catch (error) {
      console.log('   ⚠️ Could not switch tab:', error);
    }
  }
}