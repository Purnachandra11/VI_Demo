package com.telecom.pages;

import java.time.Duration;
import java.util.List;

import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.PageFactory;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

import com.telecom.config.SIMToolkitConfig;
import com.telecom.utils.DeviceUtils;
import com.telecom.utils.ProgressReporter;
import com.telecom.utils.ScreenshotUtils;

import io.appium.java_client.AppiumDriver;
import io.appium.java_client.pagefactory.AndroidFindBy;
import io.appium.java_client.pagefactory.AppiumFieldDecorator;

public class SIMToolkitPage {
    
    protected AppiumDriver driver;
    protected WebDriverWait wait;
    private String deviceId; 
    protected ScreenshotUtils screenshotUtils;
    private DeviceUtils deviceUtils;
    
    // Element locators
    @AndroidFindBy(xpath = "//*[@text='FLASH!' or contains(@text,'FLASH')]")
    private WebElement flashOption;
    
    @AndroidFindBy(xpath = "//*[@text='Roaming' or contains(@text, 'Roaming')]")
    private WebElement roamingOption;
    
    @AndroidFindBy(xpath = "//*[@text='International' or contains(@text, 'International')]")
    private WebElement internationalOption;
    
    @AndroidFindBy(xpath = "//*[@text='Vi India' or @text='Vodafone IN' or contains(@text, 'Vi India') or contains(@text, 'Vodafone IN')]")
    private WebElement viIndiaOption;
    
    @AndroidFindBy(id = "android:id/button1")
    private WebElement okButton;
    
    @AndroidFindBy(id = "android:id/button2")
    private WebElement cancelButton;
    
    @AndroidFindBy(xpath = "//*[contains(@text, 'Vodafone')]")
    private WebElement vodafoneElement;
    
    @AndroidFindBy(xpath = "//*[contains(@text, 'Vi')]")
    private List<WebElement> viElements;
    
    public SIMToolkitPage(AppiumDriver driver, ScreenshotUtils screenshotUtils, String deviceId) {
        this.driver = driver;
        this.deviceId = deviceId; 
        this.wait = new WebDriverWait(driver, Duration.ofSeconds(30));
        this.screenshotUtils = screenshotUtils;
        this.deviceUtils = new DeviceUtils(driver);
        PageFactory.initElements(new AppiumFieldDecorator(driver, Duration.ofSeconds(10)), this);
    }
    
    public SIMToolkitConfig.SIMType detectAndHandleSIMScenario() {
        System.out.println("┌─ Step 2: Detect & Handle SIM Scenario");
        reportProgress("STARTED", "Starting SIM Toolkit detection", 10);
        
        SIMToolkitConfig.SIMType simType = deviceUtils.detectSIMType();
        System.out.println("  Detected: " + simType.getDescription());
        reportProgress("SIM_DETECTED", "SIM Type: " + simType.getDescription(), 20);
        
        switch (simType) {
            case SINGLE_SIM:
                reportProgress("HANDLING_SINGLE_SIM", "Handling single SIM scenario", 30);
                handleSingleSIM();
                break;
            case DUAL_SIM_MIXED:
                reportProgress("HANDLING_DUAL_SIM_MIXED", "Handling dual SIM mixed scenario", 30);
                handleDualSIMMixed();
                break;
            case DUAL_SIM_VI:
                reportProgress("HANDLING_DUAL_SIM_VI", "Handling dual SIM Vi scenario", 30);
                handleDualSIMVi();
                break;
        }
        
        System.out.println("└─ ✅ SIM scenario handled\n");
        reportProgress("COMPLETED", "SIM scenario handled successfully", 40); 
        return simType;
    }
    
    private void handleSingleSIM() {
        System.out.println("  → Scenario A: Single SIM Device");
        reportProgress("SINGLE_SIM", "Processing single SIM device", 50);
        captureScreenshot("Vi Menu Home");
        reportProgress("SCREENSHOT_CAPTURED", "Screenshot captured for single SIM", 60);
    }

