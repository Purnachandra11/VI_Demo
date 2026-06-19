// src/utils/NetworkManager.ts
import { adbShell } from './adb';
import {
  NetworkType,
  NETWORK_MODE_MAP,
  NetworkChangeResult,
} from '../types/Network.types';

const SEP = '─'.repeat(72);

/**
 * RIL radio technology integers from Android source
 * Used in getRilVoiceRadioTechnology field
 */
const RIL_TECH: Record<number, string> = {
  0:  'UNKNOWN',
  1:  '2G',   // GPRS
  2:  '2G',   // EDGE
  3:  '3G',   // UMTS
  4:  '2G',   // IS95A (CDMA)
  5:  '2G',   // IS95B
  6:  '3G',   // 1xRTT
  7:  '3G',   // EVDO_0
  8:  '3G',   // EVDO_A
  9:  '3G',   // HSDPA
  10: '3G',   // HSUPA
  11: '3G',   // HSPA
  12: '3G',   // EVDO_B
  13: '4G',   // EHRPD
  14: '4G',   // LTE
  15: '3G',   // HSPAP
  16: '2G',   // GSM
  17: '3G',   // TD_SCDMA
  18: 'UNKNOWN', // IWLAN
  19: 'UNKNOWN', // LTE_CA (treated as 4G below)
  20: '5G',   // NR
};

export class NetworkManager {

  // ── Public API ──────────────────────────────────────────────────────────────

  static async setNetworkType(
    deviceId: string,
    target: NetworkType,
    options: { maxWaitSeconds?: number; retries?: number } = {},
  ): Promise<NetworkChangeResult> {
    const maxWait = options.maxWaitSeconds ?? 35;
    const retries = options.retries ?? 2;
    const start   = Date.now();

    console.log(`\n${SEP}`);
    console.log(`📡  NETWORK CHANGE  →  ${target}`);
    console.log(`    Device : ${deviceId}  (Unisoc)`);
    console.log(SEP);

    const before = await this.getCurrentNetworkType(deviceId);
    console.log(`    Current : ${before}`);

    if (this.isAcceptable(target, before)) {
      console.log(`      Already on ${before}`);
      console.log(SEP + '\n');
      return this.ok(target, before, 0, 'Already on target');
    }

    for (let attempt = 1; attempt <= retries; attempt++) {
      console.log(`\n    ── Attempt ${attempt}/${retries} ──`);

      await this.applyNetworkMode(deviceId, target);

      const { matched, actual } = await this.pollForNetwork(deviceId, target, maxWait);

      if (matched) {
        console.log(`      Confirmed: ${actual}  (${Math.round((Date.now() - start) / 1000)}s)`);
        console.log(SEP + '\n');
        return this.ok(target, actual, Date.now() - start, `Switched to ${actual}`);
      }

      console.log(`       Attempt ${attempt} ended on: ${actual}`);
      if (attempt < retries) await delay(4000);
    }

    const final  = await this.getCurrentNetworkType(deviceId);
    const reason = this.buildFailureReason(target, final);
    console.log(`      FAILED — ${reason}`);
    console.log(SEP + '\n');
    return this.fail(target, final, Date.now() - start, reason);
  }

