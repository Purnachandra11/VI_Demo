// src/utils/ImprovedADBAutoAnswer.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ImprovedADBAutoAnswer {
    private deviceId: string;
    private expectedCaller: string;
    private running: boolean = false;
    private monitorThread: NodeJS.Timeout | null = null;
    private callsAnswered: number = 0;
    private callDetected: boolean = false;
    private isMonitoring: boolean = false;

    constructor(deviceId: string, expectedCaller: string) {
        this.deviceId = deviceId;
        this.expectedCaller = expectedCaller;
    }

    /**
     * Start the aggressive auto-answer monitoring
     */
    start(): void {
        this.running = true;
        this.callsAnswered = 0;
        this.callDetected = false;
        
        console.log(`🤖 Starting AGGRESSIVE ADB Auto-Answer for device: ${this.deviceId}`);
        console.log(`📞 Expected caller: ${this.expectedCaller}`);
        console.log(`⚡ Using MULTI-METHOD monitoring (500ms polling)`);

        this.isMonitoring = true;
        this.monitorThread = setInterval(async () => {
            if (this.running && !this.callDetected) {
                await this.monitorAndAnswerCallsAggressive();
            }
        }, 500);

        console.log(` Auto-answer service is now AGGRESSIVELY monitoring`);
    }

    /**
     * Stop the auto-answer service
     */
    stop(): void {
        this.running = false;
        this.isMonitoring = false;
        
        if (this.monitorThread) {
            clearInterval(this.monitorThread);
            this.monitorThread = null;
        }
        
        console.log(`🛑 Auto-Answer service stopped for device: ${this.deviceId}`);
        console.log(`📊 Total calls answered: ${this.callsAnswered}`);
    }

    /**
     * AGGRESSIVE: Use multiple detection methods simultaneously
     */
    private async monitorAndAnswerCallsAggressive(): Promise<void> {
        if (this.callDetected) {
            return;
        }

        try {
            // METHOD 1: Check telephony state (most reliable)
            const callState = await this.executeADBCommandQuick(`dumpsys telephony.registry | grep mCallState`);
            
            // METHOD 2: Check audio state (backup detection)
            const audioState = await this.executeADBCommandQuick(`dumpsys audio | grep 'mRingerMode\\|mMode'`);
            
            // METHOD 3: Check notification (another backup)
            const notifications = await this.executeADBCommandQuick(`dumpsys notification | grep 'Notification(.*call'`);
            
            // Detect ringing call using ANY method
            const isRinging = callState.includes('mCallState=2') || 
                             callState.includes('mCallState: 2') ||
                             audioState.includes('RINGER_MODE_NORMAL') ||
                             notifications.includes('call');
            
            if (isRinging && !this.callDetected) {
                this.callDetected = true;
                
                console.log('\n' + '='.repeat(70));
                console.log(`📞 🔔 INCOMING CALL DETECTED ON ${this.deviceId}`);
                console.log('='.repeat(70));
                
                // Get incoming number
                const incomingNumber = await this.getIncomingNumber();
                console.log(` Incoming from: ${incomingNumber}`);
                console.log(`👤 Expected caller: ${this.expectedCaller}`);
                
                // IMMEDIATE MULTI-METHOD ANSWER
                const answered = await this.answerCallAggressively();
                
                if (answered) {
                    this.callsAnswered++;
                    console.log(`    CALL ANSWERED SUCCESSFULLY!`);
                    console.log(`📊 Total calls answered: ${this.callsAnswered}`);
                    console.log('='.repeat(70) + '\n');
                    
                    // Wait to avoid re-triggering
                    await this.sleep(15000);
                    this.callDetected = false;
                } else {
                    console.log(` All answer attempts failed`);
                    console.log('='.repeat(70) + '\n');
                    await this.sleep(3000);
                    this.callDetected = false;
                }
            }
            
        } catch (error: any) {
            // Continue monitoring
            if (!error.message?.includes('ENOENT')) {
                console.error(`Monitor error: ${error.message}`);
            }
        }
    }

    /**
     * AGGRESSIVE: Try answer methods
     */
    private async answerCallAggressively(): Promise<boolean> {
        console.log(`⚡ EXECUTING AGGRESSIVE ANSWER STRATEGY...`);

        try {
            console.log(`   📞 Trying: KEYCODE_CALL`);
            
            await this.executeADBCommandQuick(`input keyevent KEYCODE_CALL`);
            console.log(`    Command executed`);
            
            await this.sleep(500);
            if (await this.verifyCallAnswered()) {
                console.log(`     CALL ANSWERED!`);
                return true;
            }

        } catch (error: any) {
            console.log(`    Failed: ${error.message}`);
        }

        return false;
    }

    /**
     * Get incoming phone number
     */
    private async getIncomingNumber(): Promise<string> {
        try {
            const result = await this.executeADBCommandQuick(`dumpsys telephony.registry | grep mCallIncomingNumber`);
            if (result.includes('=')) {
                let number = result.split('=')[1].trim();
                number = number.replace(/[^0-9+]/g, '');
                return number.length > 0 ? number : 'Unknown';
            }
        } catch (error) {
            // Ignore
        }
        return 'Unknown';
    }

    /**
     * Verify call answered - check multiple indicators
     */
    private async verifyCallAnswered(): Promise<boolean> {
        try {
            // Check 1: Telephony state - OFFHOOK means call is active
            const callState = await this.executeADBCommandQuick(`dumpsys telephony.registry | grep mCallState`);
            
            const isOffhook = callState.includes('mCallState=1') || 
                             callState.includes('mCallState: 1') ||
                             callState.includes('OFFHOOK') ||
                            /.*mCallState.*1.*/.test(callState);
            
            if (isOffhook) {
                console.log(`    Verified via call state (OFFHOOK)`);
                return true;
            }
            
            // Check 2: Audio mode - IN_CALL or IN_COMMUNICATION
            const audioState = await this.executeADBCommandQuick(`dumpsys audio | grep -E 'mMode|audio_mode'`);
            const isInCallAudio = audioState.includes('mMode=2') || 
                                 audioState.includes('mMode=3') || 
                                 audioState.includes('mMode: 2') || 
                                 audioState.includes('mMode: 3') ||
                                 audioState.includes('AUDIO_MODE_IN_CALL') ||
                                 audioState.includes('AUDIO_MODE_IN_COMMUNICATION');
            
            if (isInCallAudio) {
                console.log(`    Verified via audio mode (IN_CALL)`);
                return true;
            }
            
            // Check 3: Call status via telecom service
            const telecomState = await this.executeADBCommandQuick(`dumpsys telecom | grep -E 'Call.*state'`);
            if (telecomState.includes('ACTIVE') || telecomState.includes('CONNECTED')) {
                console.log(`    Verified via telecom (ACTIVE/CONNECTED)`);
                return true;
            }
            
            // Check 4: Phone app state
            const phoneState = await this.executeADBCommandQuick(`dumpsys phone | grep -i state`);
            if (phoneState.includes('OFFHOOK')) {
                console.log(`    Verified via phone state (OFFHOOK)`);
                return true;
            }
            
            console.log(`    Call state not confirmed`);
            console.log(`   Call state: ${callState.substring(0, 100)}`);
            console.log(`   Audio state: ${audioState.substring(0, 100)}`);
            return false;
            
        } catch (error: any) {
            console.log(`    Verification error: ${error.message}`);
            return false;
        }
    }

    /**
     * QUICK: Fast ADB command execution
     */
    private async executeADBCommandQuick(command: string): Promise<string> {
        try {
            const fullCommand = `adb -s ${this.deviceId} shell ${command}`;
            const { stdout } = await execAsync(fullCommand, { timeout: 2000 });
            return stdout.trim();
        } catch (error: any) {
            return '';
        }
    }

    /**
     * Get total calls answered
     */
    getCallsAnswered(): number {
        return this.callsAnswered;
    }

    /**
     * Check if service is running
     */
    isRunning(): boolean {
        return this.running && this.isMonitoring;
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}