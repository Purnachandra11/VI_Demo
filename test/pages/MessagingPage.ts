import type { AndroidDriver } from '../types/driver';
import { getSendButtonOptions } from '../config/ElementConfig';
import { MessageVerifier, SentSmsInfo } from '../verification/MessageVerifier';
import { reportSMSProgress } from '../utils/progressReporter';
import { VoiceMessageHandler } from './VoiceMessageHandler';
import { ConfigReader } from '../config/ConfigReader';

const MESSAGING_PKG = 'com.google.android.apps.messaging';

/** ImprovedMessagingPage - Fixed Messaging Page with Voice Button Handling */
export class ImprovedMessagingPage {
    private readonly verifier: MessageVerifier;
    private readonly voiceHandler: VoiceMessageHandler;

    constructor(
        private readonly driver: AndroidDriver,
        private readonly deviceId: string
    ) {
        this.verifier = new MessageVerifier(driver);
        this.voiceHandler = new VoiceMessageHandler(driver);
    }

    /**
     * INDIVIDUAL SMS (Text Message)
     */
    async sendIndividualSMS(phoneNumber: string, message: string): Promise<boolean> {
        try {
            console.log(` Starting Individual SMS to: ${phoneNumber}`);
            await reportSMSProgress(this.deviceId, phoneNumber, 'STARTED', 'Starting SMS send', 0);

            await this.openMessagingApp();
            await this.ensureMainScreen();
            await reportSMSProgress(this.deviceId, phoneNumber, 'APP_OPENED', 'Messaging app ready', 20);
            await this.startNewConversation();
            await reportSMSProgress(this.deviceId, phoneNumber, 'NEW_CONVERSATION', 'Conversation started', 40);
            await this.enterPhoneNumber(phoneNumber);
            await reportSMSProgress(this.deviceId, phoneNumber, 'NUMBER_ENTERED', 'Phone number entered', 60);
            await this.enterMessage(message);
            await reportSMSProgress(this.deviceId, phoneNumber, 'MESSAGE_ENTERED', 'Message typed', 80);
            await this.sendMessage();
            await reportSMSProgress(this.deviceId, phoneNumber, 'SENDING', 'Sending message', 90);

            // Use unified verification
            this.verifier.setRecipientNumber(phoneNumber);
            const sent = await this.verifier.verifyMessageSent(message);

            if (sent) {
                await reportSMSProgress(this.deviceId, phoneNumber, 'COMPLETED', 'SMS sent successfully', 100);
            } else {
                await reportSMSProgress(this.deviceId, phoneNumber, 'FAILED', 'SMS verification failed', 0);
            }

            console.log(` Individual SMS sent status: ${sent}`);
            return sent;

        } catch (error) {
            console.error('❌ Individual SMS failed:', error);
            await reportSMSProgress(this.deviceId, phoneNumber, 'ERROR', `Exception: ${error}`, 0);
            return false;
        }
    }

    /**
     * INDIVIDUAL SMS WITH TIMESTAMP
     */
    async sendIndividualSMSWithTimestamp(phoneNumber: string, message: string): Promise<boolean> {
        try {
            console.log(` Starting Individual SMS to: ${phoneNumber}`);
            this.verifier.setRecipientNumber(phoneNumber);

            const startTime = Date.now();

            await this.openMessagingApp();
            await this.ensureMainScreen();
            await this.startNewConversation();
            await this.enterPhoneNumber(phoneNumber);
            await this.enterMessage(message);
            await this.sendMessage();

            // Wait for message to be saved
            await this.driver.pause(2000);

            // Verify with timestamp
            const sentInfo = await this.verifier.verifyMessageSentWithTimestamp(message);

            const endTime = Date.now();

            if (sentInfo) {
                console.log('✅ SMS VERIFIED!');
                console.log(`   Sent at: ${sentInfo.getFormattedDate()}`);
                console.log(`   Total time: ${endTime - startTime} ms`);
                return true;
            } else {
                console.log('❌ SMS verification failed');
                return false;
            }

        } catch (error) {
            console.error('❌ SMS failed:', error);
            return false;
        }
    }

    /**
     * INDIVIDUAL VOICE MESSAGE
     */
    async sendIndividualVoiceMessage(phoneNumber: string): Promise<boolean> {
        return this.voiceHandler.sendVoiceMessage(phoneNumber);
    }

