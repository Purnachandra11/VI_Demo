import type { AndroidDriver } from '../types/driver';
import { getEndCallButtonOptions } from '../config/ElementConfig';
import { adbShell } from '../utils/adb';

export interface CallConnectionResult {
  connected: boolean;
  actualDuration: number;
  failureReason?: string;
}

export interface CallResult {
  phoneNumber: string;
  connected: boolean;
  targetDuration: number;
  actualDuration: number;
  callStatus: string;
  attemptNumber: number;
  failureReason?: string;
}

/**  ImprovedDialerPage */
export class ImprovedDialerPage {
  constructor(
    private readonly driver: AndroidDriver,
    private readonly deviceId?: string
  ) {}

  async dialNumberViaIntent(phoneNumber: string): Promise<void> {
    const session = await this.driver.getSession();
    const caps = session.capabilities as Record<string, string>;
    const id = this.deviceId || caps['appium:udid'];
    if (id) {
      await adbShell(String(id), `am start -a android.intent.action.CALL -d tel:${phoneNumber}`);
    } else {
      await this.driver.execute('mobile: shell', {
        command: 'am',
        args: ['start', '-a', 'android.intent.action.CALL', '-d', `tel:${phoneNumber}`]
      });
    }
  }

  async makeCompleteCall(
    phoneNumber: string,
    targetDurationSeconds: number,
    maxAttempts = 1,
    cPartyNumber?: string
  ): Promise<CallResult> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await this.dialNumberViaIntent(phoneNumber);
      const conn = await this.waitForCallConnectionWithDuration(targetDurationSeconds, Boolean(cPartyNumber));
      if (conn.connected) {
        if (cPartyNumber) {
          await this.addPartyToConferenceSimple(cPartyNumber, targetDurationSeconds);
        }
        await this.endCall();
        return {
          phoneNumber,
          connected: true,
          targetDuration: targetDurationSeconds,
          actualDuration: conn.actualDuration,
          callStatus: 'CONNECTED',
          attemptNumber: attempt
        };
      }
      await this.endCall();
    }
    return {
      phoneNumber,
      connected: false,
      targetDuration: targetDurationSeconds,
      actualDuration: 0,
      callStatus: 'NOT_CONNECTED',
      attemptNumber: maxAttempts,
      failureReason: 'Call did not connect'
    };
  }

  async waitForCallConnectionWithDuration(
    targetDurationSeconds: number,
    _enableConference = false
  ): Promise<CallConnectionResult> {
    const start = Date.now();
    let connected = false;
    while (Date.now() - start < 20_000) {
      try {
        const timer = await this.driver.$('//android.widget.TextView[contains(@text, ":")]');
        if (await timer.isDisplayed()) {
          connected = true;
          break;
        }
      } catch {
        /* retry */
      }
      await this.driver.pause(500);
    }
    if (!connected) {
      return { connected: false, actualDuration: 0, failureReason: 'No timer' };
    }
    await this.driver.pause(targetDurationSeconds * 1000);
    return { connected: true, actualDuration: targetDurationSeconds };
  }

  async addPartyToConferenceSimple(cPartyNumber: string, _bPartyDuration: number): Promise<{ success: boolean }> {
    try {
      const addCall = await this.driver.$('//*[contains(@content-desc, "Add call")]');
      await addCall.click();
      await this.dialNumberViaIntent(cPartyNumber);
      await this.driver.pause(5000);
      const merge = await this.driver.$('//*[contains(@content-desc, "Merge")]');
      await merge.click();
      return { success: true };
    } catch {
      return { success: false };
    }
  }

  async endCall(): Promise<void> {
    for (const sel of getEndCallButtonOptions()) {
      try {
        const el = await this.driver.$(sel);
        if (await el.isDisplayed()) {
          await el.click();
          return;
        }
      } catch {
        /* try next */
      }
    }
    await this.driver.pressKeyCode(6);
  }
}
