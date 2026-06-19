/**
 * invoice.types.ts
 * Type definitions for invoice data extraction and validation
 * Comprehensive types for Vodafone Idea telecom invoice processing
 */

// ============================================================================
// Core Invoice Data Structure
// ============================================================================

export interface InvoiceData {
    // Header Information
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    billCycle: string;
    
    // Customer Information
    customerName: string;
    mobileNumber: string;
    accountNumber: string;
    circle: string;
    
    // Financial Details
    totalAmountDue: number;
    previousBalance: number;
    paymentsReceived: number;
    adjustments: number;
    currentCharges: number;
    latePaymentCharges: number;
    outstandingBalance: number;
    
    // Tax Breakdown
    taxes: TaxBreakdown;
    
    // Plan & Usage
    planName: string;
    usageDetails: UsageDetails;
    
    // Itemized Charges
    charges: ChargeItem[];
    
    // Discounts & Credits
    discounts: DiscountItem[];
    
    // Billing Details
    billingAddress: string;
    emailId: string;
    paymentMode: string;
    billFormat: string;
    
    // Additional Information
    gstNumber?: string;
    panNumber?: string;
    additionalNotes?: string;
    
    // Metadata
    extractedAt: string;
    confidence: number;
    extractionMethod: 'ai' | 'rule-based' | 'hybrid';
}

// ============================================================================
// Supporting Interfaces
// ============================================================================

export interface TaxBreakdown {
    cgst?: number;
    sgst?: number;
    igst?: number;
    cess?: number;
    total: number;
}

export interface UsageDetails {
    data: {
        totalGB: number;
        consumedGB: number;
        remainingGB: number;
        overageCharges?: number;
        planName?: string;
    };
    voice: {
        totalMinutes: number;
        consumedMinutes: number;
        local: number;
        std: number;
        roaming: number;
        incoming: number;
        outgoing: number;
        overageCharges?: number;
    };
    sms: {
        total: number;
        sent: number;
        received: number;
        overageCharges?: number;
    };
    roaming?: {
        dataUsed: number;
        voiceMinutes: number;
        smsSent: number;
        roamingCharges: number;
        country?: string;
    };
}

export interface ChargeItem {
    id?: string;
    description: string;
    amount: number;
    quantity?: number;
    rate?: number;
    date?: string;
    type: 'usage' | 'service' | 'fee' | 'tax' | 'discount' | 'other';
    subType?: string;
}

export interface DiscountItem {
    description: string;
    amount: number;
    type: 'promotional' | 'loyalty' | 'adjustment' | 'cashback' | 'other';
    validUntil?: string;
}

// ============================================================================
// Validation Results
// ============================================================================

export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    data?: InvoiceData;
    confidence: number;
    suggestions?: string[];
}

export interface InvoiceComparisonResult {
    expected: Partial<InvoiceData>;
    actual: InvoiceData;
    matches: boolean;
    differences: Array<{
        field: string;
        expected: any;
        actual: any;
        severity: 'critical' | 'warning' | 'info';
    }>;
}

// ============================================================================
// PDF Extraction & Page Object Types
// ============================================================================

export interface ChargeLineItem {
    description: string;
    charges: number;
    chargeUnit?: string;
    quantity?: number;
}

export interface UsageLineItem {
    date: string;
    time?: string;
    type: 'Internet' | 'Call' | 'SMS';
    usage: string;
    charges: number;
    kbUsed?: number;
    duration?: string;
}

export interface InvoiceRow {
    invoiceDate: string;
    invoiceNumber: string;
    parsedDate: Date | null;
    element: WebdriverIO.Element;
}

// ============================================================================
// PDF Validation Result (from SiebelBillingPage)
// ============================================================================

export interface InvoicePDFValidationResult {
    // Point 1: Basic Info
    mobileNumber: string;
    planName: string;
    planRental: number;
    billCycle: string;
    totalAmountDue: number;

    // Point 2: Bill Summary
    currentBill: number;
    pastBills: Array<{ period: string; amount: number }>;

    // Point 3: Account Details
    customerName: string;
    accountNumber: string;
    billingAddress: string;
    gstNumber: string;
    dueDate: string;

    // Point 4: Usage Details
    planRentalDetails: ChargeLineItem[];
    vasCharges: ChargeLineItem[];
    itemisedCalls: UsageLineItem[];

    // Point 5: All Charges (non-zero only)
    allCharges: ChargeLineItem[];

    // Point 6: Usage by Date
    dataUsageByDate: Record<string, UsageLineItem[]>;
    smsUsageByDate: Record<string, UsageLineItem[]>;
    callUsageByDate: Record<string, UsageLineItem[]>;
    dataTotalKB: Record<string, number>;
    dataTotalCharges: Record<string, number>;
    smsTotalCharges: Record<string, number>;
    callTotalCharges: Record<string, number>;

    // AI Extracted Data
    aiExtracted?: Partial<InvoiceData>;

    // Validation Flags
    validations: {
        mobileNumberMatch: boolean;
        planNameMatch: boolean;
        rentalMatch: boolean;
        callingUsagePresent: boolean;
        smsUsagePresent: boolean;
        dataUsagePresent: boolean;
        chargesNonZero: boolean;
        usageDatesFound: boolean[];
    };

    // Outputs
    screenshots: string[];
    reportPath: string;
}

