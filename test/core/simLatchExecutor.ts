import { adbShell } from '../utils/adb';
import { reportSIMLatchProgress } from '../utils/progressReporter';
import { getRunContext } from '../utils/env';
import { addSimLatchResult } from '../reporting/resultStore';

//  Constants ─
const FAST_LATCH_THRESHOLD_MS     = 30_000;   // ≤30s = PASS
const MARGINAL_LATCH_THRESHOLD_MS = 60_000;   // ≤60s = MARGINAL
const BETWEEN_ATTEMPT_DELAY_MS    = 5_000;
const FLIGHT_MODE_SETTLE_MS       = 5_000;
const POLL_INTERVAL_MS            = 2_000;

//  Types 

export interface SIMLatchResult {
  success: boolean;
  latchTimeMs: number;
  finalStatus: string;
}

export interface SIMLatchOptions {
  testName?: string;
  preferredNetwork?: string;
  timeoutSec?: number;
  attempts?: number;
  deviceId?: string;
}

interface NetworkState {
  state: string;
  rat: string;
}

//  Helpers 

async function isDeviceConnected(deviceId: string): Promise<boolean> {
  try {
    return (await adbShell(deviceId, 'echo ok')).trim() === 'ok';
  } catch {
    return false;
  }
}

/**  SIMAutoLatchMonitor.getNetworkState() */
async function getNetworkState(deviceId: string): Promise<NetworkState> {
  try {
    const serviceState = await adbShell(deviceId, 'dumpsys telephony.registry | grep -i servicestate');
    const state        = parseServiceState(serviceState);
    const rat          = await adbShell(deviceId, 'getprop gsm.network.type');
    return { state, rat: rat.trim() || 'UNKNOWN' };
  } catch {
    return { state: 'UNKNOWN', rat: 'UNKNOWN' };
  }
}

function parseServiceState(output: string): string {
  if (output.includes('IN_SERVICE') || output.includes('HOME')) return 'IN_SERVICE';
  if (output.includes('OUT_OF_SERVICE'))                         return 'OUT_OF_SERVICE';
  if (output.includes('EMERGENCY'))                             return 'EMERGENCY_ONLY';
  return 'UNKNOWN';
}

function isRegistered(state: string): boolean {
  return state === 'IN_SERVICE';
}

/**  setNetworkType() */
async function setNetworkType(deviceId: string, type: string): Promise<void> {
  const modeMap: Record<string, number> = {
    '2G': 1, '3G': 3, '4G': 11, 'LTE': 11, '5G': 33,
  };
  const mode = modeMap[type.toUpperCase()] ?? 33;

  const cmds = [
    `settings put global preferred_network_mode ${mode}`,
    `settings put global preferred_network_mode1 ${mode}`,
    `cmd phone set-preferred-network-type-for-slot -s 0 ${mode}`,
  ];

  for (const cmd of cmds) {
    try { await adbShell(deviceId, cmd); } catch { /* per-slot may fail */ }
  }
}

/**  setFlightMode() */
async function setFlightMode(deviceId: string, enabled: boolean): Promise<void> {
  const val  = enabled ? '1' : '0';
  const bool = enabled ? 'true' : 'false';
  await adbShell(deviceId, `settings put global airplane_mode_on ${val}`);
  await adbShell(deviceId, `am broadcast -a android.intent.action.AIRPLANE_MODE --ez state ${bool}`);
}

function latchStatus(ms: number): string {
  if (ms <= FAST_LATCH_THRESHOLD_MS)     return 'PASS';
  if (ms <= MARGINAL_LATCH_THRESHOLD_MS) return 'MARGINAL';
  return 'SLOW';
}

//  Main executor 

