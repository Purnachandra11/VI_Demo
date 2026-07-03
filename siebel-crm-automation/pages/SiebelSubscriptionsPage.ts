// test/pages/SiebelSubscriptionsPage.ts (UPDATED with parse methods)

import { browser, $, $$ } from '@wdio/globals';
import { expect } from 'chai';

// ─── Selectors ─────────────────────────────────────────────────────────────────

const SEL = {
  msisdnInput   : '//*[contains(@aria-label,"MSISDN")]',
  goButton      : '//*[@id="s_7_1_1_0_Ctrl" or @id="s_1_1_1_0_Ctrl"]',
  breadcrumb    : '//span[@class="siebui-crumb"]',
  assetFieldAria: 'input[aria-label="Asset"]',
  assetFieldAlt : 'input[aria-labelledby="AssetNumTitle_Label"]',
  assetFieldFull: '//*[@id="a_3"]/table/tbody/tr/td/span/div/table[1]/tbody/tr/td[1]/input',
  // Account Summary specific locators
  accountSummaryHeader: '//span[contains(text(), "Account Summary")]',
  assetNumberDisplay: '//span[@id="s_3_l_Asset_Number"] | //input[contains(@id,"Asset_Number")]',
  mobileNumberDisplay: '//span[contains(@id,"Mobile_Number")] | //input[contains(@aria-label,"Mobile")]',
  // Grid selectors
  gridBody      : '#s_1_l tbody tr:not(.jqgfirstrow)',
  gridTable     : '#s_1_l',
  noDataMessage : '//div[contains(text(), "No records to display")]',
  loadingOverlay: '//div[contains(@class, "loading") or contains(@class, "wait")]',
  // Account Summary fields
  assetInput    : 'input[name="s_3_1_30_0"]',
  subscriberLabels: '.mceGridLabel .siebui-label span',
  subscriberValues: '.mceGridField .siebui-ctrl-text label, .mceGridField .siebui-ctrl-text',
  gridRows      : 'table.GridBack tbody tr',
  gridLabel     : '.mceGridLabel .siebui-label span',
  gridValue     : '.mceGridField .siebui-ctrl-text label, .mceGridField .siebui-ctrl-text',
  gridFieldInput: '.mceGridField .siebui-ctrl-input',
  bodyText      : 'body',
} as const;

export interface SubscriptionRecord {
  msisdn: string;
  status: string;
  assetNumber: string;
  serviceBundle: string;
  prepost: string;
  circleName: string;
  simNumber: string;
  url: string;
  accountNumber: string;
  customerName: string;
  billingAccountId: string;
  faId: string;
  alternateNumber: string;
  activationDate: string;
  modifyDeactivationDate: string;
  crmInstance: string;
}

export interface AssetDetails {
  asset_number: string;
  msisdn: string;
  status: string;
  subscriber: string;
  prepost: string;
  circle_name: string;
  sim_number: string;
  activation_date: string;
  account_number: string;
  fa_id: string;
  service_bundle: string;
  tariff_plan: string;
  account_summary_verified: boolean;
  parsed_at: string;
  [key: string]: string | boolean | number | undefined;
}