    private void handleDualSIMMixed() {
        System.out.println("  → Scenario B: Dual SIM (Vi + Other)");
        reportProgress("DUAL_SIM_MIXED", "Processing dual SIM mixed", 50);
        
        captureScreenshot("SIM Selection Screen");
        reportProgress("SCREENSHOT_1", "SIM selection screen captured", 60);
        
        selectViMenu();
        reportProgress("VI_MENU_SELECTED", "Vi menu selected", 70);
        
        captureScreenshot("Vi Menu Home");
        reportProgress("SCREENSHOT_2", "Vi Menu home captured", 80);
    }
    
    private void handleDualSIMVi() {
        System.out.println("  → Scenario C: Dual SIM (Both Vi)");
        reportProgress("DUAL_SIM_VI", "Processing dual SIM Vi", 50);
        
        captureScreenshot("SIM Selection Screen");
        reportProgress("SCREENSHOT_1", "SIM selection screen captured", 60);
        
        captureScreenshot("Vi Menu Home");
        reportProgress("SCREENSHOT_2", "Vi Menu home captured", 80);
    }
    
    private void selectViMenu() {
        try {
            if (viElements != null && !viElements.isEmpty()) {
                for (WebElement element : viElements) {
                    if (element.isDisplayed()) {
                        clickWithoutScreenshot(element);
                        return;
                    }
                }
            }
            if (vodafoneElement != null && vodafoneElement.isDisplayed()) {
                clickWithoutScreenshot(vodafoneElement);
            }
        } catch (Exception e) {
            System.out.println("    ⚠ Could not select Vi menu: " + e.getMessage());
        }
    }
    
    public void navigateToFlashOption() {
        System.out.println("┌─ Step 3: Flash Option");
        reportProgress("FLASH_OPTION", "Navigating to Flash option", 45);
        
        try {
            if (isDisplayed(flashOption)) {
                reportProgress("FLASH_FOUND", "Flash option found", 50);
                click(flashOption, "Flash Option");
                deviceUtils.navigateBack();
                System.out.println("└─ ✅ Flash option captured\n");
                reportProgress("FLASH_COMPLETED", "Flash option tested successfully", 55);
            } else {
                captureScreenshot("Flash Option Not Found");
                System.out.println("└─ ⚠ Flash option not found\n");
                reportProgress("FLASH_NOT_FOUND", "Flash option not found", 55);
            }
        } catch (Exception e) {
            System.err.println("└─ ❌ Error: " + e.getMessage());
            reportProgress("FLASH_ERROR", "Error: " + e.getMessage(), 0);
        }
    }
    
    public void navigateToRoamingOption() {
        System.out.println("┌─ Step 4: Roaming Option");
        reportProgress("ROAMING_OPTION", "Navigating to Roaming option", 60);
        
        try {
            if (isDisplayed(roamingOption)) {
                reportProgress("ROAMING_FOUND", "Roaming option found", 65);
                click(roamingOption, "Roaming Menu");
                System.out.println("└─ ✅ Roaming menu captured\n");
                reportProgress("ROAMING_ENTERED", "Entered Roaming menu", 70);
            } else {
                System.out.println("└─ ⚠ Roaming option not found\n");
                reportProgress("ROAMING_NOT_FOUND", "Roaming option not found", 70);
            }
        } catch (Exception e) {
            System.err.println("└─ ❌ Error: " + e.getMessage());
            reportProgress("ROAMING_ERROR", "Error: " + e.getMessage(), 0);
        }
    }
    
    public void validateRoamingSubMenus() {
        System.out.println("┌─ Step 5-6: Roaming Sub-Menus");
        reportProgress("ROAMING_SUBMENUS", "Validating roaming sub-menus", 75);
        
        // Step 5: Click on Vi India
        checkAndClickViIndia();
        
        // Step 6: Navigate back to main menu, then re-enter Roaming to see International
        navigateBackToMainMenuAndReopenRoaming();
        
        // Now validate International
        validateInternational();
        
        System.out.println("└─ ✅ Sub-menus validated\n");
        reportProgress("SUB_MENUS_COMPLETED", "Roaming sub-menus validated", 85); 
    }

