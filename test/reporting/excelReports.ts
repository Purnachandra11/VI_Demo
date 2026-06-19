import path from 'path';
import ExcelJS from 'exceljs';
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
  cleanNetworkType,
  balanceCell,
  createHeaderStyle,
  writeHeaders,
  autoSize,
  rowStyle
} from './helpers';

async function saveWorkbook(workbook: ExcelJS.Workbook, fileName: string): Promise<string> {
  ensureReportDir();
  const filePath = path.join(REPORT_DIR, fileName);
  await workbook.xlsx.writeFile(filePath);
  console.log(` Excel report: ${filePath}`);
  return filePath;
}

export async function generateCallingExcelReport(results: TestResultRow[]): Promise<string | null> {
  const fileName = `Calling_Report_${dialingNumber()}_${fileStamp()}.xlsx`;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Calling Test Results');
  const headerStyle = createHeaderStyle(workbook);

  const headers = [
    'Test Name', 'Direction', 'Caller Number', 'Receiver Number',
    'A Party Network', 'A Party VoLTE', 'B Party Network', 'B Party VoLTE',
    'Auto Answer', 'Ring Time (s)', 'Target Duration (s)', 'Actual Duration (s)',
    'Attempts', 'Call Status', 'Call Type', 'Final Status',
    'Before Balance', 'After Balance', 'Balance Deduction', 'Call Cost',
    'A Party MSISDN', 'Comments', 'Timestamp'
  ];
  writeHeaders(sheet, headers, headerStyle);

  for (const result of results) {
    const direction = str(result.direction);
    const style = rowStyle(workbook, str(result.finalStatus));
    const row = sheet.addRow([
      str(result.name),
      direction,
      str(result.callerNumber),
      str(result.receiverNumber),
      cleanNetworkType(str(result.aPartyNetworkType)),
      str(result.aPartyVolteEnabled),
      cleanNetworkType(str(result.bPartyNetworkType)),
      str(result.bPartyVolteEnabled),
      bool(result.autoAnswerEnabled) ? 'YES' : 'NO',
      int(result.ringTime),
      int(result.duration),
      int(result.actualDuration),
      int(result.attemptNumber),
      str(result.callStatus),
      str(result.callType),
      str(result.finalStatus),
      balanceCell(direction === 'INCOMING' ? result.bPartyBeforeBalance : result.beforeBalance),
      balanceCell(direction === 'INCOMING' ? result.bPartyAfterBalance : result.afterBalance),
      balanceCell(direction === 'INCOMING' ? result.bPartyBalanceDeduction : result.balanceDeduction),
      balanceCell(direction === 'INCOMING' ? result.bPartyBalanceDeduction : result.balanceDeduction),
      direction === 'INCOMING' ? str(result.receiverMSISDN) : str(result.callerMSISDN),
      str(result.comments),
      str(result.testTimestamp)
    ]);
    row.eachCell((cell) => { cell.style = style; });
  }

  autoSize(sheet, headers.length);
  return saveWorkbook(workbook, fileName);
}

export async function generateSMSExcelReport(results: TestResultRow[]): Promise<string | null> {
  const fileName = `SMS_Report_${dialingNumber()}_${fileStamp()}.xlsx`;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('SMS Test Results');
  const headerStyle = createHeaderStyle(workbook);

  const headers = [
    'Test Name', 'Test Type', 'Message Type', 'Direction', 'A Party Number', 'B Party Number',
    'Recipient', 'Group Name', 'Message', 'Before Balance', 'After Balance', 'Balance Deduction',
    'Sender MSISDN', 'Delivery Time (s)', 'Delivery Status', 'Verification Status',
    'Message Delivered', 'Total SMS', 'Successful SMS', 'Failed SMS',
    'Test Start Time', 'Test End Time', 'Sender Timestamp', 'Receiver Time', 'Final Status', 'Comments'
  ];
  writeHeaders(sheet, headers, headerStyle);

  for (const result of results) {
    const style = rowStyle(workbook, str(result.finalStatus));
    const row = sheet.addRow([
      str(result.name),
      str(result.testType),
      str(result.messageType),
      str(result.direction),
      str(result.aPartyNumber),
      str(result.bPartyNumber),
      str(result.recipient),
      str(result.groupName),
      str(result.message),
      balanceCell(result.beforeBalance),
      balanceCell(result.afterBalance),
      balanceCell(result.balanceDeduction),
      str(result.senderMSISDN),
      result.deliveryTimeSec != null ? dbl(result.deliveryTimeSec) : '',
      str(result.deliveryStatus),
      str(result.verificationStatus),
      bool(result.messageDelivered) ? 'YES' : 'NO',
      int(result.totalSMS),
      int(result.successfulSMS),
      int(result.failedSMS),
      str(result.testStartTime),
      str(result.testEndTime),
      str(result.senderTimestamp),
      str(result.receiverTime) || str(result.verificationStatus),
      str(result.finalStatus),
      str(result.comments)
    ]);
    row.eachCell((cell) => { cell.style = style; });
  }

  autoSize(sheet, headers.length);
  return saveWorkbook(workbook, fileName);
}

