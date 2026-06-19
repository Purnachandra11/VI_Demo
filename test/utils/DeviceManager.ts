import { ADBHelper } from './ADBHelper';
import { getRunContext } from './env';

const numberToDevice = new Map<string, string>();
let aPartyDeviceId = '';

/**  DeviceManager */
export class DeviceManager {
  static async initializeDevices(
    aDevice?: string | null,
    aNumber?: string | null,
    bDevice?: string | null,
    bNumber?: string | null
  ): Promise<void> {
    const ctx = getRunContext();
    const aDev = aDevice ?? ctx.aPartyDevice;
    const aNum = aNumber ?? ctx.aPartyNumber;
    const bDev = bDevice ?? ctx.bPartyDevice;
    const bNum = bNumber ?? ctx.bPartyNumber;

    numberToDevice.clear();
    aPartyDeviceId = aDev;

    if (aNum && aDev) numberToDevice.set(clean(aNum), aDev);
    if (bNum && bDev) numberToDevice.set(clean(bNum), bDev);

    console.log('[DeviceManager] Initialized device map');
  }

  static getDeviceIdForNumber(number: string): string | undefined {
    return numberToDevice.get(clean(number));
  }

  static getAPartyDeviceId(): string {
    return aPartyDeviceId;
  }

  static async isDeviceConnected(deviceId: string): Promise<boolean> {
    return ADBHelper.isDeviceConnected(deviceId);
  }

  static printDeviceStatus(): void {
    console.log('\n Device Manager Status:');
    for (const [num, dev] of numberToDevice) {
      console.log(`   ${num} → ${dev}`);
    }
    if (!numberToDevice.size) console.log('   (no mappings)');
  }

  static async setupAutoAnswer(bPartyDeviceId: string, _expectedCaller: string): Promise<void> {
    if (!bPartyDeviceId) return;
    console.log(`[DeviceManager] Auto-answer armed on ${bPartyDeviceId}`);
    try {
      const { adbShell } = await import('./adb');
      await adbShell(bPartyDeviceId, 'input keyevent 5');
    } catch (e) {
      console.warn(`[DeviceManager] Auto-answer prep: ${(e as Error).message}`);
    }
  }

  static async stopAutoAnswer(bPartyDeviceId: string): Promise<void> {
    if (!bPartyDeviceId) return;
    try {
      const { adbShell } = await import('./adb');
      await adbShell(bPartyDeviceId, 'input keyevent 6');
    } catch {
      /* ignore */
    }
  }
}

function clean(num: string): string {
  const d = num.replace(/[^0-9]/g, '');
  return d.length >= 10 ? d.slice(-10) : d;
}
