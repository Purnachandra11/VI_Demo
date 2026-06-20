# SWIFT CRM Automation

WebdriverIO v9 + TypeScript + Mocha automation for SWIFT CRM login and recharge UAT.

## Project Structure

```
swift-crm-automation/
├── data/
│   └── Input_data.xlsx          ← Place your Excel file here
├── src/
│   ├── helpers/
│   │   └── CaptchaHelper.ts     ← CAPTCHA resolution (manual / env var / automatic)
│   ├── pages/
│   │   ├── SwiftLoginPage.ts    ← Page Object for login page
│   │   └── RechargePage.ts      ← Page Object for recharge UAT
│   ├── services/
│   │   ├── ExcelDataService.ts  ← Reads Input + Recharge Plans sheets
│   │   └── ExcelReportService.ts← Writes UAT results Excel report
│   └── specs/
│       ├── swift.login.spec.ts  ← Login test spec
│       └── swift_recharge_spec.ts← Recharge UAT test spec
├── wdio.swift.conf.ts            ← WDIO config for login
├── wdio.recharge.conf.ts         ← WDIO config for recharge UAT
├── tsconfig.json
└── package.json
```

## Setup

```bash
cd swift-crm-automation
npm install
```

Place your `Input_data.xlsx` file in the `./data/` directory.

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

### Recharge UAT

```bash
npm run test:recharge
```

Or:

```bash
npx wdio run ./wdio.recharge.conf.ts
```

This will run the full recharge UAT flow:
1. Login once with credentials from first SWIFT=Yes row
2. For each SWIFT=Yes row:
   - Enter MSISDN
   - Click Recharge Offer button
   - Capture screenshots (subscriber table, alert bar, full page)
   - Verify circle from `abbr[title]`
   - Click Offer History tab
   - Find offer history matching Recharge MRP
   - Expand details and read Benefits from `abbr[title]`
3. Generate Excel report in `./reports/` with UAT results and screenshot index

## CAPTCHA Handling Options

| Method              | How to use                                     |
|---------------------|------------------------------------------------|
| **Manual (default)**| Read CAPTCHA in browser, type in terminal      |
| **Env variable**    | `CAPTCHA_ANSWER=AbCd12 npm run test:swift`     |
| **Automatic (2Captcha/Anti-Captcha)** | Set `CAPTCHA_SERVICE_API_KEY` and optionally `CAPTCHA_SERVICE_URL` |

### Automatic CAPTCHA Solving

To use automatic CAPTCHA solving with services like 2Captcha or Anti-Captcha:

1. Sign up for an account at [2Captcha](https://2captcha.com) or [Anti-Captcha](https://anti-captcha.com)
2. Get your API key
3. Set the environment variables:
   ```bash
   # For 2Captcha (default)
   $env:CAPTCHA_SERVICE_API_KEY="your-api-key"
   npm run test:swift

   # For Anti-Captcha
   $env:CAPTCHA_SERVICE_API_KEY="your-api-key"
   $env:CAPTCHA_SERVICE_URL="api.anti-captcha.com"
   npm run test:swift
   ```

The automation will automatically send the CAPTCHA image to the service and use the solved answer. If automatic solving fails, it will fall back to manual input.

## Test Data (Excel → Sheet: "Input excel")

| Column      | Description                             |
|-------------|-----------------------------------------|
| Username    | SWIFT CRM login username                |
| Password    | Password                                |
| MSISDN      | Mobile number under test                |
| CIRCLE      | Telecom circle (e.g. ODI)               |
| Recharge MRP| Plan amount for recharge validation     |
| SWIFT       | `Yes` → include in SWIFT tests          |
| IN          | Flag for IN portal tests                |
| Vi App      | Flag for Vi App tests                   |

Rows where SWIFT = "No" are automatically skipped.

## Output Excel Report

The recharge UAT generates a report in `./reports/UAT_Recharge_Report_<timestamp>.xlsx` with two sheets:

### Sheet 1: UAT Results
Columns: Sr. No., Transaction Id, Activation Date & Time, Validity, MRP, Activation Mode, Current Core Balance, eTOP UP Transaction Id, Retailer MSISDN, Name, Category, Benefits, Detail Validity, MSISDN, Circle

### Sheet 2: Screenshots
Columns: Sr. No., MSISDN, Screenshot File, Full Path, Captured At

## Retry Logic

If CAPTCHA fails (profile page not visible), the framework:
1. Refreshes the CAPTCHA image
2. Prompts for a new CAPTCHA value
3. Retries up to 3 times

## Failure Screenshots

On any test failure, a screenshot is saved to `./screenshots/`.