    /**
     * INDIVIDUAL VOICE MESSAGE FIXED with verification
     */
    async sendIndividualVoiceMessageFixed(phoneNumber: string): Promise<boolean> {
        try {
            console.log(`🎤 Starting Individual Voice Message to: ${phoneNumber}`);
            await reportSMSProgress(this.deviceId, phoneNumber, 'STARTED', 'Starting voice message', 0);

            // Set recipient number for verification
            this.verifier.setRecipientNumber(phoneNumber);

            const result = await this.voiceHandler.sendVoiceMessageWithDetails(phoneNumber);
            const voiceSent = result.get('success') as boolean;

            if (voiceSent) {
                // Get detailed verification with timestamp
                const sentInfo = await this.verifier.getLatestSentMessage();

                if (sentInfo) {
                    await reportSMSProgress(this.deviceId, phoneNumber, 'COMPLETED',
                        `Voice message sent at: ${sentInfo.getFormattedDate()}`, 100);
                    console.log(` Voice message sent at: ${sentInfo.getFormattedDate()}`);
                    return true;
                } else {
                    await reportSMSProgress(this.deviceId, phoneNumber, 'VERIFICATION_FAILED', 'Voice message verification failed', 50);
                    return false;
                }
            } else {
                await reportSMSProgress(this.deviceId, phoneNumber, 'FAILED', 'Voice recording failed', 0);
                return false;
            }

        } catch (error) {
            console.error('❌ Voice message failed:', error);
            await reportSMSProgress(this.deviceId, phoneNumber, 'ERROR', `Exception: ${error}`, 0);
            return false;
        }
    }

    /**
     * GROUP SMS (Text Message)
     */
    async sendGroupSMS(groupName: string, message: string): Promise<{ success: boolean; participantCount?: number; error?: string }> {
        const result: { success: boolean; participantCount?: number; error?: string } = { success: false };

        try {
            console.log(`👥 Starting Group SMS to: ${groupName}`);
            await reportSMSProgress(this.deviceId, groupName, 'STARTED', 'Starting group SMS', 0);

            await this.openMessagingApp();
            await this.ensureMainScreen();
            await reportSMSProgress(this.deviceId, groupName, 'APP_OPENED', 'Messaging app ready', 20);

            const groupOpened = await this.quickSearchGroup(groupName);
            if (!groupOpened) {
                await reportSMSProgress(this.deviceId, groupName, 'GROUP_NOT_FOUND', `Group not found: ${groupName}`, 0);
                result.error = `Group not found: ${groupName}`;
                return result;
            }
            await reportSMSProgress(this.deviceId, groupName, 'GROUP_OPENED', 'Group conversation opened', 50);
            
            // FIX: Explicitly type the variable and ensure await is used
            const participantCount: number = await this.countGroupParticipants();
            
            // Now participantCount is definitely a number
            console.log(`📊 Group participants count: ${participantCount}`);
            await reportSMSProgress(this.deviceId, groupName, 'COUNTING', `Participants counted: ${participantCount}`, 60);

            await this.enterMessage(message);
            await this.sendMessage();
            await reportSMSProgress(this.deviceId, groupName, 'MESSAGE_ENTERED', 'Message typed', 80);

            // Use unified verification
            const sent = await this.verifier.verifyMessageSent(message);

            if (sent) {
                await reportSMSProgress(this.deviceId, groupName, 'COMPLETED', `Group SMS sent successfully to ${participantCount} participants`, 100);
            } else {
                await reportSMSProgress(this.deviceId, groupName, 'VERIFICATION_FAILED', 'Group SMS verification failed', 0);
            }

            result.success = sent;
            result.participantCount = participantCount;

            console.log(` Group SMS completed - Participants: ${participantCount}, Sent: ${sent}`);

        } catch (error) {
            console.error('❌ Group SMS failed:', error);
            await reportSMSProgress(this.deviceId, groupName, 'ERROR', `Exception: ${error}`, 0);
            result.error = error instanceof Error ? error.message : String(error);
        }

        return result;
    }

