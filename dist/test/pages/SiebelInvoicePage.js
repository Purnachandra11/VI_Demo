"use strict";
// test/pages/SiebelInvoicePage.ts (NEEDS UPDATE)
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelInvoicePage = void 0;
const globals_1 = require("@wdio/globals");
const SiebelSelectors_1 = require("../utils/SiebelSelectors");
const SiebelHelper_1 = require("../utils/SiebelHelper");
class SiebelInvoicePage {
    async clickDetailedViewButton() {
        console.log('📄 Clicking Detailed View button...');
        await SiebelHelper_1.SiebelHelper.safeClick(SiebelSelectors_1.SiebelSelectors.invoice.detailedViewButton);
        await globals_1.browser.pause(3000);
    }
    async getInvoiceRows() {
        const rows = await (0, globals_1.$$)(SiebelSelectors_1.SiebelSelectors.invoice.invoiceRows);
        let count = 0;
        for (const row of rows) {
            if (await row.isDisplayed()) {
                count++;
            }
        }
        return count;
    }
    async getInvoiceRecord(rowIndex) {
        const dateSelector = SiebelSelectors_1.SiebelSelectors.invoice.invoiceDateCell(rowIndex);
        const linkSelector = SiebelSelectors_1.SiebelSelectors.invoice.invoiceLinkCell(rowIndex);
        const invoiceDate = await this.getCellText(dateSelector);
        let invoiceNumber = await this.getCellText(linkSelector);
        try {
            const linkElement = await (0, globals_1.$)(linkSelector);
            const href = await linkElement.getAttribute('href');
            if (href) {
                invoiceNumber = href;
            }
        }
        catch (error) {
            // Ignore
        }
        return {
            invoiceDate: invoiceDate.trim(),
            invoiceNumber: invoiceNumber.trim(),
        };
    }
    async getLatestInvoice() {
        const rowCount = await this.getInvoiceRows();
        if (rowCount === 0) {
            console.log('No invoices found');
            return null;
        }
        const invoices = [];
        for (let i = 1; i <= rowCount; i++) {
            try {
                const invoice = await this.getInvoiceRecord(i);
                invoices.push(invoice);
            }
            catch (error) {
                console.log(`Error reading invoice row ${i}: ${error}`);
            }
        }
        if (invoices.length === 0)
            return null;
        invoices.sort((a, b) => {
            const dateA = new Date(a.invoiceDate);
            const dateB = new Date(b.invoiceDate);
            return dateB.getTime() - dateA.getTime();
        });
        return invoices[0];
    }
    async clickInvoiceLink(rowIndex) {
        console.log(`📎 Clicking invoice link in row ${rowIndex}...`);
        const linkSelector = SiebelSelectors_1.SiebelSelectors.invoice.invoiceLinkCell(rowIndex);
        await SiebelHelper_1.SiebelHelper.safeClick(linkSelector);
        await globals_1.browser.pause(2000);
    }
    async openLatestInvoice() {
        const latestInvoice = await this.getLatestInvoice();
        if (!latestInvoice)
            return null;
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
    async switchToNewTabAndGetPDF() {
        const originalWindow = await globals_1.browser.getWindowHandle();
        const allWindows = await globals_1.browser.getWindowHandles();
        for (const handle of allWindows) {
            if (handle !== originalWindow) {
                await globals_1.browser.switchToWindow(handle);
                break;
            }
        }
        await globals_1.browser.pause(3000);
        const currentUrl = await globals_1.browser.getUrl();
        if (currentUrl.includes('.pdf')) {
            console.log(`📄 PDF URL: ${currentUrl}`);
            const pdfBuffer = await this.downloadPDF(currentUrl);
            await globals_1.browser.closeWindow();
            await globals_1.browser.switchToWindow(originalWindow);
            return pdfBuffer;
        }
        const pdfFrame = await (0, globals_1.$)('iframe[src*=".pdf"], embed[src*=".pdf"]');
        if (await pdfFrame.isExisting()) {
            const pdfUrl = await pdfFrame.getAttribute('src');
            if (pdfUrl) {
                const pdfBuffer = await this.downloadPDF(pdfUrl);
                await globals_1.browser.closeWindow();
                await globals_1.browser.switchToWindow(originalWindow);
                return pdfBuffer;
            }
        }
        console.log('New tab does not contain a PDF');
        await globals_1.browser.closeWindow();
        await globals_1.browser.switchToWindow(originalWindow);
        return null;
    }
    async downloadPDF(url) {
        console.log(`Downloading PDF from: ${url}`);
        // Note: In actual implementation, you'd use fetch or axios
        // For now, return placeholder
        return Buffer.from('PDF content placeholder');
    }
    async getCellText(selector) {
        try {
            const element = await (0, globals_1.$)(selector);
            await element.waitForDisplayed({ timeout: 5000 });
            return await element.getText();
        }
        catch (error) {
            return '';
        }
    }
    async sortByInvoiceDateDescending() {
        const dateHeader = await (0, globals_1.$)(SiebelSelectors_1.SiebelSelectors.invoice.invoiceDateHeader);
        await dateHeader.waitForClickable({ timeout: 5000 });
        await dateHeader.click();
        await globals_1.browser.pause(1000);
        await dateHeader.click();
        await globals_1.browser.pause(2000);
    }
}
exports.SiebelInvoicePage = SiebelInvoicePage;
