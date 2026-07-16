package com.telecom.core;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.telecom.utils.ADBHelper;
import com.telecom.utils.AutoLatchResult;
import com.telecom.utils.EnhancedExcelReader;
import com.telecom.utils.NetworkRAT;
import com.telecom.utils.NetworkTransition;
import com.telecom.utils.ReportGenerator;
import com.telecom.utils.SIMAutoLatchMonitor;

/**
 * COMPLETE WORKING SIM AUTO-LATCH TEST EXECUTOR
 */
public class SIMAutoLatchTestExecutor {

    private String aPartyDeviceId;
    private String bPartyDeviceId;
    private String aPartyNumber;
    private String bPartyNumber;
    private List<Map<String, Object>> testResults = new ArrayList<>();

    public SIMAutoLatchTestExecutor(String aPartyDeviceId, String bPartyDeviceId,
                                   String aPartyNumber, String bPartyNumber) {
        this.aPartyDeviceId = aPartyDeviceId;
        this.bPartyDeviceId = bPartyDeviceId;
        this.aPartyNumber = aPartyNumber;
        this.bPartyNumber = bPartyNumber;

        System.out.println("\n" + "=".repeat(100));
        System.out.println("📡 SIM AUTO-LATCH TEST EXECUTOR INITIALIZED");
        System.out.println("=".repeat(100));
        System.out.println("A-Party Device: " + aPartyDeviceId + " | Number: " + aPartyNumber);
        System.out.println("B-Party Device: " + bPartyDeviceId + " | Number: " + bPartyNumber);
        System.out.println("=".repeat(100) + "\n");
    }

    /**
     * ✅ MAIN EXECUTION METHOD
     */
    public List<Map<String, Object>> executeAllSIMAutoLatchTests(String excelFilePath) {
        testResults.clear();

        try {
            // Read test data from Excel
            List<Map<String, Object>> testCases = EnhancedExcelReader.readSIMAutoLatchTestData(excelFilePath);

            if (testCases.isEmpty()) {
                System.out.println("⚠️ No SIM auto-latch test data found");
                return testResults;
            }

            System.out.println("\n" + "=".repeat(100));
            System.out.println("🚀 STARTING SIM AUTO-LATCH TEST EXECUTION");
            System.out.println("📊 Total Tests: " + testCases.size());
            System.out.println("=".repeat(100) + "\n");

            // Group tests by device based on phone number
            List<Map<String, Object>> aPartyTests = new ArrayList<>();
            List<Map<String, Object>> bPartyTests = new ArrayList<>();

            for (Map<String, Object> testCase : testCases) {
                String partyNumber = (String) testCase.get("partyNumber");

                if (aPartyNumber != null && aPartyNumber.equals(partyNumber)) {
                    aPartyTests.add(testCase);
                } else if (bPartyNumber != null && bPartyNumber.equals(partyNumber)) {
                    bPartyTests.add(testCase);
                } else {
                    System.out.println("⚠️ Party number " + partyNumber + " doesn't match. Using A-Party device.");
                    aPartyTests.add(testCase);
                }
            }

            // Execute A-Party tests
            if (!aPartyTests.isEmpty()) {
                System.out.println("\n" + "📱".repeat(50));
                System.out.println("📱 EXECUTING A-PARTY TESTS (" + aPartyTests.size() + " tests)");
                System.out.println("📱".repeat(50) + "\n");

                for (int i = 0; i < aPartyTests.size(); i++) {
                    Map<String, Object> testCase = aPartyTests.get(i);
                    System.out.println("\n📱 A-PARTY TEST " + (i + 1) + "/" + aPartyTests.size() +
                                     ": " + testCase.get("name"));

                    Map<String, Object> result = executeSingleAutoLatchTest(
                        testCase, aPartyDeviceId, "A-PARTY", aPartyNumber
                    );
                    testResults.add(result);

                    Thread.sleep(5000);
                }
            }

            // Execute B-Party tests
            if (!bPartyTests.isEmpty() && bPartyDeviceId != null) {
                System.out.println("\n" + "📱".repeat(50));
                System.out.println("📱 EXECUTING B-PARTY TESTS (" + bPartyTests.size() + " tests)");
                System.out.println("📱".repeat(50) + "\n");

                for (int i = 0; i < bPartyTests.size(); i++) {
                    Map<String, Object> testCase = bPartyTests.get(i);
                    System.out.println("\n📱 B-PARTY TEST " + (i + 1) + "/" + bPartyTests.size() +
                                     ": " + testCase.get("name"));

                    Map<String, Object> result = executeSingleAutoLatchTest(
                        testCase, bPartyDeviceId, "B-PARTY", bPartyNumber
                    );
                    testResults.add(result);

                    Thread.sleep(5000);
                }
            }

            // Generate reports
            generateReports();
            printSummary();

        } catch (Exception e) {
            System.out.println("❌ SIM auto-latch test execution failed: " + e.getMessage());
            e.printStackTrace();
        }

        return testResults;
    }

