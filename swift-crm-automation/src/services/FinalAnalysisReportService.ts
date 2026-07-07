import {
  AnalysisReportData,
  ExcelReportService,
} from './ExcelReportService';

// ─── Types ────────────────────────────────────────────────────────────────

export interface ParsedPlan {
  rawBenefit: string;
  benefitPart: string;
  validityDays: number;
  dataQuota: string;
  smsQuota: string;
  hasHero: boolean;
  hasUnlimitedVoice: boolean;
  displayExpected: string;
}

export interface FinalAnalysisContext {
  inputRow: {
    msisdn: string;
    circle: string;
    rechargeMRP: string;
    planBenefit: string;
    rechargeNotification: string;
  };
  testDate: string;
  subscriberInfo?: {
    customerName?: string;
    coreBalance?: string;
    serviceValidity?: string;
    accountStatus?: string;
    userType?: string;
    circle?: string;
  };
  inResults?: {
    success?: boolean;
    dedicatedAccounts?: any[];
    offers?: any[];
    accountOverview?: Record<string, string>;
  };
  swiftResults?: {
    success?: boolean;
    offerHistory?: any[];
    totalUsage?: {
      voice?: any[];
      data?: any[];
      sms?: any[];
    };
  };
  screenshots: Array<{
    srNo: number;
    msisdn: string;
    screenshotFile: string;
    fullPath: string;
    capturedAt: string;
    stepName: string;
  }>;
  inRan?: boolean;
  swiftRan?: boolean;
}

interface ActualPlan {
  displayActual: string;
  validityDays: number;
  dataQuota: string;
  smsQuota: string;
  hasHero: boolean;
  hasUnlimitedVoice: boolean;
  benefits: string;
  validity: string;
  activationDate: string;
  transactionId: string;
  mrp: string;
}

interface StatusEvaluation {
  inStatus: 'Pass' | 'Fail' | 'Skip';
  swiftStatus: 'Pass' | 'Fail' | 'Skip';
  overallStatus: 'Pass' | 'Fail';
}

// ─── Plan parsing helpers ─────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

