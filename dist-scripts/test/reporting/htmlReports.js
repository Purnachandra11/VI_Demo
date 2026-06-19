"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCallingHTMLReport = generateCallingHTMLReport;
exports.generateSMSTestReport = generateSMSTestReport;
exports.generateDataUsageHTMLReport = generateDataUsageHTMLReport;
exports.generateSIMAutoLatchHTMLReport = generateSIMAutoLatchHTMLReport;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const helpers_1 = require("./helpers");
function htmlHeader(title) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
body{font-family:Arial,sans-serif;margin:20px;background:#f5f5f5}
.container{max-width:95%;margin:0 auto;background:#fff;padding:20px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,.1)}
h1{color:#333;text-align:center}
.summary{background:#e8f4fd;padding:15px;border-radius:5px;margin-bottom:20px}
table{width:100%;border-collapse:collapse;margin:20px 0;font-size:12px}
th,td{padding:8px;text-align:left;border:1px solid #ddd}
th{background:#4CAF50;color:#fff;position:sticky;top:0}
tr:hover{background:#f5f5f5}
.success{background:#d4edda}.failed{background:#f8d7da}.partial{background:#fff3cd}
.network-info{font-size:11px;color:#555}
</style></head><body>`;
}
function writeHtml(fileName, body) {
    (0, helpers_1.ensureReportDir)();
    const filePath = path_1.default.join(helpers_1.REPORT_DIR, fileName);
    fs_1.default.writeFileSync(filePath, body, 'utf8');
    console.log(` HTML report: ${filePath}`);
    return filePath;
}
function callingSummary(results) {
    const total = results.length;
    const success = results.filter((r) => (0, helpers_1.str)(r.finalStatus) === 'SUCCESS').length;
    const failed = results.filter((r) => (0, helpers_1.str)(r.finalStatus).includes('FAIL')).length;
    const partial = results.filter((r) => (0, helpers_1.str)(r.finalStatus).includes('PARTIAL')).length;
    const outgoing = results.filter((r) => (0, helpers_1.str)(r.direction) === 'OUTGOING').length;
    const incoming = results.filter((r) => (0, helpers_1.str)(r.direction) === 'INCOMING').length;
    const avgRing = total > 0
        ? results.reduce((s, r) => s + (0, helpers_1.int)(r.ringTime), 0) / total
        : 0;
    return `<div class="summary"><h3>📊 Test Summary</h3>
<p><strong>Total:</strong> ${total} | <strong> Success:</strong> ${success} | <strong> Partial:</strong> ${partial} | <strong>❌ Failed:</strong> ${failed}</p>
<p><strong>📤 Outgoing:</strong> ${outgoing} | <strong> Incoming:</strong> ${incoming} | <strong>Avg ring:</strong> ${avgRing.toFixed(1)}s</p>
<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p></div>`;
}
function callingTable(results) {
    let html = `<table><thead><tr>
<th>Test Name</th><th>Direction</th><th>From → To</th><th>Ring</th><th>Duration</th><th>Auto Answer</th><th>Network</th><th>Status</th>
</tr></thead><tbody>`;
    for (const r of results) {
        const cls = (0, helpers_1.statusClass)((0, helpers_1.str)(r.finalStatus));
        const dir = (0, helpers_1.str)(r.direction);
        const icon = dir === 'INCOMING' ? '' : '📤';
        html += `<tr class="${cls}">
<td>${(0, helpers_1.str)(r.name)}</td>
<td>${icon} ${dir}</td>
<td>${(0, helpers_1.str)(r.callerNumber)} → ${(0, helpers_1.str)(r.receiverNumber)}</td>
<td>${(0, helpers_1.int)(r.ringTime) || '-'}s</td>
<td>${(0, helpers_1.int)(r.actualDuration)}s / ${(0, helpers_1.int)(r.duration)}s</td>
<td>${(0, helpers_1.bool)(r.autoAnswerEnabled) ? ' YES' : '👤 NO'}</td>
<td>${(0, helpers_1.str)(r.aPartyNetworkType)}</td>
<td><strong>${(0, helpers_1.str)(r.finalStatus)}</strong></td>
</tr>`;
    }
    return html + '</tbody></table>';
}
function generateCallingHTMLReport(results) {
    const fileName = `Calling_Report_${(0, helpers_1.dialingNumber)()}_${(0, helpers_1.fileStamp)()}.html`;
    const body = htmlHeader('Enhanced Calling Test Report') +
        '<div class="container"><h1>📞 Enhanced Calling Test Report</h1>' +
        callingSummary(results) +
        callingTable(results) +
        '</div></body></html>';
    return writeHtml(fileName, body);
}
function generateSMSTestReport(results, deviceId, deviceNumber) {
    const fileName = `SMS_Detailed_Report_${(0, helpers_1.dialingNumber)()}_${(0, helpers_1.fileStamp)()}.html`;
    const total = results.length;
    const success = results.filter((r) => (0, helpers_1.str)(r.finalStatus) === 'SUCCESS').length;
    let table = `<table><thead><tr>
<th>Test</th><th>Type</th><th>Direction</th><th>Recipient</th><th>SMS</th><th>Status</th>
</tr></thead><tbody>`;
    for (const r of results) {
        table += `<tr class="${(0, helpers_1.statusClass)((0, helpers_1.str)(r.finalStatus))}">
<td>${(0, helpers_1.str)(r.name)}</td><td>${(0, helpers_1.str)(r.messageType)}</td><td>${(0, helpers_1.str)(r.direction)}</td>
<td>${(0, helpers_1.str)(r.recipient) || (0, helpers_1.str)(r.groupName)}</td>
<td>${(0, helpers_1.int)(r.successfulSMS)}/${(0, helpers_1.int)(r.totalSMS)}</td>
<td>${(0, helpers_1.str)(r.finalStatus)}</td></tr>`;
    }
    table += '</tbody></table>';
    const body = htmlHeader('SMS Test Detailed Report') +
        `<div class="container"><h1>💬 SMS Test Detailed Report</h1>
<div class="summary"><p><strong>Device:</strong> ${deviceId} | <strong>Number:</strong> ${deviceNumber}</p>
<p><strong>Tests:</strong> ${total} | <strong>Success:</strong> ${success}</p></div>
${table}</div></body></html>`;
    return writeHtml(fileName, body);
}
function generateDataUsageHTMLReport(results) {
    const dn = (0, helpers_1.dialingNumber)();
    const fileName = `DataUsage_Report_${dn}_${(0, helpers_1.fileStamp)()}.html`;
    let table = `<table><thead><tr>
<th>A Party</th><th>Target (GB)</th><th>Duration</th><th>Consumed</th><th>Achieved</th><th>Status</th>
</tr></thead><tbody>`;
    for (const r of results) {
        table += `<tr class="${(0, helpers_1.statusClass)((0, helpers_1.str)(r.finalStatus))}">
<td>${(0, helpers_1.str)(r.apartyNumber)}</td><td>${(0, helpers_1.dbl)(r.targetData)}</td><td>${(0, helpers_1.int)(r.duration)} min</td>
<td>${(0, helpers_1.str)(r.consumedData)}</td><td>${(0, helpers_1.bool)(r.targetAchieved) ? 'YES' : 'NO'}</td>
<td>${(0, helpers_1.str)(r.finalStatus)}</td></tr>`;
    }
    table += '</tbody></table>';
    const body = htmlHeader('Data Usage Test Report') +
        `<div class="container"><h1>🌐 Data Usage Test Report</h1>${table}</div></body></html>`;
    return writeHtml(fileName, body);
}
function generateSIMAutoLatchHTMLReport(results) {
    const fileName = `SIM_AutoLatch_Report_${(0, helpers_1.dialingNumber)()}_${(0, helpers_1.fileStamp)()}.html`;
    let table = `<table><thead><tr>
<th>Test</th><th>Device</th><th>Network</th><th>Latch Time</th><th>Result</th>
</tr></thead><tbody>`;
    for (const r of results) {
        table += `<tr class="${(0, helpers_1.statusClass)((0, helpers_1.str)(r.testResult))}">
<td>${(0, helpers_1.str)(r.name)}</td><td>${(0, helpers_1.str)(r.deviceType)}<div class="network-info">${(0, helpers_1.str)(r.deviceId)}</div></td>
<td>${(0, helpers_1.str)(r.preferredNetwork)}</td><td>${(0, helpers_1.lng)(r.autoLatchTimeMs)} ms</td><td>${(0, helpers_1.str)(r.testResult)}</td></tr>`;
    }
    table += '</tbody></table>';
    const body = htmlHeader('SIM Auto-Latch Test Report') +
        `<div class="container"><h1>📡 SIM Auto-Latch Test Report</h1>${table}</div></body></html>`;
    return writeHtml(fileName, body);
}
