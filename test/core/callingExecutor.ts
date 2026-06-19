import type { AndroidDriver } from '../types/driver';
import { readCallingRows } from '../utils/excelReader';
import { executeCall, CallOptions } from './callExecutor';
import { getRunContext } from '../utils/env';
import { ProgressReporter } from '../utils/progressReporter';
import { ADBHelper } from '../utils/ADBHelper';
import { flushReports } from '../reporting';

export type CallingTestResult = Record<string, unknown>;

/**  CompleteCallingTestExecutor — Excel-driven calling suite */
export class CompleteCallingTestExecutor {
  private readonly deviceId: string;

  constructor(_driver: AndroidDriver, aPartyDeviceId: string) {
    this.deviceId = aPartyDeviceId;
  }

  async executeAllCallingTests(excelFilePath: string): Promise<CallingTestResult[]> {
    const ctx = getRunContext();
    const rows = await readCallingRows(excelFilePath);
    const results: CallingTestResult[] = [];

    if (!rows.length) {
      console.log(' No calling test data found');
      return results;
    }

    await ProgressReporter.initializeTestSuite(this.deviceId, rows.length);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      console.log(`\n📞 TEST ${i + 1}/${rows.length}: ${row.name}`);

      const options: CallOptions = {
        testName: row.name,
        callType: (row.callType?.toUpperCase() || 'VOICE') as CallOptions['callType'],
        direction: (row.direction?.toUpperCase() || 'OUTGOING') as CallOptions['direction'],
        duration: row.duration,
        attempts: row.attempts,
        preferredNetwork: row.preferredNetwork,
        aPartyNumber: row.aPartyNumber || ctx.aPartyNumber,
        bPartyNumber: row.bPartyNumber,
        cPartyNumber: row.cPartyNumber,
        bPartyDevice: ctx.bPartyDevice,
        volteSupported: row.volteSupported
      };

      if (row.preferredNetwork && row.preferredNetwork !== 'AUTO') {
        await this.setNetworkType(this.deviceId, row.preferredNetwork);
        await new Promise((r) => setTimeout(r, 3000));
      }

      const callResult = await executeCall({
        ...options,
        attempts: row.attempts || options.attempts || 1
      });

      results.push({
        name: row.name,
        callType: row.callType,
        direction: row.direction,
        preferredNetwork: row.preferredNetwork,
        callerNumber: options.aPartyNumber,
        receiverNumber: row.bPartyNumber,
        finalStatus: callResult.finalStatus,
        actualDuration: callResult.activeSec,
        ringTime: callResult.ringingSec,
        connected: callResult.connected,
        attemptNumber: row.attempts,
        volteSupported: row.volteSupported,
        testTimestamp: new Date().toISOString()
      });

      await new Promise((r) => setTimeout(r, 3000));
    }

    try {
      await flushReports();
    } catch (e) {
      console.warn('[Calling] Report flush:', (e as Error).message);
    }

    await ProgressReporter.reportTestComplete(
      this.deviceId,
      'calling',
      results.every((r) => r.finalStatus === 'SUCCESS'),
      `Completed ${results.length} calling tests`
    );

    return results;
  }

  private async setNetworkType(deviceId: string, type: string): Promise<void> {
    const modeMap: Record<string, number> = {
      '2G': 1,
      '3G': 3,
      '4G': 11,
      LTE: 11,
      '5G': 33
    };
    const mode = modeMap[type.toUpperCase()] ?? 33;
    for (const cmd of [
      `settings put global preferred_network_mode ${mode}`,
      `cmd phone set-preferred-network-type-for-slot -s 0 ${mode}`
    ]) {
      await ADBHelper.adbShell(deviceId, cmd).catch(() => {});
    }
  }
}

export { executeCall, executeOutgoingCall, executeIncomingCall } from './callExecutor';
export type { CallResult, CallOptions } from './callExecutor';
