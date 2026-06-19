"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceMessageHandler = void 0;
const MessageVerifier_1 = require("../verification/MessageVerifier");
const ConfigReader_1 = require("../config/ConfigReader");
const MESSAGING_PKG = 'com.google.android.apps.messaging';
/** VoiceMessageHandler — Google Messages voice note flow with timestamp verification */
class VoiceMessageHandler {
    constructor(driver) {
        this.driver = driver;
        this.currentPhoneNumber = '';
        this.verifier = new MessageVerifier_1.MessageVerifier(driver);
    }
    /**
     * Send voice message with timestamp verification
     */
    async sendVoiceMessage(phoneNumber) {
        this.currentPhoneNumber = phoneNumber;
        this.verifier.setRecipientNumber(phoneNumber);
        console.log(`🎤 ULTIMATE VOICE MESSAGE to: ${phoneNumber}`);
        const startTime = Date.now();
        try {
            // Step 1: Open Messaging App
            console.log(' Step 1: Opening Google Messages...');
            await this.openMessagingApp();
            // Step 2: Ensure main screen
            console.log(' Step 2: Ensuring main screen...');
            await this.ensureMainScreen();
            // Step 3: Start new conversation
            console.log('💬 Step 3: Starting new conversation...');
            await this.startNewConversation();
            // Step 4: Enter phone number
            console.log('📞 Step 4: Entering phone number...');
            await this.enterPhoneNumber(phoneNumber);
            // Step 5: Wait for conversation to load
            console.log('⏳ Step 5: Waiting for conversation...');
            await this.driver.pause(3000);
            // Step 6: Find and hold voice button
            console.log('🎤 Step 6: Finding voice button...');
            let voiceButton = await this.findVoiceButtonUltimate();
            if (!voiceButton) {
                voiceButton = await this.findVoiceButtonByPosition();
            }
            if (!voiceButton) {
                console.log('❌ Could not find voice button at all');
                return false;
            }
            console.log(' Voice button found!');
            // Step 7: Hold voice button for recording
            console.log('⏺️ Step 7: Recording voice message (5 seconds)...');
            const recorded = await this.holdVoiceButtonUltimate(voiceButton, 5000);
            if (!recorded) {
                console.log('❌ Recording failed');
                return false;
            }
            // Step 8: Wait for processing
            console.log('⏳ Step 8: Processing recording...');
            await this.driver.pause(2000);
            // Step 9: Send the voice message
            const sent = await this.sendVoiceMessageUltimate();
            if (sent) {
                // Step 10: Verify using unified verification with timestamp
                console.log('🔍 Step 10: Verifying voice message with timestamp...');
                await this.driver.pause(2000); // Wait for message to appear in database
                const sentInfo = await this.verifier.verifyMessageSentWithTimestamp('');
                if (sentInfo) {
                    const endTime = Date.now();
                    const totalTime = endTime - startTime;
                    console.log('✅ VOICE MESSAGE VERIFIED AS SENT!');
                    console.log('📊 Voice Message Details:');
                    console.log(`   Phone Number: ${phoneNumber}`);
                    console.log(`   Sent Timestamp: ${sentInfo.date}`);
                    console.log(`   Sent Time: ${sentInfo.getFormattedDate()}`);
                    console.log(`   Total Process Time: ${totalTime} ms (${(totalTime / 1000).toFixed(2)} seconds)`);
                    return true;
                }
                else {
                    console.log('❌ Voice message verification failed - message not found in sent database');
                    return false;
                }
            }
            else {
                console.log('❌ Failed to send voice message');
                return false;
            }
        }
        catch (error) {
            console.error('❌ Voice message failed:', error);
            return false;
        }
    }
    /**
     * Send voice message and return detailed info with timestamp
     */
    async sendVoiceMessageWithDetails(phoneNumber) {
        const result = new Map();
        this.currentPhoneNumber = phoneNumber;
        this.verifier.setRecipientNumber(phoneNumber);
        const startTime = Date.now();
        const success = await this.sendVoiceMessage(phoneNumber);
        const endTime = Date.now();
        result.set('success', success);
        result.set('phoneNumber', phoneNumber);
        result.set('startTime', startTime);
        result.set('endTime', endTime);
        result.set('duration', endTime - startTime);
        if (success) {
            const sentInfo = await this.verifier.getLatestSentMessage();
            if (sentInfo) {
                result.set('sentTimestamp', sentInfo.date);
                result.set('sentTimeFormatted', sentInfo.getFormattedDate());
                result.set('messageBody', sentInfo.body);
            }
        }
        return result;
    }
    // ==================== PRIVATE METHODS ====================
    async openMessagingApp() {
        try {
            await this.driver.execute('mobile: shell', {
                command: 'am',
                args: ['start', '-n', `${ConfigReader_1.ConfigReader.getMessageAppPackage()}/${ConfigReader_1.ConfigReader.getMessageAppActivity()}`]
            });
            await this.driver.pause(5000);
            console.log('    Messaging app opened');
        }
        catch (error) {
            console.error('    Failed to open messaging app:', error);
            throw error;
        }
    }
    async ensureMainScreen() {
        try {
            const startChatFab = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/start_chat_fab"]');
            if (await startChatFab.isDisplayed()) {
                console.log('    Already on main screen');
                return;
            }
        }
        catch (error) {
            // Press back up to 5 times
            for (let i = 0; i < 5; i++) {
                try {
                    await this.driver.execute('mobile: shell', {
                        command: 'input',
                        args: ['keyevent', 'KEYCODE_BACK']
                    });
                    await this.driver.pause(1000);
                    const startChatFab = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/start_chat_fab"]');
                    if (await startChatFab.isDisplayed()) {
                        console.log('    Navigated to main screen');
                        return;
                    }
                }
                catch (error) {
                    continue;
                }
            }
            console.log('    Could not navigate to main screen, continuing anyway');
        }
    }
    async startNewConversation() {
        const startChatButton = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/start_chat_fab"]');
        await startChatButton.click();
        await this.driver.pause(3000);
        console.log('    New conversation started');
    }
    async enterPhoneNumber(phoneNumber) {
        await this.driver.pause(3000);
        // Clear any existing text
        try {
            const inputField = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/recipient_text_view"]');
            await inputField.clearValue();
        }
        catch (error) {
            // Ignore
        }
        // Type each digit
        for (const digit of phoneNumber) {
            try {
                await this.driver.execute('mobile: shell', {
                    command: 'input',
                    args: ['text', digit]
                });
                await this.driver.pause(200);
            }
            catch (error) {
                console.log(`    Could not type digit: ${digit}`);
            }
        }
        // Press Enter/Go
        await this.driver.execute('mobile: shell', {
            command: 'input',
            args: ['keyevent', 'KEYCODE_ENTER']
        });
        await this.driver.pause(3000);
        console.log('    Phone number entered');
    }
    async findVoiceButtonUltimate() {
        const locators = [
            '//*[contains(@content-desc, "voice") or contains(@content-desc, "microphone")]',
            '//android.widget.ImageButton[contains(@resource-id, "audio_button")]',
            '//android.widget.ImageView[@content-desc="Voice message"]'
        ];
        for (const locator of locators) {
            try {
                console.log(`   🔍 Trying locator: ${locator}`);
                const elements = await this.driver.$$(locator);
                for (const element of elements) {
                    try {
                        if (await element.isDisplayed() && await element.isEnabled()) {
                            console.log(`    Found voice button with: ${locator}`);
                            return element;
                        }
                    }
                    catch (error) {
                        continue;
                    }
                }
            }
            catch (error) {
                continue;
            }
        }
        return null;
    }
    async findVoiceButtonByPosition() {
        try {
            console.log('   📍 Finding voice button by screen position...');
            const windowSize = await this.driver.getWindowSize();
            const screenWidth = windowSize.width;
            const screenHeight = windowSize.height;
            const targetX = Math.floor(screenWidth * 0.85);
            const targetY = Math.floor(screenHeight * 0.92);
            console.log(`   📍 Target position: (${targetX}, ${targetY})`);
            // Tap at the position
            await this.driver.execute('mobile: shell', {
                command: 'input',
                args: ['tap', String(targetX), String(targetY)]
            });
            // Create a dummy element reference
            return {
                getLocation: async () => ({ x: targetX, y: targetY }),
                getSize: async () => ({ width: 100, height: 100 })
            };
        }
        catch (error) {
            console.error('   ❌ Position finding failed:', error);
            return null;
        }
    }
    async holdVoiceButtonUltimate(voiceButton, durationMs) {
        try {
            console.log(`   🤏 Holding voice button for ${durationMs}ms`);
            // Get coordinates
            let x, y;
            if (voiceButton.getLocation) {
                const location = await voiceButton.getLocation();
                const size = await voiceButton.getSize();
                x = location.x + Math.floor(size.width / 2);
                y = location.y + Math.floor(size.height / 2);
            }
            else {
                x = 500;
                y = 1800;
            }
            console.log(`   🎯 Button center: (${x}, ${y})`);
            // Use ADB shell command for long press
            const deviceId = this.currentPhoneNumber;
            await this.driver.execute('mobile: shell', {
                command: 'input',
                args: ['swipe', String(x), String(y), String(x), String(y), String(durationMs)]
            });
            console.log('    Hold completed using ADB');
            await this.driver.pause(1000);
            return true;
        }
        catch (error) {
            console.error('   ❌ Hold failed:', error);
            return false;
        }
    }
    async sendVoiceMessageUltimate() {
        try {
            console.log('   🔍 Looking for send button...');
            const sendLocators = [
                '//android.view.View[@resource-id="Compose:Draft:Send"]/android.widget.Button',
                '//android.widget.ImageView[@content-desc="Send"]',
                '//android.widget.Button[@content-desc="Send"]',
                '//*[@resource-id="com.google.android.apps.messaging:id/send_message_button_icon"]'
            ];
            for (const locator of sendLocators) {
                try {
                    const sendButton = await this.driver.$(locator);
                    if (await sendButton.isDisplayed() && await sendButton.isEnabled()) {
                        console.log(`    Found send button with: ${locator}`);
                        await sendButton.click();
                        await this.driver.pause(1000);
                        return true;
                    }
                }
                catch (error) {
                    continue;
                }
            }
            // Fallback: Press Enter key
            console.log('   ⌨️ Trying Enter key...');
            await this.driver.execute('mobile: shell', {
                command: 'input',
                args: ['keyevent', 'KEYCODE_ENTER']
            });
            await this.driver.pause(3000);
            return true;
        }
        catch (error) {
            console.error('   ❌ Send button error:', error);
            return false;
        }
    }
}
exports.VoiceMessageHandler = VoiceMessageHandler;
exports.default = VoiceMessageHandler;
