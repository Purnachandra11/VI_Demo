// utils/env.ts
import * as dotenv from 'dotenv';
dotenv.config();

export function envString(key: string, fallback = ''): string {
  return (process.env[key] || fallback).trim();
}

export function envNumber(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function envBool(key: string, fallback = false): boolean {
  const raw = (process.env[key] || '').toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Maven -D style aliases used by the dashboard */
export function getRunContext() {
  return {
    aPartyDevice: envString('APARTY_DEVICE') || envString('aPartyDevice'),
    aPartyNumber: envString('APARTY_NUMBER') || envString('aPartyNumber'),
    bPartyDevice: envString('BPARTY_DEVICE') || envString('bPartyDevice'),
    bPartyNumber: envString('BPARTY_NUMBER') || envString('bPartyNumber'),
    cPartyDevice: envString('CPARTY_DEVICE') || envString('cPartyDevice'),
    cPartyNumber: envString('CPARTY_NUMBER') || envString('cPartyNumber'),
    callDuration: envNumber('CALL_DURATION', envNumber('callDuration', 15)),
    networkType: envString('NETWORK_TYPE', envString('networkType', '4G')),
    volteEnabled: envBool('VOLTE_ENABLED', envBool('volteEnabled', true)),
    ussdEnabled: envBool('USSD_ENABLED', true),
    excelFile: envString('EXCEL_FILE', 'src/test/resources/contacts.xlsx'),
    smsMessage: envString('SMS_MESSAGE', envString('messageText', '')),
    smsCount: envNumber('SMS_COUNT', 1),
    targetDataGb: envNumber('TARGET_DATA_GB', envNumber('targetDataGB', 0.5)),
    durationMin: envNumber('DURATION_MIN', envNumber('durationMin', 15)),
    phoneDeviceMapFile: envString('PHONE_DEVICE_MAP_FILE'),
    runAllExcelRows: envBool('RUN_ALL_EXCEL_ROWS', false)
  };
}

// AI Configuration Object
export const env = {
  // OpenAI / AI Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  AI_MODEL: process.env.AI_MODEL || 'gpt-4o-mini',
  PDF_DOWNLOAD_PATH: process.env.PDF_DOWNLOAD_PATH || './downloads/invoices',
  AI_TEMPERATURE: parseFloat(process.env.AI_TEMPERATURE || '0.1'),
  
  // Optional: Azure OpenAI configuration (if using Azure)
  AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT || '',
  AZURE_OPENAI_KEY: process.env.AZURE_OPENAI_KEY || '',
  AZURE_OPENAI_DEPLOYMENT: process.env.AZURE_OPENAI_DEPLOYMENT || '',
  
  // Optional: Anthropic Claude configuration
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',
  
  // Optional: Local AI configuration (Ollama)
  OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  OLLAMA_MODEL: process.env.OLLAMA_MODEL || 'llama2',
  
  // AI Features Toggle
  ENABLE_AI_VALIDATION: envBool('ENABLE_AI_VALIDATION', false),
  ENABLE_AI_EXTRACTION: envBool('ENABLE_AI_EXTRACTION', true),
  
  // Rate limiting and retry configuration
  AI_MAX_RETRIES: envNumber('AI_MAX_RETRIES', 3),
  AI_REQUEST_TIMEOUT_MS: envNumber('AI_REQUEST_TIMEOUT_MS', 30000),
  AI_RATE_LIMIT_RPM: envNumber('AI_RATE_LIMIT_RPM', 60), // Requests per minute
};

// Helper function to validate AI configuration
export function isAIConfigured(): boolean {
  return !!env.OPENAI_API_KEY || !!env.AZURE_OPENAI_KEY || !!env.ANTHROPIC_API_KEY;
}

// Helper function to get AI provider
export function getAIProvider(): 'openai' | 'azure' | 'anthropic' | 'ollama' | 'none' {
  if (env.OPENAI_API_KEY) return 'openai';
  if (env.AZURE_OPENAI_KEY) return 'azure';
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.OLLAMA_BASE_URL) return 'ollama';
  return 'none';
}

// Export individual AI config values for convenience
export const {
  OPENAI_API_KEY,
  AI_MODEL,
  PDF_DOWNLOAD_PATH,
  AI_TEMPERATURE,
  AZURE_OPENAI_ENDPOINT,
  AZURE_OPENAI_KEY,
  AZURE_OPENAI_DEPLOYMENT,
  ANTHROPIC_API_KEY,
  ANTHROPIC_MODEL,
  OLLAMA_BASE_URL,
  OLLAMA_MODEL,
  ENABLE_AI_VALIDATION,
  ENABLE_AI_EXTRACTION,
  AI_MAX_RETRIES,
  AI_REQUEST_TIMEOUT_MS,
  AI_RATE_LIMIT_RPM
} = env;