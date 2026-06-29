/**
 * ViAppPage.ts
 *
 * Drives the Vi App (Android) recharge-verification flow described in
 * "Vi Application launch steps with cmds":
 *
 *   Point 1 — Open pack details, read last-recharge amount / pack-end date /
 *             main balance / service validity, and numerically verify the
 *             last-recharge amount against Sheet1 "Recharge MRP".
 *
 *   Point 2 — Tap "repeat recharge", read the dynamic pack MRP title and the
 *             Benefit (Open) text, and verify it against the matching row in
 *             Sheet2 "Recharge Plans" (matched by New MRP + Circle).
 *
 * This flow only runs when Sheet1's "Vi App" column = "Yes" for that row.
 * If "No", the spec should skip calling runViAppFlow() entirely.
 *
 * Locator strategy: every step tries the literal XPath given in the spec
 * doc first, then falls back to the raw Appium elementId (resource id /
 * accessibility id captured during recording) if the XPath does not
 * resolve. This keeps the page object resilient to minor UI tree changes
 * while still matching the exact ids you captured.
 */

import { browser, $ } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────

export interface ViAppPackDetails {
  lastRechargeLabel: string;
  lastRechargeAmount: string;     // raw text, e.g. "₹149"
  lastRechargeAmountNumeric: string; // stripped numeric, e.g. "149"
  packEndsOnDate: string;
  mainBalance: string;
  serviceValidity: string;
}

export interface ViAppRepeatRechargeDetails {
  packTitle: string;              // e.g. "₹209 pack details"
  packTitleMrp: string;           // numeric portion extracted from title
  benefitText: string;            // raw benefit text read from the screen
}

export interface ViAppRunResult {
  msisdn: string;
  viAppFlag: string;
  ran: boolean;                          // false if flow was skipped (Vi App = No)
  pack?: ViAppPackDetails;
  repeatRecharge?: ViAppRepeatRechargeDetails;
  mrpExpected?: string;                  // Sheet1 Recharge MRP
  mrpActualNumeric?: string;
  mrpMatched?: boolean;
  expectedBenefit?: string;              // Sheet2 Benefit (Open) for matched plan
  benefitMatched?: boolean;
  screenshots: string[];                 // filenames, in step order
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────
//  Selectors (XPath primary; elementId fallback noted alongside)
// ─────────────────────────────────────────────────────────────────────────

const Selectors = {
  // Step 3 trigger -> tap into "active pack details & benefits"
  activePackEntryPoint: {
    elementId: '00000000-0000-01c4-ffff-ffff000018c2',
  },
  activePackDetailsHeader: {
    xpath: '//android.view.View[@text="active pack details & benefits"]',
  },

  // Point 1 — pack details screen
  lastRechargeLabel: {
    xpath: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[2]',
    elementId: '00000000-0000-01c4-ffff-ffff0000273c',
  },
  lastRechargeAmount: {
    elementId: '00000000-0000-01c4-ffff-ffff0000273f',
  },
  packEndsOnDate: {
    elementId: '00000000-0000-01c4-ffff-ffff00002743',
  },
  mainBalance: {
    xpath: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[4]/android.view.ViewGroup[1]',
    elementId: '00000000-0000-01c4-ffff-ffff00002754',
  },
  serviceValidity: {
    xpath: '//android.widget.ScrollView/android.view.ViewGroup/android.view.ViewGroup[4]/android.view.ViewGroup[2]',
    elementId: '00000000-0000-01c4-ffff-ffff00002759',
  },

  // Point 2 — repeat recharge / benefit verification
  repeatRechargeButton: {
    xpath: '//android.widget.Button[@content-desc="repeat recharge"]',
    elementId: '00000000-0000-01c4-ffff-ffff00003ebf',
  },
  rechargeMrpTitle: {
    elementId: '00000000-0000-01e1-ffff-ffff00003f51',
  },
  // Title text is dynamic, e.g. //android.view.View[@text="₹209 pack details"]
  // built at runtime in getPackDetailsTitleByMrp().
  benefitOpenText: {
    xpath:
      '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/' +
      'android.view.ViewGroup/android.view.ViewGroup[1]/android.widget.FrameLayout/android.view.ViewGroup/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[1]/android.widget.FrameLayout/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.view.ViewGroup/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[1]/' +
      'android.widget.FrameLayout/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup[2]/android.widget.ScrollView/' +
      'android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup/android.view.ViewGroup',
  },

  // Navigation
  viewHistoryLink: {
    xpath: '//android.widget.TextView[@text="view history"]',
  },
} as const;

const SCREENSHOTS_DIR = path.resolve('./screenshots');
const ANDROID_BACK_KEYCODE = 4;

// ─────────────────────────────────────────────────────────────────────────
//  Page object
// ─────────────────────────────────────────────────────────────────────────

export class ViAppPage {
  private screenshots: string[] = [];

