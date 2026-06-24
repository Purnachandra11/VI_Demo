/**
 * SiebelSubscriptionsPage.ts
 * Page Object — Steps 4, 5.1, 5.2
 */

import { browser, $, $$ } from '@wdio/globals';
import { expect } from 'chai';

// ─── Selectors ─────────────────────────────────────────────────────────────────

const SEL = {
  msisdnInput   : '//*[@id="a_7"]/div/table/tbody/tr[3]/td[4]/div/input',
  goButton      : '//*[@id="s_7_1_1_0_Ctrl" or @id="s_1_1_1_0_Ctrl"]',
  breadcrumb    : '//span[@class="siebui-crumb"]',
  assetFieldAria: 'input[aria-label="Asset"]',
  assetFieldAlt : 'input[aria-labelledby="AssetNumTitle_Label"]',
  assetFieldFull: '//*[@id="a_3"]/table/tbody/tr/td/span/div/table[1]/tbody/tr/td[1]/input',
  // ✅ FIXED: Use s_1_l instead of s_7_l
  gridBody      : '#s_1_l tbody tr:not(.jqgfirstrow)',  // Excludes header row
  gridTable     : '#s_1_l',  // Correct grid ID
  noDataMessage : '//div[contains(text(), "No records to display")]',
  loadingOverlay: '//div[contains(@class, "loading") or contains(@class, "wait")]',
} as const;

export class SiebelSubscriptionsPage {

  async enterMSISDN(msisdn: string): Promise<void> {
    console.log(`\n📱 Entering MSISDN: ${msisdn}`);
    
    // Give Siebel time to fully render after login 
    await browser.pause(3000); 
    
    // Try to click Subscriptions tab first if visible 
    try { 
      const subsTab = await $('//*[contains(text(),"Subscriptions") and contains(@class,"ui-tabs-anchor")]'); 
      if (await subsTab.isDisplayed()) { 
        await subsTab.click(); 
        await browser.pause(2000); 
      } 
    } catch { /* already on subscriptions or tab not found */ } 

    // Try multiple selectors in order 
    const selectors = [ 
      '//*[contains(@aria-label,"MSISDN")]', 
      '//*[contains(@aria-label,"Mobile Number")]',
      '//*[contains(@name,"MSISDN")]', 
      '//*[@id="s_7_r_0_MSISDN"]', 
      '//input[contains(@id,"MSISDN")]', 
      '//*[@id="a_7"]/div/table/tbody/tr[3]/td[4]/div/input'
    ]; 

    let entered = false; 
    for (const sel of selectors) { 
      try { 
        const el = await $(sel); 
        if (await el.isExisting()) {
          await el.waitForDisplayed({ timeout: 5000 }); 
          await el.clearValue(); 
          await el.setValue(msisdn); 
          console.log(`   ✅ MSISDN entered using selector: ${sel}`); 
          entered = true; 
          break; 
        }
      } catch { /* try next */ } 
    } 

    if (!entered) { 
      throw new Error('Could not find MSISDN input field with any known selector'); 
    } 
  }

  async clickGoButton(): Promise<void> {
    console.log('🔍 Clicking Go button...');
    const selectors = [
      SEL.goButton,
      '//*[@id="s_7_1_1_0_Ctrl"]',
      '//*[@id="s_1_1_1_0_Ctrl"]',
      '//*[@aria-label="Subscriptions - Search:Go"]',
      '//*[@title="Subscriptions - Search:Go"]',
      '//button[contains(@class,"siebui-icon-executequery") and (normalize-space(.)="Go" or .//span[normalize-space()="Go"])]'
    ];

    let clicked = false;
    for (const sel of selectors) {
      try {
        const btn = await $(sel);
        if (!(await btn.isExisting())) continue;
        if (!(await btn.isDisplayed())) continue;
        await btn.waitForClickable({ timeout: 5_000 });
        await btn.click();
        clicked = true;
        break;
      } catch {}
    }

    if (!clicked) {
      throw new Error('Go button not found with any known selector');
    }
    await this.waitForGridOrSummaryToLoad();
    console.log('   ✅ Go button clicked and page loaded');
  }
  