export async function executeSIMLatch(options: SIMLatchOptions = {}): Promise<SIMLatchResult> {
  const ctx              = getRunContext();
  const deviceId         = options.deviceId || ctx.aPartyDevice;
  const preferredNetwork = options.preferredNetwork || ctx.networkType || '4G';
  const timeoutSec     = options.timeoutSec  || 120;
  const maxAttempts    = options.attempts    || 1;

  console.log(`\n${'='.repeat(80)}`);
  console.log('📡 SIM AUTO-LATCH TEST');
  console.log(`   Device  : ${deviceId}`);
  console.log(`   Network : ${preferredNetwork}`);
  console.log(`   Timeout : ${timeoutSec}s | Attempts: ${maxAttempts}`);
  console.log('='.repeat(80));

  //  Device connectivity guard ( isDeviceAvailable()) ─
  if (!await isDeviceConnected(deviceId)) {
    console.log(`❌ Device not available: ${deviceId}`);
    return { success: false, latchTimeMs: 0, finalStatus: 'DEVICE_DISCONNECTED' };
  }

  //  Network type setup ( "if not AUTO") 
  if (preferredNetwork !== 'AUTO') {
    console.log(`📡 Setting network to: ${preferredNetwork}`);
    await setNetworkType(deviceId, preferredNetwork);
    await new Promise(r => setTimeout(r, 5000));
  }

  let bestLatchTime = Infinity;
  let finalResult: SIMLatchResult = { success: false, latchTimeMs: 0, finalStatus: 'FAIL' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`\n🔄 Attempt ${attempt}/${maxAttempts}`);
    await reportSIMLatchProgress(deviceId, `Attempt ${attempt}/${maxAttempts}`, 'IN_PROGRESS', (attempt / maxAttempts) * 10);

    try {
      // 1. Capture initial state
      const initialState = await getNetworkState(deviceId);
      console.log(`[SIMLatch] Initial State: ${initialState.state} (${initialState.rat})`);

      // 2. Enable flight mode
      await reportSIMLatchProgress(deviceId, 'Enabling Flight Mode', 'IN_PROGRESS', 20);
      await setFlightMode(deviceId, true);
      await new Promise(r => setTimeout(r, FLIGHT_MODE_SETTLE_MS));

      // 3. Disable flight mode and start timer
      await reportSIMLatchProgress(deviceId, 'Disabling Flight Mode', 'IN_PROGRESS', 30);
      const startTime = Date.now();
      await setFlightMode(deviceId, false);

      // 4. Poll for registration
      let registered = false;
      let latchTimeMs = 0;
      let finalState  = initialState;

      const maxTicks = Math.ceil((timeoutSec * 1000) / POLL_INTERVAL_MS);

      for (let tick = 0; tick < maxTicks; tick++) {
        const currentState = await getNetworkState(deviceId);

        if (isRegistered(currentState.state)) {
          latchTimeMs  = Date.now() - startTime;
          registered   = true;
          finalState   = currentState;
          break;
        }

        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        const progress = 30 + (tick / maxTicks) * 60;
        await reportSIMLatchProgress(deviceId, `Monitoring: ${currentState.state}`, 'IN_PROGRESS', progress);
      }

      if (registered) {
        const status = latchStatus(latchTimeMs);
        console.log(` Registered in ${latchTimeMs}ms → ${status}`);
        console.log(`   Final State: ${finalState.state} (${finalState.rat})`);

        if (latchTimeMs < bestLatchTime) {
          bestLatchTime = latchTimeMs;
          finalResult   = { success: true, latchTimeMs, finalStatus: status };
        }

        addSimLatchResult({
          name: options.testName || `SIM Latch ${preferredNetwork}`,
          preferredNetwork,
          autoLatchTimeMs: latchTimeMs,
          autoLatchTimeSeconds: latchTimeMs / 1000,
          initialNetworkState: initialState.state,
          initialRAT: initialState.rat,
          finalNetworkState: finalState.state,
          finalRAT: finalState.rat,
          finalStatus: status,
          testTimestamp: new Date().toISOString(),
          comments: `Attempt ${attempt}: ${latchTimeMs}ms`
        });

        // Stop early if fast enough ( break logic)
        if (latchTimeMs <= FAST_LATCH_THRESHOLD_MS) {
          console.log(' Fast latch achieved — stopping attempts');
          break;
        }
      } else {
        console.log(`❌ Attempt ${attempt} timed out after ${timeoutSec}s`);

        addSimLatchResult({
          name: options.testName || `SIM Latch ${preferredNetwork}`,
          preferredNetwork,
          autoLatchTimeMs: 0,
          autoLatchTimeSeconds: 0,
          initialNetworkState: initialState.state,
          initialRAT: initialState.rat,
          finalNetworkState: 'TIMEOUT',
          finalRAT: 'UNKNOWN',
          finalStatus: 'FAIL',
          testTimestamp: new Date().toISOString(),
          comments: `Attempt ${attempt}: Timed out after ${timeoutSec}s`
        });
      }
    } catch (e) {
      console.error(`❌ Attempt ${attempt} failed: ${(e as Error).message}`);
    }

    if (attempt < maxAttempts) {
      console.log(`⏳ Waiting ${BETWEEN_ATTEMPT_DELAY_MS / 1000}s before next attempt...`);
      await new Promise(r => setTimeout(r, BETWEEN_ATTEMPT_DELAY_MS));
    }
  }

  await reportSIMLatchProgress(deviceId, 'Test Completed', 'TEST_COMPLETE', 100);

  const emoji = finalResult.success ? '' : '❌';
  console.log(`\n${emoji} SIM Latch Final: ${finalResult.finalStatus} (${finalResult.latchTimeMs}ms)`);

  return finalResult;
}

