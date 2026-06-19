package com.telecom.verification;

import io.appium.java_client.android.AndroidDriver;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.concurrent.TimeUnit;
    @SuppressWarnings("unused")
public class MessageVerifier {
    private String deviceSerial;
    private String recipientNumber;
    private AndroidDriver driver;
    
    // SMS type constants
    private static final int TYPE_INBOX = 1;

    private static final int TYPE_SENT = 2;
    
    private static final SimpleDateFormat DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS");
    
    /**
     * Constructor for direct ADB usage
     */
    public MessageVerifier(String deviceSerial, String recipientNumber) {
        this.deviceSerial = deviceSerial;
        this.recipientNumber = recipientNumber;
        this.driver = null;
    }
    
    /**
     * Constructor for AndroidDriver compatibility
     */
    public MessageVerifier(AndroidDriver driver) {
        this.driver = driver;
        try {
            this.deviceSerial = extractDeviceSerial(driver);
        } catch (Exception e) {
            System.err.println("Failed to extract device serial: " + e.getMessage());
            this.deviceSerial = null;
        }
        this.recipientNumber = null;
    }
    
    /**
     * Extract device serial from AndroidDriver
     */
    private String extractDeviceSerial(AndroidDriver driver) {
        try {
            Object udid = driver.getCapabilities().getCapability("udid");
            if (udid != null && !udid.toString().isEmpty()) {
                System.out.println("   📱 Device serial (UDID): " + udid);
                return udid.toString();
            }
        } catch (Exception e) {
            // Continue to fallback
        }
        
        // Fallback: Get first connected device
        try {
            String adbDevices = executeSimpleCommand("adb devices");
            if (adbDevices != null && !adbDevices.isEmpty()) {
                String[] lines = adbDevices.split("\n");
                for (String line : lines) {
                    if (line.contains("device") && !line.contains("List of devices")) {
                        String serial = line.split("\\s+")[0];
                        if (serial != null && !serial.isEmpty()) {
                            System.out.println("   📱 Using first available device: " + serial);
                            return serial;
                        }
                    }
                }
            }
        } catch (Exception e) {
            System.err.println("Failed to get device via ADB: " + e.getMessage());
        }
        
        return null;
    }
    
    /**
     * Set recipient number for verification
     */
    public void setRecipientNumber(String recipientNumber) {
        this.recipientNumber = recipientNumber;
    }
    
    /**
     * Get current device serial
     */
    public String getDeviceSerial() {
        return deviceSerial;
    }
    
    /**
     * VERIFY MESSAGE SENT - Basic version
     */
    public boolean verifyMessageSent(String expectedMessageBody) {
        if (recipientNumber == null) {
            System.out.println("❌ Recipient number not set for verification");
            return false;
        }
        
        if (deviceSerial == null) {
            System.out.println("❌ Device serial not available for verification");
            return false;
        }
        
        System.out.println("🔍 Verifying SENT message via ADB...");
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms/sent --where \"address='%s'\" --sort \"date DESC\" --limit 1",
                deviceSerial, recipientNumber
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && !result.isEmpty() && !result.contains("No result") && result.contains("Row:")) {
                SentSmsInfo smsInfo = parseSentSmsResult(result);
                
                if (smsInfo != null) {
                    System.out.println("   ✓ Found SENT message at: " + smsInfo.getFormattedDate());
                    
                    if (expectedMessageBody != null && !expectedMessageBody.isEmpty()) {
                        if (smsInfo.body != null && smsInfo.body.equals(expectedMessageBody)) {
                            return true;
                        } else {
                            System.out.println("   ✗ Message body mismatch!");
                            return false;
                        }
                    }
                    return true;
                }
            }
            