  private async waitForGridOrSummaryToLoad(): Promise<void> {
    try {
      const loadingOverlay = await $(SEL.loadingOverlay);
      if (await loadingOverlay.isExisting()) {
        await loadingOverlay.waitForDisplayed({ reverse: true, timeout: 10_000 });
      }
    } catch { /* No loading overlay */ }
    
    // Wait for either grid or breadcrumb to appear
    await browser.waitUntil(
      async () => {
        try {
          const grid = await $(SEL.gridTable);
          if (await grid.isDisplayed()) return true;
        } catch { /* not there yet */ }
        
        try {
          const breadcrumb = await $(SEL.breadcrumb);
          if (await breadcrumb.isDisplayed()) return true;
        } catch { /* not there yet */ }
        
        return false;
      },
      { timeout: 15_000, interval: 1_000, timeoutMsg: 'Neither grid nor breadcrumb appeared' }
    );
    
    await browser.pause(1_000);
  }

  async detectResultPage(): Promise<'ACCOUNT_SUMMARY' | 'SUBSCRIPTION_LIST'> {
    console.log('⏳ Detecting result page type...');

    await browser.waitUntil(
      async () => {
        try {
          const crumb = await $(SEL.breadcrumb);
          if (await crumb.isDisplayed()) {
            const txt = (await crumb.getText()).trim();
            if (txt.toLowerCase().includes('account summary')) return true;
          }
        } catch { /* not there yet */ }

        try {
          const grid = await $(SEL.gridTable);
          if (await grid.isDisplayed()) return true;
        } catch { /* not there yet */ }

        try {
          const noDataMsg = await $(SEL.noDataMessage);
          if (await noDataMsg.isDisplayed()) return true;
        } catch { /* not there yet */ }

        return false;
      },
      { timeout: 20_000, interval: 1_000,
        timeoutMsg: 'Neither Account Summary nor subscription grid appeared' }
    );

    try {
      const crumb = await $(SEL.breadcrumb);
      if (await crumb.isDisplayed()) {
        const txt = (await crumb.getText()).trim();
        if (txt.toLowerCase().includes('account summary')) {
          console.log('   📄 Direct Account Summary (Case 5.1)');
          return 'ACCOUNT_SUMMARY';
        }
      }
    } catch { /* fall through */ }

    // Check if grid exists and has rows
    try {
      const rows = await $$(SEL.gridBody);
      const noDataMsg = await $(SEL.noDataMessage);
      const isNoDataDisplayed = await noDataMsg.isDisplayed().catch(() => false);
      
      if ((await rows.length) > 0 && !isNoDataDisplayed) {  
        console.log(`   📋 Subscription list grid (Case 5.2) - found ${await rows.length} rows`);
        return 'SUBSCRIPTION_LIST';
      }
    } catch { /* fall through */ }

    console.log('   ⚠️ No subscriptions found, treating as empty grid');
    return 'SUBSCRIPTION_LIST';
  }

  async verifyAccountSummaryPage(expectedMsisdn: string): Promise<void> {
    console.log(`\n✅ Verifying Account Summary for MSISDN: ${expectedMsisdn}`);

    const breadcrumb = await $(SEL.breadcrumb);
    await breadcrumb.waitForDisplayed({ timeout: 15_000 });
    const breadcrumbText = (await breadcrumb.getText()).trim();
    expect(breadcrumbText).to.contain('Account Summary');
    console.log(`   ✅ Breadcrumb: "${breadcrumbText}"`);

    const assetField = await this.findAssetField();
    await assetField.waitForDisplayed({ timeout: 10_000 });

    const assetValue = await assetField.getValue();
    console.log(`   📱 Asset/Mobile Number field value: "${assetValue}"`);

    const normalise = (v: string) => v.replace(/[^0-9]/g, '').slice(-10);
    expect(normalise(assetValue)).to.contain(normalise(expectedMsisdn));
    console.log(`   ✅ MSISDN verified: ${expectedMsisdn}`);

    try {
      const bodyText = await (await $('body')).getText();
      if (bodyText.toLowerCase().includes('postpaid')) {
        console.log('   ✅ Account type: Postpaid confirmed');
      }
    } catch { /* non-critical */ }
  }

  private async findAssetField() {
    for (const sel of [SEL.assetFieldAria, SEL.assetFieldAlt, SEL.assetFieldFull]) {
      try {
        const el = await $(sel);
        if (await el.isExisting()) return el;
      } catch { /* try next */ }
    }
    throw new Error('Asset/Mobile Number field not found with any known locator');
  }

