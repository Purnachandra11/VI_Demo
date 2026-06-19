"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageVerifier = void 0;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * SMS type constants
 */
const SMS_TYPE = {
    INBOX: 1,
    SENT: 2
};
const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    // fractionalSecondDigits: 3,
    hour12: false
});
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    const ms = String(date.getMilliseconds()).padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms}`;
}
class MessageVerifier {
    constructor(arg1, arg2) {
        if (typeof arg1 === 'string' && typeof arg2 === 'string') {
            this.deviceSerial = arg1;
            this.recipientNumber = arg2;
        }
        else {
            // AndroidDriver constructor - extract device serial
            this.deviceSerial = this.extractDeviceSerial(arg1);
            this.recipientNumber = '';
        }
    }
    /**
     * Extract device serial from AndroidDriver or capabilities
     */
    extractDeviceSerial(driver) {
        try {
            // Try to get UDID from capabilities
            if (driver === null || driver === void 0 ? void 0 : driver.capabilities) {
                const udid = driver.capabilities['appium:udid'] ||
                    driver.capabilities['udid'];
                if (udid && typeof udid === 'string' && udid.trim()) {
                    console.log(`   📱 Device serial (UDID): ${udid}`);
                    return udid;
                }
            }
        }
        catch (e) {
            // Continue to fallback
        }
        // Fallback: Get first connected device via ADB
        try {
            const { execSync } = require('child_process');
            const output = execSync('adb devices', { encoding: 'utf8' });
            const lines = output.split('\n');
            for (const line of lines) {
                if (line.includes('device') && !line.includes('List of devices')) {
                    const serial = line.split(/\s+/)[0];
                    if (serial && serial.trim()) {
                        console.log(`   📱 Using first available device: ${serial}`);
                        return serial;
                    }
                }
            }
        }
        catch (e) {
            console.error('Failed to get device via ADB:', e);
        }
        throw new Error('Could not extract device serial');
    }
    /**
     * Set recipient number for verification
     */
    setRecipientNumber(recipientNumber) {
        this.recipientNumber = recipientNumber;
    }
    /**
     * Get current device serial
     */
    getDeviceSerial() {
        return this.deviceSerial;
    }
    /**
     * VERIFY MESSAGE SENT - Basic version
     */
    async verifyMessageSent(expectedMessageBody) {
        if (!this.recipientNumber) {
            console.log('❌ Recipient number not set for verification');
            return false;
        }
        if (!this.deviceSerial) {
            console.log('❌ Device serial not available for verification');
            return false;
        }
        console.log('🔍 Verifying SENT message via ADB...');
        console.log(`   Device: ${this.deviceSerial}`);
        console.log(`   Recipient: ${this.recipientNumber}`);
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/sent --where "address='${this.recipientNumber}'" --sort "date DESC" --limit 1`;
            console.log('   Executing:', command);
            const result = await this.executeAdbCommand(command);
            if (result && result.trim() && !result.includes('No result') && result.includes('Row:')) {
                const smsInfo = this.parseSentSmsResult(result);
                if (smsInfo) {
                    console.log('   ✓ Found SENT message at:', smsInfo.getFormattedDate());
                    if (expectedMessageBody && expectedMessageBody.trim()) {
                        if (smsInfo.body && smsInfo.body === expectedMessageBody) {
                            return true;
                        }
                        else {
                            console.log('   ✗ Message body mismatch!');
                            return false;
                        }
                    }
                    return true;
                }
            }
            console.log('   ✗ No sent messages found to:', this.recipientNumber);
            return false;
        }
        catch (error) {
            console.error('❌ Verification error:', error instanceof Error ? error.message : error);
            return false;
        }
    }
    /**
     * VERIFY MESSAGE SENT WITH TIMESTAMP - Returns SentSmsInfo object
     */
    async verifyMessageSentWithTimestamp(expectedMessageBody) {
        if (!this.recipientNumber) {
            console.log('❌ Recipient number not set for verification');
            return null;
        }
        if (!this.deviceSerial) {
            console.log('❌ Device serial not available for verification');
            return null;
        }
        console.log('🔍 Verifying sent message with timestamp via ADB...');
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/sent --where "address='${this.recipientNumber}'" --sort "date DESC" --limit 1`;
            const result = await this.executeAdbCommand(command);
            if (result && result.trim() && !result.includes('No result') && result.includes('Row:')) {
                const smsInfo = this.parseSentSmsResult(result);
                if (smsInfo) {
                    console.log('   ✓ Found sent message at:', smsInfo.getFormattedDate());
                    if (expectedMessageBody && expectedMessageBody.trim()) {
                        if (smsInfo.body && smsInfo.body === expectedMessageBody) {
                            return smsInfo;
                        }
                        else {
                            console.log('   ✗ Message body mismatch!');
                            return null;
                        }
                    }
                    return smsInfo;
                }
            }
            console.log('   ✗ No sent messages found to:', this.recipientNumber);
            return null;
        }
        catch (error) {
            console.error('❌ Verification error:', error instanceof Error ? error.message : error);
            return null;
        }
    }
    /**
     * GET LATEST SENT MESSAGE
     */
    async getLatestSentMessage() {
        if (!this.recipientNumber || !this.deviceSerial) {
            return null;
        }
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/sent --where "address='${this.recipientNumber}'" --sort "date DESC" --limit 1`;
            const result = await this.executeAdbCommand(command);
            if (result && result.includes('Row:')) {
                return this.parseSentSmsResult(result);
            }
        }
        catch (error) {
            console.error('Error getting latest sent message:', error);
        }
        return null;
    }
    /**
     * VERIFY MESSAGE RECEIVED
     */
    async verifyMessageReceived(expectedMessageBody, threadId) {
        if (!this.deviceSerial) {
            console.log('❌ Device serial not available for verification');
            return false;
        }
        console.log('🔍 Verifying RECEIVED message via ADB...');
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms --where "thread_id=${threadId}" --projection _id:address:body:type:date --sort "date DESC" --limit 1`;
            const result = await this.executeAdbCommand(command);
            if (result && result.trim() && result.includes('Row:')) {
                const smsInfo = this.parseReceivedSmsResult(result);
                if (smsInfo && smsInfo.type === SMS_TYPE.INBOX) {
                    console.log('   ✓ Found RECEIVED message at:', smsInfo.getFormattedDate());
                    if (expectedMessageBody && expectedMessageBody.trim()) {
                        if (smsInfo.body && smsInfo.body === expectedMessageBody) {
                            return true;
                        }
                    }
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            console.error('❌ Verification error:', error);
            return false;
        }
    }
    /**
     * VERIFY MESSAGE RECEIVED BY ADDRESS
     */
    async verifyMessageReceivedByAddress(expectedMessageBody, senderAddress) {
        if (!this.deviceSerial) {
            console.log('❌ Device serial not available for verification');
            return false;
        }
        console.log('🔍 Verifying RECEIVED message by address via ADB...');
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/inbox --where "address='${senderAddress}'" --projection _id:address:body:type:date --sort "date DESC" --limit 1`;
            const result = await this.executeAdbCommand(command);
            if (result && result.trim() && result.includes('Row:')) {
                const smsInfo = this.parseReceivedSmsResult(result);
                if (smsInfo && smsInfo.type === SMS_TYPE.INBOX) {
                    console.log('   ✓ Found RECEIVED message at:', smsInfo.getFormattedDate());
                    if (expectedMessageBody && expectedMessageBody.trim()) {
                        if (smsInfo.body && smsInfo.body === expectedMessageBody) {
                            return true;
                        }
                    }
                    return true;
                }
            }
            return false;
        }
        catch (error) {
            console.error('❌ Verification error:', error);
            return false;
        }
    }
    /**
     * GET THREAD ID for a specific address
     */
    async getThreadId(address) {
        if (!this.deviceSerial) {
            console.log('❌ Device serial not available');
            return -1;
        }
        try {
            let command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/sent --where "address='${address}'" --projection thread_id --limit 1`;
            let result = await this.executeAdbCommand(command);
            if (result && result.includes('thread_id=')) {
                const threadId = this.parseThreadId(result);
                if (threadId > 0) {
                    return threadId;
                }
            }
            command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/inbox --where "address='${address}'" --projection thread_id --limit 1`;
            result = await this.executeAdbCommand(command);
            if (result && result.includes('thread_id=')) {
                const threadId = this.parseThreadId(result);
                if (threadId > 0) {
                    return threadId;
                }
            }
            return -1;
        }
        catch (error) {
            console.error('❌ Error getting thread ID:', error);
            return -1;
        }
    }
    /**
     * GET ALL SENT MESSAGES
     */
    async getAllSentMessages(address) {
        const messages = [];
        if (!this.deviceSerial) {
            return messages;
        }
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms/sent --projection address:body:date --where "address='${address}'" --sort "date DESC"`;
            const result = await this.executeAdbCommand(command);
            if (result && result.trim() && result.includes('Row:')) {
                const lines = result.split('\n');
                for (const line of lines) {
                    if (line.trim().startsWith('Row:')) {
                        const smsInfo = this.parseSentSmsResult(line);
                        if (smsInfo) {
                            messages.push(smsInfo);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.error('Error getting sent messages:', error);
        }
        return messages;
    }
    /**
     * CALCULATE DELIVERY TIME
     */
    async calculateDeliveryTime(threadId) {
        const sentInfo = await this.getLatestSentMessage();
        if (!sentInfo) {
            console.log('❌ Could not calculate delivery time - no sent message found');
            return -1;
        }
        // Get received message
        if (!this.deviceSerial) {
            return -1;
        }
        try {
            const command = `adb -s ${this.deviceSerial} shell content query --uri content://sms --where "thread_id=${threadId}" --projection _id:address:body:type:date --sort "date DESC" --limit 1`;
            const result = await this.executeAdbCommand(command);
            if (result && result.includes('Row:')) {
                const receivedInfo = this.parseReceivedSmsResult(result);
                if (receivedInfo && receivedInfo.type === SMS_TYPE.INBOX) {
                    const deliveryTime = receivedInfo.date - sentInfo.date;
                    console.log('📊 Message Delivery Analysis:');
                    console.log('   Sent at:', sentInfo.getFormattedDate());
                    console.log('   Received at:', receivedInfo.getFormattedDate());
                    console.log('   Delivery time:', deliveryTime, 'ms (', (deliveryTime / 1000).toFixed(2), 'seconds)');
                    return deliveryTime;
                }
            }
        }
        catch (error) {
            console.error('Error calculating delivery time:', error);
        }
        return -1;
    }
    // ==================== PRIVATE HELPER METHODS ====================
    async executeAdbCommand(command) {
        try {
            const { stdout, stderr } = await execAsync(command);
            if (stderr && !stderr.includes('Warning')) {
                console.error('   ADB command error:', stderr);
                return '';
            }
            return stdout.trim();
        }
        catch (error) {
            if (error instanceof Error) {
                console.error('   Error executing ADB command:', error.message);
            }
            return '';
        }
    }
    parseSentSmsResult(result) {
        try {
            const addressMatch = result.match(/address=([^,]+)/);
            const bodyMatch = result.match(/body=([^,]+?)(?:, date=|$)/);
            const dateMatch = result.match(/date=(\d+)/);
            if (addressMatch) {
                const info = {
                    address: addressMatch[1].trim(),
                    body: bodyMatch ? bodyMatch[1].trim() : '',
                    date: dateMatch ? parseInt(dateMatch[1], 10) : 0,
                    getFormattedDate: function () {
                        return formatDate(this.date);
                    }
                };
                return info;
            }
            return null;
        }
        catch (error) {
            console.error('   Error parsing sent SMS:', error);
            return null;
        }
    }
    parseReceivedSmsResult(result) {
        try {
            const idMatch = result.match(/_id=(\d+)/);
            const addressMatch = result.match(/address=([^,]+)/);
            const bodyMatch = result.match(/body=([^,]+?)(?:, type=|, date=|$)/);
            const typeMatch = result.match(/type=(\d+)/);
            const dateMatch = result.match(/date=(\d+)/);
            if (idMatch && addressMatch) {
                const info = {
                    id: parseInt(idMatch[1], 10),
                    address: addressMatch[1].trim(),
                    body: bodyMatch ? bodyMatch[1].trim() : '',
                    type: typeMatch ? parseInt(typeMatch[1], 10) : 0,
                    date: dateMatch ? parseInt(dateMatch[1], 10) : 0,
                    getFormattedDate: function () {
                        return formatDate(this.date);
                    },
                    isReceived: function () {
                        return this.type === 1;
                    }
                };
                return info;
            }
            return null;
        }
        catch (error) {
            console.error('   Error parsing received SMS:', error);
            return null;
        }
    }
    parseThreadId(result) {
        try {
            const match = result.match(/thread_id=(\d+)/);
            if (match) {
                return parseInt(match[1], 10);
            }
        }
        catch (error) {
            console.error('   Error parsing thread ID:', error);
        }
        return -1;
    }
}
exports.MessageVerifier = MessageVerifier;
exports.default = MessageVerifier;
