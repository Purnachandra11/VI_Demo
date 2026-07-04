// test/pages/Siebelbillingpage.ts (UPDATED)

import { browser, $ } from '@wdio/globals';
import { SiebelSelectors } from '../utils/SiebelSelectors';
import { SiebelHelper } from '../utils/SiebelHelper';
import { SiebelBillingPDFPage, PDFValidationOptions } from './SiebelBillingPDFPage';
import { InvoicePDFValidationResult } from '../types/invoice.types';

export class SiebelBillingPage {
    private pdfValidator: SiebelBillingPDFPage;

    constructor() {
        this.pdfValidator = new SiebelBillingPDFPage();
    }

    // async clickBillingAccountTab(): Promise<void> {
    //     console.log('💰 Clicking Billing/Account tab...');
    //     try {
    //         const billingTab = await $(SiebelSelectors.app.billingAndAccountTab);
    //         await billingTab.waitForClickable({ timeout: 15000 });
    //         await billingTab.click();
    //         await browser.pause(3000);
    //         console.log('   ✅ Billing/Account tab clicked');
    //     } catch (error) {
    //         console.log('   ⚠️ Could not click Billing/Account tab, trying alternative...');
    //         await SiebelHelper.safeClick('//*[contains(text(), "Billing") or contains(text(), "Account")]');
    //         await browser.pause(3000);
    //     }
    // }
    async clickBillingAccountTab(): Promise<void> {
    console.log('💰 Verifying and clicking Billing/Account tab...');

    // Scope to the 3rd-level nav bar container you identified: #s_vctrl_div
    const containerSelector = '#s_vctrl_div';

    try {
        const container = await $(containerSelector);
        await container.waitForExist({ timeout: 15000 });

        // Verify the tab exists inside this container by its stable text
        // (IDs like ui-id-220 / ui-id-244 are regenerated per Siebel session,
        // so we anchor on text + container instead of a hardcoded id)
        const billingTab = await container.$('a.ui-tabs-anchor=Billing/Account');
        await billingTab.waitForClickable({
            timeout: 15000,
            timeoutMsg: 'Billing/Account tab not clickable inside #s_vctrl_div after 15s'
        });

        console.log('   ✅ Billing/Account tab verified');
        await billingTab.click();

        // Wait for the page refresh Siebel does after this tab click
        await browser.pause(3000);
        await browser.waitUntil(
            async () => {
                const loading = await $$('//div[contains(@class,"loading")]');
                const visible = await Promise.all(loading.map(el => el.isDisplayed()));
                return !visible.some(v => v === true);
            },
            { timeout: 20000, timeoutMsg: 'Page still loading after Billing/Account click' }
        );

        console.log('   ✅ Billing/Account tab clicked, page refreshed');

    } catch (error) {
        console.log('   ⚠️ Container-scoped click failed, trying direct id="ui-id-244" (session-specific)...');
        try {
            const postClickTab = await $('#ui-id-244');
            await postClickTab.waitForClickable({ timeout: 10000 });
            await postClickTab.click();
            await browser.pause(3000);
            console.log('   ✅ Billing/Account tab clicked via id="ui-id-244"');
        } catch (fallbackError) {
            console.log('   ❌ Both strategies failed to click Billing/Account tab');
            throw fallbackError;
        }
    }

    // Verify Invoice Details section after refresh
    await this.verifyInvoiceDetailsTitle();
}

async verifyInvoiceDetailsTitle(): Promise<boolean> {
    console.log('📋 Verifying "Invoice Details" title...');
    try {
        const titleByXpath = await $('//*[@id="a_5"]/div[1]/div[1]');
        await titleByXpath.waitForDisplayed({ timeout: 15000 });
        const text = await titleByXpath.getText();

        const isMatch = text.trim().toLowerCase().includes('invoice details');
        console.log(`   ${isMatch ? '✅' : '⚠️'} Invoice Details title text: "${text}"`);
        return isMatch;
    } catch (error) {
        console.log('   ⚠️ Invoice Details title not found at //*[@id="a_5"]/div[1]/div[1], trying class fallback...');
        try {
            const byClass = await $('.siebui-applet-title=Invoice Details');
            await byClass.waitForDisplayed({ timeout: 10000 });
            console.log('   ✅ Invoice Details title found via class fallback');
            return true;
        } catch {
            console.log('   ❌ Invoice Details section not found');
            return false;
        }
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

    // async getLatestInvoiceRow(): Promise<{ invoiceId: string; date: string } | null> {
    //     console.log('🔍 Getting latest invoice...');
    //     try {
    //         // Look for invoice rows
    //         const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');
            
    //         for (const row of invoiceRows) {
    //             const rowClass = await row.getAttribute('class');
    //             if (rowClass?.includes('jqgfirstrow')) continue;
                
    //             const dateCell = await row.$('td[@aria-describedby="s_5_l_Statement_Date"]');
    //             const date = await dateCell.getText();
                
    //             const invoiceCell = await row.$('td[@aria-describedby="s_5_l_Invoice_Number"]');
    //             const invoiceId = await invoiceCell.getText();
                
    //             if (invoiceId && invoiceId.trim()) {
    //                 console.log(`   ✅ Found invoice: ${invoiceId} | Date: ${date}`);
    //                 return { invoiceId: invoiceId.trim(), date: date.trim() };
    //             }
    //         }
            
    //         console.log('   ⚠️ No invoices found');
    //         return null;
    //     } catch (error) {
    //         console.log('   ⚠️ Could not fetch invoices:', error);
    //         return null;
    //     }
    // }
    async getLatestInvoiceRow(): Promise<{ invoiceId: string; date: string } | null> {
    console.log('🔍 Getting latest invoice...');
    try {
        const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');

        for (const row of invoiceRows) {
            const rowClass = await row.getAttribute('class');
            if (rowClass?.includes('jqgfirstrow')) continue;

            const dateCell = await row.$('td[id$="_s_5_l_Invoice_Date"]');
            const date = await dateCell.getText();

            const idCell = await row.$('td[id$="_s_5_l_Invoice_Id"]');
            const invoiceId = await idCell.getText();

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

    // async selectLatestInvoice(): Promise<void> {
    //     console.log('📄 Selecting latest invoice...');
    //     try {
    //         const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');
            
    //         for (const row of invoiceRows) {
    //             const rowClass = await row.getAttribute('class');
    //             if (rowClass?.includes('jqgfirstrow')) continue;
                
    //             const checkbox = await row.$('input[type="checkbox"]');
    //             if (await checkbox.isExisting()) {
    //                 await checkbox.click();
    //                 console.log('   ✅ Invoice selected');
    //                 await browser.pause(1000);
    //                 return;
    //             }
    //         }
            
    //         console.log('   ⚠️ Could not select invoice (no checkbox found)');
    //     } catch (error) {
    //         console.log('   ⚠️ Could not select invoice:', error);
    //     }
    // }
    async selectLatestInvoice(): Promise<void> {
    console.log('📄 Selecting latest invoice...');
    try {
        const invoiceRows = await $$('//*[@id="s_5_l"]/tbody/tr');

        for (const row of invoiceRows) {
            const rowClass = await row.getAttribute('class');
            if (rowClass?.includes('jqgfirstrow')) continue;

            const idCell = await row.$('td[id$="_s_5_l_Invoice_Id"]');
            if (await idCell.isExisting()) {
                await idCell.click(); // selects the jqGrid row via cell click
                console.log('   ✅ Invoice selected');
                await browser.pause(1000);
                return;
            }
        }

        console.log('   ⚠️ Could not select invoice (no row found)');
    } catch (error) {
        console.log('   ⚠️ Could not select invoice:', error);
    }
}

    async clickDetailedButton(): Promise<void> {
        console.log('🔍 Clicking Detailed button...');
        try {
            const detailedBtn = await $(SiebelSelectors.invoice.detailedViewButton);
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

    async switchToInvoiceTab(): Promise<void> {
        await this.switchToPDFTab();
    }

    async bypassCertificateWarning(): Promise<void> {
        try {
            const continueLink = await $('=Continue to productionsouthebpp.vodafoneidea.in (unsafe)');
            if (await continueLink.isExisting()) {
                await continueLink.click();
                await browser.pause(2000);
                console.log('   ✅ Certificate warning bypassed');
            }
        } catch (error) {
            // No certificate warning
        }
    }

    /**
     * Main validation method - extracts and validates PDF invoice
     */
    async validateInvoicePDF(options: PDFValidationOptions): Promise<InvoicePDFValidationResult> {
        console.log('\n🚀 Starting comprehensive PDF invoice validation...');
        
        // Ensure we're on the PDF tab
        await this.switchToPDFTab();
        await this.bypassCertificateWarning();
        
        // Wait for PDF to load
        await browser.pause(5000);
        
        // Delegate to the PDF validator
        const result = await this.pdfValidator.validateInvoicePDF(options);
        
        return result;
    }

    /**
     * Helper method to take screenshot of current PDF view
     */
    async takePDFScreenshot(label: string): Promise<string> {
        return await SiebelHelper.screenshot(`PDF_${label}`);
    }
}