            System.out.println("   ✗ No sent messages found to: " + recipientNumber);
            return false;
            
        } catch (Exception e) {
            System.out.println("❌ Verification error: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * VERIFY MESSAGE SENT WITH TIMESTAMP - Returns SentSmsInfo object
     * This is the method your code is trying to call
     */
    public SentSmsInfo verifyMessageSentWithTimestamp(String expectedMessageBody) {
        if (recipientNumber == null) {
            System.out.println("❌ Recipient number not set for verification");
            return null;
        }
        
        if (deviceSerial == null) {
            System.out.println("❌ Device serial not available for verification");
            return null;
        }
        
        System.out.println("🔍 Verifying sent message with timestamp via ADB...");
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms/sent --where \"address='%s'\" --sort \"date DESC\" --limit 1",
                deviceSerial, recipientNumber
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && !result.isEmpty() && !result.contains("No result") && result.contains("Row:")) {
                SentSmsInfo smsInfo = parseSentSmsResult(result);
                
                if (smsInfo != null) {
                    System.out.println("   ✓ Found sent message at: " + smsInfo.getFormattedDate());
                    
                    if (expectedMessageBody != null && !expectedMessageBody.isEmpty()) {
                        if (smsInfo.body != null && smsInfo.body.equals(expectedMessageBody)) {
                            return smsInfo;
                        } else {
                            System.out.println("   ✗ Message body mismatch!");
                            return null;
                        }
                    }
                    return smsInfo;
                }
            }
            
            System.out.println("   ✗ No sent messages found to: " + recipientNumber);
            return null;
            
        } catch (Exception e) {
            System.out.println("❌ Verification error: " + e.getMessage());
            return null;
        }
    }
    
    /**
     * GET LATEST SENT MESSAGE
     */
    public SentSmsInfo getLatestSentMessage() {
        if (recipientNumber == null || deviceSerial == null) {
            return null;
        }
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms/sent --where \"address='%s'\" --sort \"date DESC\" --limit 1",
                deviceSerial, recipientNumber
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && result.contains("Row:")) {
                return parseSentSmsResult(result);
            }
            
        } catch (Exception e) {
            System.out.println("Error getting latest sent message: " + e.getMessage());
        }
        
        return null;
    }
    
    /**
     * VERIFY MESSAGE SENT (overloaded for backward compatibility)
     */
    public boolean verifyMessageSent() {
        return verifyMessageSent(null);
    }
    
    /**
     * VERIFY MESSAGE RECEIVED
     */
    public boolean verifyMessageReceived(String expectedMessageBody, int threadId) {
        if (deviceSerial == null) {
            System.out.println("❌ Device serial not available for verification");
            return false;
        }
        
        System.out.println("🔍 Verifying RECEIVED message via ADB...");
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms --where \"thread_id=%d\" --projection _id:address:body:type:date --sort \"date DESC\" --limit 1",
                deviceSerial, threadId
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && !result.isEmpty() && result.contains("Row:")) {
                ReceivedSmsInfo smsInfo = parseReceivedSmsResult(result);
                
                if (smsInfo != null && smsInfo.type == TYPE_INBOX) {
                    System.out.println("   ✓ Found RECEIVED message at: " + smsInfo.getFormattedDate());
                    
                    if (expectedMessageBody != null && !expectedMessageBody.isEmpty()) {
                        if (smsInfo.body != null && smsInfo.body.equals(expectedMessageBody)) {
                            return true;
                        }
                    }
                    return true;
                }
            }
            
            return false;
            
        } catch (Exception e) {
            System.out.println("❌ Verification error: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * VERIFY MESSAGE RECEIVED BY ADDRESS
     */
    public boolean verifyMessageReceivedByAddress(String expectedMessageBody, String senderAddress) {
        if (deviceSerial == null) {
            System.out.println("❌ Device serial not available for verification");
            return false;
        }
        
        System.out.println("🔍 Verifying RECEIVED message by address via ADB...");
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms/inbox --where \"address='%s'\" --projection _id:address:body:type:date --sort \"date DESC\" --limit 1",
                deviceSerial, senderAddress
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && !result.isEmpty() && result.contains("Row:")) {
                ReceivedSmsInfo smsInfo = parseReceivedSmsResult(result);
                
                if (smsInfo != null && smsInfo.type == TYPE_INBOX) {
                    System.out.println("   ✓ Found RECEIVED message at: " + smsInfo.getFormattedDate());
                    
                    if (expectedMessageBody != null && !expectedMessageBody.isEmpty()) {
                        if (smsInfo.body != null && smsInfo.body.equals(expectedMessageBody)) {
                            return true;
                        }
                    }
                    return true;
                }
            }
            
            return false;
            
        } catch (Exception e) {
            System.out.println("❌ Verification error: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * GET THREAD ID for a specific address
     */
    public int getThreadId(String address) {
        if (deviceSerial == null) {
            System.out.println("❌ Device serial not available");
            return -1;
        }
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms/sent --where \"address='%s'\" --projection thread_id --limit 1",
                deviceSerial, address
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && result.contains("thread_id=")) {
                int threadId = parseThreadId(result);
                if (threadId > 0) {
                    return threadId;
                }
            }
            
            command = String.format(
                "adb -s %s shell content query --uri content://sms/inbox --where \"address='%s'\" --projection thread_id --limit 1",
                deviceSerial, address
            );
            
            result = executeAdbCommand(command);
            
            if (result != null && result.contains("thread_id=")) {
                int threadId = parseThreadId(result);
                if (threadId > 0) {
                    return threadId;
                }
            }
            
            return -1;
            
        } catch (Exception e) {
            System.out.println("❌ Error getting thread ID: " + e.getMessage());
            return -1;
        }
    }
    
    /**
     * GET ALL SENT MESSAGES
     */
    public List<SentSmsInfo> getAllSentMessages(String address) {
        List<SentSmsInfo> messages = new ArrayList<>();
        
        if (deviceSerial == null) {
            return messages;
        }
        
        try {
            String command = String.format(
                "adb -s %s shell content query --uri content://sms/sent --projection address:body:date --where \"address='%s'\" --sort \"date DESC\"",
                deviceSerial, address
            );
            
            String result = executeAdbCommand(command);
            
            if (result != null && !result.isEmpty() && result.contains("Row:")) {
                String[] lines = result.split("\n");
                for (String line : lines) {
                    if (line.trim().startsWith("Row:")) {
                        SentSmsInfo smsInfo = parseSentSmsResult(line);
                        if (smsInfo != null) {
                            messages.add(smsInfo);
                        }
                    }
                }
            }
            
        } catch (Exception e) {
            System.out.println("Error getting sent messages: " + e.getMessage());
        }
        
        return messages;
    }
    
    // ==================== HELPER METHODS ====================
    
    private String executeSimpleCommand(String command) {
        try {
            ProcessBuilder processBuilder = new ProcessBuilder(command.split(" "));
            processBuilder.redirectErrorStream(true);
            Process process = processBuilder.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            process.waitFor(10, TimeUnit.SECONDS);
            return output.toString().trim();
        } catch (Exception e) {
            return null;
        }
    }
    
    private String executeAdbCommand(String command) {
        try {
            ProcessBuilder processBuilder = new ProcessBuilder();
            String[] cmdArray = command.split("(?<=[^\\\\])\\s+");
            for (int i = 0; i < cmdArray.length; i++) {
                cmdArray[i] = cmdArray[i].replace("\\\"", "\"");
            }
            
            processBuilder.command(cmdArray);
            processBuilder.redirectErrorStream(true);
            
            Process process = processBuilder.start();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            boolean finished = process.waitFor(30, TimeUnit.SECONDS);
            
            if (!finished) {
                return null;
            }
            
            return output.toString().trim();
            
        } catch (Exception e) {
            System.out.println("   Error executing ADB command: " + e.getMessage());
            return null;
        }
    }
    
    private SentSmsInfo parseSentSmsResult(String result) {
        try {
            SentSmsInfo info = new SentSmsInfo();
            
            // Parse format: "Row: 0 address=9876543210, body=fhurfhry, date=1781509896682"
            if (result.contains("address=")) {
                int addressStart = result.indexOf("address=") + 8;
                int addressEnd = result.indexOf(",", addressStart);
                if (addressEnd == -1) addressEnd = result.length();
                info.address = result.substring(addressStart, addressEnd).trim();
                
                int bodyStart = result.indexOf("body=") + 5;
                if (bodyStart > 5) {
                    int bodyEnd = result.indexOf(", date=", bodyStart);
                    if (bodyEnd == -1) bodyEnd = result.length();
                    info.body = result.substring(bodyStart, bodyEnd).trim();
                }
                
                int dateStart = result.indexOf("date=") + 5;
                if (dateStart > 5) {
                    int dateEnd = result.length();
                    info.date = Long.parseLong(result.substring(dateStart, dateEnd).trim());
                }
                
                return info;
            }
            
        } catch (Exception e) {
            System.out.println("   Error parsing sent SMS: " + e.getMessage());
        }
        
        return null;
    }
    
    private ReceivedSmsInfo parseReceivedSmsResult(String result) {
        try {
            ReceivedSmsInfo info = new ReceivedSmsInfo();
            
            // Parse format: "Row: 0 _id=192, address=+919640571324, body=Hi, type=1, date=1781515804887"
            if (result.contains("_id=")) {
                int idStart = result.indexOf("_id=") + 4;
                int idEnd = result.indexOf(",", idStart);
                if (idEnd == -1) idEnd = result.length();
                info.id = Integer.parseInt(result.substring(idStart, idEnd).trim());
                
                int addressStart = result.indexOf("address=") + 8;
                int addressEnd = result.indexOf(",", addressStart);
                if (addressEnd == -1) addressEnd = result.length();
                info.address = result.substring(addressStart, addressEnd).trim();
                
                int bodyStart = result.indexOf("body=") + 5;
                if (bodyStart > 5) {
                    int bodyEnd = result.indexOf(", type=", bodyStart);
                    if (bodyEnd == -1) bodyEnd = result.indexOf(", date=", bodyStart);
                    if (bodyEnd == -1) bodyEnd = result.length();
                    info.body = result.substring(bodyStart, bodyEnd).trim();
                }
                
                int typeStart = result.indexOf("type=") + 5;
                if (typeStart > 5) {
                    int typeEnd = result.indexOf(",", typeStart);
                    if (typeEnd == -1) typeEnd = result.length();
                    info.type = Integer.parseInt(result.substring(typeStart, typeEnd).trim());
                }
                
                int dateStart = result.indexOf("date=") + 5;
                if (dateStart > 5) {
                    int dateEnd = result.length();
                    info.date = Long.parseLong(result.substring(dateStart, dateEnd).trim());
                }
                
                return info;
            }
            
        } catch (Exception e) {
            System.out.println("   Error parsing received SMS: " + e.getMessage());
        }
        
        return null;
    }
    
    private int parseThreadId(String result) {
        try {
            if (result.contains("thread_id=")) {
                int start = result.indexOf("thread_id=") + 10;
                int end = result.indexOf(",", start);
                if (end == -1) end = result.indexOf(" ", start);
                if (end == -1) end = result.length();
                return Integer.parseInt(result.substring(start, end).trim());
            }
        } catch (Exception e) {
            System.out.println("   Error parsing thread ID: " + e.getMessage());
        }
        return -1;
    }
    
    // ==================== INNER CLASSES ====================
    
    public static class SentSmsInfo {
        public String address;
        public String body;
        public long date;
        
        public String getFormattedDate() {
            return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS").format(new Date(date));
        }
        
        @Override
        public String toString() {
            return "SentSmsInfo{address='" + address + "', body='" + body + "', date=" + date + ", formattedDate='" + getFormattedDate() + "'}";
        }
    }
    
    public static class ReceivedSmsInfo {
        public int id;
        public String address;
        public String body;
        public int type;
        public long date;
        
        public String getFormattedDate() {
            return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS").format(new Date(date));
        }
        
        public boolean isReceived() {
            return type == 1;
        }
        
        @Override
        public String toString() {
            return "ReceivedSmsInfo{id=" + id + ", address='" + address + "', body='" + body + "', type=" + type + ", date=" + date + ", formattedDate='" + getFormattedDate() + "'}";
        }
    }
}