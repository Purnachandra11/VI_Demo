"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_RATE_LIMIT_RPM = exports.AI_REQUEST_TIMEOUT_MS = exports.AI_MAX_RETRIES = exports.ENABLE_AI_EXTRACTION = exports.ENABLE_AI_VALIDATION = exports.OLLAMA_MODEL = exports.OLLAMA_BASE_URL = exports.ANTHROPIC_MODEL = exports.ANTHROPIC_API_KEY = exports.AZURE_OPENAI_DEPLOYMENT = exports.AZURE_OPENAI_KEY = exports.AZURE_OPENAI_ENDPOINT = exports.AI_TEMPERATURE = exports.PDF_DOWNLOAD_PATH = exports.AI_MODEL = exports.OPENAI_API_KEY = exports.env = void 0;
exports.envString = envString;
exports.envNumber = envNumber;
exports.envBool = envBool;
exports.getRunContext = getRunContext;
exports.isAIConfigured = isAIConfigured;
exports.getAIProvider = getAIProvider;
// utils/env.ts
const dotenv = __importStar(require("dotenv"));
dotenv.config();
function envString(key, fallback = '') {
    return (process.env[key] || fallback).trim();
}
function envNumber(key, fallback) {
    const raw = process.env[key];
    if (!raw)
        return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}
function envBool(key, fallback = false) {
    const raw = (process.env[key] || '').toLowerCase();
    if (!raw)
        return fallback;
    return raw === 'true' || raw === '1' || raw === 'yes';
}
/** Maven -D style aliases used by the dashboard */
function getRunContext() {
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
exports.env = {
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
function isAIConfigured() {
    return !!exports.env.OPENAI_API_KEY || !!exports.env.AZURE_OPENAI_KEY || !!exports.env.ANTHROPIC_API_KEY;
}
// Helper function to get AI provider
function getAIProvider() {
    if (exports.env.OPENAI_API_KEY)
        return 'openai';
    if (exports.env.AZURE_OPENAI_KEY)
        return 'azure';
    if (exports.env.ANTHROPIC_API_KEY)
        return 'anthropic';
    if (exports.env.OLLAMA_BASE_URL)
        return 'ollama';
    return 'none';
}
// Export individual AI config values for convenience
exports.OPENAI_API_KEY = exports.env.OPENAI_API_KEY, exports.AI_MODEL = exports.env.AI_MODEL, exports.PDF_DOWNLOAD_PATH = exports.env.PDF_DOWNLOAD_PATH, exports.AI_TEMPERATURE = exports.env.AI_TEMPERATURE, exports.AZURE_OPENAI_ENDPOINT = exports.env.AZURE_OPENAI_ENDPOINT, exports.AZURE_OPENAI_KEY = exports.env.AZURE_OPENAI_KEY, exports.AZURE_OPENAI_DEPLOYMENT = exports.env.AZURE_OPENAI_DEPLOYMENT, exports.ANTHROPIC_API_KEY = exports.env.ANTHROPIC_API_KEY, exports.ANTHROPIC_MODEL = exports.env.ANTHROPIC_MODEL, exports.OLLAMA_BASE_URL = exports.env.OLLAMA_BASE_URL, exports.OLLAMA_MODEL = exports.env.OLLAMA_MODEL, exports.ENABLE_AI_VALIDATION = exports.env.ENABLE_AI_VALIDATION, exports.ENABLE_AI_EXTRACTION = exports.env.ENABLE_AI_EXTRACTION, exports.AI_MAX_RETRIES = exports.env.AI_MAX_RETRIES, exports.AI_REQUEST_TIMEOUT_MS = exports.env.AI_REQUEST_TIMEOUT_MS, exports.AI_RATE_LIMIT_RPM = exports.env.AI_RATE_LIMIT_RPM;
