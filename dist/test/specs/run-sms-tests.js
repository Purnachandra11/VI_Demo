"use strict";
/**
 * run-sms-tests.ts
 *
 * Standalone SMS test runner — sends an individual SMS from A-Party to B-Party,
 * verifies it in the sender's sms/sent DB, then verifies receipt on B-Party.
 *
 * Fixed: all catch-block errors typed as `unknown` (TS18046).
 * Usage:  npx ts-node test/specs/run-sms-tests.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
const DriverManager_1 = require("../driver/DriverManager");
const MessagingPage_1 = require("../pages/MessagingPage");
const MessageVerifier_1 = require("../verification/MessageVerifier");
const DeviceManager_1 = require("../utils/DeviceManager");
const child_process_1 = require("child_process");
// ─── helper: safely extract message from an unknown error ────────────────────
function errMsg(e) {
    return e instanceof Error ? e.message : String(e);
}
function errStack(e) {
    return e instanceof Error ? e.stack : undefined;
}
// ─────────────────────────────────────────────────────────────────────────────
async function runSMSTests() {
    try {
        console.log('='.repeat(80));
        console.log('🚀 Starting SMS Tests');
        console.log('='.repeat(80));
        // ── Configuration ─────────────────────────────────────────────────────────
        // These can also come from environment variables for CI flexibility.
        const deviceId = process.env.A_PARTY_DEVICE || 'ZA2237FKXH';
        const aPartyNumber = process.env.A_PARTY_NUMBER || '9876543210';
        const bPartyNumber = process.env.B_PARTY_NUMBER || '9640571324';
        const bPartyDevice = process.env.B_PARTY_DEVICE || ''; // optional – for receipt verification
        const platformVer = process.env.PLATFORM_VERSION || '13';
        // ─────────────────────────────────────────────────────────────────────────
        console.log(`📱 A-Party Device  : ${deviceId}`);
        console.log(`📞 A-Party Number  : ${aPartyNumber}`);
        console.log(`📞 B-Party Number  : ${bPartyNumber}`);
        if (bPartyDevice)
            console.log(`📱 B-Party Device  : ${bPartyDevice}`);
        // ── Step 1: Verify ADB connectivity ──────────────────────────────────────
        console.log('\n🔍 Step 1: Checking ADB connectivity...');
        try {
            const adbOutput = (0, child_process_1.execSync)('adb devices', { encoding: 'utf8' });
            console.log(adbOutput);
            if (!adbOutput.includes(deviceId)) {
                throw new Error(`Device ${deviceId} not found in "adb devices" output`);
            }
            console.log(`✅ Device ${deviceId} is connected`);
        }
        catch (error) {
            console.error('❌ ADB check failed:', errMsg(error));
            throw new Error('ADB not available or device not connected');
        }
        // ── Step 2: Initialise DeviceManager ─────────────────────────────────────
        console.log('\n🔧 Step 2: Initialising Device Manager...');
        try {
            await DeviceManager_1.DeviceManager.initializeDevices(deviceId, aPartyNumber, bPartyDevice || null, bPartyDevice ? bPartyNumber : null);
            console.log('✅ Device Manager initialised');
        }
        catch (error) {
            console.error('❌ Device Manager initialisation failed:', errMsg(error));
            throw error;
        }
        // ── Step 3: Start Appium ─────────────────────────────────────────────────
        console.log('\n🚀 Step 3: Starting Appium service...');
        try {
            await DriverManager_1.DriverManager.startAppiumService();
            console.log('✅ Appium service started');
        }
        catch (error) {
            console.error('❌ Appium service failed to start:', errMsg(error));
            throw error;
        }
        // ── Step 4: Create Appium driver ─────────────────────────────────────────
        console.log('\n📱 Step 4: Creating driver for messaging...');
        let driver;
        try {
            driver = await DriverManager_1.DriverManager.initializeDriverForMessaging(deviceId, platformVer);
            if (!driver)
                throw new Error('Driver creation returned null/undefined');
            console.log('✅ Driver created successfully');
        }
        catch (error) {
            console.error('❌ Driver creation failed:', errMsg(error));
            throw error;
        }
        // ── Step 5: Initialise page objects ──────────────────────────────────────
        console.log('\n📄 Step 5: Initialising page objects...');
        const messagingPage = new MessagingPage_1.MessagingPage(driver, deviceId);
        const verifier = new MessageVerifier_1.MessageVerifier(driver);
        console.log('✅ Page objects initialised');
        console.log('\n' + '='.repeat(80));
        console.log('✅ Setup complete! Starting tests...');
        console.log('='.repeat(80) + '\n');
        // =========================================================================
        //  Test 1 — Individual SMS (Sender side)
        // =========================================================================
        console.log('='.repeat(80));
        console.log('📱 Test 1: Send Individual SMS');
        console.log('='.repeat(80));
        const ts = new Date();
        const testMessage = `Test SMS at ${ts.toLocaleTimeString()} - ${ts.getTime()}`;
        const sendStart = Date.now();
        console.log(`\n📝 Sending message: "${testMessage}"`);
        // ── Send ──────────────────────────────────────────────────────────────────
        // Steps 2/3: am start -a android.intent.action.SENDTO -d sms:<num> --es sms_body "<msg>"
        // Step 4:    KEYCODE_TAB  (focus send button when keyboard appears)
        // Step 5:    Tap send button OR KEYCODE_ENTER
        let smsSent = false;
        try {
            smsSent = await messagingPage.sendIndividualSMS(bPartyNumber, testMessage);
            console.log(`📤 SMS Send Result: ${smsSent ? 'SUCCESS ✅' : 'FAILED ❌'}`);
        }
        catch (error) {
            console.error('❌ Error sending SMS:', errMsg(error));
            smsSent = false;
        }
        if (smsSent) {
            console.log('✅ SMS sent — waiting 3 s for DB to update...');
            await new Promise(resolve => setTimeout(resolve, 3000));
            // ── Sender-side verification: content://sms/sent ──────────────────────
            // adb -s <id> shell content query --uri content://sms/sent
            //   --projection address,body,date --where "address='<num>'"
            //   Expected: Row: 0 address=9876543210, body=Test SMS..., date=...
            console.log('\n🔍 Verifying message in sender sms/sent DB...');
            let verified = false;
            try {
                verified = await verifier.verifyMessageSent(testMessage);
                console.log(`✅ Sender DB verified: ${verified ? 'YES ✅' : 'NO ❌'}`);
            }
            catch (error) {
                console.error('❌ Verification error:', errMsg(error));
                verified = false;
            }
            // ── Sender-side: show latest sent message details ─────────────────────
            console.log('\n📊 Getting latest sent message details...');
            try {
                const sentInfo = await verifier.getLatestSentMessage();
                if (sentInfo) {
                    console.log(`   📅 Sent at : ${sentInfo.getFormattedDate()}`);
                    console.log(`   📝 Body    : ${sentInfo.body}`);
                    console.log(`   📱 To      : ${sentInfo.address}`);
                }
                else {
                    console.log('   ⚠️  Could not retrieve message details');
                }
            }
            catch (error) {
                console.error('❌ Error getting message details:', errMsg(error));
            }
            // ── Receiver-side verification: content://sms/inbox ──────────────────
            // adb -s <bDevice> shell content query --uri content://sms
            //   --where "thread_id=<id>" --projection _id:address:body:type:date
            // OR simpler direct inbox query:
            //   content query --uri content://sms/inbox
            //   --projection address,body,date,type --where "address='<senderNum>'"
            //   Expected: Row: 0 _id=192, address=+919876543210, body=..., type=1, date=...
            if (bPartyDevice) {
                console.log('\n🔍 Verifying receipt on B-Party device...');
                try {
                    const receiveResult = await verifier.verifyMessageReceived(bPartyDevice, aPartyNumber, // sender's number as seen by receiver
                    testMessage, sendStart, 120000 // 2-minute SLA
                    );
                    if (receiveResult.received) {
                        const deliverySec = ((receiveResult.receiverTimestamp - sendStart) / 1000).toFixed(1);
                        console.log(`✅ B-Party received SMS in ${deliverySec}s`);
                        console.log(`   📅 Receiver timestamp : ${new Date(receiveResult.receiverTimestamp).toISOString()}`);
                    }
                    else {
                        console.log('❌ B-Party did not receive SMS within SLA window');
                    }
                }
                catch (error) {
                    console.error('❌ Receiver verification error:', errMsg(error));
                }
            }
            else {
                console.log('\nℹ️  B_PARTY_DEVICE not set — skipping receiver-side verification');
            }
            // ── Result ────────────────────────────────────────────────────────────
            console.log('\n' + '='.repeat(80));
            console.log(verified
                ? '✅ TEST PASSED: SMS sent and verified in sender DB'
                : '⚠️  TEST PARTIAL: SMS sent but sender-DB verification failed');
            console.log('='.repeat(80));
        }
        else {
            console.log('\n' + '='.repeat(80));
            console.log('❌ TEST FAILED: Could not send SMS');
            console.log('='.repeat(80));
        }
        // ── Cleanup ───────────────────────────────────────────────────────────────
        console.log('\n🧹 Cleaning up resources...');
        try {
            await DriverManager_1.DriverManager.quitDriver();
            console.log('✅ Driver quit successfully');
        }
        catch (error) {
            console.error('⚠️  Error quitting driver:', errMsg(error));
        }
        try {
            await DriverManager_1.DriverManager.stopAppiumService();
            console.log('✅ Appium service stopped');
        }
        catch (error) {
            console.error('⚠️  Error stopping Appium:', errMsg(error));
        }
        console.log('\n' + '='.repeat(80));
        console.log('🏁 Test execution completed');
        console.log('='.repeat(80));
        if (!smsSent)
            process.exit(1);
    }
    catch (error) {
        console.error('\n' + '='.repeat(80));
        console.error('❌ CRITICAL ERROR: Test execution failed');
        console.error('='.repeat(80));
        console.error('Error details:', errMsg(error));
        const stack = errStack(error);
        if (stack) {
            console.error('\n📋 Stack trace:');
            console.error(stack);
        }
        console.log('\n🧹 Attempting cleanup...');
        try {
            await DriverManager_1.DriverManager.quitDriver();
        }
        catch (cleanupError) {
            console.error('Cleanup error (driver):', errMsg(cleanupError));
        }
        try {
            await DriverManager_1.DriverManager.stopAppiumService();
        }
        catch (cleanupError) {
            console.error('Cleanup error (Appium):', errMsg(cleanupError));
        }
        console.log('\n💡 Troubleshooting tips:');
        console.log('   1. Make sure device is connected : adb devices');
        console.log('   2. Check Appium is installed     : appium --version');
        console.log('   3. Verify Google Messages is installed on the device');
        console.log('   4. Check USB debugging is enabled in Developer Options');
        console.log('   5. Reset ADB                     : adb kill-server && adb start-server');
        process.exit(1);
    }
}
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled Rejection:', errMsg(reason));
    process.exit(1);
});
runSMSTests();
