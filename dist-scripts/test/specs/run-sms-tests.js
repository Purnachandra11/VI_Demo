"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DriverManager_1 = require("./test/driver/DriverManager");
const MessagingPage_1 = require("./test/pages/MessagingPage");
const MessageVerifier_1 = require("./test/verification/MessageVerifier");
const DeviceManager_1 = require("./test/utils/DeviceManager");
const child_process_1 = require("child_process");
async function runSMSTests() {
    try {
        console.log('='.repeat(80));
        console.log('🚀 Starting SMS Tests');
        console.log('='.repeat(80));
        // Configuration - UPDATE THESE WITH YOUR ACTUAL VALUES
        const deviceId = 'ZA2237FKXH'; // Your device ID from 'adb devices'
        const aPartyNumber = '9876543210'; // Your A-Party number (sender)
        const bPartyNumber = '9640571324'; // Your B-Party number (recipient)
        console.log(`📱 Device ID: ${deviceId}`);
        console.log(`📞 A-Party (Sender): ${aPartyNumber}`);
        console.log(`📞 B-Party (Recipient): ${bPartyNumber}`);
        // Step 1: Check ADB connectivity
        console.log('\n🔍 Step 1: Checking ADB connectivity...');
        try {
            const adbOutput = (0, child_process_1.execSync)(`adb devices`, { encoding: 'utf8' });
            console.log(adbOutput);
            if (!adbOutput.includes(deviceId)) {
                throw new Error(`Device ${deviceId} not found. Please check USB connection and debugging.`);
            }
            console.log(`✅ Device ${deviceId} is connected`);
        }
        catch (error) {
            console.error('❌ ADB check failed:', error);
            throw new Error('ADB not available or device not connected');
        }
        // Step 2: Initialize device
        console.log('\n🔧 Step 2: Initializing Device Manager...');
        try {
            DeviceManager_1.DeviceManager.initializeDevices(deviceId, aPartyNumber);
            console.log('✅ Device Manager initialized');
        }
        catch (error) {
            console.error('❌ Device Manager initialization failed:', error);
            throw error;
        }
        // Step 3: Start Appium
        console.log('\n🚀 Step 3: Starting Appium service...');
        try {
            await DriverManager_1.DriverManager.startAppiumService();
            console.log('✅ Appium service started');
        }
        catch (error) {
            console.error('❌ Appium service failed to start:', error);
            throw error;
        }
        // Step 4: Create driver
        console.log('\n📱 Step 4: Creating driver for messaging...');
        let driver;
        try {
            driver = await DriverManager_1.DriverManager.initializeDriverForMessaging(deviceId, '13');
            if (!driver) {
                throw new Error('Driver creation returned null/undefined');
            }
            console.log('✅ Driver created successfully');
        }
        catch (error) {
            console.error('❌ Driver creation failed:', error);
            throw error;
        }
        // Step 5: Create page objects
        console.log('\n📄 Step 5: Initializing page objects...');
        const messagingPage = new MessagingPage_1.MessagingPage(driver, deviceId);
        const verifier = new MessageVerifier_1.MessageVerifier(driver);
        console.log('✅ Page objects initialized');
        console.log('\n' + '='.repeat(80));
        console.log('✅ Setup complete! Starting tests...');
        console.log('='.repeat(80) + '\n');
        // Test 1: Send Individual SMS
        console.log('='.repeat(80));
        console.log('📱 Test 1: Send Individual SMS');
        console.log('='.repeat(80));
        const timestamp = new Date();
        const testMessage = `Test SMS at ${timestamp.toLocaleTimeString()} - ${timestamp.getTime()}`;
        console.log(`\n📝 Sending message: "${testMessage}"`);
        let smsSent = false;
        try {
            smsSent = await messagingPage.sendIndividualSMS(bPartyNumber, testMessage);
            console.log(`📤 SMS Send Result: ${smsSent ? 'SUCCESS' : 'FAILED'}`);
        }
        catch (error) {
            console.error('❌ Error sending SMS:', error);
            smsSent = false;
        }
        if (smsSent) {
            console.log('✅ SMS Sent successfully!');
            // Wait a moment for the database to update
            console.log('⏳ Waiting 3 seconds for database update...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            // Verify the message was sent
            console.log('\n🔍 Verifying message in database...');
            verifier.setRecipientNumber(bPartyNumber);
            let verified = false;
            try {
                verified = await verifier.verifyMessageSent(testMessage);
                console.log(`✅ Message Verified: ${verified ? 'YES' : 'NO'}`);
            }
            catch (error) {
                console.error('❌ Verification error:', error);
                verified = false;
            }
            // Get timestamp details
            console.log('\n📊 Getting message details...');
            try {
                const sentInfo = await verifier.getLatestSentMessage();
                if (sentInfo) {
                    console.log(`📅 Sent at: ${sentInfo.getFormattedDate()}`);
                    console.log(`📝 Message body: ${sentInfo.body}`);
                    console.log(`📱 To: ${sentInfo.address}`);
                }
                else {
                    console.log('⚠️ Could not retrieve message details');
                }
            }
            catch (error) {
                console.error('❌ Error getting message details:', error);
            }
            // Final result
            console.log('\n' + '='.repeat(80));
            if (verified) {
                console.log('✅ TEST PASSED: SMS sent and verified successfully!');
            }
            else {
                console.log('⚠️ TEST PARTIAL: SMS sent but verification failed');
            }
            console.log('='.repeat(80));
        }
        else {
            console.log('\n' + '='.repeat(80));
            console.log('❌ TEST FAILED: Could not send SMS');
            console.log('='.repeat(80));
        }
        // Cleanup
        console.log('\n🧹 Cleaning up resources...');
        try {
            await DriverManager_1.DriverManager.quitDriver();
            console.log('✅ Driver quit successfully');
        }
        catch (error) {
            console.error('⚠️ Error quitting driver:', error);
        }
        try {
            await DriverManager_1.DriverManager.stopAppiumService();
            console.log('✅ Appium service stopped');
        }
        catch (error) {
            console.error('⚠️ Error stopping Appium:', error);
        }
        console.log('\n' + '='.repeat(80));
        console.log('🏁 Test execution completed');
        console.log('='.repeat(80));
        // Exit with appropriate code
        if (!smsSent) {
            process.exit(1);
        }
    }
    catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('❌ CRITICAL ERROR: Test execution failed');
        console.error('='.repeat(80));
        console.error('Error details:', error);
        if (error instanceof Error) {
            console.error('\n📋 Stack trace:');
            console.error(error.stack);
        }
        // Try to cleanup even on error
        console.log('\n🧹 Attempting cleanup...');
        try {
            await DriverManager_1.DriverManager.quitDriver();
        }
        catch (cleanupError) {
            console.error('Cleanup error (driver):', cleanupError);
        }
        try {
            await DriverManager_1.DriverManager.stopAppiumService();
        }
        catch (cleanupError) {
            console.error('Cleanup error (Appium):', cleanupError);
        }
        console.log('\n💡 Troubleshooting tips:');
        console.log('   1. Make sure device is connected: adb devices');
        console.log('   2. Check Appium is installed: appium --version');
        console.log('   3. Verify Google Messages app is installed');
        console.log('   4. Check USB debugging is enabled');
        console.log('   5. Run: adb kill-server && adb start-server');
        process.exit(1);
    }
}
// Run the tests with unhandled rejection handling
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});
runSMSTests();
