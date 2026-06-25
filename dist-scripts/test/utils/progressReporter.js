"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProgressReporter = void 0;
exports.reportProgress = reportProgress;
exports.reportCallingProgress = reportCallingProgress;
exports.reportSMSProgress = reportSMSProgress;
exports.reportDataProgress = reportDataProgress;
exports.reportSIMLatchProgress = reportSIMLatchProgress;
const endpoint = process.env.PROGRESS_ENDPOINT || 'http://localhost:5174/api/progress/update';
async function reportProgress(payload) {
    try {
        await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        console.log(`[INFO] WS_PROGRESS:${JSON.stringify(payload)}`);
    }
    catch (err) {
        console.warn('Progress report failed:', err.message);
    }
}
async function reportCallingProgress(deviceId, phoneNumber, action, status, duration, percentage) {
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
async function reportSMSProgress(deviceId, phoneNumber, action, status, percentage) {
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
async function reportDataProgress(deviceId, phoneNumber, action, status, percentage) {
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
async function reportSIMLatchProgress(deviceId, action, status, percentage) {
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
function createBar(percent, width) {
    const filled = Math.round((percent / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}
/** Class facade for specs —  ProgressReporter static methods */
class ProgressReporter {
    static async initializeTestSuite(deviceId, totalTestCount) {
        await reportProgress({
            deviceId,
            testType: 'suite',
            timestamp: Date.now(),
            completed: false,
            progress: { action: 'SUITE_START', totalTestCount, percentage: 0 }
        });
    }
    static async reportTestComplete(deviceId, testType, success, message) {
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
    static async resetTestSuite(deviceId) {
        await reportProgress({
            deviceId,
            testType: 'suite',
            timestamp: Date.now(),
            completed: false,
            progress: { action: 'SUITE_RESET', percentage: 0 }
        });
    }
}
exports.ProgressReporter = ProgressReporter;
ProgressReporter.reportProgress = reportProgress;
ProgressReporter.reportCallingProgress = reportCallingProgress;
ProgressReporter.reportSMSProgress = reportSMSProgress;
ProgressReporter.reportDataProgress = reportDataProgress;
ProgressReporter.reportSIMLatchProgress = reportSIMLatchProgress;