    /**
     * Navigate back to main SIM Toolkit menu and re-open Roaming
     * This ensures International option is visible
     */
    private void navigateBackToMainMenuAndReopenRoaming() {
        System.out.println("  → Navigating back to main menu to re-open Roaming");
        reportProgress("NAVIGATE_BACK", "Navigating back to main menu", 80);
        
        try {
            // First, check if we're still in the Roaming menu by looking for Flash and Roaming
            boolean hasFlash = isDisplayed(flashOption);
            boolean hasRoaming = isDisplayed(roamingOption);
            
            if (hasFlash && hasRoaming) {
                System.out.println("    ✅ Already on main menu with Flash and Roaming");
                // We're on the main menu, just click Roaming
                if (isDisplayed(roamingOption)) {
                    reportProgress("ROAMING_REOPEN", "Re-opening Roaming from main menu", 82);
                    click(roamingOption, "Roaming Menu Reopen");
                    System.out.println("    ✅ Roaming menu re-opened");
                    reportProgress("ROAMING_REOPENED", "Roaming menu re-opened", 84);
                }
            } else {
                // Try to go back using device back button
                System.out.println("    ⚠ Not on main menu, navigating back...");
                
                // Try multiple back navigation attempts
                for (int i = 0; i < 3; i++) {
                    try {
                        deviceUtils.navigateBack();
                        Thread.sleep(1000);
                        
                        // Check if we're back on main menu
                        if (isDisplayed(flashOption) && isDisplayed(roamingOption)) {
                            System.out.println("    ✅ Navigated back to main menu (attempt " + (i+1) + ")");
                            break;
                        }
                    } catch (Exception e) {
                        System.out.println("    ⚠ Back navigation attempt " + (i+1) + " failed: " + e.getMessage());
                    }
                }
                
                // Now try to click Roaming from main menu
                wait.until(ExpectedConditions.visibilityOf(roamingOption));
                if (isDisplayed(roamingOption)) {
                    reportProgress("ROAMING_REOPEN", "Re-opening Roaming from main menu", 82);
                    click(roamingOption, "Roaming Menu Reopen");
                    System.out.println("    ✅ Roaming menu re-opened");
                    reportProgress("ROAMING_REOPENED", "Roaming menu re-opened", 84);
                } else {
                    System.out.println("    ⚠ Could not find Roaming option on main menu");
                    reportProgress("ROAMING_NOT_FOUND_ON_MAIN", "Roaming not found on main menu", 84);
                }
            }
        } catch (Exception e) {
            System.err.println("    ✗ Error navigating back: " + e.getMessage());
            reportProgress("NAVIGATE_BACK_ERROR", "Error: " + e.getMessage(), 0);
        }
    }

    private void checkAndClickViIndia() {
        System.out.println("  → Vi India Option");
        reportProgress("VI_INDIA", "Checking Vi India option", 76);
        
        try {
            WebElement viIndia = null;
            
            // Try multiple locator strategies
            try {
                viIndia = driver.findElement(org.openqa.selenium.By.xpath(
                    "//*[@text='Vi India']"));
            } catch (Exception e) {
                try {
                    viIndia = driver.findElement(org.openqa.selenium.By.xpath(
                        "//*[contains(@text, 'Vi India')]"));
                } catch (Exception e2) {
                    try {
                        viIndia = driver.findElement(org.openqa.selenium.By.xpath(
                            "//*[contains(@text, 'Vodafone IN')]"));
                    } catch (Exception e3) {
                        // Not found
                    }
                }
            }
            
            if (viIndia != null && viIndia.isDisplayed()) {
                reportProgress("VI_INDIA_FOUND", "Vi India option found", 78);
                click(viIndia, "Vi India");
                handlePopup("vi_india", true);
                reportProgress("VI_INDIA_TESTED", "Vi India option tested", 80);
                System.out.println("    ✅ Vi India found and tested");
            } else {
                System.out.println("    ⚠ Vi India not found");
                reportProgress("VI_INDIA_SKIPPED", "Vi India option not available", 80);
                captureScreenshot("Vi India Not Found");
            }
        } catch (Exception e) {
            System.err.println("    ✗ Error checking Vi India: " + e.getMessage());
            reportProgress("VI_INDIA_ERROR", "Error: " + e.getMessage(), 0);
        }
    }