//  Excel batch executor ( SIMAutoLatchTestExecutor) 

export type SIMAutoLatchTestResult = Record<string, unknown>;

export class SIMAutoLatchTestExecutor {
  constructor(
    private readonly aPartyDeviceId: string,
    private readonly bPartyDeviceId: string,
    private readonly aPartyNumber: string,
    private readonly bPartyNumber: string
  ) {}

  async executeAllSIMAutoLatchTests(excelFilePath: string): Promise<SIMAutoLatchTestResult[]> {
    const { readSIMLatchRows } = await import('../utils/excelReader');
    const { flushReports } = await import('../reporting');
    const { ProgressReporter } = await import('../utils/progressReporter');

    const rows = await readSIMLatchRows(excelFilePath);
    const results: SIMAutoLatchTestResult[] = [];

    if (!rows.length) {
      console.log('❌ No SIM auto-latch test data found');
      return results;
    }

    await ProgressReporter.initializeTestSuite(
      this.aPartyDeviceId,
      rows.length * (this.bPartyDeviceId ? 2 : 1)
    );

    for (const row of rows) {
      const deviceIds = [
        { id: this.aPartyDeviceId, number: this.aPartyNumber, label: 'A-PARTY' },
        ...(this.bPartyDeviceId
          ? [{ id: this.bPartyDeviceId, number: this.bPartyNumber, label: 'B-PARTY' }]
          : [])
      ];

      for (const dev of deviceIds) {
        const latchResult = await executeSIMLatch({
          testName: `${row.scenario} (${dev.label})`,
          preferredNetwork: row.preferredNetwork,
          timeoutSec: row.timeoutSec,
          attempts: row.attempts,
          deviceId: dev.id
        });

        results.push({
          testResult: latchResult.finalStatus,
          deviceId: dev.id,
          partyNumber: dev.number,
          deviceType: dev.label,
          timeoutSeconds: row.timeoutSec,
          autoLatchTimeMs: latchResult.latchTimeMs,
          autoLatchTimeSeconds: latchResult.latchTimeMs / 1000,
          finalStatus: latchResult.finalStatus,
          comments: latchResult.finalStatus,
          testTimestamp: new Date().toISOString()
        });
      }
    }

    try {
      await flushReports();
    } catch (e) {
      console.warn('[SIM Latch] Report flush:', (e as Error).message);
    }

    return results;
  }
}