  // ── Public entry point ─────────────────────────────────────────────────

  /**
   * Runs the full Vi App verification flow for one MSISDN row.
   *
   * @param msisdn        Subscriber MSISDN (for logging / screenshot naming only —
   *                       the app is assumed to already be on the correct
   *                       account context when this is called).
   * @param rechargeMRP   Sheet1 "Recharge MRP" value for this row, e.g. "149".
   * @param circle        Sheet1 "CIRCLE" value, used to pick the matching
   *                       Sheet2 plan row.
   * @param matchedPlan   The Sheet2 RechargePlan row already matched by the
   *                       caller (by New MRP + Circle applicability). Pass
   *                       undefined if no match was found upstream — the
   *                       flow will still read app data but skip the
   *                       benefit comparison.
   * @param manualOtp     Optional manual OTP override (kept for parity with
   *                       existing call sites that pass VI_APP_OTP; not
   *                       required by this verification flow itself).
   */
  async runViAppFlow(
    msisdn: string,
    rechargeMRP: string,
    circle: string,
    matchedPlan?: { newMRP: string; benefit: string; rechargeNotification: string },
    manualOtp?: string
  ): Promise<ViAppRunResult> {
    this.screenshots = [];

    const result: ViAppRunResult = {
      msisdn,
      viAppFlag: 'Yes',
      ran: true,
      mrpExpected: rechargeMRP,
      expectedBenefit: matchedPlan?.benefit,
      screenshots: [],
    };

    try {
      console.log(`[ViAppPage] ▶ Starting Vi App flow for MSISDN: ${msisdn}`);

      // ── Step 3: open the active pack details & benefits screen ─────────
      await this.openActivePackDetails();
      await this.takeScreenshot(msisdn, 'Screenshot_3_pack_entry');

      // ── Step 4: confirm header, then read Point 1 data ──────────────────
      await this.waitForActivePackDetailsHeader();
      const pack = await this.readPackDetails();
      result.pack = pack;
      await this.takeScreenshot(msisdn, 'Screenshot_4_pack_details');

      // ── Point 1: numeric MRP match vs Sheet1 Recharge MRP ──────────────
      const expectedNumeric = this.toNumeric(rechargeMRP);
      const actualNumeric = pack.lastRechargeAmountNumeric;
      result.mrpActualNumeric = actualNumeric;
      result.mrpMatched = expectedNumeric !== '' && expectedNumeric === actualNumeric;

      console.log(
        result.mrpMatched
          ? `[ViAppPage] ✓ MATCH — Last recharge ₹${actualNumeric} == Sheet1 Recharge MRP ₹${expectedNumeric}`
          : `[ViAppPage] ✗ MISMATCH — Last recharge ₹${actualNumeric} != Sheet1 Recharge MRP ₹${expectedNumeric}`
      );

      // ── Point 2: repeat recharge → benefit verification ────────────────
      await this.tapRepeatRecharge();

      const repeatRecharge = await this.readRepeatRechargeDetails();
      result.repeatRecharge = repeatRecharge;
      await this.takeScreenshot(msisdn, 'Screenshot_4.1_repeat_recharge');

      if (matchedPlan?.benefit) {
        result.benefitMatched = this.benefitsRoughlyMatch(
          repeatRecharge.benefitText,
          matchedPlan.benefit
        );
        console.log(
          result.benefitMatched
            ? `[ViAppPage] ✓ MATCH — Benefit text matches Sheet2 plan (New MRP ${matchedPlan.newMRP})`
            : `[ViAppPage] ✗ MISMATCH — Benefit text differs from Sheet2 plan (New MRP ${matchedPlan.newMRP})`
        );
      } else {
        console.warn('[ViAppPage] ⚠️ No matched Sheet2 plan supplied — skipping benefit comparison');
      }

      // ── Back once, then Screenshot 5 ────────────────────────────────────
      await this.tapBackOnce();
      await this.takeScreenshot(msisdn, 'Screenshot_5_after_back');

      // ── Navigate to recharge history ────────────────────────────────────
      await this.openViewHistory();

      result.screenshots = this.screenshots;
      console.log(`[ViAppPage] ✅ Vi App flow completed for MSISDN: ${msisdn}`);
      return result;
    } catch (err: any) {
      result.error = err?.message ?? String(err);
      result.screenshots = this.screenshots;
      console.error(`[ViAppPage] ❌ Vi App flow failed for MSISDN: ${msisdn} — ${result.error}`);
      return result;
    }
  }

