import { browser, $ } from '@wdio/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

// Directory for communication with frontend
const COMM_DIR = path.resolve('./comm');
const CAPTCHA_REQUEST_FILE = path.join(COMM_DIR, 'captcha_request.json');
const CAPTCHA_RESPONSE_FILE = path.join(COMM_DIR, 'captcha_response.json');

export class CaptchaHelper {
  static async solve(): Promise<string> {
    // Check for pre-supplied CAPTCHA (for testing)
    if (process.env.CAPTCHA_ANSWER) {
      console.log(`[CaptchaHelper] Using pre-supplied CAPTCHA: ${process.env.CAPTCHA_ANSWER}`);
      return process.env.CAPTCHA_ANSWER;
    }

    // Get CAPTCHA image element
    const captchaEl = await $('img#LoginCaptcha');
    await captchaEl.waitForDisplayed({ timeout: 10000 });

    // Get the actual image data
    let base64Image = '';

    try {
      // Method 1: Download image directly from src with SSL bypass
      const src = await captchaEl.getAttribute('src');
      if (src) {
        const fullUrl = src.startsWith('http') ? src : `https://swiftcrm.vodafoneidea.in/swift-portal/${src}`;
        console.log(`[CaptchaHelper] Downloading CAPTCHA from: ${fullUrl}`);
        base64Image = await this.downloadImageAsBase64WithSSL(fullUrl);
        console.log(`[CaptchaHelper] Image downloaded successfully (${base64Image.length} bytes)`);
      }
    } catch (error) {
      console.warn('[CaptchaHelper] Failed to download image, falling back to screenshot:', error.message);
      // Fallback: Take screenshot of just the CAPTCHA element
      const screenshotDir = path.resolve('./captcha_screenshots');
      fs.mkdirSync(screenshotDir, { recursive: true });
      const imagePath = path.join(screenshotDir, `captcha_${Date.now()}.png`);
      
      // Use element screenshot instead of full page
      await captchaEl.saveScreenshot(imagePath);
      console.log(`[CaptchaHelper] CAPTCHA screenshot saved → ${imagePath}`);
      
      // Convert to base64
      base64Image = fs.readFileSync(imagePath, { encoding: 'base64' });
    }

    // Try automatic solving if API key is available
    if (process.env.CAPTCHA_SERVICE_API_KEY) {
      console.log('[CaptchaHelper] Using 2Captcha automatic solving service...');
      try {
        const answer = await this.solveWith2Captcha(base64Image);
        console.log(`[CaptchaHelper] ✅ Automatic CAPTCHA solved: ${answer}`);
        return answer;
      } catch (error) {
        console.warn('[CaptchaHelper] Automatic solving failed, falling back to manual:', error.message);
      }
    }

    // Now communicate with frontend to get manual CAPTCHA
    console.log('[CaptchaHelper] Waiting for manual CAPTCHA entry from frontend...');
    
    // Create comm directory
    if (!fs.existsSync(COMM_DIR)) {
      fs.mkdirSync(COMM_DIR, { recursive: true });
    }

    // Write CAPTCHA request file for frontend
    const requestData = {
      timestamp: Date.now(),
      imageBase64: base64Image
    };
    fs.writeFileSync(CAPTCHA_REQUEST_FILE, JSON.stringify(requestData, null, 2));
    console.log('[CaptchaHelper] CAPTCHA request file written');

    // Clean up old response file
    if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
      fs.unlinkSync(CAPTCHA_RESPONSE_FILE);
    }

    // Poll for response from frontend
    let answer = '';
    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const pollInterval = 500; // 0.5 seconds
    const startTime = Date.now();