    /**
     * GROUP VOICE MESSAGE
     */
    async sendGroupVoiceMessage(groupName: string): Promise<{ success: boolean; participantCount?: number; error?: string }> {
        const result: { success: boolean; participantCount?: number; error?: string } = { success: false };

        try {
            console.log(`🎤 Starting Group Voice Message to: ${groupName}`);
            await reportSMSProgress(this.deviceId, groupName, 'STARTED', 'Starting group voice message', 0);

            await this.openMessagingApp();
            await this.ensureMainScreen();
            await reportSMSProgress(this.deviceId, groupName, 'APP_OPENED', 'Messaging app ready', 20);

            const groupOpened = await this.searchAndOpenGroup(groupName);
            if (!groupOpened) {
                await reportSMSProgress(this.deviceId, groupName, 'GROUP_NOT_FOUND', `Group not found: ${groupName}`, 0);
                result.error = `Group not found: ${groupName}`;
                return result;
            }

            await reportSMSProgress(this.deviceId, groupName, 'GROUP_OPENED', 'Group conversation opened', 40);

            // FIX: Explicitly type the variable and ensure await is used
            const participantCount: number = await this.countGroupParticipants();
            
            // Now participantCount is definitely a number
            console.log(`📊 Group participants count: ${participantCount}`);
            await reportSMSProgress(this.deviceId, groupName, 'COUNTING', `Participants counted: ${participantCount}`, 50);

            console.log('  🎤 Holding audio button for 5 seconds...');
            await reportSMSProgress(this.deviceId, groupName, 'RECORDING', 'Recording voice message', 60);

            const audioHeld = await this.holdAudioButtonRobust(5000);
            if (!audioHeld) {
                await reportSMSProgress(this.deviceId, groupName, 'RECORDING_FAILED', 'Failed to hold audio button', 0);
                result.error = 'Failed to hold audio button';
                return result;
            }

            console.log('  ⏱️ Waiting 2 seconds for processing...');
            await reportSMSProgress(this.deviceId, groupName, 'PROCESSING', 'Processing recording', 70);
            await this.driver.pause(2000);

            console.log('  📤 Sending voice message...');
            await reportSMSProgress(this.deviceId, groupName, 'SENDING', 'Sending voice message', 80);

            let sent = await this.sendVoiceMessageRobust();

            if (sent) {
                await reportSMSProgress(this.deviceId, groupName, 'SENT', 'Voice message sent, verifying', 90);
                // Use unified verification for voice message
                sent = await this.verifier.verifyMessageSent('');

                if (sent) {
                    await reportSMSProgress(this.deviceId, groupName, 'COMPLETED', `Group voice message sent to ${participantCount} participants`, 100);
                } else {
                    await reportSMSProgress(this.deviceId, groupName, 'VERIFICATION_FAILED', 'Voice message verification failed', 0);
                }
            } else {
                await reportSMSProgress(this.deviceId, groupName, 'SEND_FAILED', 'Failed to send voice message', 0);
            }

            result.success = sent;
            result.participantCount = participantCount;

            console.log(` Group Voice Message completed - Participants: ${participantCount}, Sent: ${sent}`);

        } catch (error) {
            console.error('❌ Group Voice Message failed:', error);
            await reportSMSProgress(this.deviceId, groupName, 'ERROR', `Exception: ${error}`, 0);
            result.error = error instanceof Error ? error.message : String(error);
        }

        return result;
    }

    // ==================== CORE METHODS ====================

    private async openMessagingApp(): Promise<void> {
        console.log('   Opening Google Messages...');

        try {
            await this.driver.execute('mobile: shell', {
                command: 'am',
                args: ['start', '-n', `${ConfigReader.getMessageAppPackage()}/${ConfigReader.getMessageAppActivity()}`]
            });
            console.log('   Messaging app opened via shell command');
        } catch (error) {
            console.error('   Failed to open messaging app:', error);
            throw error;
        }

        await this.driver.pause(5000);
        console.log('   Messaging app ready');
    }

    private async ensureMainScreen(): Promise<void> {
        try {
            console.log('  🔍 Verifying main screen...');

            const startChatFab = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/start_chat_fab"]');
            if (await startChatFab.isDisplayed()) {
                console.log('   User is on main screen');
                return;
            }
        } catch (error) {
            console.log('  ℹ️ Could not verify main screen, continuing anyway...');
        }
    }

    private async startNewConversation(): Promise<void> {
        console.log('  💬 Starting new conversation...');

        const startChatButton = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/start_chat_fab"]');
        await startChatButton.click();
        await this.driver.pause(3000);
        console.log('   New conversation started');
    }