  // ── Step 3 ───────────────────────────────────────────────────────────────

  private async openActivePackDetails(): Promise<void> {
    console.log('[ViAppPage] Tapping active pack entry point (000018c2)…');
    const el = await this.findByIdThenXpath(Selectors.activePackEntryPoint);
    await el.waitForDisplayed({ timeout: 20000 });
    await el.click();
  }

  private async waitForActivePackDetailsHeader(): Promise<void> {
    const header = await $(Selectors.activePackDetailsHeader.xpath);
    await header.waitForDisplayed({ timeout: 20000 });
    console.log('[ViAppPage] ✅ Redirected to "active pack details & benefits" screen');
  }

  // ── Point 1 ──────────────────────────────────────────────────────────────

  private async readPackDetails(): Promise<ViAppPackDetails> {
    console.log('[ViAppPage] Reading pack details (last recharge / pack end / balance / validity)…');

    const lastRechargeLabelEl = await this.findByXpathThenId(Selectors.lastRechargeLabel);
    const lastRechargeLabel = await this.safeGetText(lastRechargeLabelEl);

    const lastRechargeAmountEl = await this.findById(Selectors.lastRechargeAmount);
    const lastRechargeAmount = await this.safeGetText(lastRechargeAmountEl);

    const packEndsOnDateEl = await this.findById(Selectors.packEndsOnDate);
    const packEndsOnDate = await this.safeGetText(packEndsOnDateEl);

    const mainBalanceEl = await this.findByXpathThenId(Selectors.mainBalance);
    const mainBalance = await this.safeGetText(mainBalanceEl);

    const serviceValidityEl = await this.findByXpathThenId(Selectors.serviceValidity);
    const serviceValidity = await this.safeGetText(serviceValidityEl);

    const details: ViAppPackDetails = {
      lastRechargeLabel,
      lastRechargeAmount,
      lastRechargeAmountNumeric: this.toNumeric(lastRechargeAmount),
      packEndsOnDate,
      mainBalance,
      serviceValidity,
    };

    console.log('[ViAppPage] Pack details read:', JSON.stringify(details, null, 2));
    return details;
  }

  // ── Point 2 ──────────────────────────────────────────────────────────────

  private async tapRepeatRecharge(): Promise<void> {
    console.log('[ViAppPage] Tapping "repeat recharge" button (00003ebf)…');
    const el = await this.findByXpathThenId(Selectors.repeatRechargeButton);
    await el.waitForDisplayed({ timeout: 20000 });
    await el.click();
    console.log('[ViAppPage] ✅ Redirected to pack details / repeat recharge screen');
  }

  private async readRepeatRechargeDetails(): Promise<ViAppRepeatRechargeDetails> {
    console.log('[ViAppPage] Reading repeat-recharge pack title and benefit text…');

    const titleEl = await this.findById(Selectors.rechargeMrpTitle);
    const packTitle = await this.safeGetText(titleEl);
    const packTitleMrp = this.toNumeric(packTitle);

    const benefitEl = await this.findByXpathThenId(Selectors.benefitOpenText);
    const benefitText = await this.safeGetText(benefitEl);

    const details: ViAppRepeatRechargeDetails = { packTitle, packTitleMrp, benefitText };
    console.log('[ViAppPage] Repeat recharge details read:', JSON.stringify(details, null, 2));
    return details;
  }

  /**
   * Convenience helper if you need to assert against the dynamic title
   * directly, e.g. //android.view.View[@text="₹209 pack details"]
   */
  async getPackDetailsTitleByMrp(mrp: string): Promise<WebdriverIO.Element> {
    const xpath = `//android.view.View[@text="₹${mrp} pack details"]`;
    return $(xpath);
  }

  // ── Navigation helpers ───────────────────────────────────────────────────

