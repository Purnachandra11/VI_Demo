package com.telecom.tests;

import java.net.URL;
import java.time.Duration;
import java.util.Map;

import org.testng.Assert;
import org.testng.annotations.AfterClass;
import org.testng.annotations.AfterMethod;
import org.testng.annotations.BeforeClass;
import org.testng.annotations.BeforeMethod;
import org.testng.annotations.Test;

import com.telecom.config.AppiumConfig;
import com.telecom.config.SIMToolkitConfig;
import com.telecom.core.BaseTest;
import com.telecom.pages.SIMToolkitPage;
import com.telecom.utils.DeviceUtils;
import com.telecom.utils.ScreenshotUtils;

import io.appium.java_client.android.AndroidDriver;
import io.appium.java_client.android.options.UiAutomator2Options;

public class SIMToolkitCaptureTest extends BaseTest {
    
    private SIMToolkitPage simToolkitPage;
    private ScreenshotUtils screenshotUtils;
    private DeviceUtils deviceUtils;
    private SIMToolkitConfig.SIMType detectedSimType;
    private String deviceId = System.getProperty("udid");
    private boolean brandingVerified;
    
    @BeforeClass
    public void setupClass() {
        System.out.println("\n🚀 Starting Vi SIM Toolkit Capture Test");
        System.out.println("   Time: " + new java.util.Date());
        
        if (!isAppiumServerRunning()) {
            System.out.println("🔄 Starting Appium server...");
            AppiumConfig.startAppiumServer();
        } else {
            System.out.println("✅ Using existing Appium server");
        }
    }
    
    private boolean isAppiumServerRunning() {
        try {
            @SuppressWarnings("deprecation")
            java.net.HttpURLConnection connection = (java.net.HttpURLConnection) 
                new URL("http://127.0.0.1:4723/status").openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(3000);
            connection.connect();
            return connection.getResponseCode() == 200;
        } catch (Exception e) {
            return false;
        }
    }
    
    @SuppressWarnings("deprecation")
    @BeforeMethod
    public void setupTest() {
        try {
            System.out.println("\n⚙️ Initializing test environment...");
            
            UiAutomator2Options options = new UiAutomator2Options();
            
            String udid = System.getProperty("udid", deviceId);
            String platformVersion = System.getProperty("platformVersion", "13");
            String deviceName = System.getProperty("deviceName", "GooglePixel");
            
            options.setPlatformName("Android")
                   .setUdid(udid)
                   .setPlatformVersion(platformVersion)
                   .setDeviceName(deviceName)
                   .setAutomationName("UiAutomator2")
                   .setNoReset(false)
                   .setFullReset(false)
                   .setAutoGrantPermissions(true)
                   .setNewCommandTimeout(Duration.ofSeconds(300))
                   .setAvdLaunchTimeout(Duration.ofSeconds(300))
                   .setAvdReadyTimeout(Duration.ofSeconds(300))
                   .setUiautomator2ServerLaunchTimeout(Duration.ofSeconds(300))
                   .setUiautomator2ServerInstallTimeout(Duration.ofSeconds(300));
            
            options.setCapability("appium:ignoreHiddenApiPolicyError", true);
            options.setCapability("appium:disableWindowAnimation", true);
            options.setCapability("appium:allowInsecure", "adb_shell");
            options.setCapability("appium:relaxedSecurityEnabled", true);
            options.setCapability("appium:skipDeviceInitialization", true);
            options.setCapability("appium:skipServerInstallation", true);
            options.setCapability("appium:enforceAppInstall", false);
            options.setCapability("appium:dontStopAppOnReset", true);
            
            driver = new AndroidDriver(new URL("http://127.0.0.1:4723"), options);
            driver.manage().timeouts().implicitlyWait(Duration.ofSeconds(10));
            
            deviceUtils = new DeviceUtils(driver);
            screenshotUtils = new ScreenshotUtils(driver);
            
            if (getCurrentTestMethodName().equals("completeSIMToolkitCaptureFlow")) {
                screenshotUtils.clearScreenshots();
                System.out.println("🗑️ Screenshots cleared for fresh test run");
            }
            
            simToolkitPage = new SIMToolkitPage(driver, screenshotUtils, deviceId);
            
            System.out.println("\n✅ Test environment ready");
            System.out.println("   Device: " + deviceName);
            System.out.println("   UDID: " + udid);
            System.out.println("   Platform: Android " + platformVersion);
            System.out.println();
            
        } catch (Exception e) {
            System.err.println("\n❌ Test setup failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Test setup failed", e);
        }
    }
    
