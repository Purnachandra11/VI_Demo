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
  // ─── NEW FIELDS ─────────────────────────────────────────────
  isMatched: boolean;          // did MRP or core balance match target?
  isTodayActivation: boolean;  // is activationDateTime = today's date?
  matchStatus: "Pass" | "Fail-DateMismatch" | "Unmatched" | "Fail-UnparsableDate";
  matchReason: string;
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
  private async safeSetValueswift(
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

        await element.waitForExist({ timeout: 5000 });
        await element.waitForDisplayed({ timeout: 5000 });
        await element.waitForEnabled({ timeout: 5000 });

        // Scroll into view
        await browser.execute((el: any) => {
          el.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, element);

        await browser.pause(300);

        // Focus
        await element.click();

        // Clear
        await element.clearValue();

        await browser.pause(200);

        // Type normally
        await element.setValue(value);

        await browser.pause(500);

        let currentValue = await element.getValue();

        console.log(`[RechargePage] After setValue -> "${currentValue}"`);

        if (currentValue.trim() === value.trim()) {
          console.log("[RechargePage] ✅ Value entered using setValue");

          await browser.keys("Tab");
          await browser.pause(300);

          return true;
        }

        console.log("[RechargePage] setValue failed. Trying JavaScript...");

        // JavaScript fallback
        await browser.execute(
          (el: any, val: string) => {
            el.focus();

            el.value = "";

            el.value = val;

            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
            el.dispatchEvent(new FocusEvent("blur", { bubbles: true }));
          },
          element,
          value,
        );

        await browser.pause(500);

        currentValue = await element.getValue();

        console.log(`[RechargePage] After JS -> "${currentValue}"`);

        if (currentValue.trim() === value.trim()) {
          console.log("[RechargePage] ✅ Value entered using JavaScript");

          return true;
        }

        console.log("[RechargePage] ❌ Value verification failed.");
      } catch (error) {
        console.log(
          `[RechargePage] Attempt ${attempt} failed:`,
          error instanceof Error ? error.message : error,
        );

        await browser.pause(1000);
      }
    }

    console.log(`[RechargePage] ❌ Failed to enter value into ${selector}`);

    return false;
  }

      async enterMSISDNswift(msisdn: string): Promise<void> {
        const selectors = [
        "#mobforward",  
        'input[placeholder="Search Swift"]',
        "#contextSearch",         
        'input[name="contextSearch"]',
        'input[placeholder="Search Swift"]',
        'input[placeholder*="Search"]',
        'input.form-control[id="contextSearch"]',
    ];

    for (const selector of selectors) {
      try {
        const success = await this.safeSetValueswift(selector, msisdn);
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

  async clickSearchButtonswift(): Promise<void> {
  console.log("[RechargePage] Clicking search button...");

  const selectors = [
    "#RechargeOfferbutton1",
     ".searchswiftbutton",
    "#RechargeOfferbutton2",                  
    '//*[@id="RechargeOfferbutton2"]',        
    'div[id="RechargeOfferbutton2"]',
    ];

    await this.closeBlockingPopups();

    for (const selector of selectors) {
      try {
        const success = await this.safeClick(selector);
        if (success) {
          console.log(
            `[RechargePage] ✅ Search button clicked using: ${selector}`,
          );
          await browser.pause(5000);
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

    async enterMSISDN(msisdn: string): Promise<void> {
  // Add a page stability check first
  await browser.pause(1000);
  
  // Wait for any page load to complete
  await browser.waitUntil(
    async () => {
      const state = await browser.execute(() => document.readyState);
      return state === 'complete';
    },
    { timeout: 10000, timeoutMsg: 'Page did not load completely' }
  );

  const selectors = [
    "#mobforward", 
    'input[placeholder="Search Swift"]',
    "#contextSearch",
    'input[name="contextSearch"]',
    'input[placeholder*="Search"]',
    'input.form-control[id="contextSearch"]'
  ];

  for (const selector of selectors) {
    try {
      console.log(`[RechargePage] Trying selector: ${selector}`);
      
      // Wait for element with a longer timeout
      const element = await $(selector);
      const exists = await element.waitForExist({ timeout: 10000 });
      
      if (!exists) {
        console.log(`[RechargePage] Element not found: ${selector}`);
        continue;
      }
      
      // Wait for it to be displayed and enabled
      await element.waitForDisplayed({ timeout: 5000 });
      await element.waitForEnabled({ timeout: 5000 });

      // Scroll into view
      await browser.execute((el: any) => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }, element);
      await browser.pause(500);

      // Clear and set value
      await element.click();
      await element.clearValue();
      await browser.pause(300);
      await element.setValue(msisdn);
      await browser.pause(500);

      const enteredValue = (await element.getValue()).trim();
      console.log(`[RechargePage] Verification: "${enteredValue}"`);

      if (enteredValue === msisdn.trim()) {
        console.log(`[RechargePage] ✅ MSISDN entered using ${selector}`);
        await browser.keys("Tab");
        await browser.pause(1000);
        return;
      }
      
      // Fallback: Try JavaScript
      console.log("[RechargePage] Trying JavaScript fallback...");
      await browser.execute(
        (el: any, val: string) => {
          el.focus();
          el.value = "";
          el.value = val;
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        },
        element,
        msisdn
      );
      
      await browser.pause(500);
      const jsValue = (await element.getValue()).trim();
      
      if (jsValue === msisdn.trim()) {
        console.log(`[RechargePage] ✅ MSISDN entered using JS on ${selector}`);
        await browser.keys("Tab");
        await browser.pause(1000);
        return;
      }
      
    } catch (error) {
      console.log(`[RechargePage] Selector ${selector} failed:`, error instanceof Error ? error.message : error);
    }
  }

  throw new Error("Unable to enter MSISDN.");
}

async clickSearchButton(): Promise<void> {
  console.log("[RechargePage] Clicking Search...");

  // Wait for page stability
  await browser.pause(2000);
  
  // Try to find the search field and get its value
  let searchValue = "";
  const inputSelectors = ["#contextSearch", "#mobforward", 'input[placeholder="Search Swift"]'];

  for (const selector of inputSelectors) {
    try {
      const input = await $(selector);
      const exists = await input.isExisting();
      if (exists && await input.isDisplayed()) {
        searchValue = (await input.getValue()).trim();
        if (searchValue) {
          console.log(`[RechargePage] Search value: ${searchValue}`);
          break;
        }
      }
    } catch (_) {}
  }

  if (!searchValue) {
    console.log("[RechargePage] Search field is empty. Trying to enter MSISDN again...");
    // Re-enter MSISDN if it's empty
    // Note: You'll need access to the current MSISDN here
    // You might want to pass it as a parameter to this method
  }

  await this.closeBlockingPopups();

  // Wait for the search button to be available
  await browser.pause(1000);

  const selectors = [
    "#RechargeOfferbutton1",
    ".searchswiftbutton",
    "#RechargeOfferbutton2",
    '//*[@id="RechargeOfferbutton2"]',
    'div[id="RechargeOfferbutton2"]',
  ];

  for (const selector of selectors) {
    try {
      if (await this.safeClick(selector)) {
        console.log(`[RechargePage] ✅ Search clicked using ${selector}`);
        await browser.pause(5000);
        return;
      }
    } catch (_) {}
  }

  throw new Error("Unable to click Search button.");
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

  // ─── Helper: Capture Account Overview Details ─────────────────────────────────
        async captureAccountOverview(): Promise<any> {
        console.log("[RechargePage] Capturing Account Overview details...");
        const accountDetails: any = {
          activationDate: "", serviceRemovalOn: "", supervisionExpiresOn: "",
          mainBalance: "", serviceFeeExpiresOn: "", subscriberStatus: "", creditClearanceOn: ""
        };

        let switchedFrame = false;
        try {
          // Try top-level first
          let accountBox = await $('.accountBox');
          let found = await accountBox.waitForDisplayed({ timeout: 5000 }).then(() => true).catch(() => false);

          if (!found) {
            console.log('[RechargePage] .accountBox not found in top document — checking iframes...');
            const iframeCount = await browser.execute(() => document.querySelectorAll('iframe').length);
            console.log(`[RechargePage] Found ${iframeCount} iframe(s) on page`);

            for (let i = 0; i < iframeCount; i++) {
              try {
                const iframeEl = await $$('iframe')[i];
                await browser.switchToFrame(iframeEl);
                switchedFrame = true;

                accountBox = await $('.accountBox');
                found = await accountBox.waitForDisplayed({ timeout: 3000 }).then(() => true).catch(() => false);

                if (found) {
                  console.log(`[RechargePage] ✅ Found .accountBox inside iframe index ${i}`);
                  break;
                } else {
                  await browser.switchToParentFrame();
                  switchedFrame = false;
                }
              } catch (frameErr) {
                console.warn(`[RechargePage] Error checking iframe ${i}:`, frameErr);
                try { await browser.switchToParentFrame(); } catch (_) {}
                switchedFrame = false;
              }
            }
          }

          if (!found) {
            console.error('[RechargePage] 🚨 .accountBox not found in top document OR any iframe — genuine page-structure issue');
            return accountDetails;
          }

          const fieldMappings = [
            { id: 'ActivationDateValue', key: 'activationDate' },
            { id: 'ServiceRemovalOnValue', key: 'serviceRemovalOn' },
            { id: 'SupervisionExpiresOnValue', key: 'supervisionExpiresOn' },
            { id: 'MainBalanceValue', key: 'mainBalance' },
            { id: 'ServiceFeeExpiresOnValue', key: 'serviceFeeExpiresOn' },
            { id: 'SubscriberStatusValue', key: 'subscriberStatus' },
            { id: 'CreditClearanceOnValue', key: 'creditClearanceOn' }
          ];

          for (const mapping of fieldMappings) {
            try {
              const element = await $(`#${mapping.id}`);
              const displayed = await element.waitForDisplayed({ timeout: 5000 }).then(() => true).catch(() => false);
              if (displayed) {
                const value = await element.getText();
                accountDetails[mapping.key] = value.trim();
                console.log(`[RechargePage] ✅ ${mapping.key}: ${value.trim()}`);
              } else {
                console.warn(`[RechargePage] ⚠️ #${mapping.id} not displayed within 5s`);
              }
            } catch (error) {
              console.warn(`[RechargePage] ⚠️ Error getting ${mapping.key}:`, error instanceof Error ? error.message : error);
            }
          }

          return accountDetails;
        } catch (error) {
          console.error("[RechargePage] Error capturing Account Overview:", error);
          return accountDetails;
        } finally {
          if (switchedFrame) {
            try {
              await browser.switchToParentFrame();
              console.log('[RechargePage] Switched back to parent frame');
            } catch (switchBackErr) {
              console.warn('[RechargePage] Could not switch back to parent frame:', switchBackErr);
            }
          }
        }
      }

  // ─── Helper: Scrape Other Offers (Dedicated Account Table) ──────────────────
  async scrapeOtherOffersDA(): Promise<any[]> {
    const results: any[] = [];

    try {
      console.log("[RechargePage] Scraping Other Offers (DA) table...");

      // Wait for the Other Offers section to be present
      const container = await $(".bd_otherOffer");
      await container.waitForDisplayed({ timeout: 10000 });

      // Get all data rows (bd_oo_collapse_row)
      const rows = await container.$$(".bd_oo_collapse_row");
      console.log(`[RechargePage] Found ${rows.length} Other Offer rows`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // Find the content row inside the collapse row
          const contentRow = await row.$(".bd_oo_content_row");
          if (!contentRow || !(await contentRow.isExisting())) {
            continue;
          }

          // Get all cells (td elements)
          const cells = await contentRow.$$("td");
          
          if (cells.length < 7) {
            console.log(`[RechargePage] Row ${i} has insufficient cells (${cells.length}), skipping...`);
            continue;
          }

          // Extract data from each cell
          const daName = await cells[0].getText().catch(() => "").then(t => t.trim());
          const daId = await cells[1].getText().catch(() => "").then(t => t.trim());
          const startDate = await cells[2].getText().catch(() => "").then(t => t.trim());
          const expiryDate = await cells[3].getText().catch(() => "").then(t => t.trim());
          const daValue = await cells[4].getText().catch(() => "").then(t => t.trim());
          const unit = await cells[5].getText().catch(() => "").then(t => t.trim());
          const type = await cells[6].getText().catch(() => "").then(t => t.trim());

          const offer: any = {
            daName: daName || "N/A",
            daId: daId || "N/A",
            startDate: startDate || "N/A",
            expiryDate: expiryDate || "N/A",
            daValue: daValue || "N/A",
            unit: unit || "N/A",
            type: type || "N/A",
          };

          results.push(offer);

          console.log(`[RechargePage] ✅ Other Offer DA ${i + 1}:`);
          console.log(`  ├─ DA Name: ${offer.daName}`);
          console.log(`  ├─ DA ID: ${offer.daId}`);
          console.log(`  ├─ Start Date: ${offer.startDate}`);
          console.log(`  ├─ Expiry Date: ${offer.expiryDate}`);
          console.log(`  ├─ DA Value: ${offer.daValue}`);
          console.log(`  ├─ Unit: ${offer.unit}`);
          console.log(`  └─ Type: ${offer.type}`);

        } catch (rowError) {
          console.error(`[RechargePage] Error processing row ${i}:`, rowError);
        }
      }

      console.log(`[RechargePage] Found ${results.length} Other Offers DA total`);
      return results;

    } catch (error) {
      console.error("[RechargePage] Error scraping Other Offers DA:", error);
      return [];
    }
  }

  // ─── Helper: Scrape Other Offers (Offer Tab Table) ──────────────────────────
  async scrapeOtherOffersOfferTab(): Promise<any[]> {
    const results: any[] = [];

    try {
      console.log("[RechargePage] Scraping Other Offers (Offer Tab) table...");

      // Wait for the Other Offers section to be present
      const container = await $(".bd_otherOffer");
      await container.waitForDisplayed({ timeout: 10000 });

      // Get all data rows (bd_oo_content_row)
      const rows = await container.$$(".bd_oo_content_row");
      console.log(`[RechargePage] Found ${rows.length} Other Offer rows`);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        try {
          // Get all cells (td elements) from the row
          const cells = await row.$$("td");
          
          if (cells.length < 6) {
            console.log(`[RechargePage] Row ${i} has insufficient cells (${cells.length}), skipping...`);
            continue;
          }

          // Extract data from each cell
          const offerName = await cells[0].getText().catch(() => "").then(t => t.trim());
          const offerId = await cells[1].getText().catch(() => "").then(t => t.trim());
          const productId = await cells[2].getText().catch(() => "").then(t => t.trim());
          const startDateTime = await cells[3].getText().catch(() => "").then(t => t.trim());
          const endDateTime = await cells[4].getText().catch(() => "").then(t => t.trim());
          const offerType = await cells[5].getText().catch(() => "").then(t => t.trim());

          const offer: any = {
            offerName: offerName || "N/A",
            offerId: offerId || "N/A",
            productId: productId || "N/A",
            startDateTime: startDateTime || "N/A",
            endDateTime: endDateTime || "N/A",
            offerType: offerType || "N/A",
          };

          results.push(offer);

          console.log(`[RechargePage] ✅ Other Offer ${i + 1}:`);
          console.log(`  ├─ Offer Name: ${offer.offerName}`);
          console.log(`  ├─ Offer ID: ${offer.offerId}`);
          console.log(`  ├─ Product ID: ${offer.productId}`);
          console.log(`  ├─ Start Date & Time: ${offer.startDateTime}`);
          console.log(`  ├─ End Date & Time: ${offer.endDateTime}`);
          console.log(`  └─ Offer Type: ${offer.offerType}`);

        } catch (rowError) {
          console.error(`[RechargePage] Error processing row ${i}:`, rowError);
        }
      }

      console.log(`[RechargePage] Found ${results.length} Other Offers total`);
      return results;

    } catch (error) {
      console.error("[RechargePage] Error scraping Other Offers:", error);
      return [];
    }
  }

  // ─── Helper: Click IN Profile Button ─────────────────────────────────────────
  async clickINProfileButton(): Promise<void> {
    try {
      console.log("[RechargePage] Clicking IN Profile button...");
      
      const selectors = [
        "//*[@id='inProfileTab']/div/div[1]/div/div[1]/button",
        "#inProfileTab button",
        ".inProfileButton",
        'button:contains("IN Profile")'
      ];

      for (const selector of selectors) {
        try {
          const element = await $(selector);
          if (await element.isExisting() && await element.isDisplayed()) {
            await element.click();
            console.log(`[RechargePage] ✅ Clicked IN Profile button using: ${selector}`);
            await browser.pause(2000);
            return;
          }
        } catch (_) {}
      }

      // Fallback: Try to find by text
      const button = await $('button*=IN Profile');
      if (await button.isExisting() && await button.isDisplayed()) {
        await button.click();
        console.log("[RechargePage] ✅ Clicked IN Profile button by text");
        await browser.pause(2000);
        return;
      }

      console.warn("[RechargePage] ⚠️ Could not find IN Profile button");
    } catch (error) {
      console.warn("[RechargePage] Could not click IN Profile button:", error);
    }
  }

  

  // ─── IN - Yes Case Testing Process ──────────────────────────────────────────
  async runINTest(msisdn: string, mrp: string): Promise<any> {
    console.log(`[RechargePage] Running IN test for MSISDN: ${msisdn}`);
    const results = {
      success: false,
      steps: [] as any[],
      offerHistory: [] as OfferHistoryItem[],
      dedicatedAccounts: [] as any[],
      offers: [] as any[],
      accountOverview: {} as any,
      otherOffersDA: [] as any[],
      otherOffersOfferTab: [] as any[],
    };

    try {
      // ─── REFRESH PAGE BEFORE STARTING ──────────────────────────────────────
      console.log("[RechargePage] Refreshing page before starting IN test...");
      await browser.refresh();
      await browser.pause(3000);
      await this.closeBlockingPopups();
      console.log("[RechargePage] ✅ Page refreshed successfully");

      // ─── STEP 1: Enter MSISDN ──────────────────────────────────────────────
      await this.enterMSISDN(msisdn);
      await this.takeScreenshot("IN_Step1_Search_MSISDN");

      // ─── STEP 2: Click Search ──────────────────────────────────────────────
      await this.clickSearchButton();
      await this.takeScreenshot("IN_Step2_Click_Search");

      // ─── STEP 3: Capture Subscriber Info ──────────────────────────────────
      const subscriberInfo = await this.captureSubscriberInfo(msisdn, 1);
      await this.takeScreenshot("IN_Step3_Subscriber_Info");
      results.steps.push({ step: "Subscriber Info", data: subscriberInfo });

      // ─── STEP 3.5: Capture Account Overview ──────────────────────────────
      const accountOverview = await this.captureAccountOverview();
      results.accountOverview = accountOverview;
      await this.takeScreenshot("IN_Step3_5_Account_Overview");
      results.steps.push({ step: "Account Overview", data: accountOverview });

      // ─── STEP 4: Verify Recharges & Benefits ──────────────────────────────
      await this.verifyRechargesAndBenefits();
      await this.takeScreenshot("IN_Step4_Recharges_Benefits");

      // ─── STEP 5: Click Customer IN Profile ────────────────────────────────
      await this.clickCustomerINProfile();
      await this.takeScreenshot("IN_Step5_Customer_IN_Profile");

      // ─── STEP 6: Verify Product Overview ──────────────────────────────────
      await this.verifyProductOverview();
      await this.takeScreenshot("IN_Step6_Product_Overview");

      // ─── STEP 7: Click Dedicated Account Tab ──────────────────────────────
      await this.clickDedicatedAccount();
      await this.takeScreenshot("IN_Step7_Dedicated_Account_Tab");
      
      // ─── STEP 7.1: Scrape Other Offers (DA Table) ──────────────────────────
      const otherOffersDA = await this.scrapeOtherOffersDA();
      results.otherOffersDA = otherOffersDA;
      results.dedicatedAccounts = otherOffersDA;
      await this.takeScreenshot("IN_Step7_1_Other_Offers_DA");
      results.steps.push({ step: "Other Offers DA", data: otherOffersDA });

      // ─── STEP 8: Click Offer Tab ──────────────────────────────────────────
      await this.clickOfferTab();
      await this.takeScreenshot("IN_Step8_Offer_Tab");
      
      // ─── STEP 8.1: Scrape Other Offers (Offer Tab Table) ──────────────────
      const otherOffersOfferTab = await this.scrapeOtherOffersOfferTab();
      results.otherOffersOfferTab = otherOffersOfferTab;
      results.offers = otherOffersOfferTab;
      await this.takeScreenshot("IN_Step8_1_Other_Offers_OfferTab");
      results.steps.push({ step: "Other Offers Offer Tab", data: otherOffersOfferTab });

      // ─── STEP 9: Click IN Profile Button ──────────────────────────────────
      await this.clickINProfileButton();
      await this.takeScreenshot("IN_Step9_IN_Profile_Button");

      results.success = true;
      console.log(`[RechargePage] IN test completed for ${msisdn}`);
      
      // Log summary
      console.log("[RechargePage] Account Overview Summary:");
      console.log(`  ├─ Activation Date: ${accountOverview.activationDate}`);
      console.log(`  ├─ Service Removal On: ${accountOverview.serviceRemovalOn}`);
      console.log(`  ├─ Supervision Expires On: ${accountOverview.supervisionExpiresOn}`);
      console.log(`  ├─ Main Balance: ${accountOverview.mainBalance}`);
      console.log(`  ├─ Service Fee Expires On: ${accountOverview.serviceFeeExpiresOn}`);
      console.log(`  ├─ Subscriber Status: ${accountOverview.subscriberStatus}`);
      console.log(`  └─ Credit Clearance On: ${accountOverview.creditClearanceOn}`);
      
      console.log(`[RechargePage] Other Offers DA: ${otherOffersDA.length} entries`);
      console.log(`[RechargePage] Other Offers Offer Tab: ${otherOffersOfferTab.length} entries`);
      
    } catch (error) {
      console.error(`[RechargePage] IN test failed for ${msisdn}:`, error);
      results.success = false;
    }

    return results;
  }

  // ─── Swift - Yes Case Testing Process ──────────────────────────────────────
  // async runSwiftTest(msisdn: string, mrp: string): Promise<any> {
  //   console.log(`[RechargePage] Running SWIFT test for MSISDN: ${msisdn}`);
  //   const results = {
  //     success: false,
  //     steps: [] as any[],
  //     totalUsage: {} as any,
  //     unlimitedOffers: [] as any[],
  //     vasOffers: [] as any[],
  //     digitalPayment: {} as any,
  //     autoPay: {} as any,
  //     upssPromotional: [] as any[],
  //     offerHistory: [] as OfferHistoryItem[],
  //   };

  //   try {
  //     // ─── REFRESH PAGE BEFORE STARTING ──────────────────────────────────────
  //     console.log("[RechargePage] Refreshing page before starting IN test...");
  //     await browser.refresh();
  //     await browser.pause(3000);
  //     await this.closeBlockingPopups();
  //     console.log("[RechargePage] ✅ Page refreshed successfully");
      
  //     await this.enterMSISDNswift(msisdn);
  //     // await this.takeScreenshot("SWIFT_Step1_Search_MSISDN");

  //     await this.clickSearchButtonswift();
  //     await this.takeScreenshot("SWIFT_Step2_Click_Search");

  //     const subscriberInfo = await this.captureSubscriberInfo(msisdn, 1);
  //     results.steps.push({ step: "Subscriber Info", data: subscriberInfo });

  //     await this.verifyRechargesAndBenefits();
  //     await this.takeScreenshot("SWIFT_Step3_Recharges_Benefits");

  //     // Parse all active offers using the new comprehensive method
  //     const activeOffers = await this.parseActiveOffers();
  //     results.totalUsage = activeOffers.totalUsage;
  //     results.unlimitedOffers = activeOffers.unlimited;
  //     results.vasOffers = activeOffers.vas;
  //     results.digitalPayment = activeOffers.digitalPayment;
  //     results.autoPay = activeOffers.autoPay;
  //     results.upssPromotional = activeOffers.upssPromoHist;
      
  //     await this.takeScreenshot("SWIFT_Step4_Active_Offers");

  //     await this.clickOfferHistoryTab();
  //     await this.takeScreenshot("SWIFT_Step5_Offer_History");

  //     const offerHistoryItem = await this.scrapeOfferHistory(mrp);
  //     results.offerHistory = offerHistoryItem;
  //     results.steps.push({ step: "Offer History", data: offerHistoryItem });
  //     await this.takeScreenshot("SWIFT_Step6_Offer_History_Details");

  //     results.success = true;
  //     console.log(`[RechargePage] SWIFT test completed for ${msisdn}`);
  //   } catch (error) {
  //     console.error(`[RechargePage] SWIFT test failed for ${msisdn}:`, error);
  //     results.success = false;
  //   }

  //   return results;
  // }

  // ─── ADD THIS HELPER: reusable Swift search (refresh + enter + click + capture) ──
private async performSwiftSearch(msisdn: string, srNo: number = 1): Promise<SubscriberInfo> {
  console.log("[RechargePage] Refreshing page before Swift search...");
  await browser.refresh();
  await browser.pause(3000);
  await this.closeBlockingPopups();
  console.log("[RechargePage] ✅ Page refreshed successfully");

  await this.enterMSISDNswift(msisdn);
  await this.clickSearchButtonswift();

  return await this.captureSubscriberInfo(msisdn, srNo);
}

// ─── ADD THIS HELPER: poll until Offer History table actually has fresh rows ──
private async waitForOfferHistoryData(maxWaitMs: number = 8000): Promise<boolean> {
  try {
    const container = await $("#demoofferhistry");
    await container.waitForDisplayed({ timeout: 5000 });

    const start = Date.now();
    let rowCount = 0;

    while (Date.now() - start < maxWaitMs) {
      const rows = await container.$$(".row.breakrow");
      rowCount = rows.length;

      if (rowCount > 0) {
        // Guard against a loading/skeleton row that exists but has no real text yet
        const firstRowText = await rows[0].getText().catch(() => "");
        if (firstRowText && firstRowText.trim().length > 0) {
          console.log(
            `[RechargePage] ✅ Offer history data loaded (${rowCount} rows) after ${Date.now() - start}ms`,
          );
          return true;
        }
      }

      await browser.pause(500);
    }

    console.warn(
      `[RechargePage] ⚠️ Offer history data not ready within ${maxWaitMs}ms (rows found: ${rowCount})`,
    );
    return false;
  } catch (error) {
    console.warn("[RechargePage] Error waiting for offer history data:", error);
    return false;
  }
}

// ─── Swift - Yes Case Testing Process (refactored) ─────────────────────────
async runSwiftTest(msisdn: string, mrp: string): Promise<any> {
  console.log(`[RechargePage] Running SWIFT test for MSISDN: ${msisdn}`);
  const results = {
    success: false,
    steps: [] as any[],
    totalUsage: {} as any,
    unlimitedOffers: [] as any[],
    vasOffers: [] as any[],
    digitalPayment: {} as any,
    autoPay: {} as any,
    upssPromotional: [] as any[],
    offerHistory: [] as OfferHistoryItem[],
  };

  try {
    // ─── STEP 1: Search (single call, no duplication) ────────────────────
    const subscriberInfo = await this.performSwiftSearch(msisdn, 1);
    results.steps.push({ step: "Subscriber Info", data: subscriberInfo });
    await this.takeScreenshot("SWIFT_Step2_Click_Search");

    await this.verifyRechargesAndBenefits();
    await this.takeScreenshot("SWIFT_Step3_Recharges_Benefits");

    // ─── STEP 2: Active Offers ─────────────────────────────────────────────
    const activeOffers = await this.parseActiveOffers();
    results.totalUsage = activeOffers.totalUsage;
    results.unlimitedOffers = activeOffers.unlimited;
    results.vasOffers = activeOffers.vas;
    results.digitalPayment = activeOffers.digitalPayment;
    results.autoPay = activeOffers.autoPay;
    results.upssPromotional = activeOffers.upssPromoHist;
    await this.takeScreenshot("SWIFT_Step4_Active_Offers");

    // ─── STEP 3: Offer History (with staleness check + single conditional retry) ──
    await this.clickOfferHistoryTab();
    let dataReady = await this.waitForOfferHistoryData();

    if (!dataReady) {
      console.warn(
        "[RechargePage] Offer history looked stale/empty — retrying search once before scraping...",
      );
      await this.performSwiftSearch(msisdn, 1);
      await this.verifyRechargesAndBenefits();
      await this.clickOfferHistoryTab();
      dataReady = await this.waitForOfferHistoryData();

      if (!dataReady) {
        console.warn(
          "[RechargePage] ⚠️ Offer history still not confirmed ready after retry — scraping anyway, results may be incomplete.",
        );
      }
    }

    await this.takeScreenshot("SWIFT_Step5_Offer_History");

    const offerHistoryItem = await this.scrapeOfferHistory(mrp);
    results.offerHistory = offerHistoryItem;
    results.steps.push({ step: "Offer History", data: offerHistoryItem });
    await this.takeScreenshot("SWIFT_Step6_Offer_History_Details");

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

      await browser.pause(3000);  
        try {
          const circleEl = await $("#FullDemo abbr[title]");
          if (await circleEl.isDisplayed()) { 
            circle = (await circleEl.getAttribute("title")) || "";
          }
        } catch (_) {}

        try {
          const circleEl = await $("#FullDemo abbr[title]"); // Broad fallback selector
          if (await circleEl.isDisplayed()) {
            circle = (await circleEl.getAttribute("title")) || "";
          } else {
            // Precise CSS path (converted from querySelector)
            const circleCss = await $(
              "#FullDemo > div > div > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div > table > tbody > tr > td.demoNameMsisdnPhotoRatingDiv > span.photoDiv.col-4 > span.col-12 > span > abbr"
            );
            if (await circleCss.isDisplayed()) {
              circle = (await circleCss.getAttribute("title")) || "";
            } else {
              // XPath fallback (equivalent path)
              const circleAlt = await $(
                '//*[@id="FullDemo"]/div/div/div[1]/div[1]/div[1]/div/table/tbody/tr/td[contains(@class,"demoNameMsisdnPhotoRatingDiv")]/span[contains(@class,"photoDiv")]/span[contains(@class,"col-12")]/span/abbr'
              );
              if (await circleAlt.isDisplayed()) {
                circle = (await circleAlt.getAttribute("title")) || "";
              } else {
                // Class-based fallback (most resilient — matches by class combo regardless of position)
                const circleByClass = await $(
                  "td.demoNameMsisdnPhotoRatingDiv span.photoDiv.col-4 span.col-12 span abbr"
                );
                if (await circleByClass.isDisplayed()) {
                  circle = (await circleByClass.getAttribute("title")) || "";
                }
              }
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
        const userTypeEl = await $("#typeOfUser"); 
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

// ─── Parse All Active Offers ────────────────────────────────────────────────
async parseActiveOffers(): Promise<any> {
  console.log("[RechargePage] Parsing all active offers...");
  
  const allOffers = {
    totalUsage: {
      voice: [] as any[],
      data: [] as any[],
      sms: [] as any[]
    },
    unlimited: [] as any[],
    vas: [] as any[],
    digitalPayment: {} as any,
    autoPay: {} as any,
    upssPromoHist: [] as any[]
  };

  try {
    // Wait for active offers container
    await $('.activeOffers').waitForDisplayed({ timeout: 10000 });

    // ==================== 1. TOTAL USAGE TAB ====================
    await this.clickAndWait('#ao_consolidated_tab', 1000);
    
    // Parse Voice tab
    allOffers.totalUsage.voice = await this.parseVoiceTab();
    
    // Parse Data tab
    await this.clickAndWait('#totalUsageTabs li:nth-child(2) a', 500);
    allOffers.totalUsage.data = await this.parseDataTab();
    
    // Parse SMS tab
    await this.clickAndWait('#totalUsageTabs li:nth-child(3) a', 500);
    allOffers.totalUsage.sms = await this.parseSMSTab();
    
    // ==================== 2. UNLIMITED TAB ====================
    await this.clickAndWait('#ao_unlimited_tab', 1000);
    allOffers.unlimited = await this.parseUnlimitedTab();
    
    // ==================== 3. VAS TAB ====================
    await this.clickAndWait('#ao_vas_tab', 1000);
    allOffers.vas = await this.parseVASTab();
    
    // ==================== 4. DIGITAL PAYMENT TAB ====================
    await this.clickAndWait('#ao_digitalpayment_tab', 1000);
    allOffers.digitalPayment = await this.parseDigitalPaymentTab();
    
    // ==================== 5. AUTO PAY TAB ====================
    await this.clickAndWait('#ao_autopay_tab', 1000);
    allOffers.autoPay = await this.parseAutoPayTab();
    
    // ==================== 6. UPSS PROMO HISTORY TAB ====================
    await this.clickAndWait('#ao_upssPromoHist_tab', 1000);
    allOffers.upssPromoHist = await this.parseUpssPromoHistTab();
    
    console.log("[RechargePage] Successfully parsed all active offers");
  } catch (error) {
    console.error("[RechargePage] Error parsing active offers:", error);
  }

  return allOffers;
}

// ─── Helper: Click and wait ────────────────────────────────────────────────────
private async clickAndWait(selector: string, waitMs: number = 1000): Promise<void> {
  try {
    const element = await $(selector);
    if (await element.isExisting() && await element.isDisplayed()) {
      await element.click();
      await browser.pause(waitMs);
    } else {
      console.log(`[RechargePage] Element not found or not displayed: ${selector}`);
    }
  } catch (error) {
    console.log(`[RechargePage] Error clicking ${selector}:`, error);
  }
}

// ==================== HELPER FUNCTIONS FOR ACTIVE OFFERS ====================

async parseVoiceTab(): Promise<any[]> {
  const voiceOffers: any[] = [];
  try {
    const rows = await $$('#voicePlan table tbody tr.pie0');
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 4) {
        voiceOffers.push({
          offer_name: await cells[0].getText(),
          balance_left: await cells[1].getText(),
          category: await cells[2].getText(),
          expiry_date: await cells[3].getText()
        });
      }
    }
    console.log(`[RechargePage] Found ${voiceOffers.length} voice offers`);
  } catch (error) {
    console.warn("[RechargePage] Could not parse voice tab:", error);
  }
  return voiceOffers;
}

async parseDataTab(): Promise<any[]> {
  const dataOffers: any[] = [];
  try {
    // Parse Daily Data Packs
    const dailyRows = await $$('#dailyDataPlan table tbody tr.pie0');
    for (const row of dailyRows) {
      const cells = await row.$$('td');
      if (cells.length >= 5) {
        dataOffers.push({
          offer_name: await cells[0].getText(),
          total_quota: await cells[1].getText(),
          balance_left: await cells[2].getText(),
          category: await cells[3].getText(),
          expiry_date: await cells[4].getText()
        });
      }
    }
    
    // Also check for other data plan tables
    const otherRows = await $$('#dataPlan table tbody tr.pie0');
    for (const row of otherRows) {
      const cells = await row.$$('td');
      if (cells.length >= 4) {
        dataOffers.push({
          offer_name: await cells[0].getText(),
          total_quota: 'N/A',
          balance_left: await cells[1].getText(),
          category: await cells[2].getText(),
          expiry_date: await cells[3].getText()
        });
      }
    }
    
    console.log(`[RechargePage] Found ${dataOffers.length} data offers`);
  } catch (error) {
    console.warn("[RechargePage] Could not parse data tab:", error);
  }
  return dataOffers;
}

async parseSMSTab(): Promise<any[]> {
  const smsOffers: any[] = [];
  try {
    const rows = await $$('#SMSPlan table tbody tr.pie0');
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 4) {
        smsOffers.push({
          offer_name: await cells[0].getText(),
          balance_left: await cells[1].getText(),
          category: await cells[2].getText(),
          expiry_date: await cells[3].getText()
        });
      }
    }
    console.log(`[RechargePage] Found ${smsOffers.length} SMS offers`);
  } catch (error) {
    console.warn("[RechargePage] Could not parse SMS tab:", error);
  }
  return smsOffers;
}

async parseUnlimitedTab(): Promise<any[]> {
  const unlimitedOffers: any[] = [];
  try {
    const rows = await $$('#unliBenefits table tbody tr:not(.bdDetailTableHeader)');
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 6) {
        unlimitedOffers.push({
          mrp: await cells[1].getText(),
          activation_date: await cells[2].getText(),
          validity: await cells[4].getText(),
          benefits: await cells[5].getText()
        });
      }
    }
    console.log(`[RechargePage] Found ${unlimitedOffers.length} unlimited offers`);
  } catch (error) {
    console.warn("[RechargePage] Could not parse unlimited tab:", error);
  }
  return unlimitedOffers;
}

async parseVASTab(): Promise<any[]> {
  const vasOffers: any[] = [];
  try {
    // Try #aoVas table first
    const rows = await $$('#aoVas table.AO-activeOffertable tbody tr');
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 7) {
        const mrp = await cells[1].getText();
        if (mrp && !mrp.includes('MRP')) {
          vasOffers.push({
            mrp: mrp.trim(),
            name: await cells[2].getText(),
            type: await cells[3].getText(),
            activation_date: await cells[4].getText(),
            next_charging_date: await cells[5].getText()
          });
        }
      }
    }
    
    // Also try #aoVasRpa table
    const rpaRows = await $$('#aoVasRpa table tbody tr');
    for (const row of rpaRows) {
      const cells = await row.$$('td');
      if (cells.length >= 5) {
        vasOffers.push({
          mrp: await cells[0].getText(),
          name: await cells[1].getText(),
          type: await cells[2].getText(),
          activation_date: await cells[3].getText(),
          next_charging_date: await cells[4].getText()
        });
      }
    }
    
    console.log(`[RechargePage] Found ${vasOffers.length} VAS offers`);
  } catch (error) {
    console.warn("[RechargePage] Could not parse VAS tab:", error);
  }
  return vasOffers;
}

async parseDigitalPaymentTab(): Promise<any> {
  const dpData: any = {};
  try {
    // Parse search fields and any visible data
    const dateInput = await $('#dpDate');
    if (await dateInput.isExisting()) {
      dpData.search_date = await dateInput.getAttribute('value') || '';
    }
    
    const guideLink = await $('#dpGuide');
    if (await guideLink.isExisting()) {
      dpData.guide_link = await guideLink.getText() || '';
    }
    
    const complainButton = await $('.dpComplainButton .dpComplainVal');
    if (await complainButton.isExisting()) {
      dpData.complain_button = await complainButton.getText() || '';
    }
    
    // Check for error messages
    const errorMsg = await $('.dpErrorCenter');
    if (await errorMsg.isExisting()) {
      const errorText = await errorMsg.getText();
      if (errorText && errorText.trim()) {
        dpData.error = errorText.trim();
      }
    }
    
    console.log("[RechargePage] Parsed digital payment tab");
  } catch (error) {
    console.warn("[RechargePage] Could not parse digital payment tab:", error);
  }
  return dpData;
}

async parseAutoPayTab(): Promise<any> {
  const autoPayData: any = {};
  try {
    const rows = await $$('.aoAutoPayDtls tbody tr');
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 2) {
        let key = await cells[0].getText();
        const value = await cells[1].getText();
        if (key && value) {
          // Clean key name
          key = key.trim().toLowerCase().replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, '').replace(/ /g, '_');
          autoPayData[key] = value.trim();
        }
      }
    }
    console.log("[RechargePage] Parsed auto pay tab");
  } catch (error) {
    console.warn("[RechargePage] Could not parse auto pay tab:", error);
  }
  return autoPayData;
}

