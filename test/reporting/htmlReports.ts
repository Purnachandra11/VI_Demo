import fs from 'fs';
import path from 'path';
import type { TestResultRow } from './types';
import {
  REPORT_DIR,
  ensureReportDir,
  fileStamp,
  dialingNumber,
  str,
  int,
  dbl,
  lng,
  bool,
  statusClass
} from './helpers';

function htmlHeader(title: string): string {
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

function writeHtml(fileName: string, body: string): string {
  ensureReportDir();
  const filePath = path.join(REPORT_DIR, fileName);
  fs.writeFileSync(filePath, body, 'utf8');
  console.log(` HTML report: ${filePath}`);
  return filePath;
}

function callingSummary(results: TestResultRow[]): string {
  const total = results.length;
  const success = results.filter((r) => str(r.finalStatus) === 'SUCCESS').length;
  const failed = results.filter((r) => str(r.finalStatus).includes('FAIL')).length;
  const partial = results.filter((r) => str(r.finalStatus).includes('PARTIAL')).length;
  const outgoing = results.filter((r) => str(r.direction) === 'OUTGOING').length;
  const incoming = results.filter((r) => str(r.direction) === 'INCOMING').length;
  const avgRing =
    total > 0
      ? results.reduce((s, r) => s + int(r.ringTime), 0) / total
      : 0;

  return `<div class="summary"><h3>📊 Test Summary</h3>
<p><strong>Total:</strong> ${total} | <strong> Success:</strong> ${success} | <strong> Partial:</strong> ${partial} | <strong>❌ Failed:</strong> ${failed}</p>
<p><strong>📤 Outgoing:</strong> ${outgoing} | <strong> Incoming:</strong> ${incoming} | <strong>Avg ring:</strong> ${avgRing.toFixed(1)}s</p>
<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p></div>`;
}

function callingTable(results: TestResultRow[]): string {
  let html = `<table><thead><tr>
<th>Test Name</th><th>Direction</th><th>From → To</th><th>Ring</th><th>Duration</th><th>Auto Answer</th><th>Network</th><th>Status</th>
</tr></thead><tbody>`;

  for (const r of results) {
    const cls = statusClass(str(r.finalStatus));
    const dir = str(r.direction);
    const icon = dir === 'INCOMING' ? '' : '📤';
    html += `<tr class="${cls}">
<td>${str(r.name)}</td>
<td>${icon} ${dir}</td>
<td>${str(r.callerNumber)} → ${str(r.receiverNumber)}</td>
<td>${int(r.ringTime) || '-'}s</td>
<td>${int(r.actualDuration)}s / ${int(r.duration)}s</td>
<td>${bool(r.autoAnswerEnabled) ? ' YES' : '👤 NO'}</td>
<td>${str(r.aPartyNetworkType)}</td>
<td><strong>${str(r.finalStatus)}</strong></td>
</tr>`;
  }
  return html + '</tbody></table>';
}

export function generateCallingHTMLReport(results: TestResultRow[]): string {
  const fileName = `Calling_Report_${dialingNumber()}_${fileStamp()}.html`;
  const body =
    htmlHeader('Enhanced Calling Test Report') +
    '<div class="container"><h1>📞 Enhanced Calling Test Report</h1>' +
    callingSummary(results) +
    callingTable(results) +
    '</div></body></html>';
  return writeHtml(fileName, body);
}

export function generateSMSTestReport(
  results: TestResultRow[],
  deviceId: string,
  deviceNumber: string
): string {
  const fileName = `SMS_Detailed_Report_${dialingNumber()}_${fileStamp()}.html`;
  const total = results.length;
  const success = results.filter((r) => str(r.finalStatus) === 'SUCCESS').length;

  let table = `<table><thead><tr>
<th>Test</th><th>Type</th><th>Direction</th><th>Recipient</th><th>SMS</th><th>Status</th>
</tr></thead><tbody>`;
  for (const r of results) {
    table += `<tr class="${statusClass(str(r.finalStatus))}">
<td>${str(r.name)}</td><td>${str(r.messageType)}</td><td>${str(r.direction)}</td>
<td>${str(r.recipient) || str(r.groupName)}</td>
<td>${int(r.successfulSMS)}/${int(r.totalSMS)}</td>
<td>${str(r.finalStatus)}</td></tr>`;
  }
  table += '</tbody></table>';

  const body =
    htmlHeader('SMS Test Detailed Report') +
    `<div class="container"><h1>💬 SMS Test Detailed Report</h1>
<div class="summary"><p><strong>Device:</strong> ${deviceId} | <strong>Number:</strong> ${deviceNumber}</p>
<p><strong>Tests:</strong> ${total} | <strong>Success:</strong> ${success}</p></div>
${table}</div></body></html>`;
  return writeHtml(fileName, body);
}

export function generateDataUsageHTMLReport(results: TestResultRow[]): string {
  const dn = dialingNumber();
  const fileName = `DataUsage_Report_${dn}_${fileStamp()}.html`;
  let table = `<table><thead><tr>
<th>A Party</th><th>Target (GB)</th><th>Duration</th><th>Consumed</th><th>Achieved</th><th>Status</th>
</tr></thead><tbody>`;
  for (const r of results) {
    table += `<tr class="${statusClass(str(r.finalStatus))}">
<td>${str(r.apartyNumber)}</td><td>${dbl(r.targetData)}</td><td>${int(r.duration)} min</td>
<td>${str(r.consumedData)}</td><td>${bool(r.targetAchieved) ? 'YES' : 'NO'}</td>
<td>${str(r.finalStatus)}</td></tr>`;
  }
  table += '</tbody></table>';

  const body =
    htmlHeader('Data Usage Test Report') +
    `<div class="container"><h1>🌐 Data Usage Test Report</h1>${table}</div></body></html>`;
  return writeHtml(fileName, body);
}

export function generateSIMAutoLatchHTMLReport(results: TestResultRow[]): string {
  const fileName = `SIM_AutoLatch_Report_${dialingNumber()}_${fileStamp()}.html`;
  let table = `<table><thead><tr>
<th>Test</th><th>Device</th><th>Network</th><th>Latch Time</th><th>Result</th>
</tr></thead><tbody>`;
  for (const r of results) {
    table += `<tr class="${statusClass(str(r.testResult))}">
<td>${str(r.name)}</td><td>${str(r.deviceType)}<div class="network-info">${str(r.deviceId)}</div></td>
<td>${str(r.preferredNetwork)}</td><td>${lng(r.autoLatchTimeMs)} ms</td><td>${str(r.testResult)}</td></tr>`;
  }
  table += '</tbody></table>';

  const body =
    htmlHeader('SIM Auto-Latch Test Report') +
    `<div class="container"><h1>📡 SIM Auto-Latch Test Report</h1>${table}</div></body></html>`;
  return writeHtml(fileName, body);
}
