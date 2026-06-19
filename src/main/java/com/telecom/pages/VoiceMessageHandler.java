package com.telecom.pages;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.nativekey.AndroidKey;
import io.appium.java_client.android.nativekey.KeyEvent;
import org.openqa.selenium.By;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.interactions.PointerInput;
import org.openqa.selenium.interactions.Sequence;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;
import com.telecom.verification.MessageVerifier;
import com.telecom.verification.MessageVerifier.SentSmsInfo;

import java.text.SimpleDateFormat;
import java.time.Duration;
import java.util.*;

/**
 *  ULTIMATE VOICE MESSAGE HANDLER - With Timestamp Verification
 */
    @SuppressWarnings("unused")
public class VoiceMessageHandler {
    private AndroidDriver driver;
    private WebDriverWait wait;
    private MessageVerifier messageVerifier;
    private String currentPhoneNumber;
    
    // Voice message button locators
    private static final By VOICE_BUTTON_MAIN = By.xpath("//*[contains(@content-desc, 'voice') or contains(@content-desc, 'microphone')]");
    
    public VoiceMessageHandler(AndroidDriver driver) {
        this.driver = driver;
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(30));
        this.messageVerifier = new MessageVerifier(driver);
    }
    
    /**
     *  ULTIMATE VOICE MESSAGE SOLUTION with timestamp verification
     */
    public boolean sendVoiceMessage(String phoneNumber) {
        this.currentPhoneNumber = phoneNumber;
        // Set the recipient number for verification
        messageVerifier.setRecipientNumber(phoneNumber);
        
        System.out.println("🎤 ULTIMATE VOICE MESSAGE to: " + phoneNumber);
        long startTime = System.currentTimeMillis();
        
        try {
            // 1. Open Messaging App
            System.out.println(" Step 1: Opening Google Messages...");
            openMessagingApp();
            
            // 2. Ensure main screen
            System.out.println(" Step 2: Ensuring main screen...");
            ensureMainScreen();
            
            // 3. Start new conversation
            System.out.println("💬 Step 3: Starting new conversation...");
            startNewConversation();
            
            // 4. Enter phone number
            System.out.println("📞 Step 4: Entering phone number...");
            enterPhoneNumber(phoneNumber);
            
            // 5. Wait for conversation to load
            System.out.println("⏳ Step 5: Waiting for conversation...");
            Thread.sleep(3000);
            
            // 6. Find and hold voice button
            System.out.println("🎤 Step 6: Finding voice button...");
            WebElement voiceButton = findVoiceButtonUltimate();
            if (voiceButton == null) {
                voiceButton = findVoiceButtonByPosition();
            }
            
            if (voiceButton == null) {
                System.out.println("❌ Could not find voice button at all");
                return false;
            }
            
            System.out.println(" Voice button found!");
            
            // 7. Hold voice button for recording
            System.out.println("⏺️ Step 7: Recording voice message (5 seconds)...");
            boolean recorded = holdVoiceButtonUltimate(voiceButton, 5000);
            
            if (!recorded) {
                System.out.println("❌ Recording failed");
                return false;
            }
            
            // 8. Wait for processing
            System.out.println("⏳ Step 8: Processing recording...");
            Thread.sleep(2000);
            
            // 9. Send the voice message
            boolean sent = sendVoiceMessageUltimate();
            
            if (sent) {
                // 10. Verify using unified verification with timestamp
                System.out.println("🔍 Step 10: Verifying voice message with timestamp...");
                Thread.sleep(2000); // Wait for message to appear in database
                
                SentSmsInfo sentInfo = messageVerifier.verifyMessageSentWithTimestamp(null);
                
                if (sentInfo != null) {
                    long endTime = System.currentTimeMillis();
                    long totalTime = endTime - startTime;
                    
                    System.out.println("✅ VOICE MESSAGE VERIFIED AS SENT!");
                    System.out.println("📊 Voice Message Details:");
                    System.out.println("   Phone Number: " + phoneNumber);
                    System.out.println("   Sent Timestamp: " + sentInfo.date);
                    System.out.println("   Sent Time: " + sentInfo.getFormattedDate());
                    System.out.println("   Total Process Time: " + totalTime + " ms (" + (totalTime / 1000.0) + " seconds)");
                    return true;
                } else {
                    System.out.println("❌ Voice message verification failed - message not found in sent database");
                    return false;
                }
            } else {
                System.out.println("❌ Failed to send voice message");
                return false;
            }
            
        } catch (Exception e) {
            System.out.println("❌ Voice message failed: " + e.getMessage());
            e.printStackTrace();
            return false;
        }
    }
    
    /**
     * Send voice message and return detailed info with timestamp
     */
    public Map<String, Object> sendVoiceMessageWithDetails(String phoneNumber) {
        Map<String, Object> result = new HashMap<>();
        this.currentPhoneNumber = phoneNumber;
        messageVerifier.setRecipientNumber(phoneNumber);
        
        long startTime = System.currentTimeMillis();
        boolean success = sendVoiceMessage(phoneNumber);
        long endTime = System.currentTimeMillis();
        
        result.put("success", success);
        result.put("phoneNumber", phoneNumber);
        result.put("startTime", startTime);
        result.put("endTime", endTime);
        result.put("duration", endTime - startTime);
        
        if (success) {
            SentSmsInfo sentInfo = messageVerifier.getLatestSentMessage();
            if (sentInfo != null) {
                result.put("sentTimestamp", sentInfo.date);
                result.put("sentTimeFormatted", sentInfo.getFormattedDate());
                result.put("messageBody", sentInfo.body);
            }
        }
        
        return result;
    }
    
    /**
     *  ULTIMATE VOICE BUTTON FINDER
     */
    private WebElement findVoiceButtonUltimate() {
        List<By> locators = Arrays.asList(
            VOICE_BUTTON_MAIN,
            By.xpath("//*[contains(@content-desc, 'voice') or contains(@content-desc, 'microphone')]"),
            By.xpath("//android.widget.ImageButton[contains(@resource-id, 'audio_button')]"),
            By.xpath("//android.widget.ImageView[@content-desc='Voice message']")
        );
        
        for (By locator : locators) {
            try {
                System.out.println("   🔍 Trying locator: " + locator);
                List<WebElement> elements = driver.findElements(locator);
                
                for (WebElement element : elements) {
                    try {
                        if (element.isDisplayed() && element.isEnabled()) {
                            System.out.println("    Found voice button with: " + locator);
                            return element;
                        }
                    } catch (Exception e) {
                        continue;
                    }
                }
            } catch (Exception e) {
                continue;
            }
        }
        
        return null;
    }
    
    /**
     *  FIND VOICE BUTTON BY POSITION
     */
    private WebElement findVoiceButtonByPosition() {
        try {
            System.out.println("   📍 Finding voice button by screen position...");
            
            int screenWidth = driver.manage().window().getSize().getWidth();
            int screenHeight = driver.manage().window().getSize().getHeight();
            
            int targetX = (int) (screenWidth * 0.85);
            int targetY = (int) (screenHeight * 0.92);
            
            System.out.println("   📍 Tapping at position: (" + targetX + ", " + targetY + ")");
            
            List<WebElement> allElements = driver.findElements(By.xpath("//*"));
            
            for (WebElement element : allElements) {
                try {
                    if (!element.isDisplayed()) continue;
                    
                    int elementX = element.getLocation().getX();
                    int elementY = element.getLocation().getY();
                    int elementWidth = element.getSize().getWidth();
                    int elementHeight = element.getSize().getHeight();
                    
                    if (targetX >= elementX && targetX <= (elementX + elementWidth) &&
                        targetY >= elementY && targetY <= (elementY + elementHeight)) {
                        
                        String className = element.getAttribute("className");
                        
                        if (className.contains("Button") || className.contains("ImageView")) {
                            System.out.println("    Likely voice button found by position!");
                            return element;
                        }
                    }
                } catch (Exception e) {
                    continue;
                }
            }
            
            System.out.println("   📍 No specific element found, will tap at position");
            tapAtPosition(targetX, targetY);
            return createDummyElement(targetX, targetY);
            
        } catch (Exception e) {
            System.out.println("   ❌ Position finding failed: " + e.getMessage());
            return null;
        }
    }
    
    /**
     *  ULTIMATE VOICE BUTTON HOLD
     */
    private boolean holdVoiceButtonUltimate(WebElement voiceButton, int durationMs) {
        try {
            System.out.println("   🤏 Holding voice button for " + durationMs + "ms");
            
            // Method 1: W3C Actions
            try {
                System.out.println("   🎯 Method 1: Using W3C Actions");
                
                int x = voiceButton.getLocation().getX() + (voiceButton.getSize().getWidth() / 2);
                int y = voiceButton.getLocation().getY() + (voiceButton.getSize().getHeight() / 2);
                
                System.out.println("   🎯 Button center: (" + x + ", " + y + ")");
                
                PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
                Sequence sequence = new Sequence(finger, 0);
                
                sequence.addAction(finger.createPointerMove(
                    Duration.ZERO,
                    PointerInput.Origin.viewport(),
                    x, y
                ));
                
                sequence.addAction(finger.createPointerDown(
                    PointerInput.MouseButton.LEFT.asArg()
                ));
                
                sequence.addAction(finger.createPointerMove(
                    Duration.ofMillis(durationMs),
                    PointerInput.Origin.viewport(),
                    x, y
                ));
                
                sequence.addAction(finger.createPointerUp(
                    PointerInput.MouseButton.LEFT.asArg()
                ));
                
                driver.perform(Collections.singletonList(sequence));
                
                System.out.println("    Hold completed using W3C Actions");
                Thread.sleep(1000);
                return true;
                
            } catch (Exception e1) {
                System.out.println("    W3C Actions failed: " + e1.getMessage());
            }
            
            // Method 2: ADB shell command
            try {
                System.out.println("   🎯 Method 2: Using ADB shell");
                
                int x = voiceButton.getLocation().getX() + (voiceButton.getSize().getWidth() / 2);
                int y = voiceButton.getLocation().getY() + (voiceButton.getSize().getHeight() / 2);
                
                String deviceId = driver.getCapabilities().getCapability("udid").toString();
                
                Process process = Runtime.getRuntime().exec(new String[]{
                    "adb", "-s", deviceId, "shell", "input", "swipe",
                    String.valueOf(x), String.valueOf(y),
                    String.valueOf(x), String.valueOf(y),
                    String.valueOf(durationMs)
                });
                process.waitFor();
                
                System.out.println("    Hold completed using ADB");
                Thread.sleep(1000);
                return true;
                
            } catch (Exception e2) {
                System.out.println("    ADB method failed: " + e2.getMessage());
            }
            
            return false;
            
        } catch (Exception e) {
            System.out.println("   ❌ All hold methods failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     *  ULTIMATE SEND VOICE MESSAGE
     */
    private boolean sendVoiceMessageUltimate() {
        try {
            System.out.println("   🔍 Looking for send button...");
            
            List<By> sendLocators = Arrays.asList(
                By.xpath("//android.view.View[@resource-id=\"Compose:Draft:Send\"]/android.widget.Button"),
                By.xpath("//android.widget.ImageView[@content-desc='Send']"),
                By.xpath("//android.widget.Button[@content-desc='Send']"),
                By.id("com.google.android.apps.messaging:id/send_message_button_icon")
            );
            
            for (By locator : sendLocators) {
                try {
                    WebElement sendButton = wait.until(ExpectedConditions.elementToBeClickable(locator));
                    if (sendButton != null && sendButton.isDisplayed()) {
                        System.out.println("    Found send button with: " + locator);
                        sendButton.click();
                        Thread.sleep(1000);
                        return true;
                    }
                } catch (Exception e) {
                    continue;
                }
            }
            
            // Fallback: Press Enter key
            System.out.println("   ⌨️ Trying Enter key...");
            driver.pressKey(new KeyEvent(AndroidKey.ENTER));
            Thread.sleep(3000);
            return true;
            
        } catch (Exception e) {
            System.out.println("   ❌ Send button error: " + e.getMessage());
            return false;
        }
    }
    
    // ==================== HELPER METHODS ====================
    
    private void openMessagingApp() throws Exception {
        try {
            driver.activateApp("com.google.android.apps.messaging");
            System.out.println("    Messaging app activated");
        } catch (Exception e) {
            Map<String, Object> params = new HashMap<>();
            params.put("command", "am start -n com.google.android.apps.messaging/com.google.android.apps.messaging.ui.ConversationListActivity");
            driver.executeScript("mobile: shell", params);
            System.out.println("    Messaging app opened via shell");
        }
        Thread.sleep(5000);
    }
    
    private void ensureMainScreen() throws Exception {
        try {
            driver.findElement(By.id("com.google.android.apps.messaging:id/start_chat_fab"));
            System.out.println("    Already on main screen");
        } catch (Exception e) {
            for (int i = 0; i < 5; i++) {
                try {
                    driver.pressKey(new KeyEvent(AndroidKey.BACK));
                    Thread.sleep(1000);
                    try {
                        driver.findElement(By.id("com.google.android.apps.messaging:id/start_chat_fab"));
                        System.out.println("    Navigated to main screen");
                        return;
                    } catch (Exception ex) {
                        continue;
                    }
                } catch (Exception ex) {
                    continue;
                }
            }
            System.out.println("    Could not navigate to main screen, continuing anyway");
        }
    }
    
    private void startNewConversation() throws Exception {
        WebElement startChatButton = wait.until(
            ExpectedConditions.elementToBeClickable(By.id("com.google.android.apps.messaging:id/start_chat_fab"))
        );
        startChatButton.click();
        Thread.sleep(3000);
        System.out.println("    New conversation started");
    }
    
    private void enterPhoneNumber(String phoneNumber) throws Exception {
        Thread.sleep(3000);
        
        try {
            WebElement inputField = driver.findElement(By.id("com.google.android.apps.messaging:id/recipient_text_view"));
            inputField.clear();
        } catch (Exception e) {
            // Ignore
        }
        
        for (char digit : phoneNumber.toCharArray()) {
            try {
                AndroidKey key = AndroidKey.valueOf("DIGIT_" + digit);
                driver.pressKey(new KeyEvent(key));
                Thread.sleep(200);
            } catch (Exception e) {
                try {
                    WebElement inputField = driver.findElement(By.id("com.google.android.apps.messaging:id/recipient_text_view"));
                    inputField.sendKeys(String.valueOf(digit));
                    Thread.sleep(200);
                } catch (Exception ex) {
                    System.out.println("    Could not type digit: " + digit);
                }
            }
        }
        
        driver.pressKey(new KeyEvent(AndroidKey.ENTER));
        Thread.sleep(3000);
        System.out.println("    Phone number entered");
    }
    
    private void tapAtPosition(int x, int y) {
        try {
            PointerInput finger = new PointerInput(PointerInput.Kind.TOUCH, "finger");
            Sequence tap = new Sequence(finger, 0);
            
            tap.addAction(finger.createPointerMove(
                Duration.ZERO,
                PointerInput.Origin.viewport(),
                x, y
            ));
            
            tap.addAction(finger.createPointerDown(PointerInput.MouseButton.LEFT.asArg()));
            tap.addAction(finger.createPointerUp(PointerInput.MouseButton.LEFT.asArg()));
            
            driver.perform(Collections.singletonList(tap));
            
        } catch (Exception e) {
            System.out.println("   ❌ Tap failed: " + e.getMessage());
        }
    }
    
    private WebElement createDummyElement(int x, int y) {
        return new WebElement() {
            @Override
            public void click() { tapAtPosition(x, y); }
            @Override public void submit() {}
            @Override public void sendKeys(CharSequence... charSequences) {}
            @Override public void clear() {}
            @Override public String getTagName() { return "dummy"; }
            @Override public String getAttribute(String s) { return ""; }
            @Override public boolean isSelected() { return false; }
            @Override public boolean isEnabled() { return true; }
            @Override public String getText() { return ""; }
            @Override public java.util.List<WebElement> findElements(By by) { return new ArrayList<>(); }
            @Override public WebElement findElement(By by) { return this; }
            @Override public boolean isDisplayed() { return true; }
            @Override public org.openqa.selenium.Point getLocation() { return new org.openqa.selenium.Point(x, y); }
            @Override public org.openqa.selenium.Dimension getSize() { return new org.openqa.selenium.Dimension(100, 100); }
            @Override public org.openqa.selenium.Rectangle getRect() { return new org.openqa.selenium.Rectangle(x, y, 100, 100); }
            @Override public String getCssValue(String s) { return ""; }
            @Override public <X> X getScreenshotAs(org.openqa.selenium.OutputType<X> outputType) { return null; }
        };
    }
}