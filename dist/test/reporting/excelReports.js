"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCallingExcelReport = generateCallingExcelReport;
exports.generateSMSExcelReport = generateSMSExcelReport;
exports.generateDataUsageExcelReport = generateDataUsageExcelReport;
exports.generateSIMAutoLatchExcelReport = generateSIMAutoLatchExcelReport;
const path_1 = __importDefault(require("path"));
const exceljs_1 = __importDefault(require("exceljs"));
const helpers_1 = require("./helpers");
async function saveWorkbook(workbook, fileName) {
    (0, helpers_1.ensureReportDir)();
    const filePath = path_1.default.join(helpers_1.REPORT_DIR, fileName);
    await workbook.xlsx.writeFile(filePath);
    console.log(` Excel report: ${filePath}`);
    return filePath;
}
async function generateCallingExcelReport(results) {
    const fileName = `Calling_Report_${(0, helpers_1.dialingNumber)()}_${(0, helpers_1.fileStamp)()}.xlsx`;
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet('Calling Test Results');
    const headerStyle = (0, helpers_1.createHeaderStyle)(workbook);
    const headers = [
        'Test Name', 'Direction', 'Caller Number', 'Receiver Number',
        'A Party Network', 'A Party VoLTE', 'B Party Network', 'B Party VoLTE',
        'Auto Answer', 'Ring Time (s)', 'Target Duration (s)', 'Actual Duration (s)',
        'Attempts', 'Call Status', 'Call Type', 'Final Status',
        'Before Balance', 'After Balance', 'Balance Deduction', 'Call Cost',
        'A Party MSISDN', 'Comments', 'Timestamp'
    ];
    (0, helpers_1.writeHeaders)(sheet, headers, headerStyle);
    for (const result of results) {
        const direction = (0, helpers_1.str)(result.direction);
        const style = (0, helpers_1.rowStyle)(workbook, (0, helpers_1.str)(result.finalStatus));
        const row = sheet.addRow([
            (0, helpers_1.str)(result.name),
            direction,
            (0, helpers_1.str)(result.callerNumber),
            (0, helpers_1.str)(result.receiverNumber),
            (0, helpers_1.cleanNetworkType)((0, helpers_1.str)(result.aPartyNetworkType)),
            (0, helpers_1.str)(result.aPartyVolteEnabled),
            (0, helpers_1.cleanNetworkType)((0, helpers_1.str)(result.bPartyNetworkType)),
            (0, helpers_1.str)(result.bPartyVolteEnabled),
            (0, helpers_1.bool)(result.autoAnswerEnabled) ? 'YES' : 'NO',
            (0, helpers_1.int)(result.ringTime),
            (0, helpers_1.int)(result.duration),
            (0, helpers_1.int)(result.actualDuration),
            (0, helpers_1.int)(result.attemptNumber),
            (0, helpers_1.str)(result.callStatus),
            (0, helpers_1.str)(result.callType),
            (0, helpers_1.str)(result.finalStatus),
            (0, helpers_1.balanceCell)(direction === 'INCOMING' ? result.bPartyBeforeBalance : result.beforeBalance),
            (0, helpers_1.balanceCell)(direction === 'INCOMING' ? result.bPartyAfterBalance : result.afterBalance),
            (0, helpers_1.balanceCell)(direction === 'INCOMING' ? result.bPartyBalanceDeduction : result.balanceDeduction),
            (0, helpers_1.balanceCell)(direction === 'INCOMING' ? result.bPartyBalanceDeduction : result.balanceDeduction),
            direction === 'INCOMING' ? (0, helpers_1.str)(result.receiverMSISDN) : (0, helpers_1.str)(result.callerMSISDN),
            (0, helpers_1.str)(result.comments),
            (0, helpers_1.str)(result.testTimestamp)
        ]);
        row.eachCell((cell) => { cell.style = style; });
    }
    (0, helpers_1.autoSize)(sheet, headers.length);
    return saveWorkbook(workbook, fileName);
}
async function generateSMSExcelReport(results) {
    const fileName = `SMS_Report_${(0, helpers_1.dialingNumber)()}_${(0, helpers_1.fileStamp)()}.xlsx`;
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet('SMS Test Results');
    const headerStyle = (0, helpers_1.createHeaderStyle)(workbook);
    const headers = [
        'Test Name', 'Test Type', 'Message Type', 'Direction', 'A Party Number', 'B Party Number',
        'Recipient', 'Group Name', 'Message', 'Before Balance', 'After Balance', 'Balance Deduction',
        'Sender MSISDN', 'Delivery Time (s)', 'Delivery Status', 'Verification Status',
        'Message Delivered', 'Total SMS', 'Successful SMS', 'Failed SMS',
        'Test Start Time', 'Test End Time', 'Sender Timestamp', 'Receiver Time', 'Final Status', 'Comments'
    ];
    (0, helpers_1.writeHeaders)(sheet, headers, headerStyle);
    for (const result of results) {
        const style = (0, helpers_1.rowStyle)(workbook, (0, helpers_1.str)(result.finalStatus));
        const row = sheet.addRow([
            (0, helpers_1.str)(result.name),
            (0, helpers_1.str)(result.testType),
            (0, helpers_1.str)(result.messageType),
            (0, helpers_1.str)(result.direction),
            (0, helpers_1.str)(result.aPartyNumber),
            (0, helpers_1.str)(result.bPartyNumber),
            (0, helpers_1.str)(result.recipient),
            (0, helpers_1.str)(result.groupName),
            (0, helpers_1.str)(result.message),
            (0, helpers_1.balanceCell)(result.beforeBalance),
            (0, helpers_1.balanceCell)(result.afterBalance),
            (0, helpers_1.balanceCell)(result.balanceDeduction),
            (0, helpers_1.str)(result.senderMSISDN),
            result.deliveryTimeSec != null ? (0, helpers_1.dbl)(result.deliveryTimeSec) : '',
            (0, helpers_1.str)(result.deliveryStatus),
            (0, helpers_1.str)(result.verificationStatus),
            (0, helpers_1.bool)(result.messageDelivered) ? 'YES' : 'NO',
            (0, helpers_1.int)(result.totalSMS),
            (0, helpers_1.int)(result.successfulSMS),
            (0, helpers_1.int)(result.failedSMS),
            (0, helpers_1.str)(result.testStartTime),
            (0, helpers_1.str)(result.testEndTime),
            (0, helpers_1.str)(result.senderTimestamp),
            (0, helpers_1.str)(result.receiverTime) || (0, helpers_1.str)(result.verificationStatus),
            (0, helpers_1.str)(result.finalStatus),
            (0, helpers_1.str)(result.comments)
        ]);
        row.eachCell((cell) => { cell.style = style; });
    }
    (0, helpers_1.autoSize)(sheet, headers.length);
    return saveWorkbook(workbook, fileName);
}
async function generateDataUsageExcelReport(results) {
    const dn = (process.env.APARTY_NUMBER || process.env.DaPartyNumber || (0, helpers_1.dialingNumber)()).replace(/\D/g, '');
    const fileName = `DataUsage_Report_${dn}_${(0, helpers_1.fileStamp)()}.xlsx`;
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet('Data Usage Results');
    const headerStyle = (0, helpers_1.createHeaderStyle)(workbook);
    const headers = [
        'A Party Number', 'Target Data (GB)', 'Duration (min)', 'Apps', 'Initial Data', 'Final Data',
        'Consumed Data', 'Target Achieved', 'APN', 'Network Type', 'Before Balance', 'After Balance',
        'Balance Deduction', 'Final Status', 'Comments', 'Timestamp'
    ];
    (0, helpers_1.writeHeaders)(sheet, headers, headerStyle);
    for (const result of results) {
        const apnName = (0, helpers_1.str)(result.apnName);
        const apnVal = (0, helpers_1.str)(result.apn);
        const apnDisplay = apnName ? `${apnName} (${apnVal})` : apnVal;
        const style = (0, helpers_1.rowStyle)(workbook, (0, helpers_1.str)(result.finalStatus));
        const row = sheet.addRow([
            (0, helpers_1.str)(result.apartyNumber),
            (0, helpers_1.dbl)(result.targetData),
            (0, helpers_1.int)(result.duration),
            (0, helpers_1.str)(result.appsToUse),
            (0, helpers_1.str)(result.initialData),
            (0, helpers_1.str)(result.finalData),
            (0, helpers_1.str)(result.consumedData),
            (0, helpers_1.bool)(result.targetAchieved) ? 'YES' : 'NO',
            apnDisplay,
            (0, helpers_1.str)(result.networkType),
            (0, helpers_1.balanceCell)(result.beforeBalance),
            (0, helpers_1.balanceCell)(result.afterBalance),
            (0, helpers_1.balanceCell)(result.balanceDeduction),
            (0, helpers_1.str)(result.finalStatus),
            (0, helpers_1.str)(result.comments),
            (0, helpers_1.str)(result.testTimestamp)
        ]);
        row.eachCell((cell) => { cell.style = style; });
    }
    (0, helpers_1.autoSize)(sheet, headers.length);
    return saveWorkbook(workbook, fileName);
}
async function generateSIMAutoLatchExcelReport(results) {
    const fileName = `SIM_AutoLatch_Report_${(0, helpers_1.dialingNumber)()}_${(0, helpers_1.fileStamp)()}.xlsx`;
    const workbook = new exceljs_1.default.Workbook();
    const sheet = workbook.addWorksheet('SIM Auto-Latch Results');
    const headerStyle = (0, helpers_1.createHeaderStyle)(workbook);
    const headers = [
        'Test Name', 'Device ID', 'Device Type', 'Party Number', 'Preferred Network',
        'Timeout (s)', 'Attempts', 'Successful Attempts', 'Initial Network', 'Initial RAT', 'Initial IMS',
        'Final Network', 'Final RAT', 'Final IMS', 'Auto-Latch Time (ms)', 'Auto-Latch Time (s)',
        'Test Result', 'Transitions', 'Comments', 'Timestamp'
    ];
    (0, helpers_1.writeHeaders)(sheet, headers, headerStyle);
    for (const result of results) {
        const testResult = (0, helpers_1.str)(result.testResult);
        let style = (0, helpers_1.rowStyle)(workbook, testResult);
        if (testResult === 'PASS')
            style = (0, helpers_1.rowStyle)(workbook, 'SUCCESS');
        const row = sheet.addRow([
            (0, helpers_1.str)(result.name),
            (0, helpers_1.str)(result.deviceId),
            (0, helpers_1.str)(result.deviceType),
            (0, helpers_1.str)(result.partyNumber),
            (0, helpers_1.str)(result.preferredNetwork),
            (0, helpers_1.int)(result.timeoutSeconds),
            (0, helpers_1.int)(result.totalAttempts),
            (0, helpers_1.int)(result.successfulAttempts),
            (0, helpers_1.str)(result.initialNetworkState),
            (0, helpers_1.str)(result.initialRAT),
            (0, helpers_1.bool)(result.initialIMSRegistered) ? '' : '❌',
            (0, helpers_1.str)(result.finalNetworkState),
            (0, helpers_1.str)(result.finalRAT),
            (0, helpers_1.bool)(result.finalIMSRegistered) ? '' : '❌',
            (0, helpers_1.lng)(result.autoLatchTimeMs),
            (0, helpers_1.dbl)(result.autoLatchTimeSeconds),
            testResult,
            (0, helpers_1.str)(result.transitions),
            (0, helpers_1.str)(result.comments),
            (0, helpers_1.str)(result.testTimestamp)
        ]);
        row.eachCell((cell) => { cell.style = style; });
    }
    (0, helpers_1.autoSize)(sheet, headers.length);
    return saveWorkbook(workbook, fileName);
}
