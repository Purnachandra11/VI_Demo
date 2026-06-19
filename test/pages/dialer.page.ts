import { endCallKey, startCall } from '../utils/adb';

export class DialerPage {
  constructor(
    private readonly deviceId: string,
    private readonly receiveDeviceId?: string
  ) {}

  async dial(number: string): Promise<void> {
    await startCall(this.deviceId, number);
  }

  async waitForCallTimer(timeoutMs = 20000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const el = await $('//android.widget.TextView[contains(@text, ":")]');
        const text = await el.getText();
        if (/^\d{1,2}:\d{2}$/.test(text)) return true;
      } catch {
        /* retry */
      }
      await browser.pause(500);
    }
    return false;
  }

  async holdActiveCall(durationSec: number): Promise<void> {
    await browser.pause(durationSec * 1000);
  }

  async endCall(): Promise<void> {
    try {
      await browser.pressKeyCode(6);
    } catch {
      await endCallKey(this.deviceId);
    }
  }

  async answerOnBParty(): Promise<void> {
    if (!this.receiveDeviceId) return;
    const answerKeywords = ['answer', 'accept', 'receive', 'उत्तर', 'स्वीकार'];
    const buttons = await $$(
      '//android.widget.Button | //android.widget.TextView | //android.widget.ImageButton'
    );
    for (const el of buttons) {
      const text = ((await el.getText()) || '').toLowerCase();
      if (answerKeywords.some((k) => text.includes(k))) {
        await el.click();
        return;
      }
    }
    await browser.pressKeyCode(5);
  }
}
