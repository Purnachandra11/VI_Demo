"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIPDFService = void 0;
const openai_1 = __importDefault(require("openai"));
const ai_config_1 = require("../config/ai.config");
class AIPDFService {
    constructor() {
        this.openai = new openai_1.default({
            apiKey: ai_config_1.aiConfig.apiKey,
            baseURL: ai_config_1.aiConfig.baseURL
        });
    }
    // async extractInvoiceData(pdfText: string): Promise<InvoiceData> {
    //     const prompt = this.buildExtractionPrompt(pdfText);
    //     try {
    //         const response = await this.openai.chat.completions.create({
    //             model: aiConfig.model,
    //             messages: [
    //                 {
    //                     role: "system",
    //                     content: `You are an expert at extracting structured data from Vodafone Idea telecom invoices. 
    //                     Return data in valid JSON format. Be precise and accurate. 
    //                     If any field is not found, set it to null or 0 as appropriate.
    //                     For monetary values, always return as numbers (not strings).
    //                     For dates, use format: YYYY-MM-DD`
    //                 },
    //                 {
    //                     role: "user",
    //                     content: prompt
    //                 }
    //             ],
    //             temperature: aiConfig.temperature,
    //             max_tokens: aiConfig.maxTokens,
    //             response_format: { type: "json_object" }
    //         });
    //         const result = JSON.parse(response.choices[0].message.content);
    //         result.extractedAt = new Date().toISOString();
    //         result.extractionMethod = 'ai';
    //         return result as InvoiceData;
    //     } catch (error) {
    //         console.error('AI Extraction failed:', error);
    //         throw new Error(`Failed to extract invoice data: ${error.message}`);
    //     }
    // }
    // Update the error handling in AIPDFService.ts
    async extractInvoiceData(pdfText) {
        const prompt = this.buildExtractionPrompt(pdfText);
        try {
            const response = await this.openai.chat.completions.create({
                model: ai_config_1.aiConfig.model,
                messages: [
                    {
                        role: "system",
                        content: `You are an expert at extracting structured data from Vodafone Idea telecom invoices. 
                    Return data in valid JSON format. Be precise and accurate. 
                    If any field is not found, set it to null or 0 as appropriate.
                    For monetary values, always return as numbers (not strings).
                    For dates, use format: YYYY-MM-DD`
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: ai_config_1.aiConfig.temperature,
                max_tokens: ai_config_1.aiConfig.maxTokens,
                response_format: { type: "json_object" }
            });
            const content = response.choices[0].message.content;
            if (!content) {
                throw new Error('No content received from AI');
            }
            const result = JSON.parse(content);
            result.extractedAt = new Date().toISOString();
            result.extractionMethod = 'ai';
            return result;
        }
        catch (err) {
            const error = err;
            console.error('AI Extraction failed:', error);
            throw new Error(`Failed to extract invoice data: ${error.message}`);
        }
    }
    buildExtractionPrompt(pdfText) {
        return `
        Extract the following information from this Vodafone Idea telecom invoice:
        
        ${pdfText.substring(0, 15000)} // Limit text length
        
        Extract these fields as JSON:
        {
            "invoiceNumber": "string",
            "invoiceDate": "YYYY-MM-DD",
            "dueDate": "YYYY-MM-DD",
            "billCycle": "string (e.g., '01-Jun-2026 to 30-Jun-2026')",
            "customerName": "string",
            "mobileNumber": "string (10 digits)",
            "accountNumber": "string",
            "circle": "string (e.g., 'Karnataka', 'Maharashtra')",
            "totalAmountDue": "number",
            "previousBalance": "number",
            "paymentsReceived": "number",
            "adjustments": "number",
            "currentCharges": "number",
            "latePaymentCharges": "number",
            "outstandingBalance": "number",
            "taxes": {
                "cgst": "number",
                "sgst": "number",
                "igst": "number",
                "total": "number"
            },
            "planName": "string",
            "usageDetails": {
                "data": {
                    "totalGB": "number",
                    "consumedGB": "number",
                    "remainingGB": "number"
                },
                "voice": {
                    "totalMinutes": "number",
                    "local": "number",
                    "std": "number",
                    "roaming": "number"
                },
                "sms": {
                    "total": "number",
                    "sent": "number"
                }
            },
            "charges": [
                {
                    "description": "string",
                    "amount": "number",
                    "type": "usage | service | fee | tax | discount"
                }
            ],
            "discounts": [
                {
                    "description": "string",
                    "amount": "number",
                    "type": "promotional | loyalty | adjustment"
                }
            ],
            "billingAddress": "string",
            "emailId": "string",
            "paymentMode": "string",
            "gstNumber": "string",
            "confidence": "number (0-1)"
        }
        `;
    }
    async validateExtractedData(data) {
        // Basic validation rules
        const errors = [];
        if (!data.invoiceNumber)
            errors.push('Missing invoice number');
        if (!data.invoiceDate)
            errors.push('Missing invoice date');
        if (!data.dueDate)
            errors.push('Missing due date');
        if (!data.mobileNumber || data.mobileNumber.length !== 10) {
            errors.push('Invalid mobile number');
        }
        if (data.totalAmountDue < 0)
            errors.push('Total amount cannot be negative');
        if (errors.length > 0) {
            console.warn('Validation errors:', errors);
            return false;
        }
        return true;
    }
}
exports.AIPDFService = AIPDFService;
