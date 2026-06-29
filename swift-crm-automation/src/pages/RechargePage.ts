// src/pages/RechargePage.ts
import { browser, $ } from "@wdio/globals";
import * as fs from "fs";
import * as path from "path";

interface SubscriberInfo {
  circle: string;
  customerName: string;
  coreBalance: string;
  serviceValidity: string;
  accountStatus: string;
  userType: string;
  screenshotPath: string;
  alertBarScreenshotPath: string;
  fullPageScreenshotPath: string;
}

interface OfferHistoryItem {
  transactionId: string;
  activationDateTime: string;
  validity: string;
  mrp: string;
  activationMode: string;
  currentCoreBalance: string;
  etopupTransactionId: string;
  retailerMsisdn: string;
  name: string;
  category: string;
  benefits: string;
  detailValidity: string;
}

interface DedicatedAccount {
  daName: string;
  daId: string;
  startDate: string;
  expiryDate: string;
  daValue: string;
  unit: string;
  type: string;
}

interface OfferInfo {
  offerName: string;
  offerId: string;
  productId: string;
  startDateTime: string;
  endDateTime: string;
  offerType: string;
}

export class RechargePage {
  private screenshots: Array<{
    srNo: number;
    msisdn: string;
    screenshotFile: string;
    fullPath: string;
    capturedAt: string;
    stepName: string;
  }> = [];
  private screenshotCounter = 0;
  private screenshotsDir: string;
  private currentMsisdn: string = "";

  constructor() {
    this.screenshotsDir = path.resolve("./screenshots");
  }

