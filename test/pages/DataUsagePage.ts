import type { AndroidDriver } from '../types/driver';
import { adbShell } from '../utils/adb';
import { reportDataProgress } from '../utils/progressReporter';

const MOBILE_IFACES = ['ccmni1', 'ccmni0', 'rmnet_data0', 'rmnet_data1', 'rmnet0'];

export interface DataScenarioResult {
  success: boolean;
  consumedBytes: number;
  consumedMB: number;
  consumedGB: number;
  consumedRxMB?: number;
  consumedTxMB?: number;
  status: string;
  targetAchieved: boolean;
  dataSource?: string;
}

/**  DataUsagePage — Chrome download + /proc/net/dev measurement */
export class DataUsagePage {
  constructor(
    private readonly _driver: AndroidDriver,
    private readonly deviceId: string
  ) {}

  async executeDataUsageScenario(
    scenario: string,
    targetGB: number,
    durationMin: number,
    apps: string,
    phoneNumber?: string
  ): Promise<DataScenarioResult> {
    console.log(`Executing: ${scenario}`);
    console.log(`   Target: ${targetGB} GB in ${durationMin} min | Apps: ${apps}`);

    const downloadUrl = this.getDownloadUrlForTarget(targetGB);
    const targetMB = Math.round(targetGB * 1024);

    try {
      return await this.executeTestFlow(downloadUrl, targetMB, durationMin, targetGB, phoneNumber);
    } catch (e) {
      console.error(`Data scenario failed: ${(e as Error).message}`);
      return {
        success: false,
        consumedBytes: 0,
        consumedMB: 0,
        consumedGB: 0,
        status: 'FAILED',
        targetAchieved: false
      };
    }
  }

  private getDownloadUrlForTarget(targetGB: number): string {
    if (targetGB <= 0.05) return 'https://speedtest.tele2.net/1MB.zip';
    if (targetGB <= 0.15) return 'https://speedtest.tele2.net/10MB.zip';
    if (targetGB <= 0.5) return 'https://speedtest.tele2.net/100MB.zip';
    return 'https://speedtest.tele2.net/1GB.zip';
  }

  private async getActiveInterface(): Promise<string> {
    for (const iface of MOBILE_IFACES) {
      try {
        const out = await adbShell(this.deviceId, 'cat /proc/net/dev');
        if (out.includes(`${iface}:`)) return iface;
      } catch {
        /* next */
      }
    }
    return 'ccmni1';
  }

  private async getRxTxBytes(iface: string): Promise<{ rx: number; tx: number }> {
    const output = await adbShell(this.deviceId, 'cat /proc/net/dev');
    const line = output.split('\n').find(l => l.includes(`${iface}:`));
    if (!line) return { rx: 0, tx: 0 };
    const parts = line.trim().split(/\s+/);
    const rx = parseInt(parts[1], 10);
    const tx = parseInt(parts[9], 10);
    return { rx: isNaN(rx) ? 0 : rx, tx: isNaN(tx) ? 0 : tx };
  }

  private async executeTestFlow(
    downloadUrl: string,
    _targetMB: number,
    durationMin: number,
    targetGB: number,
    phoneNumber?: string
  ): Promise<DataScenarioResult> {
    const iface = await this.getActiveInterface();
    const initial = await this.getRxTxBytes(iface);

    console.log(`   Interface: ${iface} | Initial RX=${initial.rx} TX=${initial.tx}`);

    await adbShell(this.deviceId, 'am force-stop com.android.chrome').catch(() => {});
    await adbShell(this.deviceId, `am start -a android.intent.action.VIEW -d "${downloadUrl}"`);
    await new Promise(r => setTimeout(r, 3000));

    const totalSec = durationMin * 60;
    for (let elapsed = 0; elapsed < totalSec; elapsed += 10) {
      const pct = 40 + (elapsed / totalSec) * 35;
      await reportDataProgress(
        this.deviceId,
        phoneNumber || '',
        'DATA_DOWNLOAD',
        `Downloading (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`,
        pct
      );
      await new Promise(r => setTimeout(r, 10_000));
    }

    await adbShell(this.deviceId, 'am force-stop com.android.chrome').catch(() => {});

    const final = await this.getRxTxBytes(iface);
    const consumedRx = Math.max(0, final.rx - initial.rx);
    const consumedTx = Math.max(0, final.tx - initial.tx);
    const consumedBytes = consumedRx + consumedTx;
    const consumedMB = consumedBytes / (1024 * 1024);
    const consumedGB = consumedMB / 1024;
    const targetAchieved = consumedGB >= targetGB * 0.8;
    const status = targetAchieved ? 'SUCCESS' : consumedMB > 0 ? 'PARTIAL_SUCCESS' : 'FAIL';

    console.log(`   Consumed: ${consumedMB.toFixed(2)} MB (RX ${(consumedRx / 1048576).toFixed(2)} / TX ${(consumedTx / 1048576).toFixed(2)})`);

    return {
      success: targetAchieved,
      consumedBytes,
      consumedMB,
      consumedGB,
      consumedRxMB: consumedRx / (1024 * 1024),
      consumedTxMB: consumedTx / (1024 * 1024),
      status,
      targetAchieved,
      dataSource: iface
    };
  }
}
