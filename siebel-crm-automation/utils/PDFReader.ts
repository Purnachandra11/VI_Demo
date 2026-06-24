// test/utils/PDFReader.ts
import * as fs from 'fs';
import * as path from 'path';

export interface InvoiceData {
  customerName: string;
  billPeriod: string;
  viNumber: string;
  planName: string;
  monthlyRental: number;
  totalCharges: number;
  gstAmount: number;
  totalPayable: number;
  usageDetails: {
    dataUsage: number;
    smsUsage: number;
    voiceUsage: string;
  };
  vasCharges: Array<{ description: string; amount: number }>;
  adjustments: Array<{ description: string; amount: number }>;
}

export class PDFReader {
  
  async readInvoiceData(pdfPath: string): Promise<InvoiceData> {
    // Using pdf-parse library
    const pdfParse = require('pdf-parse');
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    
    return this.extractInvoiceData(data.text);
  }

  private extractInvoiceData(text: string): InvoiceData {
    const invoiceData: InvoiceData = {
      customerName: this.extractCustomerName(text),
      billPeriod: this.extractBillPeriod(text),
      viNumber: this.extractViNumber(text),
      planName: this.extractPlanName(text),
      monthlyRental: this.extractMonthlyRental(text),
      totalCharges: this.extractTotalCharges(text),
      gstAmount: this.extractGSTAmount(text),
      totalPayable: this.extractTotalPayable(text),
      usageDetails: this.extractUsageDetails(text),
      vasCharges: this.extractVASCharges(text),
      adjustments: this.extractAdjustments(text),
    };
    
    return invoiceData;
  }

  private extractCustomerName(text: string): string {
    const match = text.match(/Mr\.\s+([A-Za-z\s]+)/i);
    return match ? match[1].trim() : 'Not Found';
  }

  private extractBillPeriod(text: string): string {
    const match = text.match(/Bill Period\s+(\d{2}\s+[A-Za-z]+\s+\d{2}\s+to\s+\d{2}\s+[A-Za-z]+\s+\d{2})/i);
    return match ? match[1] : 'Not Found';
  }

  private extractViNumber(text: string): string {
    const match = text.match(/VI No\s+(\d{10})/i);
    return match ? match[1] : 'Not Found';
  }

  private extractPlanName(text: string): string {
    // Look for plan names like "Vi Max Family 871" or similar
    const match = text.match(/Plan\s+Rental\s+-\s+([A-Za-z0-9\s]+)/i);
    return match ? match[1].trim() : 'Not Found';
  }

  private extractMonthlyRental(text: string): number {
    // Find rental amount from Plan Rental section
    const match = text.match(/Plan Rental[^\n]+\n[^\n]+\n[^\n]+\n[^\n]+\n([\d,.]+)/i);
    if (match) {
      return this.parseCurrency(match[1]);
    }
    return 0;
  }

  private extractTotalCharges(text: string): number {
    const match = text.match(/Total charges for current bill period\s*\(including tax\)\s*([\d,.]+)/i);
    if (match) {
      return this.parseCurrency(match[1]);
    }
    return 0;
  }

  private extractGSTAmount(text: string): number {
    // GST appears as Central GST and State GST
    const matches = text.match(/Central GST @ 9\.00%\s*([\d,.]+)/i);
    if (matches && matches[1]) {
      const cgst = this.parseCurrency(matches[1]);
      const sgstMatch = text.match(/State GST @ 9\.00%\s*([\d,.]+)/i);
      const sgst = sgstMatch ? this.parseCurrency(sgstMatch[1]) : 0;
      return cgst + sgst;
    }
    return 0;
  }

  private extractTotalPayable(text: string): number {
    const match = text.match(/Total charges for current bill period\s*\(including tax\)\s*([\d,.]+)/i);
    if (match) {
      return this.parseCurrency(match[1]);
    }
    return 0;
  }

  private extractUsageDetails(text: string): { dataUsage: number; smsUsage: number; voiceUsage: string } {
    // Extract data usage
    let dataUsage = 0;
    const dataMatch = text.match(/Internet Usage[\s\S]*?([\d.]+)\s*GB/i);
    if (dataMatch) {
      dataUsage = parseFloat(dataMatch[1]);
    }

    // Extract SMS usage
    let smsUsage = 0;
    const smsMatch = text.match(/SMS Charges[\s\S]*?Usage\s*\(SMS\)\s*([\d,]+)/i);
    if (smsMatch) {
      smsUsage = parseInt(smsMatch[1].replace(/,/g, ''), 10);
    }

    // Extract voice usage
    let voiceUsage = '0:00';
    const voiceMatch = text.match(/Voice Call Monthly Charges[\s\S]*?Total\s+([\d:]+)/i);
    if (voiceMatch) {
      voiceUsage = voiceMatch[1];
    }

    return { dataUsage, smsUsage, voiceUsage };
  }

  private extractVASCharges(text: string): Array<{ description: string; amount: number }> {
    const vasCharges: Array<{ description: string; amount: number }> = [];
    
    // Look for VAS subscriptions
    const vasSection = text.match(/Value Added Services \(VAS\)[\s\S]*?(?=For more details|$)/i);
    if (vasSection) {
      const lines = vasSection[0].split('\n');
      for (const line of lines) {
        const match = line.match(/([A-Za-z\s]+(?:Subscription|Service))\s*([\d,.]+)/i);
        if (match) {
          vasCharges.push({
            description: match[1].trim(),
            amount: this.parseCurrency(match[2]),
          });
        }
      }
    }
    
    return vasCharges;
  }

  // Add this method to PDFReader.ts

async extractText(pdfBuffer: Buffer): Promise<string> {
    try {
        const pdfParse = require('pdf-parse');
        const data = await pdfParse(pdfBuffer);
        return data.text;
    } catch (error) {
        console.error('PDF parsing error:', error);
        throw error;
    }
}

  private extractAdjustments(text: string): Array<{ description: string; amount: number }> {
    const adjustments: Array<{ description: string; amount: number }> = [];
    
    const adjustmentSection = text.match(/Adjustments[\s\S]*?(?=Taxable Value|$)/i);
    if (adjustmentSection) {
      const lines = adjustmentSection[0].split('\n');
      for (const line of lines) {
        const match = line.match(/([A-Z\s]+(?:Credit|Transfer|Adjustment))\s*([\d,.]+)/i);
        if (match) {
          adjustments.push({
            description: match[1].trim(),
            amount: this.parseCurrency(match[2]),
          });
        }
      }
    }
    
    return adjustments;
  }

  private parseCurrency(value: string): number {
    // Remove commas and convert to number
    const cleaned = value.replace(/,/g, '').replace(/\(-/g, '-').replace(/[^0-9.-]/g, '');
    return parseFloat(cleaned) || 0;
  }
}