const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


class MailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    try {
      const mailHost = process.env.MAIL_HOST || 'qdegrees.icewarpcloud.in';
      const mailPortRaw = process.env.MAIL_PORT || '587';
      const mailPort = parseInt(mailPortRaw, 10) || 587;

      const mailEncryption = (process.env.MAIL_ENCRYPTION || '').toLowerCase();
      const smtpSecure = mailEncryption === 'ssl' ? true : false;

      const mailUsername = process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';
      const mailPassword = process.env.MAIL_PASSWORD || process.env.SMTP_PASS || "Jaipur@2024"

      if (!mailPassword) {
        console.error('Mail Service Error - MAIL_PASSWORD / SMTP_PASS not set in environment.');
      }

      const smtpConfig = {
        host: mailHost,
        port: mailPort,
        secure: process.env.SMTP_SECURE === 'true' ? true : smtpSecure,
        auth: {
          user: mailUsername,
          pass: mailPassword
        }
      };

      this.transporter = nodemailer.createTransport(smtpConfig);

      this.transporter.verify((error, success) => {
        if (error) {
          console.error('Mail Service Error - SMTP connection failed:', error.message);
        } else {
          console.log('Mail Service - SMTP connection established successfully');
        }
      });

    } catch (error) {
      console.error('Mail Service Error - Failed to initialize transporter:', error.message);
    }
  }


  buildConfirmUrl(detail, signToken) {
    const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5174';
    const txnId = encodeURIComponent(detail.transactionId || '');
    const token = signToken(detail.transactionId);
    return `${baseUrl}/recharge/confirm/${txnId}?token=${token}`;
  }

  isValidRechargeDetail(detail) {
    return detail && (detail.isValid === true || String(detail.status || '').toLowerCase() === 'success');
  }

  /**
   * Check if benefit is valid (not N/A or empty)
   */
  hasValidBenefitValue(detail) {
    const benefit = detail.benefit || detail.planName || 'N/A';
    return benefit && benefit !== 'N/A' && benefit !== '' && benefit !== '—' && benefit !== 'N/A' && benefit !== 'NA';
  }

  /**
   * Format combined table HTML with BOTH valid and invalid data - NO action buttons
   * SHOWS ALL ROWS regardless of benefit
   */
  formatCombinedTableHtml(allDetails, validCount, invalidCount, userName = 'Customer', options = {}) {
    const currentDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });

    let tableRows = '';
    let totalAmount = 0;

    // Separate valid and invalid for display order (valid first, then invalid)
    const validItems = allDetails.filter(d => d.isValid === true);
    const invalidItems = allDetails.filter(d => d.isValid === false);
    const sortedDetails = [...validItems, ...invalidItems];

    // Check if any record has a valid benefit (for showing the column)
    const hasValidBenefit = sortedDetails.some(d => this.hasValidBenefitValue(d));

    if (Array.isArray(sortedDetails) && sortedDetails.length > 0) {
      sortedDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;

        const isViValid = detail.isValid === true;
        const status = isViValid ? 'Valid' : 'Invalid';
        const statusClass = isViValid ? 'status-valid' : 'status-invalid';
        const statusIcon = isViValid ? '✅' : '❌';

        const circle = detail.circle || detail.operatorName || 'N/A';
        // For combined email, show benefit if exists, otherwise show empty
        const benefit = this.hasValidBenefitValue(detail) ? (detail.benefit || detail.planName || 'N/A') : '';
        const reason = detail.errorMessage || detail.reason || '';

        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; text-align: center;">${index + 1}</td>
            <td style="padding: 10px; font-weight: 500;">${detail.mobileNumber || 'N/A'}</td>
            <td style="padding: 10px;"><span class="${statusClass}">${statusIcon} ${status}</span></td>
            <td style="padding: 10px;">${circle}</td>
            <td style="padding: 10px; text-align: right; font-weight: 600; ${!isViValid ? 'color: #dc3545;' : ''}">₹${amount.toFixed(2)}</td>
            ${hasValidBenefit ? `<td style="padding: 10px; font-size: 12px;">${benefit}</td>` : ''}
            ${!isViValid ? `<td style="padding: 10px; font-size: 12px; color: #dc3545;">${reason}</td>` : ''}
          </tr>
        `;
      });
    }

    // Determine column count
    const hasInvalid = invalidCount > 0;
    const colCount = 5 + (hasValidBenefit ? 1 : 0) + (hasInvalid ? 1 : 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mobile Recharge Details</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 1100px;
            margin: 20px auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 5px 0 0 0; font-size: 14px; }
          .user-section {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #667eea;
            border-radius: 4px;
          }
          .user-section h3 { margin: 0 0 10px 0; color: #667eea; }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-item { 
            padding: 12px; 
            background-color: #f0f0f0; 
            border-radius: 4px;
            text-align: center;
          }
          .info-item label { 
            font-weight: 600; 
            color: #667eea; 
            display: block; 
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-item value { 
            display: block; 
            margin-top: 5px; 
            font-size: 20px;
            font-weight: 700;
          }
          .info-item value.valid { color: #28a745; }
          .info-item value.invalid { color: #dc3545; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          thead { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
          }
          th { 
            padding: 12px; 
            text-align: left; 
            font-weight: 600; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td { padding: 10px; font-size: 13px; }
          tbody tr:nth-child(even) { background-color: #fafafa; }
          tbody tr:hover { background-color: #f5f5f5; }
          .status-valid {
            background-color: #d4edda;
            color: #155724;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
          }
          .status-invalid {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
          }
          .summary {
            margin-top: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            text-align: right;
          }
          .summary-item { display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; }
          .summary-item.total {
            font-size: 20px;
            font-weight: bold;
            border-top: 2px solid rgba(255, 255, 255, 0.3);
            padding-top: 10px;
            margin-top: 15px;
          }
          .footer {
            margin-top: 30px;
            padding: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .footer p { margin: 5px 0; }
          .section-title {
            color: #667eea;
            margin-top: 30px;
            font-size: 16px;
            font-weight: 600;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
          }
          .sub-header {
            font-size: 13px;
            color: #666;
            margin: 5px 0 10px 0;
          }
          .no-data {
            text-align: center;
            padding: 20px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Mobile Recharge Details Valid & Invalid Numbers</h1>
            <p>Complete Report - Valid & Invalid Numbers</p>
          </div>

          
          <div class="user-section">
            <p><strong>Generated on:</strong> ${currentDate}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <label>Total Recharges</label>
              <value>${allDetails.length}</value>
            </div>
            <div class="info-item">
              <label>Valid</label>
              <value class="valid">${validCount}</value>
            </div>
            <div class="info-item">
              <label>Invalid</label>
              <value class="invalid">${invalidCount}</value>
            </div>
          </div>

          <div class="section-title"> Recharge Details</div>
          <p class="sub-header">This report contains both valid and invalid numbers.</p>

          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>MSISDN</th>
                  <th>Vi Status</th>
                  <th>Circle</th>
                  <th>Recharge MRP (₹)</th>
                  ${hasValidBenefit ? '<th>Benefit</th>' : ''}
                  ${invalidCount > 0 ? '<th>Reason</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="${colCount}" class="no-data">No recharge details available</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span>Total Recharges:</span>
              <span>${allDetails.length}</span>
            </div>
            <div class="summary-item">
              <span>Valid:</span>
              <span style="color: #90EE90;">${validCount}</span>
            </div>
            <div class="summary-item">
              <span>Invalid:</span>
              <span style="color: #FF6B6B;">${invalidCount}</span>
            </div>
            <div class="summary-item total">
              <span>Total Amount:</span>
              <span>₹${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p><strong>VI Automation System</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you have any questions, please contact support at support@vi.com</p>
            <p style="margin-top: 15px; color: #999;">© 2024 VI Telecom. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return htmlContent;
  }

  /**
   * Format combined text version - SHOWS ALL ROWS
   */
  formatCombinedText(allDetails, validCount, invalidCount, userName = 'Customer', options = {}) {
    const currentDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let textContent = `
MOBILE RECHARGE DETAILS
================================

Dear ${userName},

Please find below the complete report of your bulk mobile recharges.
This report contains both valid and invalid numbers.

Generated on: ${currentDate}

`;

    let totalAmount = 0;

    if (Array.isArray(allDetails) && allDetails.length > 0) {
      const validItems = allDetails.filter(d => d.isValid === true);
      const invalidItems = allDetails.filter(d => d.isValid === false);
      const sortedDetails = [...validItems, ...invalidItems];
      
      sortedDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;
        const status = detail.isValid === true ? 'Valid' : 'Invalid';
        const circle = detail.circle || detail.operatorName || 'N/A';
        const benefit = this.hasValidBenefitValue(detail) ? (detail.benefit || detail.planName || 'N/A') : '';
        const reason = detail.errorMessage || detail.reason || '';

        textContent += `
${index + 1}. Mobile: ${detail.mobileNumber || 'N/A'}
   Status: ${status}
   Circle: ${circle}
   Amount: ₹${amount.toFixed(2)}
   ${benefit ? `Benefit: ${benefit}` : ''}
   ${reason ? `Error: ${reason}` : ''}
   Transaction ID: ${detail.transactionId || 'N/A'}
   Date: ${detail.date || new Date().toLocaleDateString('en-IN')}

`;
      });
    }

    textContent += `
================================
SUMMARY:
Total Recharges: ${allDetails.length}
Valid: ${validCount}
Invalid: ${invalidCount}
Total Amount: ₹${totalAmount.toFixed(2)}

================================

This is an automated email. Please do not reply to this message.
If you have any questions, please contact support at support@vi.com

© 2024 VI Telecom. All rights reserved.
    `;

    return textContent;
  }

  /**
   * Format recharge details into HTML email body
   * This creates a table similar to the Matched Test Cases table - ONLY with valid benefits
   */
  formatMatchedTableHtml(rechargeDetails, userName = 'Customer', signToken = (id) => id, options = {}) {
    const currentDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });

    const includeActions = options.includeActions !== false;
    const actionNote = includeActions
      ? 'Open this email in an HTML-capable client to use the "Mark as Completed" action buttons.'
      : 'This email contains recharge details only.';

    // Filter out records with no valid benefit for action email
    const filteredDetails = rechargeDetails.filter(d => this.hasValidBenefitValue(d));

    let tableRows = '';
    let totalAmount = 0;

    // Check if any record has a valid benefit
    const hasValidBenefit = filteredDetails.some(d => this.hasValidBenefitValue(d));

    if (Array.isArray(filteredDetails) && filteredDetails.length > 0) {
      filteredDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;

        const status = detail.isValid === true ? 'Valid' : 'Invalid';
        const statusClass = detail.isValid === true ? 'status-valid' : 'status-invalid';
        const statusIcon = detail.isValid === true ? '✅' : '❌';

        const circle = detail.circle || detail.operatorName || 'N/A';
        const benefit = this.hasValidBenefitValue(detail) ? (detail.benefit || detail.planName || 'N/A') : '';

        const confirmUrl = this.buildConfirmUrl(detail, signToken);
        const actionCell = includeActions && detail.isValid === true
          ? `<td style="padding: 10px; text-align: center;"><a href="${confirmUrl}" target="_blank" style="display:inline-block;background-color:#28a745;color:#ffffff;text-decoration:none;padding:6px 12px;border-radius:4px;font-size:12px;font-weight:600;">Mark as Completed</a></td>`
          : '';

        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; text-align: center;">${index + 1}</td>
            <td style="padding: 10px; font-weight: 500;">${detail.mobileNumber || 'N/A'}</td>
            <td style="padding: 10px;"><span class="${statusClass}">${statusIcon} ${status}</span></td>
            <td style="padding: 10px;">${circle}</td>
            <td style="padding: 10px; text-align: right; font-weight: 600;">₹${amount.toFixed(2)}</td>
            ${hasValidBenefit ? `<td style="padding: 10px; font-size: 12px;">${benefit}</td>` : ''}
            ${actionCell}
          </tr>
        `;
      });
    }

    // Determine column count
    const colCount = 5 + (hasValidBenefit ? 1 : 0) + (includeActions ? 1 : 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mobile Recharge Details</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 1100px;
            margin: 20px auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 5px 0 0 0; font-size: 14px; }
          .user-section {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #667eea;
            border-radius: 4px;
          }
          .user-section h3 { margin: 0 0 10px 0; color: #667eea; }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-item { 
            padding: 12px; 
            background-color: #f0f0f0; 
            border-radius: 4px;
            text-align: center;
          }
          .info-item label { 
            font-weight: 600; 
            color: #667eea; 
            display: block; 
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-item value { 
            display: block; 
            margin-top: 5px; 
            font-size: 20px;
            font-weight: 700;
          }
          .info-item value.valid { color: #28a745; }
          .info-item value.invalid { color: #dc3545; }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          thead { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; 
          }
          th { 
            padding: 12px; 
            text-align: left; 
            font-weight: 600; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td { padding: 10px; font-size: 13px; }
          tbody tr:nth-child(even) { background-color: #fafafa; }
          tbody tr:hover { background-color: #f5f5f5; }
          .summary {
            margin-top: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            text-align: right;
          }
          .summary-item { display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; }
          .summary-item.total {
            font-size: 20px;
            font-weight: bold;
            border-top: 2px solid rgba(255, 255, 255, 0.3);
            padding-top: 10px;
            margin-top: 15px;
          }
          .footer {
            margin-top: 30px;
            padding: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .footer p { margin: 5px 0; }
          .status-valid {
            background-color: #d4edda;
            color: #155724;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
          }
          .status-invalid {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
          }
          .section-title {
            color: #667eea;
            margin-top: 30px;
            font-size: 16px;
            font-weight: 600;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
          }
          .no-data {
            text-align: center;
            padding: 20px;
            color: #999;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Valid Vi Numbers</h1>
            <p>Action Required - Mark as Completed</p>
          </div>

          <div class="user-section">
            <p><strong>Generated on:</strong> ${currentDate}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <label>Total Valid Recharges</label>
              <value>${filteredDetails.filter(d => d.isValid === true).length}</value>
            </div>
            <div class="info-item">
              <label>Total Amount</label>
              <value>₹${totalAmount.toFixed(2)}</value>
            </div>
            <div class="info-item">
              <label>Action Required</label>
              <value style="color: #28a745;">${filteredDetails.filter(d => d.isValid === true).length}</value>
            </div>
          </div>

          <div class="section-title">✅ Valid Numbers - Action Required</div>
          <p style="font-size: 13px; color: #666; margin-top: -5px;">
            ${actionNote}
          </p>
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>MSISDN</th>
                  <th>Vi Status</th>
                  <th>Circle</th>
                  <th>Recharge MRP (₹)</th>
                  ${hasValidBenefit ? '<th>Benefit</th>' : ''}
                  ${includeActions ? '<th>Action</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="${colCount}" style="text-align: center; padding: 20px; color: #999;">No recharge details available</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span>Total Valid Recharges:</span>
              <span>${filteredDetails.filter(d => d.isValid === true).length}</span>
            </div>
            <div class="summary-item total">
              <span>Total Amount:</span>
              <span>₹${totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p><strong>VI Automation System</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you have any questions, please contact support at support@vi.com</p>
            <p style="margin-top: 15px; color: #999;">© 2024 VI Telecom. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return htmlContent;
  }

  /**
   * Format Unmatched/Invalid details into HTML email body
   * This creates a table similar to the Unmatched Test Cases table
   */
  formatUnmatchedTableHtml(invalidDetails, userName = 'Customer') {
    const currentDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });

    let tableRows = '';

    if (Array.isArray(invalidDetails) && invalidDetails.length > 0) {
      invalidDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        const circle = detail.circle || detail.operatorName || 'N/A';
        const reason = detail.errorMessage || detail.reason || 'Invalid Vi number';

        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; text-align: center;">${index + 1}</td>
            <td style="padding: 10px; font-weight: 500;">${detail.mobileNumber || 'N/A'}</td>
            <td style="padding: 10px;"><span class="status-invalid">❌ Invalid</span></td>
            <td style="padding: 10px;">${circle}</td>
            <td style="padding: 10px; text-align: right; font-weight: 600; color: #dc3545;">₹${amount.toFixed(2)}</td>
            <td style="padding: 10px; font-size: 12px; color: #dc3545;">${reason}</td>
          </tr>
        `;
      });
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Invalid Vi Numbers Report</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 1100px;
            margin: 20px auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          }
          .header {
            background: linear-gradient(135deg, #dc3545 0%, #c0392b 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            text-align: center;
          }
          .header h1 { margin: 0; font-size: 28px; }
          .header p { margin: 5px 0 0 0; font-size: 14px; }
          .user-section {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #dc3545;
            border-radius: 4px;
          }
          .user-section h3 { margin: 0 0 10px 0; color: #dc3545; }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-item { 
            padding: 12px; 
            background-color: #f0f0f0; 
            border-radius: 4px;
            text-align: center;
          }
          .info-item label { 
            font-weight: 600; 
            color: #dc3545; 
            display: block; 
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .info-item value { 
            display: block; 
            margin-top: 5px; 
            font-size: 20px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          thead { 
            background: linear-gradient(135deg, #dc3545 0%, #c0392b 100%);
            color: white; 
          }
          th { 
            padding: 12px; 
            text-align: left; 
            font-weight: 600; 
            font-size: 12px; 
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          td { padding: 10px; font-size: 13px; }
          tbody tr:nth-child(even) { background-color: #fafafa; }
          tbody tr:hover { background-color: #f5f5f5; }
          .status-invalid {
            background-color: #f8d7da;
            color: #721c24;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            display: inline-block;
          }
          .summary {
            margin-top: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #dc3545 0%, #c0392b 100%);
            color: white;
            border-radius: 8px;
            text-align: right;
          }
          .summary-item { display: flex; justify-content: space-between; margin: 10px 0; font-size: 16px; }
          .summary-item.total {
            font-size: 20px;
            font-weight: bold;
            border-top: 2px solid rgba(255, 255, 255, 0.3);
            padding-top: 10px;
            margin-top: 15px;
          }
          .footer {
            margin-top: 30px;
            padding: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            color: #666;
            font-size: 12px;
          }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Invalid Vi Numbers Report</h1>
            <p>Unmatched Test Cases</p>
          </div>

        
          <div class="user-section">
            <p><strong>Generated on:</strong> ${currentDate}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <label>Total Invalid Numbers</label>
              <value>${invalidDetails.length}</value>
            </div>
            <div class="info-item">
              <label>Total Amount</label>
              <value>₹${invalidDetails.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0).toFixed(2)}</value>
            </div>
          </div>

          <h3 style="color: #dc3545; margin-top: 30px;">Invalid Number Details</h3>
          <p style="font-size: 13px; color: #666; margin-top: -5px;">
            The following numbers were found to be invalid Vi numbers.
          </p>
          <div style="overflow-x: auto;">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>MSISDN</th>
                  <th>Vi Status</th>
                  <th>Circle</th>
                  <th>Recharge MRP (₹)</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">No invalid details available</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span>Total Invalid Numbers:</span>
              <span>${invalidDetails.length}</span>
            </div>
            <div class="summary-item total">
              <span>Total Amount:</span>
              <span>₹${invalidDetails.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0).toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p><strong>VI Automation System</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you have any questions, please contact support at support@vi.com</p>
            <p style="margin-top: 15px; color: #999;">© 2024 VI Telecom. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return htmlContent;
  }

  formatRechargeDetailsText(rechargeDetails, userName = 'Customer', options = {}) {
    const currentDate = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    let textContent = `
MOBILE RECHARGE DETAILS
================================

Dear ${userName},

Please find below the details of your bulk mobile recharges.

Generated on: ${currentDate}

`;

    let totalAmount = 0;
    let validCount = 0;
    let invalidCount = 0;

    if (Array.isArray(rechargeDetails) && rechargeDetails.length > 0) {
      rechargeDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;
        
        if (detail.isValid === true || String(detail.status || '').toLowerCase() === 'success') {
          validCount++;
        } else {
          invalidCount++;
        }
        
        const status = detail.isValid === true ? 'Valid' : 'Invalid';
        const circle = detail.circle || detail.operatorName || 'N/A';
        const benefit = this.hasValidBenefitValue(detail) ? (detail.benefit || detail.planName || 'N/A') : '';
        const reason = detail.errorMessage || detail.reason || '';

        textContent += `
${index + 1}. Mobile: ${detail.mobileNumber || 'N/A'}
   Status: ${status}
   Circle: ${circle}
   Amount: ₹${amount.toFixed(2)}
   ${benefit ? `Benefit: ${benefit}` : ''}
   ${reason ? `Error: ${reason}` : ''}
   Transaction ID: ${detail.transactionId || 'N/A'}
   Date: ${detail.date || new Date().toLocaleDateString('en-IN')}

`;
      });
    }

    textContent += `
================================
SUMMARY:
Total Recharges: ${rechargeDetails.length}
Valid: ${validCount}
Invalid: ${invalidCount}
Total Amount: ₹${totalAmount.toFixed(2)}

================================

This is an automated email. Please do not reply to this message.
If you have any questions, please contact support at support@vi.com

© 2024 VI Telecom. All rights reserved.
    `;

    return textContent;
  }

  /**
   * Send combined email with BOTH valid and invalid data - NO action buttons
   * SHOWS ALL ROWS
   */
  async sendCombinedEmail(recipientEmail, allDetails, validCount, invalidCount, userName = 'Customer', options = {}) {
    try {
      if (!this.transporter) {
        throw new Error('Mail transporter not initialized. Check SMTP configuration.');
      }

      if (!recipientEmail) {
        throw new Error('Recipient email address is required');
      }

      if (!allDetails || allDetails.length === 0) {
        throw new Error('No recharge details available to email.');
      }

      const htmlContent = this.formatCombinedTableHtml(allDetails, validCount, invalidCount, userName, options);
      const textContent = this.formatCombinedText(allDetails, validCount, invalidCount, userName, options);

      const senderEmail = process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';
      const replyToEmail = options.replyTo || process.env.SMTP_REPLY_TO || process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';

      const mailOptions = {
        from: `"VI Automation" <${senderEmail}>`,
        to: recipientEmail,
        subject: options.subject || ` Mobile Recharge Details Report - ${new Date().toLocaleDateString('en-IN')}`,
        text: textContent,
        html: htmlContent,
        cc: options.cc || '',
        bcc: options.bcc || '',
        replyTo: replyToEmail
      };

      console.log('📧 Sending COMBINED email to:', recipientEmail);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Combined email sent to ${recipientEmail}:`, result.messageId);

      return {
        success: true,
        messageId: result.messageId,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString(),
        rechargeCount: allDetails.length
      };

    } catch (error) {
      console.error(`❌ Combined email failed for ${recipientEmail}:`, error.message);
      return {
        success: false,
        error: error.message,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send email with Matched table data (Valid numbers with Action buttons) - ONLY valid benefit records
   */
  async sendMatchedEmail(recipientEmail, rechargeDetails, userName = 'Customer', options = {}, signToken = (id) => id) {
    try {
      if (!this.transporter) {
        throw new Error('Mail transporter not initialized. Check SMTP configuration.');
      }

      if (!recipientEmail) {
        throw new Error('Recipient email address is required');
      }

      // Filter only valid details with valid benefit
      const validDetails = Array.isArray(rechargeDetails)
        ? rechargeDetails.filter((detail) => this.isValidRechargeDetail(detail) && this.hasValidBenefitValue(detail))
        : [];

      if (!validDetails.length) {
        throw new Error('No valid recharge details with benefit available to email.');
      }

      const htmlContent = this.formatMatchedTableHtml(validDetails, userName, signToken, options);
      const textContent = this.formatRechargeDetailsText(validDetails, userName, options);

      const senderEmail = process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';
      const replyToEmail = options.replyTo || process.env.SMTP_REPLY_TO || process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';

      const mailOptions = {
        from: `"VI Automation" <${senderEmail}>`,
        to: recipientEmail,
        subject: options.subject || `✅ Valid Vi Numbers Report (Action Required) - ${new Date().toLocaleDateString('en-IN')}`,
        text: textContent,
        html: htmlContent,
        cc: options.cc || '',
        bcc: options.bcc || '',
        replyTo: replyToEmail
      };

      console.log('📧 Sending MATCHED email to:', recipientEmail);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Matched email sent to ${recipientEmail}:`, result.messageId);

      return {
        success: true,
        messageId: result.messageId,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString(),
        rechargeCount: validDetails.length
      };

    } catch (error) {
      console.error(`❌ Matched email failed for ${recipientEmail}:`, error.message);
      return {
        success: false,
        error: error.message,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send email with Unmatched table data (Invalid numbers with errors)
   */
  async sendUnmatchedEmail(recipientEmail, invalidDetails, userName = 'Customer', options = {}) {
    try {
      if (!this.transporter) {
        throw new Error('Mail transporter not initialized. Check SMTP configuration.');
      }

      if (!recipientEmail) {
        throw new Error('Recipient email address is required');
      }

      // Filter only invalid details
      const invalidOnly = Array.isArray(invalidDetails)
        ? invalidDetails.filter((detail) => !this.isValidRechargeDetail(detail))
        : [];

      if (!invalidOnly.length) {
        throw new Error('No invalid recharge details available to email.');
      }

      const htmlContent = this.formatUnmatchedTableHtml(invalidOnly, userName);
      const textContent = this.formatRechargeDetailsText(invalidOnly, userName, options);

      const senderEmail = process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';
      const replyToEmail = options.replyTo || process.env.SMTP_REPLY_TO || process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';

      const mailOptions = {
        from: `"VI Automation" <${senderEmail}>`,
        to: recipientEmail,
        subject: options.subject || `⚠️ Invalid Vi Numbers Report - ${new Date().toLocaleDateString('en-IN')}`,
        text: textContent,
        html: htmlContent,
        cc: options.cc || '',
        bcc: options.bcc || '',
        replyTo: replyToEmail
      };

      console.log('📧 Sending UNMATCHED email to:', recipientEmail);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Unmatched email sent to ${recipientEmail}:`, result.messageId);

      return {
        success: true,
        messageId: result.messageId,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString(),
        rechargeCount: invalidOnly.length
      };

    } catch (error) {
      console.error(`❌ Unmatched email failed for ${recipientEmail}:`, error.message);
      return {
        success: false,
        error: error.message,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send both emails: One combined (valid + invalid) and one valid only with actions
   */
  async sendCombinedEmails(rechargeDetails, recipientEmail, userName = 'Customer', options = {}, signToken = (id) => id) {
    console.log(`📧 Sending combined emails to: ${recipientEmail}`);
    const results = [];

    // Separate valid and invalid
    const validDetails = Array.isArray(rechargeDetails)
      ? rechargeDetails.filter((detail) => this.isValidRechargeDetail(detail))
      : [];
    const invalidDetails = Array.isArray(rechargeDetails)
      ? rechargeDetails.filter((detail) => !this.isValidRechargeDetail(detail))
      : [];

    // EMAIL 1: Combined email with BOTH valid and invalid - NO action buttons (SHOW ALL ROWS)
    const allDetails = [...validDetails, ...invalidDetails];
    if (allDetails.length > 0) {
      console.log(`📤 Sending COMBINED email (${allDetails.length} total: ${validDetails.length} valid, ${invalidDetails.length} invalid) to: ${recipientEmail}`);
      const result = await this.sendCombinedEmail(
        recipientEmail,
        allDetails,
        validDetails.length,
        invalidDetails.length,
        userName,
        Object.assign({}, options, { includeActions: false })
      );
      results.push({ type: 'combined', result });
    }

    // EMAIL 2: Only valid numbers with ACTION buttons (only those with valid benefit)
    if (validDetails.length > 0) {
      const validWithBenefit = validDetails.filter(d => this.hasValidBenefitValue(d));
      if (validWithBenefit.length > 0) {
        console.log(`📤 Sending MATCHED email (${validWithBenefit.length} valid numbers with benefit) to: ${recipientEmail}`);
        const result = await this.sendMatchedEmail(
          recipientEmail,
          validWithBenefit,
          userName,
          Object.assign({}, options, { includeActions: true }),
          signToken
        );
        results.push({ type: 'matched', result });
      } else {
        console.log(`⚠️ No valid numbers with benefit for ${recipientEmail}`);
      }
    }

    return {
      success: results.every(r => r.result && r.result.success),
      results
    };
  }

  // Legacy method for backward compatibility
  async sendRechargeDetailsEmail(recipientEmail, rechargeDetails, userName = 'Customer', options = {}, signToken = (id) => id) {
    return this.sendCombinedEmails(rechargeDetails, recipientEmail, userName, options, signToken);
  }

  async sendFormalRechargeEmail(recipientEmail, rechargeDetails, userName = 'Customer', options = {}, signToken = (id) => id) {
    return this.sendMatchedEmail(
      recipientEmail,
      rechargeDetails,
      userName,
      Object.assign({}, options, { includeActions: false }),
      signToken
    );
  }

  async sendDualStatusEmails(rechargeDetails, actionRecipient, formalRecipient, userName = 'Customer', options = {}, signToken = (id) => id) {
    console.log("📧 Sending dual status emails...");
    const results = [];

    if (actionRecipient) {
      console.log(`📤 Sending ACTION email to: ${actionRecipient}`);
      results.push(await this.sendCombinedEmails(
        rechargeDetails,
        actionRecipient,
        userName,
        Object.assign({}, options, { includeActions: true }),
        signToken
      ));
    }

    if (formalRecipient) {
      console.log(`📤 Sending FORMAL email to: ${formalRecipient}`);
      results.push(await this.sendCombinedEmails(
        rechargeDetails,
        formalRecipient,
        userName,
        Object.assign({}, options, { includeActions: false }),
        signToken
      ));
    }

    return {
      success: results.every(r => r.success),
      results
    };
  }

  async sendBulkRechargeEmails(recipients, signToken = (id) => id) {
    try {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('Recipients array is required and must not be empty');
      }

      const results = [];

      for (const recipient of recipients) {
        const result = await this.sendCombinedEmails(
          recipient.rechargeDetails || [],
          recipient.email,
          recipient.userName || 'Customer',
          recipient.options || {},
          signToken
        );
        results.push(result);

        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`Bulk email sending completed: ${successCount}/${results.length} successful`);

      return {
        success: successCount === results.length,
        totalRecipients: results.length,
        successCount: successCount,
        failedCount: results.length - successCount,
        results: results,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Bulk email sending failed:', error.message);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Mail transporter not initialized');
      }
      await this.transporter.verify();
      return {
        success: true,
        message: 'SMTP connection is working correctly',
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('SMTP connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        host: process.env.MAIL_HOST,
        port: process.env.MAIL_PORT,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new MailService();