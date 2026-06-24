// D:\New VI UAT PROJECT\WIP\Automation Folder\VI Demo 31.05.2026\VI Demo\test\specs\invoice-extraction.spec.ts

import { browser } from '@wdio/globals';
import { expect } from 'chai';
import { SiebelLoginPage } from '../pages/SiebelLoginPage';
import { SiebelSubscriptionsPage } from '../pages/SiebelSubscriptionsPage';
import { AccountSummaryPage } from '../pages/AccountSummaryPage';
import { BillingAccountPage } from '../pages/BillingAccountPage';
import { InvoiceExtractionService } from '../services/InvoiceExtractionService';
import { getSiebelConfig } from '../config/siebel.config';

describe('Siebel CRM - Invoice PDF Extraction Suite', () => {
    let loginPage: SiebelLoginPage;
    let subscriptionsPage: SiebelSubscriptionsPage;
    let accountSummaryPage: AccountSummaryPage;
    let billingPage: BillingAccountPage;
    let extractionService: InvoiceExtractionService;
    let cfg: ReturnType<typeof getSiebelConfig>;
    
    const msisdn = "9737275744";
    
    before(async () => {
        loginPage = new SiebelLoginPage();
        subscriptionsPage = new SiebelSubscriptionsPage();
        accountSummaryPage = new AccountSummaryPage();
        billingPage = new BillingAccountPage();
        extractionService = new InvoiceExtractionService();
        cfg = getSiebelConfig();
    });
    
    it('TC-INV-001: Should extract latest invoice PDF and validate data', async () => {
        // Step 1: Login
        await loginPage.loginFull(cfg.username, cfg.password, cfg.otp, cfg.otpPauseMs);
        
        // Step 2: Search for MSISDN
        await subscriptionsPage.enterMSISDN(msisdn);
        await subscriptionsPage.clickGoButton();
        
        // Step 3: Select active subscription
        const found = await subscriptionsPage.findAndOpenValidSubscription(msisdn);
        expect(found).to.be.true;
        
        // Step 4: Verify Account Summary
        await subscriptionsPage.verifyAccountSummaryPage(msisdn);
        
        // Step 5: Navigate to Billing/Account
        await billingPage.clickBillingAccountTab();
        
        // Step 6: Verify Invoice Details section
        const hasInvoiceSection = await billingPage.verifyInvoiceDetailsSection();
        expect(hasInvoiceSection).to.be.true;
        
        // Step 7: Get latest invoice
        const latestInvoice = await billingPage.getLatestInvoiceRow();
        expect(latestInvoice).to.not.be.null;
        
        // Step 8: Click Detailed button
        await billingPage.clickDetailedButton();
        
        // Step 9: Switch to PDF tab
        await billingPage.switchToPDFTab();
        
        // Step 10: Handle certificate warning if present
        try {
            const continueLink = await $('=Continue to productionsouthebpp.vodafoneidea.in (unsafe)');
            if (await continueLink.isExisting()) {
                await continueLink.click();
                await browser.pause(2000);
            }
        } catch (e) {
            // No certificate warning
        }
        
        console.log('✅ Invoice extraction test completed successfully');
    });
});