    while (!answer && Date.now() - startTime < maxWaitTime) {
      if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
        try {
          const responseContent = fs.readFileSync(CAPTCHA_RESPONSE_FILE, 'utf8');
          const response = JSON.parse(responseContent);
          answer = response.answer;
          console.log(`[CaptchaHelper] Got CAPTCHA from frontend: ${answer}`);
        } catch (e) {
          console.warn('[CaptchaHelper] Error reading response file:', e.message);
        }
      }
      await browser.pause(pollInterval);
    }

    // Clean up files
    if (fs.existsSync(CAPTCHA_REQUEST_FILE)) {
      fs.unlinkSync(CAPTCHA_REQUEST_FILE);
    }
    if (fs.existsSync(CAPTCHA_RESPONSE_FILE)) {
      fs.unlinkSync(CAPTCHA_RESPONSE_FILE);
    }

    if (!answer) {
      throw new Error('CAPTCHA timeout - no response from frontend');
    }
    
    return answer.trim();
  }

  // Fixed download method with SSL bypass
  private static downloadImageAsBase64WithSSL(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https') ? https : http;
      
      // For HTTPS, bypass SSL certificate verification
      const options = url.startsWith('https') ? {
        rejectUnauthorized: false,  // Skip SSL verification
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      } : {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };

      const request = url.startsWith('https') 
        ? https.get(url, options, (response) => {
            this.handleResponse(response, resolve, reject);
          })
        : http.get(url, options, (response) => {
            this.handleResponse(response, resolve, reject);
          });

      request.on('error', (error) => {
        reject(error);
      });
    });
  }

  private static handleResponse(response: any, resolve: any, reject: any): void {
    const chunks: Buffer[] = [];
    
    response.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    response.on('end', () => {
      if (response.statusCode === 200) {
        const buffer = Buffer.concat(chunks);
        const base64 = buffer.toString('base64');
        resolve(base64);
      } else {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
      }
    });
    
    response.on('error', (error: Error) => {
      reject(error);
    });
  }

  private static async solveWith2Captcha(base64Image: string): Promise<string> {
    const apiKey = process.env.CAPTCHA_SERVICE_API_KEY!;
    const serviceUrl = process.env.CAPTCHA_SERVICE_URL || 'api.2captcha.com';

    // Create task
    const taskId = await this.create2CaptchaTask(serviceUrl, apiKey, base64Image);
    console.log(`[CaptchaHelper] 2Captcha task created, ID: ${taskId}`);

    // Wait for result (with polling)
    const result = await this.get2CaptchaResult(serviceUrl, apiKey, taskId);
    return result;
  }

  private static create2CaptchaTask(host: string, apiKey: string, base64Image: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        clientKey: apiKey,
        task: {
          type: 'ImageToTextTask',
          body: base64Image,
          phrase: false,
          case: false,
          numeric: 0,
          math: false,
          minLength: 0,
          maxLength: 0
        }
      });

      console.log(`[CaptchaHelper] Creating 2Captcha task...`);

      const options = {
        hostname: host,
        port: 443,
        path: '/createTask',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`[CaptchaHelper] 2Captcha response: ${data}`);
          try {
            const response = JSON.parse(data);
            if (response.errorId === 0) {
              resolve(response.taskId);
            } else {
              reject(new Error(`2Captcha error: ${response.errorDescription || 'Unknown error'}`));
            }
          } catch (e) {
            reject(new Error(`Failed to parse 2Captcha response: ${e.message}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to connect to 2Captcha: ${error.message}`));
      });
      
      req.write(postData);
      req.end();
    });
  }

  private static async get2CaptchaResult(host: string, apiKey: string, taskId: string, maxAttempts = 30): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const result = await this.poll2CaptchaResult(host, apiKey, taskId);
      
      if (result.status === 'ready') {
        return result.solution!;
      }
      
      if (result.status === 'error') {
        throw new Error(`2Captcha error: ${result.error}`);
      }
      
      // Still processing, wait and try again
      console.log(`[CaptchaHelper] 2Captcha processing... attempt ${attempt + 1}/${maxAttempts}`);
      await this.sleep(3000);
    }
    
    throw new Error('2Captcha solving timeout');
  }

  private static poll2CaptchaResult(host: string, apiKey: string, taskId: string): Promise<{ status: string; solution?: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify({
        clientKey: apiKey,
        taskId: taskId
      });

      const options = {
        hostname: host,
        port: 443,
        path: '/getTaskResult',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.errorId === 0) {
              if (response.status === 'ready') {
                resolve({ status: 'ready', solution: response.solution.text });
              } else if (response.status === 'processing') {
                resolve({ status: 'processing' });
              } else {
                resolve({ status: 'error', error: 'Unknown status' });
              }
            } else {
              resolve({ status: 'error', error: response.errorDescription });
            }
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  static async refresh(): Promise<void> {
    try {
      const captchaImg = await $('img#LoginCaptcha');
      const currentSrc = await captchaImg.getAttribute('src');
      
      // Refresh by adding timestamp
      const newSrc = currentSrc.includes('?') 
        ? currentSrc.replace(/&?_=\d+/, `&_=${Date.now()}`)
        : `${currentSrc}?${Date.now()}`;
      
      await browser.execute((src) => {
        const el = document.querySelector('img#LoginCaptcha') as HTMLImageElement;
        if (el) {
          el.src = src;
        }
      }, newSrc);
      
      await browser.pause(1000);
      console.log('[CaptchaHelper] CAPTCHA refreshed');
    } catch (e) {
      console.warn('[CaptchaHelper] Could not refresh CAPTCHA:', e);
    }
  }
}
