# Telecom UAT Automation — WebdriverIO + TypeScript

## Stack (replaces Core Java + Appium Client)

| Replace (legacy) | Use (current) |
|------------------|---------------|
| JVM startup overhead | **Node.js** — same runtime as the dashboard |
| Verbose Java / Maven | **TypeScript** — concise, type-safe tests |
| Thread / TestNG complexity | **WDIO async parallel** — multi-device with minimal config |
| Maven / Gradle builds | **npm** scripts |
| java-client Appium | **WebdriverIO v9** — native Appium 2.x, auto-wait |

**Benefits:** async parallel execution, native Appium 2.x support, shared Node.js stack with the dashboard, built-in auto-wait, Gen AI failure analysis (rule-based + optional LLM).

---

## Quick start

```bash
# 1. Install (project root + dashboard)
npm run setup
cp .env.example .env
# Edit .env — APARTY_DEVICE, APPIUM_PORT, etc.

# 2. Start Appium
appium

# 3. Run tests
npm run test:smoke
npm run test:calling
npm run test:sms
npm run test:data
npm run test:all

# 4. Dashboard (orchestrates WDIO instead of Maven)
cd dashboard && npm start
```

---

## Project layout

```
config/           # wdio.android.conf.ts, hooks, dual-device
test/
  specs/          # calling, sms, data, smoke
  core/           # callExecutor, smsExecutor, dataExecutor
  pages/          # Page objects (POM)
  ai/             # FailureAnalyzer, TestSummarizer
  utils/          # ADB, Excel, progress → dashboard API
dashboard/        # Express UI + WebSocket (unchanged entry point)
src/main/java/    # Legacy Java tests (optional reference)
```

---

## Environment variables

Set in `.env` or via dashboard / `cross-env`:

| Variable | Purpose |
|----------|---------|
| `APARTY_DEVICE` | A-party device id (adb) |
| `APARTY_NUMBER` | A-party MSISDN |
| `BPARTY_DEVICE` / `BPARTY_NUMBER` | B-party for calls/SMS |
| `CALL_DURATION` | Active call seconds |
| `EXCEL_FILE` | Path to Excel test data |
| `AI_ENABLED` / `AI_API_KEY` | Optional LLM failure analysis |

---

## Excel templates

Same sheets as before: **Calling**, **SMS**, **DataUsage** under `src/test/resources/`.

---

## Wireless ADB

```bash
adb pair <ip>:<pair-port> <code>
adb connect <ip>:<connect-port>
export APARTY_DEVICE=<ip>:<connect-port>
npm run test:calling
```

---

## Reports

- **JUnit:** `reports/junit/`
- **Allure:** `allure-results/` → `npx allure generate && npx allure open`
- **Progress:** real-time via dashboard WebSocket (`PROGRESS_ENDPOINT`)

---

## Legacy Java (optional)

Java + Maven tests remain under `src/` for reference. The dashboard and `Scripts/run_tests.sh` now use **WDIO** by default.

```bash
# Legacy only, if needed:
mvn test -Dtest=CallingTest -DdeviceId=YOUR_DEVICE
```
