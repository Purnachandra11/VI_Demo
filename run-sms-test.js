const { DriverManager } = require('./test/driver/DriverManager');
const { MessagingPage } = require('./test/pages/MessagingPage');
const { MessageVerifier } = require('./test/verification/MessageVerifier');
const { DeviceManager } = require('./test/utils/DeviceManager');
const { execSync } = require('child_process');

async function runSMSTests() {
    try {
        console.log('='.repeat(80));
        console.log('🚀 Starting SMS Tests');
        console.log('='.repeat(80));
        
        // Configuration - UPDATE THESE VALUES
        const deviceId = 'ZA2237FKXH';
        const aPartyNumber = '9876543210';
        const bPartyNumber = '9640571324';
        
        console.log(`📱 Device ID: ${deviceId}`);
        console.log(`📞 A-Party (Sender): ${aPartyNumber}`);
        console.log(`📞 B-Party (Recipient): ${bPartyNumber}`);
        
        // Step 1: Check ADB
        console.log('\n🔍 Step 1: Checking ADB connectivity...');
        try {
            const adbOutput = execSync('adb devices', { encoding: 'utf8' });
            console.log(adbOutput);
            
            if (!adbOutput.includes(deviceId)) {
                throw new Error(`Device ${deviceId} not found`);
            }
            console.log(`✅ Device ${deviceId} is connected`);
        } catch (error) {
            console.error('❌ ADB check failed:', error.message);
            console.log('\n💡 Fix: Make sure device is connected and USB debugging is enabled');
            return;
        }
        
        // Step 2: Initialize Device Manager
        console.log('\n🔧 Step 2: Initializing Device Manager...');
        DeviceManager.initializeDevices(deviceId, aPartyNumber);
        console.log('✅ Device Manager initialized');
        
        // Step 3: Start Appium
        console.log('\n🚀 Step 3: Starting Appium service...');
        await DriverManager.startAppiumService();
        console.log('✅ Appium service started');
        
        // Step 4: Create driver
        console.log('\n📱 Step 4: Creating driver...');
        const driver = await DriverManager.initializeDriverForMessaging(deviceId, '13');
        
        if (!driver) {
            throw new Error('Failed to create driver');
        }
        console.log('✅ Driver created');
        
        // Step 5: Initialize page objects
        console.log('\n📄 Step 5: Initializing page objects...');
        const messagingPage = new MessagingPage(driver, deviceId);
        const verifier = new MessageVerifier(driver);
        console.log('✅ Ready to test');
        
        // Test: Send SMS
        console.log('\n' + '='.repeat(80));
        console.log('📱 Sending Individual SMS');
        console.log('='.repeat(80));
        
        const testMessage = `Test at ${new Date().toLocaleTimeString()}`;
        console.log(`Message: "${testMessage}"`);
        
        const result = await messagingPage.sendIndividualSMS(bPartyNumber, testMessage);
        
        if (result) {
            console.log('✅ SMS sent!');
            
            // Verify
            verifier.setRecipientNumber(bPartyNumber);
            const verified = await verifier.verifyMessageSent(testMessage);
            console.log(`Verified: ${verified}`);
            
            // Get timestamp
            const sentInfo = await verifier.getLatestSentMessage();
            if (sentInfo) {
                console.log(`Time: ${sentInfo.getFormattedDate()}`);
            }
        } else {
            console.log('❌ Send failed');
        }
        
        // Cleanup
        console.log('\n🧹 Cleaning up...');
        await DriverManager.quitDriver();
        await DriverManager.stopAppiumService();
        
        console.log('\n✅ Test complete');
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        if (error.stack) console.error(error.stack);
        
        // Cleanup on error
        try {
            await DriverManager.quitDriver();
            await DriverManager.stopAppiumService();
        } catch (e) {}
        
        process.exit(1);
    }
}

runSMSTests();