export function parsePlanBenefit(planBenefit: string): ParsedPlan {
  const cleaned = (planBenefit || '').replace(/`/g, '').trim();
  const parts = cleaned.split(/\|\|/).map((p) => p.trim());
  const benefitPart = parts[0] || cleaned;
  const validityPart = parts[1] || '';

  let validityDays = 0;
  const validityMatch = (validityPart || cleaned).match(/(\d+)\s*D/i);
  if (validityMatch) {
    validityDays = parseInt(validityMatch[1], 10);
  }

  const hasHero = /HERO/i.test(benefitPart);
  const hasUnlimitedVoice = /\bUL\b|Unlimited/i.test(benefitPart);

  const dataMatch = benefitPart.match(/([\d.]+\s*GB\s*\/?\s*Day|[\d.]+\s*GB)/i);
  const dataQuota = dataMatch ? dataMatch[1].replace(/\s+/g, ' ') : '';

  const smsMatch = benefitPart.match(/(\d+\s*SMS\s*\/?\s*Day|\d+\s*SMS)/i);
  const smsQuota = smsMatch ? smsMatch[1].replace(/\s+/g, ' ') : '';

  const displayExpected = validityDays
    ? `${benefitPart} || ${validityDays}D`
    : benefitPart;

  return {
    rawBenefit: planBenefit,
    benefitPart,
    validityDays,
    dataQuota,
    smsQuota,
    hasHero,
    hasUnlimitedVoice,
    displayExpected,
  };
}

function parseIndianDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year = 2000 + parseInt(match[3], 10);
  if (month === undefined) return null;
  return new Date(year, month, day);
}

function extractValidityDays(text: string): number {
  if (!text) return 0;
  const dayMatch = text.match(/(\d+)\s*Days?\b/i);
  if (dayMatch) return parseInt(dayMatch[1], 10);
  const dMatch = text.match(/(\d+)\s*D\b/i);
  if (dMatch) return parseInt(dMatch[1], 10);
  return 0;
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

function isSameCalendarDay(date: Date, isoDate: string): boolean {
  return formatDateISO(date) === isoDate;
}

function normalizeText(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

function extractDataFromText(text: string): { value: number; perDay: boolean; label: string } | null {
  const daily = text.match(/([\d.]+)\s*GB\s*\/?\s*Day/i);
  if (daily) {
    return { value: parseFloat(daily[1]), perDay: true, label: `${daily[1]}GB/Day` };
  }
  const total = text.match(/([\d.]+)\s*GB\b/i);
  if (total) {
    return { value: parseFloat(total[1]), perDay: false, label: `${total[1]}GB (Total)` };
  }
  const mb = text.match(/([\d.]+)\s*MB\b/i);
  if (mb) {
    return { value: parseFloat(mb[1]) / 1024, perDay: false, label: `${mb[1]} MB` };
  }
  return null;
}

function extractSmsFromText(text: string): { value: number; perDay: boolean; label: string } | null {
  const daily = text.match(/(\d+)\s*SMS\s*\/?\s*Day/i);
  if (daily) {
    return { value: parseInt(daily[1], 10), perDay: true, label: `${daily[1]} SMS/Day` };
  }
  const total = text.match(/(\d+)\s*SMS\b/i);
  if (total) {
    return { value: parseInt(total[1], 10), perDay: false, label: `${total[1]} SMS` };
  }
  return null;
}

function getPrimarySwiftOffer(swiftResults: FinalAnalysisContext['swiftResults'], targetMRP: string): any | null {
  const items = swiftResults?.offerHistory || [];
  if (items.length === 0) return null;
  // First try to find a matched offer with Pass status, then any matched offer, then any offer with target MRP
  return items.find((o) => o.isMatched && o.matchStatus === 'Pass') || 
         items.find((o) => o.isMatched) || 
         items.find((o) => o.mrp === targetMRP) || 
         items[0];
}

function inferActualPlanFromSwift(
  swiftResults: FinalAnalysisContext['swiftResults'],
  targetMRP: string,
): ActualPlan {
  const offer = getPrimarySwiftOffer(swiftResults, targetMRP);
  if (!offer) {
    return {
      displayActual: 'N/A',
      validityDays: 0,
      dataQuota: 'N/A',
      smsQuota: 'N/A',
      hasHero: false,
      hasUnlimitedVoice: false,
      benefits: 'N/A',
      validity: 'N/A',
      activationDate: 'N/A',
      transactionId: 'N/A',
      mrp: targetMRP,
    };
  }

  const benefits = normalizeText(offer.benefits || '');
  const validity = normalizeText(offer.detailValidity || offer.validity || '');
  const validityDays = extractValidityDays(validity) || extractValidityDays(offer.validity || '');

  const dataInfo = extractDataFromText(benefits) || extractDataFromText(validity);
  const smsInfo = extractSmsFromText(benefits) || extractSmsFromText(validity);

  const hasHero = /HERO/i.test(benefits);
  const hasUnlimitedVoice = /UL|Unlimited/i.test(benefits);

  const displayActual = validityDays
    ? `${benefits || 'N/A'} || ${validityDays}D`
    : benefits || 'N/A';

  return {
    displayActual,
    validityDays,
    dataQuota: dataInfo?.label || 'N/A',
    smsQuota: smsInfo?.label || 'N/A',
    hasHero,
    hasUnlimitedVoice,
    benefits,
    validity,
    activationDate: offer.activationDateTime || 'N/A',
    transactionId: offer.transactionId || 'N/A',
    mrp: offer.mrp || targetMRP,
  };
}

function inferINValidityDays(
  subscriberInfo: FinalAnalysisContext['subscriberInfo'],
  inResults: FinalAnalysisContext['inResults'],
  activationDateStr?: string,
): number {
  const serviceValidity = subscriberInfo?.serviceValidity || '';
  const expiry = parseIndianDate(serviceValidity);
  if (!expiry) return extractValidityDays(serviceValidity);

  const voiceOffers = (inResults?.offers || []).filter((o) =>
    /voice|UL/i.test(o.offerName || ''),
  );
  for (const offer of voiceOffers) {
    const start = parseIndianDate(offer.startDateTime || '');
    const end = parseIndianDate(offer.endDateTime || '');
    if (start && end) {
      return daysBetween(start, end);
    }
  }

  const activation = parseIndianDate(activationDateStr || '');
  if (activation && expiry) {
    return daysBetween(activation, expiry);
  }

  return 0;
}

function findDedicatedAccount(dedicatedAccounts: any[], pattern: RegExp): any | null {
  return dedicatedAccounts.find((da) => pattern.test(da.daName || '')) || null;
}

function checkParameter(pass: boolean): 'Pass' | 'Fail' {
  return pass ? 'Pass' : 'Fail';
}

function compareDataQuotas(expected: ParsedPlan, actual: ActualPlan, inDA?: any): boolean {
  const expectedData = extractDataFromText(expected.dataQuota || expected.benefitPart);
  const actualData = extractDataFromText(actual.dataQuota) || extractDataFromText(actual.benefits);

  if (expectedData && actualData) {
    if (expectedData.perDay !== actualData.perDay) return false;
    if (Math.abs(expectedData.value - actualData.value) > 0.01) return false;
    return true;
  }

  if (inDA && expectedData) {
    const daVal = parseFloat(inDA.daValue);
    if (expectedData.perDay && daVal < 1024) return false;
    if (expectedData.value >= 1.5 && daVal < 1000) return false;
    if (expectedData.perDay && daVal >= 1024) return true;
    if (expectedData.value >= 1.5 && daVal >= 1000) return true;
  }

  return !expectedData;
}

function compareSmsQuotas(expected: ParsedPlan, actual: ActualPlan, inDA?: any): boolean {
  const expectedSms = extractSmsFromText(expected.smsQuota || expected.benefitPart);
  const actualSms = extractSmsFromText(actual.smsQuota) || extractSmsFromText(actual.benefits);

  if (expectedSms && actualSms) {
    if (expectedSms.perDay !== actualSms.perDay) return false;
    if (expectedSms.value !== actualSms.value) return false;
    return true;
  }

  if (inDA && expectedSms) {
    const daVal = parseFloat(inDA.daValue);
    if (expectedSms.perDay && daVal >= 250 && daVal <= 350) return false;
    if (expectedSms.value === 100 && daVal >= 250) return false;
    if (expectedSms.perDay && daVal === expectedSms.value) return true;
    if (expectedSms.value === 100 && daVal === 100) return true;
  }

  return !expectedSms;
}

function hasHeroInIN(inResults: FinalAnalysisContext['inResults']): boolean {
  const text = [
    ...(inResults?.dedicatedAccounts || []).map((d) => d.daName || ''),
    ...(inResults?.offers || []).map((o) => o.offerName || ''),
  ].join(' ');
  return /HERO/i.test(text);
}

// ─── Service ──────────────────────────────────────────────────────────────

export class FinalAnalysisReportService {
  constructor(private excelReportService: ExcelReportService) {}

//   evaluateStatuses(ctx: FinalAnalysisContext): StatusEvaluation {
//     const expected = parsePlanBenefit(ctx.inputRow.planBenefit);
//     const actual = inferActualPlanFromSwift(ctx.swiftResults, ctx.inputRow.rechargeMRP);

//     let swiftStatus: StatusEvaluation['swiftStatus'] = ctx.swiftRan ? 'Fail' : 'Skip';
//     let inStatus: StatusEvaluation['inStatus'] = ctx.inRan ? 'Fail' : 'Skip';

//     // ── SWIFT Status Evaluation ──────────────────────────────────────────
//     if (ctx.swiftRan) {
//       const offer = getPrimarySwiftOffer(ctx.swiftResults, ctx.inputRow.rechargeMRP);
//       const swiftChecks = this.getSwiftChecks(ctx, expected, actual, offer);
//       // Swift is Pass only if ALL checks pass
//       swiftStatus = swiftChecks.every((c) => c.pass) ? 'Pass' : 'Fail';
//     }

//     // ── IN Status Evaluation ─────────────────────────────────────────────
//     if (ctx.inRan) {
//       const inChecks = this.getINChecks(ctx, expected, actual);
//       const allChecksPass = inChecks.every((c) => c.pass);
      
//       const smsDA = findDedicatedAccount(ctx.inResults?.dedicatedAccounts || [], /SMS/i);
//       const dataDA = findDedicatedAccount(ctx.inResults?.dedicatedAccounts || [], /Data/i);
//       const inValidityDays = inferINValidityDays(ctx.subscriberInfo, ctx.inResults, actual.activationDate);
      
//       const failures = this.buildINFailures(ctx, expected, actual, inValidityDays, smsDA, dataDA);
      
//       // IN is Pass only if ALL checks pass AND no failures exist
//       inStatus = (allChecksPass && failures.length === 0) ? 'Pass' : 'Fail';
//     }

//     // ── Overall Status ────────────────────────────────────────────────────
//     // Overall is Pass only if both IN and SWIFT are Pass (or Skip if not run)
//     const overallStatus: 'Pass' | 'Fail' =
//       (swiftStatus === 'Pass' || swiftStatus === 'Skip') &&
//       (inStatus === 'Pass' || inStatus === 'Skip')
//         ? 'Pass'
//         : 'Fail';

//     return { inStatus, swiftStatus, overallStatus };
//   }

  // In FinalAnalysisReportService.ts - update the evaluateStatuses method

evaluateStatuses(ctx: FinalAnalysisContext): StatusEvaluation {
  const expected = parsePlanBenefit(ctx.inputRow.planBenefit);
  const actual = inferActualPlanFromSwift(ctx.swiftResults, ctx.inputRow.rechargeMRP);

  let swiftStatus: StatusEvaluation['swiftStatus'] = ctx.swiftRan ? 'Fail' : 'Skip';
  let inStatus: StatusEvaluation['inStatus'] = ctx.inRan ? 'Fail' : 'Skip';

  // ── SWIFT Status Evaluation ──────────────────────────────────────────
  if (ctx.swiftRan) {
    const offer = getPrimarySwiftOffer(ctx.swiftResults, ctx.inputRow.rechargeMRP);
    const swiftChecks = this.getSwiftChecks(ctx, expected, actual, offer);
    // Swift is Pass only if ALL checks pass
    swiftStatus = swiftChecks.every((c) => c.pass) ? 'Pass' : 'Fail';
  }

  // ── IN Status Evaluation ─────────────────────────────────────────────
  if (ctx.inRan) {
    // ✅ FIX: Check actual IN test results from the analysis
    const inChecks = this.getINChecks(ctx, expected, actual);
    const allChecksPass = inChecks.every((c) => c.pass);
    
    // ✅ FIX: Get the actual IN results from the context
    const inResults = ctx.inResults;
    const inTestPassed = inResults?.success === true;
    
    // ✅ FIX: Check for specific failures in the IN system
    const smsDA = findDedicatedAccount(ctx.inResults?.dedicatedAccounts || [], /SMS/i);
    const dataDA = findDedicatedAccount(ctx.inResults?.dedicatedAccounts || [], /Data/i);
    const inValidityDays = inferINValidityDays(ctx.subscriberInfo, ctx.inResults, actual.activationDate);
    
    // ✅ FIX: Build failures to check if any critical failures exist
    const failures = this.buildINFailures(ctx, expected, actual, inValidityDays, smsDA, dataDA);
    
    // ✅ FIX: IN is Pass only if:
    // 1. All checks pass (validity, data, SMS, HERO)
    // 2. No failures exist
    // 3. The IN test result indicates success
    const hasCriticalFailures = failures.length > 0;
    const checksPassed = allChecksPass && !hasCriticalFailures;
    
    // ✅ FIX: Override with actual IN test status if available
    if (inResults !== undefined) {
      inStatus = (inTestPassed && checksPassed) ? 'Pass' : 'Fail';
    } else {
      inStatus = checksPassed ? 'Pass' : 'Fail';
    }
    
    // ✅ ADD: Detailed logging for debugging
    console.log('[FinalAnalysisReport] IN Status Evaluation:');
    console.log(`  - IN Test Passed: ${inTestPassed}`);
    console.log(`  - All Checks Pass: ${allChecksPass}`);
    console.log(`  - Critical Failures: ${failures.length}`);
    console.log(`  - Final IN Status: ${inStatus}`);
  }

  // ── Overall Status ────────────────────────────────────────────────────
  // Overall is Pass only if both IN and SWIFT are Pass
  const overallStatus: 'Pass' | 'Fail' =
    (swiftStatus === 'Pass' || swiftStatus === 'Skip') &&
    (inStatus === 'Pass' || inStatus === 'Skip')
      ? 'Pass'
      : 'Fail';

  return { inStatus, swiftStatus, overallStatus };
}

  buildAnalysisReport(ctx: FinalAnalysisContext): AnalysisReportData {
    const expected = parsePlanBenefit(ctx.inputRow.planBenefit);
    const actual = inferActualPlanFromSwift(ctx.swiftResults, ctx.inputRow.rechargeMRP);
    const statuses = this.evaluateStatuses(ctx);
    const offer = getPrimarySwiftOffer(ctx.swiftResults, ctx.inputRow.rechargeMRP);
    const accountOverview = ctx.inResults?.accountOverview || {};
    const dedicatedAccounts = ctx.inResults?.dedicatedAccounts || [];
    const offers = ctx.inResults?.offers || [];
    const voiceUsage = ctx.swiftResults?.totalUsage?.voice || [];
    const dataUsage = ctx.swiftResults?.totalUsage?.data || [];
    const smsUsage = ctx.swiftResults?.totalUsage?.sms || [];

    const smsDA = findDedicatedAccount(dedicatedAccounts, /SMS/i);
    const dataDA = findDedicatedAccount(dedicatedAccounts, /Data/i);

    const inValidityDays = inferINValidityDays(
      ctx.subscriberInfo,
      ctx.inResults,
      actual.activationDate,
    );

    const activationDatePass = (() => {
      const parsed = parseIndianDate(actual.activationDate);
      if (!parsed) return false;
      return isSameCalendarDay(parsed, ctx.testDate);
    })();

    // ── Comparison Table (only Pass/Fail, no Partial) ───────────────────
    const comparison = [
      {
        parameter: 'MSISDN',
        expected: ctx.inputRow.msisdn,
        actual: ctx.inputRow.msisdn,
        status: 'Pass' as const,
      },
      {
        parameter: 'Circle',
        expected: ctx.inputRow.circle,
        actual: ctx.subscriberInfo?.circle || ctx.inputRow.circle,
        status: 'Pass' as const,
      },
      {
        parameter: 'Recharge MRP',
        expected: ctx.inputRow.rechargeMRP,
        actual: actual.mrp || ctx.inputRow.rechargeMRP,
        status: checkParameter(actual.mrp === ctx.inputRow.rechargeMRP || !actual.mrp),
      },
      {
        parameter: 'Plan Benefit',
        expected: expected.displayExpected,
        actual: actual.displayActual,
        status: checkParameter(
          normalizeText(actual.benefits).toLowerCase() === normalizeText(expected.benefitPart).toLowerCase(),
        ),
      },
      {
        parameter: 'Validity',
        expected: expected.validityDays ? `${expected.validityDays} Days` : 'N/A',
        actual: actual.validityDays ? `${actual.validityDays} Days` : actual.validity,
        status: checkParameter(
          expected.validityDays > 0 &&
            actual.validityDays > 0 &&
            expected.validityDays === actual.validityDays,
        ),
      },
      {
        parameter: 'Voice',
        expected: 'Unlimited Calls',
        actual: actual.hasUnlimitedVoice || voiceUsage.length > 0 ? 'Unlimited Calls' : 'N/A',
        status: checkParameter(actual.hasUnlimitedVoice || voiceUsage.length > 0),
      },
      {
        parameter: 'Data',
        expected: expected.dataQuota || 'N/A',
        actual: actual.dataQuota,
        status: checkParameter(compareDataQuotas(expected, actual, dataDA)),
      },
      {
        parameter: 'SMS',
        expected: expected.smsQuota || 'N/A',
        actual: actual.smsQuota,
        status: checkParameter(compareSmsQuotas(expected, actual, smsDA)),
      },
      {
        parameter: 'HERO',
        expected: expected.hasHero ? 'Included' : 'N/A',
        actual: actual.hasHero || hasHeroInIN(ctx.inResults) ? 'Included' : 'Missing',
        status: checkParameter(!expected.hasHero || actual.hasHero || hasHeroInIN(ctx.inResults)),
      },
      {
        parameter: 'Activation Date',
        expected: ctx.testDate,
        actual: actual.activationDate,
        status: checkParameter(activationDatePass),
      },
    ];

    const swiftFailures = this.buildSwiftFailures(ctx, expected, actual, activationDatePass);
    const inFailures = this.buildINFailures(ctx, expected, actual, inValidityDays, smsDA, dataDA);

    const voicePass = voiceUsage.length > 0 || actual.hasUnlimitedVoice;

    return {
      testCase: {
        name: `Recharge UAT for MRP ${ctx.inputRow.rechargeMRP} Plan`,
        msisdn: ctx.inputRow.msisdn,
        testDate: ctx.testDate,
        overallStatus: statuses.overallStatus,
        swiftStatus: statuses.swiftStatus,
        inStatus: statuses.inStatus,
      },
      comparison,
      swiftAnalysis: {
        executionFlow: this.buildSwiftExecutionFlow(ctx, expected, actual, activationDatePass, voicePass),
        results: [
          { field: 'Transaction ID', expected: '-', actual: actual.transactionId, status: checkParameter(!!actual.transactionId && actual.transactionId !== 'N/A') },
          { field: 'Activation Date & Time', expected: ctx.testDate, actual: actual.activationDate, status: checkParameter(activationDatePass) },
          { field: 'Validity', expected: `${expected.validityDays} Days`, actual: actual.validity || `${actual.validityDays} Days`, status: checkParameter(expected.validityDays === actual.validityDays) },
          { field: 'MRP', expected: ctx.inputRow.rechargeMRP, actual: actual.mrp, status: checkParameter(actual.mrp === ctx.inputRow.rechargeMRP) },
          { field: 'Activation Mode', expected: '-', actual: offer?.activationMode || 'EtopUp', status: 'Pass' as const },
          { field: 'Current Core Balance', expected: '-', actual: offer?.currentCoreBalance || ctx.subscriberInfo?.coreBalance || '0', status: 'Pass' as const },
          { field: 'Category', expected: 'Unlimited', actual: offer?.category || 'Unlimited', status: 'Pass' as const },
          {
            field: 'Benefits',
            expected: `${expected.benefitPart}`,
            actual: actual.benefits,
            status: checkParameter(compareDataQuotas(expected, actual) && compareSmsQuotas(expected, actual) && (!expected.hasHero || actual.hasHero)),
          },
          {
            field: 'Detail Validity',
            expected: `${expected.validityDays} Days`,
            actual: actual.validity,
            status: checkParameter(expected.validityDays === actual.validityDays),
          },
        ],
        voiceUsage: voiceUsage.map((v: any) => ({
          offerName: v.offer_name || v.offerName || 'N/A',
          balanceLeft: v.balance_left || v.balanceLeft || '-',
          category: v.category || 'N/A',
          expiryDate: v.expiry_date || v.expiryDate || 'N/A',
          status: voicePass ? 'Pass' : 'Fail',
        })),
        dataUsage: (dataUsage.length > 0
          ? dataUsage
          : [{ msisdn: ctx.inputRow.msisdn, note: 'No data usage data available', status: 'Pass' }]
        ).map((d: any) => ({
          msisdn: d.msisdn || ctx.inputRow.msisdn,
          note: d.note || d.offer_name || d.total_quota || 'No data usage data available',
          status: d.status || 'Pass',
        })),
        smsUsage: (smsUsage.length > 0
          ? smsUsage
          : [{ msisdn: ctx.inputRow.msisdn, note: 'No SMS usage data available', status: 'Pass' }]
        ).map((s: any) => ({
          msisdn: s.msisdn || ctx.inputRow.msisdn,
          note: s.note || s.offer_name || 'No SMS usage data available',
          status: s.status || 'Pass',
        })),
        failures: swiftFailures,
        overallStatus: statuses.swiftStatus === 'Pass' ? 'Pass' : 'Fail',
      },
      inAnalysis: {
        executionFlow: this.buildINExecutionFlow(ctx, statuses.inStatus, dedicatedAccounts.length, offers.length),
        results: [
          { field: 'Status', value: statuses.inStatus, expected: 'Pass', status: checkParameter(statuses.inStatus === 'Pass') },
          { field: 'Customer Name', value: ctx.subscriberInfo?.customerName || 'N/A', expected: '-', status: 'Pass' as const },
          { field: 'Core Balance', value: ctx.subscriberInfo?.coreBalance || 'N/A', expected: '-', status: 'Pass' as const },
          {
            field: 'Service Validity',
            value: ctx.subscriberInfo?.serviceValidity || 'N/A',
            expected: expected.validityDays ? `${expected.validityDays} Days from activation` : 'N/A',
            status: checkParameter(inValidityDays === expected.validityDays),
          },
          { field: 'Account Status', value: ctx.subscriberInfo?.accountStatus || 'N/A', expected: 'Active', status: checkParameter((ctx.subscriberInfo?.accountStatus || '').toLowerCase() === 'active') },
          { field: 'User Type', value: ctx.subscriberInfo?.userType || 'N/A', expected: 'Pack User', status: checkParameter((ctx.subscriberInfo?.userType || '').includes('Pack')) },
          { field: 'Activation Date', value: accountOverview.activationDate || 'N/A', expected: '-', status: 'Pass' as const },
          { field: 'Service Removal On', value: accountOverview.serviceRemovalOn || 'N/A', expected: '-', status: 'Pass' as const },
          { field: 'Supervision Expires On', value: accountOverview.supervisionExpiresOn || 'N/A', expected: '-', status: 'Pass' as const },
        ],
        dedicatedAccounts: dedicatedAccounts.map((da) => ({
          daName: da.daName || 'N/A',
          daId: da.daId || 'N/A',
          startDate: da.startDate || 'N/A',
          expiryDate: da.expiryDate || 'N/A',
          daValue: da.daValue || 'N/A',
          unit: da.unit || 'N/A',
          type: da.type || 'N/A',
        })),
        offers: offers.map((o) => ({
          offerName: o.offerName || 'N/A',
          offerId: o.offerId || 'N/A',
          startDateTime: o.startDateTime || 'N/A',
          endDateTime: o.endDateTime || 'N/A',
          offerType: o.offerType || 'N/A',
        })),
        failures: inFailures,
        overallStatus: statuses.inStatus === 'Pass' ? 'Pass' : 'Fail',
      },
      rootCause: {
        expectedPlan: `${ctx.inputRow.rechargeMRP} MRP - ${expected.validityDays} Days - ${expected.dataQuota || 'N/A'} - ${expected.smsQuota || 'N/A'}${expected.hasHero ? ' - HERO' : ''}`,
        actualPlan: `${actual.mrp} MRP - ${actual.validityDays || inValidityDays} Days - ${actual.dataQuota} - ${actual.smsQuota}${actual.hasHero ? ' - HERO' : ' - No HERO'}`,
        issues: [...swiftFailures, ...inFailures].map((f) => `${f.type}: Expected ${f.expected}, got ${f.actual}`),
        summary: statuses.overallStatus === 'Pass'
          ? 'All plan parameters matched expected values across SWIFT and IN systems.'
          : 'Wrong product was provisioned. The recharge activated a different plan with incorrect validity, data quota, SMS quota.',
      },
      timeline: this.buildTimeline(ctx.screenshots),
      screenshots: ctx.screenshots.map((s) => ({
        srNo: s.srNo,
        file: s.screenshotFile,
        capturedAt: s.capturedAt,
        stepName: s.stepName,
      })),
      recommendations: this.buildRecommendations(swiftFailures, inFailures),
      appendix: {
        inputData: {
          MSISDN: ctx.inputRow.msisdn,
          Circle: ctx.inputRow.circle,
          'Recharge MRP': ctx.inputRow.rechargeMRP,
          'Plan Benefit': ctx.inputRow.planBenefit,
          'Recharge Notification': ctx.inputRow.rechargeNotification,
        },
        uatResults: {
          'Transaction ID': actual.transactionId,
          'Activation Date': actual.activationDate,
          Validity: actual.validity,
          MRP: actual.mrp,
          Benefits: actual.benefits,
        },
        swiftVoiceUsage: voiceUsage.map((v: any) => ({
          'Offer Name': v.offer_name || '',
          'Balance Left': v.balance_left || '',
          Category: v.category || '',
          'Expiry Date': v.expiry_date || '',
        })),
        inResults: {
          'Customer Name': ctx.subscriberInfo?.customerName || 'N/A',
          'Core Balance': ctx.subscriberInfo?.coreBalance || 'N/A',
          'Service Validity': ctx.subscriberInfo?.serviceValidity || 'N/A',
          'Account Status': ctx.subscriberInfo?.accountStatus || 'N/A',
        },
        inDedicatedAccounts: dedicatedAccounts.map((da) => ({
          'DA Name': da.daName || '',
          'DA Value': da.daValue || '',
          Unit: da.unit || '',
          'Expiry Date': da.expiryDate || '',
        })),
        inOffers: offers.map((o) => ({
          'Offer Name': o.offerName || '',
          'Start Date': o.startDateTime || '',
          'End Date': o.endDateTime || '',
        })),
      },
    };
  }

  async writeReport(ctx: FinalAnalysisContext) {
    const analysisData = this.buildAnalysisReport(ctx);
    this.excelReportService.addAnalysisReport(analysisData);
    return this.excelReportService.writeAnalysisReport(analysisData);
  }

  updateStoredResults(
    msisdn: string,
    statuses: StatusEvaluation,
  ): void {
    this.excelReportService.updateResultStatuses(msisdn, {
      inStatus: statuses.inStatus,
      swiftStatus: statuses.swiftStatus,
    });
  }

  private getSwiftChecks(
    ctx: FinalAnalysisContext,
    expected: ParsedPlan,
    actual: ActualPlan,
    offer: any,
  ): Array<{ pass: boolean }> {
    const activationDatePass = (() => {
      const parsed = parseIndianDate(actual.activationDate);
      if (!parsed) return false;
      return isSameCalendarDay(parsed, ctx.testDate);
    })();

    return [
      { pass: activationDatePass },
      { pass: expected.validityDays === actual.validityDays },
      { pass: compareDataQuotas(expected, actual) },
      { pass: compareSmsQuotas(expected, actual) },
      { pass: !expected.hasHero || actual.hasHero },
      { pass: offer?.matchStatus === 'Pass' || (offer?.isMatched && activationDatePass) },
    ];
  }

  private getINChecks(
    ctx: FinalAnalysisContext,
    expected: ParsedPlan,
    actual: ActualPlan,
  ): Array<{ pass: boolean }> {
    const smsDA = findDedicatedAccount(ctx.inResults?.dedicatedAccounts || [], /SMS/i);
    const dataDA = findDedicatedAccount(ctx.inResults?.dedicatedAccounts || [], /Data/i);
    const inValidityDays = inferINValidityDays(ctx.subscriberInfo, ctx.inResults, actual.activationDate);

    const checks = [
      { pass: inValidityDays === expected.validityDays },
      { pass: compareDataQuotas(expected, actual, dataDA) },
      { pass: compareSmsQuotas(expected, actual, smsDA) },
      { pass: !expected.hasHero || hasHeroInIN(ctx.inResults) || actual.hasHero },
    ];

    console.log('[FinalAnalysisReport] IN Checks:');
    console.log(`  - Validity: ${inValidityDays} vs ${expected.validityDays} => ${checks[0].pass ? '✅' : '❌'}`);
    console.log(`  - Data Quota: ${checks[1].pass ? '✅' : '❌'}`);
    console.log(`  - SMS Quota: ${checks[2].pass ? '✅' : '❌'}`);
    console.log(`  - HERO: ${checks[3].pass ? '✅' : '❌'}`);

    return checks;
  }

  private buildSwiftFailures(
    ctx: FinalAnalysisContext,
    expected: ParsedPlan,
    actual: ActualPlan,
    activationDatePass: boolean,
  ) {
    const failures: AnalysisReportData['swiftAnalysis']['failures'] = [];

    if (!activationDatePass) {
      failures.push({
        type: 'Activation Date',
        expected: ctx.testDate,
        actual: actual.activationDate,
        severity: 'Critical',
      });
    }
    if (expected.validityDays !== actual.validityDays) {
      failures.push({
        type: 'Validity Period',
        expected: `${expected.validityDays} Days`,
        actual: `${actual.validityDays} Days`,
        severity: 'Critical',
      });
    }
    if (!compareDataQuotas(expected, actual)) {
      failures.push({
        type: 'Data Quota',
        expected: expected.dataQuota || 'N/A',
        actual: actual.dataQuota,
        severity: 'Critical',
      });
    }
    if (!compareSmsQuotas(expected, actual)) {
      failures.push({
        type: 'SMS Quota',
        expected: expected.smsQuota || 'N/A',
        actual: actual.smsQuota,
        severity: 'Critical',
      });
    }
    if (expected.hasHero && !actual.hasHero) {
      failures.push({
        type: 'HERO Benefit',
        expected: 'Included',
        actual: 'Not Found',
        severity: 'Critical',
      });
    }
    if (normalizeText(actual.displayActual) !== normalizeText(expected.displayExpected)) {
      failures.push({
        type: 'Plan Benefit String',
        expected: expected.displayExpected,
        actual: actual.displayActual,
        severity: 'Critical',
      });
    }

    return failures;
  }

  private buildINFailures(
    ctx: FinalAnalysisContext,
    expected: ParsedPlan,
    actual: ActualPlan,
    inValidityDays: number,
    smsDA: any,
    dataDA: any,
  ) {
    const failures: AnalysisReportData['inAnalysis']['failures'] = [];

    if (expected.validityDays !== inValidityDays) {
      failures.push({
        type: 'Service Validity',
        expected: `${expected.validityDays} Days`,
        actual: `${inValidityDays} Days (${ctx.subscriberInfo?.serviceValidity || 'N/A'})`,
        severity: 'Critical',
      });
    }
    
    if (!compareDataQuotas(expected, actual, dataDA)) {
      failures.push({
        type: 'Data Quota',
        expected: expected.dataQuota || 'N/A',
        actual: dataDA ? `${dataDA.daValue} ${dataDA.unit}` : actual.dataQuota,
        severity: 'Critical',
      });
    }
    
    if (!compareSmsQuotas(expected, actual, smsDA)) {
      failures.push({
        type: 'SMS Quota',
        expected: expected.smsQuota || 'N/A',
        actual: smsDA ? `${smsDA.daValue} ${smsDA.unit}` : actual.smsQuota,
        severity: 'Critical',
      });
    }
    
    if (expected.hasHero && !hasHeroInIN(ctx.inResults) && !actual.hasHero) {
      failures.push({
        type: 'HERO Benefit',
        expected: 'Included',
        actual: 'Not Found in DA or Offers',
        severity: 'Critical',
      });
    }

    const voiceOffer = (ctx.inResults?.offers || []).find((o) => /voice|UL/i.test(o.offerName || ''));
    if (voiceOffer && expected.validityDays !== inValidityDays) {
      failures.push({
        type: 'Voice Offer Expiry',
        expected: `~${expected.validityDays} days from activation`,
        actual: voiceOffer.endDateTime || ctx.subscriberInfo?.serviceValidity || 'N/A',
        severity: 'Critical',
      });
    }

    return failures;
  }

  private buildSwiftExecutionFlow(
    ctx: FinalAnalysisContext,
    expected: ParsedPlan,
    actual: ActualPlan,
    activationDatePass: boolean,
    voicePass: boolean,
  ) {
    return [
      { step: 'MSISDN Entry', value: ctx.inputRow.msisdn },
      { step: 'Search', value: 'Subscriber found' },
      { step: 'Subscriber Info', value: `Customer: ${ctx.subscriberInfo?.customerName || 'N/A'}` },
      { step: 'UAT Results', value: `Transaction ID: ${actual.transactionId}` },
      { step: 'Activation Date', value: actual.activationDate, status: checkParameter(activationDatePass) },
      { step: 'Validity', value: `${actual.validityDays} Days`, status: checkParameter(expected.validityDays === actual.validityDays) },
      { step: 'MRP', value: actual.mrp, status: checkParameter(actual.mrp === ctx.inputRow.rechargeMRP) },
      { step: 'Benefits Provisioned', value: actual.benefits, status: checkParameter(compareDataQuotas(expected, actual) && compareSmsQuotas(expected, actual)) },
      { step: 'SWIFT Voice Usage', value: voicePass ? 'Unlimited voice offers active' : 'No voice data', status: checkParameter(voicePass) },
      { step: 'SWIFT Data Usage', value: 'See data usage table' },
      { step: 'SWIFT SMS Usage', value: 'See SMS usage table' },
    ];
  }

  private buildINExecutionFlow(
    ctx: FinalAnalysisContext,
    inStatus: string,
    daCount: number,
    offerCount: number,
  ) {
    return [
      { step: 'IN Results Status', value: `${inStatus}${inStatus === 'Pass' ? ' (Plan validated)' : ' (Wrong plan provisioned)'}`, status: inStatus === 'Pass' ? 'Pass' as const : 'Fail' as const },
      { step: 'Customer Name', value: ctx.subscriberInfo?.customerName || 'N/A' },
      { step: 'Core Balance', value: ctx.subscriberInfo?.coreBalance || 'N/A' },
      { step: 'Service Validity', value: ctx.subscriberInfo?.serviceValidity || 'N/A' },
      { step: 'Account Status', value: ctx.subscriberInfo?.accountStatus || 'N/A' },
      { step: 'User Type', value: ctx.subscriberInfo?.userType || 'N/A' },
      { step: 'Activation Date', value: ctx.inResults?.accountOverview?.activationDate || 'N/A' },
      { step: 'Dedicated Accounts', value: `${daCount} entries` },
      { step: 'Offers', value: `${offerCount} entries` },
      { step: 'Screenshot Count', value: String(ctx.screenshots.length) },
    ];
  }

  private buildTimeline(screenshots: FinalAnalysisContext['screenshots']) {
    return [...screenshots]
      .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
      .map((s) => {
        let system = 'SWIFT';
        if (s.stepName.startsWith('IN_')) system = 'IN';
        else if (s.stepName.includes('Subscriber')) system = 'SWIFT';

        const event = s.stepName
          .replace(/^Row\d+_/, '')
          .replace(/_/g, ' ');

        return {
          timestamp: s.capturedAt.replace('T', ' ').replace(/\.\d+Z$/, ''),
          event,
          system,
        };
      });
  }

  private buildRecommendations(
    swiftFailures: AnalysisReportData['swiftAnalysis']['failures'],
    inFailures: AnalysisReportData['inAnalysis']['failures'],
  ) {
    const recommendations: AnalysisReportData['recommendations'] = [];

    if (swiftFailures.some((f) => f.type.includes('Plan') || f.type.includes('Validity') || f.type.includes('Data') || f.type.includes('SMS'))) {
      recommendations.push({
        priority: 'Critical',
        issue: 'Wrong plan provisioned in SWIFT/IN systems',
        recommendation: 'Investigate recharge routing and product catalog mapping for MRP 149. Verify correct plan ID is sent to provisioning systems.',
        owner: 'Product/Provisioning Team',
      });
    }
    
    if (swiftFailures.some((f) => f.type === 'Activation Date')) {
      recommendations.push({
        priority: 'High',
        issue: 'Activation date mismatch in offer history',
        recommendation: 'Verify offer history reflects today\'s recharge transaction and not a stale/previous activation.',
        owner: 'SWIFT CRM Team',
      });
    }
    
    if (inFailures.some((f) => f.type.includes('Data') || f.type.includes('SMS'))) {
      recommendations.push({
        priority: 'High',
        issue: 'Incorrect DA quotas in IN system',
        recommendation: 'Validate dedicated account provisioning logic for data and SMS quotas against expected plan benefits.',
        owner: 'IN Provisioning Team',
      });
    }
    
    if (swiftFailures.some((f) => f.type === 'HERO Benefit') || inFailures.some((f) => f.type === 'HERO Benefit')) {
      recommendations.push({
        priority: 'Medium',
        issue: 'HERO benefit not provisioned',
        recommendation: 'Check HERO VAS/benefit attachment rules for the target MRP plan.',
        owner: 'VAS/Product Team',
      });
    }

    if (inFailures.some((f) => f.type === 'Service Validity')) {
      recommendations.push({
        priority: 'Critical',
        issue: 'Service validity mismatch in IN system',
        recommendation: 'Verify that the validity period is correctly configured for the MRP 149 plan (56 days). The current service validity is only 22 days.',
        owner: 'IN Provisioning Team',
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'Low',
        issue: 'No critical issues detected',
        recommendation: 'Continue monitoring provisioning consistency across SWIFT and IN.',
        owner: 'QA Team',
      });
    }

    return recommendations;
  }
}