    private void validateInternational() {
        System.out.println("  → International Option");
        reportProgress("INTERNATIONAL", "Validating International option", 83);
        
        try {
            // Wait for the page to load after re-opening Roaming
            Thread.sleep(2000);
            
            // Try multiple ways to find International
            WebElement international = null;
            
            // Strategy 1: Exact text match
            try {
                international = driver.findElement(org.openqa.selenium.By.xpath(
                    "//*[@text='International' or @text='International*']"));
            } catch (Exception e) {
                // Strategy 2: Contains text
                try {
                    international = driver.findElement(org.openqa.selenium.By.xpath(
                        "//*[contains(@text, 'International')]"));
                } catch (Exception e2) {
                    // Strategy 3: Check page source
                }
            }
            
            // Check page source for International
            String pageSource = driver.getPageSource();
            boolean hasInternational = pageSource != null && 
                (pageSource.toLowerCase().contains("international") || 
                 pageSource.toLowerCase().contains("international*"));
            
            if (international != null && international.isDisplayed()) {
                reportProgress("INTERNATIONAL_FOUND", "International option found", 84);
                click(international, "International");
                handlePopup("international", true);
                reportProgress("INTERNATIONAL_TESTED", "International option tested", 86);
                System.out.println("    ✅ International found and tested");
            } else if (hasInternational) {
                // Try to find any element containing International
                try {
                    List<WebElement> internationalElements = driver.findElements(
                        org.openqa.selenium.By.xpath("//*[contains(@text, 'International')]"));
                    if (!internationalElements.isEmpty() && internationalElements.get(0).isDisplayed()) {
                        reportProgress("INTERNATIONAL_FOUND", "International option found", 84);
                        click(internationalElements.get(0), "International");
                        handlePopup("international", true);
                        reportProgress("INTERNATIONAL_TESTED", "International option tested", 86);
                        System.out.println("    ✅ International found and tested");
                    } else {
                        System.out.println("    ⚠ International not found on Roaming menu");
                        reportProgress("INTERNATIONAL_NOT_FOUND", "International option not found", 86);
                        captureScreenshot("International Not Found");
                    }
                } catch (Exception e) {
                    System.out.println("    ⚠ International not clickable");
                    reportProgress("INTERNATIONAL_NOT_CLICKABLE", "International not clickable", 86);
                    captureScreenshot("International Not Clickable");
                }
            } else {
                System.out.println("    ⚠ International not found on Roaming menu");
                reportProgress("INTERNATIONAL_NOT_FOUND", "International option not found", 86);
                captureScreenshot("International Not Found");
            }
        } catch (Exception e) {
            System.err.println("    ✗ Error validating International: " + e.getMessage());
            reportProgress("INTERNATIONAL_ERROR", "Error: " + e.getMessage(), 0);
            captureScreenshot("International Error");
        }
    }
    
    private void handlePopup(String popupName, boolean clickOK) {
        try {
            Thread.sleep(2000);
            
            if (clickOK && isDisplayed(okButton)) {
                clickWithoutScreenshot(okButton);
                Thread.sleep(1500);
                System.out.println("    ✓ Clicked OK");
            } else if (!clickOK && isDisplayed(cancelButton)) {
                clickWithoutScreenshot(cancelButton);
                System.out.println("    ✓ Clicked Cancel");
            }
            
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        } catch (Exception e) {
            System.err.println("    ✗ Popup handling error: " + e.getMessage());
        }
    }
    