  /**
   * Read current network type from Phone Id=0 service state.
   *
   * Parsing strategy (Unisoc / Vi India device confirmed):
   *   1. Check TelephonyDisplayInfo log for NR_NSA  → 5G
   *   2. Parse getRilVoiceRadioTechnology integer from mServiceState
   *   3. Cross-check with accessNetworkTechnology in CS domain block
   */
  static async getCurrentNetworkType(deviceId: string): Promise<string> {
    try {
      // ── Step 1: 5G NSA via TelephonyDisplayInfo ──────────────────────────
      // Only the most recent notifyDisplayInfoChanged entry matters
      const displayLog = await adbShell(
        deviceId,
        `dumpsys telephony.registry | grep "notifyDisplayInfoChanged.*PhoneId=0" | tail -1`,
      );
      if (displayLog.includes('NR_NSA') || displayLog.includes('NR_SA')) {
        return '5G';
      }

      // ── Step 2: Parse getRilVoiceRadioTechnology from current mServiceState ─
      // The "last known state" block (top of dump) is the current state.
      // We grab only the Phone Id=0 mServiceState line.
      const serviceState = await adbShell(
        deviceId,
        `dumpsys telephony.registry | grep "mServiceState=" | head -1`,
      );

      // Extract getRilVoiceRadioTechnology=NN
      const rilMatch = serviceState.match(/getRilVoiceRadioTechnology=(\d+)/);
      if (rilMatch) {
        const tech = parseInt(rilMatch[1], 10);
        // LTE_CA (19) → 4G
        if (tech === 19) return '4G';
        const mapped = RIL_TECH[tech];
        if (mapped && mapped !== 'UNKNOWN') return mapped;
      }

      // ── Step 3: Fallback — accessNetworkTechnology in CS domain ──────────
      const csBlock = await adbShell(
        deviceId,
        `dumpsys telephony.registry | grep "domain=CS.*accessNetworkTechnology" | head -1`,
      );
      if (csBlock.includes('accessNetworkTechnology=NR'))   return '5G';
      if (csBlock.includes('accessNetworkTechnology=LTE'))  return '4G';
      if (csBlock.includes('accessNetworkTechnology=UMTS') ||
          csBlock.includes('accessNetworkTechnology=HSDPA') ||
          csBlock.includes('accessNetworkTechnology=HSPA')) return '3G';
      if (csBlock.includes('accessNetworkTechnology=GSM') ||
          csBlock.includes('accessNetworkTechnology=GPRS') ||
          csBlock.includes('accessNetworkTechnology=EDGE')) return '2G';

      return 'UNKNOWN';
    } catch {
      return 'UNKNOWN';
    }
  }

  /**
   * Check VoLTE availability using LteVopsSupportInfo.
   *
   * From the real dump:
   *   mVopsSupport = 2  →  VoPS NOT supported → CSFB (no VoLTE)
   *   mVopsSupport = 3  →  VoPS supported     → VoLTE ready
   *
   * This is the correct indicator on Unisoc/Qualcomm devices.
   * The old IMS dumpsys approach does not work reliably here.
   */
  static async isVoLTEEnabled(deviceId: string): Promise<boolean> {
    try {
      // Look for VoPS=3 in the PS domain registration block (current state)
      // Use head -3 to get only the current state blocks, not log history
      const vops = await adbShell(
        deviceId,
        `dumpsys telephony.registry | grep "LteVopsSupportInfo" | head -5`,
      );

      // Any cell currently supporting VoPS=3 means VoLTE is available
      if (vops.includes('mVopsSupport = 3')) return true;

      // Fallback to settings
      const setting = (await adbShell(
        deviceId,
        `settings get global enhanced_4g_mode_enabled`,
      )).trim();
      return setting === '1';
    } catch {
      return false;
    }
  }

  /**
   * Force network re-registration.
   *
   * On Unisoc devices:
   *   `am broadcast -a android.intent.action.AIRPLANE_MODE`
   *   → SecurityException (Permission Denial, uid=2000)
   *
   * Use `cmd connectivity airplane-mode` instead.
   */
  static async forceReRegistration(deviceId: string): Promise<void> {
    console.log('    🔄  Re-registration via cmd connectivity…');

    // Try cmd connectivity first (works on Unisoc Android 12+)
    const enableOut = await adbShell(deviceId, `cmd connectivity airplane-mode enable`);
    await delay(3000);
    const disableOut = await adbShell(deviceId, `cmd connectivity airplane-mode disable`);

    const cmdWorked = !enableOut.toLowerCase().includes('error') &&
                      !disableOut.toLowerCase().includes('error') &&
                      !enableOut.toLowerCase().includes('unknown') &&
                      !disableOut.toLowerCase().includes('unknown');

    if (cmdWorked) {
      console.log('    ✓   cmd connectivity airplane-mode toggle done');
      return;
    }

    // Fallback: settings write only (no broadcast trigger)
    // The modem will pick up the settings change on next poll (~30s)
    console.log('       cmd connectivity unavailable — settings-only write (slower)');
    await adbShell(deviceId, `settings put global airplane_mode_on 1`);
    await delay(2000);
    await adbShell(deviceId, `settings put global airplane_mode_on 0`);
    console.log('    ✓   airplane_mode setting toggled (no broadcast)');
  }

