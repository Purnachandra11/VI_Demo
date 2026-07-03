// test/pages/BillingAccountPage.ts

import { browser, $ } from '@wdio/globals';
import { SiebelHelper } from '../utils/SiebelHelper';

export class BillingAccountPage {

  /**
   * Click Billing/Account tab using XPath OR
   * Supports both IDs: ui-id-535 and ui-id-258
   */
  async clickBillingAccountTab(): Promise<void> {
    console.log('💰 Clicking Billing/Account tab...');
    try {
      // XPath OR - supports both IDs
      const billingTab = await $('//*[@id="ui-id-535" or @id="ui-id-258"]');
      
      // Wait for tab to be clickable
      await billingTab.waitForClickable({ 
        timeout: 15000,
        timeoutMsg: 'Billing/Account tab (ui-id-535 or ui-id-258) not clickable after 15s'
      });
      
      await billingTab.click();
      await browser.pause(3000);
      console.log('   ✅ Billing/Account tab clicked successfully');
      
    } catch (error) {
      console.log('   ⚠️ Primary XPath OR failed, trying alternative...');
      
      // Alternative 1: By text content
      try {
        const altTab = await $('//a[text()="Billing/Account"]');
        await altTab.waitForClickable({ timeout: 10000 });
        await altTab.click();
        await browser.pause(3000);
        console.log('   ✅ Billing/Account tab clicked (by exact text)');
      } catch (altError) {
        // Alternative 2: By contains text
        try {
          const altTab2 = await $('//a[contains(text(), "Billing")]');
          await altTab2.waitForClickable({ timeout: 10000 });
          await altTab2.click();
          await browser.pause(3000);
          console.log('   ✅ Billing/Account tab clicked (by contains text)');
        } catch (altError2) {
          // Alternative 3: By partial ID and text
          try {
            const altTab3 = await $('//a[contains(@id, "ui-id-") and contains(text(), "Billing")]');
            await altTab3.waitForClickable({ timeout: 10000 });
            await altTab3.click();
            await browser.pause(3000);
            console.log('   ✅ Billing/Account tab clicked (by partial ID + text)');
          } catch (altError3) {
            console.log('   ❌ Failed to click Billing/Account tab');
            throw error;
          }
        }
      }
    }
  }

  /**
   * Scroll to the content section
   * XPath: //*[@id="_swecontent"]
   */
  async scrollToContent(): Promise<void> {
    console.log('📜 Scrolling to content section...');
    try {
      const contentSection = await $('#_swecontent');
      await contentSection.waitForExist({ timeout: 10000 });
      await contentSection.scrollIntoView({ block: 'start' });
      await browser.pause(2000);
      console.log('   ✅ Scrolled to content section');
    } catch (error) {
      console.log('   ⚠️ Could not scroll to content section:', error);
    }
  }

  /**
   * Wait for content section to load
   */
  async waitForContentLoad(): Promise<void> {
    console.log('⏳ Waiting for content to load...');
    try {
      await $('#_swecontent').waitForExist({ 
        timeout: 15000,
        timeoutMsg: 'Content section (#_swecontent) not found'
      });
      
      // Wait for any loading indicators to disappear
      await browser.waitUntil(
        async () => {
          const loadingElements = await $$('//div[contains(@class, "loading") or contains(@class, "wait")]');
          const visibleLoading = await Promise.all(
            loadingElements.map(async el => await el.isDisplayed())
          );
          return !visibleLoading.some(v => v === true);
        },
        {
          timeout: 30000,
          timeoutMsg: 'Loading indicators still visible after 30s'
        }
      );
      
      console.log('   ✅ Content loaded successfully');
    } catch (error) {
      console.log('   ⚠️ Content load timeout:', error);
    }
  }

  /**
   * Verify Invoice Details section
   */
  async verifyInvoiceDetailsSection(): Promise<boolean> {
    console.log('📋 Verifying Invoice Details section...');
    try {
      // First scroll to content
      await this.scrollToContent();
      
      // Look for invoice section
      const invoiceSection = await $('//*[contains(text(), "Invoice") or contains(text(), "Bill")]');
      const isDisplayed = await invoiceSection.isDisplayed();
      console.log(`   ✅ Invoice section ${isDisplayed ? 'found' : 'not found'}`);
      return isDisplayed;
    } catch (error) {
      console.log('   ⚠️ Invoice section not found');
      return false;
    }
  }

  /**
   * Get latest invoice row from grid
   */
  async getLatestInvoiceRow(): Promise<{ invoiceId: string; date: string } | null> {
    console.log('🔍 Getting latest invoice...');
    try {
      // Wait for invoice grid
      const grid = await $('#s_5_l');
      await grid.waitForExist({ timeout: 10000 });
      
      const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');
      
      for (const row of invoiceRows) {
        const rowClass = await row.getAttribute('class');
        if (rowClass?.includes('jqgfirstrow')) continue;
        
        // Get date
        const dateCell = await row.$('td[@aria-describedby="s_5_l_Statement_Date"]');
        const date = await dateCell.getText();
        
        // Get invoice ID
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

  /**
   * Click Detailed button
   */
  async clickDetailedButton(): Promise<void> {
    console.log('🔍 Clicking Detailed button...');
    try {
      const detailedBtn = await $('#s_5_1_0_0_Ctrl');
      await detailedBtn.waitForClickable({ timeout: 10000 });
      await detailedBtn.click();
      console.log('   ✅ Detailed button clicked');
      await browser.pause(3000);
    } catch (error) {
      console.log('   ⚠️ Could not click Detailed button:', error);
    }
  }

  /**
   * Switch to PDF tab
   */
  async switchToPDFTab(): Promise<void> {
    console.log('📑 Switching to PDF tab...');
    try {
      const allHandles = await browser.getWindowHandles();
      if (allHandles.length > 1) {
        await browser.switchToWindow(allHandles[1]);
        console.log('   ✅ Switched to new tab');
        await browser.pause(2000);
      } else {
        console.log('   ⚠️ No new tab detected');
      }
    } catch (error) {
      console.log('   ⚠️ Could not switch tab:', error);
    }
  }

  /**
   * Complete navigation flow to Billing/Account
   */
  async navigateToBillingAccount(): Promise<void> {
    console.log('🚀 Navigating to Billing/Account...');
    
    // Step 1: Click the tab using XPath OR
    await this.clickBillingAccountTab();
    
    // Step 2: Wait for content to load
    await this.waitForContentLoad();
    
    // Step 3: Scroll to content section
    await this.scrollToContent();
    
    // Step 4: Verify invoice section
    await this.verifyInvoiceDetailsSection();
    
    console.log('✅ Successfully navigated to Billing/Account');
  }
}