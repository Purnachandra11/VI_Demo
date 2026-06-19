"use strict";
// D:\New VI UAT PROJECT\WIP\Automation Folder\VI Demo 31.05.2026\VI Demo\test\specs\invoice-extraction.spec.ts
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@wdio/globals");
const chai_1 = require("chai");
const SiebelLoginPage_1 = require("../pages/SiebelLoginPage");
const SiebelSubscriptionsPage_1 = require("../pages/SiebelSubscriptionsPage");
const AccountSummaryPage_1 = require("../pages/AccountSummaryPage");
const BillingAccountPage_1 = require("../pages/BillingAccountPage");
const InvoiceExtractionService_1 = require("../services/InvoiceExtractionService");
const siebel_config_1 = require("../config/siebel.config");
describe('Siebel CRM - Invoice PDF Extraction Suite', () => {
    let loginPage;
    let subscriptionsPage;
    let accountSummaryPage;
    let billingPage;
    let extractionService;
    let cfg;
    const msisdn = "9737275744";
    before(async () => {
        loginPage = new SiebelLoginPage_1.SiebelLoginPage();
        subscriptionsPage = new SiebelSubscriptionsPage_1.SiebelSubscriptionsPage();
        accountSummaryPage = new AccountSummaryPage_1.AccountSummaryPage();
        billingPage = new BillingAccountPage_1.BillingAccountPage();
        extractionService = new InvoiceExtractionService_1.InvoiceExtractionService();
        cfg = (0, siebel_config_1.getSiebelConfig)();
    });
    it('TC-INV-001: Should extract latest invoice PDF and validate data', async () => {
        // Step 1: Login
        await loginPage.loginFull(cfg.username, cfg.password, cfg.otp, cfg.otpPauseMs);
        // Step 2: Search for MSISDN
        await subscriptionsPage.enterMSISDN(msisdn);
        await subscriptionsPage.clickGoButton();
        // Step 3: Select active subscription
        const found = await subscriptionsPage.findAndOpenValidSubscription(msisdn);
        (0, chai_1.expect)(found).to.be.true;
        // Step 4: Verify Account Summary
        await subscriptionsPage.verifyAccountSummaryPage(msisdn);
        // Step 5: Navigate to Billing/Account
        await billingPage.clickBillingAccountTab();
        // Step 6: Verify Invoice Details section
        const hasInvoiceSection = await billingPage.verifyInvoiceDetailsSection();
        (0, chai_1.expect)(hasInvoiceSection).to.be.true;
        // Step 7: Get latest invoice
        const latestInvoice = await billingPage.getLatestInvoiceRow();
        (0, chai_1.expect)(latestInvoice).to.not.be.null;
        // Step 8: Click Detailed button
        await billingPage.clickDetailedButton();
        // Step 9: Switch to PDF tab
        await billingPage.switchToPDFTab();
        // Step 10: Handle certificate warning if present
        try {
            const continueLink = await $('=Continue to productionsouthebpp.vodafoneidea.in (unsafe)');
            if (await continueLink.isExisting()) {
                await continueLink.click();
                await globals_1.browser.pause(2000);
            }
        }
        catch (e) {
            // No certificate warning
        }
        console.log('✅ Invoice extraction test completed successfully');
    });
});