    private String getCurrentTestMethodName() {
        return new Throwable().getStackTrace()[2].getMethodName();
    }
    
    @Test(priority = 1, description = "Complete SIM Toolkit screenshot capture flow")
    public void completeSIMToolkitCaptureFlow() {
        System.out.println("\n" + "═".repeat(70));
        System.out.println("  TEST: Complete Vi SIM Toolkit Screenshot Capture");
        System.out.println("═".repeat(70));
        
        try {
            screenshotUtils.setTestStartTime();
            
            System.out.println("\n🚀 Step 1: Launch SIM Toolkit");
            boolean simToolkitLaunched = launchSIMToolkitViaADBCommand();
            
            if (simToolkitLaunched) {
                screenshotUtils.captureScreenshot("SIM Toolkit Launch");
                System.out.println("✅ SIM Toolkit launched successfully via ADB");
            } else {
                System.err.println("❌ Failed to launch SIM Toolkit");
                throw new RuntimeException("Failed to launch SIM Toolkit");
            }
            
            detectedSimType = simToolkitPage.detectAndHandleSIMScenario();
            
            brandingVerified = simToolkitPage.verifyViBranding();
            
            simToolkitPage.navigateToFlashOption();
            
            simToolkitPage.navigateToRoamingOption();
            
            simToolkitPage.validateRoamingSubMenus();
            
            screenshotUtils.setTestEndTime();
            
            Map<String, Boolean> verificationResults = 
                screenshotUtils.verifyRequiredScreenshots(detectedSimType);
            
            screenshotUtils.generateScreenshotReport();
            
            printTestSummary(brandingVerified, verificationResults);
            
        } catch (Exception e) {
            screenshotUtils.setTestEndTime();
            System.err.println("\n❌ Test execution failed: " + e.getMessage());
            e.printStackTrace();
            throw new RuntimeException("Test execution failed", e);
        }
    }
    
    private boolean launchSIMToolkitViaADBCommand() {
        try {
            System.out.println("📡 Executing ADB command to launch SIM Toolkit...");
            
            ProcessBuilder pb = new ProcessBuilder(
                "adb", "-s", deviceId, "shell", "monkey", "-p", "com.android.stk", 
                "-c", "android.intent.category.LAUNCHER", "1"
            );
            
            Process process = pb.start();
            int exitCode = process.waitFor();
            
            java.io.BufferedReader reader = new java.io.BufferedReader(
                new java.io.InputStreamReader(process.getInputStream())
            );
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            if (exitCode == 0) {
                System.out.println("✅ ADB command executed successfully");
                Thread.sleep(5000);
                return isSIMToolkitVisible();
            } else {
                System.err.println("❌ ADB command failed with exit code: " + exitCode);
                return false;
            }
            
        } catch (Exception e) {
            System.err.println("❌ Error executing ADB command: " + e.getMessage());
            return false;
        }
    }
    
    private boolean isSIMToolkitVisible() {
        try {
            String pageSource = driver.getPageSource();
            if (pageSource != null) {
                String lowerPageSource = pageSource.toLowerCase();
                if (lowerPageSource.contains("sim") || 
                    lowerPageSource.contains("stk") || 
                    lowerPageSource.contains("vodafone") ||
                    lowerPageSource.contains("vi")) {
                    System.out.println("✅ SIM Toolkit content found in page source");
                    return true;
                }
            }
            
            String[] indicators = {
                "SIM Toolkit", "STK", "SIM Menu", "SIM", 
                "Vi", "Vodafone", "Menu", "USSD"
            };
            
            for (String indicator : indicators) {
                try {
                    if (deviceUtils.isElementPresent(indicator)) {
                        System.out.println("✅ Found indicator: " + indicator);
                        return true;
                    }
                } catch (Exception e) {
                    // Continue
                }
            }
            
            return false;
        } catch (Exception e) {
            return false;
        }
    }
    
