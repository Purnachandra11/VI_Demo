const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

/**
 * Mail Service for sending bulk emails with recharge details
 * Supports SMTP configuration from environment variables
 */

class MailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Initialize email transporter with SMTP configuration
   */
  initializeTransporter() {
    try {
      const mailHost = process.env.MAIL_HOST || 'qdegrees.icewarpcloud.in';
      const mailPortRaw = process.env.MAIL_PORT ||'587';
      const mailPort = parseInt(mailPortRaw, 10) || 587;

      const mailEncryption = (process.env.MAIL_ENCRYPTION || '').toLowerCase();
      const smtpSecure = mailEncryption === 'ssl' ? true : false; // TLS => secure:false

      const mailUsername = process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';
      const mailPassword = process.env.MAIL_PASSWORD || process.env.SMTP_PASS || 'Jaipur@2024';

      const smtpConfig = {
        host: mailHost,
        port: mailPort,
        secure: process.env.SMTP_SECURE === 'true' ? true : smtpSecure, // TLS=false, SSL=true (unless SMTP_SECURE explicitly overrides)
        auth: {
          user: mailUsername,
          pass: mailPassword
        }
      };

      this.transporter = nodemailer.createTransport(smtpConfig);
      
      // Verify connection
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

  /**
   * Format recharge details into HTML email body
   * @param {Array} rechargeDetails - Array of recharge detail objects
   * @param {String} userName - Name of the user
   * @returns {String} HTML formatted email body
   */
  formatRechargeDetailsHtml(rechargeDetails, userName = 'Customer') {
    const currentDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });

    let tableRows = '';
    let totalAmount = 0;

    if (Array.isArray(rechargeDetails) && rechargeDetails.length > 0) {
      rechargeDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;

        tableRows += `
          <tr style="border-bottom: 1px solid #ddd;">
            <td style="padding: 10px; text-align: center;">${index + 1}</td>
            <td style="padding: 10px;">${detail.mobileNumber || 'N/A'}</td>
            <td style="padding: 10px;">${detail.operatorName || 'N/A'}</td>
            <td style="padding: 10px;">${detail.planName || 'N/A'}</td>
            <td style="padding: 10px; text-align: right;">₹${amount.toFixed(2)}</td>
            <td style="padding: 10px;">${detail.status || 'Pending'}</td>
            <td style="padding: 10px;">${detail.transactionId || 'N/A'}</td>
            <td style="padding: 10px;">${detail.date || new Date().toLocaleDateString('en-IN')}</td>
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
            max-width: 1000px;
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
          .header h1 {
            margin: 0;
            font-size: 28px;
          }
          .header p {
            margin: 5px 0 0 0;
            font-size: 14px;
          }
          .user-section {
            margin-bottom: 20px;
            padding: 15px;
            background-color: #f9f9f9;
            border-left: 4px solid #667eea;
            border-radius: 4px;
          }
          .user-section h3 {
            margin: 0 0 10px 0;
            color: #667eea;
          }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 20px;
          }
          .info-item {
            padding: 10px;
            background-color: #f0f0f0;
            border-radius: 4px;
          }
          .info-item label {
            font-weight: 600;
            color: #667eea;
            display: block;
            font-size: 12px;
          }
          .info-item value {
            display: block;
            margin-top: 5px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          }
          thead {
            background-color: #667eea;
            color: white;
          }
          th {
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
          }
          td {
            padding: 10px;
            font-size: 13px;
          }
          tbody tr:hover {
            background-color: #f9f9f9;
          }
          tbody tr:nth-child(even) {
            background-color: #fafafa;
          }
          .summary {
            margin-top: 30px;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border-radius: 8px;
            text-align: right;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-size: 16px;
          }
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
          .footer p {
            margin: 5px 0;
          }
          .success-badge {
            display: inline-block;
            background-color: #28a745;
            color: white;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 12px;
            margin-left: 10px;
          }
          .status-pending {
            background-color: #ffc107;
            color: #333;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-success {
            background-color: #28a745;
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
          }
          .status-failed {
            background-color: #dc3545;
            color: white;
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📱 Mobile Recharge Details</h1>
            <p>Bulk Recharge Report</p>
          </div>

          <div class="user-section">
            <h3>👤 Customer Information</h3>
            <p><strong>Name:</strong> ${userName}</p>
            <p><strong>Generated on:</strong> ${currentDate}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <label>Total Recharges</label>
              <value>${rechargeDetails.length}</value>
            </div>
            <div class="info-item">
              <label>Total Amount</label>
              <value>₹${totalAmount.toFixed(2)}</value>
            </div>
          </div>

          <h3 style="color: #667eea; margin-top: 30px;">Recharge Details</h3>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Mobile Number</th>
                <th>Operator</th>
                <th>Plan Name</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Transaction ID</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows || '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #999;">No recharge details available</td></tr>'}
            </tbody>
          </table>

          <div class="summary">
            <div class="summary-item">
              <span>Total Recharges:</span>
              <span>${rechargeDetails.length}</span>
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
   * Format plain text email body (fallback for clients that don't support HTML)
   * @param {Array} rechargeDetails - Array of recharge detail objects
   * @param {String} userName - Name of the user
   * @returns {String} Plain text formatted email body
   */
  formatRechargeDetailsText(rechargeDetails, userName = 'Customer') {
    const currentDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata'
    });

    let textContent = `
MOBILE RECHARGE DETAILS
================================

Dear ${userName},

Please find below the details of your bulk mobile recharges:

Generated on: ${currentDate}

`;

    let totalAmount = 0;

    if (Array.isArray(rechargeDetails) && rechargeDetails.length > 0) {
      rechargeDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;

        textContent += `
${index + 1}. Mobile: ${detail.mobileNumber || 'N/A'}
   Operator: ${detail.operatorName || 'N/A'}
   Plan: ${detail.planName || 'N/A'}
   Amount: ₹${amount.toFixed(2)}
   Status: ${detail.status || 'Pending'}
   Transaction ID: ${detail.transactionId || 'N/A'}
   Date: ${detail.date || new Date().toLocaleDateString('en-IN')}

`;
      });
    }

    textContent += `
================================
SUMMARY:
Total Recharges: ${rechargeDetails.length}
Total Amount: ₹${totalAmount.toFixed(2)}

================================

This is an automated email. Please do not reply to this message.
If you have any questions, please contact support at support@vi.com

© 2024 VI Telecom. All rights reserved.
    `;

    return textContent;
  }

  /**
   * Send bulk recharge details email to a single user
   * @param {String} recipientEmail - Email address of the recipient
   * @param {Array} rechargeDetails - Array of recharge detail objects
   * @param {String} userName - Name of the user
   * @param {Object} options - Additional options (subject, cc, bcc, etc.)
   * @returns {Promise} - Email sending result
   */
  async sendRechargeDetailsEmail(recipientEmail, rechargeDetails, userName = 'Customer', options = {}) {
    try {
      if (!this.transporter) {
        throw new Error('Mail transporter not initialized. Check SMTP configuration.');
      }

      if (!recipientEmail) {
        throw new Error('Recipient email address is required');
      }

      const htmlContent = this.formatRechargeDetailsHtml(rechargeDetails, userName);
      const textContent = this.formatRechargeDetailsText(rechargeDetails, userName);

      const mailOptions = {
        to: recipientEmail,
        subject: options.subject || `Mobile Recharge Details Report - ${new Date().toLocaleDateString('en-IN')}`,
        text: textContent,
        html: htmlContent,
        cc: options.cc || '',
        bcc: options.bcc || '',
        replyTo: options.replyTo || process.env.SMTP_REPLY_TO || process.env.SMTP_USER
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      console.log(`Mail sent successfully to ${recipientEmail}:`, result.messageId);
      
      return {
        success: true,
        messageId: result.messageId,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString(),
        rechargeCount: Array.isArray(rechargeDetails) ? rechargeDetails.length : 0
      };

    } catch (error) {
      console.error(`Mail sending failed for ${recipientEmail}:`, error.message);
      return {
        success: false,
        error: error.message,
        recipientEmail: recipientEmail,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send bulk recharge details emails to multiple users
   * @param {Array} recipients - Array of recipient objects {email, userName, rechargeDetails}
   * @returns {Promise} - Array of sending results
   */
  async sendBulkRechargeEmails(recipients) {
    try {
      if (!Array.isArray(recipients) || recipients.length === 0) {
        throw new Error('Recipients array is required and must not be empty');
      }

      const results = [];

      for (const recipient of recipients) {
        const result = await this.sendRechargeDetailsEmail(
          recipient.email,
          recipient.rechargeDetails || [],
          recipient.userName || 'Customer',
          recipient.options || {}
        );
        results.push(result);

        // Add delay between emails to avoid rate limiting
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

  /**
   * Test SMTP connection
   * @returns {Promise} - Connection test result
   */
  async testConnection() {
    try {
      if (!this.transporter) {
        throw new Error('Mail transporter not initialized');
      }

      await this.transporter.verify();
      return {
        success: true,
        message: 'SMTP connection is working correctly',
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('SMTP connection test failed:', error.message);
      return {
        success: false,
        error: error.message,
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Send test email to verify configuration
   * @param {String} testEmail - Email address to send test email to
   * @returns {Promise} - Test email result
   */
  async sendTestEmail(testEmail) {
    try {
      if (!testEmail) {
        throw new Error('Test email address is required');
      }

      const mailOptions = {
        from: `"VI Automation - Test" <${process.env.SMTP_USER}>`,
        to: testEmail,
        subject: 'VI Automation - SMTP Configuration Test',
        html: `
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4; border-radius: 8px;">
                <h2 style="color: #667eea; margin-bottom: 20px;">✅ SMTP Configuration Test</h2>
                <p>Hello,</p>
                <p>This is a test email to verify that your SMTP configuration is working correctly.</p>
                <div style="background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #667eea;">
                  <p><strong>Test Details:</strong></p>
                  <p>Sent on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</p>
                  <p>Status: <span style="color: #28a745; font-weight: bold;">✓ Success</span></p>
                </div>
                <p>You can now use the mail API to send bulk recharge details emails.</p>
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #999; font-size: 12px;">
                  <p>© 2024 VI Automation System</p>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `SMTP Configuration Test - Success\n\nSent on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\nYou can now use the mail API.`
      };

      const result = await this.transporter.sendMail(mailOptions);
      
      return {
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId,
        testEmail: testEmail,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('Test email sending failed:', error.message);
      return {
        success: false,
        error: error.message,
        testEmail: testEmail,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
module.exports = new MailService();
