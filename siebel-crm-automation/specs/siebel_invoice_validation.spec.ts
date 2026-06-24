// test/specs/siebel_invoice_validation.spec.ts
// Complete 6-Point Invoice Validation

import { browser } from '@wdio/globals';
import { expect } from 'chai';
import { SiebelLoginPage } from '../pages/SiebelLoginPage';
import { SiebelSubscriptionsPage } from '../pages/SiebelSubscriptionsPage';
import { SiebelBillingPage } from '../pages/Siebelbillingpage';
import { ExcelDataService, TestPlanRow } from '../services/ExcelDataService';
import { getSiebelConfig } from '../config/siebel.config';
import * as fs from 'fs';
import * as path from 'path';

// ─── Load test plans SYNCHRONOUSLY at module level ───────────────────────────
const cfg = getSiebelConfig();
const excelPath = path.join(process.cwd(), 'test_data', 'input_data.xlsx');

let testPlans: TestPlanRow[] = [];

if (fs.existsSync(excelPath)) {
    // Synchronous Excel read so it() blocks are registered before Mocha starts
    const XLSX = require('xlsx') as typeof import('xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets['Testplan'];
    if (sheet) {
        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, unknown>[];
        testPlans = rows.map(row => ({
            msisdn:             String(row['MSISDN']              ?? ''),
            username:           String(row['Username']            ?? '') || cfg.username,
            password:           String(row['Password']            ?? '') || cfg.password,
            planName:           String(row['Plan Name']           ?? ''),
            activationDate:     String(row['Activation Date']     ?? ''),
            activationTillDate: String(row['Activation Till Date'] ?? ''),
            invoiceDate:        String(row['Invoice Date']        ?? ''),
            calling:            row['Calling'] === 'Yes' ? 'Yes' as const : 'No' as const,
            sms:                row['SMS']     === 'Yes' ? 'Yes' as const : 'No' as const,
            data:               row['Data']    === 'Yes' ? 'Yes' as const : 'No' as const,
            usageDate1:         String(row['Usage Date 1']        ?? ''),
            usageDate2:         String(row['Usage Date 2']        ?? ''),
            usageDate3:         String(row['Usage Date 3']        ?? ''),
            expectedRental:     row['Expected Rental'] ? Number(row['Expected Rental']) : undefined,
            circle:             String(row['Circle']              ?? ''),
        }));
//          console.log(`📊 Loaded ${testPlans.length} test plan(s) from Excel`);
//     }
// }

// // Fall back to default if Excel missing or empty
// if (testPlans.length === 0) {
        console.log(`📊 Loaded ${testPlans.length} test plan(s) from Excel`); 
     } 
 } 
 
 // Deduplicate test plans by MSISDN to avoid redundant login/test runs
 if (testPlans.length > 0) {
     const uniquePlans = new Map<string, TestPlanRow>();
     testPlans.forEach(plan => {
         if (!uniquePlans.has(plan.msisdn)) {
             uniquePlans.set(plan.msisdn, plan);
         } else {
             console.log(`   ℹ️  Skipping duplicate MSISDN in Excel: ${plan.msisdn}`);
         }
     });
     testPlans = Array.from(uniquePlans.values());
 }
 
 // Fall back to default if Excel missing or empty 
 if (testPlans.length === 0) {
    console.log('⚠️  No Excel data — using default test plan');
    testPlans = [{
        username:           cfg.username,
        password:           cfg.password,
        msisdn:             '7434853216',
        planName:           'Vi Max Family 871',
        activationDate:     '15.05.26',
        activationTillDate: '14.05.26',
        invoiceDate:        '15.05.26',
        calling:            'Yes',
        sms:                'Yes',
        data:               'Yes',
        usageDate1:         '14.05.26',
        usageDate2:         '13.05.26',
        usageDate3:         '12.05.26',
        circle:             'Karnataka',
        expectedRental:     871,
    }];
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe('Siebel Invoice Validation - Complete 6-Point Validation', function () {
    this.timeout(600000);

    before(async function () {
        console.log('\n' + '='.repeat(80));
        console.log('📋 SIEBEL INVOICE VALIDATION SUITE - COMPLETE 6-POINT VALIDATION');
        console.log('='.repeat(80));
        console.log('   📌 POINT 1 — MSISDN, Plan Details & Current Cycle Amount');
        console.log('   📌 POINT 2 — Current Bill & Past Bill Summary');
        console.log('   📌 POINT 3 — Account Details');
        console.log('   📌 POINT 4 — Usage Details (Plan Rental, VAS, Itemised Calls)');
        console.log('   📌 POINT 5 — All Non-Zero Charges');
        console.log('   📌 POINT 6 — Breakup of Internet Usage, SMS, Calling by Date');
        console.log('='.repeat(80));
        console.log(`📊 Running ${testPlans.length} test plan(s)`);
        console.log('='.repeat(80));
    });

    // ── One it() per test plan — registered synchronously at module load ──────
    for (const testPlan of testPlans) {
        // Capture testPlan in closure explicitly
        const plan = testPlan;

        it(`[${plan.msisdn}] Complete Invoice Validation - ${plan.planName}`, async function () {
            const loginPage    = new SiebelLoginPage();
            const subsPage     = new SiebelSubscriptionsPage();
            const billingPage  = new SiebelBillingPage();

            console.log(`\n${'='.repeat(80)}`);
            console.log(`🔍 TEST CASE: ${plan.msisdn} | Plan: ${plan.planName}`);
            console.log(`   Calling: ${plan.calling} | SMS: ${plan.sms} | Data: ${plan.data}`);
            console.log(`   Usage Dates: ${[plan.usageDate1, plan.usageDate2, plan.usageDate3].filter(d => d).join(', ')}`);
            console.log(`${'='.repeat(80)}\n`);

            // Step 1-3: Login
            console.log('🔐 STEP 1-3: Siebel Login');
            await loginPage.loginFull(plan.username, plan.password, cfg.otp, cfg.otpPauseMs);
            console.log('✅ Login completed\n');

            // Step 4: Search MSISDN
            console.log('🔍 STEP 4: Search for MSISDN');
            await subsPage.enterMSISDN(plan.msisdn);
            await subsPage.clickGoButton();
            console.log('✅ MSISDN search completed\n');

            // Step 5: Navigate to Account Summary
            console.log('📱 STEP 5: Navigate to Account Summary');
            const resultPage = await subsPage.detectResultPage();

            if (resultPage === 'ACCOUNT_SUMMARY') {
                console.log('   Direct Account Summary - Case 5.1');
                await subsPage.verifyAccountSummaryPage(plan.msisdn);
            } else {
                console.log('   Subscription List - Case 5.2');
                const found = await subsPage.findAndOpenValidSubscription(plan.msisdn);
                expect(found).to.equal(true, `No active subscription found for ${plan.msisdn}`);
                await subsPage.verifyAccountSummaryPage(plan.msisdn);
            }
            console.log('✅ Account Summary verified\n');

            // Step 6: Navigate to Billing/Account
            console.log('💰 STEP 6: Navigate to Billing/Account Tab');
            await billingPage.clickBillingAccountTab();
            const hasInvoiceSection = await billingPage.verifyInvoiceDetailsSection();
            expect(hasInvoiceSection).to.equal(true, 'Invoice Details section not found');
            console.log('✅ Billing/Account tab loaded\n');

            // Step 7: Open and Validate Invoice PDF
            console.log('📄 STEP 7: Open and Validate Invoice PDF');

            const latestInvoice = await billingPage.getLatestInvoiceRow();
            expect(latestInvoice).to.not.be.null;
            console.log(`   Latest invoice: ${latestInvoice!.invoiceId} | Date: ${latestInvoice!.date}`);

            await billingPage.selectLatestInvoice();
            await billingPage.clickDetailedButton();

            const usageDates = [plan.usageDate1, plan.usageDate2, plan.usageDate3]
                .filter((d): d is string => !!d && d.trim().length > 0);

            console.log('\n📊 Starting COMPREHENSIVE 6-POINT PDF VALIDATION...\n');

            const invoiceData = await billingPage.validateInvoicePDF({
                msisdn:          plan.msisdn,
                planName:        plan.planName,
                expectedRental:  plan.expectedRental,
                usageDates,
                expectedCalling: plan.calling === 'Yes',
                expectedSMS:     plan.sms     === 'Yes',
                expectedData:    plan.data    === 'Yes',
            });

            console.log('\n' + '='.repeat(80));
            console.log('📊 VALIDATION RESULTS');
            console.log('='.repeat(80));
            console.log(`   Mobile Number Match : ${invoiceData.validations.mobileNumberMatch}`);
            console.log(`   Plan Name Match     : ${invoiceData.validations.planNameMatch}`);
            console.log(`   Rental Match        : ${invoiceData.validations.rentalMatch}`);
            console.log(`   Calling Usage       : ${invoiceData.validations.callingUsagePresent}`);
            console.log(`   SMS Usage           : ${invoiceData.validations.smsUsagePresent}`);
            console.log(`   Data Usage          : ${invoiceData.validations.dataUsagePresent}`);
            console.log(`   Report              : ${invoiceData.reportPath}`);
            console.log(`   Screenshots         : ${invoiceData.screenshots.length}`);
            console.log('='.repeat(80));

            expect(invoiceData.validations.mobileNumberMatch,
                `Mobile number mismatch: Expected ${plan.msisdn}, Got ${invoiceData.mobileNumber}`)
                .to.equal(true);
            expect(invoiceData.validations.planNameMatch,
                `Plan name mismatch: Expected ${plan.planName}, Got ${invoiceData.planName}`)
                .to.equal(true);

            if (plan.calling === 'Yes') {
                expect(invoiceData.validations.callingUsagePresent,
                    `Calling usage expected but not found for ${plan.msisdn}`)
                    .to.equal(true);
            }
            if (plan.sms === 'Yes') {
                expect(invoiceData.validations.smsUsagePresent,
                    `SMS usage expected but not found for ${plan.msisdn}`)
                    .to.equal(true);
            }
            if (plan.data === 'Yes') {
                expect(invoiceData.validations.dataUsagePresent,
                    `Data usage expected but not found for ${plan.msisdn}`)
                    .to.equal(true);
            }

            console.log(`\n✅ All validations PASSED for ${plan.msisdn}`);
        });
    }

    after(async () => {
        console.log('\n' + '='.repeat(80));
        console.log('🎉 INVOICE VALIDATION SUITE COMPLETED');
        console.log('='.repeat(80));
        console.log('   📁 Screenshots : ./screenshots/invoice/');
        console.log('   📁 Reports     : ./reports/invoice/');
        console.log('='.repeat(80));
    });
});