  async findAndOpenValidSubscription(msisdn: string): Promise<boolean> {
    console.log(`\n🔎 Scanning subscription grid for MSISDN: ${msisdn}`);
    await this.waitForGridToLoad();

    const rows = await $$(SEL.gridBody);
    console.log(`   Found ${await rows.length} data rows in grid`);

    if ((await rows.length) === 0) {
      console.log('   ⚠️ No rows found in subscription grid');
      await this.checkForNoDataMessage();
      return false;
    }

    let validRowCount = 0;
    let skippedRows = 0;

    for (const row of rows) {
      const rowClass = (await row.getAttribute('class')) ?? '';
      if (rowClass.includes('jqgfirstrow') || rowClass.includes('jqgempty')) {
        continue;
      }

      let rowMsisdn = '';
      try {
        const msisdnElement = await row.$('td[id*="_MSISDN"]');
        rowMsisdn = (await msisdnElement.getText()).trim();
      } catch { 
        skippedRows++;
        continue; 
      }

      if (rowMsisdn !== msisdn.trim()) continue;

      let status = '';
      try {
        const statusElement = await row.$('td[id*="_Status"]');
        status = (await statusElement.getText()).trim().toLowerCase();
      } catch { 
        console.log(`   ⚠️ Could not read status for MSISDN: ${rowMsisdn}`);
        continue; 
      }

      let activationDate = '';
      try {
        const activationElement = await row.$('td[id*="_TM_Install_Date"]');
        activationDate = (await activationElement.getText()).trim();
      } catch { 
        console.log(`   ℹ️ No activation date found for MSISDN: ${rowMsisdn}`);
      }

      console.log(`   Row — MSISDN: ${rowMsisdn} | Status: ${status} | Activation: ${activationDate || 'Not set'}`);

      // Valid statuses: Active or Suspended
      const validStatus = status === 'active' || status === 'suspended';

      if (!validStatus) {
        console.log(`   ⏭️  Skipping — Status "${status}" is not Active/Suspended (Case 5.2 requirement)`);
        skippedRows++;
        continue;
      }

      if (!activationDate) {
        console.log('   ⏭️  Skipping — Activation Date missing');
        skippedRows++;
        continue;
      }

      validRowCount++;

      try {
        const assetLink = await row.$('td[id*="_Asset_Number"] a');
        await assetLink.waitForClickable({ timeout: 5_000 });
        const assetNumber = (await assetLink.getText()).trim();
        console.log(`   ✅ Valid record found (Active/Suspended) — Asset #: ${assetNumber} | Status: ${status}`);
        console.log(`   🔗 Clicking Asset # link...`);
        await assetLink.click();
        await this.waitForAccountSummaryToLoad();
        console.log(`   ✅ Successfully navigated to Account Summary for Asset #: ${assetNumber}`);
        return true;
      } catch (err) {
        const error = err as Error;
        console.warn(`   ⚠️ Could not click Asset link: ${error.message}`);
        continue;
      }
    }

    console.log(`\n📊 Subscription scan summary:`);
    console.log(`   - Valid rows (Active/Suspended) found: ${validRowCount}`);
    console.log(`   - Rows skipped: ${skippedRows}`);
    console.log(`   - Total rows processed: ${await rows.length}`);
    console.log(`\n   ❌ No Active/Suspended subscription found for ${msisdn}`);
    return false;
  }

  private async waitForGridToLoad(): Promise<void> {
    console.log('   ⏳ Waiting for subscription grid to load...');
    
    try {
      const loadingOverlay = await $(SEL.loadingOverlay);
      if (await loadingOverlay.isExisting()) {
        await loadingOverlay.waitForDisplayed({ reverse: true, timeout: 15_000 });
      }
      
      // Wait for grid table to appear
      await $(SEL.gridTable).waitForDisplayed({ timeout: 10_000 });
      
      // Wait for at least one data row (excluding header)
      await browser.waitUntil(
        async () => {
          const rows = await $$(SEL.gridBody);
          return (await rows.length) > 0;
        },
        { timeout: 10_000, interval: 1_000, timeoutMsg: 'No data rows found in grid' }
      );
      
      await browser.pause(1_000);
      console.log('   ✅ Grid loaded successfully');
    } catch (err) {
      const error = err as Error;
      console.log(`   ⚠️ Grid may not have loaded completely: ${error.message}`);
    }
  }

  private async waitForAccountSummaryToLoad(): Promise<void> {
    console.log('   ⏳ Waiting for Account Summary page to load...');
    
    try {
      const breadcrumb = await $(SEL.breadcrumb);
      await breadcrumb.waitForDisplayed({ timeout: 15_000 });
      const assetField = await this.findAssetField();
      await assetField.waitForDisplayed({ timeout: 10_000 });
      console.log('   ✅ Account Summary page loaded successfully');
    } catch (err) {
      const error = err as Error;
      console.log(`   ⚠️ Account Summary page may not have loaded completely: ${error.message}`);
    }
  }

