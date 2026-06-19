// test/pages/SiebelInvoicePage.ts (NEEDS UPDATE)

import { browser, $, $$ } from '@wdio/globals';
import { SiebelSelectors } from '../utils/SiebelSelectors';
import { SiebelHelper } from '../utils/SiebelHelper';

export interface InvoiceRecord {
  invoiceDate: string;
  invoiceNumber: string;
  pdfUrl?: string;
}

export class SiebelInvoicePage {

  async clickDetailedViewButton(): Promise<void> {
    console.log('📄 Clicking Detailed View button...');
    await SiebelHelper.safeClick(SiebelSelectors.invoice.detailedViewButton);
    await browser.pause(3000);
  }

  async getInvoiceRows(): Promise<number> {
    const rows = await $$(SiebelSelectors.invoice.invoiceRows);
    let count = 0;
    for (const row of rows) {
      if (await row.isDisplayed()) {
        count++;
      }
    }
    return count;
  }

  async getInvoiceRecord(rowIndex: number): Promise<InvoiceRecord> {
    const dateSelector = SiebelSelectors.invoice.invoiceDateCell(rowIndex);
    const linkSelector = SiebelSelectors.invoice.invoiceLinkCell(rowIndex);

    const invoiceDate = await this.getCellText(dateSelector);
    let invoiceNumber = await this.getCellText(linkSelector);
    
    try {
      const linkElement = await $(linkSelector);
      const href = await linkElement.getAttribute('href');
      if (href) {
        invoiceNumber = href;
      }
    } catch (error) {
      // Ignore
    }

    return {
      invoiceDate: invoiceDate.trim(),
      invoiceNumber: invoiceNumber.trim(),
    };
  }

  async getLatestInvoice(): Promise<InvoiceRecord | null> {
    const rowCount = await this.getInvoiceRows();
    
    if (rowCount === 0) {
      console.log('No invoices found');
      return null;
    }

    const invoices: InvoiceRecord[] = [];
    for (let i = 1; i <= rowCount; i++) {
      try {
        const invoice = await this.getInvoiceRecord(i);
        invoices.push(invoice);
      } catch (error) {
        console.log(`Error reading invoice row ${i}: ${error}`);
      }
    }

    if (invoices.length === 0) return null;

    invoices.sort((a, b) => {
      const dateA = new Date(a.invoiceDate);
      const dateB = new Date(b.invoiceDate);
      return dateB.getTime() - dateA.getTime();
    });

    return invoices[0];
  }

  async clickInvoiceLink(rowIndex: number): Promise<void> {
    console.log(`📎 Clicking invoice link in row ${rowIndex}...`);
    const linkSelector = SiebelSelectors.invoice.invoiceLinkCell(rowIndex);
    await SiebelHelper.safeClick(linkSelector);
    await browser.pause(2000);
  }

  async openLatestInvoice(): Promise<string | null> {
    const latestInvoice = await this.getLatestInvoice();
    if (!latestInvoice) return null;

    console.log(`📑 Opening latest invoice from: ${latestInvoice.invoiceDate}`);
    
    const rowCount = await this.getInvoiceRows();
    for (let i = 1; i <= rowCount; i++) {
      const invoice = await this.getInvoiceRecord(i);
      if (invoice.invoiceDate === latestInvoice.invoiceDate) {
        await this.clickInvoiceLink(i);
        return invoice.invoiceNumber;
      }
    }

    return null;
  }

  async switchToNewTabAndGetPDF(): Promise<Buffer | null> {
    const originalWindow = await browser.getWindowHandle();
    const allWindows = await browser.getWindowHandles();
    
    for (const handle of allWindows) {
      if (handle !== originalWindow) {
        await browser.switchToWindow(handle);
        break;
      }
    }

    await browser.pause(3000);
    
    const currentUrl = await browser.getUrl();
    
    if (currentUrl.includes('.pdf')) {
      console.log(`📄 PDF URL: ${currentUrl}`);
      const pdfBuffer = await this.downloadPDF(currentUrl);
      await browser.closeWindow();
      await browser.switchToWindow(originalWindow);
      return pdfBuffer;
    }
    
    const pdfFrame = await $('iframe[src*=".pdf"], embed[src*=".pdf"]');
    if (await pdfFrame.isExisting()) {
      const pdfUrl = await pdfFrame.getAttribute('src');
      if (pdfUrl) {
        const pdfBuffer = await this.downloadPDF(pdfUrl);
        await browser.closeWindow();
        await browser.switchToWindow(originalWindow);
        return pdfBuffer;
      }
    }
    
    console.log('New tab does not contain a PDF');
    await browser.closeWindow();
    await browser.switchToWindow(originalWindow);
    return null;
  }

  private async downloadPDF(url: string): Promise<Buffer> {
    console.log(`Downloading PDF from: ${url}`);
    // Note: In actual implementation, you'd use fetch or axios
    // For now, return placeholder
    return Buffer.from('PDF content placeholder');
  }

  private async getCellText(selector: string): Promise<string> {
    try {
      const element = await $(selector);
      await element.waitForDisplayed({ timeout: 5000 });
      return await element.getText();
    } catch (error) {
      return '';
    }
  }

  async sortByInvoiceDateDescending(): Promise<void> {
    const dateHeader = await $(SiebelSelectors.invoice.invoiceDateHeader);
    await dateHeader.waitForClickable({ timeout: 5000 });
    await dateHeader.click();
    await browser.pause(1000);
    await dateHeader.click();
    await browser.pause(2000);
  }
}