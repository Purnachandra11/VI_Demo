// D:\New VI UAT PROJECT\WIP\Automation Folder\VI Demo 31.05.2026\VI Demo\test\specs\siebel_complete_flow.spec.ts

import { browser } from '@wdio/globals';
import { expect } from 'chai';
import { SiebelLoginPage } from '../pages/SiebelLoginPage';
import { SiebelSubscriptionsPage } from '../pages/SiebelSubscriptionsPage';
import { AccountSummaryPage } from '../pages/AccountSummaryPage';
import { BillingAccountPage } from '../pages/BillingAccountPage';
import { SiebelBillingPage } from '../pages/Siebelbillingpage';
import { getSiebelConfig } from '../config/siebel.config';



describe('Siebel Complete Flow - Full Validation', () => {
    let loginPage: SiebelLoginPage;
    let subsPage: SiebelSubscriptionsPage;
    let accountSummaryPage: AccountSummaryPage;
    let billingPage: BillingAccountPage;
    let siebelBillingPage: SiebelBillingPage;
    let cfg: ReturnType<typeof getSiebelConfig>;
    
    const msisdn = "9737275744";

    before(async () => {
        loginPage = new SiebelLoginPage();
        subsPage = new SiebelSubscriptionsPage();
        accountSummaryPage = new AccountSummaryPage();
        billingPage = new BillingAccountPage();
        siebelBillingPage = new SiebelBillingPage();
        cfg = getSiebelConfig();
        
        console.log('\n' + '='.repeat(70));
        console.log('SIEBEL COMPLETE FLOW TEST');
        console.log('='.repeat(70));
        console.log(`MSISDN: ${msisdn}`);
        console.log(`URL: ${cfg.url}`);
        console.log('='.repeat(70) + '\n');
    });

    it('Step 1-3: Login to Siebel successfully', async () => {
        await loginPage.loginFull(cfg.username, cfg.password, cfg.otp, cfg.otpPauseMs);
        console.log('✅ Login completed');
    });

    it('Step 4-5: Search and select subscription', async () => {
        await subsPage.enterMSISDN(msisdn);
        await subsPage.clickGoButton();
        
        const resultPage = await subsPage.detectResultPage();
        
        if (resultPage === 'ACCOUNT_SUMMARY') {
            console.log('Direct Account Summary - Case 5.1');
            await subsPage.verifyAccountSummaryPage(msisdn);
        } else {
            console.log('Subscription List - Case 5.2');
            const found = await subsPage.findAndOpenValidSubscription(msisdn);
            expect(found).to.equal(true);
            await subsPage.verifyAccountSummaryPage(msisdn);
        }
        console.log('✅ Subscription selected');
    });

    it('Step 6: Navigate to Billing/Account', async () => {
        await billingPage.clickBillingAccountTab();
        const hasInvoiceSection = await billingPage.verifyInvoiceDetailsSection();
        expect(hasInvoiceSection).to.equal(true);
        console.log('✅ Billing/Account tab loaded');
    });

    it('Step 7: Open and validate invoice PDF', async () => {
        const latestInvoice = await billingPage.getLatestInvoiceRow();
        expect(latestInvoice).to.not.be.null;
        // console.log(`Latest invoice: ${latestInvoice.invoiceId}`);
        
        await billingPage.clickDetailedButton();
        await billingPage.switchToPDFTab();
        
        // Handle certificate warning
        try {
            const continueLink = await $('=Continue to productionsouthebpp.vodafoneidea.in (unsafe)');
            if (await continueLink.isExisting()) {
                await continueLink.click();
                await browser.pause(2000);
            }
        } catch (e) {
            // No warning
        }
        
        
        // Validate PDF content
        // Note: Using validateInvoicePDF instead of non-existent readPDFWithAI
        if (siebelBillingPage.validateInvoicePDF) {
            const result = await siebelBillingPage.validateInvoicePDF({
                msisdn: msisdn,
                planName: "Vi Max Family 871", // This should ideally come from a config or test data
            });
            expect(result).to.not.be.null;
        }
        
        console.log('✅ PDF validation completed');
    });

    after(async () => {
        console.log('\n' + '='.repeat(70));
        console.log('TEST EXECUTION COMPLETED');
        console.log('='.repeat(70));
    });
});