    private async enterPhoneNumber(phoneNumber: string): Promise<void> {
        console.log(`  📞 Entering phone: ${phoneNumber}`);

        await this.driver.pause(3000);

        for (const digit of phoneNumber) {
            try {
                await this.driver.execute('mobile: shell', {
                    command: 'input',
                    args: ['text', digit]
                });
                await this.driver.pause(300);
            } catch (error) {
                console.log(`   Failed to press digit: ${digit}`);
                throw error;
            }
        }

        await this.driver.execute('mobile: shell', {
            command: 'input',
            args: ['keyevent', 'KEYCODE_ENTER']
        });
        await this.driver.pause(3000);
        console.log('   Phone number entered');
    }

    private async enterMessage(message: string): Promise<void> {
        console.log('  ✍️ Entering message...');

        const messageInput = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/compose_message_text"]');

        // Click to focus
        await messageInput.click();
        await this.driver.pause(500);

        // Send keys
        await messageInput.setValue(message);
        await this.driver.pause(2000);
        console.log('   Message entered');
    }

    private async sendMessage(): Promise<void> {
        console.log('  📤 Sending message...');

        const sendButton = await this.driver.$('//android.view.View[@resource-id="Compose:Draft:Send"]/android.widget.Button');
        await sendButton.click();
        await this.driver.pause(3000);
        console.log('   Message sent');
    }

    private async holdAudioButtonRobust(milliseconds: number): Promise<boolean> {
        try {
            const audioButton = await this.findAudioButtonWithRetry();
            if (!audioButton) {
                console.log('  ❌ Audio button not found');
                return false;
            }

            const location = await audioButton.getLocation();
            const size = await audioButton.getSize();
            const x = location.x + Math.floor(size.width / 2);
            const y = location.y + Math.floor(size.height / 2);

            console.log(`  🎤 Audio button at (${x}, ${y})`);
            console.log(`  ⏱️ Holding for ${milliseconds}ms...`);

            // Use ADB shell command for hold
            await this.driver.execute('mobile: shell', {
                command: 'input',
                args: ['swipe', String(x), String(y), String(x), String(y), String(milliseconds)]
            });

            console.log('   Audio button held using ADB shell');
            return true;

        } catch (error) {
            console.error('  ❌ Hold audio button error:', error);
            return false;
        }
    }

    private async findAudioButtonWithRetry(): Promise<any> {
        const locators = [
            '//*[@resource-id="com.google.android.apps.messaging:id/audio_button_view_microphone_icon"]',
            '//android.widget.ImageView[@resource-id="com.google.android.apps.messaging:id/audio_button_view_microphone_icon"]',
            '//android.widget.ImageButton[contains(@content-desc, "Voice") or contains(@content-desc, "voice") or contains(@content-desc, "Audio") or contains(@content-desc, "audio")]',
            '//android.widget.ImageView[contains(@resource-id, "audio") or contains(@resource-id, "voice") or contains(@resource-id, "microphone")]'
        ];

        for (const locator of locators) {
            try {
                const element = await this.driver.$(locator);
                if (await element.isDisplayed() && await element.isEnabled()) {
                    console.log(`   Found audio button using: ${locator}`);
                    return element;
                }
            } catch (error) {
                // Try next locator
            }
        }

        return null;
    }

    private async sendVoiceMessageRobust(): Promise<boolean> {
        try {
            const sendLocators = [
                '//android.view.View[@resource-id="Compose:Draft:Send"]/android.widget.Button',
                '//android.widget.ImageView[@content-desc="Send SMS"]',
                '//android.widget.Button[@content-desc="Send"]',
                '//android.widget.ImageView[@content-desc="Send"]',
                '//*[@resource-id="com.google.android.apps.messaging:id/send_message_button_icon"]',
                '//android.view.View[@resource-id="Compose:Draft:Send"]/android.widget.Button',
                '//android.widget.ImageButton[contains(@content-desc, "Send")]'
            ];

            for (const locator of sendLocators) {
                try {
                    const sendButton = await this.driver.$(locator);
                    if (await sendButton.isDisplayed() && await sendButton.isEnabled()) {
                        console.log(`   Found send button using: ${locator}`);
                        await sendButton.click();
                        await this.driver.pause(3000);
                        return true;
                    }
                } catch (error) {
                    // Try next locator
                }
            }

            // Fallback: Press ENTER key
            console.log('  ⌨️ Trying ENTER key...');
            await this.driver.execute('mobile: shell', {
                command: 'input',
                args: ['keyevent', 'KEYCODE_ENTER']
            });
            await this.driver.pause(3000);
            return true;

        } catch (error) {
            console.error('  ❌ Send voice message error:', error);
            return false;
        }
    }

    // ==================== GROUP METHODS ====================

