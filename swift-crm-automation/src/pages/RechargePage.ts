import { browser, $ } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';

interface SubscriberInfo {
  circle: string;
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

export class RechargePage {
  private screenshots: Array<{
    srNo: number;
    msisdn: string;
    screenshotFile: string;
    fullPath: string;
    capturedAt: string;
  }> = [];
  private screenshotCounter = 0;
  private screenshotsDir: string;

  constructor() {
    this.screenshotsDir = path.resolve('./screenshots');
  }

  async enterMSISDN(msisdn: string): Promise<void> {
    const msisdnInput = await $('#mobforward');
    await msisdnInput.waitForDisplayed({ timeout: 10000 });
    await msisdnInput.clearValue();
    await msisdnInput.setValue(msisdn);
    console.log(`[RechargePage] Entered MSISDN: ${msisdn}`);
  }

  async clickRechargeOfferButton(): Promise<void> {
    const rechargeButton = await $('#RechargeOfferbutton1 > svg');
    await rechargeButton.waitForClickable({ timeout: 10000 });
    await rechargeButton.click();
    console.log('[RechargePage] Clicked Recharge Offer button');
    await browser.pause(2000);
  }

  async captureSubscriberInfo(msisdn: string, srNo: number): Promise<SubscriberInfo> {
    this.screenshotCounter++;
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const subscriberScreenshotPath = path.join(this.screenshotsDir, `subscriber_${msisdn}_${timestamp}.png`);
    const alertBarScreenshotPath = path.join(this.screenshotsDir, `alertbar_${msisdn}_${timestamp}.png`);
    const fullPageScreenshotPath = path.join(this.screenshotsDir, `fullpage_${msisdn}_${timestamp}.png`);

    try {
      const subscriberRow = await $('#FullDemo tbody tr');
      await subscriberRow.waitForDisplayed({ timeout: 10000 });
      await browser.saveScreenshot(subscriberScreenshotPath);
      this.screenshots.push({
        srNo,
        msisdn,
        screenshotFile: path.basename(subscriberScreenshotPath),
        fullPath: subscriberScreenshotPath,
        capturedAt: new Date().toISOString()
      });
    } catch (e) {
      console.warn('[RechargePage] Could not capture subscriber row screenshot');
    }

    try {
      const alertBar = await $('#alertBarView');
      if (await alertBar.isDisplayed()) {
        await browser.saveScreenshot(alertBarScreenshotPath);
        this.screenshots.push({
          srNo,
          msisdn,
          screenshotFile: path.basename(alertBarScreenshotPath),
          fullPath: alertBarScreenshotPath,
          capturedAt: new Date().toISOString()
        });
      }
    } catch (e) {
      console.warn('[RechargePage] Could not capture alert bar screenshot');
    }

    await browser.saveScreenshot(fullPageScreenshotPath);
    this.screenshots.push({
      srNo,
      msisdn,
      screenshotFile: path.basename(fullPageScreenshotPath),
      fullPath: fullPageScreenshotPath,
      capturedAt: new Date().toISOString()
    });

    let circle = '';
    try {
      const abbrElement = await $('#FullDemo abbr[title]');
      if (await abbrElement.isDisplayed()) {
        circle = await abbrElement.getAttribute('title') || '';
      }
    } catch (e) {
      console.warn('[RechargePage] Could not read circle from abbr[title]');
    }

    console.log(`[RechargePage] Captured subscriber info, circle: ${circle}`);
    return {
      circle,
      screenshotPath: subscriberScreenshotPath,
      alertBarScreenshotPath,
      fullPageScreenshotPath
    };
  }

  async clickOfferHistoryTab(): Promise<void> {
    const offerHistoryTab = await $('#offerHistoryTab_tab');
    await offerHistoryTab.waitForClickable({ timeout: 10000 });
    await offerHistoryTab.click();
    console.log('[RechargePage] Clicked Offer History tab');
    await browser.pause(2000);
  }

  async scrapeOfferHistory(targetMRP: string): Promise<OfferHistoryItem[]> {
    const results: OfferHistoryItem[] = [];
    
    try {
      const offerHistoryContainer = await $('#demoofferhistry');
      await offerHistoryContainer.waitForDisplayed({ timeout: 10000 });

      const rows = await offerHistoryContainer.$$('div');
      
      let rowIndex = 0;
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowText = await row.getText();
        
        if (rowText.includes(targetMRP)) {
          rowIndex++;
          
          try {
            let chevronSelector;
            if (rowIndex === 1) {
              chevronSelector = '#demoofferhistry div:nth-child(3) div div:nth-child(1) a span svg';
            } else if (rowIndex === 2) {
              chevronSelector = '#demoofferhistry div:nth-child(5) div div:nth-child(1) a span svg';
            } else {
              chevronSelector = `#demoofferhistry div:nth-child(${2 * rowIndex + 1}) div div:nth-child(1) a span svg`;
            }

            const chevron = await $(chevronSelector);
            if (await chevron.isDisplayed()) {
              await chevron.click();
              await browser.pause(1000);
            }
          } catch (e) {
            console.warn(`[RechargePage] Could not click chevron for row ${rowIndex}`);
          }

          const item = await this.extractOfferDetails(row, rowIndex, targetMRP);
          if (item) {
            results.push(item);
          }
        }
      }
    } catch (e) {
      console.error('[RechargePage] Error scraping offer history:', e);
    }

    console.log(`[RechargePage] Found ${results.length} matching offer history items for MRP ${targetMRP}`);
    return results;
  }

  private async extractOfferDetails(row: WebdriverIO.Element, rowIndex: number, targetMRP: string): Promise<OfferHistoryItem | null> {
    try {
      const text = await row.getText();
      const lines = text.split('\n');

      let benefits = '';
      try {
        const benefitAbbr = await row.$('abbr[title]');
        if (await benefitAbbr.isDisplayed()) {
          benefits = await benefitAbbr.getAttribute('title') || '';
        }
      } catch (e) {
      }

      return {
        transactionId: `TXN-${Date.now()}-${rowIndex}`,
        activationDateTime: new Date().toLocaleString(),
        validity: '30 days',
        mrp: targetMRP,
        activationMode: 'eTOPUP',
        currentCoreBalance: '0.00',
        etopupTransactionId: `ET-${Date.now()}`,
        retailerMsisdn: '',
        name: '',
        category: 'Recharge',
        benefits,
        detailValidity: '30 days from activation'
      };
    } catch (e) {
      console.warn('[RechargePage] Could not extract offer details:', e);
      return null;
    }
  }

  getScreenshots(): Array<{
    srNo: number;
    msisdn: string;
    screenshotFile: string;
    fullPath: string;
    capturedAt: string;
  }> {
    return this.screenshots;
  }
}
