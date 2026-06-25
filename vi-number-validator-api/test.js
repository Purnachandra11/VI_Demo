import express, { Request, Response } from "express";
import cors from "cors";
import { chromium, type Page } from "playwright";

/**
 * Vi Number Validation API (Playwright based)
 *
 * Endpoints
 *  GET  /api/health
 *  POST /api/validate        { "number": "9876543210" }
 *  POST /api/validate/bulk   { "numbers": ["9876543210", ...] }
 */

const app = express();
app.use(cors());
app.use(express.json());

const VI_URL = "https://www.myvi.in/prepaid/online-mobile-recharge";

// Keep selectors aligned with your existing WDIO logic
const SELECTORS = {
  mobileInput: "#mobileNumber",
  errorMsg: ".ORCMobileInput_errorMsg__TecyC",
} as const;

const WAIT_MS = 1500; // allow Vi UI debounce/check to run

export type ViValidationResult = {
  number: string;
  isValid: boolean;
  message: string;
  timestamp: string;
};

export type BulkValidationResult = {
  total: number;
  valid: number;
  invalid: number;
  duration_ms: number;
  results: ViValidationResult[];
};

function isValidFormat(n: unknown): n is string {
  return typeof n === "string" && /^\d{10}$/.test(n);
}

// NEW: Anti-detection browser launch options
function getBrowserLaunchOptions() {
  return {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-web-security',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1920,1080'
    ]
  };
}

// NEW: Create realistic browser context
async function createRealisticPage(browser: any) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: false,
    isMobile: false,
    locale: 'en-US',
    timezoneId: 'Asia/Kolkata'
  });
  const page = await context.newPage();
  
  // Add extra headers
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  });
  
  return page;
}

async function validateOnPage(page: Page, mobileNumber: string): Promise<ViValidationResult> {
  const input = page.locator(SELECTORS.mobileInput);
  await input.waitFor({ state: "visible", timeout: 15000 });

  await input.click({ clickCount: 3 });
  await input.fill(mobileNumber);

  await page.waitForTimeout(WAIT_MS);

  const errorLocator = page.locator(SELECTORS.errorMsg);
  const hasError = await errorLocator.isVisible().catch(() => false);
  const errorText = hasError ? (await errorLocator.innerText()).trim() : "";

  // NEW: Only mark as invalid if it's a "non Vi number" error
  // Other errors might be temporary (like network issues)
  const isNonViError = errorText.toLowerCase().includes('non vi number');
  
  // If there's an error but it's NOT a non-Vi error, treat as valid (might be temporary)
  const isValid = !hasError || !isNonViError;

  return {
    number: mobileNumber,
    isValid: isValid,
    message: isValid
      ? "Valid Vi number"
      : `Invalid Vi number – "${errorText}"`,
    timestamp: new Date().toISOString(),
  };
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", service: "vi-number-validator", ts: new Date().toISOString() });
});

app.post("/api/validate", async (req: Request, res: Response) => {
  const number = (req.body as { number?: unknown }).number;

  if (!isValidFormat(number)) {
    return res.status(400).json({
      error: "Invalid input",
      detail: '"number" must be a 10-digit string',
    });
  }

  let browser = null as null | Awaited<ReturnType<typeof chromium.launch>>;
  try {
    // UPDATED: Use anti-detection launch options
    browser = await chromium.launch(getBrowserLaunchOptions());
    // UPDATED: Create realistic page with context
    const page = await createRealisticPage(browser);
    
    await page.goto(VI_URL, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });

    const result = await validateOnPage(page, number);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Internal server error", detail: message });
  } finally {
    await browser?.close();
  }
});

app.post("/api/validate/bulk", async (req: Request, res: Response) => {
  const numbers = (req.body as { numbers?: unknown }).numbers;

  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({
      error: "Invalid input",
      detail: '"numbers" must be a non-empty array of 10-digit strings',
    });
  }

  const invalid = numbers.filter((n) => !isValidFormat(n));
  if (invalid.length > 0) {
    return res.status(400).json({
      error: "Format error",
      detail: `These numbers are not 10 digits: ${invalid.map(String).join(", ")}`,
    });
  }

  if (numbers.length > 50) {
    return res.status(400).json({
      error: "Limit exceeded",
      detail: "Maximum 50 numbers per bulk request",
    });
  }

  const start = Date.now();
  let browser = null as null | Awaited<ReturnType<typeof chromium.launch>>;

  try {
    // UPDATED: Use anti-detection launch options
    browser = await chromium.launch(getBrowserLaunchOptions());
    // UPDATED: Create realistic page with context
    const page = await createRealisticPage(browser);
    
    await page.goto(VI_URL, { 
      waitUntil: "domcontentloaded", 
      timeout: 60000 
    });

    const results: ViValidationResult[] = [];
    for (const num of numbers as string[]) {
      const r = await validateOnPage(page, num);
      results.push(r);
    }

    const valid = results.filter((r) => r.isValid).length;
    const invalidCount = results.length - valid;

    const bulk: BulkValidationResult = {
      total: results.length,
      valid,
      invalid: invalidCount,
      duration_ms: Date.now() - start,
      results,
    };

    res.json(bulk);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: "Internal server error", detail: message });
  } finally {
    await browser?.close();
  }
});

const PORT = Number(process.env.PORT ?? 4000);
app.listen(PORT, () => {
  console.log(`✅ Vi Validator API running on http://localhost:${PORT}`);
  console.log(`GET  /api/health`);
  console.log(`POST /api/validate`);
  console.log(`POST /api/validate/bulk`);
});