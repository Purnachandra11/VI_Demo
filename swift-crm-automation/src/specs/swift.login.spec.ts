/**
 * swift_recharge_spec.ts  — REVISED
 *
 * Point 1: Reads SWIFT_REUSE_SESSION from env. If 'true', login is skipped.
 *          After every successful login, POSTs { event: 'login_success' }
 *          to /api/swift/session-event so the orchestrator updates its state.
 *          If a session-expired page is detected mid-test it POSTs
 *          { event: 'logout_detected' } then re-runs the login flow.
 *
 * Point 3: Reads SWIFT_ROW_MSISDN from env. Only the matching row is processed
 *          in this WDIO invocation. One invocation = one row.
 */

import { browser } from '@wdio/globals';
import { SwiftLoginPage }    from '../pages/SwiftLoginPage';
import { RechargePage }      from '../pages/RechargePage';
import { ViAppPage }         from '../pages/ViAppPage';
import { ExcelDataService }  from '../services/ExcelDataService';
import { ExcelReportService } from '../services/ExcelReportService';
import * as path from 'path';
import * as fs   from 'fs';

// ── Paths ─────────────────────────────────────────────────────────────────
const DATA_PATH   = path.resolve('./data/Input_data.xlsx');
const SAMPLE_PATH = path.resolve('./Sample file/Input_data.xlsx');
const EXCEL_PATH  = fs.existsSync(DATA_PATH) ? DATA_PATH : SAMPLE_PATH;

// ── Point 3: which single row to run (set by orchestrator) ───────────────
const TARGET_MSISDN  = process.env.SWIFT_ROW_MSISDN  || '';

// ── Point 1: reuse existing browser session? ─────────────────────────────
const REUSE_SESSION  = process.env.SWIFT_REUSE_SESSION === 'true';

// ── Server base for session-event reporting ───────────────────────────────
const SERVER_BASE    = process.env.SERVER_BASE || 'http://localhost:5174';

// ── Helper: report login/logout event to orchestrator ────────────────────
async function reportSessionEvent(event: 'login_success' | 'logout_detected'): Promise<void> {
  try {
    await fetch(`${SERVER_BASE}/api/swift/session-event`, {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ event }),
    });
  } catch (_) { /* best-effort; orchestrator also reads stdout */ }
}

