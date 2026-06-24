// test/pages/AccountSummaryPage.ts (NEEDS UPDATE - add more validation methods)

import { browser, $ } from '@wdio/globals';
import { SiebelSelectors } from '../utils/SiebelSelectors';
import { SiebelHelper } from '../utils/SiebelHelper';

export interface AccountDetails {
  mobileNumber: string;
  planType: string;
  circleName: string;
  customerName?: string;
  accountNumber?: string;
}

export class AccountSummaryPage {

  async getAccountDetails(): Promise<AccountDetails> {
    await browser.pause(2000);
    
    const mobileNumber = await this.getMobileNumber();
    const planType = await this.getPlanType();
    const circleName = await this.getCircleName();
    const customerName = await this.getCustomerName();
    const accountNumber = await this.getAccountNumber();

    return {
      mobileNumber,
      planType,
      circleName,
      customerName,
      accountNumber,
    };
  }

  private async getMobileNumber(): Promise<string> {
    try {
      const inputElement = await $(SiebelSelectors.accountSummary.mobileNumberInput);
      await inputElement.waitForDisplayed({ timeout: 10000 });
      const value = await inputElement.getValue();
      return value || 'Not Found';
    } catch (error) {
      console.log('Could not get mobile number from account summary');
      return 'Not Found';
    }
  }

  private async getPlanType(): Promise<string> {
    try {
      const labelElement = await $(SiebelSelectors.accountSummary.postpaidLabel);
      const text = await labelElement.getText();
      if (text.toLowerCase().includes('postpaid')) {
        return 'Postpaid';
      } else if (text.toLowerCase().includes('prepaid')) {
        return 'Prepaid';
      }
      return text.trim();
    } catch (error) {
      return 'Not Found';
    }
  }

  private async getCircleName(): Promise<string> {
    try {
      const labelElement = await $(SiebelSelectors.accountSummary.circleNameLabel);
      const text = await labelElement.getText();
      return text.trim();
    } catch (error) {
      return 'Not Found';
    }
  }

  private async getCustomerName(): Promise<string> {
    try {
      const customerElement = await $('//*[contains(@aria-label, "Customer") or contains(@id, "Customer")]');
      if (await customerElement.isExisting()) {
        return await customerElement.getValue();
      }
      return 'Not Found';
    } catch {
      return 'Not Found';
    }
  }

  private async getAccountNumber(): Promise<string> {
    try {
      const accountElement = await $('//*[contains(@aria-label, "Account") or contains(@id, "Account")]');
      if (await accountElement.isExisting()) {
        return await accountElement.getValue();
      }
      return 'Not Found';
    } catch {
      return 'Not Found';
    }
  }

  async validateMobileNumber(expectedMSISDN: string): Promise<boolean> {
    const actual = await this.getMobileNumber();
    const isValid = actual === expectedMSISDN;
    
    if (!isValid) {
      console.log(`Mobile number mismatch: Expected ${expectedMSISDN}, Got ${actual}`);
    }
    
    return isValid;
  }

  async validatePostpaid(): Promise<boolean> {
    const planType = await this.getPlanType();
    const isValid = planType.toLowerCase() === 'postpaid';
    
    if (!isValid) {
      console.log(`Not Postpaid: ${planType}`);
    }
    
    return isValid;
  }

  async validateCircleName(expectedCircle: string): Promise<boolean> {
    const actual = await this.getCircleName();
    const isValid = actual.toLowerCase().includes(expectedCircle.toLowerCase());
    
    if (!isValid) {
      console.log(`Circle mismatch: Expected ${expectedCircle}, Got ${actual}`);
    }
    
    return isValid;
  }

  async verifyAccountSummaryPage(expectedMsisdn: string): Promise<boolean> {
    try {
      const breadcrumb = await $('span.siebui-crumb');
      await breadcrumb.waitForDisplayed({ timeout: 15000 });
      const breadcrumbText = await breadcrumb.getText();
      
      if (!breadcrumbText.includes('Account Summary')) {
        throw new Error(`Wrong page: ${breadcrumbText}`);
      }
      console.log(`✓ Navigated to: ${breadcrumbText}`);
      
      const assetField = await $('input[aria-label="Asset"], input[aria-labelledby="AssetNumTitle_Label"]');
      await assetField.waitForDisplayed({ timeout: 10000 });
      
      const assetValue = await assetField.getValue();
      console.log(`✓ Asset Number: ${assetValue}`);
      
      const subscriberType = await $('span[id*="_Subscriber_Type"] label');
      const subscriberTypeText = await subscriberType.getText();
      console.log(`✓ Subscriber Type: ${subscriberTypeText}`);
      
      return true;
      
    } catch (err) {
      const error = err as Error;
      console.error(`Verification failed: ${error.message}`);
      return false;
    }
  }
}