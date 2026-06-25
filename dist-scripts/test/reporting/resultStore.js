"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCallingResult = addCallingResult;
exports.addSmsResult = addSmsResult;
exports.addDataUsageResult = addDataUsageResult;
exports.addSimLatchResult = addSimLatchResult;
exports.getCallingResults = getCallingResults;
exports.getSmsResults = getSmsResults;
exports.getDataUsageResults = getDataUsageResults;
exports.getSimLatchResults = getSimLatchResults;
exports.clearResults = clearResults;
exports.detectSuitesFromEnv = detectSuitesFromEnv;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
function saveResult(suite, row) {
    (0, helpers_1.ensureTempDir)();
    const id = Math.random().toString(36).substring(2, 15);
    const stamp = Date.now();
    const fileName = `${suite}_${stamp}_${id}.json`;
    const filePath = path_1.default.join(helpers_1.RESULTS_TEMP_DIR, fileName);
    const data = { ...row, testTimestamp: row.testTimestamp || new Date().toISOString() };
    fs_1.default.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}
function getResults(suite) {
    if (!fs_1.default.existsSync(helpers_1.RESULTS_TEMP_DIR))
        return [];
    return fs_1.default.readdirSync(helpers_1.RESULTS_TEMP_DIR)
        .filter(file => file.startsWith(`${suite}_`) && file.endsWith('.json'))
        .map(file => {
        try {
            const content = fs_1.default.readFileSync(path_1.default.join(helpers_1.RESULTS_TEMP_DIR, file), 'utf8');
            return JSON.parse(content);
        }
        catch (e) {
            console.error(`[ResultStore] Error reading ${file}:`, e);
            return null;
        }
    })
        .filter((r) => r !== null);
}
function addCallingResult(row) {
    saveResult('calling', row);
}
function addSmsResult(row) {
    saveResult('sms', row);
}
function addDataUsageResult(row) {
    saveResult('data', row);
}
function addSimLatchResult(row) {
    saveResult('sim-latch', row);
}
function getCallingResults() {
    return getResults('calling');
}
function getSmsResults() {
    return getResults('sms');
}
function getDataUsageResults() {
    return getResults('data');
}
function getSimLatchResults() {
    return getResults('sim-latch');
}
function clearResults() {
    if (fs_1.default.existsSync(helpers_1.RESULTS_TEMP_DIR)) {
        try {
            const files = fs_1.default.readdirSync(helpers_1.RESULTS_TEMP_DIR);
            for (const file of files) {
                fs_1.default.unlinkSync(path_1.default.join(helpers_1.RESULTS_TEMP_DIR, file));
            }
        }
        catch (e) {
            console.error('[ResultStore] Error clearing results:', e);
        }
    }
}
function detectSuitesFromEnv() {
    const specs = (process.env.WDIO_SPECS || '').toLowerCase();
    const suites = [];
    if (specs.includes('calling'))
        suites.push('calling');
    if (specs.includes('sms'))
        suites.push('sms');
    if (specs.includes('data'))
        suites.push('data');
    if (specs.includes('sim-latch'))
        suites.push('sim-latch');
    if (!suites.length)
        suites.push('calling');
    return suites;
}
