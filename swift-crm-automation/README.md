# SWIFT CRM Automation

WebdriverIO v9 + TypeScript + Mocha automation for SWIFT CRM login, recharge UAT, and Vi App verification.

## Project Structure

```
swift-crm-automation/
├── data/
│   └── Input_data.xlsx              ← Place your Excel file here
├── src/
│   ├── helpers/
│   │   └── CaptchaHelper.ts         ← CAPTCHA resolution (manual / env var / automatic)
│   ├── pages/
│   │   ├── SwiftLoginPage.ts        ← Page Object for login page
│   │   ├── RechargePage.ts          ← Page Object for recharge UAT
│   │   └── ViAppPage.ts             ← Page Object for Vi App (ADB + Appium)
│   ├── services/
│   │   ├── ExcelDataService.ts      ← Reads Input + Recharge Plans sheets
│   │   └── ExcelReportService.ts    ← Writes UAT results Excel report
│   └── specs/
│       ├── swift.login.spec.ts      ← Login test spec
│       └── swift_recharge_spec.ts   ← Recharge UAT + Vi App test spec
├── wdio.swift.conf.ts               ← WDIO config for login
├── wdio.recharge.conf.ts            ← WDIO config for recharge UAT
├── tsconfig.json
└── package.json
```

## Setup

```bash
cd swift-crm-automation
npm install
```

Place your `Input_data.xlsx` file in the `./data/` directory.

---

## Running Tests

### Login Test

```bash
npm run test:swift
```

The browser will open, navigate to the SWIFT login page, fill in credentials
from Excel, then pause at the CAPTCHA and prompt you in the terminal:

```
>>> Open the browser, read the CAPTCHA, then type it here and press Enter:
```

Type the CAPTCHA characters and press Enter. The script will complete the login
and assert that the My Profile tab is visible.

### Recharge UAT (with Vi App)

```bash
npm run test:recharge
```

Or:

```bash
npx wdio run ./wdio.recharge.conf.ts
```

This runs the full recharge UAT flow for every row where `SWIFT = Yes`:

1. Login once with credentials from the first SWIFT=Yes row
2. For each SWIFT=Yes row:
   - Enter MSISDN and click Recharge Offer button
   - Capture screenshots (subscriber table, alert bar, full page)
   - Verify circle from `abbr[title]`
   - Click Offer History tab, scrape matching offer history for Recharge MRP
   - Add results and screenshots to the UAT report
   - **If `Vi App = Yes`** → run the Vi App flow (see below)
   - **If `Vi App = No`** → skip Vi App steps for this row
3. Generate Excel report in `./reports/`

---

## Vi App Flow

The Vi App steps are driven by the `Vi App` column in the Input sheet. They execute **after** the SWIFT CRM recharge steps for each row.

### Condition

| Vi App value | Behaviour |
|---|---|
| `Yes` | Launches the Vi App, logs in with MSISDN, verifies My Account, then uninstalls |
| `No` | Skips all Vi App steps for that row |

### Step-by-step

**Step 1 – Launch the app via ADB**

```bash
adb -s <DEVICE_SERIAL> shell monkey -p com.mventus.selfcare.activity -c android.intent.category.LAUNCHER 1
```

The device serial defaults to `LFMVIBEMW8HUR4XK`. Override it with the `DEVICE_SERIAL` environment variable if you use a different device.

**Step 2 – Enter MSISDN**

Waits for the `"enter mobile number"` screen to appear, then types the MSISDN from the Excel row.

**Step 3 – OTP and login**

Clicks **send OTP**. Two scenarios are handled automatically:

- **SIM on same device** → app auto-fills OTP; no manual action needed.
- **Different device / CI** → set `VI_APP_OTP=<4-digit-code>` as an environment variable; the framework types each digit into the OTP boxes.

After OTP, clicks **login with OTP**.

**Post-login verification**

Opens the hamburger menu (3-lines icon) and confirms the MSISDN is visible on the My Account screen. Logs a pass/warn accordingly.

**Logout and uninstall**

Clicks the logout button, then runs:

```bash
adb -s <DEVICE_SERIAL> uninstall com.mventus.selfcare.activity
```

### Environment variables for Vi App

| Variable | Default | Description |
|---|---|---|
| `DEVICE_SERIAL` | `LFMVIBEMW8HUR4XK` | ADB device serial for the Android device |
| `VI_APP_OTP` | _(none)_ | 4-digit OTP to enter manually when SIM is not on the test device |

### Example run with overrides

```bash
# PowerShell
$env:DEVICE_SERIAL = "YOUR_DEVICE_SERIAL"
$env:VI_APP_OTP    = "5678"
npm run test:recharge
```

```bash
# Bash / macOS / Linux
DEVICE_SERIAL=YOUR_DEVICE_SERIAL VI_APP_OTP=5678 npm run test:recharge
```

---

## CAPTCHA Handling Options

| Method | How to use |
|---|---|
| **Manual (default)** | Read CAPTCHA in browser, type in terminal |
| **Env variable** | `CAPTCHA_ANSWER=AbCd12 npm run test:swift` |
| **Automatic (2Captcha / Anti-Captcha)** | Set `CAPTCHA_SERVICE_API_KEY` and optionally `CAPTCHA_SERVICE_URL` |

### Automatic CAPTCHA Solving

1. Sign up at [2Captcha](https://2captcha.com) or [Anti-Captcha](https://anti-captcha.com) and get your API key.
2. Set environment variables:

```bash
# PowerShell — 2Captcha (default)
$env:CAPTCHA_SERVICE_API_KEY = "your-api-key"
npm run test:swift

# PowerShell — Anti-Captcha
$env:CAPTCHA_SERVICE_API_KEY = "your-api-key"
$env:CAPTCHA_SERVICE_URL     = "api.anti-captcha.com"
npm run test:swift
```

If automatic solving fails, the framework falls back to manual terminal input.

---

## Test Data (Excel → Sheet: "Input excel")

| Column | Description |
|---|---|
| Username | SWIFT CRM login username |
| Password | Password |
| MSISDN | Mobile number under test |
| CIRCLE | Telecom circle (e.g. ODI) |
| Recharge MRP | Plan amount for recharge validation |
| Recharge | Flag for recharge tests |
| SWIFT | `Yes` → include in SWIFT CRM tests |
| IN | Flag for IN portal tests |
| Vi App | `Yes` → run Vi App flow after SWIFT steps; `No` → skip |

Rows where `SWIFT = No` are automatically skipped entirely. Rows where `SWIFT = Yes` but `Vi App = No` run the SWIFT CRM steps only.

---

## Output Excel Report

Generated at `./reports/UAT_Recharge_Report_<timestamp>.xlsx` with two sheets:

### Sheet 1: UAT Results

| Column | Description |
|---|---|
| Sr. No. | Sequential result number |
| Transaction Id | Offer transaction ID |
| Activation Date & Time | When the recharge was activated |
| Validity | Plan validity period |
| MRP | Recharge amount |
| Activation Mode | e.g. eTOPUP |
| Current Core Balance | Balance at time of check |
| eTOP UP Transaction Id | eTOPUP reference |
| Retailer MSISDN | Retailer mobile number |
| Name | Plan name |
| Category | Plan category |
| Benefits | Full benefit text (from `abbr[title]`) |
| Detail Validity | Extended validity description |
| MSISDN | Subscriber MSISDN |
| Circle | Telecom circle |

### Sheet 2: Screenshots

| Column | Description |
|---|---|
| Sr. No. | Sequential index |
| MSISDN | Subscriber MSISDN |
| Screenshot File | Filename |
| Full Path | Absolute path on disk |
| Captured At | ISO timestamp |

---

## Retry Logic

If CAPTCHA fails (profile page not visible after login), the framework:
1. Refreshes the CAPTCHA image
2. Prompts for a new CAPTCHA value
3. Retries up to 3 times before throwing an error

---

## Failure Screenshots

On any test failure, a screenshot is automatically saved to `./screenshots/FAILED_<test-title>_<timestamp>.png`.