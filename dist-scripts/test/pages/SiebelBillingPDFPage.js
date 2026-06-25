"use strict";
// test/pages/SiebelBillingPDFPage.ts
// New file - Handles PDF extraction and validation for all 6 points
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
exports.SiebelBillingPDFPage = void 0;
const globals_1 = require("@wdio/globals");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const PDFReader_1 = require("../utils/PDFReader");
const SiebelHelper_1 = require("../utils/SiebelHelper");
class SiebelBillingPDFPage {
    constructor() {
        this.pdfReader = new PDFReader_1.PDFReader();
        this.screenshotDir = path.join(process.cwd(), 'screenshots', 'invoice');
        this.reportDir = path.join(process.cwd(), 'reports', 'invoice');
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir, { recursive: true });
        }
    }
    /**
     * Main entry point - extract and validate PDF invoice
     */
    async validateInvoicePDF(options) {
        console.log('\n' + '='.repeat(80));
        console.log(`📄 VALIDATING INVOICE - MSISDN: ${options.msisdn}`);
        console.log('='.repeat(80));
        const screenshots = [];
        const result = {
            mobileNumber: '',
            planName: '',
            planRental: 0,
            billCycle: '',
            totalAmountDue: 0,
            currentBill: 0,
            pastBills: [],
            customerName: '',
            accountNumber: '',
            billingAddress: '',
            gstNumber: '',
            dueDate: '',
            planRentalDetails: [],
            vasCharges: [],
            itemisedCalls: [],
            allCharges: [],
            dataUsageByDate: {},
            smsUsageByDate: {},
            callUsageByDate: {},
            dataTotalKB: {},
            dataTotalCharges: {},
            smsTotalCharges: {},
            callTotalCharges: {},
            validations: {
                mobileNumberMatch: false,
                planNameMatch: false,
                rentalMatch: false,
                callingUsagePresent: false,
                smsUsagePresent: false,
                dataUsagePresent: false,
                chargesNonZero: true,
                usageDatesFound: []
            },
            screenshots: [],
            reportPath: ''
        };
        try {
            // Wait for PDF to load and get page content
            await globals_1.browser.pause(3000);
            // Take screenshot of full PDF page
            const fullScreenshot = await SiebelHelper_1.SiebelHelper.screenshot('POINT_1_2_3_Full_PDF_Header');
            screenshots.push(fullScreenshot);
            // Extract text from PDF (via DOM if PDF embedded, or via download)
            let pdfText = await this.extractPDFText();
            if (!pdfText) {
                console.log('⚠️ Could not extract text directly, trying alternative method...');
                pdfText = await this.extractPDFTextViaDownload();
            }
            if (!pdfText) {
                throw new Error('Failed to extract text from PDF');
            }
            // Validate each point
            await this.validatePoint1_BasicInfo(pdfText, options, result, screenshots);
            await this.validatePoint2_BillSummary(pdfText, result, screenshots);
            await this.validatePoint3_AccountDetails(pdfText, result, screenshots);
            await this.validatePoint4_UsageDetails(pdfText, result, screenshots);
            await this.validatePoint5_AllCharges(pdfText, result, screenshots);
            await this.validatePoint6_UsageByDate(pdfText, options, result, screenshots);
            // Generate final report
            result.reportPath = await this.generateExcelReport(result, options);
            result.screenshots = screenshots;
            console.log('\n' + '='.repeat(80));
            console.log('📊 VALIDATION SUMMARY');
            console.log('='.repeat(80));
            console.log(`✅ Mobile Number Match: ${result.validations.mobileNumberMatch}`);
            console.log(`✅ Plan Name Match: ${result.validations.planNameMatch}`);
            console.log(`✅ Rental Match: ${result.validations.rentalMatch}`);
            console.log(`✅ Calling Usage: ${result.validations.callingUsagePresent}`);
            console.log(`✅ SMS Usage: ${result.validations.smsUsagePresent}`);
            console.log(`✅ Data Usage: ${result.validations.dataUsagePresent}`);
            console.log(`📁 Report: ${result.reportPath}`);
            console.log(`📸 Screenshots: ${screenshots.length}`);
            console.log('='.repeat(80));
            return result;
        }
        catch (error) {
            console.error('PDF validation failed:', error);
            throw error;
        }
    }
    /**
     * POINT 1: MSISDN, Plan Details & Current Cycle Amount
     */
    async validatePoint1_BasicInfo(text, options, result, screenshots) {
        console.log('\n📌 POINT 1 — MSISDN, Plan Details & Current Cycle Amount');
        console.log('-'.repeat(60));
        // Extract MSISDN
        const msisdnMatch = text.match(/VI No[:\s]+(\d{10})/i) ||
            text.match(/Vi No[:\s]+(\d{10})/i) ||
            text.match(/Mobile No[:\s]+(\d{10})/i);
        result.mobileNumber = msisdnMatch ? msisdnMatch[1] : 'NOT_FOUND';
        // Extract Customer Name
        const customerMatch = text.match(/(?:Mr|Ms|Mrs)\.?\s+([A-Za-z\s]+)/i);
        result.customerName = customerMatch ? customerMatch[1].trim() : 'NOT_FOUND';
        // Extract Plan Name
        const planMatch = text.match(/Plan Name[:\s]+([A-Za-z0-9\s]+)/i) ||
            text.match(/Plan[:\s]+([A-Za-z0-9\s]+)/i);
        result.planName = planMatch ? planMatch[1].trim() : 'NOT_FOUND';
        // Extract Bill Cycle
        const cycleMatch = text.match(/Bill Period[:\s]+([\d\sA-Za-z]+to[\d\sA-Za-z]+)/i);
        result.billCycle = cycleMatch ? cycleMatch[1].trim() : 'NOT_FOUND';
        // Extract Plan Rental
        const rentalMatch = text.match(/Plan Rental[:\s]*([\d,.]+)/i) ||
            text.match(/Monthly Rental[:\s]*([\d,.]+)/i);
        result.planRental = rentalMatch ? this.parseCurrency(rentalMatch[1]) : 0;
        // Extract Total Amount Due
        const amountMatch = text.match(/Total(?: Amount)? Due[:\s]*([\d,.]+)/i) ||
            text.match(/Current Bill Charges[:\s]*([\d,.]+)/i);
        result.totalAmountDue = amountMatch ? this.parseCurrency(amountMatch[1]) : 0;
        // Validations
        result.validations.mobileNumberMatch = result.mobileNumber === options.msisdn ||
            result.mobileNumber.includes(options.msisdn.slice(-10));
        result.validations.planNameMatch = result.planName.toLowerCase().includes(options.planName.toLowerCase());
        result.validations.rentalMatch = options.expectedRental ?
            Math.abs(result.planRental - options.expectedRental) < 1 : true;
        // Take screenshot for Point 1
        const screenshot = await SiebelHelper_1.SiebelHelper.screenshot(`POINT1_MSISDN_Plan_${options.msisdn}`);
        screenshots.push(screenshot);
        console.log(`   📱 MSISDN: ${result.mobileNumber} → ${result.validations.mobileNumberMatch ? '✅' : '❌'}`);
        console.log(`   👤 Customer: ${result.customerName}`);
        console.log(`   📋 Plan: ${result.planName} → ${result.validations.planNameMatch ? '✅' : '❌'}`);
        console.log(`   📅 Bill Cycle: ${result.billCycle}`);
        console.log(`   💰 Rental: ₹${result.planRental} → ${result.validations.rentalMatch ? '✅' : '❌'}`);
        console.log(`   💵 Total Due: ₹${result.totalAmountDue}`);
    }
    /**
     * POINT 2: Current Bill & Past Bill Summary
     */
    async validatePoint2_BillSummary(text, result, screenshots) {
        console.log('\n📌 POINT 2 — Current Bill & Past Bill Summary');
        console.log('-'.repeat(60));
        // Extract Current Bill
        const currentBillMatch = text.match(/Current Bill[:\s]*([\d,.]+)/i) ||
            text.match(/Current Charges[:\s]*([\d,.]+)/i);
        result.currentBill = currentBillMatch ? this.parseCurrency(currentBillMatch[1]) : result.totalAmountDue;
        // Extract Past Bills (look for month patterns)
        const pastBillPattern = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-\d{2}[:\s]*([\d,.]+)/gi;
        let match;
        const pastBills = [];
        while ((match = pastBillPattern.exec(text)) !== null) {
            pastBills.push({
                period: match[1],
                amount: this.parseCurrency(match[2])
            });
        }
        result.pastBills = pastBills;
        // Take screenshot for Point 2
        const screenshot = await SiebelHelper_1.SiebelHelper.screenshot('POINT2_Bill_Summary');
        screenshots.push(screenshot);
        console.log(`   💵 Current Bill: ₹${result.currentBill}`);
        console.log(`   📜 Past Bills: ${result.pastBills.length} found`);
        result.pastBills.forEach(b => console.log(`      - ${b.period}: ₹${b.amount}`));
    }
    /**
     * POINT 3: Account Details
     */
    async validatePoint3_AccountDetails(text, result, screenshots) {
        console.log('\n📌 POINT 3 — Account Details');
        console.log('-'.repeat(60));
        // Extract Account Number
        const accountMatch = text.match(/Account No[:\s]+([A-Z0-9]+)/i) ||
            text.match(/Account Number[:\s]+([A-Z0-9]+)/i);
        result.accountNumber = accountMatch ? accountMatch[1] : 'NOT_FOUND';
        // Extract Billing Address
        const addressMatch = text.match(/Address[:\s]+([^\n]+)/i);
        result.billingAddress = addressMatch ? addressMatch[1].trim() : 'NOT_FOUND';
        // Extract GST Number
        const gstMatch = text.match(/GST[:\s]+([A-Z0-9]+)/i) ||
            text.match(/GSTIN[:\s]+([A-Z0-9]+)/i);
        result.gstNumber = gstMatch ? gstMatch[1] : 'NOT_FOUND';
        // Extract Due Date
        const dueMatch = text.match(/Due Date[:\s]+([\d\sA-Za-z]+)/i);
        result.dueDate = dueMatch ? dueMatch[1].trim() : 'NOT_FOUND';
        // Take screenshot for Point 3
        const screenshot = await SiebelHelper_1.SiebelHelper.screenshot('POINT3_Account_Details');
        screenshots.push(screenshot);
        console.log(`   🆔 Account: ${result.accountNumber}`);
        console.log(`   📍 Address: ${result.billingAddress.substring(0, 50)}...`);
        console.log(`   🔢 GST: ${result.gstNumber}`);
        console.log(`   📅 Due Date: ${result.dueDate}`);
    }
    /**
     * POINT 4: Usage Details - Plan Rental, VAS, Itemised Calls
     */
    async validatePoint4_UsageDetails(text, result, screenshots) {
        console.log('\n📌 POINT 4 — Usage Details');
        console.log('-'.repeat(60));
        // Extract Plan Rental Details
        const rentalSection = text.match(/Plan Rental[^]*?(?=Value Added|VAS|Itemised|$)/i);
        if (rentalSection) {
            const rentalLines = rentalSection[0].split('\n');
            for (const line of rentalLines) {
                const match = line.match(/([A-Za-z0-9\s]+(?:Plan|Pack|Subscription))[:\s-]*([\d,.]+)/i);
                if (match && this.parseCurrency(match[2]) !== 0) {
                    result.planRentalDetails.push({
                        description: match[1].trim(),
                        charges: this.parseCurrency(match[2])
                    });
                }
            }
        }
        // Extract VAS Charges
        const vasSection = text.match(/(?:Value Added Services|VAS)[^]*?(?=Itemised|Calls|$)/i);
        if (vasSection) {
            const vasLines = vasSection[0].split('\n');
            for (const line of vasLines) {
                const match = line.match(/([A-Za-z0-9\s]+(?:Subscription|Service|Pack))[:\s-]*([\d,.]+)/i);
                if (match && this.parseCurrency(match[2]) !== 0) {
                    result.vasCharges.push({
                        description: match[1].trim(),
                        charges: this.parseCurrency(match[2])
                    });
                }
            }
        }
        // Extract Itemised Calls
        const callsSection = text.match(/Itemised Calls[^]*?(?=Total|Charges|$)/i);
        if (callsSection) {
            const callLines = callsSection[0].split('\n');
            for (const line of callLines) {
                // Match date-time patterns
                const callMatch = line.match(/(\d{2}\/\d{2}\/\d{2})-(\d{2}:\d{2}:\d{2})[^\d]*(\d{10})[^\d]*(\d+:\d+)[^\d]*([\d,.]+)/i);
                if (callMatch) {
                    result.itemisedCalls.push({
                        date: callMatch[1],
                        time: callMatch[2],
                        type: 'Call',
                        usage: callMatch[4],
                        charges: this.parseCurrency(callMatch[5])
                    });
                }
            }
        }
        // Take screenshot for Point 4
        const screenshot = await SiebelHelper_1.SiebelHelper.screenshot('POINT4_Usage_Details');
        screenshots.push(screenshot);
        console.log(`   🏠 Plan Rentals: ${result.planRentalDetails.length} items`);
        console.log(`   📺 VAS Charges: ${result.vasCharges.length} items`);
        console.log(`   📞 Itemised Calls: ${result.itemisedCalls.length} items`);
    }
    /**
     * POINT 5: All Non-Zero Charges (Skip 0.00 and Charge/Unit column)
     */
    async validatePoint5_AllCharges(text, result, screenshots) {
        console.log('\n📌 POINT 5 — All Non-Zero Charges (Skipping 0.00 values)');
        console.log('-'.repeat(60));
        // Extract all numbers with descriptions
        const chargePattern = /([A-Za-z0-9\s\-]+)[:\s]*([\d,.]+)/g;
        let match;
        const processedCharges = new Set();
        while ((match = chargePattern.exec(text)) !== null) {
            const description = match[1].trim();
            const amount = this.parseCurrency(match[2]);
            // SKIP if amount is 0.00
            if (amount === 0) {
                continue;
            }
            // SKIP if it's a Charge/Unit column (contains unit indicators)
            if (description.toLowerCase().includes('per') ||
                description.toLowerCase().includes('unit') ||
                description.toLowerCase().includes('min') ||
                description.toLowerCase().includes('kb') ||
                description.toLowerCase().includes('mb') ||
                description.toLowerCase().includes('gb')) {
                continue;
            }
            // Avoid duplicates
            const key = `${description}|${amount}`;
            if (!processedCharges.has(key) && description.length > 3) {
                processedCharges.add(key);
                result.allCharges.push({
                    description: description,
                    charges: amount
                });
            }
        }
        // Sort by amount descending
        result.allCharges.sort((a, b) => b.charges - a.charges);
        result.validations.chargesNonZero = result.allCharges.length > 0;
        // Take screenshot for Point 5
        const screenshot = await SiebelHelper_1.SiebelHelper.screenshot('POINT5_All_Charges_NonZero');
        screenshots.push(screenshot);
        console.log(`   💰 Non-zero charges found: ${result.allCharges.length}`);
        if (result.allCharges.length > 0) {
            console.log(`   🔝 Top 5 charges:`);
            result.allCharges.slice(0, 5).forEach(c => console.log(`      - ${c.description}: ₹${c.charges}`));
        }
    }
    /**
     * POINT 6: Breakup of Internet Usage, SMS, Calling by Date
     */
    async validatePoint6_UsageByDate(text, options, result, screenshots) {
        console.log('\n📌 POINT 6 — Usage by Date (Internet, SMS, Calling)');
        console.log('-'.repeat(60));
        // Parse Internet Usage
        const internetPattern = /(\d{2}\/\d{2}\/\d{2})-(\d{2}:\d{2}:\d{2})[^\d]*Internet[^\d]*(\d+)[^\d]*([\d,.]+)/gi;
        let match;
        while ((match = internetPattern.exec(text)) !== null) {
            const date = match[1];
            const time = match[2];
            const kb = parseInt(match[3], 10);
            const charges = this.parseCurrency(match[4]);
            if (!result.dataUsageByDate[date]) {
                result.dataUsageByDate[date] = [];
                result.dataTotalKB[date] = 0;
                result.dataTotalCharges[date] = 0;
            }
            result.dataUsageByDate[date].push({
                date: date,
                time: time,
                type: 'Internet',
                usage: `${kb} KB`,
                charges: charges,
                kbUsed: kb
            });
            result.dataTotalKB[date] = (result.dataTotalKB[date] || 0) + kb;
            result.dataTotalCharges[date] = (result.dataTotalCharges[date] || 0) + charges;
        }
        // Parse SMS Usage
        const smsPattern = /(\d{2}\/\d{2}\/\d{2})-(\d{2}:\d{2}:\d{2})[^\d]*SMS[^\d]*([\d,.]+)/gi;
        while ((match = smsPattern.exec(text)) !== null) {
            const date = match[1];
            const time = match[2];
            const charges = this.parseCurrency(match[3]);
            if (!result.smsUsageByDate[date]) {
                result.smsUsageByDate[date] = [];
                result.smsTotalCharges[date] = 0;
            }
            result.smsUsageByDate[date].push({
                date: date,
                time: time,
                type: 'SMS',
                usage: '1 SMS',
                charges: charges
            });
            result.smsTotalCharges[date] = (result.smsTotalCharges[date] || 0) + charges;
        }
        // Parse Calling Usage
        const callPattern = /(\d{2}\/\d{2}\/\d{2})-(\d{2}:\d{2}:\d{2})[^\d]*(?:Local|STD)[^\d]*(\d+:\d+)[^\d]*([\d,.]+)/gi;
        while ((match = callPattern.exec(text)) !== null) {
            const date = match[1];
            const time = match[2];
            const duration = match[3];
            const charges = this.parseCurrency(match[4]);
            if (!result.callUsageByDate[date]) {
                result.callUsageByDate[date] = [];
                result.callTotalCharges[date] = 0;
            }
            result.callUsageByDate[date].push({
                date: date,
                time: time,
                type: 'Call',
                usage: duration,
                charges: charges,
                duration: duration
            });
            result.callTotalCharges[date] = (result.callTotalCharges[date] || 0) + charges;
        }
        // Check specific usage dates from input Excel
        if (options.usageDates && options.usageDates.length > 0) {
            console.log(`   📅 Checking usage dates from Excel: ${options.usageDates.join(', ')}`);
            for (let i = 0; i < options.usageDates.length; i++) {
                const date = options.usageDates[i];
                // Convert date format if needed (DD.MM.YY to DD/MM/YY)
                const normalizedDate = date.replace(/\./g, '/');
                const hasData = result.dataUsageByDate[normalizedDate] !== undefined;
                const hasSMS = result.smsUsageByDate[normalizedDate] !== undefined;
                const hasCall = result.callUsageByDate[normalizedDate] !== undefined;
                const found = hasData || hasSMS || hasCall;
                result.validations.usageDatesFound.push(found);
                console.log(`      Date ${i + 1}: ${date} → ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
                if (hasData) {
                    console.log(`         📊 Internet: ${result.dataTotalKB[normalizedDate]} KB, Charges: ₹${result.dataTotalCharges[normalizedDate]}`);
                }
                if (hasSMS) {
                    console.log(`         💬 SMS: Charges: ₹${result.smsTotalCharges[normalizedDate]}`);
                }
                if (hasCall) {
                    console.log(`         📞 Calls: Charges: ₹${result.callTotalCharges[normalizedDate]}`);
                }
            }
        }
        // Determine presence of usage types
        result.validations.callingUsagePresent = Object.keys(result.callUsageByDate).length > 0;
        result.validations.smsUsagePresent = Object.keys(result.smsUsageByDate).length > 0;
        result.validations.dataUsagePresent = Object.keys(result.dataUsageByDate).length > 0;
        // Take screenshot for Point 6
        const screenshot = await SiebelHelper_1.SiebelHelper.screenshot('POINT6_Usage_By_Date');
        screenshots.push(screenshot);
        console.log(`\n   📊 Usage Summary:`);
        console.log(`      🌐 Data Usage Days: ${Object.keys(result.dataUsageByDate).length}`);
        console.log(`      💬 SMS Usage Days: ${Object.keys(result.smsUsageByDate).length}`);
        console.log(`      📞 Call Usage Days: ${Object.keys(result.callUsageByDate).length}`);
        // Print detailed data for specific dates
        if (options.usageDates) {
            console.log(`\n   📋 DETAILED USAGE FOR SPECIFIED DATES:`);
            for (const date of options.usageDates) {
                const normalizedDate = date.replace(/\./g, '/');
                if (result.dataUsageByDate[normalizedDate]) {
                    console.log(`\n      📅 ${date} - INTERNET USAGE:`);
                    result.dataUsageByDate[normalizedDate].forEach(item => {
                        console.log(`         ${item.time} → ${item.usage} → Charges: ₹${item.charges}`);
                    });
                    console.log(`         TOTAL: ${result.dataTotalKB[normalizedDate]} KB | Charges: ₹${result.dataTotalCharges[normalizedDate]}`);
                }
            }
        }
    }
    /**
     * Extract PDF text from current tab
     */
    async extractPDFText() {
        try {
            // Try to get text from the PDF viewer
            const bodyText = await (0, globals_1.$)('body').getText();
            if (bodyText && bodyText.length > 100) {
                return bodyText;
            }
            // Try to find embedded PDF text
            const pdfContent = await (0, globals_1.$)('pre').getText();
            if (pdfContent && pdfContent.length > 100) {
                return pdfContent;
            }
            return '';
        }
        catch (error) {
            console.log('Could not extract PDF text directly:', error);
            return '';
        }
    }
    /**
     * Alternative: Download PDF and extract text
     */
    async extractPDFTextViaDownload() {
        try {
            const currentUrl = await globals_1.browser.getUrl();
            // Download using fetch
            const response = await fetch(currentUrl);
            const buffer = await response.arrayBuffer();
            const text = await this.pdfReader.extractText(Buffer.from(buffer));
            return text;
        }
        catch (error) {
            console.error('PDF download failed:', error);
            return '';
        }
    }
    /**
     * Generate Excel report with all 6 points
     */
    async generateExcelReport(result, options) {
        const ExcelJS = require('exceljs');
        const workbook = new ExcelJS.Workbook();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `VI_Invoice_Validation_Report_${options.msisdn}_${timestamp}.xlsx`;
        const filepath = path.join(this.reportDir, filename);
        // Sheet 1: Summary Dashboard
        const summarySheet = workbook.addWorksheet('Summary Dashboard');
        summarySheet.getCell('A1').value = 'Vi TELECOM INVOICE VALIDATION REPORT — Bill Analysis';
        summarySheet.getCell('A1').font = { bold: true, size: 14 };
        // POINT 1 Data
        summarySheet.getCell('A4').value = 'POINT 1 — MSISDN, Plan Details & Current Cycle Amount';
        summarySheet.getCell('A4').font = { bold: true };
        summarySheet.addRow(['Bill File', 'Vi No (MSISDN)', 'Customer Name', 'Plan Name', 'Bill Cycle Date', 'Total Payable (Rs.)']);
        summarySheet.addRow(['PDF Invoice', result.mobileNumber, result.customerName, result.planName, result.billCycle, result.totalAmountDue]);
        // POINT 2 Data
        summarySheet.getCell('A10').value = 'POINT 2 — Current Bill & Past Bill Summary';
        summarySheet.getCell('A10').font = { bold: true };
        summarySheet.addRow(['Charge Summary', 'Amount (Rs.)']);
        summarySheet.addRow(['Current Bill', result.currentBill]);
        if (result.pastBills.length > 0) {
            summarySheet.addRow(['Past Bills', '']);
            result.pastBills.forEach(bill => {
                summarySheet.addRow([`  ${bill.period}`, bill.amount]);
            });
        }
        // Sheet 2: Account Details
        const accountSheet = workbook.addWorksheet('Account Details');
        accountSheet.getCell('A1').value = 'POINT 3 — Account Details';
        accountSheet.getCell('A1').font = { bold: true };
        accountSheet.addRow(['Field', 'Value']);
        accountSheet.addRow(['Vi Number', result.mobileNumber]);
        accountSheet.addRow(['Customer Name', result.customerName]);
        accountSheet.addRow(['Account Number', result.accountNumber]);
        accountSheet.addRow(['Billing Address', result.billingAddress]);
        accountSheet.addRow(['GST Number', result.gstNumber]);
        accountSheet.addRow(['Due Date', result.dueDate]);
        // Sheet 3: Usage Details
        const usageSheet = workbook.addWorksheet('Usage Details');
        usageSheet.getCell('A1').value = 'POINT 4 — Usage Details';
        usageSheet.getCell('A1').font = { bold: true };
        // Plan Rentals
        usageSheet.getCell('A3').value = 'Plan Rental Charges';
        usageSheet.getCell('A3').font = { bold: true };
        usageSheet.addRow(['Description', 'Charges (Rs.)']);
        result.planRentalDetails.forEach(item => {
            usageSheet.addRow([item.description, item.charges]);
        });
        // VAS Charges
        usageSheet.getCell('A8').value = 'Value Added Services (VAS)';
        usageSheet.getCell('A8').font = { bold: true };
        usageSheet.addRow(['Description', 'Charges (Rs.)']);
        result.vasCharges.forEach(item => {
            usageSheet.addRow([item.description, item.charges]);
        });
        // Itemised Calls
        usageSheet.getCell('A13').value = 'Itemised Calls';
        usageSheet.getCell('A13').font = { bold: true };
        usageSheet.addRow(['Date', 'Time', 'Duration', 'Charges (Rs.)']);
        result.itemisedCalls.forEach(call => {
            usageSheet.addRow([call.date, call.time || '', call.usage, call.charges]);
        });
        // Sheet 4: Charges Validation (Non-zero only)
        const chargesSheet = workbook.addWorksheet('Charges Validation');
        chargesSheet.getCell('A1').value = 'POINT 5 — Full PDF Charges Validation (Excluding 0.00 values)';
        chargesSheet.getCell('A1').font = { bold: true };
        chargesSheet.addRow(['Section', 'Description', 'Amount (Rs.)', 'Status']);
        // Plan Rentals Section
        chargesSheet.addRow(['Plan Rental', '', '', '']);
        result.planRentalDetails.forEach(item => {
            chargesSheet.addRow(['', item.description, item.charges, 'CHARGED']);
        });
        // VAS Section
        chargesSheet.addRow(['VAS', '', '', '']);
        result.vasCharges.forEach(item => {
            chargesSheet.addRow(['', item.description, item.charges, 'CHARGED']);
        });
        // All Non-zero Charges Summary
        chargesSheet.addRow(['GRAND TOTAL', '', result.totalAmountDue, 'FINAL']);
        // Sheet 5: Data Breakup
        const dataSheet = workbook.addWorksheet('Data Breakup');
        dataSheet.getCell('A1').value = 'POINT 6 — Breakup of Internet Usage';
        dataSheet.getCell('A1').font = { bold: true };
        // Internet Usage by Date
        dataSheet.addRow(['Date', 'Time', 'Type', 'Usage (KB)', 'Charges (Rs.)', 'Status']);
        for (const [date, items] of Object.entries(result.dataUsageByDate)) {
            for (const item of items) {
                dataSheet.addRow([
                    date,
                    item.time || '',
                    'Internet',
                    item.kbUsed || 0,
                    item.charges,
                    item.charges === 0 ? 'FREE' : 'CHARGED'
                ]);
            }
            // Add total row for each date
            dataSheet.addRow([
                date,
                'TOTAL',
                'Internet',
                result.dataTotalKB[date] || 0,
                result.dataTotalCharges[date] || 0,
                ''
            ]);
            dataSheet.addRow([]); // Empty row separator
        }
        // SMS Usage
        if (Object.keys(result.smsUsageByDate).length > 0) {
            dataSheet.addRow(['SMS USAGE:', '', '', '', '', '']);
            for (const [date, items] of Object.entries(result.smsUsageByDate)) {
                dataSheet.addRow([date, '', 'SMS', items.length, result.smsTotalCharges[date] || 0, '']);
            }
        }
        // Calling Usage
        if (Object.keys(result.callUsageByDate).length > 0) {
            dataSheet.addRow(['CALLING USAGE:', '', '', '', '', '']);
            for (const [date, items] of Object.entries(result.callUsageByDate)) {
                dataSheet.addRow([date, '', 'Call', items.length, result.callTotalCharges[date] || 0, '']);
            }
        }
        // Sheet 6: Validation Summary
        const validationSheet = workbook.addWorksheet('Validation Summary');
        validationSheet.getCell('A1').value = 'INVOICE VALIDATION SUMMARY';
        validationSheet.getCell('A1').font = { bold: true, size: 14 };
        validationSheet.addRow(['Check', 'Expected', 'Actual', 'Result']);
        validationSheet.addRow(['Mobile Number', options.msisdn, result.mobileNumber, result.validations.mobileNumberMatch ? 'PASS' : 'FAIL']);
        validationSheet.addRow(['Plan Name', options.planName, result.planName, result.validations.planNameMatch ? 'PASS' : 'FAIL']);
        validationSheet.addRow(['Calling Usage', options.expectedCalling ? 'Yes' : 'No', result.validations.callingUsagePresent ? 'Yes' : 'No',
            (!options.expectedCalling || result.validations.callingUsagePresent) ? 'PASS' : 'FAIL']);
        validationSheet.addRow(['SMS Usage', options.expectedSMS ? 'Yes' : 'No', result.validations.smsUsagePresent ? 'Yes' : 'No',
            (!options.expectedSMS || result.validations.smsUsagePresent) ? 'PASS' : 'FAIL']);
        validationSheet.addRow(['Data Usage', options.expectedData ? 'Yes' : 'No', result.validations.dataUsagePresent ? 'Yes' : 'No',
            (!options.expectedData || result.validations.dataUsagePresent) ? 'PASS' : 'FAIL']);
        if (options.usageDates) {
            options.usageDates.forEach((date, idx) => {
                validationSheet.addRow([`Usage Date ${idx + 1}`, date, result.validations.usageDatesFound[idx] ? 'Found' : 'Not Found',
                    result.validations.usageDatesFound[idx] ? 'PASS' : 'INFO']);
            });
        }
        // Summary Statistics
        validationSheet.addRow([]);
        validationSheet.addRow(['Summary Statistics', '', '', '']);
        const totalChecks = 5;
        const passCount = [
            result.validations.mobileNumberMatch,
            result.validations.planNameMatch,
            !options.expectedCalling || result.validations.callingUsagePresent,
            !options.expectedSMS || result.validations.smsUsagePresent,
            !options.expectedData || result.validations.dataUsagePresent
        ].filter(Boolean).length;
        validationSheet.addRow(['Total Checks', totalChecks, '', '']);
        validationSheet.addRow(['PASS', passCount, '', '']);
        validationSheet.addRow(['FAIL', totalChecks - passCount, '', '']);
        // Save workbook
        await workbook.xlsx.writeFile(filepath);
        console.log(`\n📊 Excel report saved: ${filepath}`);
        return filepath;
    }
    /**
     * Parse currency string to number
     */
    parseCurrency(value) {
        if (!value)
            return 0;
        const cleaned = value.replace(/,/g, '').replace(/\(-/g, '-').replace(/[^0-9.-]/g, '');
        const parsed = parseFloat(cleaned);
        return isNaN(parsed) ? 0 : parsed;
    }
}
exports.SiebelBillingPDFPage = SiebelBillingPDFPage;