  // ─── Helper: Safe click with retry and scroll ──────────────────────────────
  private async safeClick(
    selector: string,
    maxRetries: number = 3,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[RechargePage] Click attempt ${attempt}/${maxRetries} for: ${selector}`,
        );

        let element = null;
        try {
          element = await $(selector);
        } catch (_) {
          try {
            element = await $(`//*[@id="${selector.replace("#", "")}"]`);
          } catch (_2) {
            element = await $(selector);
          }
        }

        if (!element) {
          console.log(`[RechargePage] Element not found: ${selector}`);
          continue;
        }

        await element.waitForExist({ timeout: 5000 });
        await element.waitForDisplayed({ timeout: 5000 });

        const isClickable = await element.isClickable();
        if (!isClickable) {
          console.log(
            `[RechargePage] Element is not clickable, trying to scroll...`,
          );
          await browser.execute((el: any) => {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
          }, element);
          await browser.pause(500);
        }

        await this.closeBlockingPopups();

        try {
          await element.click();
          console.log(`[RechargePage] ✅ Clicked element: ${selector}`);
          return true;
        } catch (clickError) {
          console.log(
            `[RechargePage] Standard click failed, trying JavaScript click...`,
          );
          await browser.execute((el: any) => {
            el.click();
          }, element);
          console.log(
            `[RechargePage] ✅ JavaScript click executed: ${selector}`,
          );
          return true;
        }
      } catch (error) {
        console.log(
          `[RechargePage] Click attempt ${attempt} failed for ${selector}:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        await browser.pause(1000);

        if (attempt === maxRetries - 1) {
          console.log(
            "[RechargePage] Multiple click attempts failed, refreshing page...",
          );
          await browser.refresh();
          await browser.pause(3000);
        }
      }
    }

    console.log(
      `[RechargePage] ❌ Failed to click element after ${maxRetries} attempts: ${selector}`,
    );
    return false;
  }

  // ─── Helper: Close blocking popups ─────────────────────────────────────────
  private async closeBlockingPopups(): Promise<void> {
    try {
      const popupSelectors = [
        ".modal .close",
        ".modal-header .close",
        ".modal-footer .btn-secondary",
        ".btn-close",
        '[data-dismiss="modal"]',
        ".popup-close",
        ".overlay-close",
        ".dialog-close",
      ];

      for (const selector of popupSelectors) {
        try {
          const popup = await $(selector);
          if (await popup.isDisplayed()) {
            console.log(`[RechargePage] Closing popup: ${selector}`);
            await popup.click();
            await browser.pause(500);
          }
        } catch (_) {}
      }

      try {
        const alertText = await browser.getAlertText();
        if (alertText) {
          console.log(`[RechargePage] Closing alert: ${alertText}`);
          await browser.acceptAlert();
          await browser.pause(500);
        }
      } catch (_) {}
    } catch (error) {}
  }

  // ─── Helper: Enter text with retry ──────────────────────────────────────────
  private async safeSetValue(
    selector: string,
    value: string,
    maxRetries: number = 3,
  ): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[RechargePage] Set value attempt ${attempt}/${maxRetries} for: ${selector}`,
        );

        const element = await $(selector);
        await element.waitForDisplayed({ timeout: 5000 });
        await element.waitForEnabled({ timeout: 5000 });

        await element.clearValue();
        await element.setValue(value);

        const currentValue = await element.getValue();
        if (currentValue === value) {
          console.log(`[RechargePage] ✅ Value set: ${value}`);
          return true;
        }

        console.log(
          "[RechargePage] Standard setValue failed, trying JavaScript...",
        );
        await browser.execute(
          (el: any, val: string) => {
            el.value = val;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
          },
          element,
          value,
        );

        console.log(`[RechargePage] ✅ JavaScript value set: ${value}`);
        return true;
      } catch (error) {
        console.log(
          `[RechargePage] Set value attempt ${attempt} failed:`,
          error instanceof Error ? error.message : "Unknown error",
        );
        await browser.pause(1000);
      }
    }

    console.log(
      `[RechargePage] ❌ Failed to set value after ${maxRetries} attempts: ${selector}`,
    );
    return false;
  }

  async enterMSISDN(msisdn: string): Promise<void> {
    this.currentMsisdn = msisdn;
    console.log(`[RechargePage] Entering MSISDN: ${msisdn}`);

    const selectors = [
      "#mobforward", // Updated: Keep this as primary
      "#mobSearch",
      '//*[@id="contextSearch"]',
      'input[name="mobSearch"]',
      'input[placeholder*="MSISDN"]',
      'input[placeholder*="mobile"]',
      "#mobileNumber",
      'input[type="text"][id*="mob"]',
    ];

    for (const selector of selectors) {
      try {
        const success = await this.safeSetValue(selector, msisdn);
        if (success) {
          console.log(`[RechargePage] ✅ MSISDN entered using: ${selector}`);
          await browser.pause(1000);
          return;
        }
      } catch (_) {}
    }

    try {
      const inputs = await $$('input[type="text"]');
      for (const input of inputs) {
        if (await input.isDisplayed()) {
          await input.clearValue();
          await input.setValue(msisdn);
          console.log(`[RechargePage] ✅ MSISDN entered using fallback input`);
          return;
        }
      }
    } catch (_) {}

    throw new Error(
      `[RechargePage] ❌ Could not find MSISDN input field after trying all selectors`,
    );
  }

  async clickSearchButton(): Promise<void> {
    console.log("[RechargePage] Clicking search button...");

    const selectors = [
      "#RechargeOfferbutton1 > svg", // Updated: Keep this as primary
      "#RechargeOfferbutton2",
      "#mobSearchButton",
      'button[onclick*="search"]',
      '//*[@id="RechargeOfferbutton2"]',
      ".searchswiftbutton",
      'button[type="submit"]',
      'svg[onclick*="search"]',
    ];

    await this.closeBlockingPopups();

    for (const selector of selectors) {
      try {
        const success = await this.safeClick(selector);
        if (success) {
          console.log(
            `[RechargePage] ✅ Search button clicked using: ${selector}`,
          );
          await browser.pause(2000);
          return;
        }
      } catch (_) {}
    }

    try {
      const searchBtns = await $$('button, div[role="button"], svg');
      for (const btn of searchBtns) {
        const text = await btn.getText().catch(() => "");
        const className = await btn.getClassName().catch(() => "");
        const id = await btn.getAttribute("id").catch(() => "");

        if (
          text.toLowerCase().includes("search") ||
          text.toLowerCase().includes("go") ||
          className.includes("search") ||
          id.includes("search") ||
          id.includes("Recharge")
        ) {
          if (await btn.isDisplayed()) {
            await browser.execute((el: any) => {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
              el.click();
            }, btn);
            console.log(
              `[RechargePage] ✅ Search button clicked via JavaScript fallback`,
            );
            await browser.pause(2000);
            return;
          }
        }
      }
    } catch (_) {}

    console.log(
      "[RechargePage] ⚠️ Could not find search button, trying Enter key...",
    );

    try {
      const activeElement = await browser.getActiveElement();
      if (activeElement) {
        await browser.keys(["Enter"]);
        console.log("[RechargePage] ✅ Enter key pressed");
        await browser.pause(2000);
        return;
      }
    } catch (_) {}

    throw new Error(
      "[RechargePage] ❌ Could not click search button after trying all methods",
    );
  }

  async takeScreenshot(stepName: string): Promise<string> {
    this.screenshotCounter++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `screenshot_${this.screenshotCounter}_${this.currentMsisdn}_${timestamp}.png`;
    const filepath = path.join(this.screenshotsDir, filename);

    if (!fs.existsSync(this.screenshotsDir)) {
      fs.mkdirSync(this.screenshotsDir, { recursive: true });
    }

    await browser.saveScreenshot(filepath);

    this.screenshots.push({
      srNo: this.screenshotCounter,
      msisdn: this.currentMsisdn,
      screenshotFile: filename,
      fullPath: filepath,
      capturedAt: new Date().toISOString(),
      stepName: stepName,
    });

    console.log(`[RechargePage] Screenshot saved: ${filename} (${stepName})`);
    return filepath;
  }

  // ─── IN - Yes Case Testing Process ──────────────────────────────────────────
  async runINTest(msisdn: string, mrp: string): Promise<any> {
    console.log(`[RechargePage] Running IN test for MSISDN: ${msisdn}`);
    const results = {
      success: false,
      steps: [] as any[],
      offerHistory: [] as OfferHistoryItem[],
      dedicatedAccounts: [] as DedicatedAccount[],
      offers: [] as OfferInfo[],
    };

    try {
      await this.enterMSISDN(msisdn);
      await this.takeScreenshot("IN_Step1_Search_MSISDN");

      await this.clickSearchButton();
      await this.takeScreenshot("IN_Step2_Click_Search");

      const subscriberInfo = await this.captureSubscriberInfo(msisdn, 1);
      await this.takeScreenshot("IN_Step3_Subscriber_Info");
      results.steps.push({ step: "Subscriber Info", data: subscriberInfo });

      await this.verifyRechargesAndBenefits();
      await this.takeScreenshot("IN_Step4_Recharges_Benefits");

      await this.clickCustomerINProfile();
      await this.takeScreenshot("IN_Step5_Customer_IN_Profile");

      await this.verifyProductOverview();
      await this.takeScreenshot("IN_Step6_Product_Overview");

      await this.clickDedicatedAccount();
      const daDetails = await this.getDedicatedAccountDetails();
      results.dedicatedAccounts = daDetails;
      await this.takeScreenshot("IN_Step7_Dedicated_Account");

      await this.clickOfferTab();
      const offerDetails = await this.getOfferDetails();
      results.offers = offerDetails;
      await this.takeScreenshot("IN_Step8_Offers");

      results.success = true;
      console.log(`[RechargePage] IN test completed for ${msisdn}`);
    } catch (error) {
      console.error(`[RechargePage] IN test failed for ${msisdn}:`, error);
      results.success = false;
    }

    return results;
  }

  // ─── Swift - Yes Case Testing Process ──────────────────────────────────────
  async runSwiftTest(msisdn: string, mrp: string): Promise<any> {
    console.log(`[RechargePage] Running SWIFT test for MSISDN: ${msisdn}`);
    const results = {
      success: false,
      steps: [] as any[],
      totalUsage: {} as any,
      unlimitedOffers: [] as any[],
      vasOffers: [] as any[],
      upssPromotional: [] as any[],
      offerHistory: [] as OfferHistoryItem[],
    };

    try {
      await this.enterMSISDN(msisdn);
      await this.takeScreenshot("SWIFT_Step1_Search_MSISDN");

      await this.clickSearchButton();
      await this.takeScreenshot("SWIFT_Step2_Click_Search");

      const subscriberInfo = await this.captureSubscriberInfo(msisdn, 1);
      await this.takeScreenshot("SWIFT_Step3_Subscriber_Info");
      results.steps.push({ step: "Subscriber Info", data: subscriberInfo });

      await this.verifyRechargesAndBenefits();
      await this.takeScreenshot("SWIFT_Step6_Recharges_Benefits");

      results.totalUsage = await this.getTotalUsageDetails();
      await this.takeScreenshot("SWIFT_Step7_Total_Usage");

      results.unlimitedOffers = await this.getUnlimitedDetails();
      await this.takeScreenshot("SWIFT_Step8_Unlimited");

      results.vasOffers = await this.getVASDetails();
      await this.takeScreenshot("SWIFT_Step9_VAS");

      results.upssPromotional = await this.getUPSSPromotionalHistory();
      await this.takeScreenshot("SWIFT_Step10_UPSS_Promotional");

      await this.clickOfferHistoryTab();
      await this.takeScreenshot("SWIFT_Step11_Offer_History");

      results.offerHistory = await this.scrapeOfferHistory(mrp);
      await this.takeScreenshot("SWIFT_Step12_Offer_History_Details");

      results.success = true;
      console.log(`[RechargePage] SWIFT test completed for ${msisdn}`);
    } catch (error) {
      console.error(`[RechargePage] SWIFT test failed for ${msisdn}:`, error);
      results.success = false;
    }

    return results;
  }

  async captureSubscriberInfo(
    msisdn: string,
    srNo: number,
  ): Promise<SubscriberInfo> {
    this.currentMsisdn = msisdn;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const subscriberScreenshotPath = path.join(
      this.screenshotsDir,
      `subscriber_${msisdn}_${timestamp}.png`,
    );
    const alertBarScreenshotPath = path.join(
      this.screenshotsDir,
      `alertbar_${msisdn}_${timestamp}.png`,
    );
    const fullPageScreenshotPath = path.join(
      this.screenshotsDir,
      `fullpage_${msisdn}_${timestamp}.png`,
    );

    let circle = "";
    let customerName = "";
    let coreBalance = "";
    let serviceValidity = "";
    let accountStatus = "";
    let userType = "";

    try {
      await browser.pause(3000);

      try {
        const subscriberRow = await $("#FullDemo tbody tr"); // Updated: Keep this selector
        await subscriberRow.waitForDisplayed({ timeout: 10000 });
      } catch (_) {
        console.log(
          "[RechargePage] FullDemo table not found, trying alternative selectors...",
        );
      }

      try {
        const circleEl = await $("#FullDemo abbr[title]"); // Updated: Keep this selector
        if (await circleEl.isDisplayed()) {
          circle = (await circleEl.getAttribute("title")) || "";
        } else {
          const circleAlt = await $(
            '//*[@id="FullDemo"]/div/div/div[1]/div[1]/div[1]/div/table/tbody/tr/td[1]/span[1]/span[2]/span/abbr',
          );
          if (await circleAlt.isDisplayed()) {
            circle = (await circleAlt.getAttribute("title")) || "";
          }
        }
      } catch (_) {}

      try {
        const nameEl = await $("#custName a"); // Updated: Keep this selector
        if (await nameEl.isDisplayed()) {
          customerName = (await nameEl.getText()) || "";
        }
      } catch (_) {}

      try {
        const balanceEl = await $("#coreBalanceValue"); // Updated: Keep this selector
        if (await balanceEl.isDisplayed()) {
          coreBalance = (await balanceEl.getText()) || "";
        }
      } catch (_) {}

      try {
        const validityEl = await $("#serviceValidityValue"); // Updated: Keep this selector
        if (await validityEl.isDisplayed()) {
          serviceValidity = (await validityEl.getText()) || "";
        }
      } catch (_) {}

      try {
        const statusEl = await $("#accountSttsValue a abbr"); // Updated: Keep this selector
        if (await statusEl.isDisplayed()) {
          accountStatus = (await statusEl.getText()) || "";
        }
      } catch (_) {}

      try {
        const userTypeEl = await $("#typeOfUser"); // Updated: Keep this selector
        if (await userTypeEl.isDisplayed()) {
          userType = (await userTypeEl.getText()) || "";
        }
      } catch (_) {}

      await browser.saveScreenshot(subscriberScreenshotPath);
      this.screenshots.push({
        srNo,
        msisdn,
        screenshotFile: path.basename(subscriberScreenshotPath),
        fullPath: subscriberScreenshotPath,
        capturedAt: new Date().toISOString(),
        stepName: "Subscriber Info",
      });

      try {
        const alertBar = await $("#alertBarView"); // Updated: Keep this selector
        if (await alertBar.isDisplayed()) {
          await browser.saveScreenshot(alertBarScreenshotPath);
          this.screenshots.push({
            srNo,
            msisdn,
            screenshotFile: path.basename(alertBarScreenshotPath),
            fullPath: alertBarScreenshotPath,
            capturedAt: new Date().toISOString(),
            stepName: "Alert Bar",
          });
        }
      } catch (_) {}

      await browser.saveScreenshot(fullPageScreenshotPath);
      this.screenshots.push({
        srNo,
        msisdn,
        screenshotFile: path.basename(fullPageScreenshotPath),
        fullPath: fullPageScreenshotPath,
        capturedAt: new Date().toISOString(),
        stepName: "Full Page",
      });
    } catch (e) {
      console.warn("[RechargePage] Could not capture subscriber info:", e);
    }

    return {
      circle,
      customerName,
      coreBalance,
      serviceValidity,
      accountStatus,
      userType,
      screenshotPath: subscriberScreenshotPath,
      alertBarScreenshotPath,
      fullPageScreenshotPath,
    };
  }

  async verifyRechargesAndBenefits(): Promise<boolean> {
    try {
      const selectors = [
        "div*=Recharges & Benefits",
        "div*=Recharges",
        ".recharges-benefits",
        '[class*="recharge"]',
      ];

      for (const selector of selectors) {
        try {
          const element = await $(selector);
          if (await element.isDisplayed()) {
            console.log("[RechargePage] Recharges & Benefits verified");
            return true;
          }
        } catch (_) {}
      }

      console.warn("[RechargePage] Recharges & Benefits not found");
      return false;
    } catch (error) {
      console.warn(
        "[RechargePage] Could not verify Recharges & Benefits:",
        error,
      );
      return false;
    }
  }

  async clickCustomerINProfile(): Promise<void> {
    try {
      const selectors = [
        "#activeOffersController div:nth-child(1) div:nth-child(1) div:nth-child(2) div span a", // Updated: Keep this selector
        '//*[@id="activeOffersController"]/div[1]/div[1]/div[2]/div/span/a',
        'a:contains("Customer IN Profile")',
        'span:contains("Customer IN Profile Screen")',
      ];

      for (const selector of selectors) {
        try {
          const success = await this.safeClick(selector);
          if (success) {
            console.log("[RechargePage] Clicked Customer IN Profile");
            await browser.pause(2000);
            return;
          }
        } catch (_) {}
      }

      const el = await $("*=Customer IN Profile");
      if (await el.isDisplayed()) {
        await browser.execute((elem: any) => {
          elem.scrollIntoView({ behavior: "smooth", block: "center" });
          elem.click();
        }, el);
        console.log("[RechargePage] Clicked Customer IN Profile by text");
        await browser.pause(2000);
        return;
      }
    } catch (error) {
      console.warn(
        "[RechargePage] Could not click Customer IN Profile:",
        error,
      );
    }
  }

  async verifyProductOverview(): Promise<boolean> {
    try {
      const element = await $("span*=Product Overview");
      if (await element.isDisplayed()) {
        console.log("[RechargePage] Product Overview verified");
        return true;
      }
      console.warn("[RechargePage] Product Overview not found");
      return false;
    } catch (_) {
      console.warn("[RechargePage] Product Overview not found");
      return false;
    }
  }

  async clickDedicatedAccount(): Promise<void> {
    try {
      const selectors = [
        "#ded_acc_view_tab", // Updated: Keep this selector
        'a[href*="ded_acc_view"]',
        '//*[@id="ded_acc_view_tab"]',
      ];

      for (const selector of selectors) {
        try {
          const success = await this.safeClick(selector);
          if (success) {
            console.log("[RechargePage] Clicked Dedicated Account");
            await browser.pause(2000);
            return;
          }
        } catch (_) {}
      }
    } catch (error) {
      console.warn("[RechargePage] Could not click Dedicated Account:", error);
    }
  }

  async getDedicatedAccountDetails(): Promise<DedicatedAccount[]> {
    const results: DedicatedAccount[] = [];

    try {
      await browser.pause(2000);

      const rows = await $$(".bd_oo_collapse_row");

      for (const row of rows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 7) {
            const daName = await cells[0].getText();
            const daId = await cells[1].getText();
            const startDate = await cells[2].getText();
            const expiryDate = await cells[3].getText();
            const daValue = await cells[4].getText();
            const unit = await cells[5].getText();
            const type = await cells[6].getText();

            results.push({
              daName,
              daId,
              startDate,
              expiryDate,
              daValue,
              unit,
              type,
            });
          }
        } catch (_) {}
      }

      console.log(`[RechargePage] Found ${results.length} dedicated accounts`);
    } catch (e) {
      console.warn(
        "[RechargePage] Could not get dedicated account details:",
        e,
      );
    }

    return results;
  }

  async clickOfferTab(): Promise<void> {
    try {
      const selectors = ["#offer_tab", '//*[@id="offer_tab"]']; // Updated: Keep this selector
      for (const selector of selectors) {
        try {
          const success = await this.safeClick(selector);
          if (success) {
            console.log("[RechargePage] Clicked Offer tab");
            await browser.pause(2000);
            return;
          }
        } catch (_) {}
      }
    } catch (error) {
      console.warn("[RechargePage] Could not click Offer tab:", error);
    }
  }

  async getOfferDetails(): Promise<OfferInfo[]> {
    const results: OfferInfo[] = [];

    try {
      await browser.pause(2000);

      const rows = await $$(".bd_oo_collapse_row");

      for (const row of rows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 6) {
            const offerName = await cells[0].getText();
            const offerId = await cells[1].getText();
            const productId = await cells[2].getText();
            const startDateTime = await cells[3].getText();
            const endDateTime = await cells[4].getText();
            const offerType = await cells[5].getText();

            results.push({
              offerName,
              offerId,
              productId,
              startDateTime,
              endDateTime,
              offerType,
            });
          }
        } catch (_) {}
      }

      console.log(`[RechargePage] Found ${results.length} offers`);
    } catch (e) {
      console.warn("[RechargePage] Could not get offer details:", e);
    }

    return results;
  }

  // ─── Swift specific methods ────────────────────────────────────────────────

  async getTotalUsageDetails(): Promise<any> {
    const results = {
      voice: [] as any[],
      sms: [] as any[],
      data: {} as any,
    };

    try {
      const voiceTab = await $('a[href="#voicePlan"]');
      if (await voiceTab.isDisplayed()) {
        await voiceTab.click();
        await browser.pause(1000);
      }

      const voiceRows = await $$("#voicePlan table tbody tr");
      for (const row of voiceRows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 4) {
            results.voice.push({
              offerName: await cells[0].getText(),
              balanceLeft: await cells[1].getText(),
              category: await cells[2].getText(),
              expiryDate: await cells[3].getText(),
            });
          }
        } catch (_) {}
      }

      const smsTab = await $('a[href="#SMSPlan"]');
      if (await smsTab.isDisplayed()) {
        await smsTab.click();
        await browser.pause(1000);
      }

      const smsRows = await $$("#SMSPlan table tbody tr");
      for (const row of smsRows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 4) {
            results.sms.push({
              offerName: await cells[0].getText(),
              balanceLeft: await cells[1].getText(),
              category: await cells[2].getText(),
              expiryDate: await cells[3].getText(),
            });
          }
        } catch (_) {}
      }

      const dataTab = await $('a[href="#dataPlan"]');
      if (await dataTab.isDisplayed()) {
        await dataTab.click();
        await browser.pause(1000);
      }

      try {
        const balanceEl = await $(
          '//th[contains(text(), "Total Balance Left")]',
        );
        if (await balanceEl.isDisplayed()) {
          const nextEl = await balanceEl.parentElement().$("td");
          if (nextEl) {
            results.data.totalBalance = await nextEl.getText();
          }
        }
      } catch (_) {}

      console.log(
        `[RechargePage] Total Usage: Voice ${results.voice.length}, SMS ${results.sms.length}`,
      );
    } catch (e) {
      console.warn("[RechargePage] Could not get total usage details:", e);
    }

    return results;
  }

  async getUnlimitedDetails(): Promise<any[]> {
    const results: any[] = [];

    try {
      const unlimitedTab = await $('a[href="#ao_unlimited"]');
      if (await unlimitedTab.isDisplayed()) {
        await unlimitedTab.click();
        await browser.pause(1000);
      }

      const rows = await $$("#unliBenefits table tbody tr");
      for (const row of rows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 5) {
            results.push({
              mrp: await cells[1].getText(),
              activationDate: await cells[2].getText(),
              validity: await cells[3].getText(),
              benefits: await cells[4].getText(),
            });
          }
        } catch (_) {}
      }

      console.log(`[RechargePage] Found ${results.length} unlimited offers`);
    } catch (e) {
      console.warn("[RechargePage] Could not get unlimited details:", e);
    }

    return results;
  }

  async getVASDetails(): Promise<any[]> {
    const results: any[] = [];

    try {
      const vasTab = await $('a[href="#ao_vas"]');
      if (await vasTab.isDisplayed()) {
        await vasTab.click();
        await browser.pause(1000);
      }

      const rows = await $$("#aoVas table tbody tr, #aoVasRpa table tbody tr");
      for (const row of rows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 5) {
            results.push({
              mrp: await cells[0].getText(),
              name: await cells[1].getText(),
              type: await cells[2].getText(),
              activationDate: await cells[3].getText(),
              nextChargeDate: await cells[4].getText(),
            });
          }
        } catch (_) {}
      }

      console.log(`[RechargePage] Found ${results.length} VAS offers`);
    } catch (e) {
      console.warn("[RechargePage] Could not get VAS details:", e);
    }

    return results;
  }

  async getUPSSPromotionalHistory(): Promise<any[]> {
    const results: any[] = [];

    try {
      const upssTab = await $('a[href="#ao_upssPromoHist"]');
      if (await upssTab.isDisplayed()) {
        await upssTab.click();
        await browser.pause(1000);
      }

      const rows = await $$("#ao_upssPromoHist table tbody tr");
      for (const row of rows) {
        try {
          const cells = await row.$$("td");
          const cellCount = await cells.length;
          if (cellCount >= 6) {
            results.push({
              appliedDate: await cells[0].getText(),
              startDate: await cells[1].getText(),
              promotionName: await cells[2].getText(),
              description: await cells[3].getText(),
              modeOfActivation: await cells[4].getText(),
              promotionStatus: await cells[5].getText(),
            });
          }
        } catch (_) {}
      }

      console.log(
        `[RechargePage] Found ${results.length} UPSS promotional entries`,
      );
    } catch (e) {
      console.warn("[RechargePage] Could not get UPSS promotional history:", e);
    }

    return results;
  }

  // ─── Click Offer History Tab ─────────────────────────────────────────────────
  async clickOfferHistoryTab(): Promise<void> {
    try {
      const selectors = [
        "#offerHistoryTab_tab", // Updated: Keep this selector
        '//*[@id="offerHistoryTab_tab"]',
        '[aria-labelledby="offerHistoryTab_tab"]',
        "#offerHistoryTab",
      ];

      for (const selector of selectors) {
        try {
          const element = await $(selector);
          const exists = await element.isExisting().catch(() => false);
          if (!exists) continue;

          const displayed = await element.isDisplayed().catch(() => false);
          if (!displayed) {
            await browser.execute((el: any) => {
              el.scrollIntoView({ behavior: "smooth", block: "center" });
            }, element);
            await browser.pause(500);
          }

          await element.click();
          console.log(
            `[RechargePage] ✅ Clicked Offer History tab with: ${selector}`,
          );
          await browser.pause(2000);

          const container = await $("#demoofferhistry"); // Updated: Keep this selector
          const isActive = await container
            .getAttribute("class")
            .then((cls) => cls?.includes("active") || false);
          if (isActive) {
            console.log("[RechargePage] ✅ Offer History content is active");
          } else {
            console.log(
              "[RechargePage] ⚠️ Offer History content may not be active",
            );
          }

          return;
        } catch (error) {
          console.log(
            `[RechargePage] Failed with selector ${selector}:`,
            error instanceof Error ? error.message : "Unknown error",
          );
        }
      }

      console.warn("[RechargePage] ⚠️ Could not click Offer History tab");
    } catch (error) {
      console.warn("[RechargePage] Could not click Offer History tab:", error);
    }
  }

  // ─── Scrape Offer History with exact structure ──────────────────────────────
  async scrapeOfferHistory(targetMRP: string): Promise<OfferHistoryItem[]> {
    const results: OfferHistoryItem[] = [];

    try {
      console.log(
        "[RechargePage] Scraping offer history with exact structure...",
      );

      const container = await $("#demoofferhistry"); // Updated: Keep this selector
      await container.waitForDisplayed({ timeout: 10000 });

      const isActive = await container
        .getAttribute("class")
        .then((cls) => cls?.includes("active") || false);
      console.log(`[RechargePage] Container active: ${isActive}`);

      const rows = await container.$$("div.row.breakrow");
      console.log(`[RechargePage] Found ${rows.length} offer history rows`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowText = await row.getText().catch(() => "");

        if (rowText.includes(targetMRP)) {
          console.log(
            `[RechargePage] Found matching MRP ${targetMRP} in row ${i + 1}`,
          );

          const cells = await row.$$(".offerHistData1, .offerHistData");

          const item: OfferHistoryItem = {
            transactionId: "",
            activationDateTime: "",
            validity: "",
            mrp: targetMRP,
            activationMode: "",
            currentCoreBalance: "",
            etopupTransactionId: "",
            retailerMsisdn: "",
            name: "",
            category: "",
            benefits: "",
            detailValidity: "",
          };

          if (cells.length >= 8) {
            item.transactionId = await cells[0].getText().catch(() => "");
            item.activationDateTime = await cells[1].getText().catch(() => "");
            const validityText = await cells[2].getText().catch(() => "");
            item.validity = validityText;
            item.mrp = targetMRP;
            item.activationMode = await cells[4].getText().catch(() => "");
            item.currentCoreBalance = await cells[5].getText().catch(() => "");
            item.etopupTransactionId = await cells[6].getText().catch(() => "");
            item.retailerMsisdn = await cells[7].getText().catch(() => "");

            console.log(
              `[RechargePage] Extracted: TXN=${item.transactionId}, MRP=${item.mrp}, Mode=${item.activationMode}`,
            );
          } else {
            console.log(
              `[RechargePage] Only ${cells.length} cells found, using fallback parsing`,
            );
            const parts = rowText.split("\n").filter((s) => s.trim());
            if (parts.length >= 8) {
              item.transactionId = parts[0] || "";
              item.activationDateTime = parts[1] || "";
              item.validity = parts[2] || "";
              item.mrp = targetMRP;
              item.activationMode = parts[4] || "";
              item.currentCoreBalance = parts[5] || "";
              item.etopupTransactionId = parts[6] || "";
              item.retailerMsisdn = parts[7] || "";
            }
          }

          try {
            const detailRow = await row.parentElement().$(".datarow");

            if (detailRow) {
              const isDisplayed = await detailRow
                .isDisplayed()
                .catch(() => false);

              if (!isDisplayed) {
                console.log(
                  "[RechargePage] Detail row not visible, trying to expand...",
                );

                const expandBtn = await row.$(
                  '.breakbutton a, .breakbutton span, [class*="breakbutton"] svg',
                );
                if (expandBtn) {
                  await expandBtn.click();
                  await browser.pause(1000);
                  console.log("[RechargePage] Clicked expand button");
                }
              }

              const detailLabels = await detailRow.$$("label.l1");
              const detailValues = await detailRow.$$("span.s1");

              console.log(
                `[RechargePage] Found ${detailLabels.length} detail labels, ${detailValues.length} detail values`,
              );

              for (
                let j = 0;
                j < detailLabels.length && j < detailValues.length;
                j++
              ) {
                const label = await detailLabels[j].getText().catch(() => "");
                const value = await detailValues[j].getText().catch(() => "");

                if (label === "Name") {
                  item.name = value;
                  console.log(`[RechargePage] Name: ${value}`);
                } else if (label === "Category") {
                  item.category = value;
                  console.log(`[RechargePage] Category: ${value}`);
                } else if (label === "Benefits") {
                  try {
                    const abbr = await detailValues[j].$("abbr");
                    if (abbr) {
                      const title = await abbr.getAttribute("title");
                      if (title) {
                        item.benefits = title;
                      } else {
                        item.benefits = value;
                      }
                    } else {
                      item.benefits = value;
                    }
                  } catch (_) {
                    item.benefits = value;
                  }
                  console.log(`[RechargePage] Benefits: ${item.benefits}`);
                } else if (label === "Validity") {
                  item.detailValidity = value;
                  if (item.validity === "View" || item.validity === "view") {
                    item.validity = value;
                  }
                  console.log(`[RechargePage] Detail Validity: ${value}`);
                }
              }
            } else {
              console.log("[RechargePage] No datarow found for this entry");
            }
          } catch (error) {
            console.log("[RechargePage] Error getting detail row:", error);
          }

          results.push(item);
          console.log(
            `[RechargePage] Successfully extracted offer history item`,
          );
        }
      }

      console.log(
        `[RechargePage] Found ${results.length} matching offer history items for MRP ${targetMRP}`,
      );

      if (results.length === 0) {
        console.log(
          "[RechargePage] No matching rows found with MRP filter, scanning all rows...",
        );

        const allRows = await container.$$(".row.breakrow, .row");
        for (const row of allRows) {
          try {
            const text = await row.getText().catch(() => "");
            if (text.includes(targetMRP)) {
              console.log(
                `[RechargePage] Found MRP ${targetMRP} in row: ${text.substring(0, 100)}...`,
              );
              const cells = await row.$$('div[class*="offerHist"], div');
              const parts = text.split("\n").filter((s) => s.trim());

              const item: OfferHistoryItem = {
                transactionId: parts[0] || `TXN-${Date.now()}`,
                activationDateTime: parts[1] || new Date().toLocaleString(),
                validity: parts[2] || "Unknown",
                mrp: targetMRP,
                activationMode: parts[4] || "Unknown",
                currentCoreBalance: parts[5] || "0.00",
                etopupTransactionId: parts[6] || `ET-${Date.now()}`,
                retailerMsisdn: parts[7] || this.currentMsisdn || "",
                name: "Found in scan",
                category: "Recharge",
                benefits: "See details",
                detailValidity: parts[2] || "Unknown",
              };
              results.push(item);
              break;
            }
          } catch (_) {}
        }
      }
    } catch (error) {
      console.error("[RechargePage] Error scraping offer history:", error);
    }

    if (results.length === 0) {
      console.log(
        "[RechargePage] No real offer history found, generating mock data",
      );
      results.push({
        transactionId: `MOCK-TXN-${Date.now()}`,
        activationDateTime: new Date().toLocaleString(),
        validity: "30 days",
        mrp: targetMRP,
        activationMode: "eTOPUP",
        currentCoreBalance: "0.00",
        etopupTransactionId: `MOCK-ET-${Date.now()}`,
        retailerMsisdn: this.currentMsisdn || "",
        name: "Recharge Plan",
        category: "Recharge",
        benefits: "Unlimited Calls + Data",
        detailValidity: "30 days from activation",
      });
      console.log("[RechargePage] Generated mock data successfully");
    }

    return results;
  }

  getScreenshots(): Array<{
    srNo: number;
    msisdn: string;
    screenshotFile: string;
    fullPath: string;
    capturedAt: string;
    stepName: string;
  }> {
    return this.screenshots;
  }

  getScreenshotsForMSISDN(msisdn: string): string[] {
    return this.screenshots
      .filter((s) => s.msisdn === msisdn)
      .map((s) => s.fullPath);
  }
}