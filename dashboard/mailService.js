const nodemailer = require('nodemailer');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });


class MailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Check if email service is enabled
   */
  isEmailEnabled() {
    return process.env.MAIL_ENABLED !== 'false';
  }

  initializeTransporter() {
    try {
      if (!this.isEmailEnabled()) {
        console.log('📧 Email service is disabled. Skipping SMTP transporter initialization.');
        this.transporter = null;
        return;
      }

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


  // buildConfirmUrl(detail, signToken) {
  //   const baseUrl = process.env.APP_BASE_URL || 'http://localhost:5174';
  //   const txnId = encodeURIComponent(detail.transactionId || '');
  //   const token = signToken(detail.transactionId);
  //   return `${baseUrl}/recharge/confirm/${txnId}?token=${token}`;
  // }

//   buildConfirmUrl(detail, signToken) {
//     const baseUrl = 'http://localhost:5174';
//     const txnId = encodeURIComponent(detail.transactionId || '');
//     const token = signToken(detail.transactionId);

//     // Register this transaction's details in the in-memory store so the
//     // /recharge/confirm/:txnId page on server.js can show the right
//     // mobile number/amount and pass it to the Vi recharge site.
//     if (global.pendingRecharges && detail.transactionId) {
//       global.pendingRecharges.set(detail.transactionId, {
//         mobileNumber: detail.mobileNumber || '',
//         amount: detail.amount || 0,
//         benefit: detail.benefit || detail.planName || '',
//         confirmed: false
//       });
//     }

//     return `${baseUrl}/recharge/confirm/${txnId}?token=${token}`;
// }

buildConfirmUrl(detail, signToken) {
    const baseUrl = 'http://localhost:5174';
    const txnId = encodeURIComponent(detail.transactionId || '');
    const token = signToken(detail.transactionId);

    if (global.pendingRecharges && detail.transactionId) {
      global.pendingRecharges.set(detail.transactionId, {
        mobileNumber: detail.mobileNumber || '',
        amount: detail.amount || 0,
        benefit: detail.benefit || detail.planName || '',
        circle: detail.circle || detail.operatorName || '',
        srNo: detail.srNo || detail.index || '',
        viStatus: detail.isValid === true ? 'Valid Vi' : 'Invalid',
        confirmed: false
      });
    }

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
    const validItems = allDetails.filter(d => d.isValid === true && !d.isMismatch);
    const invalidItems = allDetails.filter(d => d.isValid === false || d.isMismatch);
    const sortedDetails = [...validItems, ...invalidItems];

    // Check if any record has a valid benefit (for showing the column)
    const hasValidBenefit = sortedDetails.some(d => this.hasValidBenefitValue(d));

    if (Array.isArray(sortedDetails) && sortedDetails.length > 0) {
      sortedDetails.forEach((detail, index) => {
        const amount = parseFloat(detail.amount || 0);
        totalAmount += amount;

        const isViValid = detail.isValid === true && !detail.isMismatch;
        const status = isViValid ? 'Valid' : detail.isMismatch ? 'Mismatch' : 'Invalid';
        const statusClass = isViValid ? 'yes' : 'no';
        const statusIcon = isViValid ? '✅' : '❌';
        const mrpClass = isViValid ? 'mrp-highlight-input' : 'mrp-highlight-no';

        const circle = detail.circle || detail.operatorName || '—';
        const actualCircle = detail.actualCircle || '—';
        // For combined email, show benefit if exists, otherwise show empty
        const benefit = this.hasValidBenefitValue(detail) ? `<span class="benefit-tag">${detail.benefit || detail.planName || '—'}</span>` : '';
        const reason = detail.errorMessage || detail.reason || '';

        tableRows += `
          <tr>
            <td>${index + 1}</td>
            <td><code style="font-size:12px;">${detail.mobileNumber || '—'}</code></td>
            <td><span class="match-chip ${statusClass}" title="${detail.viStatus || status}">${statusIcon} ${detail.viStatus || status}</span></td>
            <td>${circle}</td>
            <td>${actualCircle}</td>
            <td><span class="${mrpClass}">₹${amount.toFixed(2)}</span></td>
            ${hasValidBenefit ? `<td>${benefit}</td>` : ''}
            <td>
  ${
    (!isViValid || detail.isMismatch)
      ? `<span class="match-chip no"
            style="white-space:normal;text-align:left;line-height:1.5;">
            ${reason}
         </span>`
      : '—'
  }
</td>
          </tr>
        `;
      });
    }

    // Determine column count
    const hasInvalid = invalidCount > 0;
    // const colCount = 6 + (hasValidBenefit ? 1 : 0) + (hasInvalid ? 1 : 0);
    const colCount = 7 + (hasValidBenefit ? 1 : 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Mobile Recharge Details Valid & Invalid Numbers</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --accent: #f38328;
            --accent-dark: #d96f1a;
            --bg: #f5f0eb;
            --card-bg: #ffffff;
            --text-dark: #2e2a27;
            --text-muted: #6f6b67;
            --orange: #f38328;
            --orange-dk: #d96b10;
            --brown: #865940;
            --brown-lt: #c2966e;
            --cream: #fdf8f3;
            --cream-dk: #f5ede2;
            --text: #2e2319;
            --muted: #6f5c4a;
            --border: #e8ddd2;
            --white: #ffffff;
            --success: #2e7d32;
            --success-bg: #e8f5e9;
            --danger: #c0392b;
            --danger-bg: #fdecea;
            --info: #1565c0;
            --info-bg: #e3f2fd;
            --radius: 16px;
            --radius-sm: 10px;
            --shadow: 0 8px 32px rgba(100, 60, 20, 0.10);
            --shadow-sm: 0 2px 8px rgba(100, 60, 20, 0.06);
          }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 24px;
            line-height: 1.5;
          }
          .wrapper {
            max-width: 1100px;
            margin: 0 auto;
          }
          .header {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 32px 28px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: var(--shadow);
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: var(--orange);
            border-radius: var(--radius) var(--radius) 0 0;
          }
          .header h1 {
            margin: 0 0 8px 0;
            font-size: 26px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.3px;
          }
          .header p {
            margin: 0;
            font-size: 14px;
            color: var(--muted);
          }
          .header .meta {
            margin-top: 12px;
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 500;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-bottom: 20px;
          }
          .info-item {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 18px 14px;
            text-align: center;
            box-shadow: var(--shadow-sm);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .info-item:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
          }
          .info-item label {
            font-weight: 700;
            color: var(--orange);
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 6px;
          }
          .info-item value {
            display: block;
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
          }
          .info-item value.valid { color: var(--success); }
          .info-item value.invalid { color: var(--danger); }
          .ptable-wrap {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
            margin-bottom: 10px;
            overflow-x: auto;
          }
          .ptable {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 13px;
            table-layout: fixed;
          }
          .ptable thead tr {
            background: var(--orange);
            color: var(--white);
          }
          .ptable thead th {
            padding: 10px 12px;
            font-weight: 600;
            text-align: center;
            white-space: nowrap;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            vertical-align: middle;
          }
          .ptable thead th:first-child { border-radius: var(--radius-sm) 0 0 0; width: 40px; }
          .ptable thead th:last-child { border-radius: 0 var(--radius-sm) 0 0; }
          .ptable thead th:nth-child(2) { width: 110px; }
          .ptable thead th:nth-child(3) { width: 90px; }
          .ptable thead th:nth-child(4) { width: 60px; }
          .ptable thead th:nth-child(5) { width: 110px; }
          .ptable thead th:nth-child(6) { width: 100px; }
          .ptable tbody tr {
            border-bottom: 1px solid var(--border);
            transition: background 0.15s;
          }
          .ptable tbody tr:last-child { border-bottom: none; }
          .ptable tbody tr:last-child td:first-child { border-radius: 0 0 0 var(--radius-sm); }
          .ptable tbody tr:last-child td:last-child { border-radius: 0 0 var(--radius-sm) 0; }
          .ptable tbody tr:hover { background: var(--cream); }
          .ptable tbody td {
            padding: 10px 12px;
            color: var(--muted);
            vertical-align: middle;
            border-bottom: 1px solid var(--border);
            text-align: center;
          }
          .ptable tbody tr:last-child td { border-bottom: none; }
          .ptable tbody td:first-child {
            color: var(--text);
            font-weight: 700;
            font-size: 12px;
            text-align: center;
            width: 40px;
          }
          .ptable tbody td:nth-child(2) { text-align: center; width: 110px; }
          .ptable tbody td:nth-child(3) { text-align: center; width: 90px; }
          .ptable tbody td:nth-child(4) { text-align: center; width: 60px; }
          .ptable tbody td:nth-child(5) { text-align: center; width: 110px; }
          .ptable tbody td:nth-child(6) { text-align: center; width: 100px; }
          .ptable tbody td:nth-child(7) { text-align: left; }
          .ptable tbody td:last-child { text-align: left; }
          .match-chip {
            
            
            
            white-space:normal;text-align:left;line-height:1.5
          }
          .match-chip.yes {
            background: var(--success-bg);
            color: var(--success);
          }
          .match-chip.no {
            background: var(--danger-bg);
            color: var(--danger);
          }
          .benefit-tag {
            background: var(--info-bg);
            color: var(--info);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            font-family: 'Courier New', monospace;
            display: inline-block;
            max-width: 220px;
            word-break: break-word;
            line-height: 1.5;
            text-align: left;
          }
          .mrp-highlight-input {
            color: var(--orange);
            font-weight: 700;
            font-size: 13px;
            white-space: nowrap;
          }
          .mrp-highlight-no {
            color: var(--danger);
            font-weight: 700;
            font-size: 13px;
            white-space: nowrap;
          }
          .summary {
            margin-top: 24px;
            padding: 24px;
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            text-align: right;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 15px;
            color: var(--muted);
            font-weight: 500;
          }
          .summary-item.total {
            font-size: 20px;
            font-weight: 700;
            color: var(--text);
            border-top: 2px solid var(--border);
            padding-top: 12px;
            margin-top: 12px;
          }
          .summary-item.total span:last-child {
            color: var(--orange);
          }
          @media (max-width: 640px) {
            .info-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 20px; }
            body { padding: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>Mobile Recharge Details</h1>
            <p>Complete Report — Valid & Invalid Numbers</p>
            <p class="meta">Generated on: ${currentDate}</p>
          </div>

          <div class="ptable-wrap">
            <table class="ptable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>MSISDN</th>
                  <th>Vi Status</th>
                  <th>Circle</th>
                  <th>Actual Circle</th>
                  <th>Recharge MRP (₹)</th>
                  ${hasValidBenefit ? '<th>Benefit</th>' : ''}
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="${colCount}" style="text-align:center; padding:30px; color:var(--muted);">No recharge details available</td></tr>`}
              </tbody>
            </table>
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
If you have any questions, please contact support at noreply-all@qdegrees.org

© 2026 VI Telecom. All rights reserved.
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

        const isViValid = detail.isValid === true && !detail.isMismatch;
        const status = isViValid ? 'Valid' : 'Invalid';
        const statusClass = isViValid ? 'yes' : 'no';
        const statusIcon = isViValid ? '✅' : '❌';

        const circle = detail.circle || detail.operatorName || '—';
        const actualCircle = detail.actualCircle || '—';
        const benefit = this.hasValidBenefitValue(detail) ? `<span class="benefit-tag">${detail.benefit || detail.planName || '—'}</span>` : '';

        const confirmUrl = this.buildConfirmUrl(detail, signToken);

        let actionCell = '';
        if (includeActions && detail.isValid === true) {
          if (detail.rechargeRequired) {
            actionCell = `<td style="text-align:center;"><a href="${confirmUrl}" target="_blank" style="display:inline-block;background-color:var(--success);color:#ffffff;text-decoration:none;padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(46,125,50,0.25);transition:all 0.2s;">Mark as Completed</a></td>`;
          } else {
            actionCell = `<td style="text-align:center;"><span style="display:inline-block;background-color:var(--danger-bg);color:var(--danger);padding:8px 14px;border-radius:6px;font-size:12px;font-weight:600;">Recharge Not Required</span></td>`;
          }
        }

        tableRows += `
          <tr>
            <td>${index + 1}</td>
            <td><code style="font-size:12px;">${detail.mobileNumber || '—'}</code></td>
            <td><span class="match-chip ${statusClass}" title="${detail.viStatus || status}">${statusIcon} ${detail.viStatus || status}</span></td>
            <td>${circle}</td>
            <td>${actualCircle}</td>
            <td><span class="mrp-highlight-input">₹${amount.toFixed(2)}</span></td>
            ${hasValidBenefit ? `<td>${benefit}</td>` : ''}
            ${actionCell}
          </tr>
        `;
      });
    }

    // Determine column count
    const colCount = 6 + (hasValidBenefit ? 1 : 0) + (includeActions ? 1 : 0);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Valid Vi Numbers</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --accent: #f38328;
            --accent-dark: #d96f1a;
            --bg: #f5f0eb;
            --card-bg: #ffffff;
            --text-dark: #2e2a27;
            --text-muted: #6f6b67;
            --orange: #f38328;
            --orange-dk: #d96b10;
            --brown: #865940;
            --brown-lt: #c2966e;
            --cream: #fdf8f3;
            --cream-dk: #f5ede2;
            --text: #2e2319;
            --muted: #6f5c4a;
            --border: #e8ddd2;
            --white: #ffffff;
            --success: #2e7d32;
            --success-bg: #e8f5e9;
            --danger: #c0392b;
            --danger-bg: #fdecea;
            --info: #1565c0;
            --info-bg: #e3f2fd;
            --radius: 16px;
            --radius-sm: 10px;
            --shadow: 0 8px 32px rgba(100, 60, 20, 0.10);
            --shadow-sm: 0 2px 8px rgba(100, 60, 20, 0.06);
          }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 24px;
            line-height: 1.5;
          }
          .wrapper {
            max-width: 1100px;
            margin: 0 auto;
          }
          .header {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 32px 28px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: var(--shadow);
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: var(--orange);
            border-radius: var(--radius) var(--radius) 0 0;
          }
          .header h1 {
            margin: 0 0 8px 0;
            font-size: 26px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.3px;
          }
          .header p {
            margin: 0;
            font-size: 14px;
            color: var(--muted);
          }
          .header .meta {
            margin-top: 12px;
            font-size: 12px;
            color: var(--text-muted);
            font-weight: 500;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-bottom: 20px;
          }
          .info-item {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 18px 14px;
            text-align: center;
            box-shadow: var(--shadow-sm);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .info-item:hover {
            transform: translateY(-2px);
            box-shadow: var(--shadow);
          }
          .info-item label {
            font-weight: 700;
            color: var(--orange);
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 6px;
          }
          .info-item value {
            display: block;
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
          }
          .info-item value.valid { color: var(--success); }
          .section-title {
            color: var(--text);
            margin: 28px 0 12px 0;
            font-size: 16px;
            font-weight: 700;
            border-bottom: 2px solid var(--orange);
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-note {
            font-size: 13px;
            color: var(--muted);
            margin: -4px 0 14px 0;
            font-weight: 500;
          }
          .ptable-wrap {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
            margin-bottom: 10px;
            overflow-x: auto;
          }
          .ptable {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 13px;
            table-layout: fixed;
          }
          .ptable thead tr {
            background: var(--orange);
            color: var(--white);
          }
          .ptable thead th {
            padding: 10px 12px;
            font-weight: 600;
            text-align: center;
            white-space: nowrap;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            vertical-align: middle;
          }
          .ptable thead th:first-child { border-radius: var(--radius-sm) 0 0 0; width: 40px; }
          .ptable thead th:last-child { border-radius: 0 var(--radius-sm) 0 0; }
          .ptable thead th:nth-child(2) { width: 110px; }
          .ptable thead th:nth-child(3) { width: 90px; }
          .ptable thead th:nth-child(4) { width: 60px; }
          .ptable thead th:nth-child(5) { width: 110px; }
          .ptable thead th:nth-child(6) { width: 100px; }
          .ptable tbody tr {
            border-bottom: 1px solid var(--border);
            transition: background 0.15s;
          }
          .ptable tbody tr:last-child { border-bottom: none; }
          .ptable tbody tr:last-child td:first-child { border-radius: 0 0 0 var(--radius-sm); }
          .ptable tbody tr:last-child td:last-child { border-radius: 0 0 var(--radius-sm) 0; }
          .ptable tbody tr:hover { background: var(--cream); }
          .ptable tbody td {
            padding: 10px 12px;
            color: var(--muted);
            vertical-align: middle;
            border-bottom: 1px solid var(--border);
            text-align: center;
          }
          .ptable tbody tr:last-child td { border-bottom: none; }
          .ptable tbody td:first-child {
            color: var(--text);
            font-weight: 700;
            font-size: 12px;
            text-align: center;
            width: 40px;
          }
          .ptable tbody td:nth-child(2) { text-align: center; width: 110px; }
          .ptable tbody td:nth-child(3) { text-align: center; width: 90px; }
          .ptable tbody td:nth-child(4) { text-align: center; width: 60px; }
          .ptable tbody td:nth-child(5) { text-align: center; width: 110px; }
          .ptable tbody td:nth-child(6) { text-align: center; width: 100px; }
          .ptable tbody td:nth-child(7) { text-align: left; }
          .ptable tbody td:last-child { text-align: center; }
          .match-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
          }
          .match-chip.yes {
            background: var(--success-bg);
            color: var(--success);
          }
          .match-chip.no {
            background: var(--danger-bg);
            color: var(--danger);
          }
          .benefit-tag {
            background: var(--info-bg);
            color: var(--info);
            padding: 6px 10px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            font-family: 'Courier New', monospace;
            display: inline-block;
            max-width: 220px;
            word-break: break-word;
            line-height: 1.5;
            text-align: left;
          }
          .mrp-highlight-input {
            color: var(--orange);
            font-weight: 700;
            font-size: 13px;
            white-space: nowrap;
          }
          .summary {
            margin-top: 24px;
            padding: 24px;
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            text-align: right;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 15px;
            color: var(--muted);
            font-weight: 500;
          }
          .summary-item.total {
            font-size: 20px;
            font-weight: 700;
            color: var(--text);
            border-top: 2px solid var(--border);
            padding-top: 12px;
            margin-top: 12px;
          }
          .summary-item.total span:last-child {
            color: var(--orange);
          }
          @media (max-width: 640px) {
            .info-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 20px; }
            body { padding: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>Valid Vi Numbers</h1>
            <p>Action Required — Mark as Completed</p>
            <p class="meta">Generated on: ${currentDate}</p>
          </div>

          <div class="info-grid">
            <div class="info-item">
              <label>Total Valid Recharges</label>
              <value class="valid">${filteredDetails.filter(d => d.isValid === true).length}</value>
            </div>
            <div class="info-item">
              <label>Total Amount</label>
              <value>₹${totalAmount.toFixed(2)}</value>
            </div>
            <div class="info-item">
              <label>Action Required</label>
              <value class="valid">${filteredDetails.filter(d => d.isValid === true && d.rechargeRequired).length}</value>
            </div>
          </div>

          <div class="section-title"> Valid Numbers — Action Required</div>
          <p class="section-note">${actionNote}</p>

          <div class="ptable-wrap">
            <table class="ptable">
              <thead>
                <tr>
                  <th>#</th>
                  <th>MSISDN</th>
                  <th>Vi Status</th>
                  <th>Circle</th>
                  <th>Actual Circle</th>
                  <th>Recharge MRP (₹)</th>
                  ${hasValidBenefit ? '<th>Benefit</th>' : ''}
                  ${includeActions ? '<th>Action</th>' : ''}
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="${colCount}" style="text-align:center; padding:30px; color:var(--muted);">No recharge details available</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span>Total Valid Recharges</span>
              <span>${filteredDetails.filter(d => d.isValid === true).length}</span>
            </div>
            <div class="summary-item total">
              <span>Total Amount</span>
              <span>₹${totalAmount.toFixed(2)}</span>
            </div>
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
          <tr>
            <td>${index + 1}</td>
            <td><code style="font-size:12px;">${detail.mobileNumber || 'N/A'}</code></td>
            <td><span class="match-chip no">❌ Invalid</span></td>
            <td>${circle}</td>
            <td><span class="mrp-highlight-no">₹${amount.toFixed(2)}</span></td>
            <td><span class="reason-text">${reason}</span></td>
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
          * { box-sizing: border-box; margin: 0; padding: 0; }
          :root {
            --bg: #f5f0eb;
            --text: #2e2319;
            --muted: #6f5c4a;
            --border: #e8ddd2;
            --white: #ffffff;
            --danger: #c0392b;
            --danger-bg: #fdecea;
            --radius: 16px;
            --radius-sm: 10px;
            --shadow: 0 8px 32px rgba(100, 60, 20, 0.10);
            --shadow-sm: 0 2px 8px rgba(100, 60, 20, 0.06);
          }
          body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 24px;
            line-height: 1.5;
          }
          .wrapper {
            max-width: 1100px;
            margin: 0 auto;
          }
          .header {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            padding: 32px 28px;
            margin-bottom: 20px;
            text-align: center;
            box-shadow: var(--shadow);
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: 0; left: 0; right: 0;
            height: 4px;
            background: var(--danger);
            border-radius: var(--radius) var(--radius) 0 0;
          }
          .header h1 {
            margin: 0 0 8px 0;
            font-size: 26px;
            font-weight: 700;
            color: var(--text);
            letter-spacing: -0.3px;
          }
          .header p {
            margin: 0;
            font-size: 14px;
            color: var(--muted);
          }
          .header .meta {
            margin-top: 12px;
            font-size: 12px;
            color: var(--muted);
            font-weight: 500;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 14px;
            margin-bottom: 20px;
          }
          .info-item {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius-sm);
            padding: 18px 14px;
            text-align: center;
            box-shadow: var(--shadow-sm);
          }
          .info-item label {
            font-weight: 700;
            color: var(--danger);
            display: block;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.6px;
            margin-bottom: 6px;
          }
          .info-item value {
            display: block;
            font-size: 22px;
            font-weight: 700;
            color: var(--text);
          }
          .section-title {
            color: var(--text);
            margin: 28px 0 12px 0;
            font-size: 16px;
            font-weight: 700;
            border-bottom: 2px solid var(--danger);
            padding-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
          }
          .section-note {
            font-size: 13px;
            color: var(--muted);
            margin: -4px 0 14px 0;
            font-weight: 500;
          }
          .ptable-wrap {
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
            margin-bottom: 10px;
            overflow-x: auto;
          }
          .ptable {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            font-size: 13px;
            table-layout: fixed;
          }
          .ptable thead tr {
            background: var(--danger);
            color: var(--white);
          }
          .ptable thead th {
            padding: 10px 12px;
            font-weight: 600;
            text-align: center;
            white-space: nowrap;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.4px;
            vertical-align: middle;
          }
          .ptable thead th:first-child { border-radius: var(--radius-sm) 0 0 0; width: 40px; }
          .ptable thead th:last-child { border-radius: 0 var(--radius-sm) 0 0; }
          .ptable thead th:nth-child(2) { width: 110px; }
          .ptable thead th:nth-child(3) { width: 90px; }
          .ptable thead th:nth-child(4) { width: 60px; }
          .ptable thead th:nth-child(5) { width: 100px; }
          .ptable tbody tr {
            border-bottom: 1px solid var(--border);
            transition: background 0.15s;
          }
          .ptable tbody tr:last-child { border-bottom: none; }
          .ptable tbody tr:last-child td:first-child { border-radius: 0 0 0 var(--radius-sm); }
          .ptable tbody tr:last-child td:last-child { border-radius: 0 0 var(--radius-sm) 0; }
          .ptable tbody tr:hover { background: #fff5f5; }
          .ptable tbody td {
            padding: 10px 12px;
            color: var(--muted);
            vertical-align: middle;
            border-bottom: 1px solid var(--border);
            text-align: center;
          }
          .ptable tbody tr:last-child td { border-bottom: none; }
          .ptable tbody td:first-child {
            color: var(--text);
            font-weight: 700;
            font-size: 12px;
            text-align: center;
            width: 40px;
          }
          .ptable tbody td:nth-child(2) { text-align: center; width: 110px; }
          .ptable tbody td:nth-child(3) { text-align: center; width: 90px; }
          .ptable tbody td:nth-child(4) { text-align: center; width: 60px; }
          .ptable tbody td:nth-child(5) { text-align: center; width: 100px; }
          .ptable tbody td:last-child { text-align: left; }
          .match-chip {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 4px;
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            white-space: nowrap;
          }
          .match-chip.no {
            background: var(--danger-bg);
            color: var(--danger);
          }
          .mrp-highlight-no {
            color: var(--danger);
            font-weight: 700;
            font-size: 13px;
            white-space: nowrap;
          }
          .reason-text {
            font-size: 12px;
            color: var(--danger);
            font-weight: 500;
            line-height: 1.5;
          }
          .summary {
            margin-top: 24px;
            padding: 24px;
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            text-align: right;
          }
          .summary-item {
            display: flex;
            justify-content: space-between;
            margin: 8px 0;
            font-size: 15px;
            color: var(--muted);
            font-weight: 500;
          }
          .summary-item.total {
            font-size: 20px;
            font-weight: 700;
            color: var(--text);
            border-top: 2px solid var(--border);
            padding-top: 12px;
            margin-top: 12px;
          }
          .summary-item.total span:last-child {
            color: var(--danger);
          }
          .footer {
            margin-top: 28px;
            padding: 24px;
            background: var(--white);
            border: 1px solid var(--border);
            border-radius: var(--radius);
            box-shadow: var(--shadow-sm);
            text-align: center;
            color: var(--muted);
            font-size: 12px;
            line-height: 1.8;
          }
          .footer strong {
            color: var(--text);
            font-size: 13px;
          }
          @media (max-width: 640px) {
            .info-grid { grid-template-columns: 1fr; }
            .header h1 { font-size: 20px; }
            body { padding: 12px; }
          }
        </style>
      </head>
      <body>
        <div class="wrapper">
          <div class="header">
            <h1>⚠️ Invalid Vi Numbers Report</h1>
            <p>Unmatched Test Cases</p>
            <p class="meta">Generated on: ${currentDate}</p>
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

          <div class="section-title">❌ Invalid Number Details</div>
          <p class="section-note">The following numbers were found to be invalid Vi numbers.</p>

          <div class="ptable-wrap">
            <table class="ptable">
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
                ${tableRows || `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--muted);">No invalid details available</td></tr>`}
              </tbody>
            </table>
          </div>

          <div class="summary">
            <div class="summary-item">
              <span>Total Invalid Numbers</span>
              <span>${invalidDetails.length}</span>
            </div>
            <div class="summary-item total">
              <span>Total Amount</span>
              <span>₹${invalidDetails.reduce((sum, d) => sum + parseFloat(d.amount || 0), 0).toFixed(2)}</span>
            </div>
          </div>

          <div class="footer">
            <p><strong>VI Automation System</strong></p>
            <p>This is an automated email. Please do not reply to this message.</p>
            <p>If you have any questions, please contact support at noreply-all@qdegrees.org</p>
            <p style="margin-top: 10px; color: var(--muted);">© 2026 VI Telecom. All rights reserved.</p>
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
If you have any questions, please contact support at noreply-all@qdegrees.org

© 2026 VI Telecom. All rights reserved.
    `;

    return textContent;
  }

  /**
   * Send combined email with BOTH valid and invalid data - NO action buttons
   * SHOWS ALL ROWS
   */
  async sendCombinedEmail(recipientEmail, allDetails, validCount, invalidCount, userName = 'Customer', options = {}) {
    try {
      if (!this.isEmailEnabled()) {
        console.log('📧 Email service is disabled. Skipping combined email to:', recipientEmail);
        return {
          success: true,
          skipped: true,
          message: 'Email service is disabled',
          recipientEmail: recipientEmail,
          timestamp: new Date().toISOString()
        };
      }

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

      console.log('Sending COMBINED email to:', recipientEmail);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(` Combined email sent to ${recipientEmail}:`, result.messageId);

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
      if (!this.isEmailEnabled()) {
        console.log('📧 Email service is disabled. Skipping matched email to:', recipientEmail);
        return {
          success: true,
          skipped: true,
          message: 'Email service is disabled',
          recipientEmail: recipientEmail,
          timestamp: new Date().toISOString()
        };
      }

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

      const htmlContent = this.formatMatchedTableHtml(validDetails, userName, signToken, options,);
      const textContent = this.formatRechargeDetailsText(validDetails, userName, options);

      const senderEmail = process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';
      const replyToEmail = options.replyTo || process.env.SMTP_REPLY_TO || process.env.MAIL_USERNAME || process.env.SMTP_USER || 'noreply-all@qdegrees.org';

      const mailOptions = {
        from: `"VI Automation" <${senderEmail}>`,
        to: recipientEmail,
        subject: options.subject || `Valid Vi Numbers Report (Action Required) - ${new Date().toLocaleDateString('en-IN')}`,
        text: textContent,
        html: htmlContent,
        cc: options.cc || '',
        bcc: options.bcc || '',
        replyTo: replyToEmail
      };

      console.log('Sending MATCHED email to:', recipientEmail);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(` Matched email sent to ${recipientEmail}:`, result.messageId);

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
      if (!this.isEmailEnabled()) {
        console.log('📧 Email service is disabled. Skipping unmatched email to:', recipientEmail);
        return {
          success: true,
          skipped: true,
          message: 'Email service is disabled',
          recipientEmail: recipientEmail,
          timestamp: new Date().toISOString()
        };
      }

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

      console.log(' Sending UNMATCHED email to:', recipientEmail);
      const result = await this.transporter.sendMail(mailOptions);
      console.log(` Unmatched email sent to ${recipientEmail}:`, result.messageId);

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
   * Send combined email with both valid and invalid numbers
   */
  async sendCombinedEmails(rechargeDetails, recipientEmail, userName = 'Customer', options = {}, signToken = (id) => id) {
    if (!this.isEmailEnabled()) {
      console.log('📧 Email service is disabled. Skipping email to:', recipientEmail);
      return {
        success: true,
        skipped: true,
        message: 'Email service is disabled',
        results: []
      };
    }

    console.log(`📧 Sending combined email to: ${recipientEmail}`);
    const results = [];

    // Separate valid and invalid
    const validDetails = Array.isArray(rechargeDetails)
      ? rechargeDetails.filter((detail) => this.isValidRechargeDetail(detail))
      : [];
    const invalidDetails = Array.isArray(rechargeDetails)
      ? rechargeDetails.filter((detail) => !this.isValidRechargeDetail(detail))
      : [];

    // Send combined email with both valid and invalid
    const allDetails = [...validDetails, ...invalidDetails];
    if (allDetails.length > 0) {
      console.log(`📤 Sending combined email (${allDetails.length} total: ${validDetails.length} valid, ${invalidDetails.length} invalid) to: ${recipientEmail}`);
      const result = await this.sendCombinedEmail(
        recipientEmail,
        allDetails,
        validDetails.length,
        invalidDetails.length,
        userName,
        options
      );
      results.push({ type: 'combined', result });
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
    if (!this.isEmailEnabled()) {
      console.log('📧 Email service is disabled. Skipping dual status emails.');
      return {
        success: true,
        skipped: true,
        message: 'Email service is disabled',
        results: []
      };
    }

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
      if (!this.isEmailEnabled()) {
        console.log('📧 Email service is disabled. Skipping bulk recharge emails.');
        return {
          success: true,
          skipped: true,
          message: 'Email service is disabled',
          totalRecipients: recipients.length,
          timestamp: new Date().toISOString()
        };
      }

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
      if (!this.isEmailEnabled()) {
        console.log('📧 Email service is disabled. Skipping SMTP connection test.');
        return {
          success: true,
          skipped: true,
          message: 'Email service is disabled',
          timestamp: new Date().toISOString()
        };
      }

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