  private async checkForNoDataMessage(): Promise<boolean> {
    try {
      const noDataMsg = await $(SEL.noDataMessage);
      if (await noDataMsg.isDisplayed()) {
        const message = await noDataMsg.getText();
        console.log(`   ℹ️ No subscriptions found: ${message}`);
        return true;
      }
    } catch { /* No message displayed */ }
    return false;
  }

  async getRowByMSISDN(msisdn: string): Promise<{ index: number; record: any } | null> {
    await this.waitForGridToLoad();
    const rows = await $$(SEL.gridBody);
    
    for (let i = 0; i < await rows.length; i++) {
      const row = rows[i];
      const rowClass = await row.getAttribute('class');
      if (rowClass?.includes('jqgfirstrow')) continue;
      
      try {
        const msisdnElement = await row.$('td[id*="_MSISDN"]');
        const rowMsisdn = await msisdnElement.getText();
        
        if (rowMsisdn.trim() === msisdn) {
          const status = await row.$('td[id*="_Status"]').getText();
          const activationDate = await row.$('td[id*="_TM_Install_Date"]').getText();
          const assetNumber = await row.$('td[id*="_Asset_Number"] a').getText();
          
          return {
            index: i + 1,
            record: { 
              status: status.trim(), 
              activationDate: activationDate.trim(), 
              assetNumber: assetNumber.trim() 
            }
          };
        }
      } catch (err) {
        const error = err as Error;
        console.log(`   Error reading row ${i}: ${error.message}`);
        continue;
      }
    }
    return null;
  }

  async clickAssetNumber(rowIndex: number): Promise<void> {
    // Updated to use s_1_l instead of s_7_l
    const assetLink = await $(`//*[@id="s_1_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_1_l_Asset_Number"]/a`);
    await assetLink.waitForClickable({ timeout: 10000 });
    await assetLink.click();
    await browser.pause(3000);
    console.log(`✅ Clicked Asset # link at row ${rowIndex}`);
  }

  async findAndOpenValidSubscriptionWithOptions(
    msisdn: string, 
    allowedStatuses: string[] = ['active', 'suspended'],
    requireActivationDate: boolean = true
  ): Promise<boolean> {
    console.log(`\n🔎 Scanning subscription grid for MSISDN: ${msisdn}`);
    console.log(`   Allowed statuses: ${allowedStatuses.join(', ')}`);
    console.log(`   Activation date required: ${requireActivationDate}`);
    
    await this.waitForGridToLoad();

    const rows = await $$(SEL.gridBody);
    const total = await this.getRowCount();
    console.log(`   Found ${total} data rows in grid`);

    for (const row of rows) {
      const rowClass = (await row.getAttribute('class')) ?? '';
      if (rowClass.includes('jqgfirstrow') || rowClass.includes('jqgempty')) {
        continue;
      }

      let rowMsisdn = '';
      try {
        rowMsisdn = (await row.$('td[id*="_MSISDN"]').getText()).trim();
      } catch { continue; }

      if (rowMsisdn !== msisdn.trim()) continue;

      let status = '';
      try {
        status = (await row.$('td[id*="_Status"]').getText()).trim().toLowerCase();
      } catch { continue; }

      let activationDate = '';
      try {
        activationDate = (await row.$('td[id*="_TM_Install_Date"]').getText()).trim();
      } catch { /* optional */ }

      console.log(`   Row — MSISDN: ${rowMsisdn} | Status: ${status} | Activation: ${activationDate || 'Not set'}`);

      const validStatus = allowedStatuses.includes(status);

      if (!validStatus) {
        console.log(`   ⏭️  Skipping — Status "${status}" not in allowed list`);
        continue;
      }

      if (requireActivationDate && !activationDate) {
        console.log('   ⏭️  Skipping — Activation Date missing');
        continue;
      }

      try {
        const assetLink = await row.$('td[id*="_Asset_Number"] a');
        const assetNumber = (await assetLink.getText()).trim();
        console.log(`   ✅ Valid record found — Asset #: ${assetNumber} | Status: ${status}`);
        await assetLink.click();
        await this.waitForAccountSummaryToLoad();
        return true;
      } catch (err) {
        const error = err as Error;
        console.warn(`   ⚠️ Could not click Asset link: ${error.message}`);
      }
    }

    console.log(`   ❌ No valid subscription found for ${msisdn}`);
    return false;
  }

  async getRowCount(): Promise<number> {
    await this.waitForGridToLoad();
    const rows = await $$(SEL.gridBody);
    return await rows.length;
  }
}