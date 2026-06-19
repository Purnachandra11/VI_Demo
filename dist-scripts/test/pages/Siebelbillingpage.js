"use strict";
// test/pages/Siebelbillingpage.ts (UPDATED)
Object.defineProperty(exports, "__esModule", { value: true });
exports.SiebelBillingPage = void 0;
const globals_1 = require("@wdio/globals");
const SiebelSelectors_1 = require("../utils/SiebelSelectors");
const SiebelHelper_1 = require("../utils/SiebelHelper");
const SiebelBillingPDFPage_1 = require("./SiebelBillingPDFPage");
class SiebelBillingPage {
    constructor() {
        this.pdfValidator = new SiebelBillingPDFPage_1.SiebelBillingPDFPage();
    }
    async clickBillingAccountTab() {
        console.log('💰 Clicking Billing/Account tab...');
        try {
            const billingTab = await (0, globals_1.$)(SiebelSelectors_1.SiebelSelectors.app.billingAndAccountTab);
            await billingTab.waitForClickable({ timeout: 15000 });
            await billingTab.click();
            await globals_1.browser.pause(3000);
            console.log('   ✅ Billing/Account tab clicked');
        }
        catch (error) {
            console.log('   ⚠️ Could not click Billing/Account tab, trying alternative...');
            await SiebelHelper_1.SiebelHelper.safeClick('//*[contains(text(), "Billing") or contains(text(), "Account")]');
            await globals_1.browser.pause(3000);
        }
    }
    async verifyInvoiceDetailsSection() {
        console.log('📋 Verifying Invoice Details section...');
        try {
            const invoiceSection = await (0, globals_1.$)('//*[contains(text(), "Invoice") or contains(text(), "Bill")]');
            const isDisplayed = await invoiceSection.isDisplayed();
            console.log(`   ✅ Invoice section ${isDisplayed ? 'found' : 'not found'}`);
            return isDisplayed;
        }
        catch (error) {
            console.log('   ⚠️ Invoice section not found');
            return false;
        }
    }
    async getLatestInvoiceRow() {
        console.log('🔍 Getting latest invoice...');
        try {
            // Look for invoice rows
            const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');
            for (const row of invoiceRows) {
                const rowClass = await row.getAttribute('class');
                if (rowClass === null || rowClass === void 0 ? void 0 : rowClass.includes('jqgfirstrow'))
                    continue;
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
        }
        catch (error) {
            console.log('   ⚠️ Could not fetch invoices:', error);
            return null;
        }
    }
    async selectLatestInvoice() {
        console.log('📄 Selecting latest invoice...');
        try {
            const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');
            for (const row of invoiceRows) {
                const rowClass = await row.getAttribute('class');
                if (rowClass === null || rowClass === void 0 ? void 0 : rowClass.includes('jqgfirstrow'))
                    continue;
                const checkbox = await row.$('input[type="checkbox"]');
                if (await checkbox.isExisting()) {
                    await checkbox.click();
                    console.log('   ✅ Invoice selected');
                    await globals_1.browser.pause(1000);
                    return;
                }
            }
            console.log('   ⚠️ Could not select invoice (no checkbox found)');
        }
        catch (error) {
            console.log('   ⚠️ Could not select invoice:', error);
        }
    }
    async clickDetailedButton() {
        console.log('🔍 Clicking Detailed button...');
        try {
            const detailedBtn = await (0, globals_1.$)(SiebelSelectors_1.SiebelSelectors.invoice.detailedViewButton);
            await detailedBtn.waitForClickable({ timeout: 10000 });
            await detailedBtn.click();
            console.log('   ✅ Detailed button clicked');
            await globals_1.browser.pause(3000);
        }
        catch (error) {
            console.log('   ⚠️ Could not click Detailed button:', error);
        }
    }
    async switchToPDFTab() {
        console.log('📑 Switching to PDF tab...');
        try {
            const allHandles = await globals_1.browser.getWindowHandles();
            if (allHandles.length > 1) {
                await globals_1.browser.switchToWindow(allHandles[1]);
                console.log('   ✅ Switched to new tab');
            }
            else {
                console.log('   ⚠️ No new tab detected');
            }
            await globals_1.browser.pause(2000);
        }
        catch (error) {
            console.log('   ⚠️ Could not switch tab:', error);
        }
    }
    async switchToInvoiceTab() {
        await this.switchToPDFTab();
    }
    async bypassCertificateWarning() {
        try {
            const continueLink = await (0, globals_1.$)('=Continue to productionsouthebpp.vodafoneidea.in (unsafe)');
            if (await continueLink.isExisting()) {
                await continueLink.click();
                await globals_1.browser.pause(2000);
                console.log('   ✅ Certificate warning bypassed');
            }
        }
        catch (error) {
            // No certificate warning
        }
    }
    /**
     * Main validation method - extracts and validates PDF invoice
     */
    async validateInvoicePDF(options) {
        console.log('\n🚀 Starting comprehensive PDF invoice validation...');
        // Ensure we're on the PDF tab
        await this.switchToPDFTab();
        await this.bypassCertificateWarning();
        // Wait for PDF to load
        await globals_1.browser.pause(5000);
        // Delegate to the PDF validator
        const result = await this.pdfValidator.validateInvoicePDF(options);
        return result;
    }
    /**
     * Helper method to take screenshot of current PDF view
     */
    async takePDFScreenshot(label) {
        return await SiebelHelper_1.SiebelHelper.screenshot(`PDF_${label}`);
    }
}
exports.SiebelBillingPage = SiebelBillingPage;