// ── Helper: detect whether the current page is a session-expired page ─────
async function isSessionExpired(): Promise<boolean> {
  try {
    const url   = await browser.getUrl();
    const title = await browser.getTitle();
    return (
      url.includes('/login') ||
      title.toLowerCase().includes('login') ||
      title.toLowerCase().includes('session expired')
    );
  } catch (_) {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────

describe('SWIFT CRM – Recharge UAT', () => {
  let loginPage        : SwiftLoginPage;
  let rechargePage     : RechargePage;
  let viAppPage        : ViAppPage;
  let excelDataService : ExcelDataService;
  let excelReportService: ExcelReportService;
  let isLoggedIn       = false;
  let swiftRows        : any[] = [];

  before(async () => {
    loginPage         = new SwiftLoginPage();
    rechargePage      = new RechargePage();
    viAppPage         = new ViAppPage();
    excelDataService  = new ExcelDataService(EXCEL_PATH);
    excelReportService= new ExcelReportService();

    const inputRows = excelDataService.getInputData();

    // ── Point 3: filter to only the orchestrator-specified MSISDN row ─────
    swiftRows = inputRows.filter(row => {
      const isSwift = row.swift.toLowerCase() === 'yes';
      if (TARGET_MSISDN) return isSwift && row.msisdn === TARGET_MSISDN;
      return isSwift;   // fallback: run all (standalone / local dev usage)
    });

    console.log(`[Recharge UAT] SWIFT_ROW_MSISDN : "${TARGET_MSISDN || '(all)'}"`);
    console.log(`[Recharge UAT] SWIFT_REUSE_SESSION: ${REUSE_SESSION}`);
    console.log(`[Recharge UAT] Rows to run this invocation: ${swiftRows.length}`);
  });

  after(async () => {
    if (excelReportService.getResultCount() > 0) {
      const rp = await excelReportService.writeReport();
      console.log(`[Recharge UAT] Report: ${rp}`);
    }
  });

  it('should process all recharge UAT tests', async () => {
    for (let index = 0; index < swiftRows.length; index++) {
      const row  = swiftRows[index];
      const srNo = index + 1;

      console.log(`\n===== Test ${srNo} =====`);
      console.log(`MSISDN      : ${row.msisdn}`);
      console.log(`Recharge MRP: ${row.rechargeMRP}`);
      console.log(`Circle      : ${row.circle}`);
      console.log(`Recharge    : ${row.recharge}`);
      console.log(`Vi App      : ${row.viApp}`);
      console.log(`========================`);

      // ── Point 1: login once; skip if session is being reused ────────────
      if (!isLoggedIn) {
        if (REUSE_SESSION) {
          console.log('[Recharge UAT] Reusing existing browser session — skipping login');
          isLoggedIn = true;
        } else {
          console.log('[Recharge UAT] Logging in to SWIFT CRM…');
          await loginPage.login(row.username, row.password);
          isLoggedIn = true;
          console.log('[Recharge UAT] ✅ Login successful');
          await reportSessionEvent('login_success');
        }
      }

      // ── Mid-test session check (auto-logout recovery) ─────────────────
      if (await isSessionExpired()) {
        console.warn('[Recharge UAT] ⚠️  Session expired — re-logging in…');
        await reportSessionEvent('logout_detected');
        await loginPage.login(row.username, row.password);
        isLoggedIn = true;
        await reportSessionEvent('login_success');
      }

      // ── SWIFT CRM recharge flow ──────────────────────────────────────
      console.log('[Recharge UAT] Entering MSISDN');
      await rechargePage.enterMSISDN(row.msisdn);

      console.log('[Recharge UAT] Clicking Recharge Offer button');
      await rechargePage.clickRechargeOfferButton();

      console.log('[Recharge UAT] Capturing subscriber information');
      const subscriberInfo = await rechargePage.captureSubscriberInfo(row.msisdn, srNo);

      if (subscriberInfo.circle && subscriberInfo.circle.toLowerCase() !== row.circle.toLowerCase()) {
        console.warn(`[Recharge UAT] Circle mismatch! Expected: ${row.circle}, Got: ${subscriberInfo.circle}`);
      } else {
        console.log(`[Recharge UAT] Circle verified: ${subscriberInfo.circle}`);
      }

      console.log('[Recharge UAT] Clicking Offer History tab');
      await rechargePage.clickOfferHistoryTab();

      console.log('[Recharge UAT] Scraping offer history');
      const offerHistoryItems = await rechargePage.scrapeOfferHistory(row.rechargeMRP);

      offerHistoryItems.forEach(item => {
        excelReportService.addUATResult({ ...item, msisdn: row.msisdn, circle: subscriberInfo.circle });
      });
      excelReportService.addScreenshots(rechargePage.getScreenshots());

      console.log(`[Recharge UAT] Test ${srNo} completed successfully`);

      // ── Vi App flow (conditional) ───────────────────────────────────
      const viAppFlag = (row.viApp ?? '').toString().toLowerCase();
      if (viAppFlag === 'yes') {
        console.log(`\n[Vi App] ✅ Running Vi App flow for ${row.msisdn}`);
        try {
          await viAppPage.runViAppFlow(row.msisdn, process.env.VI_APP_OTP ?? undefined);
          console.log(`[Vi App] ✅ Completed for ${row.msisdn}`);
        } catch (viError: any) {
          console.error(`[Vi App] ❌ Failed for ${row.msisdn}: ${viError.message}`);
        }
      } else {
        console.log(`[Vi App] ⏭  Vi App="${row.viApp}" — skipping`);
      }
    }
  });
});