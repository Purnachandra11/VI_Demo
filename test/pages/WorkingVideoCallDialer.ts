import type { AndroidDriver } from '../types/driver';
import { adbShell } from '../utils/adb';
import { getEndCallButtonOptions } from '../config/ElementConfig';

export interface VideoCallResult {
  phoneNumber: string;
  connected: boolean;
  targetDuration: number;
  actualDuration: number;
  callStatus: string;
  attemptNumber: number;
  ringTime?: number;
  videoQuality?: string;
  failureReason?: string;
}

/**  WorkingVideoCallDialer — video intent + timer detection */
export class WorkingVideoCallDialer {
  constructor(
    private readonly driver: AndroidDriver,
    private readonly deviceId?: string
  ) {}

  async makeVideoCall(
    phoneNumber: string,
    targetDurationSeconds: number,
    maxAttempts = 1
  ): Promise<VideoCallResult> {
    const result: VideoCallResult = {
      phoneNumber,
      connected: false,
      targetDuration: targetDurationSeconds,
      actualDuration: 0,
      callStatus: 'NOT_CONNECTED',
      attemptNumber: 0
    };

    console.log('\n' + '='.repeat(80));
    console.log('INITIATING VIDEO CALL');
    console.log(`Number: ${phoneNumber} | Target: ${targetDurationSeconds}s`);
    console.log('='.repeat(80));

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      result.attemptNumber = attempt;
      console.log(`\nAttempt ${attempt}/${maxAttempts}`);

      const initiated = await this.dialVideoCallIntent(phoneNumber);
      if (!initiated) {
        result.callStatus = 'FAILED_TO_INITIATE';
        continue;
      }

      const conn = await this.waitForVideoConnection(targetDurationSeconds);
      result.ringTime = conn.ringTimeSec;

      if (conn.connected) {
        result.connected = true;
        result.actualDuration = conn.actualDuration;
        result.callStatus = 'CONNECTED';
        result.videoQuality = conn.videoQuality;
        await this.endVideoCall();
        break;
      }

      result.callStatus = conn.failureReason || 'TIMEOUT';
      result.failureReason = conn.failureReason;
      await this.endVideoCall().catch(() => {});

      if (attempt < maxAttempts) {
        await this.driver.pause(5000);
      }
    }

    return result;
  }

  private async dialVideoCallIntent(phoneNumber: string): Promise<boolean> {
    try {
      const id = this.deviceId || String((this.driver.capabilities as Record<string, string>)['appium:udid']);
      const cmd =
        `am start -a android.intent.action.CALL -d tel:${phoneNumber} --ei android.telecom.extra.START_CALL_WITH_VIDEO_STATE 3`;
      await adbShell(id, cmd);
      await this.driver.pause(2000);

      const src = await this.driver.getPageSource();
      return (
        /video|camera|calling|dialing|00:/i.test(src) ||
        /end call|mute|speaker/i.test(src)
      );
    } catch (e) {
      console.error(`Video call intent failed: ${(e as Error).message}`);
      return false;
    }
  }

  private async waitForVideoConnection(targetDurationSeconds: number): Promise<{
    connected: boolean;
    actualDuration: number;
    ringTimeSec: number;
    videoQuality: string;
    failureReason?: string;
  }> {
    const ringStart = Date.now();
    let connected = false;

    while (Date.now() - ringStart < 30_000) {
      try {
        const timer = await this.driver.$('//android.widget.TextView[contains(@text, ":")]');
        if (await timer.isDisplayed()) {
          const text = await timer.getText();
          if (/^\d{1,2}:\d{2}$/.test(text) || text.startsWith('00:')) {
            connected = true;
            break;
          }
        }
      } catch {
        /* retry */
      }
      await this.driver.pause(500);
    }

    const ringTimeSec = (Date.now() - ringStart) / 1000;

    if (!connected) {
      return {
        connected: false,
        actualDuration: 0,
        ringTimeSec,
        videoQuality: 'N/A',
        failureReason: 'TIMEOUT'
      };
    }

    const holdStart = Date.now();
    await this.driver.pause(targetDurationSeconds * 1000);

    return {
      connected: true,
      actualDuration: (Date.now() - holdStart) / 1000,
      ringTimeSec,
      videoQuality: 'STANDARD'
    };
  }

  private async endVideoCall(): Promise<void> {
    for (const sel of getEndCallButtonOptions()) {
      try {
        const el = await this.driver.$(sel);
        if (await el.isDisplayed()) {
          await el.click();
          return;
        }
      } catch {
        /* next */
      }
    }
    await this.driver.pressKeyCode(6);
  }
}