    /**
     * ✅ EXECUTE SINGLE AUTO-LATCH TEST WITH PROPER ERROR HANDLING
     */
    private Map<String, Object> executeSingleAutoLatchTest(
            Map<String, Object> testCase,
            String deviceId,
            String deviceType,
            String partyNumber) {

        Map<String, Object> result = new HashMap<>();
        String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss").format(new Date());

        // preferredNetwork drives BOTH the network-mode ADB commands AND the
        // RAT verification inside SIMAutoLatchMonitor. Default to AUTO if
        // the Excel cell is missing/blank.
        String preferredNetwork = (String) testCase.get("preferredNetwork");
        if (preferredNetwork == null || preferredNetwork.trim().isEmpty()) {
            preferredNetwork = "AUTO";
        }

        try {
            // Initialize result with test case info
            result.putAll(testCase);
            result.put("testTimestamp", timestamp);
            result.put("deviceId", deviceId);
            result.put("deviceType", deviceType);
            result.put("partyNumber", partyNumber);
            result.put("targetNetwork", preferredNetwork);

            int timeoutSeconds = getIntValue(testCase.get("timeoutSeconds"));
            int maxAttempts = getIntValue(testCase.get("attempts"));

            // Verify device is available
            if (!isDeviceAvailable(deviceId)) {
                throw new Exception("Device not available: " + deviceId);
            }

            // Set network type if specified
            if (!"AUTO".equalsIgnoreCase(preferredNetwork)) {
                System.out.println("📡 Setting network to: " + NetworkRAT.describe(preferredNetwork));
                boolean networkSet = setNetworkType(deviceId, preferredNetwork);
                if (!networkSet) {
                    System.out.println("⚠️ Warning: Failed to set network type");
                }
                Thread.sleep(5000);
            }

            // Execute test with multiple attempts
            List<AutoLatchResult> attemptResults = new ArrayList<>();

            for (int attempt = 1; attempt <= maxAttempts; attempt++) {
                System.out.println("\n🔄 Attempt " + attempt + "/" + maxAttempts);

                try {
                    // ✅ Pass preferredNetwork so the monitor verifies the
                    // ACHIEVED RAT against what was actually requested.
                    SIMAutoLatchMonitor monitor = new SIMAutoLatchMonitor(deviceId, timeoutSeconds, preferredNetwork);
                    AutoLatchResult latchResult = monitor.executeAutoLatchTest();

                    if (latchResult != null) {
                        attemptResults.add(latchResult);

                        if (latchResult.isSuccess()) {
                            System.out.println("✅ Attempt " + attempt + " succeeded: " +
                                             latchResult.getAutoLatchTimeMs() + " ms");

                            if (latchResult.getAutoLatchTimeMs() <= 30000) {
                                System.out.println("✅ Fast latch achieved - stopping attempts");
                                break;
                            }
                        } else {
                            System.out.println("❌ Attempt " + attempt + " failed: " +
                                             safeGetString(latchResult.getErrorMessage(), "Unknown error"));

                            // No point burning remaining attempts re-testing a
                            // RAT that's simply not available at this location -
                            // that won't change between attempts.
                            if (!latchResult.isTargetRatAchieved() &&
                                latchResult.getErrorMessage() != null &&
                                latchResult.getErrorMessage().contains("not available in your current location")) {
                                System.out.println("⏭️ Skipping remaining attempts - RAT unavailable at this location");
                                break;
                            }
                        }
                    } else {
                        System.out.println("⚠️ Attempt " + attempt + " returned null result");
                        AutoLatchResult failedResult = createFailedResult("Null result returned", preferredNetwork);
                        attemptResults.add(failedResult);
                    }

                } catch (Exception attemptEx) {
                    System.out.println("❌ Attempt " + attempt + " exception: " + attemptEx.getMessage());
                    AutoLatchResult failedResult = createFailedResult("Exception: " + attemptEx.getMessage(), preferredNetwork);
                    attemptResults.add(failedResult);
                }

                if (attempt < maxAttempts) {
                    System.out.println("⏳ Waiting 5s before next attempt...");
                    Thread.sleep(5000);
                }
            }

            // Determine best result
            AutoLatchResult bestResult = determineBestResult(attemptResults);

            if (bestResult == null) {
                throw new Exception("No valid results from any attempts");
            }

            // Store all result fields
            result.put("success", bestResult.isSuccess());
            result.put("testResult", determineOverallResult(bestResult));
            result.put("autoLatchTimeMs", bestResult.getAutoLatchTimeMs());
            result.put("autoLatchTimeSeconds", bestResult.getAutoLatchTimeSeconds());
            result.put("initialNetworkState", safeGetString(bestResult.getInitialNetworkState(), "UNKNOWN"));
            result.put("initialRAT", safeGetString(bestResult.getInitialRAT(), "UNKNOWN"));
            result.put("initialIMSRegistered", bestResult.isInitialIMSRegistered());
            result.put("finalNetworkState", safeGetString(bestResult.getFinalNetworkState(), "UNKNOWN"));
            result.put("finalRAT", safeGetString(bestResult.getFinalRAT(), "UNKNOWN"));
            result.put("finalIMSRegistered", bestResult.isFinalIMSRegistered());
            result.put("targetRatAchieved", bestResult.isTargetRatAchieved());
            result.put("errorMessage", safeGetString(bestResult.getErrorMessage(), ""));
            result.put("totalAttempts", maxAttempts);
            result.put("successfulAttempts", countSuccessfulAttempts(attemptResults));

            // Store transitions
            String transitions = buildTransitionsString(bestResult);
            result.put("transitions", transitions);

            // Build detailed comments
            result.put("comments", buildAutoLatchComments(result, preferredNetwork));

            // Print final result
            String emoji = bestResult.isSuccess() ? "✅" : "❌";
            String testResult = determineOverallResult(bestResult);
            System.out.println("\n" + emoji + " Final Result: " + testResult);
            if (bestResult.isSuccess()) {
                System.out.println("   ⏱️ Best Auto-latch time: " + bestResult.getAutoLatchTimeMs() + " ms");
                System.out.println("   📡 Final RAT: " + bestResult.getFinalRAT());
                System.out.println("   📞 IMS: " + (bestResult.isFinalIMSRegistered() ? "✅ Registered" : "❌ Not Registered"));
            } else {
                System.out.println("   ❌ " + bestResult.getErrorMessage());
            }

        } catch (Exception e) {
            System.out.println("❌ Test failed: " + e.getMessage());
            e.printStackTrace();

            result.put("success", false);
            result.put("testResult", "ERROR");
            result.put("errorMessage", e.getMessage());
            result.put("autoLatchTimeMs", 0L);
            result.put("autoLatchTimeSeconds", 0.0);
            result.put("initialNetworkState", "UNKNOWN");
            result.put("initialRAT", "UNKNOWN");
            result.put("initialIMSRegistered", false);
            result.put("finalNetworkState", "UNKNOWN");
            result.put("finalRAT", "UNKNOWN");
            result.put("finalIMSRegistered", false);
            result.put("targetRatAchieved", false);
            result.put("totalAttempts", getIntValue(testCase.get("attempts")));
            result.put("successfulAttempts", 0);
            result.put("transitions", "Test failed - no transitions");
            result.put("comments", "Error: " + e.getMessage());
        }

        return result;
    }