    public boolean verifyViBranding() {
        try {
            reportProgress("BRANDING_CHECK", "Verifying Vi branding", 90);
            
            String pageSource = driver.getPageSource();
            if (pageSource != null) {
                String lowerPageSource = pageSource.toLowerCase();
                if (lowerPageSource.contains("vi") || lowerPageSource.contains("vodafone")) {
                    System.out.println("✅ Vi branding verified in page source");
                    reportProgress("BRANDING_VERIFIED", "Vi branding verified", 95);
                    return true;
                }
            }
            
            if (viElements != null && !viElements.isEmpty()) {
                for (WebElement viElement : viElements) {
                    if (isDisplayed(viElement)) {
                        String text = getText(viElement);
                        if (text != null && (text.toLowerCase().contains("vi") || text.toLowerCase().contains("vodafone"))) {
                            System.out.println("✅ Vi branding verified: " + text);
                            reportProgress("BRANDING_VERIFIED", "Vi branding verified: " + text, 95);
                            return true;
                        }
                    }
                }
            }
            
            if (vodafoneElement != null && isDisplayed(vodafoneElement)) {
                String text = getText(vodafoneElement);
                if (text != null) {
                    System.out.println("✅ Vi branding verified: " + text);
                    reportProgress("BRANDING_VERIFIED", "Vi branding verified: " + text, 95);
                    return true;
                }
            }
            
            reportProgress("BRANDING_NOT_FOUND", "Vi branding not found", 95);
            return false;
            
        } catch (Exception e) {
            reportProgress("BRANDING_ERROR", "Error verifying branding: " + e.getMessage(), 0);
            return false;
        }
    }
    
    public void completeSIMToolkitTest() {
        System.out.println("┌─ SIM Toolkit Test Complete");
        reportProgress("TEST_COMPLETE", "SIM Toolkit test completed successfully", 100);
        System.out.println("└─ ✅ All SIM Toolkit steps completed\n");
    }
    
    // Helper methods
    protected void click(WebElement element, String screenshotName) {
        try {
            wait.until(ExpectedConditions.elementToBeClickable(element));
            element.click();
            System.out.println("  ✓ Clicked element");
            
            Thread.sleep(1500);
            
            if (screenshotName != null && !screenshotName.isEmpty()) {
                screenshotUtils.captureScreenshot(screenshotName);
            }
            
        } catch (Exception e) {
            System.err.println("  ✗ Error clicking element: " + e.getMessage());
            throw new RuntimeException("Failed to click element", e);
        }
    }
    
    protected void clickWithoutScreenshot(WebElement element) {
        try {
            wait.until(ExpectedConditions.elementToBeClickable(element));
            element.click();
            Thread.sleep(1000);
        } catch (Exception e) {
            System.err.println("Error clicking element: " + e.getMessage());
        }
    }
    
    protected boolean isDisplayed(WebElement element) {
        try {
            return element != null && element.isDisplayed();
        } catch (Exception e) {
            return false;
        }
    }
    
    protected String getText(WebElement element) {
        try {
            wait.until(ExpectedConditions.visibilityOf(element));
            return element.getText();
        } catch (Exception e) {
            return null;
        }
    }
    
    public void captureScreenshot(String stepName) {
        if (stepName != null && !stepName.trim().isEmpty()) {
            screenshotUtils.captureScreenshot(stepName);
        }
    }
    
    private void reportProgress(String action, String status, double percentage) {
        if (deviceId != null) {
            try {
                ProgressReporter.reportCallingProgress(
                    deviceId,
                    "SIM_Toolkit",
                    action,
                    status,
                    0,
                    percentage
                );
            } catch (Exception e) {
                System.err.println("SIM Toolkit progress report failed: " + e.getMessage());
            }
        }
    }
}