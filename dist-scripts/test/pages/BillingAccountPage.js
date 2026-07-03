// test/pages/BillingAccountPage.ts (UPDATED)

import { browser, $, $$ } from '@wdio/globals';
import { SiebelHelper } from '../utils/SiebelHelper';

export interface InvoiceRecord {
  invoice_id: string;
  invoice_type: string;
  invoice_date: string;
  due_date: string;
  amount: string;
  gross_amount_available_for_credit: string;
  invoice_status: string;
  amount_paid: string;
  invoice_balance: string;
  restriction_amount: string;
  net_amount_available_for_credit: string;
  tax_amount: string;
  restriction_tax_amount: string;
  credit_net_amount: string;
  discount_net_amount: string;
  discount_tax_amount: string;
  dispute_net_amount: string;
  dispute_tax_amount: string;
}

export class BillingAccountPage {

  /**
   * Scroll to the Billing/Account section
   * XPath: //*[@id="a_2"]/div[1]
   */
  async scrollToBillingAccountSection(): Promise<void> {
    console.log('📜 Scrolling to Billing/Account section...');
    try {
      const section = await $('//*[@id="a_2"]/div[1]');
      await section.waitForExist({ timeout: 10000 });
      await section.scrollIntoView({ block: 'center' });
      await browser.pause(1000);
      console.log('   ✅ Scrolled to Billing/Account section');
    } catch (error) {
      console.log('   ⚠️ Could not scroll to Billing/Account section:', error);
    }
  }

