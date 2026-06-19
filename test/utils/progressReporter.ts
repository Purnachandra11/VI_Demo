const endpoint =
  process.env.PROGRESS_ENDPOINT || 'http://localhost:5174/api/progress/update';

export async function reportProgress(payload: Record<string, unknown>): Promise<void> {
  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log(`[INFO] WS_PROGRESS:${JSON.stringify(payload)}`);
  } catch (err) {
    console.warn('Progress report failed:', (err as Error).message);
  }
}

export async function reportCallingProgress(
  deviceId: string,
  phoneNumber: string,
  action: string,
  status: string,
  duration: number,
  percentage: number
): Promise<void> {
  await reportProgress({
    deviceId,
    testType: 'calling',
    timestamp: Date.now(),
    completed: status === 'COMPLETED',
    progress: {
      phoneNumber,
      action,
      status,
      duration,
      percentage,
      progressBar: createBar(percentage, 20)
    }
  });
}

export async function reportSMSProgress(
  deviceId: string,
  phoneNumber: string,
  action: string,
  status: string,
  percentage: number
): Promise<void> {
  await reportProgress({
    deviceId,
    testType: 'sms',
    timestamp: Date.now(),
    completed: status === 'COMPLETED' || status === 'TEST_COMPLETE',
    progress: {
      phoneNumber,
      action,
      status,
      percentage,
      progressBar: createBar(percentage, 20)
    }
  });
}

export async function reportDataProgress(
  deviceId: string,
  phoneNumber: string,
  action: string,
  status: string,
  percentage: number
): Promise<void> {
  await reportProgress({
    deviceId,
    testType: 'data',
    timestamp: Date.now(),
    completed: status === 'COMPLETED' || status === 'TEST_COMPLETE',
    progress: {
      phoneNumber,
      action,
      status,
      percentage,
      progressBar: createBar(percentage, 20)
    }
  });
}

export async function reportSIMLatchProgress(
  deviceId: string,
  action: string,
  status: string,
  percentage: number
): Promise<void> {
  await reportProgress({
    deviceId,
    testType: 'sim-latch',
    timestamp: Date.now(),
    completed: status === 'COMPLETED' || status === 'TEST_COMPLETE',
    progress: {
      action,
      status,
      percentage,
      progressBar: createBar(percentage, 20)
    }
  });
}

function createBar(percent: number, width: number): string {
  const filled = Math.round((percent / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

/** Class facade for specs —  ProgressReporter static methods */
export class ProgressReporter {
  static reportProgress = reportProgress;
  static reportCallingProgress = reportCallingProgress;
  static reportSMSProgress = reportSMSProgress;
  static reportDataProgress = reportDataProgress;
  static reportSIMLatchProgress = reportSIMLatchProgress;

  static async initializeTestSuite(deviceId: string, totalTestCount: number): Promise<void> {
    await reportProgress({
      deviceId,
      testType: 'suite',
      timestamp: Date.now(),
      completed: false,
      progress: { action: 'SUITE_START', totalTestCount, percentage: 0 }
    });
  }

  static async reportTestComplete(
    deviceId: string,
    testType: string,
    success: boolean,
    message: string
  ): Promise<void> {
    await reportProgress({
      deviceId,
      testType,
      timestamp: Date.now(),
      completed: true,
      progress: {
        action: 'TEST_COMPLETE',
        status: success ? 'SUCCESS' : 'FAILED',
        message,
        percentage: 100
      }
    });
  }

  static async resetTestSuite(deviceId: string): Promise<void> {
    await reportProgress({
      deviceId,
      testType: 'suite',
      timestamp: Date.now(),
      completed: false,
      progress: { action: 'SUITE_RESET', percentage: 0 }
    });
  }
}
