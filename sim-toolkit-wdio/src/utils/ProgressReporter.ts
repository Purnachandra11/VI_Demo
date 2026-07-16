// TypeScript port of com.telecom.utils.ProgressReporter
import axios from 'axios';

const PROGRESS_ENDPOINT = 'http://localhost:5174/api/progress/update';

// Track completion status per device and test type (module-level state,
// mirroring the Java class's static ConcurrentHashMaps)
const completedTests = new Map<string, number>();
const totalTests = new Map<string, number>();

function createProgressBar(progress: number, length: number): string {
    const filled = Math.min(Math.floor((progress / 100) * length), length);
    return '█'.repeat(filled) + '░'.repeat(length - filled);
}

async function sendProgress(progressData: Record<string, unknown>): Promise<void> {
    try {
        await axios.post(PROGRESS_ENDPOINT, progressData, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 5000
        });
    } catch (e) {
        // Silently fail - don't disrupt test execution
        console.error('Progress update failed:', (e as Error).message);
    }
}

function withSuiteProgress(deviceId: string, details: Record<string, unknown>): void {
    const suiteKey = `${deviceId}-suite`;
    if (totalTests.has(suiteKey)) {
        const completed = completedTests.get(suiteKey) ?? 0;
        const total = totalTests.get(suiteKey)!;
        details.suiteProgress = (completed * 100.0) / total;
        details.completedTests = completed;
        details.totalTests = total;
    }
}

export async function reportDataProgress(
    deviceId: string,
    testType: string,
    elapsedSec: number,
    totalSec: number,
    downloadedMB: number,
    interfaceName: string
): Promise<void> {
    try {
        const progress = (elapsedSec * 100.0) / totalSec;

        const details: Record<string, unknown> = {
            elapsedSec,
            totalSec,
            downloadedMB,
            progress,
            interface: interfaceName,
            progressBar: createProgressBar(progress, 20)
        };
        withSuiteProgress(deviceId, details);

        const progressData = {
            deviceId,
            testType: 'data',
            timestamp: Date.now(),
            completed: false,
            progress: details
        };

        await sendProgress(progressData);
        console.log(`[INFO] WS_PROGRESS:${JSON.stringify(progressData)}`);
    } catch (e) {
        console.error('Failed to report data progress:', (e as Error).message);
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
    try {
        const details: Record<string, unknown> = {
            action,
            status,
            number: phoneNumber,
            duration,
            percentage
        };
        withSuiteProgress(deviceId, details);

        const progressData = {
            deviceId,
            testType: 'calling',
            timestamp: Date.now(),
            completed: false,
            progress: details
        };

        await sendProgress(progressData);
        console.log(`[INFO] WS_PROGRESS:${JSON.stringify(progressData)}`);
    } catch (e) {
        console.error('Failed to report calling progress:', (e as Error).message);
    }
}

export async function reportSMSProgress(
    deviceId: string,
    phoneNumber: string,
    action: string,
    status: string,
    percentage: number
): Promise<void> {
    try {
        const details: Record<string, unknown> = {
            action,
            status,
            number: phoneNumber,
            percentage
        };
        withSuiteProgress(deviceId, details);

        const progressData = {
            deviceId,
            testType: 'sms',
            timestamp: Date.now(),
            completed: false,
            progress: details
        };

        await sendProgress(progressData);
        console.log(`[INFO] WS_PROGRESS:${JSON.stringify(progressData)}`);
    } catch (e) {
        console.error('Failed to report SMS progress:', (e as Error).message);
    }
}

export function initializeTestSuite(deviceId: string, totalTestCount: number): void {
    const key = `${deviceId}-suite`;
    totalTests.set(key, totalTestCount);
    completedTests.set(key, 0);
    console.log(`[INFO] Initialized test suite for device ${deviceId} with ${totalTestCount} total tests`);
}

export async function reportTestComplete(
    deviceId: string,
    testType: string,
    success: boolean,
    message: string
): Promise<void> {
    try {
        const suiteKey = `${deviceId}-suite`;
        let suiteDetails: Record<string, unknown> | undefined;

        if (completedTests.has(suiteKey)) {
            const completed = (completedTests.get(suiteKey) ?? 0) + 1;
            completedTests.set(suiteKey, completed);
            const total = totalTests.get(suiteKey)!;
            const suiteProgress = (completed * 100.0) / total;

            console.log(
                `[INFO] Test completed: ${completed}/${total} (${suiteProgress.toFixed(1)}%) for device ${deviceId}`
            );

            suiteDetails = {
                suiteProgress,
                completedTests: completed,
                totalTests: total,
                suiteProgressBar: createProgressBar(suiteProgress, 20)
            };
        }

        const progressData: Record<string, unknown> = {
            deviceId,
            testType,
            timestamp: Date.now(),
            completed: true,
            success,
            message
        };
        if (suiteDetails) {
            progressData.suite = suiteDetails;
        }

        await sendProgress(progressData);
        console.log(`[INFO] WS_PROGRESS:${JSON.stringify(progressData)}`);
    } catch (e) {
        console.error('Failed to report completion:', (e as Error).message);
    }
}

export function resetTestSuite(deviceId: string): void {
    const key = `${deviceId}-suite`;
    completedTests.delete(key);
    totalTests.delete(key);
    console.log(`[INFO] Reset test suite for device ${deviceId}`);
}
