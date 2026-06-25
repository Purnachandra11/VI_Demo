"use strict";
// test/services/InvoiceValidationService.ts (NEEDS UPDATE - add more validation methods)
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoiceValidationService = void 0;
class InvoiceValidationService {
    validateInvoice(extractedData, matchResult, usageDates) {
        const report = {
            testCase: matchResult.testRow,
            planDetails: matchResult.planDetails,
            accountDetails: this.validateAccountDetails(extractedData, matchResult.testRow),
            planDetailsValidation: this.validatePlanDetailsSection(extractedData, matchResult),
            chargeSummary: this.validateChargeSummary(extractedData, matchResult),
            usageValidation: this.validateUsageSection(extractedData, matchResult.testRow, usageDates),
            irChargesValidation: this.validateIRCharges(extractedData),
            wordByWordAnalysis: this.performWordByWordAnalysis(extractedData, matchResult),
            overallStatus: 'PASS',
            overallScore: 0,
            screenshots: [],
        };
        const scores = [
            report.accountDetails.isValid ? 1 : 0,
            report.planDetailsValidation.isValid ? 1 : 0,
            report.chargeSummary.isValid ? 1 : 0,
            report.usageValidation.isValid ? 1 : 0,
            report.irChargesValidation.isValid ? 1 : 0,
        ];
        const totalScore = scores.reduce((a, b) => a + b, 0);
        report.overallScore = (totalScore / scores.length) * 100;
        if (report.overallScore === 100) {
            report.overallStatus = 'PASS';
        }
        else if (report.overallScore >= 60) {
            report.overallStatus = 'PARTIAL';
        }
        else {
            report.overallStatus = 'FAIL';
        }
        return report;
    }
    validateAccountDetails(extracted, testRow) {
        var _a, _b, _c;
        const details = [];
        let isValid = true;
        const mobileNumberMatch = extracted.mobileNumber === testRow.msisdn ||
            ((_a = extracted.mobileNumber) === null || _a === void 0 ? void 0 : _a.includes(testRow.msisdn.slice(-10)));
        if (mobileNumberMatch) {
            details.push(`✅ Mobile Number: ${extracted.mobileNumber} matches expected ${testRow.msisdn}`);
        }
        else {
            details.push(`❌ Mobile Number: ${extracted.mobileNumber} does NOT match expected ${testRow.msisdn}`);
            isValid = false;
        }
        const accountNumberPresent = !!extracted.accountNumber;
        details.push(accountNumberPresent ? `✅ Account Number: ${extracted.accountNumber}` : `❌ Account Number not found`);
        const customerNamePresent = !!extracted.customerName;
        details.push(customerNamePresent ? `✅ Customer Name: ${extracted.customerName}` : `❌ Customer Name not found`);
        const expectedPeriod = `${testRow.activationDate} to ${testRow.activationTillDate}`;
        const billPeriodMatch = ((_b = extracted.billPeriod) === null || _b === void 0 ? void 0 : _b.includes(testRow.activationDate)) &&
            ((_c = extracted.billPeriod) === null || _c === void 0 ? void 0 : _c.includes(testRow.activationTillDate));
        if (billPeriodMatch) {
            details.push(`✅ Bill Period: ${extracted.billPeriod} matches expected`);
        }
        else {
            details.push(`❌ Bill Period: ${extracted.billPeriod} does NOT match expected ${expectedPeriod}`);
            isValid = false;
        }
        const dueDatePresent = !!extracted.dueDate;
        details.push(dueDatePresent ? `✅ Due Date: ${extracted.dueDate}` : `❌ Due Date not found`);
        return { isValid, mobileNumberMatch, accountNumberPresent, customerNamePresent, billPeriodMatch, dueDatePresent, details };
    }
    validatePlanDetailsSection(extracted, matchResult) {
        var _a, _b;
        const details = [];
        let isValid = true;
        const expectedPlan = matchResult.testRow.planName;
        const expectedRental = matchResult.planDetails.rental;
        const planNameMatch = (_a = extracted.planName) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(expectedPlan.toLowerCase());
        if (planNameMatch) {
            details.push(`✅ Plan Name: ${extracted.planName} matches ${expectedPlan}`);
        }
        else {
            details.push(`❌ Plan Name: ${extracted.planName} does NOT match ${expectedPlan}`);
            isValid = false;
        }
        const rentalMatch = Math.abs(extracted.planRental - expectedRental) < 1;
        if (rentalMatch) {
            details.push(`✅ Rental: ₹${extracted.planRental} matches expected ₹${expectedRental}`);
        }
        else {
            details.push(`❌ Rental: ₹${extracted.planRental} does NOT match expected ₹${expectedRental}`);
            isValid = false;
        }
        const expectedBenefits = [
            { keyword: 'unlimited', description: 'Unlimited Calls' },
            { keyword: '3000', description: '3000 SMS' },
            { keyword: 'unlimited', description: 'Unlimited Data' },
        ];
        let benefitsMatch = true;
        for (const benefit of expectedBenefits) {
            const found = (_b = extracted.planBenefits) === null || _b === void 0 ? void 0 : _b.some((b) => b.toLowerCase().includes(benefit.keyword));
            if (found) {
                details.push(`✅ ${benefit.description} found`);
            }
            else {
                details.push(`❌ ${benefit.description} NOT found`);
                benefitsMatch = false;
            }
        }
        return { isValid, planNameMatch, rentalMatch, benefitsMatch, details };
    }
    validateChargeSummary(extracted, matchResult) {
        const details = [];
        let isValid = true;
        const oneTimeChargesValid = extracted.oneTimeCharges >= 0;
        details.push(oneTimeChargesValid ? `✅ One-time Charges: ₹${extracted.oneTimeCharges}` : `❌ One-time Charges invalid: ${extracted.oneTimeCharges}`);
        const monthlyChargesValid = extracted.monthlyCharges >= matchResult.planDetails.rental;
        details.push(monthlyChargesValid ? `✅ Monthly Charges: ₹${extracted.monthlyCharges}` : `❌ Monthly Charges: ₹${extracted.monthlyCharges} is less than rental ₹${matchResult.planDetails.rental}`);
        const usageChargesValid = extracted.usageCharges >= 0;
        details.push(usageChargesValid ? `✅ Usage Charges: ₹${extracted.usageCharges}` : `❌ Usage Charges invalid`);
        const discountsValid = extracted.discounts >= 0;
        details.push(discountsValid ? `✅ Discounts: ₹${extracted.discounts}` : `❌ Discounts invalid`);
        const calculatedTotal = extracted.oneTimeCharges + extracted.monthlyCharges +
            extracted.usageCharges + extracted.internationalRoamingCharges -
            extracted.discounts + extracted.tax;
        const totalAmountValid = Math.abs(extracted.totalAmount - calculatedTotal) < 1;
        details.push(totalAmountValid ? `✅ Total Amount: ₹${extracted.totalAmount}` : `❌ Total Amount mismatch: ₹${extracted.totalAmount} vs calculated ₹${calculatedTotal}`);
        isValid = oneTimeChargesValid && monthlyChargesValid && usageChargesValid && totalAmountValid;
        return { isValid, oneTimeChargesValid, monthlyChargesValid, usageChargesValid, discountsValid, totalAmountValid, details };
    }
    validateUsageSection(extracted, testRow, usageDates) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const details = [];
        let isValid = true;
        const validUsageDates = usageDates.filter(d => d && d.trim().length > 0);
        const callingUsagePresent = testRow.calling === 'Yes' ? ((_a = extracted.callUsage) === null || _a === void 0 ? void 0 : _a.length) > 0 : ((_b = extracted.callUsage) === null || _b === void 0 ? void 0 : _b.length) === 0;
        if (callingUsagePresent) {
            details.push(`✅ Calling Usage: ${((_c = extracted.callUsage) === null || _c === void 0 ? void 0 : _c.length) || 0} records found (Expected: ${testRow.calling})`);
        }
        else {
            details.push(`❌ Calling Usage: ${((_d = extracted.callUsage) === null || _d === void 0 ? void 0 : _d.length) || 0} records found (Expected: ${testRow.calling})`);
            isValid = false;
        }
        const matchedCallDates = [];
        for (const date of validUsageDates) {
            const hasCallOnDate = (_e = extracted.callUsage) === null || _e === void 0 ? void 0 : _e.some((call) => { var _a, _b; return ((_a = call.date) === null || _a === void 0 ? void 0 : _a.includes(date)) || ((_b = call.date) === null || _b === void 0 ? void 0 : _b.includes(date.replace(/\./g, '/'))); });
            if (hasCallOnDate) {
                matchedCallDates.push(date);
                details.push(`✅ Call found on ${date}`);
            }
            else if (testRow.calling === 'Yes') {
                details.push(`⚠️ No call found on expected date: ${date}`);
            }
        }
        const smsUsagePresent = testRow.sms === 'Yes' ? ((_f = extracted.smsUsage) === null || _f === void 0 ? void 0 : _f.length) > 0 : ((_g = extracted.smsUsage) === null || _g === void 0 ? void 0 : _g.length) === 0;
        if (smsUsagePresent) {
            details.push(`✅ SMS Usage: ${((_h = extracted.smsUsage) === null || _h === void 0 ? void 0 : _h.length) || 0} records found (Expected: ${testRow.sms})`);
        }
        else {
            details.push(`❌ SMS Usage: ${((_j = extracted.smsUsage) === null || _j === void 0 ? void 0 : _j.length) || 0} records found (Expected: ${testRow.sms})`);
            isValid = false;
        }
        const dataUsagePresent = testRow.data === 'Yes' ? ((_k = extracted.dataUsage) === null || _k === void 0 ? void 0 : _k.length) > 0 : ((_l = extracted.dataUsage) === null || _l === void 0 ? void 0 : _l.length) === 0;
        if (dataUsagePresent) {
            details.push(`✅ Data Usage: ${((_m = extracted.dataUsage) === null || _m === void 0 ? void 0 : _m.length) || 0} records found (Expected: ${testRow.data})`);
        }
        else {
            details.push(`❌ Data Usage: ${((_o = extracted.dataUsage) === null || _o === void 0 ? void 0 : _o.length) || 0} records found (Expected: ${testRow.data})`);
            isValid = false;
        }
        return {
            isValid,
            callingUsagePresent,
            smsUsagePresent,
            dataUsagePresent,
            usageDatesMatched: matchedCallDates,
            details
        };
    }
    validateIRCharges(extracted) {
        const details = [];
        let isValid = true;
        const irChargesPresent = extracted.internationalRoamingCharges > 0;
        if (irChargesPresent) {
            details.push(`✅ International Roaming Charges: ₹${extracted.internationalRoamingCharges}`);
        }
        else {
            details.push(`ℹ️ No International Roaming Charges present`);
        }
        return { isValid, irChargesPresent, details };
    }
    performWordByWordAnalysis(extracted, matchResult) {
        var _a;
        const expectedPlanName = matchResult.testRow.planName;
        const actualPlanName = extracted.planName || '';
        const planNameMatch = this.analyzeWordMatch(expectedPlanName, actualPlanName);
        const expectedBenefits = 'Unlimited Calls, 3000 SMS, Unlimited Data';
        const actualBenefits = ((_a = extracted.planBenefits) === null || _a === void 0 ? void 0 : _a.join(', ')) || '';
        const benefitsMatch = this.analyzeWordMatch(expectedBenefits, actualBenefits);
        const expectedRental = `Rs.${matchResult.planDetails.rental}`;
        const actualRental = `Rs.${extracted.planRental}`;
        const rentalMatch = this.analyzeWordMatch(expectedRental, actualRental);
        const expectedVerbiage = matchResult.planDetails.activationVerbiage;
        const actualVerbiage = extracted.activationVerbiage || '';
        const activationVerbiageMatch = this.analyzeWordMatch(expectedVerbiage, actualVerbiage);
        return {
            planNameMatch,
            benefitsMatch,
            rentalMatch,
            activationVerbiageMatch,
        };
    }
    analyzeWordMatch(expected, actual) {
        const expectedWords = expected.toLowerCase().split(/\s+/);
        const actualWords = actual.toLowerCase().split(/\s+/);
        const foundWords = [];
        const missingWords = [];
        for (const word of expectedWords) {
            if (actualWords.some(aw => aw.includes(word) || word.includes(aw))) {
                foundWords.push(word);
            }
            else {
                missingWords.push(word);
            }
        }
        const matchPercentage = (foundWords.length / expectedWords.length) * 100;
        const isMatch = matchPercentage >= 80;
        return {
            isMatch,
            expectedWords,
            foundWords,
            missingWords,
            matchPercentage,
        };
    }
    generateHTMLReport(report) {
        const statusColor = report.overallStatus === 'PASS' ? '#4CAF50' :
            report.overallStatus === 'PARTIAL' ? '#FF9800' : '#F44336';
        return `
<!DOCTYPE html>
<html>
<head>
    <title>Invoice Validation Report - ${report.testCase.msisdn}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: ${statusColor}; color: white; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .section-title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
        .pass { color: #4CAF50; }
        .fail { color: #F44336; }
        .partial { color: #FF9800; }
        .detail { margin: 5px 0; font-family: monospace; }
        .score { font-size: 24px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Invoice Validation Report</h1>
        <p>MSISDN: ${report.testCase.msisdn} | Plan: ${report.testCase.planName}</p>
        <p>Overall Score: <span class="score">${report.overallScore.toFixed(2)}%</span> | Status: ${report.overallStatus}</p>
    </div>
    
    <div class="section">
        <div class="section-title">📋 Account Details</div>
        ${report.accountDetails.details.map(d => `<div class="detail ${d.includes('✅') ? 'pass' : d.includes('❌') ? 'fail' : ''}">${d}</div>`).join('')}
    </div>
    
    <div class="section">
        <div class="section-title">📱 Plan Details Validation</div>
        ${report.planDetailsValidation.details.map(d => `<div class="detail ${d.includes('✅') ? 'pass' : d.includes('❌') ? 'fail' : ''}">${d}</div>`).join('')}
    </div>
    
    <div class="section">
        <div class="section-title">💰 Charge Summary</div>
        ${report.chargeSummary.details.map(d => `<div class="detail ${d.includes('✅') ? 'pass' : d.includes('❌') ? 'fail' : ''}">${d}</div>`).join('')}
    </div>
    
    <div class="section">
        <div class="section-title">📊 Usage Validation</div>
        ${report.usageValidation.details.map(d => `<div class="detail ${d.includes('✅') ? 'pass' : d.includes('❌') ? 'fail' : ''}">${d}</div>`).join('')}
    </div>
    
    <div class="section">
        <div class="section-title">🌍 International Roaming</div>
        ${report.irChargesValidation.details.map(d => `<div class="detail">${d}</div>`).join('')}
    </div>
    
    <div class="section">
        <div class="section-title">🔤 Word-by-Word Analysis</div>
        <table>
            <tr><th>Field</th><th>Match %</th><th>Missing Words</th></tr>
            <tr><td>Plan Name</td><td>${report.wordByWordAnalysis.planNameMatch.matchPercentage.toFixed(2)}%</td><td>${report.wordByWordAnalysis.planNameMatch.missingWords.join(', ')}</td></tr>
            <tr><td>Benefits</td><td>${report.wordByWordAnalysis.benefitsMatch.matchPercentage.toFixed(2)}%</td><td>${report.wordByWordAnalysis.benefitsMatch.missingWords.join(', ')}</td></tr>
            <tr><td>Rental</td><td>${report.wordByWordAnalysis.rentalMatch.matchPercentage.toFixed(2)}%</td><td>${report.wordByWordAnalysis.rentalMatch.missingWords.join(', ')}</td></tr>
        </table>
    </div>
</body>
</html>
    `;
    }
}
exports.InvoiceValidationService = InvoiceValidationService;