    /**
     * ✅ CREATE FAILED RESULT OBJECT
     */
    private AutoLatchResult createFailedResult(String errorMessage, String targetNetworkType) {
        AutoLatchResult result = new AutoLatchResult();
        result.setSuccess(false);
        result.setTestResult("ERROR");
        result.setTargetNetworkType(targetNetworkType);
        result.setTargetRatAchieved(false);
        result.setErrorMessage(errorMessage);
        result.setAutoLatchTimeMs(0L);
        result.setAutoLatchTimeSeconds(0.0);
        result.setInitialNetworkState("UNKNOWN");
        result.setInitialRAT("UNKNOWN");
        result.setInitialIMSRegistered(false);
        result.setFinalNetworkState("UNKNOWN");
        result.setFinalRAT("UNKNOWN");
        result.setFinalIMSRegistered(false);
        return result;
    }

    /**
     * ✅ BUILD TRANSITIONS STRING
     */
    private String buildTransitionsString(AutoLatchResult result) {
        try {
            if (result.getRegistrationEvent() != null &&
                result.getRegistrationEvent().getTransitions() != null) {

                List<String> transitions = new ArrayList<>();
                for (NetworkTransition trans : result.getRegistrationEvent().getTransitions()) {
                    transitions.add(trans.getTimestamp() + "s: " +
                                  trans.getFromState() + " → " + trans.getToState() +
                                  " (" + trans.getToRAT() + ")");
                }

                if (!transitions.isEmpty()) {
                    return String.join(" → ", transitions);
                }
            }
        } catch (Exception e) {
            System.out.println("⚠️ Error building transitions: " + e.getMessage());
        }

        return "No transitions recorded";
    }