    @Test(priority = 2, description = "Validate screenshot requirements", 
          dependsOnMethods = "completeSIMToolkitCaptureFlow")
    public void validateScreenshotRequirements() {
        System.out.println("\n" + "═".repeat(70));
        System.out.println("  VALIDATION: Screenshot Requirements Check");
        System.out.println("═".repeat(70));
        
        System.out.println("\n📊 Screenshot Summary:");
        screenshotUtils.printScreenshotSummary();
        
        Map<String, Boolean> verificationResults = 
            screenshotUtils.verifyRequiredScreenshots(detectedSimType);
        
        int totalRequired = verificationResults.size();
        int capturedCount = (int) verificationResults.values().stream()
            .filter(Boolean::booleanValue)
            .count();
        
        System.out.println("\n📊 Validation Summary:");
        System.out.println("   Required screenshots: " + totalRequired);
        System.out.println("   Captured screenshots: " + capturedCount);
        System.out.println("   Missing screenshots: " + (totalRequired - capturedCount));
        
        if (capturedCount >= totalRequired) {
            System.out.println("\n✅ ALL SCREENSHOTS CAPTURED SUCCESSFULLY!");
        } else {
            System.out.println("\n⚠️ SOME SCREENSHOTS ARE MISSING!");
            
            System.out.println("\n📋 Missing screenshots:");
            for (Map.Entry<String, Boolean> entry : verificationResults.entrySet()) {
                if (!entry.getValue()) {
                    System.out.println("   ❌ " + entry.getKey());
                }
            }
        }
        
        if (detectedSimType == SIMToolkitConfig.SIMType.SINGLE_SIM) {
            int expectedCount = 5;
            Assert.assertTrue(capturedCount >= expectedCount, 
                "Expected at least " + expectedCount + " screenshots captured for Single SIM, but found " + capturedCount);
            System.out.println("\n✅ Validation passed for Single SIM device");
        } else {
            Assert.assertEquals(capturedCount, totalRequired, 
                "Not all required screenshots were captured!");
        }
    }
    
    private void printTestSummary(boolean brandingVerified, Map<String, Boolean> verificationResults) {
        System.out.println("\n" + "═".repeat(70));
        System.out.println("  TEST SUMMARY");
        System.out.println("═".repeat(70));
        
        System.out.println("\n📱 SIM Configuration:");
        System.out.println("   Type: " + detectedSimType.getDescription());
        System.out.println("   Vi Branding: " + (brandingVerified ? "✅ Verified" : "❌ Not Found"));
        
        int passed = (int) verificationResults.values().stream()
            .filter(Boolean::booleanValue)
            .count();
        int total = verificationResults.size();
        
        System.out.println("\n📸 Screenshot Status:");
        System.out.println("   Captured: " + passed + "/" + total);
        
        boolean isSuccess;
        if (detectedSimType == SIMToolkitConfig.SIMType.SINGLE_SIM) {
            isSuccess = passed >= 5;
            System.out.println("   (Single SIM: Vi India/Vodafone IN not required)");
        } else {
            isSuccess = passed >= total;
        }
        System.out.println("   Overall: " + (isSuccess ? "✅ PASS" : "❌ FAIL"));
        
        System.out.println("\n📋 Mandatory Screenshot Checklist:");
        System.out.println("   " + "─".repeat(60));
        
        for (Map.Entry<String, Boolean> entry : verificationResults.entrySet()) {
            String status;
            String key = entry.getKey();
            
            if (detectedSimType == SIMToolkitConfig.SIMType.SINGLE_SIM && 
                (key.equalsIgnoreCase("Vodafone IN") || key.equalsIgnoreCase("Vi India"))) {
                status = "⏭️";
                System.out.println("   " + status + " " + key + " (N/A for Single SIM)");
            } else {
                status = entry.getValue() ? "✅" : "❌";
                System.out.println("   " + status + " " + key);
            }
        }
        
        System.out.println("   " + "─".repeat(60));
    }
    
    @AfterMethod
    public void tearDown() {
        try {
            if (driver != null) {
                driver.quit();
                System.out.println("\n🔌 Driver closed successfully");
            }
        } catch (Exception e) {
            System.err.println("Error during teardown: " + e.getMessage());
        }
    }
    
    @AfterClass
    public void cleanupClass() {
        System.out.println("\n" + "═".repeat(70));
        System.out.println("  TEST SUITE COMPLETED");
        System.out.println("═".repeat(70));
        System.out.println("\n📂 Output Locations:");
        System.out.println("   Screenshots: " + SIMToolkitConfig.SCREENSHOT_DIR);
        System.out.println("   Reports: " + SIMToolkitConfig.REPORT_DIR);
        System.out.println("\n   Completed at: " + new java.util.Date());
        System.out.println();
    }
}