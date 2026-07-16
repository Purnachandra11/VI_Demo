package com.telecom.utils;

public class NetworkManager {
    
    /**
     * ✅ DYNAMIC NETWORK TYPE HANDLING
     */
    public static boolean setNetworkType(String deviceId, String targetNetworkType) {
        System.out.println("🔡 Changing network type to: " + targetNetworkType);
        
        try {
            String currentNetwork = getCurrentNetworkType(deviceId);
            System.out.println("   Current Network: " + currentNetwork);
            
            // Step 1: Check if 5G to 4G downgrade
            if (currentNetwork.equals("5G") && targetNetworkType.equals("4G")) {
                System.out.println("   ⚠️ Downgrading from 5G to 4G - Deactivating 5G radio...");
                deactivate5GRadio(deviceId);
                Thread.sleep(3000);
            }
            
            // Step 2: Check 3G availability
            if (targetNetworkType.equals("3G")) {
                System.out.println("   🔍 Checking 3G availability...");
                boolean is3GAvailable = check3GAvailability(deviceId);
                
                if (!is3GAvailable) {
                    System.out.println("   ❌ 3G signal not available - Test will be skipped");
                    return false;
                }
                System.out.println("   ✅ 3G signal available - Proceeding with network change");
            }
            
            // Step 3: Set network type using SIMAutoLatchMonitor
            SIMAutoLatchMonitor monitor = new SIMAutoLatchMonitor(deviceId);
            boolean success = monitor.setPreferredNetworkType(targetNetworkType);
            
            Thread.sleep(5000);
            
            // Step 4: Verify network change
            String newNetwork = getCurrentNetworkType(deviceId);
            boolean verified = verifyNetworkSwitch(targetNetworkType, newNetwork);
            
            if (verified) {
                System.out.println("   ✅ Network type changed successfully to: " + newNetwork);
            } else {
                System.out.println("   ⚠️ Network change initiated, current network: " + newNetwork);
            }
            
            return success;
            
        } catch (Exception e) {
            System.out.println("   ❌ Network type change error: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Deactivate 5G radio when downgrading
     */
    private static void deactivate5GRadio(String deviceId) {
        try {
            String disableNR = "adb -s " + deviceId + " shell setprop persist.vendor.radio.5g_mode_pref 0";
            ADBHelper.executeCommand(disableNR);
            
            String forceLTE = "adb -s " + deviceId + " shell settings put global preferred_network_mode 11";
            ADBHelper.executeCommand(forceLTE);
            
            System.out.println("   ✅ 5G radio deactivated");
        } catch (Exception e) {
            System.out.println("   ⚠️ 5G deactivation warning: " + e.getMessage());
        }
    }
    
    /**
     * Check if 3G signal is available
     */
    private static boolean check3GAvailability(String deviceId) {
        try {
            // Check current network type
            String currentNetwork = getCurrentNetworkType(deviceId);
            
            // If already on 3G, it's available
            if (currentNetwork.equals("3G")) {
                return true;
            }
            
            // Try to switch to 3G
            SIMAutoLatchMonitor monitor = new SIMAutoLatchMonitor(deviceId);
            monitor.setPreferredNetworkType("3G");
            
            Thread.sleep(5000);
            
            // Check if we're on 3G now
            String newNetwork = getCurrentNetworkType(deviceId);
            return newNetwork.equals("3G");
            
        } catch (Exception e) {
            System.out.println("   ⚠️ 3G availability check failed: " + e.getMessage());
            return false;
        }
    }
    
    /**
     * Get current network type - FIXED
     */
    public static String getCurrentNetworkType(String deviceId) {
        try {
            // Method 1: Check radio technology
            String radioTech = ADBHelper.executeCommand(
                "adb -s " + deviceId + " shell getprop gsm.network.type"
            ).trim();
            
            // Method 2: Check telephony registry
            String telephonyInfo = ADBHelper.executeCommand(
                "adb -s " + deviceId + " shell dumpsys telephony.registry"
            );
            
            // Determine network type
            if (radioTech.contains("NR") || telephonyInfo.contains("NR_NSA") || 
                telephonyInfo.contains("NR_SA") || telephonyInfo.contains("5G")) {
                return "5G";
            } else if (radioTech.contains("LTE") || telephonyInfo.contains("LTE")) {
                return "4G";
            } else if (radioTech.contains("HSPA") || radioTech.contains("UMTS") || 
                      radioTech.contains("WCDMA") || telephonyInfo.contains("WCDMA")) {
                return "3G";
            } else if (radioTech.contains("EDGE") || radioTech.contains("GPRS") || 
                      radioTech.contains("GSM") || telephonyInfo.contains("GSM")) {
                return "2G";
            }
            
            return "UNKNOWN";
            
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }
    
    /**
     * Get network mode value for ADB command
     */
    private static int getNetworkModeValue(String networkType) {
        switch (networkType.toUpperCase()) {
            case "5G": return 33;      // NR/LTE/WCDMA/GSM auto
            case "AUTO": return 33;    // NR/LTE/WCDMA/GSM auto
            case "4G":
            case "LTE": return 11;     // LTE only
            case "3G":
            case "WCDMA": return 3;    // WCDMA preferred
            case "2G":
            case "GSM": return 1;      // GSM only
            default: return 33;
        }
    }
    
    /**
     * Verify network switch was successful
     */
    private static boolean verifyNetworkSwitch(String target, String current) {
        if (target.equals("AUTO") || target.equals("5G")) {
            return current.equals("5G") || current.equals("4G");
        }
        return target.equals(current);
    }
    
    /**
     * Get highest available network for data usage
     */
    public static String getHighestAvailableNetwork(String deviceId) {
        System.out.println("🔍 Detecting highest available network for data usage...");
        
        try {
            if (check5GAvailability(deviceId)) {
                System.out.println("   ✅ 5G available - Using 5G for data usage");
                return "5G";
            }
            
            if (check4GAvailability(deviceId)) {
                System.out.println("   ✅ 4G available - Using 4G for data usage");
                return "4G";
            }
            
            System.out.println("   ⚠️ Using 3G for data usage (5G/4G not available)");
            return "3G";
            
        } catch (Exception e) {
            System.out.println("   ❌ Network detection error: " + e.getMessage());
            return "4G";
        }
    }
    
    private static boolean check5GAvailability(String deviceId) {
        try {
            String networkInfo = ADBHelper.executeCommand(
                "adb -s " + deviceId + " shell dumpsys telephony.registry"
            );
            return networkInfo.contains("NR") || networkInfo.contains("5G");
        } catch (Exception e) {
            return false;
        }
    }
    
    private static boolean check4GAvailability(String deviceId) {
        try {
            String networkInfo = ADBHelper.executeCommand(
                "adb -s " + deviceId + " shell getprop gsm.network.type"
            );
            return networkInfo.contains("LTE") || networkInfo.contains("4G");
        } catch (Exception e) {
            return false;
        }
    }
}