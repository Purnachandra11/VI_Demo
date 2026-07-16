# Vi SIM Toolkit — WebdriverIO + Appium (TypeScript)

TypeScript port of the original Java/Appium native Android automation framework.
This uses **WebdriverIO + Appium** (not Playwright) because the code drives the
native `com.android.stk` system app — Playwright has no native mobile app
automation capability, so it cannot run this framework. See project chat notes
for the full explanation.

## What changed vs. the Java version

- Language: Java → TypeScript, `AppiumDriver`/`PageFactory` → WebdriverIO's
  `$` / `$$` selector API and `driver` global.
- HTTP calls: Apache HttpClient → `axios`.
- Screenshot I/O: Apache `commons-io` → Node's `fs`.
- **Bug fix carried over**: SIM-type detection (`DeviceUtils.detectSIMType`)
  previously matched Vi branding with a raw `.contains("vi")` substring check,
  which false-positived on words like "Device" or "Activity" and could
  misclassify single vs. dual vs. dual-Vi devices. This port matches whole
  brand tokens from `SIMToolkitConfig.VI_BRANDING_TEXTS` instead, only counts
  `clickable='true'` elements as SIM options, and waits for elements to
  appear instead of a blind `sleep(3000)`.
- `handleDualSIMVi()` now clicks the first *Vi-branded* element instead of
  blindly clicking `simMenuOptions[0]`, matching the same logic as
  `selectViMenu()`.

## Project layout

```
src/
  config/SIMToolkitConfig.ts     - constants, SIMType enum
  utils/DeviceUtils.ts            - SIM Toolkit launch + SIM-type detection
  utils/ScreenshotUtils.ts        - screenshot capture + HTML report generation
  utils/ProgressReporter.ts       - WebSocket-style progress reporting via axios
  utils/ADBLauncher.ts            - ADB shell launch helpers (reconstructed;
                                     adjust monkey/activity args if your original
                                     ADBLauncher.java differs)
  pageobjects/SIMToolkitPage.ts   - main page object / flow orchestration
test/specs/simToolkit.spec.ts     - example Mocha spec wiring it all together
wdio.conf.ts                      - WebdriverIO + Appium service config
```

## Setup

Requires: Node.js 18+, Java JDK (for Appium/UiAutomator2), Android SDK
platform-tools on your `PATH` (for `adb`), and a connected/emulated Android
device.

```bash
npm install
```

## Running

```bash
# against the first attached device
npm test

# against a specific device
DEVICE_ID=emulator-5554 npm test
```

`wdio.conf.ts` starts the Appium server for you via `@wdio/appium-service`,
so you don't need to run `appium` manually. Set `appium:udid` (via
`DEVICE_ID`) if you have multiple devices attached.

## Notes / things to verify against your environment

1. **`ADBLauncher.ts`** was reconstructed from how it's *called* in the
   original `DeviceUtils.java` (I never saw the original `ADBLauncher.java`).
   Confirm the `monkey`/`am start` arguments match your real implementation.
2. **`launchApp`** uses `mobile: startActivity` (the modern UiAutomator2
   equivalent of Appium Java client's `startActivity(...)`) — this requires
   `automationName: 'UiAutomator2'`, already set in `wdio.conf.ts`.
3. Adjust `SELECTORS` in `SIMToolkitPage.ts` if your real device's Vi/SIM
   label text differs from the assumed patterns (e.g. "Vi (SIM1)" vs. bare
   "Vi") — this directly affects detection accuracy.