export interface SubscriberDetails {
  subscriber: string;
  aon: string;
  company_name: string;
  activation_date: string;
  fa_id: string;
  type_of_family: string;
  operating_status: string;
  tariff_plan: string;
  status: string;
  category: string;
  billing_media: string;
  subscriber_type: string;
  payment_mode: string;
  segment: string;
  bill_date: string;
  customer_class: string;
  credit_limit: string;
  enterprise_code: string;
  credit_status: string;
  postpaid_activation_date: string;
  alternate_number: string;
  postpaid_aging: string;
  email: string;
  gst_flag: string;
  bill_format: string;
  [key: string]: string | undefined;
}

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

  /**
   * Parse all subscription rows from the grid
   * Returns array of subscription records with all available data
   */
  async parseSubscriptions(): Promise<SubscriptionRecord[]> {
    console.log('📊 Parsing subscription grid data...');
    const subscriptions: SubscriptionRecord[] = [];
    
    try {
      // Wait for table to load
      await this.waitForGridToLoad();
      
      // Get all data rows
      const rows = await $$(SEL.gridBody);
      
      if ((await rows.length) === 0) {
        console.log('   ⚠️ No subscription rows found');
        return subscriptions;
      }
      
      for (const row of rows) {
        const cells = await row.$$('td');
        
        if ((await cells.length) >= 17) {
          try {
            const subscription: SubscriptionRecord = {
              msisdn: await this.getCellText(cells[1]) || '',
              status: await this.getCellText(cells[2]) || '',
              assetNumber: await this.getCellText(cells[3]) || '',
              serviceBundle: await this.getCellText(cells[4]) || '',
              prepost: await this.getCellText(cells[5]) || '',
              circleName: await this.getCellText(cells[6]) || '',
              simNumber: await this.getCellText(cells[7]) || '',
              url: await this.getCellText(cells[8]) || '',
              accountNumber: await this.getCellText(cells[9]) || '',
              customerName: await this.getCellText(cells[10]) || '',
              billingAccountId: await this.getCellText(cells[11]) || '',
              faId: await this.getCellText(cells[12]) || '',
              alternateNumber: await this.getCellText(cells[13]) || '',
              activationDate: await this.getCellText(cells[14]) || '',
              modifyDeactivationDate: await this.getCellText(cells[15]) || '',
              crmInstance: await this.getCellText(cells[16]) || ''
            };
            
            subscriptions.push(subscription);
          } catch (cellError) {
            console.log(`   ⚠️ Error parsing row: ${cellError}`);
          }
        }
      }
      
      console.log(`   ✅ Parsed ${subscriptions.length} subscription records`);
      return subscriptions;
      
    } catch (error) {
      console.log(`   ⚠️ Error parsing subscriptions: ${error}`);
      return subscriptions;
    }
  }

  /**
   * Parse Asset Details from Account Summary page
   * Extracts all asset-related fields from the page
   */
  async parseAssetDetails(): Promise<AssetDetails> {
    console.log('📊 Parsing Asset Details from Account Summary...');
    
    const assetData: AssetDetails = {
      asset_number: '',
      msisdn: '',
      status: '',
      subscriber: '',
      prepost: '',
      circle_name: '',
      sim_number: '',
      activation_date: '',
      account_number: '',
      fa_id: '',
      service_bundle: '',
      tariff_plan: '',
      account_summary_verified: false,
      parsed_at: new Date().toISOString()
    };

    try {
      // Wait for the asset input to be available
      await this.waitForAccountSummaryToLoad();
      
      // Get the asset number from the input field
      try {
        const assetInput = await $(SEL.assetInput);
        if (await assetInput.isExisting()) {
          const assetNumber = await assetInput.getValue();
          if (assetNumber && assetNumber.trim()) {
            assetData.asset_number = assetNumber.trim();
            console.log(`   ✅ Asset Number: ${assetData.asset_number}`);
          }
        }
      } catch (error) {
        console.log('   ⚠️ Could not get asset number from input field');
      }

      // Get the container text to extract all information
      try {
        const bodyText = await (await $(SEL.bodyText)).getText();
        const cleanText = bodyText.replace(/\s+/g, ' ').trim();
        
        // Extract verification status
        const verificationMatch = cleanText.match(/Account\s+Summary\s+verified/i);
        assetData.account_summary_verified = !!verificationMatch;
        
        // Extract asset number if not found in input
        if (!assetData.asset_number) {
          const assetMatch = cleanText.match(/\b(\d{10})\b/);
          if (assetMatch) {
            assetData.asset_number = assetMatch[1];
          }
        }
        
        // Extract prepaid/postpaid status
        const prepostMatch = cleanText.match(/(Prepaid|Postpaid)/i);
        if (prepostMatch) {
          assetData.prepost = prepostMatch[1];
        }
        
        // Extract circle/location
        const circleMatch = cleanText.match(/(Gujarat|Maharashtra|Karnataka|Tamil Nadu|Delhi|Mumbai|Kolkata|Andhra Pradesh|Uttar Pradesh|Rajasthan|Madhya Pradesh|Punjab|Haryana|Kerala|Odisha|Assam|Bihar|Jammu & Kashmir|Himachal Pradesh|North East|West Bengal)/i);
        if (circleMatch) {
          assetData.circle_name = circleMatch[1];
        }
        
        // Extract Tariff Plan
        const tariffMatch = cleanText.match(/Tariff\s+Plan[:\s]+([A-Za-z0-9\s_]+)/i);
        if (tariffMatch) {
          assetData.tariff_plan = tariffMatch[1].trim();
        }
        
        // Extract Status
        const statusMatch = cleanText.match(/Operating\s+Status[:\s]+([A-Za-z\s]+)/i);
        if (statusMatch) {
          assetData.status = statusMatch[1].trim();
        }
        
        // Extract FA ID
        const faMatch = cleanText.match(/Rltshp\s+No\.\/\s+FA\s+ID[:\s]+([A-Z0-9]+)/i);
        if (faMatch) {
          assetData.fa_id = faMatch[1].trim();
        }
        
        // Extract Activation Date
        const dateMatch = cleanText.match(/Activation\s+Date[:\s]+([\d\-A-Za-z]+)/i);
        if (dateMatch) {
          assetData.activation_date = dateMatch[1].trim();
        }
        
        // Extract Subscriber
        const subMatch = cleanText.match(/Subscriber[:\s]+([A-Za-z\s]+)/i);
        if (subMatch) {
          assetData.subscriber = subMatch[1].trim();
        }
        
        // Extract Account Number
        const accMatch = cleanText.match(/Account\s+Number[:\s]+([A-Z0-9\-]+)/i);
        if (accMatch) {
          assetData.account_number = accMatch[1].trim();
        }
        
        // Extract SIM Number
        const simMatch = cleanText.match(/SIM[:\s]+([0-9]+)/i);
        if (simMatch) {
          assetData.sim_number = simMatch[1].trim();
        }
        
        // Extract Service Bundle
        const bundleMatch = cleanText.match(/Service\s+Bundle[:\s]+([A-Za-z\s]+)/i);
        if (bundleMatch) {
          assetData.service_bundle = bundleMatch[1].trim();
        }
        
      } catch (error) {
        console.log('   ⚠️ Could not parse text from page:', error);
      }

      // Get all input fields in the same row/area
      try {
        const inputFields = await $$('input[type="text"][readonly]');
        
        for (const input of inputFields) {
          const name = await input.getAttribute('name') || '';
          const value = await input.getValue() || '';
          const ariaLabel = await input.getAttribute('aria-label') || '';
          
          if (value && value.trim()) {
            // Map field names based on name attribute or aria-label
            if (name && name.includes('s_3_1_30')) {
              assetData.asset_number = value.trim();
            } else if (name && name.includes('s_3_1_31')) {
              assetData.msisdn = value.trim();
            } else if (name && name.includes('s_3_1_32')) {
              assetData.status = value.trim();
            } else if (name && name.includes('s_3_1_33')) {
              assetData.subscriber = value.trim();
            } else if (ariaLabel) {
              const key = ariaLabel.toLowerCase().replace(/ /g, '_');
              (assetData as any)[key] = value.trim();
            }
          }
        }
      } catch (error) {
        console.log('   ⚠️ Could not parse input fields:', error);
      }

      console.log(`   ✅ Asset Details parsed successfully`);
      console.log(`      - Asset: ${assetData.asset_number}`);
      console.log(`      - MSISDN: ${assetData.msisdn}`);
      console.log(`      - Status: ${assetData.status}`);
      console.log(`      - Circle: ${assetData.circle_name}`);
      
      return assetData;
      
    } catch (error) {
      console.error('Error parsing asset details:', error);
      return assetData;
    }
  }

  /**
   * Parse Subscriber Details from Account Summary page
   * Extracts all subscriber-related fields from the grid
   */
  async parseSubscriberDetails(): Promise<SubscriberDetails> {
    console.log('📊 Parsing Subscriber Details from Account Summary...');
    
    const subscriberData: SubscriberDetails = {
      subscriber: '',
      aon: '',
      company_name: '',
      activation_date: '',
      fa_id: '',
      type_of_family: '',
      operating_status: '',
      tariff_plan: '',
      status: '',
      category: '',
      billing_media: '',
      subscriber_type: '',
      payment_mode: '',
      segment: '',
      bill_date: '',
      customer_class: '',
      credit_limit: '',
      enterprise_code: '',
      credit_status: '',
      postpaid_activation_date: '',
      alternate_number: '',
      postpaid_aging: '',
      email: '',
      gst_flag: '',
      bill_format: ''
    };

    try {
      // Wait for the page to load
      await this.waitForAccountSummaryToLoad();

      // Get all rows from the grid
      const rows = await $$(SEL.gridRows);
      console.log(`   Found ${await rows.length} rows in the grid`);

      // Key mapping for field names
      const keyMap: { [key: string]: string } = {
        'Subscriber': 'subscriber',
        'AON': 'aon',
        'Company Name': 'company_name',
        'Activation Date': 'activation_date',
        'Rltshp No./ FA ID': 'fa_id',
        'Type of Family': 'type_of_family',
        'Operating Status': 'operating_status',
        'Tariff Plan': 'tariff_plan',
        'Status': 'status',
        'Category': 'category',
        'Billing Media': 'billing_media',
        'Subscriber Type': 'subscriber_type',
        'Payment Mode': 'payment_mode',
        'Segment': 'segment',
        'Bill Date': 'bill_date',
        'Customer Class': 'customer_class',
        'Credit Limit': 'credit_limit',
        'Enterprise Code': 'enterprise_code',
        'Credit Status': 'credit_status',
        'Postpaid Activation Date': 'postpaid_activation_date',
        'Alt Number': 'alternate_number',
        'Postpaid Aging': 'postpaid_aging',
        'Email': 'email',
        'GST Flag': 'gst_flag',
        'Bill Format': 'bill_format'
      };

      // Process each row
      for (const row of rows) {
        try {
          // Get label and value from the row
          const labelElement = await row.$(SEL.gridLabel);
          const valueElement = await row.$(SEL.gridValue);
          
          if (await labelElement.isExisting() && await valueElement.isExisting()) {
            const label = (await labelElement.getText()).replace(':', '').trim();
            const value = (await valueElement.getText()).trim();
            
            if (label && value) {
              // Map to appropriate key
              const mappedKey = keyMap[label] || label.toLowerCase().replace(/ /g, '_');
              (subscriberData as any)[mappedKey] = value;
              console.log(`      ${label}: ${value}`);
            }
          }
        } catch (rowError) {
          // Skip rows that can't be parsed
          continue;
        }
      }

      console.log(`   ✅ Subscriber Details parsed successfully`);
      console.log(`      - Subscriber: ${subscriberData.subscriber}`);
      console.log(`      - Operating Status: ${subscriberData.operating_status}`);
      console.log(`      - Tariff Plan: ${subscriberData.tariff_plan}`);
      
      return subscriberData;
      
    } catch (error) {
      console.error('Error parsing subscriber details:', error);
      return subscriberData;
    }
  }

  /**
   * Parse both Asset and Subscriber details in one call
   */
  async parseAccountSummaryDetails(): Promise<{ asset: AssetDetails; subscriber: SubscriberDetails }> {
    console.log('\n📊 Parsing complete Account Summary details...');
    
    const asset = await this.parseAssetDetails();
    const subscriber = await this.parseSubscriberDetails();
    
    console.log('\n   ✅ Account Summary parsing completed');
    return { asset, subscriber };
  }

  private async getCellText(cell: any): Promise<string> {
    try {
      // Try to get title attribute first (often has the actual value)
      const title = await cell.getAttribute('title');
      if (title && title.trim()) {
        return title.trim();
      }
      // Fall back to text content
      return (await cell.getText()).trim();
    } catch {
      return '';
    }
  }

  async verifyAccountSummaryPage(expectedMsisdn: string): Promise<void> {
    console.log(`\n✅ Verifying Account Summary for MSISDN: ${expectedMsisdn}`);
    console.log('   ⏳ Waiting for Account Summary page to load completely...');

    // FIRST: Wait for the breadcrumb to show "Account Summary"
    try {
      const breadcrumb = await $(SEL.breadcrumb);
      await breadcrumb.waitForDisplayed({ timeout: 30_000 });
      const breadcrumbText = (await breadcrumb.getText()).trim();
      
      if (!breadcrumbText.toLowerCase().includes('account summary')) {
        // If breadcrumb doesn't contain "Account Summary", try to detect the page differently
        console.log(`   ℹ️ Breadcrumb text: "${breadcrumbText}" - waiting for page elements...`);
      } else {
        console.log(`   ✅ Breadcrumb: "${breadcrumbText}"`);
      }
    } catch (error) {
      console.log(`   ⚠️ Breadcrumb not found, continuing with other checks...`);
    }

    // SECOND: Wait for page to be fully loaded by checking for multiple elements
    await this.waitForAccountSummaryToLoad();

    // THIRD: Try multiple strategies to find the Asset/Mobile Number field
    const assetField = await this.findAssetField();
    await assetField.waitForDisplayed({ timeout: 15_000 });

    // Get the value - could be from input or span
    let assetValue = '';
    try {
      assetValue = await assetField.getValue();
      if (!assetValue || assetValue.trim() === '') {
        // If input is empty, try text content
        assetValue = await assetField.getText();
      }
    } catch {
      assetValue = await assetField.getText();
    }

    console.log(`   📱 Asset/Mobile Number field value: "${assetValue}"`);

    // Normalize for comparison (remove non-numeric, take last 10 digits)
    const normalize = (v: string) => v.replace(/[^0-9]/g, '').slice(-10);
    const expectedNormalized = normalize(expectedMsisdn);
    const actualNormalized = normalize(assetValue);

    expect(actualNormalized).to.contain(expectedNormalized);
    console.log(`   ✅ MSISDN verified: ${expectedMsisdn}`);

    // Additional verification - check for postpaid/prepaid info
    try {
      const bodyText = await (await $('body')).getText();
      if (bodyText.toLowerCase().includes('postpaid')) {
        console.log('   ✅ Account type: Postpaid confirmed');
      } else if (bodyText.toLowerCase().includes('prepaid')) {
        console.log('   ✅ Account type: Prepaid confirmed');
      }
    } catch { /* non-critical */ }
  }

  private async waitForAccountSummaryToLoad(): Promise<void> {
    console.log('   ⏳ Waiting for Account Summary page content...');
    
    // Wait for multiple indicators that page is loaded
    await browser.waitUntil(
      async () => {
        try {
          // Check for any of these elements
          const elementSelectors = [
            'span.siebui-crumb',
            'input[aria-label="Asset"]',
            'input[aria-labelledby="AssetNumTitle_Label"]',
            '//*[@id="a_3"]',
            '//span[contains(text(), "Account")]',
            '//div[contains(@class, "applet")]',
            'input[name="s_3_1_30_0"]',
            'table.GridBack'
          ];
          
          for (const selector of elementSelectors) {
            try {
              const el = await $(selector);
              if (await el.isDisplayed()) {
                return true;
              }
            } catch { /* element not found */ }
          }
          return false;
        } catch {
          return false;
        }
      },
      { 
        timeout: 45_000,  // 45 seconds max wait
        interval: 2_000,  // Check every 2 seconds
        timeoutMsg: 'Account Summary page did not load within 45 seconds' 
      }
    );

    // Additional wait for any loading spinners to disappear
    try {
      await browser.waitUntil(
        async () => {
          const loadingElements = await $$('//div[contains(@class, "loading") or contains(@class, "wait")]');
          const visible = await Promise.all(
            loadingElements.map(async el => await el.isDisplayed())
          );
          return !visible.some(v => v === true);
        },
        { 
          timeout: 15_000,
          interval: 1_000,
          timeoutMsg: 'Loading indicators still visible'
        }
      );
    } catch { /* no loading indicators or they disappeared */ }

    console.log('   ✅ Account Summary page loaded successfully');
  }

  private async findAssetField() {
    // Try all known selectors with extended timeout
    const selectors = [
      SEL.assetFieldAria,
      SEL.assetFieldAlt,
      SEL.assetFieldFull,
      '//input[contains(@aria-label, "Asset")]',
      '//input[contains(@id, "Asset_Number")]',
      '//span[contains(@id, "Asset_Number")]',
      '//*[contains(@aria-label, "Mobile Number")]',
      '//input[contains(@aria-label, "Mobile")]',
      '//*[@id="s_3_l_Asset_Number"]',
      '//*[@id="s_3_r_0_Asset_Number"]',
      'input[name="s_3_1_30_0"]'
    ];

    for (const sel of selectors) {
      try {
        const el = await $(sel);
        // Check if element exists and is displayed or present in DOM
        const exists = await el.isExisting();
        if (exists) {
          const displayed = await el.isDisplayed().catch(() => false);
          if (displayed) {
            console.log(`   🔍 Found asset field using selector: ${sel}`);
            return el;
          } else {
            // Element exists but not displayed - might be hidden but has value
            // Try to get its value anyway
            const value = await el.getValue().catch(() => '');
            if (value && value.trim()) {
              console.log(`   🔍 Found hidden asset field with value using: ${sel}`);
              return el;
            }
          }
        }
      } catch { /* try next */ }
    }

    // Last resort: try to find any input or span with MSISDN/Asset related text
    try {
      const allInputs = await $$('input');
      for (const input of allInputs) {
        const ariaLabel = await input.getAttribute('aria-label').catch(() => '');
        const id = await input.getAttribute('id').catch(() => '');
        const name = await input.getAttribute('name').catch(() => '');
        const combined = `${ariaLabel} ${id} ${name}`.toLowerCase();
        if (combined.includes('asset') || combined.includes('msisdn') || combined.includes('mobile')) {
          console.log(`   🔍 Found asset field by scanning inputs: ${id || ariaLabel || name}`);
          return input;
        }
      }
    } catch { /* fall through */ }

    throw new Error('Asset/Mobile Number field not found with any known locator');
  }

  async findAndOpenValidSubscription(msisdn: string): Promise<boolean> {
    console.log(`\n🔎 Scanning subscription grid for MSISDN: ${msisdn}`);
    await this.waitForGridToLoad();

    // First, parse all subscriptions and log them
    const subscriptions = await this.parseSubscriptions();
    console.log(`   📊 Found ${subscriptions.length} subscription records`);
    
    // Log the first few records for debugging
    subscriptions.slice(0, 3).forEach((sub, idx) => {
      console.log(`      Record ${idx + 1}: MSISDN=${sub.msisdn}, Status=${sub.status}, Asset=${sub.assetNumber}`);
    });

    // Find the matching subscription
    const matchingSub = subscriptions.find(sub => 
      sub.msisdn.replace(/[^0-9]/g, '').slice(-10) === msisdn.replace(/[^0-9]/g, '').slice(-10)
    );

    if (!matchingSub) {
      console.log(`   ❌ No subscription found for MSISDN: ${msisdn}`);
      return false;
    }

    console.log(`   ✅ Found matching subscription:`);
    console.log(`      - MSISDN: ${matchingSub.msisdn}`);
    console.log(`      - Status: ${matchingSub.status}`);
    console.log(`      - Asset #: ${matchingSub.assetNumber}`);
    console.log(`      - Activation: ${matchingSub.activationDate}`);
    console.log(`      - Circle: ${matchingSub.circleName}`);

    // Check if status is valid (Active or Suspended)
    const validStatus = matchingSub.status.toLowerCase() === 'active' || 
                        matchingSub.status.toLowerCase() === 'suspended';

    if (!validStatus) {
      console.log(`   ⏭️  Skipping - Status "${matchingSub.status}" is not Active/Suspended`);
      return false;
    }

    // Click the Asset # link - using the parsed asset number
    try {
      // Find the row containing this asset number
      const rows = await $$(SEL.gridBody);
      let targetRow = null;
      let rowIndex = 0;

      for (const row of rows) {
        rowIndex++;
        try {
          const assetLink = await row.$('td[id*="_Asset_Number"] a');
          const assetText = await assetLink.getText();
          if (assetText.trim() === matchingSub.assetNumber) {
            targetRow = row;
            break;
          }
        } catch { continue; }
      }

      if (!targetRow) {
        console.log(`   ⚠️ Could not find row with asset number: ${matchingSub.assetNumber}`);
        return false;
      }

      const assetLink = await targetRow.$('td[id*="_Asset_Number"] a');
      await assetLink.waitForClickable({ timeout: 10_000 });
      console.log(`   🔗 Clicking Asset # link: ${matchingSub.assetNumber}`);
      await assetLink.click();

      // Wait for Account Summary page to load completely
      await this.waitForAccountSummaryToLoad();
      console.log(`   ✅ Successfully navigated to Account Summary for Asset #: ${matchingSub.assetNumber}`);
      return true;

    } catch (err) {
      const error = err as Error;
      console.warn(`   ⚠️ Could not click Asset link: ${error.message}`);
      return false;
    }
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
    const assetLink = await $(`//*[@id="s_1_l"]/tbody/tr[${rowIndex}]/td[@aria-describedby="s_1_l_Asset_Number"]/a`);
    await assetLink.waitForClickable({ timeout: 10000 });
    await assetLink.click();
    await this.waitForAccountSummaryToLoad();
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