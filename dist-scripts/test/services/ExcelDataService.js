"use strict";
/**
 * ExcelDataService.ts
 * Reads and parses Excel test data for invoice validation
 */
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
exports.ExcelDataService = void 0;
const XLSX = __importStar(require("xlsx"));
const fs = __importStar(require("fs"));
class ExcelDataService {
    constructor(excelPath) {
        this.excelPath = excelPath;
        this.testPlans = [];
        this.planDetails = new Map();
    }
    /**
     * Load and parse both sheets from Excel file
     */
    async loadData() {
        if (!fs.existsSync(this.excelPath)) {
            throw new Error(`Excel file not found: ${this.excelPath}`);
        }
        const workbook = XLSX.readFile(this.excelPath);
        // Load Testplan sheet
        const testplanSheet = workbook.Sheets['Testplan'];
        if (testplanSheet) {
            const rawData = XLSX.utils.sheet_to_json(testplanSheet);
            this.testPlans = rawData.map(row => ({
                msisdn: String(row.MSISDN || ''),
                username: String(row.Username || ''),
                password: String(row.Password || ''),
                planName: String(row['Plan Name'] || ''),
                activationDate: String(row['Activation Date'] || ''),
                activationTillDate: String(row['Activation Till Date'] || ''),
                invoiceDate: String(row['Invoice Date'] || ''),
                calling: row.Calling === 'Yes' ? 'Yes' : 'No',
                sms: row.SMS === 'Yes' ? 'Yes' : 'No',
                data: row.Data === 'Yes' ? 'Yes' : 'No',
                usageDate1: String(row['Usage Date 1'] || ''),
                usageDate2: String(row['Usage Date 2'] || ''),
                usageDate3: String(row['Usage Date 3'] || ''),
                // expectedRental: row['Expected Rental'] ? Number(row['Expected Rental']) : undefined,
                circle: String(row.Circle || ''),
            }));
            console.log(`📊 Loaded ${this.testPlans.length} test plans from Testplan sheet`);
        }
        // Load Plan details sheet
        const planDetailsSheet = workbook.Sheets['Plan details'];
        if (planDetailsSheet) {
            const rawData = XLSX.utils.sheet_to_json(planDetailsSheet);
            for (const row of rawData) {
                const planName = String(row['Plan Name'] || '');
                if (!planName)
                    continue;
                const planDetail = {
                    attributes: String(row.Attributes || ''),
                    planName: planName,
                    soc: String(row.SOC || ''),
                    baseData: String(row['Base Data'] || ''),
                    recPack: String(row['RECC Pack'] || ''),
                    rolloverData: String(row['Rollover Data (upto)'] || 'N/A'),
                    secondaryPlanToBeMapped: String(row['Secondary Plan to be mapped'] || ''),
                    sharingPack: String(row['Sharing Pack'] || ''),
                    highValueFreeSecondarys: Number(row['High Value (Free Secondarys)']) || 0,
                    paidSecondarys: Number(row['Paid Secondarys']) || 0,
                    displayValueTotalSecondaries: Number(row['Display Value (Total Secondaries)']) || 0,
                    voiceSMS: String(row['Voice, SMS'] || ''),
                    rental: Number(row.Rental) || 0,
                    cyb: String(row.CYB || ''),
                    liferayCatalogConfig: String(row['Liferay Catalog configuration'] || ''),
                    segment: String(row.Segment || ''),
                    applicableCircles: String(row['Applicable Circles'] || ''),
                    activationVerbiage: String(row['Activation / Plan Change'] || ''),
                    removalVerbiage: String(row.Removal || ''),
                };
                this.planDetails.set(planName, planDetail);
            }
            console.log(`📊 Loaded ${this.planDetails.size} plan details from Plan details sheet`);
        }
    }
    /**
     * Get all test plans
     */
    getTestPlans() {
        return this.testPlans;
    }
    /**
     * Get plan details by plan name
     */
    getPlanDetails(planName) {
        // Try exact match first
        if (this.planDetails.has(planName)) {
            return this.planDetails.get(planName);
        }
        // Try case-insensitive partial match
        for (const [name, details] of this.planDetails.entries()) {
            if (name.toLowerCase().includes(planName.toLowerCase()) ||
                planName.toLowerCase().includes(name.toLowerCase())) {
                return details;
            }
        }
        return undefined;
    }
    /**
     * Match test plan with plan details and perform word-by-word analysis
     */
    matchPlanWithDetails(testRow) {
        const planDetails = this.getPlanDetails(testRow.planName);
        if (!planDetails) {
            return {
                testRow,
                planDetails: {},
                matchScore: 0,
                matchedFields: [],
                mismatchedFields: [{ field: 'Plan Name', expected: testRow.planName, actual: 'Not found' }],
            };
        }
        const matchedFields = [];
        const mismatchedFields = [];
        // 1. Plan Name validation (word-by-word)
        const planNameMatch = this.wordByWordCompare(testRow.planName, planDetails.planName);
        if (planNameMatch.isMatch) {
            matchedFields.push('Plan Name');
        }
        else {
            mismatchedFields.push({ field: 'Plan Name', expected: testRow.planName, actual: planDetails.planName });
        }
        // 2. Rental validation
        if (testRow.expectedRental) {
            if (Math.abs(testRow.expectedRental - planDetails.rental) < 1) {
                matchedFields.push('Rental');
            }
            else {
                mismatchedFields.push({ field: 'Rental', expected: String(testRow.expectedRental), actual: String(planDetails.rental) });
            }
        }
        // 3. Voice/SMS benefits validation
        const voiceSMSMatch = this.validateVoiceSMSBenefits(planDetails.voiceSMS);
        matchedFields.push(...voiceSMSMatch.matched);
        mismatchedFields.push(...voiceSMSMatch.mismatched);
        // 4. Data benefit validation
        const dataMatch = this.validateDataBenefits(planDetails.baseData);
        matchedFields.push(...dataMatch.matched);
        mismatchedFields.push(...dataMatch.mismatched);
        // 5. Secondary members validation
        const secondaryMatch = this.validateSecondaryMembers(planDetails);
        matchedFields.push(...secondaryMatch.matched);
        mismatchedFields.push(...secondaryMatch.mismatched);
        // 6. Activation verbiage word-by-word validation
        const verbiageMatch = this.validateActivationVerbiage(planDetails.activationVerbiage, testRow.planName);
        if (verbiageMatch.isMatch) {
            matchedFields.push('Activation Verbiage');
        }
        else {
            mismatchedFields.push({ field: 'Activation Verbiage', expected: 'Should contain plan details', actual: verbiageMatch.issues.join('; ') });
        }
        const matchScore = (matchedFields.length / (matchedFields.length + mismatchedFields.length)) * 100;
        return {
            testRow,
            planDetails,
            matchScore,
            matchedFields,
            mismatchedFields,
        };
    }
    /**
     * Word-by-word comparison between expected and actual text
     */
    wordByWordCompare(expected, actual) {
        const expectedWords = expected.toLowerCase().split(/\s+/);
        const actualWords = actual.toLowerCase().split(/\s+/);
        const matchedWords = [];
        const missingWords = [];
        const extraWords = [];
        // Check which expected words are present in actual
        for (const word of expectedWords) {
            if (actualWords.some(aw => aw.includes(word) || word.includes(aw))) {
                matchedWords.push(word);
            }
            else {
                missingWords.push(word);
            }
        }
        // Check for extra words in actual
        for (const word of actualWords) {
            if (!expectedWords.some(ew => ew.includes(word) || word.includes(ew))) {
                extraWords.push(word);
            }
        }
        const isMatch = missingWords.length === 0;
        return { isMatch, matchedWords, missingWords, extraWords };
    }
    /**
     * Validate Voice and SMS benefits
     */
    validateVoiceSMSBenefits(voiceSMS) {
        const matched = [];
        const mismatched = [];
        const expectedVoice = 'Unlimited Calls';
        const expectedSMS = '3000 SMS per month';
        if (voiceSMS.toLowerCase().includes('unlimited')) {
            matched.push('Voice Benefits');
        }
        else {
            mismatched.push({ field: 'Voice Benefits', expected: expectedVoice, actual: voiceSMS });
        }
        if (voiceSMS.includes('3000')) {
            matched.push('SMS Benefits');
        }
        else {
            mismatched.push({ field: 'SMS Benefits', expected: expectedSMS, actual: voiceSMS });
        }
        return { matched, mismatched };
    }
    /**
     * Validate Data benefits
     */
    validateDataBenefits(baseData) {
        const matched = [];
        const mismatched = [];
        const expectedData = 'Unlimited (300 GB throttling)';
        if (baseData.toLowerCase().includes('unlimited') && baseData.includes('300')) {
            matched.push('Data Benefits');
        }
        else {
            mismatched.push({ field: 'Data Benefits', expected: expectedData, actual: baseData });
        }
        return { matched, mismatched };
    }
    /**
     * Validate secondary members configuration
     */
    validateSecondaryMembers(details) {
        const matched = [];
        const mismatched = [];
        if (details.highValueFreeSecondarys > 0) {
            matched.push(`Free Secondarys: ${details.highValueFreeSecondarys}`);
        }
        if (details.paidSecondarys >= 0) {
            matched.push(`Paid Secondarys: ${details.paidSecondarys}`);
        }
        return { matched, mismatched };
    }
    /**
     * Validate activation verbiage contains all key plan elements
     */
    validateActivationVerbiage(verbiage, planName) {
        const issues = [];
        const requiredElements = [
            { keyword: planName.toLowerCase(), description: 'Plan name' },
            { keyword: 'rental', description: 'Rental amount' },
            { keyword: 'unlimited', description: 'Unlimited benefits' },
            { keyword: '3000', description: 'SMS limit' },
            { keyword: 'gst', description: 'GST mention' },
        ];
        for (const element of requiredElements) {
            if (!verbiage.toLowerCase().includes(element.keyword)) {
                issues.push(`Missing: ${element.description}`);
            }
        }
        return { isMatch: issues.length === 0, issues };
    }
    /**
     * Generate detailed comparison report
     */
    generateComparisonReport(matchResult) {
        const report = [];
        report.push('='.repeat(80));
        report.push(`📋 PLAN COMPARISON REPORT - ${matchResult.testRow.planName}`);
        report.push('='.repeat(80));
        report.push(`MSISDN: ${matchResult.testRow.msisdn}`);
        report.push(`Circle: ${matchResult.testRow.circle}`);
        report.push(`Match Score: ${matchResult.matchScore.toFixed(2)}%`);
        report.push('');
        report.push('✅ MATCHED FIELDS:');
        for (const field of matchResult.matchedFields) {
            report.push(`   ✓ ${field}`);
        }
        if (matchResult.mismatchedFields.length > 0) {
            report.push('');
            report.push('❌ MISMATCHED FIELDS:');
            for (const mismatch of matchResult.mismatchedFields) {
                report.push(`   ✗ ${mismatch.field}`);
                report.push(`     Expected: ${mismatch.expected}`);
                report.push(`     Actual:   ${mismatch.actual}`);
            }
        }
        report.push('');
        report.push('='.repeat(80));
        return report.join('\n');
    }
}
exports.ExcelDataService = ExcelDataService;