export async function generateDataUsageExcelReport(results: TestResultRow[]): Promise<string | null> {
  const dn = (process.env.APARTY_NUMBER || process.env.DaPartyNumber || dialingNumber()).replace(/\D/g, '');
  const fileName = `DataUsage_Report_${dn}_${fileStamp()}.xlsx`;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Data Usage Results');
  const headerStyle = createHeaderStyle(workbook);

  const headers = [
    'A Party Number', 'Target Data (GB)', 'Duration (min)', 'Apps', 'Initial Data', 'Final Data',
    'Consumed Data', 'Target Achieved', 'APN', 'Network Type', 'Before Balance', 'After Balance',
    'Balance Deduction', 'Final Status', 'Comments', 'Timestamp'
  ];
  writeHeaders(sheet, headers, headerStyle);

  for (const result of results) {
    const apnName = str(result.apnName);
    const apnVal = str(result.apn);
    const apnDisplay = apnName ? `${apnName} (${apnVal})` : apnVal;
    const style = rowStyle(workbook, str(result.finalStatus));
    const row = sheet.addRow([
      str(result.apartyNumber),
      dbl(result.targetData),
      int(result.duration),
      str(result.appsToUse),
      str(result.initialData),
      str(result.finalData),
      str(result.consumedData),
      bool(result.targetAchieved) ? 'YES' : 'NO',
      apnDisplay,
      str(result.networkType),
      balanceCell(result.beforeBalance),
      balanceCell(result.afterBalance),
      balanceCell(result.balanceDeduction),
      str(result.finalStatus),
      str(result.comments),
      str(result.testTimestamp)
    ]);
    row.eachCell((cell) => { cell.style = style; });
  }

  autoSize(sheet, headers.length);
  return saveWorkbook(workbook, fileName);
}

export async function generateSIMAutoLatchExcelReport(results: TestResultRow[]): Promise<string | null> {
  const fileName = `SIM_AutoLatch_Report_${dialingNumber()}_${fileStamp()}.xlsx`;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('SIM Auto-Latch Results');
  const headerStyle = createHeaderStyle(workbook);

  const headers = [
    'Test Name', 'Device ID', 'Device Type', 'Party Number', 'Preferred Network',
    'Timeout (s)', 'Attempts', 'Successful Attempts', 'Initial Network', 'Initial RAT', 'Initial IMS',
    'Final Network', 'Final RAT', 'Final IMS', 'Auto-Latch Time (ms)', 'Auto-Latch Time (s)',
    'Test Result', 'Transitions', 'Comments', 'Timestamp'
  ];
  writeHeaders(sheet, headers, headerStyle);

  for (const result of results) {
    const testResult = str(result.testResult);
    let style = rowStyle(workbook, testResult);
    if (testResult === 'PASS') style = rowStyle(workbook, 'SUCCESS');
    const row = sheet.addRow([
      str(result.name),
      str(result.deviceId),
      str(result.deviceType),
      str(result.partyNumber),
      str(result.preferredNetwork),
      int(result.timeoutSeconds),
      int(result.totalAttempts),
      int(result.successfulAttempts),
      str(result.initialNetworkState),
      str(result.initialRAT),
      bool(result.initialIMSRegistered) ? '' : '❌',
      str(result.finalNetworkState),
      str(result.finalRAT),
      bool(result.finalIMSRegistered) ? '' : '❌',
      lng(result.autoLatchTimeMs),
      dbl(result.autoLatchTimeSeconds),
      testResult,
      str(result.transitions),
      str(result.comments),
      str(result.testTimestamp)
    ]);
    row.eachCell((cell) => { cell.style = style; });
  }

  autoSize(sheet, headers.length);
  return saveWorkbook(workbook, fileName);
}