// ============================================================================
// Excel Test Data Types
// ============================================================================

export interface TestPlanRow {
    msisdn: string;
    username: string;
    password: string;
    planName: string;
    activationDate: string;
    activationTillDate: string;
    invoiceDate: string;
    calling: 'Yes' | 'No';
    sms: 'Yes' | 'No';
    data: 'Yes' | 'No';
    usageDate1: string;
    usageDate2: string;
    usageDate3: string;
    expectedRental?: number;
    circle: string;
}

export interface PlanDetails {
    attributes: string;
    planName: string;
    soc: string;
    baseData: string;
    recPack: string;
    rolloverData: string;
    secondaryPlanToBeMapped: string;
    sharingPack: string;
    highValueFreeSecondarys: number;
    paidSecondarys: number;
    displayValueTotalSecondaries: number;
    voiceSMS: string;
    rental: number;
    cyb: string;
    liferayCatalogConfig: string;
    segment: string;
    applicableCircles: string;
    activationVerbiage: string;
    removalVerbiage: string;
}

export interface PlanMatchResult {
    testRow: TestPlanRow;
    planDetails: PlanDetails;
    matchScore: number;
    matchedFields: string[];
    mismatchedFields: Array<{ field: string; expected: string; actual: string }>;
}

// ============================================================================
// Word-by-Word Analysis Types
// ============================================================================

export interface WordMatchResult {
    isMatch: boolean;
    expectedWords: string[];
    foundWords: string[];
    missingWords: string[];
    matchPercentage: number;
}

export interface InvoiceValidationReport {
    testCase: TestPlanRow;
    planDetails: PlanDetails;
    
    accountDetails: {
        isValid: boolean;
        mobileNumberMatch: boolean;
        accountNumberPresent: boolean;
        customerNamePresent: boolean;
        billPeriodMatch: boolean;
        dueDatePresent: boolean;
        details: string[];
    };
    
    planDetailsValidation: {
        isValid: boolean;
        planNameMatch: boolean;
        rentalMatch: boolean;
        benefitsMatch: boolean;
        details: string[];
    };
    
    chargeSummary: {
        isValid: boolean;
        oneTimeChargesValid: boolean;
        monthlyChargesValid: boolean;
        usageChargesValid: boolean;
        discountsValid: boolean;
        totalAmountValid: boolean;
        details: string[];
    };
    
    usageValidation: {
        isValid: boolean;
        callingUsagePresent: boolean;
        smsUsagePresent: boolean;
        dataUsagePresent: boolean;
        usageDatesMatched: string[];
        details: string[];
    };
    
    irChargesValidation: {
        isValid: boolean;
        irChargesPresent: boolean;
        details: string[];
    };
    
    wordByWordAnalysis: {
        planNameMatch: WordMatchResult;
        benefitsMatch: WordMatchResult;
        rentalMatch: WordMatchResult;
        activationVerbiageMatch: WordMatchResult;
    };
    
    overallStatus: 'PASS' | 'FAIL' | 'PARTIAL';
    overallScore: number;
    screenshots: string[];
}

// ============================================================================
// AI Service Types
// ============================================================================

export interface AIExtractionConfig {
    model: string;
    temperature: number;
    maxTokens: number;
    apiKey?: string;
    baseURL?: string;
}

export interface ExtractionPrompt {
    systemPrompt: string;
    userPrompt: string;
    expectedFields: string[];
}

// ============================================================================
// Reporting Types
// ============================================================================

export interface ExcelReportData {
    timestamp: string;
    testCases: Array<{
        msisdn: string;
        planName: string;
        status: 'PASS' | 'FAIL' | 'PARTIAL';
        score: number;
        validations: Record<string, boolean>;
        errors: string[];
        warnings: string[];
        reportPath: string;
        screenshotCount: number;
    }>;
    summary: {
        total: number;
        passed: number;
        failed: number;
        partial: number;
        averageScore: number;
    };
}

export interface HTMLReportOptions {
    includeScreenshots: boolean;
    includeRawData: boolean;
    theme: 'light' | 'dark';
    outputPath: string;
}

// ============================================================================
// Constants & Enums
// ============================================================================

export enum InvoiceSection {
    ACCOUNT_DETAILS = 'Account Details',
    PLAN_DETAILS = 'Plan Details',
    CHARGE_SUMMARY = 'Charge Summary',
    USAGE_DETAILS = 'Usage Details',
    VAS_CHARGES = 'Value Added Services',
    ITEMISED_CALLS = 'Itemised Calls',
    PAST_BILLS = 'Past Bill Summary',
    TAX_BREAKDOWN = 'Tax Breakdown'
}

export enum ValidationSeverity {
    CRITICAL = 'critical',
    WARNING = 'warning',
    INFO = 'info'
}

export enum PlanBenefitType {
    VOICE = 'voice',
    SMS = 'sms',
    DATA = 'data',
    ROAMING = 'roaming',
    VAS = 'vas'
}

// ============================================================================
// Helper Types for Partial Updates
// ============================================================================

export type PartialInvoiceData = Partial<InvoiceData>;
export type PartialValidationResult = Partial<ValidationResult>;

export interface InvoiceDataUpdate {
    field: keyof InvoiceData;
    value: any;
    confidence: number;
    source: 'ai' | 'rule' | 'manual';
}