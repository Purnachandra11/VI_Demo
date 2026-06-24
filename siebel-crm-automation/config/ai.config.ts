import * as dotenv from 'dotenv';
dotenv.config();

export interface AIConfig {
    apiKey: string;
    model: string;
    temperature: number;
    maxTokens: number;
    baseURL?: string;
}

export interface PDFConfig {
    downloadPath: string;
    maxFileSize: number; // in MB
    supportedFormats: string[];
    extractionTimeout: number; // in seconds
}

export const aiConfig: AIConfig = {
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    temperature: 0.1,
    maxTokens: 4096,
    baseURL: process.env.AI_BASE_URL
};

export const pdfConfig: PDFConfig = {
    downloadPath: process.env.PDF_DOWNLOAD_PATH || './downloads/invoices',
    maxFileSize: 50,
    supportedFormats: ['pdf', 'PDF'],
    extractionTimeout: 60
};