    /**
     * ✅ SAFE STRING GETTER
     */
    private String safeGetString(String value, String defaultValue) {
        return (value != null && !value.isEmpty()) ? value : defaultValue;
    }

    /**
     * ✅ CHECK DEVICE AVAILABILITY
     */
    private boolean isDeviceAvailable(String deviceId) {
        try {
            List<String> devices = ADBHelper.getConnectedDevices();
            return devices.contains(deviceId);
        } catch (Exception e) {
            System.out.println("⚠️ Device availability check failed: " + e.getMessage());
            return false;
        }
    }

    /**
     * ✅ DETERMINE BEST RESULT FROM ATTEMPTS
     * Prefers the fastest attempt that actually achieved the target RAT.
     * If none did, falls back to the last attempt so the "RAT not available"
     * message/finalRAT still gets reported instead of being silently dropped.
     */
    private AutoLatchResult determineBestResult(List<AutoLatchResult> results) {
        if (results == null || results.isEmpty()) {
            return createFailedResult("No results available", "AUTO");
        }

        AutoLatchResult fastest = null;
        for (AutoLatchResult result : results) {
            if (result != null && result.isSuccess()) {
                if (fastest == null || result.getAutoLatchTimeMs() < fastest.getAutoLatchTimeMs()) {
                    fastest = result;
                }
            }
        }

        if (fastest == null) {
            for (int i = results.size() - 1; i >= 0; i--) {
                if (results.get(i) != null) {
                    return results.get(i);
                }
            }
            return createFailedResult("All attempts failed", "AUTO");
        }

        return fastest;
    }

    /**
     * ✅ DETERMINE OVERALL TEST RESULT
     * The monitor already classifies PASS/MARGINAL/SLOW/FAIL with RAT
     * verification baked in, so trust it directly rather than recomputing
     * from time alone (which is what caused wrong-RAT results to show PASS).
     */
    private String determineOverallResult(AutoLatchResult result) {
        if (result == null) {
            return "FAIL";
        }
        if (result.getTestResult() != null && !result.getTestResult().isEmpty()) {
            return result.getTestResult();
        }
        if (!result.isSuccess()) {
            return "FAIL";
        }
        long timeMs = result.getAutoLatchTimeMs();
        if (timeMs <= 30000) return "PASS";
        if (timeMs <= 60000) return "MARGINAL";
        return "SLOW";
    }

