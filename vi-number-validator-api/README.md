# VI Number Validator API

Standalone Express API that validates VI numbers by checking the UI on:
- https://www.myvi.in/prepaid/online-mobile-recharge

## Requirements
- Node.js
- Playwright Chromium (download once)

## Setup
```bash
cd vi-number-validator-api
npm install
npx playwright install chromium
```

## Run
```bash
npm run dev
```

Default port: `4000` (override with `PORT=...`)

## Endpoints
### Health
`GET /api/health`

### Single
`POST /api/validate`
Body:
```json
{ "number": "9876543210" }
```
Response:
```json
{ "number": "9876543210", "isValid": true, "message": "Valid Vi number", "timestamp": "..." }
```

### Bulk
`POST /api/validate/bulk`
Body:
```json
{ "numbers": ["9876543210", "8765432109"] }
```