async parseUpssPromoHistTab(): Promise<any[]> {
  const historyItems: any[] = [];
  try {
    // Parse table rows
    const rows = await $$('#aoUpssPromoHist table tbody tr:not(.bdDetailTableHeader)');
    for (const row of rows) {
      const cells = await row.$$('td');
      if (cells.length >= 7) {
        const appliedDate = await cells[1].getText();
        if (appliedDate && appliedDate.trim()) {
          historyItems.push({
            applied_date: appliedDate.trim(),
            start_date: await cells[2].getText(),
            promotion_name: await cells[3].getText(),
            description: await cells[4].getText(),
            mode_of_activation: await cells[5].getText(),
            promotion_status: await cells[6].getText()
          });
        }
      }
    }
    
    console.log(`[RechargePage] Found ${historyItems.length} UPSS promotional entries`);
    return historyItems;
  } catch (error) {
    console.warn("[RechargePage] Could not parse UPSS promo history:", error);
    return [];
  }
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

  //offer history process

    // ─── Helper: Parse SWIFT date format "01 Jul '26 05.22 PM" into a JS Date ──
    private parseSwiftActivationDate(activationDateTime: string): Date | null {
      if (!activationDateTime) return null;

      const cleaned = activationDateTime.trim();

      // Format: "01 Jul '26 05.22 PM"
      const match = cleaned.match(
        /^(\d{1,2})\s+([A-Za-z]{3})\s+'?(\d{2,4})\s+(\d{1,2})\.(\d{2})\s?(AM|PM)$/i
      );

      if (!match) {
        return null;
      }

      const [, dayStr, monthStr, yearStr, hourStr, minStr, meridiem] = match;

      const monthMap: Record<string, number> = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
      };

      const monthIdx = monthMap[monthStr.toLowerCase()];
      if (monthIdx === undefined) return null;

      const day = parseInt(dayStr, 10);
      let year = parseInt(yearStr, 10);
      if (year < 100) year += 2000; // '26 -> 2026

      let hour = parseInt(hourStr, 10);
      const minute = parseInt(minStr, 10);

      if (meridiem.toUpperCase() === "PM" && hour !== 12) hour += 12;
      if (meridiem.toUpperCase() === "AM" && hour === 12) hour = 0;

      const parsed = new Date(year, monthIdx, day, hour, minute);
      return isNaN(parsed.getTime()) ? null : parsed;
    }

