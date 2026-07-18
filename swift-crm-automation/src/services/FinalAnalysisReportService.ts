import {
  AnalysisReportData,
  ExcelReportService,
  ViAppResult,
  PreTestResult,
} from './ExcelReportService';
import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

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
    vasOffers?: any[];
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
  masterPlanBenefit?: string;
  masterRechargeNotification?: string;
  // ─── NEW: PreTest and VI App data ──────────────────────────────────────
  preTestResult?: PreTestResult;
  viAppResult?: ViAppResult;
  preTestStatus?: 'Pass' | 'Fail' | 'Skip';
  viAppStatus?: 'Pass' | 'Fail' | 'Skip' | 'Error';
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
  let validityMatch = validityPart.match(/(\d+)\s*D/i);
  if (!validityMatch) {
    validityMatch = cleaned.match(/(\d+)\s*D/i);
  }
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

  const cleaned = dateStr.replace(/\s*\|\s*/g, ' ').trim();
  
  const match = cleaned.match(/(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})(?:\s+(\d{1,2})\.(\d{2})\s?(AM|PM))?/i);
  if (!match) {
    const altMatch = cleaned.match(/(\d{1,2})\s+([A-Za-z]{3})\s+'(\d{2})/);
    if (!altMatch) return null;
    const altDay = parseInt(altMatch[1], 10);
    const altMonth = MONTHS[altMatch[2].toLowerCase()];
    const altYear = 2000 + parseInt(altMatch[3], 10);
    if (altMonth === undefined) return null;
    return new Date(altYear, altMonth, altDay);
  }
  
  const day = parseInt(match[1], 10);
  const month = MONTHS[match[2].toLowerCase()];
  const year = 2000 + parseInt(match[3], 10);
  if (month === undefined) return null;
  
  if (match[4] && match[5] && match[6]) {
    let hour = parseInt(match[4], 10);
    const minute = parseInt(match[5], 10);
    const meridiem = match[6].toUpperCase();
    
    if (meridiem === 'PM' && hour !== 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    
    return new Date(year, month, day, hour, minute);
  }
  
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

function isSameCalendarDay(date: Date, isoDate: string): boolean {
  const [year, month, day] = isoDate.split('-').map(Number);
  const expectedDate = new Date(year, month - 1, day);
  
  return date.getFullYear() === expectedDate.getFullYear() &&
         date.getMonth() === expectedDate.getMonth() &&
         date.getDate() === expectedDate.getDate();
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

  const activationDate = offer.activationDateTime || 'N/A';

  return {
    displayActual,
    validityDays,
    dataQuota: dataInfo?.label || 'N/A',
    smsQuota: smsInfo?.label || 'N/A',
    hasHero,
    hasUnlimitedVoice,
    benefits,
    validity,
    activationDate,
    transactionId: offer.transactionId || 'N/A',
    mrp: offer.mrp || targetMRP,
  };
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
    const unit = (inDA.unit || '').toLowerCase();
    const valueInGB = unit === 'mb' ? daVal / 1024 : daVal;
    if (Math.abs(valueInGB - expectedData.value) <= 0.01) return true;
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
    if (daVal === expectedSms.value) return true;
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

// ─── Dynamic IN Validations ──────────────────────────────────────────────

function extractExpectedQuotasFromPlan(benefitPart: string): {
  dataQuotaMB: number | null;
  smsQuota: number | null;
  hasUnlimitedVoice: boolean;
  validityDays: number;
} {
  const dataInfo = extractDataFromText(benefitPart);
  const smsInfo = extractSmsFromText(benefitPart);
  const hasUnlimitedVoice = /UL|Unlimited/i.test(benefitPart);
  
  let validityDays = 0;
  const validityMatch = benefitPart.match(/(\d+)\s*D/i);
  if (validityMatch) {
    validityDays = parseInt(validityMatch[1], 10);
  }

  return {
    dataQuotaMB: dataInfo ? Math.round(dataInfo.value * 1024) : null,
    smsQuota: smsInfo ? smsInfo.value : null,
    hasUnlimitedVoice,
    validityDays,
  };
}

function validateINDedicatedAccountsDynamic(
  dedicatedAccounts: any[],
  expectedPlan: ParsedPlan,
  testDate: string,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  const today = new Date(testDate);
  today.setHours(0, 0, 0, 0);

  const expected = extractExpectedQuotasFromPlan(expectedPlan.benefitPart);
  
  if (!dedicatedAccounts || dedicatedAccounts.length === 0) {
    failures.push('No dedicated accounts found');
    return { pass: false, failures };
  }

  const dataDA = dedicatedAccounts.find((da) => {
    const name = (da.daName || '').toLowerCase();
    return name.includes('data') || 
           name.includes('fixed_data') || 
           name.includes('ul_data') ||
           (name.includes('unlimited') && name.includes('data'));
  });

  const smsDA = dedicatedAccounts.find((da) => {
    const name = (da.daName || '').toLowerCase();
    return name.includes('sms') || 
           name.includes('fixed_sms') ||
           name.includes('messages');
  });

  if (expected.dataQuotaMB !== null && expected.dataQuotaMB > 0) {
    if (!dataDA) {
      failures.push(`Data dedicated account not found (expected ${expected.dataQuotaMB} MB)`);
    } else {
      const daValue = parseFloat(dataDA.daValue);
      if (isNaN(daValue) || daValue <= 0) {
        failures.push(`Data DA has invalid value: ${dataDA.daValue}`);
      } else {
        const valueInMB = dataDA.unit?.toLowerCase() === 'gb' ? daValue * 1024 : daValue;
        if (Math.abs(valueInMB - expected.dataQuotaMB) > 1) {
          failures.push(
            `Data DA value is ${daValue} ${dataDA.unit || ''}, expected ~${expected.dataQuotaMB} MB (${expected.dataQuotaMB/1024} GB)`
          );
        }
      }

      if (expected.validityDays > 0 && dataDA.expiryDate) {
        const expiryDate = parseIndianDate(dataDA.expiryDate);
        if (expiryDate) {
          const expectedExpiry = new Date(today);
          expectedExpiry.setDate(expectedExpiry.getDate() + expected.validityDays - 1);
          const diffDays = daysBetween(today, expiryDate);
          if (Math.abs(diffDays - expected.validityDays) > 1) {
            failures.push(
              `Data DA expiry is ${dataDA.expiryDate}, expected ${expectedExpiry.toLocaleDateString()} (${expected.validityDays} days from today)`
            );
          }
        }
      }
    }
  }

  if (expected.smsQuota !== null && expected.smsQuota > 0) {
    if (!smsDA) {
      failures.push(`SMS dedicated account not found (expected ${expected.smsQuota} SMS)`);
    } else {
      const daValue = parseFloat(smsDA.daValue);
      if (isNaN(daValue) || daValue <= 0) {
        failures.push(`SMS DA has invalid value: ${smsDA.daValue}`);
      } else if (Math.abs(daValue - expected.smsQuota) > 0) {
        failures.push(
          `SMS DA value is ${smsDA.daValue}, expected ${expected.smsQuota}`
        );
      }

      if (expected.validityDays > 0 && smsDA.expiryDate) {
        const expiryDate = parseIndianDate(smsDA.expiryDate);
        if (expiryDate) {
          const expectedExpiry = new Date(today);
          expectedExpiry.setDate(expectedExpiry.getDate() + expected.validityDays - 1);
          const diffDays = daysBetween(today, expiryDate);
          if (Math.abs(diffDays - expected.validityDays) > 1) {
            failures.push(
              `SMS DA expiry is ${smsDA.expiryDate}, expected ${expectedExpiry.toLocaleDateString()} (${expected.validityDays} days from today)`
            );
          }
        }
      }
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

function validateINOffersDynamic(
  offers: any[],
  expectedPlan: ParsedPlan,
  testDate: string,
): { pass: boolean; failures: string[] } {
  const failures: string[] = [];
  const today = new Date(testDate);
  today.setHours(0, 0, 0, 0);

  if (!offers || offers.length === 0) {
    failures.push('No offers found');
    return { pass: false, failures };
  }

  const expected = extractExpectedQuotasFromPlan(expectedPlan.benefitPart);

  const voiceOffers = offers.filter((o) => {
    const name = (o.offerName || '').toLowerCase();
    return name.includes('voice') || 
           name.includes('ul_voice') ||
           (name.includes('unlimited') && name.includes('call'));
  });

  const dataOffer = offers.find((o) => {
    const name = (o.offerName || '').toLowerCase();
    return name.includes('data') || 
           name.includes('fixed_data') ||
           name.includes('ul_data') ||
           (name.includes('unlimited') && name.includes('data'));
  });

  const smsOffer = offers.find((o) => {
    const name = (o.offerName || '').toLowerCase();
    return name.includes('sms') || 
           name.includes('fixed_sms') ||
           name.includes('messages');
  });

  if (expected.hasUnlimitedVoice) {
    if (voiceOffers.length === 0) {
      failures.push('Voice offers not found (expected Unlimited Calls)');
    } else {
      voiceOffers.forEach((voiceOffer, index) => {
        if (voiceOffer.startDateTime) {
          const startDate = parseIndianDate(voiceOffer.startDateTime);
          if (startDate) {
            const startDateOnly = new Date(startDate);
            startDateOnly.setHours(0, 0, 0, 0);
            if (startDateOnly.getTime() !== today.getTime()) {
              failures.push(
                `Voice offer ${index + 1} (${voiceOffer.offerName}) start date is ${voiceOffer.startDateTime}, expected ${testDate}`
              );
            }
          }
        }

        if (expected.validityDays > 0 && voiceOffer.endDateTime) {
          const endDate = parseIndianDate(voiceOffer.endDateTime);
          if (endDate) {
            const expectedEnd = new Date(today);
            expectedEnd.setDate(expectedEnd.getDate() + expected.validityDays - 1);
            const diffDays = daysBetween(today, endDate);
            if (Math.abs(diffDays - expected.validityDays) > 1) {
              failures.push(
                `Voice offer ${index + 1} (${voiceOffer.offerName}) end date is ${voiceOffer.endDateTime}, expected ${expectedEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} (${expected.validityDays} days from today)`
              );
            }
          }
        }
      });
    }
  }

  if (expected.dataQuotaMB !== null && expected.dataQuotaMB > 0) {
    if (!dataOffer) {
      failures.push(`Data offer not found (expected ${expected.dataQuotaMB} MB)`);
    } else {
      if (dataOffer.startDateTime) {
        const startDate = parseIndianDate(dataOffer.startDateTime);
        if (startDate) {
          const startDateOnly = new Date(startDate);
          startDateOnly.setHours(0, 0, 0, 0);
          if (startDateOnly.getTime() !== today.getTime()) {
            failures.push(
              `Data offer (${dataOffer.offerName}) start date is ${dataOffer.startDateTime}, expected ${testDate}`
            );
          }
        }
      }

      if (expected.validityDays > 0 && dataOffer.endDateTime) {
        const endDate = parseIndianDate(dataOffer.endDateTime);
        if (endDate) {
          const expectedEnd = new Date(today);
          expectedEnd.setDate(expectedEnd.getDate() + expected.validityDays - 1);
          const diffDays = daysBetween(today, endDate);
          if (Math.abs(diffDays - expected.validityDays) > 1) {
            failures.push(
              `Data offer (${dataOffer.offerName}) end date is ${dataOffer.endDateTime}, expected ${expectedEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} (${expected.validityDays} days from today)`
            );
          }
        }
      }
    }
  }

  if (expected.smsQuota !== null && expected.smsQuota > 0) {
    if (!smsOffer) {
      failures.push(`SMS offer not found (expected ${expected.smsQuota} SMS)`);
    } else {
      if (smsOffer.startDateTime) {
        const startDate = parseIndianDate(smsOffer.startDateTime);
        if (startDate) {
          const startDateOnly = new Date(startDate);
          startDateOnly.setHours(0, 0, 0, 0);
          if (startDateOnly.getTime() !== today.getTime()) {
            failures.push(
              `SMS offer (${smsOffer.offerName}) start date is ${smsOffer.startDateTime}, expected ${testDate}`
            );
          }
        }
      }

      if (expected.validityDays > 0 && smsOffer.endDateTime) {
        const endDate = parseIndianDate(smsOffer.endDateTime);
        if (endDate) {
          const expectedEnd = new Date(today);
          expectedEnd.setDate(expectedEnd.getDate() + expected.validityDays - 1);
          const diffDays = daysBetween(today, endDate);
          if (Math.abs(diffDays - expected.validityDays) > 1) {
            failures.push(
              `SMS offer (${smsOffer.offerName}) end date is ${smsOffer.endDateTime}, expected ${expectedEnd.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })} (${expected.validityDays} days from today)`
            );
          }
        }
      }
    }
  }

  return {
    pass: failures.length === 0,
    failures,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────

export class FinalAnalysisReportService {
  private masterPlans: Map<string, { benefit: string; circle: string; rechargeNotification: string }> = new Map();
  private masterDataLoaded = false;

  constructor(
    private excelReportService: ExcelReportService,
    private excelPath?: string
  ) {
    if (excelPath && fs.existsSync(excelPath)) {
      this.loadMasterPlans(excelPath);
    }
  }

  private loadMasterPlans(excelPath: string): void {
    try {
      console.log(`[FinalAnalysisReportService] Loading master plans from: ${excelPath}`);
      const workbook = xlsx.readFile(excelPath);
      const sheet = workbook.Sheets['Recharge Plans'];
      
      if (!sheet) {
        console.warn('[FinalAnalysisReportService] ⚠️ Recharge Plans sheet not found');
        return;
      }
      
      const data: any[] = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      
      for (const row of data) {
        const mrp = String(row['New MRP'] || '').trim();
        if (!mrp) continue;
        
        const benefit = row['Benefit (Open)'] || '';
        const circle = String(row['Circle'] || '').trim();
        const rechargeNotification = row['Recharge Notification'] || '';
        
        this.masterPlans.set(mrp, {
          benefit,
          circle,
          rechargeNotification,
        });
      }
      
      this.masterDataLoaded = true;
      console.log(`[FinalAnalysisReportService] Loaded ${this.masterPlans.size} master plans from ${excelPath}`);
    } catch (err) {
      console.warn('[FinalAnalysisReportService] ❌ Could not load master plans:', err);
    }
  }

  private getPlanBenefit(mrp: string, circle: string): { benefit: string; notification: string } | null {
    const plan = this.masterPlans.get(mrp);
    if (!plan) {
      console.log(`[FinalAnalysisReportService] ❌ No plan found for MRP ${mrp}`);
      return null;
    }
    
    return {
      benefit: plan.benefit,
      notification: plan.rechargeNotification || '',
    };
  }

  evaluateStatuses(ctx: FinalAnalysisContext): StatusEvaluation {
    let planBenefit = ctx.inputRow.planBenefit || '';
    
    if (!planBenefit || planBenefit === 'N/A' || planBenefit === '—' || planBenefit === '') {
      console.log(`[FinalAnalysisReport] 🔍 Looking up plan: MRP=${ctx.inputRow.rechargeMRP}, Circle=${ctx.inputRow.circle}`);
      
      const masterPlan = this.getPlanBenefit(
        ctx.inputRow.rechargeMRP,
        ctx.inputRow.circle
      );
      
      if (masterPlan) {
        planBenefit = masterPlan.benefit;
        ctx.inputRow.planBenefit = planBenefit;
        if (!ctx.inputRow.rechargeNotification || ctx.inputRow.rechargeNotification === 'N/A') {
          ctx.inputRow.rechargeNotification = masterPlan.notification;
        }
        console.log(`[FinalAnalysisReport] Found plan benefit: ${planBenefit.substring(0, 50)}...`);
      } else {
        console.log(`[FinalAnalysisReport] ❌ No plan found for MRP ${ctx.inputRow.rechargeMRP}`);
      }
    } else {
      console.log(`[FinalAnalysisReport] Using provided planBenefit: ${planBenefit.substring(0, 50)}...`);
    }

    const expected = parsePlanBenefit(planBenefit);
    const actual = inferActualPlanFromSwift(ctx.swiftResults, ctx.inputRow.rechargeMRP);

    let swiftStatus: StatusEvaluation['swiftStatus'] = ctx.swiftRan ? 'Fail' : 'Skip';
    let inStatus: StatusEvaluation['inStatus'] = ctx.inRan ? 'Fail' : 'Skip';

    if (ctx.swiftRan) {
      const offer = getPrimarySwiftOffer(ctx.swiftResults, ctx.inputRow.rechargeMRP);
      const swiftChecks = this.getSwiftChecks(ctx, expected, actual, offer);
      swiftStatus = swiftChecks.every((c) => c.pass) ? 'Pass' : 'Fail';
    }

    if (ctx.inRan) {
      const inChecks = this.getINChecks(ctx, expected, actual);
      const allChecksPass = inChecks.every((c) => c.pass);
      
      const inResults = ctx.inResults;
      const inTestPassed = inResults?.success === true;
      
      const checksPassed = allChecksPass;
      
      if (inResults !== undefined) {
        inStatus = (inTestPassed && checksPassed) ? 'Pass' : 'Fail';
      } else {
        inStatus = checksPassed ? 'Pass' : 'Fail';
      }
      
      console.log('[FinalAnalysisReport] IN Status Evaluation:');
      console.log(`  - IN Test Passed: ${inTestPassed}`);
      console.log(`  - All Checks Pass: ${allChecksPass}`);
      console.log(`  - Final IN Status: ${inStatus}`);
    }

    const overallStatus: 'Pass' | 'Fail' =
      (swiftStatus === 'Pass' || swiftStatus === 'Skip') &&
      (inStatus === 'Pass' || inStatus === 'Skip')
        ? 'Pass'
        : 'Fail';

    return { inStatus, swiftStatus, overallStatus };
  }

  buildAnalysisReport(ctx: FinalAnalysisContext): AnalysisReportData {
    let planBenefit = ctx.inputRow.planBenefit || '';

    if (!planBenefit || planBenefit === 'N/A' || planBenefit === '—' || planBenefit === '') {
      console.log(`[FinalAnalysisReport] 🔍 Looking up plan (buildAnalysisReport): MRP=${ctx.inputRow.rechargeMRP}`);

      const masterPlan = this.getPlanBenefit(
        ctx.inputRow.rechargeMRP,
        ctx.inputRow.circle
      );

      if (masterPlan) {
        planBenefit = masterPlan.benefit;
        ctx.inputRow.planBenefit = planBenefit;
        if (!ctx.inputRow.rechargeNotification || ctx.inputRow.rechargeNotification === 'N/A') {
          ctx.inputRow.rechargeNotification = masterPlan.notification;
        }
        console.log(`[FinalAnalysisReport] Found plan benefit: ${planBenefit.substring(0, 50)}...`);
      } else {
        console.log(`[FinalAnalysisReport] ❌ Building PLAN NOT FOUND report for ${ctx.inputRow.msisdn}`);
      }
    }

    const expected = parsePlanBenefit(planBenefit);
    const actual = inferActualPlanFromSwift(ctx.swiftResults, ctx.inputRow.rechargeMRP);
    const statuses = this.evaluateStatuses(ctx);
    const offer = getPrimarySwiftOffer(ctx.swiftResults, ctx.inputRow.rechargeMRP);
    const accountOverview = ctx.inResults?.accountOverview || {};
    const dedicatedAccounts = ctx.inResults?.dedicatedAccounts || [];
    const offers = ctx.inResults?.offers || [];
    const voiceUsage = ctx.swiftResults?.totalUsage?.voice || [];
    const dataUsage = ctx.swiftResults?.totalUsage?.data || [];
    const smsUsage = ctx.swiftResults?.totalUsage?.sms || [];
    const vasOffers = ctx.swiftResults?.vasOffers || [];

    const smsDA = findDedicatedAccount(dedicatedAccounts, /SMS/i);
    const dataDA = findDedicatedAccount(dedicatedAccounts, /Data/i);

    const today = new Date(ctx.testDate);
    today.setHours(0, 0, 0, 0);
    const expectedValidityDays = expected.validityDays;
    const expectedExpiry = new Date(today);
    expectedExpiry.setDate(expectedExpiry.getDate() + expectedValidityDays - 1);
    const expectedExpiryStr = expectedExpiry.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });

    const serviceValidity = ctx.subscriberInfo?.serviceValidity || '';
    const expiryDate = parseIndianDate(serviceValidity);
    let actualValidityDays = 0;
    if (expiryDate) {
      actualValidityDays = daysBetween(today, expiryDate);
    }

    const daValidation = validateINDedicatedAccountsDynamic(dedicatedAccounts, expected, ctx.testDate);
    const offerValidation = validateINOffersDynamic(offers, expected, ctx.testDate);

    const activationDatePass = (() => {
      const parsed = parseIndianDate(actual.activationDate);
      if (!parsed) return false;
      return isSameCalendarDay(parsed, ctx.testDate);
    })();

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
      (() => {
        const expectedBenefit = expected.benefitPart || '';
        const actualBenefits = actual.benefits || '';

        const hasUnlimitedVoice = /UL|Unlimited/i.test(actualBenefits);
        const expectedData = extractDataFromText(expectedBenefit);
        const actualData = extractDataFromText(actualBenefits);
        const expectedSms = extractSmsFromText(expectedBenefit);
        const actualSms = extractSmsFromText(actualBenefits);
        const hasHero = /HERO/i.test(actualBenefits);
        const expectedHasHero = expected.hasHero;

        let allMatch = true;

        if (!hasUnlimitedVoice) allMatch = false;

        if (expectedData && actualData) {
          if (Math.abs(expectedData.value - actualData.value) > 0.01) allMatch = false;
          if (expectedData.perDay !== actualData.perDay) allMatch = false;
        } else if (expectedData || actualData) {
          allMatch = false;
        }

        if (expectedSms && actualSms) {
          if (expectedSms.value !== actualSms.value) allMatch = false;
          if (expectedSms.perDay !== actualSms.perDay) allMatch = false;
        } else if (expectedSms || actualSms) {
          allMatch = false;
        }

        if (expectedHasHero && !hasHero) allMatch = false;

        if (expectedValidityDays > 0 && actual.validityDays > 0) {
          if (expectedValidityDays !== actual.validityDays) allMatch = false;
        } else if (expectedValidityDays > 0 || actual.validityDays > 0) {
          allMatch = false;
        }

        return {
          parameter: 'Plan Benefit',
          expected: expected.displayExpected,
          actual: actual.displayActual,
          status: checkParameter(allMatch),
        };
      })(),
      {
        parameter: 'Validity',
        expected: expectedValidityDays > 0 ? `${expectedValidityDays} Days` : 'N/A',
        actual: actual.validityDays > 0 ? `${actual.validityDays} Days` : actual.validity || 'N/A',
        status: checkParameter(
          expectedValidityDays > 0 &&
            actual.validityDays > 0 &&
            expectedValidityDays === actual.validityDays,
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
    
    const inFailures: AnalysisReportData['inAnalysis']['failures'] = [];

    if (!daValidation.pass) {
      daValidation.failures.forEach((failure) => {
        inFailures.push({
          type: 'Dedicated Account',
          expected: 'Valid configuration matching plan benefit',
          actual: failure,
          severity: 'Critical',
        });
      });
    }

    if (!offerValidation.pass) {
      offerValidation.failures.forEach((failure) => {
        inFailures.push({
          type: 'Offer Configuration',
          expected: 'Valid configuration with today\'s start date and plan validity',
          actual: failure,
          severity: 'Critical',
        });
      });
    }

    if (actualValidityDays !== expectedValidityDays) {
      inFailures.push({
        type: 'Service Validity',
        expected: `${expectedValidityDays} days from ${ctx.testDate} (ends ${expectedExpiryStr})`,
        actual: serviceValidity || 'N/A',
        severity: 'Critical',
      });
    }

    if ((ctx.subscriberInfo?.accountStatus || '').toLowerCase() !== 'active') {
      inFailures.push({
        type: 'Account Status',
        expected: 'Active',
        actual: ctx.subscriberInfo?.accountStatus || 'N/A',
        severity: 'High',
      });
    }

    if (!(ctx.subscriberInfo?.userType || '').toLowerCase().includes('pack')) {
      inFailures.push({
        type: 'User Type',
        expected: 'Pack User',
        actual: ctx.subscriberInfo?.userType || 'N/A',
        severity: 'Medium',
      });
    }

    const voicePass = voiceUsage.length > 0 || actual.hasUnlimitedVoice;
    const inOverallStatus = inFailures.length === 0 ? 'Pass' : 'Fail';

    // ─── Determine PreTest Status ──────────────────────────────────────────
    const preTestStatus = ctx.preTestStatus || (ctx.preTestResult?.status === 'Pass' ? 'Pass' : ctx.preTestResult?.status === 'Fail' ? 'Fail' : 'Skip');

    // ─── Determine VI App Status ──────────────────────────────────────────
    const viAppStatus = ctx.viAppStatus || ctx.viAppResult?.status || 'Skip';

    // ─── Build PreTest Combined Data ──────────────────────────────────────
    const preTestCombinedData: any[] = [];
    if (ctx.preTestResult) {
      // Add summary row
      preTestCombinedData.push({
        'Type': '--- SUMMARY ---',
        'Status': ctx.preTestResult.status,
        'Reason': ctx.preTestResult.reason || 'N/A',
        'Voice Entries': ctx.preTestResult.voice?.length || 0,
        'Data Entries': ctx.preTestResult.data?.length || 0,
        'SMS Entries': ctx.preTestResult.sms?.length || 0,
        'Dedicated Accounts': ctx.preTestResult.dedicatedAccounts?.length || 0,
        'Offers': ctx.preTestResult.offers?.length || 0,
      });

      // Add Voice entries
      (ctx.preTestResult.voice || []).forEach((v: any) => {
        preTestCombinedData.push({
          'Type': 'VOICE',
          'Offer Name': v.offer_name || v.offerName || 'N/A',
          'Balance Left': v.balance_left || v.balanceLeft || 'N/A',
          'Category': v.category || 'N/A',
          'Expiry Date': v.expiry_date || v.expiryDate || 'N/A',
          'Status': v.status || 'N/A',
        });
      });

      // Add Data entries
      (ctx.preTestResult.data || []).forEach((d: any) => {
        preTestCombinedData.push({
          'Type': 'DATA',
          'Offer Name': d.offer_name || d.offerName || 'N/A',
          'Total Quota': d.total_quota || d.totalQuota || 'N/A',
          'Balance Left': d.balance_left || d.balanceLeft || 'N/A',
          'Category': d.category || 'N/A',
          'Expiry Date': d.expiry_date || d.expiryDate || 'N/A',
          'Status': d.status || 'N/A',
        });
      });

      // Add SMS entries
      (ctx.preTestResult.sms || []).forEach((s: any) => {
        preTestCombinedData.push({
          'Type': 'SMS',
          'Offer Name': s.offer_name || s.offerName || 'N/A',
          'Balance Left': s.balance_left || s.balanceLeft || 'N/A',
          'Category': s.category || 'N/A',
          'Expiry Date': s.expiry_date || s.expiryDate || 'N/A',
          'Status': s.status || 'N/A',
        });
      });

      // Add Dedicated Accounts
      (ctx.preTestResult.dedicatedAccounts || []).forEach((da: any) => {
        preTestCombinedData.push({
          'Type': 'DEDICATED ACCOUNT',
          'DA Name': da.daName || 'N/A',
          'DA ID': da.daId || 'N/A',
          'Start Date': da.startDate || 'N/A',
          'Expiry Date': da.expiryDate || 'N/A',
          'DA Value': da.daValue || 'N/A',
          'Unit': da.unit || 'N/A',
        });
      });

      // Add Offers
      (ctx.preTestResult.offers || []).forEach((offer: any) => {
        preTestCombinedData.push({
          'Type': 'OFFER',
          'Offer Name': offer.offerName || 'N/A',
          'Offer ID': offer.offerId || 'N/A',
          'Product ID': offer.productId || 'N/A',
          'Start Date & Time': offer.startDateTime || 'N/A',
          'End Date & Time': offer.endDateTime || 'N/A',
          'Offer Type': offer.offerType || 'N/A',
        });
      });
    }

    return {
      testCase: {
        name: `Recharge UAT for MRP ${ctx.inputRow.rechargeMRP} Plan`,
        msisdn: ctx.inputRow.msisdn,
        testDate: ctx.testDate,
        overallStatus: statuses.overallStatus,
        swiftStatus: statuses.swiftStatus,
        inStatus: inOverallStatus as 'Pass' | 'Fail' | 'Skip',
        // ─── NEW: PreTest and VI App status ──────────────────────────────
        preTestStatus: preTestStatus as 'Pass' | 'Fail' | 'Skip',
        viAppStatus: viAppStatus as 'Pass' | 'Fail' | 'Skip' | 'Error',
      },
      comparison,
      swiftAnalysis: {
        executionFlow: this.buildSwiftExecutionFlow(ctx, expected, actual, activationDatePass, voicePass),
        results: [
          { field: 'Transaction ID', expected: '-', actual: actual.transactionId, status: checkParameter(!!actual.transactionId && actual.transactionId !== 'N/A') },
          { field: 'Activation Date & Time', expected: ctx.testDate, actual: actual.activationDate, status: checkParameter(activationDatePass) },
          { field: 'Validity', expected: expectedValidityDays > 0 ? `${expectedValidityDays} Days` : 'N/A', actual: actual.validity || `${actual.validityDays} Days`, status: checkParameter(expectedValidityDays === actual.validityDays) },
          { field: 'MRP', expected: ctx.inputRow.rechargeMRP, actual: actual.mrp, status: checkParameter(actual.mrp === ctx.inputRow.rechargeMRP) },
          { field: 'Activation Mode', expected: '-', actual: offer?.activationMode || 'EtopUp', status: 'Pass' as const },
          { field: 'Current Core Balance', expected: '-', actual: ctx.subscriberInfo?.coreBalance || offer?.currentCoreBalance || '0', status: 'Pass' as const },
          { field: 'Category', expected: 'Unlimited', actual: offer?.category || 'Unlimited', status: 'Pass' as const },
          {
            field: 'Benefits',
            expected: `${expected.benefitPart}`,
            actual: actual.benefits,
            status: checkParameter(compareDataQuotas(expected, actual) && compareSmsQuotas(expected, actual) && (!expected.hasHero || actual.hasHero)),
          },
          {
            field: 'Detail Validity',
            expected: expectedValidityDays > 0 ? `${expectedValidityDays} Days` : 'N/A',
            actual: actual.validity,
            status: checkParameter(expectedValidityDays === actual.validityDays),
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
        vasUsage: vasOffers.map((v: any) => ({
          vasName: v.name || v.offer_name || v.offerName || 'N/A',
          category: v.type || v.offer_type || v.category || 'N/A',
          activationDate: v.activation_date || v.activationDate || 'N/A',
          expiryDate: v.next_charging_date || v.expiryDate || v.expiry_date || 'N/A',
          status: v.status || 'Pass',
        })),
        failures: swiftFailures,
        overallStatus: statuses.swiftStatus === 'Pass' ? 'Pass' : 'Fail',
      },
      inAnalysis: {
        executionFlow: this.buildINExecutionFlow(ctx, inOverallStatus, dedicatedAccounts.length, offers.length),
        results: [
          { field: 'Customer Name', value: ctx.subscriberInfo?.customerName || 'N/A', expected: '-', status: 'Pass' as const },
          { field: 'Core Balance', value: ctx.subscriberInfo?.coreBalance || 'N/A', expected: '-', status: 'Pass' as const },
          {
            field: 'Service Validity',
            value: serviceValidity || 'N/A',
            expected: `${expectedValidityDays} days from activation (ends ${expectedExpiryStr})`,
            status: checkParameter(actualValidityDays === expectedValidityDays),
          },
          { field: 'Account Status', value: ctx.subscriberInfo?.accountStatus || 'N/A', expected: 'Active', status: checkParameter((ctx.subscriberInfo?.accountStatus || '').toLowerCase() === 'active') },
          { field: 'User Type', value: ctx.subscriberInfo?.userType || 'N/A', expected: 'Pack User', status: checkParameter((ctx.subscriberInfo?.userType || '').toLowerCase().includes('pack')) },
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
        overallStatus: inOverallStatus as 'Pass' | 'Fail',
      },
      rootCause: {
        expectedPlan: `${ctx.inputRow.rechargeMRP} MRP - ${expectedValidityDays} Days - ${expected.dataQuota || 'N/A'} - ${expected.smsQuota || 'N/A'}${expected.hasHero ? ' - HERO' : ''}`,
        actualPlan: `${actual.mrp} MRP - ${actual.validityDays || actualValidityDays} Days - ${actual.dataQuota} - ${actual.smsQuota}${actual.hasHero ? ' - HERO' : ' - No HERO'}`,
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
      // ─── NEW: PreTest Data ──────────────────────────────────────────────
      preTestSummary: ctx.preTestResult ? {
        status: ctx.preTestResult.status,
        reason: ctx.preTestResult.reason || 'N/A',
        customerName: ctx.preTestResult.customerName || 'N/A',
        coreBalance: ctx.preTestResult.coreBalance || 'N/A',
        serviceValidity: ctx.preTestResult.serviceValidity || 'N/A',
        accountStatus: ctx.preTestResult.accountStatus || 'N/A',
        userType: ctx.preTestResult.userType || 'N/A',
        dedicatedAccounts: ctx.preTestResult.dedicatedAccounts || [],
        offers: ctx.preTestResult.offers || [],
        voice: ctx.preTestResult.voice || [],
        data: ctx.preTestResult.data || [],
        sms: ctx.preTestResult.sms || [],
      } : undefined,
      preTestCombined: preTestCombinedData,
      // ─── NEW: VI App Data ──────────────────────────────────────────────
      viAppResult: ctx.viAppResult,
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
    const dedicatedAccounts = ctx.inResults?.dedicatedAccounts || [];
    const offers = ctx.inResults?.offers || [];

    const daValidation = validateINDedicatedAccountsDynamic(
      dedicatedAccounts,
      expected,
      ctx.testDate
    );

    const offerValidation = validateINOffersDynamic(
      offers,
      expected,
      ctx.testDate
    );

    const serviceValidity = ctx.subscriberInfo?.serviceValidity || '';
    const expiryDate = parseIndianDate(serviceValidity);
    let validityPass = false;
    const expectedValidityDays = expected.validityDays;
    
    if (expiryDate) {
      const today = new Date(ctx.testDate);
      today.setHours(0, 0, 0, 0);
      const diffDays = daysBetween(today, expiryDate);
      validityPass = Math.abs(diffDays - expectedValidityDays) <= 1;
    }

    const accountStatusPass = (ctx.subscriberInfo?.accountStatus || '').toLowerCase() === 'active';
    const userTypePass = (ctx.subscriberInfo?.userType || '').toLowerCase().includes('pack');

    console.log('[FinalAnalysisReport] IN Checks (Dynamic):');
    console.log(`  - Dedicated Accounts: ${daValidation.pass ? 'PASS' : 'FAIL'}`);
    if (!daValidation.pass) {
      console.log(`    Failures: ${daValidation.failures.join('; ')}`);
    }
    console.log(`  - Offers: ${offerValidation.pass ? 'PASS' : 'FAIL'}`);
    if (!offerValidation.pass) {
      console.log(`    Failures: ${offerValidation.failures.join('; ')}`);
    }
    console.log(`  - Service Validity: ${validityPass ? 'PASS' : 'FAIL'} (expected ${expectedValidityDays} days)`);
    console.log(`  - Account Status: ${accountStatusPass ? 'PASS' : 'FAIL'}`);
    console.log(`  - User Type: ${userTypePass ? 'PASS' : 'FAIL'}`);

    const allPass = daValidation.pass &&
      offerValidation.pass &&
      validityPass &&
      accountStatusPass &&
      userTypePass;

    return [
      { pass: daValidation.pass },
      { pass: offerValidation.pass },
      { pass: validityPass },
      { pass: accountStatusPass },
      { pass: userTypePass },
    ];
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
    const contentMatch = compareDataQuotas(expected, actual) && 
                         compareSmsQuotas(expected, actual) &&
                         (!expected.hasHero || actual.hasHero) &&
                         expected.validityDays === actual.validityDays;
    if (!contentMatch) {
      failures.push({
        type: 'Plan Benefit Content',
        expected: expected.displayExpected,
        actual: actual.displayActual,
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
    const today = new Date(ctx.testDate);
    today.setHours(0, 0, 0, 0);
    const expected = parsePlanBenefit(ctx.inputRow.planBenefit || '');
    const expectedValidityDays = expected.validityDays;

    const expectedExpiry = new Date(today);
    expectedExpiry.setDate(expectedExpiry.getDate() + expectedValidityDays - 1);
    const expectedExpiryStr = expectedExpiry.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: '2-digit'
    });

    const actualServiceValidity = ctx.subscriberInfo?.serviceValidity || 'N/A';

    return [
      { step: 'IN Results Status', value: `${inStatus}${inStatus === 'Pass' ? ' (Plan validated)' : ' (Wrong plan provisioned)'}`, status: inStatus === 'Pass' ? 'Pass' as const : 'Fail' as const },
      { step: 'Customer Name', value: ctx.subscriberInfo?.customerName || 'N/A' },
      { step: 'Core Balance', value: ctx.subscriberInfo?.coreBalance || 'N/A' },
      { step: 'Service Validity', value: actualServiceValidity, status: inStatus === 'Pass' ? 'Pass' as const : 'Fail' as const },
      { step: `Expected Validity (${expectedValidityDays} days from ${ctx.testDate})`, value: expectedExpiryStr },
      { step: 'Account Status', value: ctx.subscriberInfo?.accountStatus || 'N/A' },
      { step: 'User Type', value: ctx.subscriberInfo?.userType || 'N/A' },
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
        recommendation: 'Investigate recharge routing and product catalog mapping. Verify correct plan ID is sent to provisioning systems.',
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
    
    if (swiftFailures.some((f) => f.type === 'Plan Benefit Content')) {
      recommendations.push({
        priority: 'Medium',
        issue: 'Plan benefit content mismatch',
        recommendation: 'The actual benefits content does not match expected plan content. Check plan provisioning logic.',
        owner: 'QA Team',
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