  /**
   * Click Billing/Account tab using XPath: //*[@id="ui-id-191"]
   */
  async clickBillingAccountTab(): Promise<void> {
    console.log('💰 Clicking Billing/Account tab...');
    try {
      // First scroll to the section
      await this.scrollToBillingAccountSection();
      
      // Click the tab using the specific ID
      const billingTab = await $('//*[@id="ui-id-191"]');
      await billingTab.waitForClickable({ 
        timeout: 15000,
        timeoutMsg: 'Billing/Account tab (ui-id-191) not clickable after 15s'
      });
      await billingTab.click();
      await browser.pause(3000);
      console.log('   ✅ Billing/Account tab clicked successfully');
      
    } catch (error) {
      console.log('   ⚠️ Primary selector failed, trying alternatives...');
      
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
   * Scroll to the Invoice Details section
   * XPath: //*[@id="a_5"]/div[1]/div[1]
   */
  async scrollToInvoiceDetails(): Promise<void> {
    console.log('📋 Scrolling to Invoice Details section...');
    try {
      const invoiceSection = await $('//*[@id="a_5"]/div[1]/div[1]');
      await invoiceSection.waitForExist({ timeout: 10000 });
      await invoiceSection.scrollIntoView({ block: 'center' });
      await browser.pause(1000);
      console.log('   ✅ Scrolled to Invoice Details section');
    } catch (error) {
      console.log('   ⚠️ Could not scroll to Invoice Details section:', error);
    }
  }

  /**
   * Verify Invoice Details section
   */
  async verifyInvoiceDetailsSection(): Promise<boolean> {
    console.log('📋 Verifying Invoice Details section...');
    try {
      // First scroll to content
      await this.scrollToInvoiceDetails();
      
      // Look for invoice section using the specific XPath
      const invoiceSection = await $('//*[@id="a_5"]/div[1]/div[1]');
      const isDisplayed = await invoiceSection.isDisplayed();
      console.log(`   ✅ Invoice section ${isDisplayed ? 'found' : 'not found'}`);
      return isDisplayed;
    } catch (error) {
      console.log('   ⚠️ Invoice section not found');
      return false;
    }
  }

  /**
   * Parse all invoice records from the invoice table
   * Returns array of invoice records with all available data
   */
  async parseInvoiceDetails(): Promise<InvoiceRecord[]> {
    console.log('📊 Parsing Invoice Details from the grid...');
    const invoices: InvoiceRecord[] = [];
    
    try {
      // Wait for the invoice table to load
      await this.waitForInvoiceGridToLoad();
      
      // Get all data rows from the invoice table
      const rows = await $$('#s_5_l tbody tr:not(.jqgfirstrow)');
      
      if ((await rows.length) === 0) {
        console.log('   ⚠️ No invoice rows found');
        return invoices;
      }
      
      console.log(`   Found ${await rows.length} invoice rows`);
      
      for (const row of rows) {
        const cells = await row.$$('td');
        
        if ((await cells.length) >= 18) {
          try {
            const invoice: InvoiceRecord = {
              invoice_id: await this.getCellText(cells[1]) || '',
              invoice_type: await this.getCellText(cells[2]) || '',
              invoice_date: await this.getCellText(cells[3]) || '',
              due_date: await this.getCellText(cells[4]) || '',
              amount: await this.getCellText(cells[5]) || '',
              gross_amount_available_for_credit: await this.getCellText(cells[6]) || '',
              invoice_status: await this.getCellText(cells[7]) || '',
              amount_paid: await this.getCellText(cells[8]) || '',
              invoice_balance: await this.getCellText(cells[9]) || '',
              restriction_amount: await this.getCellText(cells[10]) || '',
              net_amount_available_for_credit: await this.getCellText(cells[11]) || '',
              tax_amount: await this.getCellText(cells[12]) || '',
              restriction_tax_amount: await this.getCellText(cells[13]) || '',
              credit_net_amount: await this.getCellText(cells[14]) || '',
              discount_net_amount: await this.getCellText(cells[15]) || '',
              discount_tax_amount: await this.getCellText(cells[16]) || '',
              dispute_net_amount: await this.getCellText(cells[17]) || '',
              dispute_tax_amount: await this.getCellText(cells[18]) || ''
            };
            
            // Log the parsed invoice
            console.log(`      Invoice ${invoices.length + 1}: ${invoice.invoice_id} | ${invoice.invoice_date} | ${invoice.invoice_status} | ${invoice.amount}`);
            
            invoices.push(invoice);
          } catch (cellError) {
            console.log(`   ⚠️ Error parsing row: ${cellError}`);
          }
        }
      }
      
      console.log(`   ✅ Parsed ${invoices.length} invoice records`);
      return invoices;
      
    } catch (error) {
      console.log(`   ⚠️ Error parsing invoices: ${error}`);
      return invoices;
    }
  }

  /**
   * Get invoice records filtered by invoice date
   * @param targetDate - Date to filter by (e.g., "15-Jun-2026")
   */
  async getInvoicesByDate(targetDate: string): Promise<InvoiceRecord[]> {
    console.log(`🔍 Getting invoices for date: ${targetDate}`);
    
    const allInvoices = await this.parseInvoiceDetails();
    
    if (allInvoices.length === 0) {
      console.log('   ⚠️ No invoices found');
      return [];
    }
    
    // Filter invoices by date
    const filteredInvoices = allInvoices.filter(invoice => {
      // Normalize both dates for comparison
      const normalizedTarget = targetDate.trim().toLowerCase();
      const normalizedInvoice = invoice.invoice_date.trim().toLowerCase();
      return normalizedInvoice === normalizedTarget;
    });
    
    if (filteredInvoices.length === 0) {
      console.log(`   ⚠️ No invoices found for date: ${targetDate}`);
      console.log(`   Available invoice dates: ${allInvoices.map(i => i.invoice_date).join(', ')}`);
    } else {
      console.log(`   ✅ Found ${filteredInvoices.length} invoice(s) for date: ${targetDate}`);
      filteredInvoices.forEach(inv => {
        console.log(`      - ${inv.invoice_id} | ${inv.invoice_status} | ${inv.amount}`);
      });
    }
    
    return filteredInvoices;
  }

  /**
   * Get the latest invoice from the grid
   */
  async getLatestInvoiceRow(): Promise<{ invoiceId: string; date: string } | null> {
    console.log('🔍 Getting latest invoice...');
    try {
      // Wait for invoice grid
      await this.waitForInvoiceGridToLoad();
      
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
   * Wait for the invoice grid to load
   */
  private async waitForInvoiceGridToLoad(): Promise<void> {
    console.log('   ⏳ Waiting for invoice grid to load...');
    
    try {
      // Wait for the invoice table to appear
      await $('#s_5_l').waitForDisplayed({ 
        timeout: 15000,
        timeoutMsg: 'Invoice grid (s_5_l) not found after 15s'
      });
      
      // Wait for at least one data row (excluding header)
      await browser.waitUntil(
        async () => {
          const rows = await $$('#s_5_l tbody tr:not(.jqgfirstrow)');
          return (await rows.length) > 0;
        },
        { 
          timeout: 10000, 
          interval: 1000, 
          timeoutMsg: 'No data rows found in invoice grid' 
        }
      );
      
      // Wait for any loading indicators to disappear
      const loadingElements = await $$('//div[contains(@class, "loading") or contains(@class, "wait")]');
      for (const el of loadingElements) {
        if (await el.isDisplayed()) {
          await el.waitForDisplayed({ reverse: true, timeout: 5000 });
        }
      }
      
      console.log('   ✅ Invoice grid loaded successfully');
    } catch (error) {
      console.log(`   ⚠️ Invoice grid may not have loaded completely: ${error}`);
    }
  }

  /**
   * Get cell text from a cell element
   */
  private async getCellText(cell: any): Promise<string> {
    try {
      // Try to get title attribute first (often has the actual value)
      const title = await cell.getAttribute('title');
      if (title && title.trim()) {
        return title.trim();
      }
      // Fall back to text content
      return (await cell.getText()).trim();
    } catch {
      return '';
    }
  }

  /**
   * Click Detailed button
   */
  async clickDetailedButton(): Promise<void> {
    console.log('🔍 Clicking Detailed button...');
    try {
      const detailedBtn = await $('#s_5_1_0_0_Ctrl');
      if (await detailedBtn.isExisting()) {
        await detailedBtn.waitForClickable({ timeout: 10000 });
        await detailedBtn.click();
        console.log('   ✅ Detailed button clicked');
        await browser.pause(3000);
      } else {
        // Try alternative selector
        const altBtn = await $('//*[contains(text(), "Detailed")]');
        if (await altBtn.isExisting()) {
          await altBtn.click();
          console.log('   ✅ Detailed button clicked (alternative)');
          await browser.pause(3000);
        } else {
          console.log('   ⚠️ Detailed button not found');
        }
      }
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
        await browser.switchToWindow(allHandles[allHandles.length - 1]);
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
   * Select an invoice by clicking its checkbox
   */
  async selectInvoice(invoiceId: string): Promise<void> {
    console.log(`📄 Selecting invoice: ${invoiceId}`);
    try {
      // Find the row with the matching invoice ID
      const rows = await $$('#s_5_l tbody tr:not(.jqgfirstrow)');
      
      for (const row of rows) {
        const idCell = await row.$('td[@aria-describedby="s_5_l_Invoice_Number"]');
        const rowId = await idCell.getText();
        
        if (rowId.trim() === invoiceId) {
          const checkbox = await row.$('input[type="checkbox"]');
          if (await checkbox.isExisting()) {
            await checkbox.click();
            console.log(`   ✅ Invoice ${invoiceId} selected`);
            await browser.pause(1000);
            return;
          }
        }
      }
      
      console.log(`   ⚠️ Could not find invoice: ${invoiceId}`);
    } catch (error) {
      console.log('   ⚠️ Could not select invoice:', error);
    }
  }

  /**
   * Select the latest invoice (most recent date)
   */
  async selectLatestInvoice(): Promise<void> {
    console.log('📄 Selecting latest invoice...');
    try {
      const invoiceRows = await $$('#s_5_l tbody tr:not(.jqgfirstrow)');
      
      for (const row of invoiceRows) {
        const checkbox = await row.$('input[type="checkbox"]');
        if (await checkbox.isExisting()) {
          await checkbox.click();
          console.log('   ✅ Invoice selected');
          await browser.pause(1000);
          return;
        }
      }
      
      console.log('   ⚠️ Could not select invoice (no checkbox found)');
    } catch (error) {
      console.log('   ⚠️ Could not select invoice:', error);
    }
  }

  /**
   * Complete navigation flow to Billing/Account
   */
  async navigateToBillingAccount(): Promise<void> {
    console.log('🚀 Navigating to Billing/Account...');
    
    // Step 1: Scroll to Billing/Account section
    await this.scrollToBillingAccountSection();
    
    // Step 2: Click the tab
    await this.clickBillingAccountTab();
    
    // Step 3: Wait for content to load
    await this.waitForInvoiceGridToLoad();
    
    // Step 4: Scroll to Invoice Details
    await this.scrollToInvoiceDetails();
    
    // Step 5: Verify invoice section
    await this.verifyInvoiceDetailsSection();
    
    console.log('✅ Successfully navigated to Billing/Account');
  }
}