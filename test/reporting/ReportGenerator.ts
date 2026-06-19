// ReportGenerator.ts
import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

export class ReportGenerator {
    private static readonly REPORT_DIR = 'test-output/comprehensive-reports/';
    
    static {
        if (!fs.existsSync(this.REPORT_DIR)) {
            fs.mkdirSync(this.REPORT_DIR, { recursive: true });
        }
    }

    private static formatDate(date: Date, pattern: string): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        if (pattern === 'yyyy-MM-dd HH:mm:ss') {
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        } else if (pattern === 'yyyyMMdd_HHmmss') {
            return `${year}${month}${day}_${hours}${minutes}${seconds}`;
        }
        return `${year}${month}${day}_${hours}${minutes}${seconds}`;
    }

    // CALLING REPORT 

    static async generateCallingExcelReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.aPartyNumber || '';
        const fileName = `Calling_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Calling Test Results');

        // Define columns
        const columns = [
            { header: 'Test Name', key: 'name', width: 30 },
            { header: 'Direction', key: 'direction', width: 12 },
            { header: 'Caller Number', key: 'callerNumber', width: 18 },
            { header: 'Receiver Number', key: 'receiverNumber', width: 18 },
            { header: 'A Party Network', key: 'aPartyNetwork', width: 15 },
            { header: 'A Party VoLTE', key: 'aPartyVolteEnabled', width: 12 },
            { header: 'B Party Network', key: 'bPartyNetwork', width: 15 },
            { header: 'B Party VoLTE', key: 'bPartyVolteEnabled', width: 12 },
            { header: 'Auto Answer', key: 'autoAnswer', width: 12 },
            { header: 'Ring Time (s)', key: 'ringTime', width: 12 },
            { header: 'Target Duration (s)', key: 'duration', width: 15 },
            { header: 'Actual Duration (s)', key: 'actualDuration', width: 15 },
            { header: 'Attempts', key: 'attemptNumber', width: 10 },
            { header: 'Call Status', key: 'callStatus', width: 15 },
            { header: 'Call Type', key: 'callType', width: 12 },
            { header: 'Final Status', key: 'finalStatus', width: 15 },
            { header: 'Before Balance', key: 'beforeBalance', width: 15 },
            { header: 'After Balance', key: 'afterBalance', width: 15 },
            { header: 'Balance Deduction', key: 'balanceDeduction', width: 15 },
            { header: 'Call Cost', key: 'callCost', width: 12 },
            { header: 'A Party MSISDN', key: 'aPartyMSISDN', width: 18 },
            { header: 'Comments', key: 'comments', width: 40 },
            { header: 'Timestamp', key: 'timestamp', width: 22 }
        ];

        worksheet.columns = columns;

        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF00008B' } // Dark Blue
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.alignment = { horizontal: 'center' };
        });

        // Add data rows
        for (const result of results) {
            const direction = this.getStringValue(result.direction);
            const finalStatus = this.getStringValue(result.finalStatus);
            
            // Determine before/after balance based on direction
            let beforeBalance = '';
            let afterBalance = '';
            let balanceDeduction = '';
            
            if (direction === 'INCOMING') {
                beforeBalance = this.getStringValue(result.bPartyBeforeBalance);
                afterBalance = this.getStringValue(result.bPartyAfterBalance);
                const deduction = result.bPartyBalanceDeduction;
                balanceDeduction = deduction !== undefined ? `₹${deduction}` : '';
            } else {
                beforeBalance = this.getStringValue(result.beforeBalance);
                afterBalance = this.getStringValue(result.afterBalance);
                const deduction = result.balanceDeduction;
                balanceDeduction = deduction !== undefined ? `₹${deduction}` : '';
            }

            // Calculate call cost
            let callCost = '';
            if (result.balanceDeduction !== undefined) {
                callCost = `₹${result.balanceDeduction}`;
            }

            // A Party MSISDN
            let aPartyMSISDN = '';
            if (direction === 'INCOMING') {
                aPartyMSISDN = this.getStringValue(result.receiverMSISDN);
            } else {
                aPartyMSISDN = this.getStringValue(result.callerMSISDN);
            }

            const rowData = {
                name: this.getStringValue(result.name),
                direction: direction,
                callerNumber: this.getStringValue(result.callerNumber),
                receiverNumber: this.getStringValue(result.receiverNumber),
                aPartyNetwork: this.cleanNetworkType(this.getStringValue(result.aPartyNetworkType)),
                aPartyVolteEnabled: this.getStringValue(result.aPartyVolteEnabled),
                bPartyNetwork: this.cleanNetworkType(this.getStringValue(result.bPartyNetworkType)),
                bPartyVolteEnabled: this.getStringValue(result.bPartyVolteEnabled),
                autoAnswer: this.getBooleanValue(result.autoAnswerEnabled) ? 'YES' : 'NO',
                ringTime: this.getIntValue(result.ringTime),
                duration: this.getIntValue(result.duration),
                actualDuration: this.getIntValue(result.actualDuration),
                attemptNumber: this.getIntValue(result.attemptNumber),
                callStatus: this.getStringValue(result.callStatus),
                callType: this.getStringValue(result.callType),
                finalStatus: finalStatus,
                beforeBalance: beforeBalance,
                afterBalance: afterBalance,
                balanceDeduction: balanceDeduction,
                callCost: callCost,
                aPartyMSISDN: aPartyMSISDN,
                comments: this.getStringValue(result.comments),
                timestamp: this.getStringValue(result.testTimestamp)
            };

            const row = worksheet.addRow(rowData);
            
            // Apply style based on final status
            let fillColor = '';
            if (finalStatus.includes('SUCCESS') && !finalStatus.includes('PARTIAL')) {
                fillColor = 'FF90EE90'; // Light Green
                row.eachCell((cell) => {
                    cell.font = { color: { argb: 'FF006400' } }; // Dark Green
                });
            } else if (finalStatus.includes('FAILED')) {
                fillColor = 'FFFFB6C1'; // Light Red/Pink
                row.eachCell((cell) => {
                    cell.font = { color: { argb: 'FF8B0000' } }; // Dark Red
                });
            } else if (finalStatus.includes('PARTIAL')) {
                fillColor = 'FFFFFFE0'; // Light Yellow
                row.eachCell((cell) => {
                    cell.font = { color: { argb: 'FFB8860B' } }; // Dark Golden
                });
            }
            
            if (fillColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: fillColor }
                    };
                });
            }
            
            // Add borders to all cells
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        }

        await workbook.xlsx.writeFile(filePath);
        console.log(` Enhanced Calling Excel Report: ${filePath}`);
        return filePath;
    }

    static async generateCallingHTMLReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.aPartyNumber || '';
        const fileName = `Calling_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.html`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const htmlContent = `
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <meta name='viewport' content='width=device-width, initial-scale=1.0'>
    <title>Enhanced Calling Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 95%; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; margin-bottom: 30px; }
        .summary { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        .party-info { background: #f0f8ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .party-info h3 { margin-top: 0; color: #2c5282; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; position: sticky; top: 0; }
        tr:hover { background-color: #f5f5f5; }
        .success { background-color: #d4edda; }
        .failed { background-color: #f8d7da; }
        .partial { background-color: #fff3cd; }
        .network-info { font-size: 11px; color: #555; }
    </style>
</head>
<body>
<div class='container'>
    <h1>📞 Enhanced Calling Test Report</h1>
    ${this.generateEnhancedSummarySection(results)}
    ${this.generateEnhancedCallingTable(results)}
</div>
</body>
</html>`;

        fs.writeFileSync(filePath, htmlContent);
        console.log(` Calling HTML Report: ${filePath}`);
        return filePath;
    }

    // ========== SMS REPORT METHODS ==========

    static async generateSMSExcelReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.aPartyNumber || '';
        const fileName = `SMS_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('SMS Test Results');

        const columns = [
            { header: 'Test Name', key: 'name', width: 30 },
            { header: 'Test Type', key: 'testType', width: 12 },
            { header: 'Message Type', key: 'messageType', width: 12 },
            { header: 'Direction', key: 'direction', width: 12 },
            { header: 'A Party Number', key: 'aPartyNumber', width: 18 },
            { header: 'B Party Number', key: 'bPartyNumber', width: 18 },
            { header: 'Recipient', key: 'recipient', width: 18 },
            { header: 'Group Name', key: 'groupName', width: 20 },
            { header: 'Message', key: 'message', width: 40 },
            { header: 'Before Balance', key: 'beforeBalance', width: 15 },
            { header: 'After Balance', key: 'afterBalance', width: 15 },
            { header: 'Balance Deduction', key: 'balanceDeduction', width: 15 },
            { header: 'Sender MSISDN', key: 'senderMSISDN', width: 18 },
            { header: 'Delivery Time (s)', key: 'deliveryTimeSec', width: 15 },
            { header: 'Delivery Status', key: 'deliveryStatus', width: 15 },
            { header: 'Verification Status', key: 'verificationStatus', width: 18 },
            { header: 'Message Delivered', key: 'messageDelivered', width: 15 },
            { header: 'Total SMS', key: 'totalSMS', width: 10 },
            { header: 'Successful SMS', key: 'successfulSMS', width: 12 },
            { header: 'Failed SMS', key: 'failedSMS', width: 10 },
            { header: 'Test Start Time', key: 'testStartTime', width: 22 },
            { header: 'Test End Time', key: 'testEndTime', width: 22 },
            { header: 'Sender Timestamp', key: 'senderTimestamp', width: 22 },
            { header: 'Receiver Time', key: 'receiverTime', width: 22 },
            { header: 'Final Status', key: 'finalStatus', width: 15 },
            { header: 'Comments', key: 'comments', width: 40 }
        ];

        worksheet.columns = columns;

        // Style header
        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF00008B' }
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        for (const result of results) {
            const finalStatus = this.getStringValue(result.finalStatus);
            
            // Get sender timestamp from nested objects
            let senderTimestamp = '';
            if (result.textResult) {
                senderTimestamp = this.getStringValue(result.textResult.senderTime);
            } else if (result.voiceResult) {
                senderTimestamp = this.getStringValue(result.voiceResult.senderTime);
            }

            const rowData = {
                name: this.getStringValue(result.name),
                testType: this.getStringValue(result.testType),
                messageType: this.getStringValue(result.messageType),
                direction: this.getStringValue(result.direction),
                aPartyNumber: this.getStringValue(result.aPartyNumber),
                bPartyNumber: this.getStringValue(result.bPartyNumber),
                recipient: this.getStringValue(result.recipient),
                groupName: this.getStringValue(result.groupName),
                message: this.getStringValue(result.message),
                beforeBalance: this.getStringValue(result.beforeBalance),
                afterBalance: this.getStringValue(result.afterBalance),
                balanceDeduction: result.balanceDeduction ? `₹${result.balanceDeduction}` : '',
                senderMSISDN: this.getStringValue(result.senderMSISDN),
                deliveryTimeSec: this.getDoubleValue(result.deliveryTimeSec),
                deliveryStatus: this.getStringValue(result.deliveryStatus),
                verificationStatus: this.getStringValue(result.verificationStatus),
                messageDelivered: this.getBooleanValue(result.messageDelivered) ? 'YES' : 'NO',
                totalSMS: this.getIntValue(result.totalSMS),
                successfulSMS: this.getIntValue(result.successfulSMS),
                failedSMS: this.getIntValue(result.failedSMS),
                testStartTime: this.getStringValue(result.testStartTime),
                testEndTime: this.getStringValue(result.testEndTime),
                senderTimestamp: senderTimestamp,
                receiverTime: this.getStringValue(result.receiverTime),
                finalStatus: finalStatus,
                comments: this.getStringValue(result.comments)
            };

            const row = worksheet.addRow(rowData);
            
            // Apply styling
            let fillColor = '';
            if (finalStatus.includes('SUCCESS') && !finalStatus.includes('PARTIAL')) {
                fillColor = 'FF90EE90';
            } else if (finalStatus.includes('FAILED')) {
                fillColor = 'FFFFB6C1';
            } else if (finalStatus.includes('PARTIAL')) {
                fillColor = 'FFFFFFE0';
            }
            
            if (fillColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: fillColor }
                    };
                });
            }
        }

        await workbook.xlsx.writeFile(filePath);
        console.log(` Enhanced SMS Excel Report: ${filePath}`);
        return filePath;
    }

    static async generateSMSTestReport(results: any[], deviceId: string, deviceNumber: string): Promise<string> {
        const dialingNumber = process.env.aPartyNumber || '';
        const fileName = `SMS_Detailed_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.html`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const htmlContent = `
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <title>SMS Test Detailed Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 95%; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .summary { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; position: sticky; top: 0; }
        .success { background-color: #d4edda; }
        .failed { background-color: #f8d7da; }
        .partial { background-color: #fff3cd; }
        .network-info { font-size: 11px; color: #555; }
    </style>
</head>
<body>
<div class='container'>
    <h1>💬 SMS Test Detailed Report</h1>
    ${this.generateEnhancedSMSSummarySection(results, deviceId, deviceNumber)}
    ${this.generateEnhancedSMSTable(results)}
</div>
</body>
</html>`;

        fs.writeFileSync(filePath, htmlContent);
        console.log(` SMS Detailed Report: ${filePath}`);
        return filePath;
    }

    // ========== DATA USAGE REPORT METHODS ==========

    static async generateDataUsageExcelReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.DaPartyNumber || process.env.aPartyNumber || '';
        const fileName = `DataUsage_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Data Usage Results');

        const columns = [
            { header: 'A Party Number', key: 'apartyNumber', width: 18 },
            { header: 'Target Data (GB)', key: 'targetData', width: 15 },
            { header: 'Duration (min)', key: 'duration', width: 12 },
            { header: 'Apps', key: 'appsToUse', width: 30 },
            { header: 'Initial Data', key: 'initialData', width: 15 },
            { header: 'Final Data', key: 'finalData', width: 15 },
            { header: 'Consumed Data', key: 'consumedData', width: 15 },
            { header: 'Target Achieved', key: 'targetAchieved', width: 15 },
            { header: 'APN', key: 'apn', width: 30 },
            { header: 'Network Type', key: 'networkType', width: 15 },
            { header: 'Before Balance', key: 'beforeBalance', width: 15 },
            { header: 'After Balance', key: 'afterBalance', width: 15 },
            { header: 'Balance Deduction', key: 'balanceDeduction', width: 18 },
            { header: 'Final Status', key: 'finalStatus', width: 15 },
            { header: 'Comments', key: 'comments', width: 40 },
            { header: 'Timestamp', key: 'timestamp', width: 22 }
        ];

        worksheet.columns = columns;

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF00008B' }
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });

        for (const result of results) {
            const apnDisplay = `${this.getStringValue(result.apnName)} (${this.getStringValue(result.apn)})`;
            
            const rowData = {
                apartyNumber: this.getStringValue(result.apartyNumber),
                targetData: this.getDoubleValue(result.targetData),
                duration: this.getIntValue(result.duration),
                appsToUse: this.getStringValue(result.appsToUse),
                initialData: this.getStringValue(result.initialData),
                finalData: this.getStringValue(result.finalData),
                consumedData: this.getStringValue(result.consumedData),
                targetAchieved: this.getBooleanValue(result.targetAchieved) ? 'YES' : 'NO',
                apn: apnDisplay,
                networkType: this.getStringValue(result.networkType),
                beforeBalance: this.getStringValue(result.beforeBalance),
                afterBalance: this.getStringValue(result.afterBalance),
                balanceDeduction: result.balanceDeduction ? `₹${result.balanceDeduction}` : '',
                finalStatus: this.getStringValue(result.finalStatus),
                comments: this.getStringValue(result.comments),
                timestamp: this.getStringValue(result.testTimestamp)
            };

            worksheet.addRow(rowData);
        }

        await workbook.xlsx.writeFile(filePath);
        console.log(` Data Usage Excel Report: ${filePath}`);
        return filePath;
    }

    static async generateDataUsageHTMLReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.DaPartyNumber || process.env.aPartyNumber || '';
        const fileName = `DataUsage_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.html`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const htmlContent = `
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <title>Data Usage Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 95%; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; text-align: center; }
        .summary { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; }
        .success { background-color: #d4edda; }
        .failed { background-color: #f8d7da; }
    </style>
</head>
<body>
<div class='container'>
    <h1>🌐 Data Usage Test Report</h1>
    ${this.generateSummarySection(results)}
    ${this.generateDataUsageTable(results)}
</div>
</body>
</html>`;

        fs.writeFileSync(filePath, htmlContent);
        console.log(` Data Usage HTML Report: ${filePath}`);
        return filePath;
    }

    // ========== SIM AUTO-LATCH REPORT METHODS ==========

    static async generateSIMAutoLatchExcelReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.aPartyNumber || '';
        const fileName = `SIM_AutoLatch_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.xlsx`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('SIM Auto-Latch Results');

        const columns = [
            { header: 'Test Name', key: 'name', width: 30 },
            { header: 'Device ID', key: 'deviceId', width: 20 },
            { header: 'Device Type', key: 'deviceType', width: 15 },
            { header: 'Party Number', key: 'partyNumber', width: 18 },
            { header: 'Preferred Network', key: 'preferredNetwork', width: 15 },
            { header: 'Timeout (s)', key: 'timeoutSeconds', width: 12 },
            { header: 'Attempts', key: 'totalAttempts', width: 10 },
            { header: 'Successful Attempts', key: 'successfulAttempts', width: 18 },
            { header: 'Initial Network', key: 'initialNetworkState', width: 18 },
            { header: 'Initial RAT', key: 'initialRAT', width: 12 },
            { header: 'Initial IMS', key: 'initialIMS', width: 12 },
            { header: 'Final Network', key: 'finalNetworkState', width: 18 },
            { header: 'Final RAT', key: 'finalRAT', width: 12 },
            { header: 'Final IMS', key: 'finalIMS', width: 12 },
            { header: 'Auto-Latch Time (ms)', key: 'autoLatchTimeMs', width: 18 },
            { header: 'Auto-Latch Time (s)', key: 'autoLatchTimeSeconds', width: 18 },
            { header: 'Test Result', key: 'testResult', width: 12 },
            { header: 'Transitions', key: 'transitions', width: 30 },
            { header: 'Comments', key: 'comments', width: 40 },
            { header: 'Timestamp', key: 'timestamp', width: 22 }
        ];

        worksheet.columns = columns;

        const headerRow = worksheet.getRow(1);
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF00008B' }
            };
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });

        for (const result of results) {
            const testResult = this.getStringValue(result.testResult);
            
            const rowData = {
                name: this.getStringValue(result.name),
                deviceId: this.getStringValue(result.deviceId),
                deviceType: this.getStringValue(result.deviceType),
                partyNumber: this.getStringValue(result.partyNumber),
                preferredNetwork: this.getStringValue(result.preferredNetwork),
                timeoutSeconds: this.getIntValue(result.timeoutSeconds),
                totalAttempts: this.getIntValue(result.totalAttempts),
                successfulAttempts: this.getIntValue(result.successfulAttempts),
                initialNetworkState: this.getStringValue(result.initialNetworkState),
                initialRAT: this.getStringValue(result.initialRAT),
                initialIMS: this.getBooleanValue(result.initialIMSRegistered) ? '✓' : '✗',
                finalNetworkState: this.getStringValue(result.finalNetworkState),
                finalRAT: this.getStringValue(result.finalRAT),
                finalIMS: this.getBooleanValue(result.finalIMSRegistered) ? '✓' : '✗',
                autoLatchTimeMs: this.getLongValue(result.autoLatchTimeMs),
                autoLatchTimeSeconds: this.getDoubleValue(result.autoLatchTimeSeconds),
                testResult: testResult,
                transitions: this.getStringValue(result.transitions),
                comments: this.getStringValue(result.comments),
                timestamp: this.getStringValue(result.testTimestamp)
            };

            const row = worksheet.addRow(rowData);
            
            // Apply styling based on result
            let fillColor = '';
            if (testResult === 'PASS') {
                fillColor = 'FF90EE90';
            } else if (testResult === 'MARGINAL') {
                fillColor = 'FFFFFFE0';
            } else if (testResult === 'SLOW' || testResult === 'FAIL' || testResult === 'ERROR') {
                fillColor = 'FFFFB6C1';
            }
            
            if (fillColor) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: fillColor }
                    };
                });
            }
        }

        await workbook.xlsx.writeFile(filePath);
        console.log(` SIM Auto-Latch Excel Report: ${filePath}`);
        return filePath;
    }

    static async generateSIMAutoLatchHTMLReport(results: any[]): Promise<string> {
        const dialingNumber = process.env.aPartyNumber || '';
        const fileName = `SIM_AutoLatch_Report_${dialingNumber}_${this.formatDate(new Date(), 'yyyyMMdd_HHmmss')}.html`;
        const filePath = path.join(this.REPORT_DIR, fileName);

        const htmlContent = `
<!DOCTYPE html>
<html lang='en'>
<head>
    <meta charset='UTF-8'>
    <title>SIM Auto-Latch Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 95%; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #333; text-align: center; }
        .summary { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
        th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
        th { background-color: #4CAF50; color: white; }
        .success { background-color: #d4edda; }
        .failed { background-color: #f8d7da; }
        .partial { background-color: #fff3cd; }
    </style>
</head>
<body>
<div class='container'>
    <h1>📡 SIM Auto-Latch Test Report</h1>
    ${this.generateSIMAutoLatchSummarySection(results)}
    ${this.generateSIMAutoLatchTable(results)}
</div>
</body>
</html>`;

        fs.writeFileSync(filePath, htmlContent);
        console.log(` SIM Auto-Latch HTML Report: ${filePath}`);
        return filePath;
    }

    // ========== HTML GENERATION HELPERS ==========

    private static generateEnhancedSummarySection(results: any[]): string {
        if (results.length === 0) {
            return "<div class='summary'><p>No test results available</p></div>";
        }

        const total = results.length;
        const success = results.filter(r => r.finalStatus === 'SUCCESS').length;
        const failed = results.filter(r => r.finalStatus === 'FAILED').length;
        const partial = results.filter(r => r.finalStatus === 'PARTIAL_SUCCESS').length;
        const outgoing = results.filter(r => r.direction === 'OUTGOING').length;
        const incoming = results.filter(r => r.direction === 'INCOMING').length;
        const autoAnswerTests = results.filter(r => this.getBooleanValue(r.autoAnswerEnabled)).length;
        const manualTests = total - autoAnswerTests;
        
        let avgRingTime = 0;
        const ringTimes = results.map(r => this.getIntValue(r.ringTime)).filter(t => t > 0);
        if (ringTimes.length > 0) {
            avgRingTime = ringTimes.reduce((a, b) => a + b, 0) / ringTimes.length;
        }

        return `
<div class='summary'>
    <h3>📊 Test Summary</h3>
    <div style='display: grid; grid-template-columns: 1fr 1fr; gap: 20px;'>
        <div>
            <h4>Overall Results</h4>
            <p><strong>Total Tests:</strong> ${total}</p>
            <p><strong> Success:</strong> ${success}</p>
            <p><strong> Partial:</strong> ${partial}</p>
            <p><strong> Failed:</strong> ${failed}</p>
            <p><strong>Success Rate:</strong> ${((success * 100) / total).toFixed(1)}%</p>
        </div>
        <div>
            <h4>Call Statistics</h4>
            <p><strong>📤 Outgoing:</strong> ${outgoing}</p>
            <p><strong> Incoming:</strong> ${incoming}</p>
            <p><strong>🤖 Auto-Answer:</strong> ${autoAnswerTests}</p>
            <p><strong>👤 Manual:</strong> ${manualTests}</p>
            <p><strong>⏱️ Avg Ring Time:</strong> ${avgRingTime.toFixed(1)}s</p>
        </div>
    </div>
    <p><strong>Generated:</strong> ${this.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
</div>`;
    }

    private static generateSummarySection(results: any[]): string {
        const total = results.length;
        const success = results.filter(r => r.finalStatus === 'SUCCESS').length;
        const failed = total - success;

        return `
<div class='summary'>
    <h3>Test Summary</h3>
    <p><strong>Total Tests:</strong> ${total}</p>
    <p><strong> Successful:</strong> ${success} | <strong> Failed:</strong> ${failed}</p>
    <p><strong>Success Rate:</strong> ${((success * 100) / total).toFixed(2)}%</p>
    <p><strong>Generated:</strong> ${this.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
</div>`;
    }

    private static generateEnhancedCallingTable(results: any[]): string {
        let html = `<table><thead><tr>
            <th>Test Name</th><th>Direction</th><th>From → To</th>
            <th>Ring Time</th><th>Duration</th><th>Auto Answer</th>
            <th>Network</th><th>Call Status</th><th>Final Status</th>
        </tr></thead><tbody>`;

        for (const result of results) {
            const statusClass = this.getStatusClass(this.getStringValue(result.finalStatus));
            const direction = this.getStringValue(result.direction);
            const dirIcon = direction === 'INCOMING' ? '' : '📤';
            const caller = this.getStringValue(result.callerNumber);
            const receiver = this.getStringValue(result.receiverNumber);
            const ringTime = this.getIntValue(result.ringTime);
            const actualDuration = this.getIntValue(result.actualDuration);
            const targetDuration = this.getIntValue(result.duration);
            const autoAnswer = this.getBooleanValue(result.autoAnswerEnabled);
            const autoAnswerIcon = autoAnswer ? ' YES' : '👤 NO';
            const aNetwork = this.cleanNetworkType(this.getStringValue(result.aPartyNetworkType));
            const aVolte = this.getStringValue(result.aPartyVolteEnabled);
            const callStatus = this.getStringValue(result.callStatus);
            const finalStatus = this.getStringValue(result.finalStatus);
            const statusIcon = this.getStatusIcon(finalStatus);

            html += `<tr class='${statusClass}'>
                <td>${this.getStringValue(result.name)}</td>
                <td>${dirIcon} ${direction}</td>
                <td>${caller} → ${receiver}</td>
                <td>${ringTime > 0 ? ringTime + 's' : '-'}</td>
                <td>${actualDuration}s / ${targetDuration}s</td>
                <td>${autoAnswerIcon}</td>
                <td>${aNetwork}${aVolte === 'true' ? ' <span style="color: green;">✓ VoLTE</span>' : ''}</td>
                <td>${callStatus}</td>
                <td><strong>${statusIcon} ${finalStatus}</strong></td>
            </tr>`;
        }

        html += `</tbody></table>`;
        return html;
    }

    private static generateEnhancedSMSSummarySection(results: any[], deviceId: string, deviceNumber: string): string {
        if (results.length === 0) {
            return "<div class='summary'><p>No test results available</p></div>";
        }

        const total = results.length;
        const success = results.filter(r => r.finalStatus === 'SUCCESS').length;
        const partial = results.filter(r => r.finalStatus === 'PARTIAL_SUCCESS').length;
        const failed = results.filter(r => r.finalStatus === 'FAILED').length;
        const error = results.filter(r => r.finalStatus === 'ERROR').length;
        
        const totalSMS = results.reduce((sum, r) => sum + this.getIntValue(r.totalSMS), 0);
        const successfulSMS = results.reduce((sum, r) => sum + this.getIntValue(r.successfulSMS), 0);
        
        const byMessageType = new Map<string, number>();
        const byDirection = new Map<string, number>();
        
        for (const r of results) {
            const msgType = r.messageType || 'sms';
            byMessageType.set(msgType, (byMessageType.get(msgType) || 0) + 1);
            const dir = r.direction || 'UNKNOWN';
            byDirection.set(dir, (byDirection.get(dir) || 0) + 1);
        }

        let messageTypeHtml = '';
        if (byMessageType.size > 0) {
            messageTypeHtml = `<div style='margin-top: 20px;'>
                <h4>Breakdown by Message Type</h4>
                <table style='width: 50%; border-collapse: collapse; font-size: 12px;'>
                    <tr><th>Message Type</th><th>Count</th><th>Percentage</th></tr>`;
            for (const [type, count] of byMessageType) {
                const percentage = (count * 100) / total;
                messageTypeHtml += `<tr><td>${type.toUpperCase()}</td><td>${count}</td><td>${percentage.toFixed(1)}%</td></tr>`;
            }
            messageTypeHtml += `</table></div>`;
        }

        let directionHtml = '';
        if (byDirection.size > 0) {
            directionHtml = `<div style='margin-top: 20px;'>
                <h4>Breakdown by Direction</h4>
                <table style='width: 50%; border-collapse: collapse; font-size: 12px;'>
                    <tr><th>Direction</th><th>Count</th><th>Percentage</th></tr>`;
            for (const [dir, count] of byDirection) {
                const percentage = (count * 100) / total;
                directionHtml += `<tr><td>${dir}</td><td>${count}</td><td>${percentage.toFixed(1)}%</td></tr>`;
            }
            directionHtml += `</table></div>`;
        }

        return `
<div class='summary'>
    <h3>📊 SMS Test Summary</h3>
    <div style='display: flex; justify-content: space-between;'>
        <div style='flex: 1; margin-right: 20px;'>
            <h4>Device Information</h4>
            <p><strong>Device ID:</strong> ${deviceId}</p>
            <p><strong>Device Number:</strong> ${deviceNumber}</p>
            <p><strong>Total Tests:</strong> ${total}</p>
            <p><strong>Generated:</strong> ${this.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
        </div>
        <div style='flex: 1;'>
            <h4>Test Results</h4>
            <p><strong> Success:</strong> ${success}</p>
            <p><strong> Partial Success:</strong> ${partial}</p>
            <p><strong> Failed:</strong> ${failed}</p>
            <p><strong>🚨 Error:</strong> ${error}</p>
            <p><strong>Overall Success Rate:</strong> ${(((success + partial) * 100) / total).toFixed(1)}%</p>
        </div>
    </div>
    <div style='margin-top: 20px;'>
        <h4>SMS Delivery Statistics</h4>
        <p><strong>Total SMS Sent:</strong> ${totalSMS}</p>
        <p><strong>Successful SMS:</strong> ${successfulSMS}</p>
        <p><strong>Failed SMS:</strong> ${totalSMS - successfulSMS}</p>
        <p><strong>SMS Success Rate:</strong> ${totalSMS > 0 ? ((successfulSMS * 100) / totalSMS).toFixed(1) : 'N/A'}%</p>
    </div>
    ${messageTypeHtml}
    ${directionHtml}
</div>`;
    }

    private static generateEnhancedSMSTable(results: any[]): string {
        let html = `<table><thead><tr>
            <th>Test Name</th><th>Type</th><th>Direction</th><th>Recipient/Group</th>
            <th>SMS Count</th><th>Successful</th><th>Failed</th><th>Sender Time</th>
            <th>Receiver Time/Status</th><th>Network</th>
            <th>Device</th><th>Final Status</th><th>Timestamp</th>
        </tr></thead><tbody>`;

        for (const result of results) {
            const statusClass = this.getStatusClass(this.getStringValue(result.finalStatus));
            const messageType = this.getStringValue(result.messageType);
            const typeIcon = messageType === 'voice' ? '🎤' : (messageType === 'mms' ? '🖼️' : '📝');
            const direction = this.getStringValue(result.direction);
            const directionIcon = direction === 'INCOMING' ? '' : (direction === 'OUTGOING' ? '📤' : '↔️');
            const isIndividual = this.getBooleanValue(result.isIndividual);
            
            let recipientHtml = '';
            if (isIndividual) {
                recipientHtml = this.getStringValue(result.recipient);
            } else {
                const groupName = this.getStringValue(result.groupName);
                const participants = this.getIntValue(result.participantCount);
                recipientHtml = `${groupName}<div class='network-info'>${participants} participants</div>`;
            }
            
            const totalSMS = this.getIntValue(result.totalSMS);
            const successfulSMS = this.getIntValue(result.successfulSMS);
            const failedSMS = this.getIntValue(result.failedSMS);
            
            // Get receiver time display
            const receiverTime = this.getStringValue(result.receiverTime);
            const verificationStatus = this.getStringValue(result.verificationStatus);
            const deliveryStatus = this.getStringValue(result.deliveryStatus);
            
            let receiverDisplay = 'N/A';
            if (receiverTime && receiverTime !== 'N/A') {
                if (receiverTime === 'DEVICE_UNAVAILABLE') {
                    receiverDisplay = '<span style="color: orange;"> DEVICE_UNAVAILABLE</span>';
                } else {
                    receiverDisplay = receiverTime;
                }
            } else if (verificationStatus) {
                receiverDisplay = this.getVerificationStatusDisplay(verificationStatus);
            } else if (deliveryStatus) {
                receiverDisplay = this.getDeliveryStatusDisplay(deliveryStatus);
            }
            
            // Get sender timestamp
            let senderTimestamp = '';
            if (result.textResult) {
                senderTimestamp = this.getStringValue(result.textResult.senderTime);
            } else if (result.voiceResult) {
                senderTimestamp = this.getStringValue(result.voiceResult.senderTime);
            }
            
            const finalStatus = this.getStringValue(result.finalStatus);
            const statusIcon = finalStatus.includes('SUCCESS') && !finalStatus.includes('PARTIAL') ? '' :
                              (finalStatus.includes('PARTIAL') ? '' :
                              (finalStatus.includes('FAILED') ? '' : '🚨'));

            html += `<tr class='${statusClass}'>
                <td>${this.getStringValue(result.name)}</td>
                <td>${typeIcon} ${messageType.toUpperCase()}</td>
                <td>${directionIcon} ${direction}</td>
                <td>${recipientHtml}</td>
                <td>${totalSMS}</td>
                <td>${successfulSMS}</td>
                <td>${failedSMS}</td>
                <td>${senderTimestamp}</td>
                <td>${receiverDisplay}</td>
                <td>${this.getStringValue(result.networkType)}</td>
                <td>${this.getStringValue(result.deviceNumber)}<div class='network-info'>${this.getStringValue(result.deviceId)}</div></td>
                <td><strong>${statusIcon} ${finalStatus}</strong></td>
                <td>${this.getStringValue(result.testTimestamp)}</td>
            </tr>`;
        }

        html += `</tbody></table>`;
        return html;
    }

    private static generateDataUsageTable(results: any[]): string {
        let html = `<table><thead><tr>
            <th>Scenario</th><th>A Party Number</th><th>Target (GB)</th><th>Duration (min)</th><th>Consumed</th>
            <th>Target Achieved</th><th>Network</th><th>Final Status</th><th>Comments</th>
        </tr></thead><tbody>`;

        for (const result of results) {
            const statusClass = this.getStatusClass(this.getStringValue(result.finalStatus));
            html += `<tr class='${statusClass}'>
                <td>${this.getStringValue(result.apartyNumber)}</td>
                <td>${this.getDoubleValue(result.targetData)}</td>
                <td>${this.getIntValue(result.duration)}</td>
                <td>${this.getStringValue(result.consumedData)}</td>
                <td>${this.getBooleanValue(result.targetAchieved) ? 'YES' : 'NO'}</td>
                <td>${this.getStringValue(result.networkType)}</td>
                <td><strong>${this.getStringValue(result.finalStatus)}</strong></td>
                <td>${this.getStringValue(result.comments)}</td>
            </tr>`;
        }

        html += `</tbody></table>`;
        return html;
    }

    private static generateSIMAutoLatchSummarySection(results: any[]): string {
        if (results.length === 0) {
            return "<div class='summary'><p>No test results available</p></div>";
        }

        const total = results.length;
        const pass = results.filter(r => r.testResult === 'PASS').length;
        const marginal = results.filter(r => r.testResult === 'MARGINAL').length;
        const slow = results.filter(r => r.testResult === 'SLOW').length;
        const failed = results.filter(r => r.testResult === 'FAIL' || r.testResult === 'ERROR').length;
        
        const successfulTimes = results
            .filter(r => r.testResult !== 'FAIL' && r.testResult !== 'ERROR' && r.autoLatchTimeSeconds > 0)
            .map(r => this.getDoubleValue(r.autoLatchTimeSeconds));
        
        const avgTime = successfulTimes.length > 0 ? 
            successfulTimes.reduce((a, b) => a + b, 0) / successfulTimes.length : 0;

        return `
<div class='summary'>
    <h3>Test Summary</h3>
    <p><strong>Total Tests:</strong> ${total}</p>
    <p><strong> Pass (<30s):</strong> ${pass} | <strong> Marginal (30-60s):</strong> ${marginal} | 
       <strong>🐌 Slow (>60s):</strong> ${slow} | <strong> Failed:</strong> ${failed}</p>
    <p><strong>Success Rate:</strong> ${(((pass + marginal) * 100) / total).toFixed(2)}%</p>
    <p><strong>Average Auto-Latch Time:</strong> ${avgTime.toFixed(2)} seconds</p>
    <p><strong>Generated:</strong> ${this.formatDate(new Date(), 'yyyy-MM-dd HH:mm:ss')}</p>
</div>`;
    }

    private static generateSIMAutoLatchTable(results: any[]): string {
        let html = `<table><thead><tr>
            <th>Test Name</th><th>Device</th><th>Network</th><th>Auto-Latch Time</th>
            <th>Result</th><th>Initial State</th><th>Final State</th><th>IMS</th>
            <th>Transitions</th><th>Comments</th>
        </tr></thead><tbody>`;

        for (const result of results) {
            const resultClass = this.getSIMAutoLatchStatusClass(this.getStringValue(result.testResult));
            const imsInitial = this.getBooleanValue(result.initialIMSRegistered);
            const imsFinal = this.getBooleanValue(result.finalIMSRegistered);
            const timeMs = this.getLongValue(result.autoLatchTimeMs);
            const timeSec = this.getDoubleValue(result.autoLatchTimeSeconds);
            
            let timeStatus = '';
            if (timeMs > 0) {
                if (timeMs <= 30000) timeStatus = '<small>✓ Fast (<30s)</small>';
                else if (timeMs <= 60000) timeStatus = '<small>⚠ Acceptable</small>';
                else timeStatus = '<small>✗ Slow (>60s)</small>';
            }

            html += `<tr class='${resultClass}'>
                <td>${this.getStringValue(result.name)}</td>
                <td>${this.getStringValue(result.deviceType)}<div class='network-info'>${this.getStringValue(result.deviceId)}</div></td>
                <td>${this.getStringValue(result.preferredNetwork)}</td>
                <td>${timeMs} ms<br>(${timeSec.toFixed(2)}s)<br>${timeStatus}</td>
                <td><strong>${this.getStringValue(result.testResult)}</strong></td>
                <td>${this.getStringValue(result.initialNetworkState)}<div class='network-info'>${this.getStringValue(result.initialRAT)} | IMS: ${imsInitial ? '✓' : '✗'}</div></td>
                <td>${this.getStringValue(result.finalNetworkState)}<div class='network-info'>${this.getStringValue(result.finalRAT)} | IMS: ${imsFinal ? '✓' : '✗'}</div></td>
                <td>${imsInitial ? '✓' : '✗'} → ${imsFinal ? '✓' : '✗'}</td>
                <td><small>${this.getStringValue(result.transitions)}</small></td>
                <td>${this.getStringValue(result.comments)}</td>
            </tr>`;
        }

        html += `</tbody></table>`;
        return html;
    }

    // ========== STATUS HELPER METHODS ==========

    private static getStatusIcon(status: string): string {
        if (status.includes('SUCCESS') && !status.includes('PARTIAL')) return '';
        if (status.includes('PARTIAL')) return '';
        if (status.includes('FAILED')) return '';
        return '❓';
    }

    private static getStatusClass(status: string): string {
        if (status.includes('SUCCESS') && !status.includes('PARTIAL')) return 'success';
        if (status.includes('FAILED')) return 'failed';
        if (status.includes('PARTIAL')) return 'partial';
        return '';
    }

    private static getSIMAutoLatchStatusClass(status: string): string {
        if (status === 'PASS') return 'success';
        if (status === 'MARGINAL') return 'partial';
        if (status === 'SLOW' || status === 'FAIL' || status === 'ERROR') return 'failed';
        return '';
    }

    private static getVerificationStatusDisplay(status: string): string {
        switch (status) {
            case 'DEVICE_UNAVAILABLE':
                return '<span style="color: orange;"> Device Unavailable</span>';
            case 'NOT_RECEIVED':
                return '<span style="color: red;"> Not Received</span>';
            case 'RECEIVED_VIA_NOTIFICATION':
                return '<span style="color: green;"> Received (Notification)</span>';
            case 'RECEIVED_IN_CONVERSATION':
                return '<span style="color: green;"> Received (Conversation)</span>';
            case 'VERIFICATION_ERROR':
                return '<span style="color: red;">🚨 Verification Error</span>';
            case 'UNVERIFIED':
                return '<span style="color: gray;">❓ Unverified</span>';
            default:
                return status;
        }
    }

    private static getDeliveryStatusDisplay(status: string): string {
        switch (status) {
            case 'SUCCESS':
                return '<span style="color: green;"> Success</span>';
            case 'FAILED_SLA':
                return '<span style="color: orange;"> Failed SLA</span>';
            case 'DEVICE_UNAVAILABLE':
                return '<span style="color: orange;"> Device Unavailable</span>';
            case 'UNVERIFIED':
                return '<span style="color: gray;">❓ Unverified</span>';
            default:
                return status;
        }
    }

    // ========== VALUE HELPERS ==========

    private static getStringValue(value: any): string {
        return value === null || value === undefined ? '' : String(value);
    }

    private static getIntValue(value: any): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return Math.floor(value);
        const parsed = parseInt(String(value), 10);
        return isNaN(parsed) ? 0 : parsed;
    }

    private static getDoubleValue(value: any): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        const parsed = parseFloat(String(value));
        return isNaN(parsed) ? 0 : parsed;
    }

    private static getLongValue(value: any): number {
        return this.getIntValue(value);
    }

    private static getBooleanValue(value: any): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'boolean') return value;
        const strVal = String(value).toLowerCase();
        return strVal === 'true' || strVal === 'yes' || strVal === '1';
    }

    private static cleanNetworkType(networkType: string): string {
        if (!networkType || networkType.length === 0) {
            return 'Unknown';
        }
        
        let cleaned = networkType.replace(/,\s*(Unknown|UNKNOWN|unknown)\s*$/, '');
        cleaned = cleaned.replace(/^,\s*|\s*,$/g, '');
        
        if (cleaned.trim().length === 0) {
            return 'Unknown';
        }
        
        return cleaned.trim();
    }
}