    /**
     * ✅ COUNT SUCCESSFUL ATTEMPTS
     */
    private int countSuccessfulAttempts(List<AutoLatchResult> results) {
        int count = 0;
        for (AutoLatchResult result : results) {
            if (result != null && result.isSuccess()) {
                count++;
            }
        }
        return count;
    }

    /**
     * ✅ BUILD DETAILED COMMENTS
     * Produces messages like:
     *   "5G (NR) latched successfully | Time: 3868 ms | IMS: ❌"
     *   "3G (WCDMA) is not available in your current location and failed
     *    (device remained on LTE) | Successful: 0/1"
     */

	private String buildAutoLatchComments(Map<String, Object> result, String targetNetworkType) {
	    StringBuilder comments = new StringBuilder();
	
	    String testResult = (String) result.get("testResult");
	    boolean success = (Boolean) result.getOrDefault("success", false);
	    int successfulAttempts = (Integer) result.getOrDefault("successfulAttempts", 0);
	    int totalAttempts = (Integer) result.getOrDefault("totalAttempts", 1);
	    String friendly = NetworkRAT.describe(targetNetworkType);
	
	    // ✅ ADD FULL IMS STATUS TEXT (without emoji)
	    boolean initialIMS = (Boolean) result.getOrDefault("initialIMSRegistered", false);
	    boolean finalIMS = (Boolean) result.getOrDefault("finalIMSRegistered", false);
	    
	    String initialIMSDisplay = initialIMS ? 
	        "Registered (VoLTE/VoWiFi available)" : 
	        "Not Registered (Calls will fallback to 2G/3G)";
	    String finalIMSDisplay = finalIMS ? 
	        "Registered (VoLTE/VoWiFi available)" : 
	        "Not Registered (Calls will fallback to 2G/3G)";
	
	    if (success) {
	        long timeMs = (Long) result.getOrDefault("autoLatchTimeMs", 0L);
	        String finalRAT = (String) result.getOrDefault("finalRAT", "UNKNOWN");
	
	        comments.append(friendly).append(" latched successfully")
	                .append(" | Result: ").append(testResult)
	                .append(" | Time: ").append(timeMs).append(" ms")
	                .append(" | RAT: ").append(finalRAT)
	                .append(" | Initial IMS: ").append(initialIMSDisplay)
	                .append(" | Final IMS: ").append(finalIMSDisplay)
	                .append(" | Successful: ").append(successfulAttempts).append("/").append(totalAttempts);
	    } else {
	        String error = (String) result.getOrDefault("errorMessage", "Unknown error");
	        if (error != null && error.contains("not available in your current location")) {
	            comments.append(error);
	        } else {
	            comments.append(friendly).append(" failed to latch | Error: ").append(error);
	        }
	        comments.append(" | Initial IMS: ").append(initialIMSDisplay)
	                .append(" | Final IMS: ").append(finalIMSDisplay)
	                .append(" | Successful: ").append(successfulAttempts).append("/").append(totalAttempts);
	    }
	
	    return comments.toString();
	}

    /**
     * ✅ SET NETWORK TYPE ON DEVICE
     */
    private boolean setNetworkType(String deviceId, String networkType) {
        try {
            SIMAutoLatchMonitor monitor = new SIMAutoLatchMonitor(deviceId);
            boolean success = monitor.setPreferredNetworkType(networkType);
            if (success) {
                System.out.println("✅ Network type set to: " + networkType);
            } else {
                System.out.println("⚠️ Failed to set network type");
            }
            return success;
        } catch (Exception e) {
            System.out.println("❌ Error setting network type: " + e.getMessage());
            return false;
        }
    }

