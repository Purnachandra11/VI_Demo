"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportGenerator = exports.clearResults = exports.addSimLatchResult = exports.addDataUsageResult = exports.addSmsResult = exports.addCallingResult = void 0;
exports.flushReports = flushReports;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const wdio_shared_1 = require("../../config/wdio.shared");
const resultStore_1 = require("./resultStore");
const excel = __importStar(require("./excelReports"));
const html = __importStar(require("./htmlReports"));
var resultStore_2 = require("./resultStore");
Object.defineProperty(exports, "addCallingResult", { enumerable: true, get: function () { return resultStore_2.addCallingResult; } });
Object.defineProperty(exports, "addSmsResult", { enumerable: true, get: function () { return resultStore_2.addSmsResult; } });
Object.defineProperty(exports, "addDataUsageResult", { enumerable: true, get: function () { return resultStore_2.addDataUsageResult; } });
Object.defineProperty(exports, "addSimLatchResult", { enumerable: true, get: function () { return resultStore_2.addSimLatchResult; } });
Object.defineProperty(exports, "clearResults", { enumerable: true, get: function () { return resultStore_2.clearResults; } });
/** TypeScript port of com.telecom.utils.ReportGenerator */
exports.ReportGenerator = {
    generateCallingExcelReport: excel.generateCallingExcelReport,
    generateCallingHTMLReport: (results) => Promise.resolve(html.generateCallingHTMLReport(results)),
    generateSMSExcelReport: excel.generateSMSExcelReport,
    generateSMSTestReport: (results, deviceId, deviceNumber) => Promise.resolve(html.generateSMSTestReport(results, deviceId, deviceNumber)),
    generateDataUsageExcelReport: excel.generateDataUsageExcelReport,
    generateDataUsageHTMLReport: (results) => Promise.resolve(html.generateDataUsageHTMLReport(results)),
    generateSIMAutoLatchExcelReport: excel.generateSIMAutoLatchExcelReport,
    generateSIMAutoLatchHTMLReport: (results) => Promise.resolve(html.generateSIMAutoLatchHTMLReport(results))
};
async function generateSuiteReports(suite) {
    const deviceId = process.env.APARTY_DEVICE || '';
    const deviceNumber = process.env.APARTY_NUMBER || '';
    const out = { allureDir: path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'allure-results') };
    if (suite === 'calling') {
        const results = (0, resultStore_1.getCallingResults)();
        if (results.length) {
            out.excel = (await exports.ReportGenerator.generateCallingExcelReport(results)) || undefined;
            out.html = await exports.ReportGenerator.generateCallingHTMLReport(results);
        }
    }
    if (suite === 'sms') {
        const results = (0, resultStore_1.getSmsResults)();
        if (results.length) {
            out.excel = (await exports.ReportGenerator.generateSMSExcelReport(results)) || undefined;
            out.html = await exports.ReportGenerator.generateSMSTestReport(results, deviceId, deviceNumber);
        }
    }
    if (suite === 'data') {
        const results = (0, resultStore_1.getDataUsageResults)();
        if (results.length) {
            out.excel = (await exports.ReportGenerator.generateDataUsageExcelReport(results)) || undefined;
            out.html = await exports.ReportGenerator.generateDataUsageHTMLReport(results);
        }
    }
    if (suite === 'sim-latch') {
        const results = (0, resultStore_1.getSimLatchResults)();
        if (results.length) {
            out.excel = (await exports.ReportGenerator.generateSIMAutoLatchExcelReport(results)) || undefined;
            out.html = await exports.ReportGenerator.generateSIMAutoLatchHTMLReport(results);
        }
    }
    return out;
}
/** Called from WDIO onComplete — writes Excel + HTML for executed suites */
async function flushReports() {
    const suites = ['calling', 'sms', 'data', 'sim-latch'];
    const manifest = {};
    for (const suite of suites) {
        const report = await generateSuiteReports(suite);
        if (report.excel || report.html) {
            manifest[suite] = report;
            if (report.excel)
                console.log(`[Reports] ${suite} Excel → ${report.excel}`);
            if (report.html)
                console.log(`[Reports] ${suite} HTML → ${report.html}`);
        }
    }
    const indexPath = path_1.default.join(wdio_shared_1.PROJECT_ROOT, 'test-output', 'comprehensive-reports', 'latest-manifest.json');
    fs_1.default.mkdirSync(path_1.default.dirname(indexPath), { recursive: true });
    fs_1.default.writeFileSync(indexPath, JSON.stringify(manifest, null, 2), 'utf8');
    return manifest;
}
