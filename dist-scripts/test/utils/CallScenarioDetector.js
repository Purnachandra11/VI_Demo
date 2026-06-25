"use strict";
/**
 * CallScenarioDetector.ts
 * TypeScript port of Java CallScenarioDetector — automated call outcome classification
 * for reporting and user-facing comments in calling tests.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectCallScenario = detectCallScenario;
exports.getScenarioEmoji = getScenarioEmoji;
function containsIgnoreCase(source, ...keywords) {
    if (!source)
        return false;
    const lower = source.toLowerCase();
    return keywords.some(kw => lower.includes(kw.toLowerCase()));
}
/**
 * Detect call scenario from UiAutomator page source and call metrics.
 *  CallScenarioDetector.detectCallScenario().
 */
function detectCallScenario(pageSource, callConnected, actualDuration, targetDuration) {
    if (containsIgnoreCase(pageSource, 'ringing', 'ring') && callConnected) {
        return {
            scenarioNumber: 1,
            scenarioName: 'Call Ringing',
            status: 'CONNECTED',
            comment: `Call: Connected (${actualDuration}s) | Ringing detected`
        };
    }
    if (containsIgnoreCase(pageSource, 'busy')) {
        return {
            scenarioNumber: 2,
            scenarioName: 'Busy Tone',
            status: 'CONNECTED (BUSY)',
            comment: `Call: Busy tone detected (${actualDuration}s)`
        };
    }
    if (callConnected && actualDuration >= targetDuration * 0.9) {
        return {
            scenarioNumber: 3,
            scenarioName: 'Call Connected',
            status: 'CONNECTED',
            comment: `Call: Connected (${actualDuration}s)`
        };
    }
    if (callConnected &&
        actualDuration < targetDuration &&
        containsIgnoreCase(pageSource, 'drop', 'disconnect')) {
        return {
            scenarioNumber: 4,
            scenarioName: 'Call Dropped',
            status: 'CONNECTED (DROPPED)',
            comment: `Call dropped after ${actualDuration}s`
        };
    }
    if (containsIgnoreCase(pageSource, 'invalid number', 'invalid_number', 'format incorrect')) {
        return {
            scenarioNumber: 5,
            scenarioName: 'Invalid Number',
            status: 'FAILED',
            comment: 'Invalid number format detected'
        };
    }
    if (containsIgnoreCase(pageSource, 'network') &&
        containsIgnoreCase(pageSource, 'error', 'busy', 'unavailable')) {
        return {
            scenarioNumber: 6,
            scenarioName: 'Network Error',
            status: 'FAILED',
            comment: 'No network signal detected'
        };
    }
    if (containsIgnoreCase(pageSource, 'not reachable', 'out of coverage', 'unreachable', 'switched off')) {
        return {
            scenarioNumber: 7,
            scenarioName: 'Not Reachable',
            status: 'FAILED',
            comment: 'Call failed - B party not reachable'
        };
    }
    if (containsIgnoreCase(pageSource, 'outgoing') &&
        containsIgnoreCase(pageSource, 'barred', 'restricted')) {
        return {
            scenarioNumber: 8,
            scenarioName: 'A-Party Barred',
            status: 'FAILED',
            comment: 'Call failed - Outgoing barred'
        };
    }
    if (containsIgnoreCase(pageSource, 'incoming') &&
        containsIgnoreCase(pageSource, 'barred', 'restricted')) {
        return {
            scenarioNumber: 9,
            scenarioName: 'B-Party Barred',
            status: 'REJECTED',
            comment: 'Call rejected - Incoming barred'
        };
    }
    if (containsIgnoreCase(pageSource, 'wrong sim', 'wrong_sim', 'sim error', 'no sim')) {
        return {
            scenarioNumber: 10,
            scenarioName: 'Wrong SIM',
            status: 'FAILED',
            comment: 'Call failed due to wrong SIM slot'
        };
    }
    if (callConnected && actualDuration >= targetDuration * 0.8) {
        return {
            scenarioNumber: 11,
            scenarioName: 'Call Quality',
            status: 'CONNECTED',
            comment: `Call: Connected (${actualDuration}s) | Audio quality OK`
        };
    }
    if (containsIgnoreCase(pageSource, 'crbt', 'caller tune', 'ring back tone') &&
        callConnected) {
        return {
            scenarioNumber: 12,
            scenarioName: 'CRBT Detected',
            status: 'CONNECTED',
            comment: `Call: Connected with CRBT detected (${actualDuration}s)`
        };
    }
    return {
        scenarioNumber: 0,
        scenarioName: 'Unknown',
        status: 'FAILED',
        comment: 'Call scenario could not be determined'
    };
}
function getScenarioEmoji(scenarioNumber) {
    var _a;
    const map = {
        1: '🔔',
        2: '📞',
        3: '',
        4: '',
        5: '',
        6: '📡',
        7: '📵',
        8: '🚫',
        9: '🚫',
        10: '',
        11: '📊',
        12: '🎵'
    };
    return (_a = map[scenarioNumber]) !== null && _a !== void 0 ? _a : '❓';
}