    /**
     * ✅ GENERATE EXCEL AND HTML REPORTS
     */
    private void generateReports() {
        try {
            System.out.println("\n" + "=".repeat(100));
            System.out.println("📊 GENERATING REPORTS");
            System.out.println("=".repeat(100));

            String excelReport = ReportGenerator.generateSIMAutoLatchExcelReport(testResults);
            String htmlReport = ReportGenerator.generateSIMAutoLatchHTMLReport(testResults);

            if (excelReport != null) {
                System.out.println("✅ Excel Report: " + excelReport);
            } else {
                System.out.println("⚠️ Excel report generation failed");
            }

            if (htmlReport != null) {
                System.out.println("✅ HTML Report: " + htmlReport);
            } else {
                System.out.println("⚠️ HTML report generation failed");
            }

            System.out.println("=".repeat(100));
        } catch (Exception e) {
            System.out.println("⚠️ Report generation failed: " + e.getMessage());
            e.printStackTrace();
        }
    }

    /**
     * ✅ PRINT COMPREHENSIVE SUMMARY
     */
    private void printSummary() {
        System.out.println("\n" + "=".repeat(100));
        System.out.println("📈 SIM AUTO-LATCH TEST SUMMARY");
        System.out.println("=".repeat(100));

        long totalTests = testResults.size();
        long passTests = testResults.stream()
            .filter(r -> "PASS".equals(r.get("testResult")))
            .count();
        long marginalTests = testResults.stream()
            .filter(r -> "MARGINAL".equals(r.get("testResult")))
            .count();
        long slowTests = testResults.stream()
            .filter(r -> "SLOW".equals(r.get("testResult")))
            .count();
        long failedTests = testResults.stream()
            .filter(r -> "FAIL".equals(r.get("testResult")) || "ERROR".equals(r.get("testResult")))
            .count();

        System.out.println("Total Tests: " + totalTests);
        System.out.println("✅ PASS (< 30s): " + passTests);
        System.out.println("⚠️ MARGINAL (30-60s): " + marginalTests);
        System.out.println("🐌 SLOW (> 60s): " + slowTests);
        System.out.println("❌ FAILED (RAT not available / error): " + failedTests);

        // Call out which RATs failed as unavailable, since that's now a
        // distinct, expected outcome rather than a framework bug.
        for (Map<String, Object> r : testResults) {
            if (("FAIL".equals(r.get("testResult"))) &&
                r.get("errorMessage") != null &&
                r.get("errorMessage").toString().contains("not available in your current location")) {
                System.out.println("   ⚠️ " + r.get("targetNetwork") + ": " + r.get("errorMessage"));
            }
        }

        List<Long> successfulTimes = new ArrayList<>();
        for (Map<String, Object> result : testResults) {
            if ((Boolean) result.getOrDefault("success", false)) {
                successfulTimes.add((Long) result.getOrDefault("autoLatchTimeMs", 0L));
            }
        }

        if (!successfulTimes.isEmpty()) {
            double avgTime = successfulTimes.stream()
                .mapToLong(Long::longValue)
                .average()
                .orElse(0.0);
            long minTime = successfulTimes.stream()
                .mapToLong(Long::longValue)
                .min()
                .orElse(0);
            long maxTime = successfulTimes.stream()
                .mapToLong(Long::longValue)
                .max()
                .orElse(0);

            System.out.println("\n⏱️ Timing Statistics (RAT-verified passes only):");
            System.out.println("   Average: " + String.format("%.2f", avgTime) + " ms");
            System.out.println("   Minimum: " + minTime + " ms");
            System.out.println("   Maximum: " + maxTime + " ms");
        }

        if (totalTests > 0) {
            double successRate = ((passTests + marginalTests) * 100.0) / totalTests;
            System.out.println("\n📊 Overall Success Rate: " + String.format("%.1f%%", successRate));
        }

        System.out.println("=".repeat(100) + "\n");
    }

    /**
     * ✅ HELPER METHOD: GET INT VALUE SAFELY
     */
    private int getIntValue(Object value) {
        if (value == null) return 0;
        try {
            if (value instanceof Number) return ((Number) value).intValue();
            return Integer.parseInt(value.toString());
        } catch (Exception e) {
            return 0;
        }
    }
}