  private async tapBackOnce(): Promise<void> {
    console.log('[ViAppPage] Tapping device back button once…');
    try {
      await browser.back();
    } catch (_e) {
      // Fallback to raw Android keyevent if browser.back() isn't supported
      try {
        await browser.pressKeyCode(ANDROID_BACK_KEYCODE);
      } catch (e2) {
        console.warn('[ViAppPage] ⚠️ Could not send back action:', e2);
      }
    }
    await browser.pause(1500);
  }

  private async openViewHistory(): Promise<void> {
    console.log('[ViAppPage] Tapping "view history"…');
    const el = await $(Selectors.viewHistoryLink.xpath);
    await el.waitForDisplayed({ timeout: 15000 });
    await el.click();
    console.log('[ViAppPage] ✅ Redirected to recharge history screen');
    await browser.pause(1500);
  }

  // ── Locator helpers ──────────────────────────────────────────────────────

  /** XPath first, elementId as fallback. */
  private async findByXpathThenId(sel: { xpath?: string; elementId?: string }): Promise<WebdriverIO.Element> {
    if (sel.xpath) {
      const el = await $(sel.xpath);
      if (await el.isExisting().catch(() => false)) return el;
    }
    if (sel.elementId) {
      return this.findById(sel.elementId);
    }
    throw new Error('[ViAppPage] No selector available (xpath/elementId both missing or unresolved)');
  }

  /** elementId first, xpath as fallback. */
  private async findByIdThenXpath(sel: { xpath?: string; elementId?: string }): Promise<WebdriverIO.Element> {
    if (sel.elementId) {
      const el = await this.tryFindById(sel.elementId);
      if (el) return el;
    }
    if (sel.xpath) {
      return $(sel.xpath);
    }
    throw new Error('[ViAppPage] No selector available (elementId/xpath both missing or unresolved)');
  }

  private async findById(sel: { elementId: string } | string): Promise<WebdriverIO.Element> {
    const elementId = typeof sel === 'string' ? sel : sel.elementId;
    const el = await this.tryFindById(elementId);
    if (!el) {
      throw new Error(`[ViAppPage] Element not found for elementId: ${elementId}`);
    }
    return el;
  }

  /**
   * Attempts to resolve a captured Appium elementId directly into a
   * WebdriverIO element handle. Recorded elementIds (UUID-style, as seen in
   * Appium Inspector) cannot always be re-attached across sessions, so this
   * wraps the lookup defensively and returns null on failure rather than
   * throwing, allowing callers to fall back to XPath.
   */
  private async tryFindById(elementId: string): Promise<WebdriverIO.Element | null> {
    try {
      // @ts-ignore - direct element re-attach via known element id (Appium/W3C)
      const el = await browser.$(`#${elementId}` as any).catch(() => null);
      if (el && (await el.isExisting().catch(() => false))) {
        return el;
      }
    } catch (_e) {
      /* ignore — fall through to null */
    }
    return null;
  }

  private async safeGetText(el: WebdriverIO.Element): Promise<string> {
    try {
      await el.waitForDisplayed({ timeout: 10000 });
      const text = await el.getText();
      return (text ?? '').trim();
    } catch (e) {
      console.warn('[ViAppPage] ⚠️ Could not read text from element:', e instanceof Error ? e.message : e);
      return '';
    }
  }

  // ── Value normalization ──────────────────────────────────────────────────

  /** Strips currency symbols / non-digits, returns the plain numeric string ("₹149" -> "149"). */
  private toNumeric(value: string): string {
    if (!value) return '';
    const match = value.replace(/,/g, '').match(/\d+(\.\d+)?/);
    return match ? match[0] : '';
  }

  /** Loose benefit comparison: case-insensitive, whitespace-normalized substring/equality check. */
  private benefitsRoughlyMatch(actual: string, expected: string): boolean {
    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();
    const a = normalize(actual);
    const e = normalize(expected);
    if (!a || !e) return false;
    return a.includes(e) || e.includes(a) || a === e;
  }

  // ── Screenshot helper ─────────────────────────────────────────────────────

  private async takeScreenshot(msisdn: string, stepName: string): Promise<string> {
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
      fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }
    const timestamp = Date.now();
    const filename = `ViApp_${msisdn}_${stepName}_${timestamp}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);

    try {
      await browser.saveScreenshot(filepath);
      console.log(`[ViAppPage] 📸 ${stepName} saved → ${filename}`);
    } catch (e) {
      console.warn(`[ViAppPage] ⚠️ Could not save screenshot for ${stepName}:`, e);
    }

    this.screenshots.push(filename);
    return filename;
  }

  getScreenshots(): string[] {
    return this.screenshots;
  }
}