"use strict";
// test/specs/siebel_invoice_validation.spec.ts
// Complete 6-Point Invoice Validation
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const chai_1 = require("chai");
const SiebelLoginPage_1 = require("../pages/SiebelLoginPage");
const SiebelSubscriptionsPage_1 = require("../pages/SiebelSubscriptionsPage");
const Siebelbillingpage_1 = require("../pages/Siebelbillingpage");
const siebel_config_1 = require("../config/siebel.config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ─── Load test plans SYNCHRONOUSLY at module level ───────────────────────────
// The for-loop pattern only works if testPlans is populated before describe()
// runs. We do that here synchronously so Mocha sees the it() blocks.
const cfg = (0, siebel_config_1.getSiebelConfig)();
const excelPath = path.join(process.cwd(), 'test', 'test_data', 'input_data.xlsx');
let testPlans = [];
if (fs.existsSync(excelPath)) {
    // Synchronous Excel read so it() blocks are registered before Mocha starts
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(excelPath);
    const sheet = workbook.Sheets['Testplan'];
    if (sheet) {
        const rows = XLSX.utils.sheet_to_json(sheet);
        testPlans = rows.map(row => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            return ({
                msisdn: String((_a = row['MSISDN']) !== null && _a !== void 0 ? _a : ''),
                username: String((_b = row['Username']) !== null && _b !== void 0 ? _b : '') || cfg.username,
                password: String((_c = row['Password']) !== null && _c !== void 0 ? _c : '') || cfg.password,
                planName: String((_d = row['Plan Name']) !== null && _d !== void 0 ? _d : ''),
                activationDate: String((_e = row['Activation Date']) !== null && _e !== void 0 ? _e : ''),
                activationTillDate: String((_f = row['Activation Till Date']) !== null && _f !== void 0 ? _f : ''),
                invoiceDate: String((_g = row['Invoice Date']) !== null && _g !== void 0 ? _g : ''),
                calling: row['Calling'] === 'Yes' ? 'Yes' : 'No',
                sms: row['SMS'] === 'Yes' ? 'Yes' : 'No',
                data: row['Data'] === 'Yes' ? 'Yes' : 'No',
                usageDate1: String((_h = row['Usage Date 1']) !== null && _h !== void 0 ? _h : ''),
                usageDate2: String((_j = row['Usage Date 2']) !== null && _j !== void 0 ? _j : ''),
                usageDate3: String((_k = row['Usage Date 3']) !== null && _k !== void 0 ? _k : ''),
                expectedRental: row['Expected Rental'] ? Number(row['Expected Rental']) : undefined,
                circle: String((_l = row['Circle']) !== null && _l !== void 0 ? _l : ''),
            });
        });
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
    const uniquePlans = new Map();
    testPlans.forEach(plan => {
        if (!uniquePlans.has(plan.msisdn)) {
            uniquePlans.set(plan.msisdn, plan);
        }
        else {
            console.log(`   ℹ️  Skipping duplicate MSISDN in Excel: ${plan.msisdn}`);
        }
    });
    testPlans = Array.from(uniquePlans.values());
}
// Fall back to default if Excel missing or empty 
if (testPlans.length === 0) {
    console.log('⚠️  No Excel data — using default test plan');
    testPlans = [{
            username: cfg.username,
            password: cfg.password,
            msisdn: '7434853216',
            planName: 'Vi Max Family 871',
            activationDate: '15.05.26',
            activationTillDate: '14.05.26',
            invoiceDate: '15.05.26',
            calling: 'Yes',
            sms: 'Yes',
            data: 'Yes',
            usageDate1: '14.05.26',
            usageDate2: '13.05.26',
            usageDate3: '12.05.26',
            circle: 'Karnataka',
            expectedRental: 871,
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
            const loginPage = new SiebelLoginPage_1.SiebelLoginPage();
            const subsPage = new SiebelSubscriptionsPage_1.SiebelSubscriptionsPage();
            const billingPage = new Siebelbillingpage_1.SiebelBillingPage();
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
            }
            else {
                console.log('   Subscription List - Case 5.2');
                const found = await subsPage.findAndOpenValidSubscription(plan.msisdn);
                (0, chai_1.expect)(found).to.equal(true, `No active subscription found for ${plan.msisdn}`);
                await subsPage.verifyAccountSummaryPage(plan.msisdn);
            }
            console.log('✅ Account Summary verified\n');
            // Step 6: Navigate to Billing/Account
            console.log('💰 STEP 6: Navigate to Billing/Account Tab');
            await billingPage.clickBillingAccountTab();
            const hasInvoiceSection = await billingPage.verifyInvoiceDetailsSection();
            (0, chai_1.expect)(hasInvoiceSection).to.equal(true, 'Invoice Details section not found');
            console.log('✅ Billing/Account tab loaded\n');
            // Step 7: Open and Validate Invoice PDF
            console.log('📄 STEP 7: Open and Validate Invoice PDF');
            const latestInvoice = await billingPage.getLatestInvoiceRow();
            (0, chai_1.expect)(latestInvoice).to.not.be.null;
            console.log(`   Latest invoice: ${latestInvoice.invoiceId} | Date: ${latestInvoice.date}`);
            await billingPage.selectLatestInvoice();
            await billingPage.clickDetailedButton();
            const usageDates = [plan.usageDate1, plan.usageDate2, plan.usageDate3]
                .filter((d) => !!d && d.trim().length > 0);
            console.log('\n📊 Starting COMPREHENSIVE 6-POINT PDF VALIDATION...\n');
            const invoiceData = await billingPage.validateInvoicePDF({
                msisdn: plan.msisdn,
                planName: plan.planName,
                expectedRental: plan.expectedRental,
                usageDates,
                expectedCalling: plan.calling === 'Yes',
                expectedSMS: plan.sms === 'Yes',
                expectedData: plan.data === 'Yes',
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
            (0, chai_1.expect)(invoiceData.validations.mobileNumberMatch, `Mobile number mismatch: Expected ${plan.msisdn}, Got ${invoiceData.mobileNumber}`)
                .to.equal(true);
            (0, chai_1.expect)(invoiceData.validations.planNameMatch, `Plan name mismatch: Expected ${plan.planName}, Got ${invoiceData.planName}`)
                .to.equal(true);
            if (plan.calling === 'Yes') {
                (0, chai_1.expect)(invoiceData.validations.callingUsagePresent, `Calling usage expected but not found for ${plan.msisdn}`)
                    .to.equal(true);
            }
            if (plan.sms === 'Yes') {
                (0, chai_1.expect)(invoiceData.validations.smsUsagePresent, `SMS usage expected but not found for ${plan.msisdn}`)
                    .to.equal(true);
            }
            if (plan.data === 'Yes') {
                (0, chai_1.expect)(invoiceData.validations.dataUsagePresent, `Data usage expected but not found for ${plan.msisdn}`)
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
