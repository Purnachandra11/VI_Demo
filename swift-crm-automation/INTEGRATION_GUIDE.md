# SWIFT CRM Automation - Integration Guide

## Overview

This guide explains how to use the SWIFT CRM automation integrated with the dashboard.

## 🚀 Quick Start

### 1. Start the Dashboard Server

```bash
cd dashboard
npm install  # If not already installed
npm start
```

The server will start on `http://localhost:5174` (or your configured port).

### 2. Navigate to SIM Recharge Page

Open your browser and go to:
```
http://localhost:5174/sim-recharge.html
```

### 3. Upload Excel File

- Click the upload area or drag & drop your Excel file
- The Excel file should have a sheet named "Input excel" with your test data
- The data should include columns: Username, Password, MSISDN, CIRCLE, Recharge MRP, SWIFT
- Set SWIFT = "Yes" for rows you want to test

### 4. Start Automation

- Click "Start SWIFT CRM Recharge UAT"
- Watch the progress bar and logs
- If CAPTCHA is needed, you'll be prompted to enter it
- View screenshots as they're captured
- Download the final report when complete

## 📁 File Structure

```
├── dashboard/
│   ├── sim-recharge.html          # Frontend UI
│   ├── server.js                  # Backend server (with SWIFT endpoints)
│   └── swiftCrmOrchestrator.js    # Automation orchestrator
│
└── swift-crm-automation/
    ├── src/
    │   ├── specs/
    │   │   ├── swift.login.spec.ts       # Login test
    │   │   └── swift_recharge_spec.ts    # Recharge UAT test
    │   ├── pages/
    │   │   ├── SwiftLoginPage.ts        # Login page object
    │   │   └── RechargePage.ts          # Recharge page object
    │   ├── services/
    │   │   ├── ExcelDataService.ts       # Read test data
    │   │   └── ExcelReportService.ts     # Generate reports
    │   └── helpers/
    │       └── CaptchaHelper.ts          # CAPTCHA handling
    ├── wdio.swift.conf.ts        # Login test config
    ├── wdio.recharge.conf.ts     # Recharge test config
    └── package.json
```

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env` file in `dashboard/` or `swift-crm-automation/`:

```env
# For automatic CAPTCHA solving (optional)
CAPTCHA_SERVICE_API_KEY=your-2captcha-or-anticaptcha-api-key
CAPTCHA_SERVICE_URL=api.2captcha.com  # or api.anti-captcha.com
```

### Headless Mode

Chrome runs in headless mode by default. To see the browser:

1. Open `wdio.swift.conf.ts` or `wdio.recharge.conf.ts`
2. Remove/comment out these lines:
   ```typescript
   '--headless=new',
   '--no-sandbox',
   '--disable-gpu',
   ```

## 📊 Report Output

After a successful run, you'll get:

1. **Excel Report**: `swift-crm-automation/reports/UAT_Recharge_Report_*.xlsx`
   - Sheet 1: UAT Results with all test details
   - Sheet 2: Screenshots index with file paths

2. **Screenshots**: `swift-crm-automation/screenshots/`
   - All captured screenshots during execution

## 🛠️ API Endpoints

### Upload File
```
POST /api/swift/upload
Content-Type: multipart/form-data

Body:
- excel: Excel file
```

### Download Report
```
GET /api/swift/download-report
```

### WebSocket
```
WS /swift-ws?sessionId=<session-id>
```

WebSocket message types:
- `start`: Begin automation
- `captcha`: Send CAPTCHA answer
- `log`: Log message from server
- `progress`: Progress update
- `screenshots`: Screenshot list
- `complete`: Execution finished

## 🎯 Excel Test Data Format

Your Excel file should have a sheet named "Input excel" with:

| Column | Description | Required |
|--------|-------------|----------|
| Username | SWIFT CRM username | Yes |
| Password | SWIFT CRM password | Yes |
| MSISDN | Mobile number to test | Yes |
| CIRCLE | Telecom circle name | Yes |
| Recharge MRP | Plan amount to verify | Yes |
| SWIFT | "Yes" to include in test | Yes |

## 🔐 CAPTCHA Handling

The automation supports multiple CAPTCHA modes:

1. **Manual (Default)**: You enter CAPTCHA via the web interface when prompted
2. **Automatic**: Use 2Captcha/Anti-Captcha service with API key
3. **Pre-supplied**: Set `CAPTCHA_ANSWER` environment variable

## 📝 Troubleshooting

### Issue: Browser not starting

**Solution**: Check that Chrome is installed and WDIO dependencies are present:
```bash
cd swift-crm-automation
npm install
```

### Issue: Can't find Excel file

**Solution**: Make sure the Excel file has a sheet named "Input excel" (case-sensitive).

### Issue: Screenshots not displaying

**Solution**: Check that the `screenshots` directory exists and has the correct permissions.

### Issue: CAPTCHA prompt doesn't appear

**Solution**: The automation saves CAPTCHA screenshots to `captcha_screenshots/` - you can view them there if needed.

## 📞 Support

For issues, check the logs in:
- Dashboard server console
- Browser developer tools (F12)
- `swift-crm-automation/logs/` (if enabled)