  /**
   * Wait for stable network.
   */
  static async waitForStableNetwork(deviceId: string, timeoutSeconds: number): Promise<boolean> {
    console.log(`  ⏳  Waiting for stable network (max ${timeoutSeconds}s)…`);
    let last = '', stable = 0;
    for (let s = 0; s < timeoutSeconds; s++) {
      const cur = await this.getCurrentNetworkType(deviceId);
      if (cur === last && cur !== 'UNKNOWN') {
        if (++stable >= 3) {
          console.log(`    Stable: ${cur} after ${s + 1}s`);
          return true;
        }
      } else {
        stable = 0;
        last = cur;
      }
      await delay(1000);
    }
    console.log(`  ⏱️   Stability timeout after ${timeoutSeconds}s`);
    return false;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private static async applyNetworkMode(deviceId: string, target: NetworkType): Promise<void> {
    const mode = NETWORK_MODE_MAP[target];

    // Method 1: settings database
    await adbShell(deviceId, `settings put global preferred_network_mode ${mode}`);
    console.log(`    ✓   settings preferred_network_mode → ${mode}`);

    // Method 2: cmd phone (Android 12+ Unisoc)
    await adbShell(deviceId, `cmd phone set-preferred-network-type-for-slot 0 ${mode}`);
    console.log(`    ✓   cmd phone set-preferred-network-type-for-slot → ${mode}`);

    // Method 3: Unisoc-specific airplane toggle via cmd connectivity
    await this.forceReRegistration(deviceId);
  }

  private static async pollForNetwork(
    deviceId: string,
    target: NetworkType,
    maxWait: number,
  ): Promise<{ matched: boolean; actual: string }> {
    let stable = 0, last = '';
    console.log(`    ⏳  Polling for ${target} (max ${maxWait}s)…`);
    for (let s = 1; s <= maxWait; s++) {
      await delay(1000);
      const cur = await this.getCurrentNetworkType(deviceId);
      if (s % 5 === 0) console.log(`         ${s}/${maxWait}s → ${cur}`);
      if (this.isAcceptable(target, cur)) {
        if (++stable >= 3) return { matched: true, actual: cur };
      } else {
        if (cur !== last) console.log(`         changed: ${last || 'N/A'} → ${cur}`);
        stable = 0;
        last = cur;
      }
    }
    return { matched: false, actual: await this.getCurrentNetworkType(deviceId) };
  }

  private static isAcceptable(target: NetworkType, actual: string): boolean {
    const t = target.toUpperCase(), a = actual.toUpperCase();
    if (t === a) return true;
    if (t === '5G'   && a === '4G') return true;
    if (t === 'AUTO' && (a === '5G' || a === '4G')) return true;
    return false;
  }

  private static buildFailureReason(target: NetworkType, actual: string): string {
    const t = target.toUpperCase(), a = actual.toUpperCase();
    if (t === '3G' && (a === '4G' || a === '5G'))
      return `3G not available — device on ${actual}. Vi India has no 3G; Airtel/Vi may have limited 3G. Test skipped.`;
    if (t === '2G' && a !== '2G')
      return `2G switch attempted but device stayed on ${actual}. Unisoc modem requires airplane toggle to honour mode 1. Test skipped.`;
    if (t === '4G' && a !== '4G')
      return `Failed to lock to 4G. Current: ${actual}. Test skipped.`;
    return `Network change to ${target} failed. Device on ${actual}. Test skipped.`;
  }

  private static ok(t: NetworkType, a: string, ms: number, r: string): NetworkChangeResult {
    return { success: true,  targetNetwork: t, actualNetwork: a, matched: true,  timeTakenMs: ms, reason: r };
  }

  private static fail(t: NetworkType, a: string, ms: number, r: string): NetworkChangeResult {
    return { success: false, targetNetwork: t, actualNetwork: a, matched: false, timeTakenMs: ms, reason: r };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}