// ─── Helper: Check if activationDateTime is today's date (date-only compare) ──
    private isDateToday(activationDateTime: string): { isToday: boolean; parsed: boolean } {
      const parsedDate = this.parseSwiftActivationDate(activationDateTime);

      if (!parsedDate) {
        return { isToday: false, parsed: false };
      }

      const today = new Date();

      const isSameDay =
        parsedDate.getFullYear() === today.getFullYear() &&
        parsedDate.getMonth() === today.getMonth() &&
        parsedDate.getDate() === today.getDate();

      return { isToday: isSameDay, parsed: true };
    }

    async scrapeOfferHistory(targetMRP: string): Promise<OfferHistoryItem[]> {
      const results: OfferHistoryItem[] = [];

      // Store extracted values globally for fallback scenarios
      let extractedName = "";
      let extractedCategory = "";
      let extractedBenefits = "";
      let extractedDetailValidity = "";
      let extractedValidity = "";

      try {
        console.log("[RechargePage] Scraping offer history with exact structure...");

        const container = await $("#demoofferhistry");
        await container.waitForDisplayed({ timeout: 10000 });

        const isActive = await container
          .getAttribute("class")
          .then((cls) => cls?.includes("active") || false);
        console.log(`[RechargePage] Container active: ${isActive}`);

        // Get all rows - both breakrow and datarow
        const allRows = await container.$$(".row");
        const breakRows: any[] = [];

        // Find breakrow elements (these are the main rows with transaction data)
        for (const row of allRows) {
          const className = await row.getAttribute("class").catch(() => "");
          if (className && className.includes("breakrow")) {
            breakRows.push(row);
          }
        }

        console.log(`[RechargePage] Found ${breakRows.length} offer history rows`);
        console.log(`[RechargePage] Today's date for validation: ${new Date().toDateString()}`);

        // Track which .datarow elements have already been consumed so that
        // multiple breakrows never accidentally bind to the same detail row.
        const claimedDataRowIndices = new Set<number>();

        for (let i = 0; i < breakRows.length; i++) {
          const breakRow = breakRows[i];
          const rowText = await breakRow.getText().catch(() => "");
          console.log(`[RechargePage] Row ${i} text: ${rowText}`);

          const offer: OfferHistoryItem = {
            transactionId: "",
            activationDateTime: "",
            validity: "",
            mrp: "",
            activationMode: "",
            currentCoreBalance: "",
            etopupTransactionId: "",
            retailerMsisdn: "",
            name: "",
            category: "",
            benefits: "",
            detailValidity: "",
            isMatched: false,
            isTodayActivation: false,
            matchStatus: "Unmatched",
            matchReason: "",
          };

          try {
            // ---- MAIN ROW DATA (Columns) ----
            let cells = await breakRow.$$(".offerHistData1, .offerHistData, td");

            if (cells.length === 0) {
              cells = await breakRow.$$("div:not(.h1):not(.breakbutton):not(.bd_cb_col)");
            }

            console.log(`[RechargePage] Found ${cells.length} cells in row ${i}`);

            const cellTexts: string[] = [];
            for (const cell of cells) {
              const text = await cell.getText().catch(() => "");
              if (text && text.trim() && !text.includes("Core Balance :") &&
                  !text.includes("Additions") && !text.includes("Complain") &&
                  !text.includes("Previous Page") && !text.includes("Next") &&
                  !text.includes("Deductions") && !text.includes("View Historical Data") &&
                  !text.includes("Online Recharge Invoice") && !text.includes("MVIVA") &&
                  !text.includes("checkbox")) {
                // Get abbr title if present
                try {
                  const abbr = await cell.$("abbr");
                  if (await abbr.isExisting()) {
                    const title = await abbr.getAttribute("title");
                    if (title) {
                      cellTexts.push(title.trim());
                      continue;
                    }
                  }
                } catch (_) {}
                cellTexts.push(text.trim());
              }
            }

            console.log(`[RechargePage] Filtered cell texts: ${cellTexts}`);

            if (cellTexts.length >= 8) {
              offer.transactionId = cellTexts[0] || "";
              offer.activationDateTime = cellTexts[1] || "";
              offer.validity = cellTexts[2] || "";
              extractedValidity = offer.validity;
              offer.mrp = cellTexts[3] || "";
              offer.activationMode = cellTexts[4] || "";
              offer.currentCoreBalance = cellTexts[5] || "";
              offer.etopupTransactionId = cellTexts[6] || "";
              offer.retailerMsisdn = cellTexts[7] || "";

              console.log(
                `[RechargePage] Extracted: TXN=${offer.transactionId}, Activation=${offer.activationDateTime}, MRP=${offer.mrp}, Validity=${offer.validity}, Mode=${offer.activationMode}`
              );
            } else {
              // Fallback: try to parse from row text
              const parts = rowText.split("\n").filter((s) => s.trim() &&
                !s.includes("Core Balance :") && !s.includes("Additions") &&
                !s.includes("Complain") && !s.includes("Previous Page") &&
                !s.includes("Next") && !s.includes("Deductions") &&
                !s.includes("View Historical Data") && !s.includes("Online Recharge Invoice") &&
                !s.includes("MVIVA") && !s.includes("checkbox"));

              console.log(`[RechargePage] Parsed from text: ${parts}`);

              if (parts.length >= 8) {
                offer.transactionId = parts[0]?.trim() || "";
                offer.activationDateTime = parts[1]?.trim() || "";
                offer.validity = parts[2]?.trim() || "";
                extractedValidity = offer.validity;
                offer.mrp = parts[3]?.trim() || "";
                offer.activationMode = parts[4]?.trim() || "";
                offer.currentCoreBalance = parts[5]?.trim() || "";
                offer.etopupTransactionId = parts[6]?.trim() || "";
                offer.retailerMsisdn = parts[7]?.trim() || "";
              }
            }

            // ---- EXPAND DETAILS FOR THIS SPECIFIC ROW ----
            const expandBtn = await breakRow.$('.breakbutton a, .breakbutton span, [class*="breakbutton"] svg, .breakbutton');
            if (expandBtn && await expandBtn.isExisting()) {
              console.log(`[RechargePage] Expanding detail row ${i}...`);
              await expandBtn.click();
              await browser.pause(1500);
              await browser.pause(500);
            }

            // ---- FIND THE ASSOCIATED DETAIL ROW (INDEX-BASED, FIXED) ----
            let detailRow = null;

            try {
              const allDataRows = await container.$$(".datarow");
              if (i < allDataRows.length && !claimedDataRowIndices.has(i)) {
                const possibleDetailRow = allDataRows[i];
                const detailText = await possibleDetailRow.getText().catch(() => "");
                if (detailText && (detailText.includes("Name") || detailText.includes("Category") || detailText.includes("Benefits"))) {
                  detailRow = possibleDetailRow;
                  claimedDataRowIndices.add(i);
                }
              }
            } catch (_) {
              console.log(`[RechargePage] Could not find datarow by index for row ${i}`);
            }

            // Fallback: pick the first unclaimed .datarow that has detail content
            if (!detailRow) {
              try {
                const allDataRows = await container.$$(".datarow");
                for (let k = 0; k < allDataRows.length; k++) {
                  if (claimedDataRowIndices.has(k)) continue;
                  const candidate = allDataRows[k];
                  const detailText = await candidate.getText().catch(() => "");
                  if (detailText && (detailText.includes("Name") || detailText.includes("Category") || detailText.includes("Benefits"))) {
                    detailRow = candidate;
                    claimedDataRowIndices.add(k);
                    break;
                  }
                }
              } catch (_) {}
            }

            // If we found a detail row, extract data from it
            if (detailRow && await detailRow.isExisting()) {
              console.log(`[RechargePage] Found associated detail row for row ${i}`);

              const detailLabels = await detailRow.$$("label.l1, label, .label");
              const detailValues = await detailRow.$$("span.s1, span, .value");

              console.log(
                `[RechargePage] Found ${detailLabels.length} detail labels, ${detailValues.length} detail values for row ${i}`
              );

              for (let j = 0; j < Math.min(detailLabels.length, detailValues.length); j++) {
                const label = (await detailLabels[j].getText().catch(() => "")) || "";
                let value = (await detailValues[j].getText().catch(() => "")) || "";

                try {
                  const abbrElem = await detailValues[j].$("abbr");
                  if (abbrElem && await abbrElem.isExisting()) {
                    const title = await abbrElem.getAttribute("title");
                    if (title) {
                      value = title;
                    }
                  }
                } catch (_) {}

                const cleanLabel = label.replace(/[:*]/g, "").trim();

                if (cleanLabel === "Name" || cleanLabel === "Plan Name" || cleanLabel === "Offer Name") {
                  offer.name = value;
                  extractedName = value;
                  console.log(`[RechargePage] ✅ Name: ${value}`);
                } else if (cleanLabel === "Category" || cleanLabel === "Plan Category") {
                  offer.category = value;
                  extractedCategory = value;
                  console.log(`[RechargePage] ✅ Category: ${value}`);
                } else if (cleanLabel === "Benefits" || cleanLabel === "Plan Benefits") {
                  offer.benefits = value;
                  extractedBenefits = value;
                  console.log(`[RechargePage] ✅ Benefits: ${value.substring(0, 50)}...`);
                } else if (cleanLabel === "Validity" || cleanLabel === "Plan Validity") {
                  offer.detailValidity = value;
                  extractedDetailValidity = value;
                  if (
                    !offer.validity ||
                    offer.validity === "View" ||
                    offer.validity === "view" ||
                    offer.validity.includes("Validity") ||
                    offer.validity === "" ||
                    offer.validity === " "
                  ) {
                    offer.validity = value;
                    extractedValidity = value;
                  }
                  console.log(`[RechargePage] ✅ Detail Validity: ${value}`);
                }
              }

              // ---- FALLBACK: Parse detail text if labels didn't match ----
              if (!offer.name || !offer.category || !offer.benefits || !offer.detailValidity) {
                const detailText = await detailRow.getText().catch(() => "");
                console.log(`[RechargePage] Detail text: ${detailText}`);

                const nameMatch = detailText.match(/Name[:*]\s*([^\n]+)/i);
                if (nameMatch) {
                  offer.name = nameMatch[1].trim();
                  extractedName = offer.name;
                  console.log(`[RechargePage] Name (regex): ${offer.name}`);
                }

                const categoryMatch = detailText.match(/Category[:*]\s*([^\n]+)/i);
                if (categoryMatch) {
                  offer.category = categoryMatch[1].trim();
                  extractedCategory = offer.category;
                  console.log(`[RechargePage] Category (regex): ${offer.category}`);
                }

                const benefitsMatch = detailText.match(/Benefits[:*]\s*([^\n]+)/i);
                if (benefitsMatch) {
                  offer.benefits = benefitsMatch[1].trim();
                  extractedBenefits = offer.benefits;
                  console.log(`[RechargePage] Benefits (regex): ${offer.benefits.substring(0, 50)}...`);
                }

                const validityMatch = detailText.match(/Validity[:*]\s*([^\n]+)/i);
                if (validityMatch) {
                  offer.detailValidity = validityMatch[1].trim();
                  extractedDetailValidity = offer.detailValidity;
                  if (!offer.validity || offer.validity === "View" || offer.validity === "view") {
                    offer.validity = offer.detailValidity;
                    extractedValidity = offer.validity;
                  }
                  console.log(`[RechargePage] Detail Validity (regex): ${offer.detailValidity}`);
                }
              }
            } else {
              console.log(`[RechargePage] No detail row found for row ${i}`);
            }

            // Fill in fallback extracted values if this row's own data is still empty
            if (!offer.name && extractedName) offer.name = extractedName;
            if (!offer.category && extractedCategory) offer.category = extractedCategory;
            if (!offer.benefits && extractedBenefits) offer.benefits = extractedBenefits;
            if (!offer.detailValidity && extractedDetailValidity) offer.detailValidity = extractedDetailValidity;

            // ---- CHECK MRP / CORE BALANCE MATCH ----
            const mrpMatch = offer.mrp === targetMRP;
            const coreMatch = !!offer.currentCoreBalance && parseFloat(offer.currentCoreBalance) === parseFloat(targetMRP);
            offer.isMatched = mrpMatch || coreMatch;

            // ---- CHECK ACTIVATION DATE = TODAY ----
            const dateCheck = this.isDateToday(offer.activationDateTime);
            offer.isTodayActivation = dateCheck.isToday;

            // ---- DETERMINE FINAL MATCH STATUS ----
            if (!offer.isMatched) {
              offer.matchStatus = "Unmatched";
              offer.matchReason = `MRP/Core Balance did not match target (${targetMRP})`;
            } else if (!dateCheck.parsed) {
              offer.matchStatus = "Fail-UnparsableDate";
              offer.matchReason = `Could not parse activation date: "${offer.activationDateTime}"`;
            } else if (!dateCheck.isToday) {
              offer.matchStatus = "Fail-DateMismatch";
              offer.matchReason = `Activation date "${offer.activationDateTime}" is not today (${new Date().toDateString()})`;
            } else {
              offer.matchStatus = "Pass";
              offer.matchReason = "MRP/Core Balance matched AND activation date is today";
            }

            // ---- LOGGING ----
            console.log(`[RechargePage] Checking offer row ${i}:`);
            console.log(`  └─ Activation Date & Time: "${offer.activationDateTime}"`);
            console.log(`  └─ Target MRP: "${targetMRP}"`);
            console.log(`  └─ Offer MRP: "${offer.mrp}"`);
            console.log(`  └─ Validity: "${offer.validity}"`);
            console.log(`  └─ Current Core Balance: "${offer.currentCoreBalance}"`);
            console.log(`  └─ Name: "${offer.name}"`);
            console.log(`  └─ Category: "${offer.category}"`);
            console.log(`  └─ Benefits: "${offer.benefits?.substring(0, 50)}..."`);
            console.log(`  └─ Detail Validity: "${offer.detailValidity}"`);
            console.log(`  └─ MRP/Core Match: ${offer.isMatched ? '✅ YES' : '❌ NO'}`);
            console.log(`  └─ Activation = Today: ${offer.isTodayActivation ? '✅ YES' : '❌ NO'}`);
            console.log(`  └─ Final Status: ${offer.matchStatus} — ${offer.matchReason}`);

            // ---- ALWAYS PUSH THE ROW (MATCHED OR UNMATCHED) ----
            results.push(offer);

            if (offer.matchStatus === "Pass") {
              console.log(`[RechargePage] PASS offer history item: ${offer.transactionId}`);
            } else {
              console.log(`[RechargePage] ${offer.matchStatus.toUpperCase()} offer history item: ${offer.transactionId || 'No TXN'} — ${offer.matchReason}`);
            }
            console.log(`[RechargePage]   ├─ Activation Date & Time: ${offer.activationDateTime}`);
            console.log(`[RechargePage]   ├─ Name: ${offer.name}`);
            console.log(`[RechargePage]   ├─ Category: ${offer.category}`);
            console.log(`[RechargePage]   ├─ Benefits: ${offer.benefits?.substring(0, 50)}...`);
            console.log(`[RechargePage]   ├─ Validity: ${offer.validity}`);
            console.log(`[RechargePage]   └─ Detail Validity: ${offer.detailValidity}`);

          } catch (rowError) {
            console.error(`[RechargePage] Error processing row ${i}:`, rowError);
          }
        }

        const passCount = results.filter(r => r.matchStatus === "Pass").length;
        const dateMismatchCount = results.filter(r => r.matchStatus === "Fail-DateMismatch").length;
        const unparsableCount = results.filter(r => r.matchStatus === "Fail-UnparsableDate").length;
        const unmatchedCount = results.filter(r => r.matchStatus === "Unmatched").length;

        console.log(
          `[RechargePage] Offer history summary → Total: ${results.length}, Pass: ${passCount}, ` +
          `Fail-DateMismatch: ${dateMismatchCount}, Fail-UnparsableDate: ${unparsableCount}, Unmatched: ${unmatchedCount}`
        );

        return results;

      } catch (error) {
        console.error("[RechargePage] Error scraping offer history:", error);
        return results;
      }
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