    private async quickSearchGroup(groupName: string): Promise<boolean> {
        try {
            console.log('  🔍 Quick group search...');

            if (await this.clickVisibleGroup(groupName)) {
                return true;
            }

            return await this.searchAndOpenGroup(groupName);

        } catch (error) {
            console.error('  ❌ Quick group search failed:', error);
            return false;
        }
    }

    private async clickVisibleGroup(groupName: string): Promise<boolean> {
        try {
            const visibleGroups = await this.driver.$$(`//android.widget.TextView[contains(@text, '${groupName}')]`);

            // if (visibleGroups.length > 0)
               {
                await visibleGroups[0].click();
                await this.driver.pause(1500);
                console.log('   Group found immediately');
                return true;
            }
            return false;

        } catch (error) {
            return false;
        }
    }

    private async searchAndOpenGroup(groupName: string): Promise<boolean> {
        try {
            console.log(`  🔍 Searching for group: ${groupName}`);

            try {
                const searchButton = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/search_button"]');
                if (await searchButton.isDisplayed()) {
                    await searchButton.click();
                    await this.driver.pause(2000);

                    const searchField = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/search_src_text"]');
                    await searchField.setValue(groupName);
                    await this.driver.pause(3000);

                    return await this.findAndClickGroupInSearchResults(groupName);
                }
            } catch (error) {
                console.log('   Search button not found, trying direct scroll...');
            }

            return await this.findGroupByScrolling(groupName);

        } catch (error) {
            console.error('  ❌ Group search failed:', error);
            return false;
        }
    }

    private async findAndClickGroupInSearchResults(groupName: string): Promise<boolean> {
        try {
            const groupElements = await this.driver.$$(`//android.widget.TextView[contains(@text, '${groupName}')]`);

            // if (groupElements.length > 0) 
              {
                await groupElements[0].click();
                await this.driver.pause(3000);
                console.log(`   Group found and opened via search: ${groupName}`);
                return true;
            }

            console.log('  ❌ Group not found in search results');
            return false;

        } catch (error) {
            console.error('  ❌ Error in search results:', error);
            return false;
        }
    }

    private async findGroupByScrolling(groupName: string): Promise<boolean> {
        try {
            const conversations = await this.driver.$$('//*[@resource-id="com.google.android.apps.messaging:id/conversation_name"]');

            for (const conversation of conversations) {
                try {
                    const conversationName = await conversation.getText();
                    if (conversationName.includes(groupName)) {
                        await conversation.click();
                        await this.driver.pause(3000);
                        console.log('   Group found by scrolling');
                        return true;
                    }
                } catch (error) {
                    continue;
                }
            }

            return false;

        } catch (error) {
            return false;
        }
    }

    private async countGroupParticipants(): Promise<number> {
        try {
            console.log('  👥 Counting group participants...');

            try {
                const groupInfoButton = await this.driver.$('//*[@resource-id="com.google.android.apps.messaging:id/contact_details_button"]');
                if (await groupInfoButton.isDisplayed()) {
                    await groupInfoButton.click();
                    await this.driver.pause(2000);

                    const pageSource = await this.driver.getPageSource();
                    if (pageSource.includes('participants') || pageSource.includes('members')) {
                        const participantElements = await this.driver.$$('//android.widget.TextView[contains(@text, "participant") or contains(@text, "member")]');

                        for (const element of participantElements) {
                            const text = await element.getText();
                            const match = text.match(/\d+/);
                            if (match) {
                                const count = parseInt(match[0], 10);

                                await this.driver.execute('mobile: shell', {
                                    command: 'input',
                                    args: ['keyevent', 'KEYCODE_BACK']
                                });
                                await this.driver.pause(2000);
                                return count;
                            }
                        }
                    }

                    await this.driver.execute('mobile: shell', {
                        command: 'input',
                        args: ['keyevent', 'KEYCODE_BACK']
                    });
                    await this.driver.pause(2000);
                }
            } catch (error) {
                // Continue
            }

            return 2; // Default

        } catch (error) {
            return 1;
        }
    }

    async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
        return this.sendIndividualSMS(phoneNumber, message);
    }
}

/** MessagingPage wrapper for backward compatibility */
export class MessagingPage extends ImprovedMessagingPage {
    constructor(driver: AndroidDriver, deviceId?: string) {
        super(driver, deviceId || String((driver.capabilities as any)['appium:udid'] || 'device'));
    }
}

export default MessagingPage;