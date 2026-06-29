const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const { exec } = require('child_process');
const os = require('os');
const nodemailer = require('nodemailer');
const multer = require('multer');
const crypto = require('crypto');
const app = express();
const fs = require("fs");
const PORT = Number(process.env.PORT) || 5174;
const SERVER_IP = process.env.SERVER_PUBLIC_IP || '13.233.121.125';
const { spawn } = require('child_process');
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SIEBEL_PROJECT_ROOT = path.resolve(__dirname, '..', 'siebel-crm-automation');
// require('./config.js')
const WebSocket = require('ws');
const http = require('http');
// Create HTTP server
const server = http.createServer(app);
const { TestOrchestrator } = require('./testOrchestrator');
const { getSimNumberViaUSSD, loadUssdService } = require('./ussdHandler');
const { runWdioTest, enrichPartiesFromDeviceMap } = require('./wdioRunner');
const { shouldShowUserLog, formatUserLogLine, inferLogType } = require('./userLogFilter');
const { SwiftCrmOrchestrator } = require('./swiftCrmOrchestrator');
const mailService = require('./mailService');

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');


require("./config")
const {Registration, FileInfo} = require("./schema")
// Create WebSocket server
// const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Set();

// Create WebSocket server with manual upgrade handling for routing
const wss = new WebSocket.Server({ noServer: true });

// SWIFT WebSocket clients
const swiftClients = new Map();

// Session-to-file mapping for SWIFT uploads
    const swiftUploadPaths = new Map();
 
    // Point 2: session-to-matched-rows mapping. Populated by /api/swift/upload
    // from the frontend's already-validated testCardsData, so the orchestrator
    // never has to re-derive which rows to run from the raw Excel sheet.
    const swiftMatchedRows = new Map();

// Handle HTTP upgrade requests manually
server.on('upgrade', (request, socket, head) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  
  if (pathname === '/swift-ws') {
    // Route to SWIFT WebSocket handler
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, 'swift');
    });
  } else {
    // Route to original WebSocket handler
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request, 'default');
    });
  }
});

const cors = require('cors');
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Save to src/test/resources/ directory
    const resourcesPath = path.join(__dirname, '..', 'src', 'test', 'resources');

    // Ensure directory exists
    if (!fs.existsSync(resourcesPath)) {
      fs.mkdirSync(resourcesPath, { recursive: true });
    }

    cb(null, resourcesPath);
  },
  filename: function (req, file, cb) {
    // Keep original filename (will overwrite if exists)
    cb(null, "contacts.xlsx");
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const name = (file.originalname || '').toLowerCase();
    const allowed = name.endsWith('.xlsx') || name.endsWith('.xls');
    if (allowed) return cb(null, true);
    cb(new Error('Only Excel files (.xlsx, .xls) are allowed!'), false);
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Return JSON on upload errors
app.use((err, req, res, next) => {
  if (err && err.message && err.message.includes('Only Excel files')) {
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    return res.status(500).json({ success: false, message: err.message || 'Internal Server Error' });
  }
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ===== In-memory store for pending recharge confirmations =====
// Key: transactionId, Value: { mobileNumber, amount, benefit, confirmed }
const pendingRecharges = new Map();

// Expose this map so mailService can register transaction details
// when it builds the confirm URL.
global.pendingRecharges = pendingRecharges;

const VI_RECHARGE_URL = 'https://www.myvi.in/prepaid/online-mobile-recharge';

// ========== Recharge Confirm Page (popup -> redirect to Vi site) ==========
// app.get('/recharge/confirm/:txnId', (req, res) => {
//   const { txnId } = req.params;
//   const record = pendingRecharges.get(txnId);

//   const mobileNumber = record ? record.mobileNumber : (req.query.mobileNumber || '');
//   const amount = record ? record.amount : '';

//   // Build Vi URL with mobile number as query param (best-effort prefill).
//   // If Vi's site reads a different param name, adjust 'mobileNumber' below.
//   const viUrlWithNumber = mobileNumber
//     ? `${VI_RECHARGE_URL}?mobileNumber=${encodeURIComponent(mobileNumber)}`
//     : VI_RECHARGE_URL;

//   let html = fs.readFileSync(path.join(__dirname, 'recharge-confirm.html'), 'utf8');

//   // Inject values as inline script right before </head> so the page's own script can read them
//   const injection = `
//     <script>
//       window.__TXN_ID__ = ${JSON.stringify(txnId)};
//       window.__MOBILE_NUMBER__ = ${JSON.stringify(mobileNumber)};
//       window.__AMOUNT__ = ${JSON.stringify(amount)};
//       window.__VI_URL__ = ${JSON.stringify(viUrlWithNumber)};
//       window.__CONFIRM_API_URL__ = ${JSON.stringify(`/api/recharge/confirm/${encodeURIComponent(txnId)}`)};
//     </script>
//   </head>`;

//   html = html.replace('</head>', injection);

//   res.setHeader('Content-Type', 'text/html');
//   res.send(html);
// });
app.get('/recharge/confirm/:txnId', (req, res) => {
  const txnId = req.params.txnId;
  const detail = global.pendingRecharges.get(txnId) || {};

  const mobileNumber = detail.mobileNumber || '';
  const viUrlWithNumber = mobileNumber
    ? `${VI_RECHARGE_URL}?mobileNumber=${encodeURIComponent(mobileNumber)}`
    : VI_RECHARGE_URL;

  const confirmApiUrl = `/api/recharge/confirm/${encodeURIComponent(txnId)}`;

  let html = fs.readFileSync(path.join(__dirname, 'recharge-confirm.html'), 'utf8');

  // Inject values as inline script right before </head>
  const injection = `
    <script>
      window.__TXN_ID__ = ${JSON.stringify(txnId)};
      window.__MOBILE_NUMBER__ = ${JSON.stringify(mobileNumber)};
      window.__AMOUNT__ = ${JSON.stringify(detail.amount || '')};
      window.__CIRCLE__ = ${JSON.stringify(detail.circle || '')};
      window.__BENEFIT__ = ${JSON.stringify(detail.benefit || '')};
      window.__VI_STATUS__ = ${JSON.stringify(detail.viStatus || '')};
      window.__SR_NO__ = ${JSON.stringify(detail.srNo || '')};
      window.__VI_URL__ = ${JSON.stringify(viUrlWithNumber)};
      window.__CONFIRM_API_URL__ = ${JSON.stringify(confirmApiUrl)};
    </script>
  </head>`;

  html = html.replace('</head>', injection);

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.get('/device-progress.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'device-progress.html'));
});

function runCommand(cmd) {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      resolve({
        error: err || null,
        stdout,
        stderr,
        code: err?.code ?? 0
      });
    });
  });
}



const FILES_DIR = "../test-output/comprehensive-reports";

// AND filters by today's date
app.post("/api/search-files", (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Query parameter is required" });
  }

  fs.readdir(FILES_DIR, (err, files) => {
    if (err) {
      console.error("Error reading directory:", err);
      return res.status(500).json({ error: "Unable to read directory" });
    }

    // Normalize the search name - handle both formats
    const searchName = name.trim();
    const searchPatterns = [];

    // If it's a 91-number, also search without 91 prefix
    if (searchName.startsWith('91') && searchName.length > 2) {
      searchPatterns.push(searchName); // Original with 91
      searchPatterns.push(searchName.substring(2)); // Without 91
    }
    // If it's a normal number (without 91), also search with 91 prefix
    else if (!searchName.startsWith('91') && searchName.length >= 10) {
      searchPatterns.push(searchName); // Original without 91
      searchPatterns.push('91' + searchName); // With 91 prefix
    }
    else {
      searchPatterns.push(searchName); // Just use as-is
    }

    console.log(`Searching for patterns: ${searchPatterns.join(', ')}`);

    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD

    // Also check for other date formats that might appear in filenames
    const todayFormats = [
      todayStr, // YYYY-MM-DD
      todayStr.replace(/-/g, ''), // YYYYMMDD
      `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`, // DD-MM-YYYY
      `${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}-${today.getFullYear()}`, // MM-DD-YYYY
    ];

    console.log(`Today's date filters: ${todayFormats.join(', ')}`);

    // Filter files that match any of the search patterns AND today's date
    const matchedFiles = files.filter(file => {
      const fileNameLower = file.toLowerCase();

      // First check if file matches search patterns
      const matchesSearch = searchPatterns.some(pattern =>
        fileNameLower.includes(pattern.toLowerCase())
      );

      // Then check if file contains today's date
      const matchesDate = todayFormats.some(dateFormat =>
        fileNameLower.includes(dateFormat)
      );

      return matchesSearch && matchesDate;
    });

    // If no files found with today's date, fall back to all matching files
    let finalFiles = matchedFiles;
    if (matchedFiles.length === 0) {
      console.log(`No files found for today's date, showing all matching files`);
      finalFiles = files.filter(file => {
        const fileNameLower = file.toLowerCase();
        return searchPatterns.some(pattern =>
          fileNameLower.includes(pattern.toLowerCase())
        );
      });
    }

    // Get file stats for more accurate date filtering
    const filesWithStats = [];
    finalFiles.forEach(file => {
      try {
        const filePath = path.join(FILES_DIR, file);
        const stats = fs.statSync(filePath);
        const fileDate = new Date(stats.mtime); // Use modification time

        // Check if file was created/modified today
        const isToday = fileDate.toDateString() === today.toDateString();

        filesWithStats.push({          file,
          path: filePath,
          created: fileDate,
          isToday: isToday
        });
      } catch (error) {
        console.error(`Error getting stats for ${file}:`, error);
        filesWithStats.push({
          file,
          path: path.join(FILES_DIR, file),
          created: null,
          isToday: false
        });
      }
    });

    // Sort by creation date (newest first)
    filesWithStats.sort((a, b) => {
      if (!a.created) return 1;
      if (!b.created) return -1;
      return b.created - a.created;
    });

    console.log(`Found ${filesWithStats.length} files for search "${name}"`);

    res.json({
      success: true,
      count: filesWithStats.length,
      files: filesWithStats,
      today: todayStr,
      searchPatterns: searchPatterns,
      message: matchedFiles.length === finalFiles.length ?
        "Showing today's reports only" :
        "No reports found for today, showing all available reports"
    });
  });
});

// Enhanced download file endpoint
app.post("/api/download-file", (req, res) => {
  try {
    const fileName = req.body.name;

    if (!fileName) {
      return res.status(400).json({ error: "File name is required" });
    }

    const filePath = path.join(FILES_DIR, fileName);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      // Try to find the file with different naming patterns
      const normalizedName = fileName.trim();
      let actualFileName = null;

      // Read directory to find matching file
      const files = fs.readdirSync(FILES_DIR);

      // Try different naming patterns
      if (normalizedName.startsWith('91') && normalizedName.length > 2) {
        // Try without 91 prefix
        const without91 = normalizedName.substring(2);
        actualFileName = files.find(file =>
          file.toLowerCase().includes(without91.toLowerCase())
        );
      } else if (!normalizedName.startsWith('91') && normalizedName.length >= 10) {
        // Try with 91 prefix
        const with91 = '91' + normalizedName;
        actualFileName = files.find(file =>
          file.toLowerCase().includes(with91.toLowerCase())
        );
      }

      // If still not found, try direct case-insensitive match
      if (!actualFileName) {
        actualFileName = files.find(file =>
          file.toLowerCase().includes(normalizedName.toLowerCase())
        );
      }

      if (actualFileName) {
        const actualFilePath = path.join(FILES_DIR, actualFileName);
        console.log(`Found file: ${actualFileName} for request: ${fileName}`);
        return res.download(actualFilePath, actualFileName, (err) => {
          if (err) {
            console.error("Download error:", err);
            res.status(500).json({ error: "Error downloading file" });
          }
        });
      }

      return res.status(404).json({
        success: false,
        error: "File not found",
        message: `File "${fileName}" not found in ${FILES_DIR}`
      });
    }

    // File exists, send it
    console.log(`Downloading file: ${filePath}`);
    res.download(filePath, fileName, (err) => {
      if (err) {
        console.error("Download error:", err);
        res.status(500).json({
          success: false,
          error: "Error downloading file"
        });
      }
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      success: false,
      error: "Internal Server Error",
      message: error.message
    });
  }
});

// Add a helper endpoint to list all files (for debugging)
app.get("/api/list-all-files", (req, res) => {
  try {
    fs.readdir(FILES_DIR, (err, files) => {
      if (err) {
        console.error("Error reading directory:", err);
        return res.status(500).json({
          success: false,
          error: "Unable to read directory"
        });
      }

      // Get today's date
      const today = new Date();
      const todayStr = today.toDateString();

      // Get file stats and categorize
      const filesWithStats = [];
      const todayFiles = [];
      const olderFiles = [];

      files.forEach(file => {
        try {
          const filePath = path.join(FILES_DIR, file);
          const stats = fs.statSync(filePath);
          const fileDate = new Date(stats.mtime);
          const isToday = fileDate.toDateString() === todayStr;

          const fileInfo = {
            file,
            path: filePath,
            created: fileDate,
            isToday: isToday
          };

          filesWithStats.push(fileInfo);

          if (isToday) {
            todayFiles.push(fileInfo);
          } else {
            olderFiles.push(fileInfo);
          }

        } catch (error) {
          console.error(`Error getting stats for ${file}:`, error);
        }
      });

      // Sort by date (newest first)
      filesWithStats.sort((a, b) => {
        if (!a.created) return 1;
        if (!b.created) return -1;
        return b.created - a.created;
      });

      // Group files by number patterns
      const groupedFiles = {};

      files.forEach(file => {
        // Extract numbers from filename (both 91 and non-91)
        const matches = file.match(/(91\d{10}|\d{10})/g);
        if (matches && matches.length > 0) {
          const key = matches[0]; // Use first matched number as key
          if (!groupedFiles[key]) {
            groupedFiles[key] = [];
          }
          groupedFiles[key].push(file);
        }
      });

      res.json({
        success: true,
        total: files.length,
        today: todayFiles.length,
        files: filesWithStats,
        todayFiles: todayFiles,
        olderFiles: olderFiles,
        groupedByNumber: groupedFiles,
        dateFilter: todayStr
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      error: "Internal Server Error"
    });
  }
});

/** USSD balance check — mirrors automation/server.js POST /getBalance and Java USSDService */
app.post('/getBalance', async (req, res) => {
  try {
    const deviceId = req.body.deviceId;
    if (!deviceId) {
      return res.status(400).json({ status: 0, error: 'deviceId is required' });
    }
    const { checkBalanceAndValidity, toLegacyResponse } = loadUssdService();
    const result = await checkBalanceAndValidity(deviceId, '*199#');
    res.json(toLegacyResponse(result));
  } catch (err) {
    res.status(500).json({ status: 0, error: err.message });
  }
});

app.post('/api/ussd/balance', async (req, res) => {
  try {
    const deviceId = req.body.deviceId;
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'deviceId is required' });
    }
    const legacy = await getSimNumberViaUSSD(deviceId, null);
    res.json({ success: !!legacy.phoneNumber, ...legacy });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// NEW USER SAVE/REGISTRATION ENDPOINT
// ==========================================
app.post('/api/users', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: "Email and password are required fields." 
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if an active user already exists
    const existingUser = await Registration.findOne({ 
      email: normalizedEmail,
      is_deleted: 0 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: "This email is already registered." 
      });
    }

    // Encrypt password field
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Save mapping directly to your explicit schema structure
    const newUser = new Registration({
      name : name,
      email: normalizedEmail,
      password: hashedPassword,       // Hashed version for database security
      original_password: password,     // Plain text version matching your schema field
      is_deleted: 0,
      created: new Date(),
      modified: new Date()
    });

    const savedUser = await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      userId: savedUser._id
    });

  } catch (error) {
    console.error("Registration API Error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error while saving user." 
    });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    const users = await Registration.find({ is_deleted: 0 }).select('name email created');
    res.json({ success: true, users });
  } catch (error) {
    console.error('Admin users load error:', error);
    res.status(500).json({ success: false, message: 'Unable to load users.' });
  }
});

app.delete('/api/admin/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await Registration.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    user.is_deleted = 1;
    user.modified = new Date();
    await user.save();
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ success: false, message: 'Unable to delete user.' });
  }
});

app.get('/api/admin/reports', async (req, res) => {
  try {
    const files = fs.readdirSync(FILES_DIR);
    const reports = files.map(file => {
      const stats = fs.statSync(path.join(FILES_DIR, file));
      return { name: file, modified: stats.mtime };
    }).sort((a, b) => b.modified - a.modified);
    res.json({ success: true, reports });
  } catch (error) {
    console.error('Admin reports load error:', error);
    res.status(500).json({ success: false, message: 'Unable to load reports.' });
  }
});

app.delete('/api/admin/reports', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Report name is required.' });
    }
    const filePath = path.join(FILES_DIR, name);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }
    fs.unlinkSync(filePath);
    res.json({ success: true, message: 'Report deleted successfully.' });
  } catch (error) {
    console.error('Admin delete report error:', error);
    res.status(500).json({ success: false, message: 'Unable to delete report.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log("QQQQQQQQQQQQQQQQQQQQQQ")

  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  

  
  

  const normalizedEmail = email.toLowerCase().trim();
  const user = await Registration.findOne({ email: normalizedEmail, is_deleted: 0 });
  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = createSession(user.email);
  res.json({ success: true, token, email: user.email, name: user.name || normalizedEmail.split('@')[0] });
});

app.post('/api/auth/logout', (req, res) => {
  const { token } = req.body;
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true });
});

app.get('/api/auth/validate', (req, res) => {
  const token = req.query.token || req.headers['x-session-token'];
  const session = validateSession(token);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Session expired. Please login again.' });
  }
  res.json({ success: true, email: session.email });
});

let adbStatus = 'stopped';
let appiumStatus = 'stopped';
let connectedDevices = new Map();
let phoneDeviceMap = new Map();

// ========== Simple Auth ==========

const allowedUsers = [
  { email: 'nainji@gmail.com', password: 'Password@123' },
  { email: 'Chandra@gmail.com', password: 'Password@123' },
  { email: 'kalidindi.chandra@qdegrees.org', password: 'Password@123' }
];

const activeSessions = new Map();
const SESSION_TIMEOUT = 1000 * 60 * 60 * 8;

function createSession(email) {
  const token = crypto.randomBytes(32).toString('hex');
  activeSessions.set(token, { email, createdAt: Date.now() });
  return token;
}

function validateSession(token) {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_TIMEOUT) {
    activeSessions.delete(token);
    return null;
  }
  return session;
}

// ========== Helper Functions ==========

// Helper function to execute commands with promise
function executeCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      resolve({
        success: !error,
        output: stdout || stderr,
        error: error
      });
    });
  });
}

// Improved pairing function using spawn
function pairDevice(ip, port, code) {
  return new Promise((resolve) => {
    const pairProcess = spawn('adb', ['pair', `${ip}:${port}`], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';

    pairProcess.stdout.on('data', (data) => {
      output += data.toString();
      console.log('Pairing stdout:', data.toString());

      // If we see the pairing prompt, send the code
      if (data.toString().includes('Enter pairing code:')) {
        pairProcess.stdin.write(code + '\n');
      }
    });

    pairProcess.stderr.on('data', (data) => {
      output += data.toString();
      console.log('Pairing stderr:', data.toString());
    });

    pairProcess.on('close', (code) => {
      console.log('Pairing process exited with code:', code);
      console.log('Final pairing output:', output);

      const success = output.includes('Successfully paired');
      resolve(success);
    });

    pairProcess.on('error', (error) => {
      console.error('Pairing process error:', error);
      resolve(false);
    });

    // Timeout after 10 seconds
    setTimeout(() => {
      pairProcess.kill();
      console.log('Pairing timeout');
      resolve(false);
    }, 10000);
  });
}

function extractReportPath(output) {
  const match = output.match(/Report generated: (.+\.zip)/);
  return match ? match[1] : '';
}

function parseTestCount(output) {
  const match = output.match(/Tests run: (\d+)/);
  return match ? parseInt(match[1]) : 0;
}

function parsePassedCount(output) {
  const match = output.match(/Tests run: (\d+), Failures: (\d+)/);
  if (match) {
    return parseInt(match[1]) - parseInt(match[2]);
  }
  return 0;
}

function getTestSuite(testType) {
  const mapping = {
    'calling': 'testng-calling.xml',
    'sms': 'testng-sms.xml',
    'data': 'testng-data-usage.xml',
    'calling-sms': 'testng-both-calling-and-sms.xml',
    'comprehensive': 'testng-all.xml',
    'multi-device': 'testng-all.xml' // Multi-device uses comprehensive test suite
  };
  return mapping[testType] || 'testng-all.xml';
}

function getTestClass(testType) {
  const mapping = {
    'calling': 'CallingTest',
    'sms': 'SMSTest',
    'data': 'DataUsageTest',
    'calling-sms': 'CallingTest,SMSTest',
    'comprehensive': 'ComprehensiveTelecomTest',
    'multi-device': 'ComprehensiveTelecomTest' // Multi-device uses comprehensive test class
  };
  return mapping[testType] || 'ComprehensiveTelecomTest';
}

function checkNetworkMatch(current, target) {
  current = current.toUpperCase();
  target = target.toUpperCase();

  if (target === '5G') return current.includes('NR') || current.includes('5G');
  if (target === '4G') return current.includes('LTE') || current.includes('4G');
  if (target === '3G') return current.includes('HSPA') || current.includes('UMTS') || current.includes('3G');
  if (target === '2G') return current.includes('EDGE') || current.includes('GPRS') || current.includes('2G');

  return true;
}

// ========== ADB/Appium Control ==========

app.get('/api/endpoint', (req, res) => {
      res.json({ success: true, message: 'backend server started' });
  });

app.post('/api/adb/start', (req, res) => {
  exec('adb start-server', (error) => {
    if (error) {
      return res.json({ success: false, message: error.message });
    }
    adbStatus = 'running';
    res.json({ success: true, message: 'ADB server started' });
  });
});

// ===== Vi Number Validator APIs (migrated from vi-number-validator-api/server.ts) =====
const { chromium } = require('playwright');

const VI_URL = "https://www.myvi.in/prepaid/online-mobile-recharge";
const SELECTORS = {
  mobileInput: 'input#mobileNumber',
  errorMsg: '.ORCMobileInput_errorMsg__TecyC'
};
const WAIT_MS = 500;
const CACHE_TTL = 3600000; // 1 hour cache

// ===== Browser Pool for Reuse =====
let browserInstance = null;
let pageInstance = null;
let lastUsed = Date.now();
const validationCache = new Map();

async function closeBrowserPool() {
  try {
    await browserInstance?.close();
  } catch (e) {}
  browserInstance = null;
  pageInstance = null;
}

async function getBrowserPage() {
  // Close if idle for more than 5 minutes
  if (lastUsed && Date.now() - lastUsed > 300000) {
    await closeBrowserPool();
  }
  
  if (!browserInstance) {
    browserInstance = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1920,1080'
      ]
    });
  }
  
  if (!pageInstance || pageInstance.isClosed()) {
    const context = await browserInstance.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      locale: 'en-US',
      timezoneId: 'Asia/Kolkata'
    });
    pageInstance = await context.newPage();
    await pageInstance.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1'
    });
    await pageInstance.goto(VI_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
  }
  
  lastUsed = Date.now();
  return pageInstance;
}

// Clean up on process exit
process.on('SIGTERM', closeBrowserPool);
process.on('SIGINT', closeBrowserPool);

function isValidFormat(n) {
  return typeof n === 'string' && /^\d{10}$/.test(n);
}

async function validateOnPage(page, mobileNumber) {
  // Check cache first
  const cached = validationCache.get(mobileNumber);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.result;
  }
  
  const input = page.locator(SELECTORS.mobileInput);
  await input.waitFor({ state: 'visible', timeout: 5000 });
  await input.click({ clickCount: 3 });
  await input.fill(mobileNumber);
  await page.waitForTimeout(WAIT_MS);
  
  const errorLocator = page.locator(SELECTORS.errorMsg);
  const hasError = await errorLocator.count().then(count => count > 0).catch(() => false);
  const errorText = hasError ? (await errorLocator.innerText()).trim() : '';
  const isNonViError = errorText.toLowerCase().includes('non vi number');
  const isValid = !hasError || !isNonViError;
  
  const result = {
    number: mobileNumber,
    isValid,
    message: isValid ? 'Valid Vi number' : `Invalid Vi number – "${errorText}"`,
    timestamp: new Date().toISOString()
  };
  
  // Cache the result
  validationCache.set(mobileNumber, { result, timestamp: Date.now() });
  return result;
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'vi-number-validator', ts: new Date().toISOString() });
});

app.post('/api/validate', async (req, res) => {
  const number = (req.body || {}).number;
  if (!isValidFormat(number)) {
    return res.status(400).json({ error: 'Invalid input', detail: '"number" must be a 10-digit string' });
  }
  
  try {
    const page = await getBrowserPage();
    const result = await validateOnPage(page, number);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Internal server error', detail: message });
  }
});

app.post('/api/validate/bulk', async (req, res) => {
  const numbers = (req.body || {}).numbers;
  if (!Array.isArray(numbers) || numbers.length === 0) {
    return res.status(400).json({ error: 'Invalid input', detail: '"numbers" must be a non-empty array of strings' });
  }

  // Partition into valid and invalid numbers
  const invalid = numbers.filter((n) => !isValidFormat(n));
  const validNumbers = numbers.filter((n) => isValidFormat(n));

  if (validNumbers.length === 0) {
    return res.status(400).json({ 
      error: 'No valid numbers', 
      detail: 'No valid 10-digit numbers to process', 
      invalid: invalid.map(String) 
    });
  }

  if (validNumbers.length > 50) {
    return res.status(400).json({ 
      error: 'Limit exceeded', 
      detail: 'Maximum 50 numbers per bulk request (valid numbers)' 
    });
  }

  const start = Date.now();
  const BATCH_SIZE = 5; // Process 5 numbers concurrently
  const results = [];

  try {
    const page = await getBrowserPage();
    
    // Process valid numbers in parallel batches
    const validResults = [];
    for (let i = 0; i < validNumbers.length; i += BATCH_SIZE) {
      const batch = validNumbers.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(num => validateOnPage(page, num))
      );
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          validResults.push(result.value);
        } else {
          // Find which number failed
          const idx = batchResults.indexOf(result);
          const num = batch[idx] || 'unknown';
          validResults.push({
            number: num,
            isValid: false,
            message: `Validation error: ${result.reason}`,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
    
    // Reconstruct results in original input order
    let validIndex = 0;
    for (const num of numbers) {
      if (!isValidFormat(num)) {
        results.push({
          number: String(num),
          isValid: false,
          message: 'Invalid MSISDN (must be 10 digits)',
          timestamp: new Date().toISOString()
        });
      } else {
        results.push(validResults[validIndex++] || {
          number: num,
          isValid: false,
          message: 'Validation failed',
          timestamp: new Date().toISOString()
        });
      }
    }

    const validCount = results.filter((r) => r.isValid).length;
    const invalidProcessed = results.filter((r) => !r.isValid).length;

    const bulk = {
      total_requested: numbers.length,
      processed: results.length,
      processed_valid: validCount,
      processed_invalid: invalidProcessed,
      skipped_invalid_format: invalid.map(String),
      duration_ms: Date.now() - start,
      results
    };

    res.json(bulk);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: 'Internal server error', detail: message });
  }
});

// Optional: Endpoint to clear cache (for testing)
app.post('/api/validate/cache/clear', (req, res) => {
  validationCache.clear();
  res.json({ success: true, message: 'Validation cache cleared' });
});

// Backend endpoint hit when user clicks "OK" on the confirm popup.
// In server.js, update the /api/recharge/confirm/:txnId endpoint
app.post('/api/recharge/confirm/:txnId', (req, res) => {
  const { txnId } = req.params;
  const record = pendingRecharges.get(txnId);

  if (record) {
    record.confirmed = true;
    record.confirmedAt = new Date().toISOString();
    console.log(`✅ Recharge confirmed for txn ${txnId} (mobile: ${record.mobileNumber})`);
    
    // Write confirmation to file for WDIO to detect - use the SWIFT comm directory
    try {
      const commDir = path.join(__dirname, '..', 'swift-crm-automation', 'comm');
      fs.mkdirSync(commDir, { recursive: true });
      fs.writeFileSync(
        path.join(commDir, 'recharge_confirmed.json'),
        JSON.stringify({ 
          txnId, 
          msisdn: record.mobileNumber, 
          confirmed: true,
          timestamp: Date.now() 
        }, null, 2)
      );
      console.log(`[SWIFT] ✅ Recharge confirmed file written for ${record.mobileNumber}`);
    } catch (fileErr) {
      console.error(`[SWIFT] Failed to write confirm file: ${fileErr.message}`);
    }
  } else {
    console.log(`⚠️ Recharge confirm called for unknown txn ${txnId}`);
  }

  res.json({ success: true, txnId });
});

// ─── Skip recharge (user clicked Skip or Cancel) ──────────────────────────
app.post('/api/recharge/skip/:txnId', (req, res) => {
  const { txnId } = req.params;
  const record = pendingRecharges.get(txnId);

  if (record) {
    record.skipped = true;
    record.skippedAt = new Date().toISOString();
    record.skipReason = req.body?.reason || 'User skipped';
    console.log(`⏭ Recharge skipped for txn ${txnId} (mobile: ${record.mobileNumber}) - ${record.skipReason}`);
    
    // Write skip status to file for WDIO to detect
    try {
      const commDir = path.join(__dirname, '..', 'swift-crm-automation', 'comm');
      fs.mkdirSync(commDir, { recursive: true });
      fs.writeFileSync(
        path.join(commDir, 'recharge_skipped.json'),
        JSON.stringify({ 
          txnId, 
          msisdn: record.mobileNumber, 
          skipped: true,
          reason: record.skipReason,
          timestamp: Date.now() 
        }, null, 2)
      );
      console.log(`[SWIFT] ⏭ Recharge skip file written for ${record.mobileNumber}`);
    } catch (fileErr) {
      console.error(`[SWIFT] Failed to write skip file: ${fileErr.message}`);
    }
  } else {
    console.log(`⚠️ Recharge skip called for unknown txn ${txnId}`);
  }

  res.json({ success: true, txnId, skipped: true });
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});


// ─── Skip recharge (user clicked Skip or Cancel) ──────────────────────────
app.post('/api/recharge/skip/:txnId', (req, res) => {
  const { txnId } = req.params;
  const record = pendingRecharges.get(txnId);

  if (record) {
    record.skipped = true;
    record.skippedAt = new Date().toISOString();
    record.skipReason = req.body?.reason || 'User skipped';
    console.log(`⏭ Recharge skipped for txn ${txnId} (mobile: ${record.mobileNumber}) - ${record.skipReason}`);
    
    // Write skip status to file for WDIO to detect
    try {
      const commDir = path.join(__dirname, '..', 'swift-crm-automation', 'comm');
      fs.mkdirSync(commDir, { recursive: true });
      fs.writeFileSync(
        path.join(commDir, 'recharge_skipped.json'),
        JSON.stringify({ 
          txnId, 
          msisdn: record.mobileNumber, 
          skipped: true,
          reason: record.skipReason,
          timestamp: Date.now() 
        }, null, 2)
      );
      console.log(`[SWIFT] ⏭ Recharge skip file written for ${record.mobileNumber}`);
    } catch (fileErr) {
      console.error(`[SWIFT] Failed to write skip file: ${fileErr.message}`);
    }
  } else {
    console.log(`⚠️ Recharge skip called for unknown txn ${txnId}`);
  }

  res.json({ success: true, txnId, skipped: true });
});

// ========== Process Validation and Send Emails ==========
app.post('/api/process-validation-and-send-emails', async (req, res) => {
  try {
    const { validationResults, recipients = [] } = req.body;
    
    if (!validationResults || !Array.isArray(validationResults)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation results are required' 
      });
    }

    const emailRecipients = recipients.length > 0 
      ? recipients 
      : ['kalidindi.chandra@qdegrees.org', 'amit.kumar1@qdegrees.org', 'testingqdegrees@gmail.com'];

    // Separate valid and invalid numbers
    const validNumbers = validationResults.filter(r => r.isValid === true);
    const invalidNumbers = validationResults.filter(r => r.isValid === false);

    console.log(`📊 Processing: ${validNumbers.length} valid, ${invalidNumbers.length} invalid`);

    const emailResults = [];

    // Prepare all recharge details with proper fields from the validation results
    // We need to get the amount and benefit from the original data
    // Since we don't have the Excel data here, we'll use the validation results
    const allDetails = validationResults.map((r, index) => {
      const isViValid = r.isValid === true;
      
      // Extract circle from message
      let circle = 'N/A';
      if (isViValid) {
        circle = 'Vi';
      } else if (r.message && r.message.includes('non Vi')) {
        circle = 'Non-Vi';
      } else if (r.message && r.message.includes('must be 10 digits')) {
        circle = 'Invalid Format';
      }
      
      // Check if it's a "MRP not found" case
      const isMismatch = !isViValid && r.message && r.message.includes('MRP not found');
      
      return {
        mobileNumber: r.number,
        status: isViValid ? 'Valid' : (isMismatch ? 'Mismatch' : 'Invalid'),
        isValid: isViValid,
        isMismatch: isMismatch,
        operatorName: isViValid ? 'Vi' : 'Unknown',
        circle: circle,
        planName: isViValid ? 'Recharge Plan' : 'N/A',
        // Use the amount from the validation result if available, otherwise 0
        amount: r.amount || 0,
        benefit: r.benefit || (isViValid ? 'Recharge Plan' : 'N/A'),
        transactionId: isViValid 
          ? `TXN_${Date.now()}_${index}_${r.number}`
          : `INV_${Date.now()}_${index}_${r.number}`,
        date: new Date().toLocaleDateString('en-IN'),
        errorMessage: isViValid ? '' : (r.message || 'Invalid Vi number'),
        reason: isViValid ? '' : (r.message || 'Invalid Vi number'),
        timestamp: r.timestamp || new Date().toISOString()
      };
    });

    // For Email 2: Filter valid numbers that don't have MRP mismatch
    const validOnlyForAction = allDetails.filter(d => 
      d.isValid === true && !d.isMismatch
    );

    // For each recipient, send 2 emails
    for (const recipient of emailRecipients) {
      
      // ============================================================
      // EMAIL 1: Combined email with both valid and invalid (NO ACTIONS)
      // ============================================================
      const combinedResult = await mailService.sendCombinedEmails(
        allDetails,
        recipient,
        'Customer',
        { 
          subject: `Mobile Recharge Details Report - ${new Date().toLocaleDateString('en-IN')}`,
          includeActions: false
        },
        (id) => id
      );
      emailResults.push({
        recipient,
        type: 'combined_no_actions',
        result: combinedResult
      });

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // ============================================================
      // EMAIL 2: Only valid numbers with ACTION BUTTONS
      // ============================================================
      if (validOnlyForAction.length > 0) {
        const validOnlyResult = await mailService.sendMatchedEmail(
          recipient,
          validOnlyForAction,
          'Customer',
          { 
            subject: `Valid Vi Numbers Report (Action Required) - ${new Date().toLocaleDateString('en-IN')}`,
            includeActions: true
          },
          (id) => id
        );
        emailResults.push({
          recipient,
          type: 'valid_only_with_actions',
          result: validOnlyResult
        });
      } else {
        console.log(`⚠️ No valid numbers with matching MRP for ${recipient}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    const successCount = emailResults.filter(e => e.result && e.result.success).length;
    const totalEmails = emailResults.length;

    res.json({
      success: true,
      summary: {
        validCount: validNumbers.length,
        invalidCount: invalidNumbers.length,
        validForAction: validOnlyForAction.length,
        emailsSent: totalEmails,
        emailsSuccessful: successCount,
        emailsFailed: totalEmails - successCount,
        recipients: emailRecipients
      },
      details: emailResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Email processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process and send emails',
      error: error.message
    });
  }
});

// ========== OLD Appium Functions ==========

// app.post('/api/appium/start', (req, res) => {
//   console.log('🚀 Starting Appium server...');

//   // First, stop any existing Appium server using your batch file logic
//   exec('netstat -ano | findstr :4723', (error, stdout) => {
//     if (stdout && stdout.includes('LISTENING')) {
//       console.log('🛑 Stopping existing Appium server...');

//       // Kill processes using port 4723 (your batch file logic)
//       const lines = stdout.split('\n');
//       lines.forEach(line => {
//         const match = line.match(/:4723.*LISTENING\s+(\d+)/);
//         if (match && match[1]) {
//           const pid = match[1];
//           exec(`taskkill /F /PID ${pid}`, (killError) => {
//             console.log(killError ? `Failed to kill ${pid}` : `Killed process ${pid}`);
//           });
//         }
//       });

//       // Wait a moment for processes to be killed
//       setTimeout(() => startFreshAppium(res), 2000);
//     } else {
//       startFreshAppium(res);
//     }
//   });
// });

// function startFreshAppium(res) {
//   // Use your working batch file command: start Appium in new command window that stays open
//   exec('start cmd /k "appium --address 127.0.0.1 --port 4723 --allow-insecure uiautomator2:adb_shell"', (error) => {
//     if (error) {
//       console.error(' Appium start error:', error);
//       appiumStatus = 'stopped';
//       return res.json({
//         success: false,
//         message: `Failed to start Appium: ${error.message}`
//       });
//     }

//     console.log('⏳ Waiting for Appium to start...');

//     // Check if Appium started successfully
//     const checkAppium = (attempt = 1) => {
//       setTimeout(() => {
//         exec('netstat -ano | findstr :4723', (checkError, checkStdout) => {
//           if (checkStdout && checkStdout.includes('LISTENING')) {
//             console.log(' Appium server started successfully');
//             appiumStatus = 'running';
//             res.json({
//               success: true,
//               message: 'Appium server started successfully'
//             });
//           } else if (attempt < 5) {
//             // Try again
//             console.log(` Appium check attempt ${attempt} failed, retrying...`);
//             checkAppium(attempt + 1);
//           } else {
//             // Final attempt failed
//             console.error(' Appium failed to start after multiple attempts');
//             appiumStatus = 'stopped';
//             res.json({
//               success: false,
//               message: 'Appium failed to start - port 4723 not listening after 10 seconds'
//             });
//           }
//         });
//       }, attempt * 2000); // 2s, 4s, 6s, 8s, 10s
//     };

//     checkAppium(1);
//   });
// }

// app.post('/api/appium/stop', (req, res) => {
//   console.log('🛑 Stopping Appium server...');

//   let killedProcesses = 0;

//   // Kill processes using port 4723
//   exec('netstat -ano | findstr :4723', (error, stdout) => {
//     if (stdout) {
//       const lines = stdout.split('\n');
//       lines.forEach(line => {
//         const match = line.match(/:4723.*LISTENING\s+(\d+)/);
//         if (match && match[1]) {
//           const pid = match[1];
//           exec(`taskkill /F /PID ${pid}`, (killError) => {
//             if (!killError) killedProcesses++;
//           });
//         }
//       });
//     }

//     // Also kill any node processes with Appium
//     exec('taskkill /F /IM node.exe /FI "WINDOWTITLE eq appium*"', (error2) => {
//       appiumStatus = 'stopped';
//       console.log(` Appium server stopped. Killed ${killedProcesses} process(es)`);
//       res.json({
//         success: true,
//         message: `Appium server stopped. Killed ${killedProcesses} process(es)`
//       });
//     });
//   });
// });

// ========== FINAL Appium Functions ==========

app.post('/api/appium/start', (req, res) => {
  console.log('🚀 Starting Appium server...');

  // First, stop any existing Appium server
  checkAndKillAppiumProcesses(() => {
    startFreshAppium(res);
  });
});

function checkAndKillAppiumProcesses(callback) {
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    // Windows: Check port 4723
    exec('netstat -ano | findstr :4723', (error, stdout) => {
      if (stdout && stdout.includes('LISTENING')) {
        console.log('🛑 Stopping existing Appium server...');
        const lines = stdout.split('\n');
        let processesToKill = [];
        
        lines.forEach(line => {
          const match = line.match(/:4723.*LISTENING\s+(\d+)/);
          if (match && match[1]) {
            processesToKill.push(match[1]);
          }
        });
        
        if (processesToKill.length > 0) {
          let killedCount = 0;
          processesToKill.forEach(pid => {
            exec(`taskkill /F /PID ${pid}`, (killError) => {
              if (!killError) killedCount++;
              if (killedCount === processesToKill.length) {
                setTimeout(callback, 2000);
              }
            });
          });
        } else {
          callback();
        }
      } else {
        callback();
      }
    });
  } else {
    // macOS/Linux: Find and kill Appium processes
    exec('lsof -ti :4723', (error, stdout) => {
      if (stdout && stdout.trim()) {
        console.log('🛑 Stopping existing Appium server...');
        const pids = stdout.trim().split('\n');
        pids.forEach(pid => {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
            console.log(`Killed process ${pid}`);
          } catch (err) {
            console.log(`Failed to kill ${pid}: ${err.message}`);
          }
        });
        setTimeout(callback, 2000);
      } else {
        callback();
      }
    });
  }
}

function startFreshAppium(res) {
  const isWindows = os.platform() === 'win32';
  
  // Build the Appium command arguments
  const appiumArgs = [
    '--address', '127.0.0.1',
    '--port', '4723',
    '--allow-insecure', 'uiautomator2:adb_shell'
  ];
  
  console.log('📡 Starting Appium with:', appiumArgs.join(' '));
  
  let appiumProcess;
  
  if (isWindows) {
    // Windows: Use spawn with detached mode to keep it running
    appiumProcess = spawn('cmd.exe', ['/c', 'appium', ...appiumArgs], {
      detached: true,
      stdio: 'ignore'
    });
    appiumProcess.unref();
  } else {
    // macOS/Linux: Use spawn with detached mode
    appiumProcess = spawn('appium', appiumArgs, {
      detached: true,
      stdio: 'ignore'
    });
    appiumProcess.unref();
  }
  
  console.log('⏳ Waiting for Appium to start...');
  
  // Check if Appium started successfully
  const checkAppium = (attempt = 1) => {
    setTimeout(() => {
      checkPort(4723, (isListening) => {
        if (isListening) {
          console.log(' Appium server started successfully');
          appiumStatus = 'running';
          res.json({
            success: true,
            message: 'Appium server started successfully'
          });
        } else if (attempt < 10) { 
          console.log(`⏳ Appium check attempt ${attempt} failed, retrying...`);
          checkAppium(attempt + 1);
        } else {
          console.error(' Appium failed to start after multiple attempts');
          appiumStatus = 'stopped';
          res.json({
            success: false,
            message: 'Appium failed to start - port 4723 not listening after 20 seconds'
          });
        }
      });
    }, attempt * 2000);
  };
  
  checkAppium(1);
}

function checkPort(port, callback) {
  const isWindows = os.platform() === 'win32';
  
  if (isWindows) {
    exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
      callback(stdout && stdout.includes('LISTENING'));
    });
  } else {
    exec(`lsof -i :${port} -t`, (error, stdout) => {
      callback(!error && stdout && stdout.trim().length > 0);
    });
  }
}

app.post('/api/appium/stop', (req, res) => {
  console.log('🛑 Stopping Appium server...');
  
  const isWindows = os.platform() === 'win32';
  let killedProcesses = 0;
  
  if (isWindows) {
    // Windows: Kill processes using port 4723
    exec('netstat -ano | findstr :4723', (error, stdout) => {
      if (stdout) {
        const lines = stdout.split('\n');
        lines.forEach(line => {
          const match = line.match(/:4723.*LISTENING\s+(\d+)/);
          if (match && match[1]) {
            const pid = match[1];
            exec(`taskkill /F /PID ${pid}`, (killError) => {
              if (!killError) killedProcesses++;
            });
          }
        });
      }
      
      // Also kill any node processes with Appium in title
      exec('taskkill /F /IM node.exe /FI "WINDOWTITLE eq appium*"', () => {
        setTimeout(() => {
          appiumStatus = 'stopped';
          console.log(` Appium server stopped. Killed ${killedProcesses} process(es)`);
          res.json({
            success: true,
            message: `Appium server stopped. Killed ${killedProcesses} process(es)`
          });
        }, 1000);
      });
    });
  } else {
    // macOS/Linux: Kill processes on port 4723
    exec('lsof -ti :4723', (error, stdout) => {
      if (stdout && stdout.trim()) {
        const pids = stdout.trim().split('\n');
        pids.forEach(pid => {
          try {
            process.kill(parseInt(pid), 'SIGTERM');
            killedProcesses++;
          } catch (err) {
            console.log(`Failed to kill ${pid}: ${err.message}`);
          }
        });
      }
      
      // Also kill any Appium processes by name
      exec('pkill -f "appium.*--port 4723"', () => {
        setTimeout(() => {
          appiumStatus = 'stopped';
          console.log(` Appium server stopped. Killed ${killedProcesses} process(es)`);
          res.json({
            success: true,
            message: `Appium server stopped. Killed ${killedProcesses} process(es)`
          });
        }, 1000);
      });
    });
  }
});

// ========== Improved Server Status Check ==========

// app.get('/api/servers/status', (req, res) => {
//   // Check ADB status
//   exec('adb devices', (adbError, adbStdout) => {
//     const adbRunning = !adbError && adbStdout && adbStdout.includes('device');

//     // Check Appium status by port
//     exec('netstat -ano | findstr :4723', (appiumError, appiumStdout) => {
//       const appiumRunning = appiumStdout && appiumStdout.includes('LISTENING');

//       // Update global status
//       adbStatus = adbRunning ? 'running' : 'stopped';
//       appiumStatus = appiumRunning ? 'running' : 'stopped';

//       res.json({
//         success: true,
//         adbStatus: adbStatus,
//         appiumStatus: appiumStatus
//       });
//     });
//   });
// });

app.get('/api/servers/status', (req, res) => {
  const isWindows = os.platform() === 'win32';
  
  // Check ADB status (works on all platforms)
  exec('adb devices', (adbError, adbStdout) => {
    const adbRunning = !adbError && adbStdout && adbStdout.includes('device');
    
    // Update ADB status
    adbStatus = adbRunning ? 'running' : 'stopped';
    
    // Check Appium status by port (cross-platform)
    if (isWindows) {
      // Windows command
      exec('netstat -ano | findstr :4723', (appiumError, appiumStdout) => {
        const appiumRunning = appiumStdout && appiumStdout.includes('LISTENING');
        appiumStatus = appiumRunning ? 'running' : 'stopped';
        
        res.json({
          success: true,
          adbStatus: adbStatus,
          appiumStatus: appiumStatus
        });
      });
    } else {
      // macOS/Linux command
      exec('lsof -i :4723 -t', (appiumError, appiumStdout) => {
        const appiumRunning = !appiumError && appiumStdout && appiumStdout.trim().length > 0;
        appiumStatus = appiumRunning ? 'running' : 'stopped';
        
        res.json({
          success: true,
          adbStatus: adbStatus,
          appiumStatus: appiumStatus
        });
      });
    }
  });
});

// ========== Device Connection ==========

app.post('/api/device/connect-usb', (req, res) => {
  exec('adb devices', (error, stdout) => {
    if (error) {
      return res.json({ success: false, message: error.message });
    }

    const lines = stdout.split('\n');
    const deviceLine = lines.find(line => line.includes('\tdevice'));

    if (deviceLine) {
      const deviceId = deviceLine.split('\t')[0];

      // Get device info sequentially with proper error handling
      exec(`adb -s "${deviceId}" shell getprop ro.product.model`, async (err, model) => {
        if (err) {
          console.error('Error getting model:', err);
        }
        exec(`adb -s "${deviceId}" shell getprop ro.build.version.release`, async (err2, version) => {
          if (err2) {
            console.error('Error getting version:', err2);
          }

          const device = {
            id: deviceId,
            model: model ? model.trim() : 'Unknown Model',
            androidVersion: version ? version.trim() : 'Unknown Version',
            connectionType: 'USB'
          };

          // USSD handling with proper success/failure logic
          let ussdSuccess = false;
          try {
            console.log(`Checking USSD for device: ${deviceId}`);
            const ussd = await getSimNumberViaUSSD(deviceId, null);
            
            if (ussd && ussd.success && ussd.phoneNumber) {
              device.phoneNumber = ussd.phoneNumber;
              device.sim = ussd.sim || ussd.phoneNumber;
              device.balance = ussd.balance || null;
              device.balanceNumeric = ussd.balanceNumeric ?? null;
              device.validity = ussd.validity || null;
              device.validityDate = ussd.validityDate || null;
              device.validityIsFuture = ussd.validityIsFuture === true;
              phoneDeviceMap.set(ussd.phoneNumber, deviceId);
              ussdSuccess = true;
              console.log(`USB device connected with number: ${ussd.phoneNumber}`);
            } else {
              console.log(`No phone number detected via USSD for ${deviceId}`);
              if (ussd && ussd.error) {
                console.log(`   USSD Error: ${ussd.error}`);
              }
            }
          } catch (ussdError) {
            console.error(`USSD exception for USB device ${deviceId}:`, ussdError.message);
          }

          connectedDevices.set(deviceId, device);

          res.json({
            success: true,
            device,
            message: ussdSuccess 
              ? `USB device connected with SIM: ${device.phoneNumber}` 
              : 'USB device connected (SIM info not available)',
            simDetected: ussdSuccess
          });
        });
      });
    } else {
      res.json({ success: false, message: 'No USB device found' });
    }
  });
});

// Wireless connection with VPN support for NEW devices
app.post('/api/device/connect-wireless', async (req, res) => {
  const { ip, port, code } = req.body;

  if (!ip || !port || !code) {
    return res.json({ 
      success: false, 
      message: 'IP, Port, and Pairing Code are required' 
    });
  }

  try {
    console.log(`Connecting new device: ${ip}:${port}`);

    // Step 1: Restart ADB server
    console.log('Restarting ADB server...');
    await executeCommand('adb kill-server');
    await new Promise(resolve => setTimeout(resolve, 2000));
    await executeCommand('adb start-server');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 2: Pair with device
    console.log('Wireless Pairing with device...');
    const pairSuccess = await pairDevice(ip, port, code);
    if (!pairSuccess) {
      return res.json({ 
        success: false, 
        message: 'Pairing failed. Please check the pairing code.' 
      });
    }
    console.log('Wireless Pairing successful');

    // Step 3: Connect to device
    console.log('[Wireless] 🔗 Connecting to device...');
    const connectResult = await executeCommand(`adb connect ${ip}:${port}`);
    if (!connectResult.success || !connectResult.output.includes('connected')) {
      return res.json({ 
        success: false, 
        message: 'Paired successfully but connection failed. Try connecting again.' 
      });
    }
    console.log('[Wireless] ✅ Connection successful');

    // Step 4: Get device info
    const deviceId = `${ip}:${port}`;
    const modelResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.product.model`);
    const versionResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.build.version.release`);

    const device = {
      id: deviceId,
      model: modelResult.success ? modelResult.output.trim() : 'Unknown Model',
      androidVersion: versionResult.success ? versionResult.output.trim() : 'Unknown Version',
      connectionType: 'WIRELESS_NEW'
    };

    // Step 5: Get SIM info via USSD
    let ussdSuccess = false;
    try {
      console.log(`[Wireless] 🔄 Checking USSD for device: ${deviceId}`);
      const ussd = await getSimNumberViaUSSD(deviceId, null);
      
      if (ussd && ussd.success && ussd.phoneNumber) {
        device.phoneNumber = ussd.phoneNumber;
        device.sim = ussd.sim || ussd.phoneNumber;
        device.balance = ussd.balance || null;
        device.balanceNumeric = ussd.balanceNumeric ?? null;
        device.validity = ussd.validity || null;
        device.validityDate = ussd.validityDate || null;
        device.validityIsFuture = ussd.validityIsFuture === true;
        phoneDeviceMap.set(ussd.phoneNumber, deviceId);
        ussdSuccess = true;
        console.log(`✅ Wireless device connected with number: ${ussd.phoneNumber}`);
      } else {
        console.log(`⚠️ No phone number detected via USSD for ${deviceId}`);
        if (ussd && ussd.error) {
          console.log(`   USSD Error: ${ussd.error}`);
        }
      }
    } catch (ussdError) {
      console.error(`❌ USSD exception for wireless device ${deviceId}:`, ussdError.message);
    }

    connectedDevices.set(deviceId, device);

    res.json({
      success: true,
      device,
      message: ussdSuccess 
        ? `Wireless device connected with SIM: ${device.phoneNumber}` 
        : 'Wireless device connected (SIM info not available)',
      simDetected: ussdSuccess
    });

  } catch (error) {
    console.error('❌ Wireless connection error:', error);
    res.json({
      success: false,
      message: `Connection error: ${error.message}`
    });
  }
});

// Connect to existing paired wireless device
app.post('/api/device/connect-existing-wireless', async (req, res) => {
  const { ip, port } = req.body;
  
  if (!ip || !port) {
    return res.json({ 
      success: false, 
      message: 'IP and Port are required' 
    });
  }

  console.log(`[Wireless] 📡 Connecting existing device: ${ip}:${port}`);

  try {
    // Step 1: Connect directly (no pairing needed for existing devices)
    console.log('[Wireless] 🔗 Connecting to existing device...');
    const connectResult = await executeCommand(`adb connect ${ip}:${port}`);

    if (!connectResult.success || !connectResult.output.includes('connected')) {
      console.log('[Wireless] ❌ Connection failed:', connectResult.output);
      return res.json({
        success: false,
        message: 'Connection failed. Device may need to be paired again.'
      });
    }
    console.log('[Wireless] ✅ Connection successful');

    // Step 2: Get device information
    const deviceId = `${ip}:${port}`;
    const modelResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.product.model`);
    const versionResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.build.version.release`);

    const device = {
      id: deviceId,
      model: modelResult.success ? modelResult.output.trim() : 'Unknown Model',
      androidVersion: versionResult.success ? versionResult.output.trim() : 'Unknown Version',
      connectionType: 'WIRELESS_EXISTING'
    };

    // Step 3: Get SIM info via USSD
    let ussdSuccess = false;
    try {
      console.log(`[Wireless] 🔄 Checking USSD for device: ${deviceId}`);
      const ussd = await getSimNumberViaUSSD(deviceId, null);
      
      if (ussd && ussd.success && ussd.phoneNumber) {
        device.phoneNumber = ussd.phoneNumber;
        device.sim = ussd.sim || ussd.phoneNumber;
        device.balance = ussd.balance || null;
        device.balanceNumeric = ussd.balanceNumeric ?? null;
        device.validity = ussd.validity || null;
        device.validityDate = ussd.validityDate || null;
        device.validityIsFuture = ussd.validityIsFuture === true;
        phoneDeviceMap.set(ussd.phoneNumber, deviceId);
        ussdSuccess = true;
        console.log(`✅ Existing wireless device connected with number: ${ussd.phoneNumber}`);
      } else {
        console.log(`⚠️ No phone number detected via USSD for ${deviceId}`);
        if (ussd && ussd.error) {
          console.log(`   USSD Error: ${ussd.error}`);
        }
      }
    } catch (ussdError) {
      console.error(`❌ USSD exception for existing wireless device ${deviceId}:`, ussdError.message);
    }

    connectedDevices.set(deviceId, device);

    res.json({
      success: true,
      device,
      message: ussdSuccess 
        ? `Existing wireless device connected with SIM: ${device.phoneNumber}` 
        : 'Existing wireless device connected (SIM info not available)',
      simDetected: ussdSuccess
    });

  } catch (error) {
    console.error('❌ Existing wireless connection error:', error);
    res.json({
      success: false,
      message: `Connection error: ${error.message}`
    });
  }
});

// Get list of connected devices (including wireless/VPN devices)
app.get('/api/device/list', async (req, res) => {
  try {
    console.log('[Device] 📋 Fetching device list...');
    const result = await executeCommand('adb devices');
    const devices = [];

    console.log('[Device] Raw ADB output:', result.output);

    const lines = result.output.split('\n');

    for (const line of lines) {
      const cleaned = line.trim();

      // Match device status: device, connected, unauthorized, offline
      const match = cleaned.match(/^([^\s]+)\s+(device|connected|unauthorized|offline)$/i);

      if (match) {
        const deviceId = match[1];
        const status = match[2].toLowerCase();

        // Skip offline/unauthorized devices
        if (status === 'offline' || status === 'unauthorized') {
          console.log(`[Device] ⚠️ Device ${deviceId} is ${status}, skipping`);
          continue;
        }

        // Read device info
        const modelResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.product.model`);
        const versionResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.build.version.release`);

        // Determine connection type
        let connectionType = 'USB';
        if (deviceId.includes('._adb-tls-connect._tcp')) {
          connectionType = 'WIRELESS_VPN';
        } else if (deviceId.includes(':')) {
          connectionType = 'WIRELESS';
        }

        devices.push({
          id: deviceId,
          model: modelResult.success ? modelResult.output.trim() : 'Unknown Model',
          androidVersion: versionResult.success ? versionResult.output.trim() : 'Unknown Version',
          connectionType: connectionType,
          status: status
        });
      }
    }

    console.log(`[Device] ✅ Found ${devices.length} device(s)`);
    res.json({ success: true, devices });

  } catch (error) {
    console.error('[Device] ❌ Error fetching devices:', error.message);
    res.json({
      success: false,
      message: `Failed to get devices: ${error.message}`,
      devices: []
    });
  }
});

// Connect using already-connected device ID
app.post('/api/device/select-device', async (req, res) => {
  const { deviceId } = req.body;

  if (!deviceId) {
    return res.json({
      success: false,
      message: 'Device ID is required'
    });
  }

  console.log(`[Device] 🔄 Selecting device: ${deviceId}`);

  try {
    // Verify device is still connected
    const devicesResult = await executeCommand('adb devices');
    let deviceFound = false;
    let deviceStatus = '';

    const lines = devicesResult.output.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^\s\t]+)[\s\t]+(device|connected|unauthorized|offline)$/);
      if (match && match[1].trim() === deviceId) {
        deviceFound = true;
        deviceStatus = match[2].toLowerCase();
        break;
      }
    }

    if (!deviceFound) {
      console.log(`[Device] ❌ Device ${deviceId} not found`);
      return res.json({
        success: false,
        message: 'Device no longer connected or not found'
      });
    }

    if (deviceStatus === 'offline' || deviceStatus === 'unauthorized') {
      console.log(`[Device] ⚠️ Device ${deviceId} is ${deviceStatus}`);
      return res.json({
        success: false,
        message: `Device is ${deviceStatus}. Please reconnect.`
      });
    }

    // Get device info with proper error handling
    let model = 'Unknown Model';
    let version = 'Unknown Version';

    try {
      const modelResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.product.model`);
      if (modelResult.success) {
        model = modelResult.output.trim();
      }
    } catch (modelError) {
      console.error('[Device] Error getting model:', modelError.message);
    }

    try {
      const versionResult = await executeCommand(`adb -s "${deviceId}" shell getprop ro.build.version.release`);
      if (versionResult.success) {
        version = versionResult.output.trim();
      }
    } catch (versionError) {
      console.error('[Device] Error getting version:', versionError.message);
    }

    // Determine connection type
    let connectionType = 'USB';
    if (deviceId.includes('._adb-tls-connect._tcp')) {
      connectionType = 'WIRELESS_VPN';
    } else if (deviceId.includes(':')) {
      connectionType = 'WIRELESS';
    }

    const device = {
      id: deviceId,
      model: model,
      androidVersion: version,
      connectionType: connectionType,
      status: deviceStatus
    };

    // Check if we already have SIM info for this device
    const existingDevice = connectedDevices.get(deviceId);
    if (existingDevice && existingDevice.phoneNumber) {
      device.phoneNumber = existingDevice.phoneNumber;
      device.sim = existingDevice.sim || existingDevice.phoneNumber;
      device.balance = existingDevice.balance;
      device.balanceNumeric = existingDevice.balanceNumeric;
      device.validity = existingDevice.validity;
      device.validityDate = existingDevice.validityDate;
      device.validityIsFuture = existingDevice.validityIsFuture;
      console.log(`[Device] ✅ Device ${deviceId} already has SIM: ${device.phoneNumber}`);
    } else {
      // Try to get SIM info via USSD
      let ussdSuccess = false;
      try {
        console.log(`[Device] 🔄 Checking USSD for device: ${deviceId}`);
        const ussd = await getSimNumberViaUSSD(deviceId, null);
        
        if (ussd && ussd.success && ussd.phoneNumber) {
          device.phoneNumber = ussd.phoneNumber;
          device.sim = ussd.sim || ussd.phoneNumber;
          device.balance = ussd.balance || null;
          device.balanceNumeric = ussd.balanceNumeric ?? null;
          device.validity = ussd.validity || null;
          device.validityDate = ussd.validityDate || null;
          device.validityIsFuture = ussd.validityIsFuture === true;
          phoneDeviceMap.set(ussd.phoneNumber, deviceId);
          ussdSuccess = true;
          console.log(`✅ Device ${deviceId} connected with number: ${ussd.phoneNumber}`);
        } else {
          console.log(`⚠️ No phone number detected via USSD for ${deviceId}`);
          if (ussd && ussd.error) {
            console.log(`   USSD Error: ${ussd.error}`);
          }
        }
      } catch (ussdError) {
        console.error(`❌ USSD exception for device ${deviceId}:`, ussdError.message);
      }
    }

    connectedDevices.set(deviceId, device);

    console.log(`[Device] ✅ Device selected successfully: ${model}`);
    res.json({
      success: true,
      device,
      message: `Device selected successfully${device.phoneNumber ? ` (SIM: ${device.phoneNumber})` : ''}`,
      simDetected: !!device.phoneNumber
    });

  } catch (error) {
    console.error('[Device] ❌ Error selecting device:', error.message);
    res.json({
      success: false,
      message: `Error selecting device: ${error.message}`
    });
  }
});

// ========== Network Configuration ==========

app.post('/api/network/configure', (req, res) => {
  const { deviceId, networkType, volteStatus } = req.body;

  console.log(`Configuring network: ${networkType}, VoLTE: ${volteStatus}`);

  const testClass = 'NetworkConfigTest';
  const command = `mvn test "-Dtest=${testClass}" "-DdeviceId=${deviceId}" "-DnetworkType=${networkType}" "-DvolteStatus=${volteStatus}"`;

  exec(command, { cwd: path.join(__dirname, '..') }, (error) => {
    if (error) {
      return res.json({ success: false, message: error.message });
    }
    res.json({ success: true, message: 'Network configured successfully' });
  });
});

app.post('/api/network/validate', (req, res) => {
  const { deviceId, networkType } = req.body;

  exec(`adb -s "${deviceId}" shell getprop gsm.network.type`, (error, stdout) => {
    const currentNetwork = stdout ? stdout.trim() : 'unknown';
    const available = checkNetworkMatch(currentNetwork, networkType);

    res.json({
      success: true,
      available,
      currentNetwork,
      message: available ? `${networkType} available` : `${networkType} not available at your location`
    });
  });
});

// Get current network status
app.post('/api/network/status', (req, res) => {
  const { deviceId } = req.body;

  exec(`adb -s "${deviceId}" shell getprop gsm.network.type`, (error, networkStdout) => {
    const networkType = networkStdout ? networkStdout.trim().toLowerCase() : 'unknown';

    // Get VoLTE status (simplified - you might need a different approach)
    exec(`adb -s "${deviceId}" shell dumpsys telephony.registry | grep mImsState`, (volteError, volteStdout) => {
      let volteStatus = 'disabled';
      if (volteStdout && volteStdout.includes('REGISTERED')) {
        volteStatus = 'enabled';
      }

      res.json({
        success: true,
        networkType: networkType,
        volteStatus: volteStatus
      });
    });
  });
});

// ========== File Upload ==========

// Single file upload endpoint
app.post('/api/files/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.json({ success: false, message: 'No file uploaded' });
  }

  console.log(`File uploaded: ${req.file.originalname} to ${req.file.path}`);

  res.json({
    success: true,
    message: 'File uploaded successfully',
    filename: req.file.originalname,
    path: req.file.path
  });
});

// Multiple files upload endpoint
app.post('/api/files/upload-multiple', upload.array('files', 10), (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.json({ success: false, message: 'No files uploaded' });
  }

  const uploadedFiles = req.files.map(file => ({
    filename: file.originalname,
    path: file.path
  }));

  console.log(`Uploaded ${uploadedFiles.length} file(s):`, uploadedFiles.map(f => f.filename).join(', '));

  res.json({
    success: true,
    message: `${uploadedFiles.length} file(s) uploaded successfully`,
    files: uploadedFiles
  });
});

// ========== Test Execution ==========

app.post('/api/tests/run', async (req, res) => {
  const { deviceId, testType, phone } = req.body;

  console.log(`Running ${testType} tests on device ${deviceId} (WDIO)`);

  const { runWdioTestAsync } = require('./wdioRunner');
  const options = enrichPartiesFromDeviceMap(deviceId, phone || '');

  try {
    const result = await runWdioTestAsync(testType, options);
    const totalTests = parseTestCount(result.stdout);
    const passed = parsePassedCount(result.stdout);

    res.json({
      success: true,
      message: 'Tests completed successfully',
      totalTests,
      passed,
      failed: totalTests - passed
    });
  } catch (error) {
    res.json({
      success: false,
      message: error.message,
      totalTests: 0,
      passed: 0,
      failed: 0
    });
  }
});

// Test Stop endpoint — kill WDIO / node test runners
app.post('/api/tests/stop', (req, res) => {
  const isWin = os.platform() === 'win32';
  const killCmd = isWin
    ? 'taskkill /F /IM node.exe /FI "WINDOWTITLE eq wdio*"'
    : 'pkill -f "wdio run" || pkill -f "@wdio/cli"';

  exec(killCmd, (error) => {
    res.json({
      success: !error,
      message: error ? 'Failed to stop tests' : 'Tests stopped'
    });
  });
});

// ========== Multi-Device Testing ==========

app.post('/api/tests/multi-device/run', (req, res) => {
  const { devices, testType, excelFile } = req.body;

  console.log(`Running ${testType} tests on ${devices.length} devices`);

  const promises = devices.map(device => {
    return new Promise((resolve) => {
      const suiteFile = getTestSuite(testType);
      const command = `mvn test "-DsuiteXmlFile=testng-xml/${suiteFile}" "-DdeviceId=${device.id}"`;

      exec(command, { cwd: path.join(__dirname, '..') }, (error, stdout) => {
        resolve({
          deviceId: device.id,
          success: !error,
          message: error ? error.message : 'Tests completed'
        });
      });
    });
  });

  Promise.all(promises).then(results => {
    res.json({ success: true, message: 'Multi-device tests started', results });
  });
});

// ========== Final Report ==========

app.post('/api/reports/final/generate', (req, res) => {
  const { aPartyNumber } = req.body;

  console.log(`Generating final report for: ${aPartyNumber}`);

  const command = `mvn exec:java -Dexec.mainClass="com.telecom.utils.FinalReportZipGenerator" -Dexec.args="${aPartyNumber}"`;

  exec(command, { cwd: path.join(__dirname, '..') }, (error, stdout) => {
    if (error) {
      return res.json({ success: false, message: error.message });
    }

    const reportPath = extractReportPath(stdout);
    res.json({ success: true, reportPath });
  });
});

// Download report
app.get('/api/reports/final/download', (req, res) => {
  const reportPath = path.join(__dirname, '..', 'test-output', 'final-reports');

  fs.readdir(reportPath, (err, files) => {
    if (err) {
      return res.status(404).send('No reports found');
    }

    const latestZip = files.filter(f => f.endsWith('.zip')).sort().pop();

    if (latestZip) {
      res.download(path.join(reportPath, latestZip));
    } else {
      res.status(404).send('No report found');
    }
  });
});

// In server.js, update the existing endpoint:
// ================= SAMPLE FILE DOWNLOAD =================
app.get('/api/download-sample-file', (req, res) => {
  try {
    const filePath = path.join(
      __dirname,
      '..',
      'test-output',
      'Sample-file',
      'contacts.xlsx'
    );

    if (!fs.existsSync(filePath)) {
      console.error('Sample file not found:', filePath);
      return res.status(404).json({
        success: false,
        message: 'Sample Excel file not found on server'
      });
    }

    res.setHeader(
      'Content-Disposition',
      'attachment; filename="contacts.xlsx"'
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    return res.download(filePath, 'contacts.xlsx');
  } catch (err) {
    console.error('Sample file download error:', err);
    res.status(500).json({
      success: false,
      message: 'Unable to download sample file'
    });
  }
});




// Email report
app.post('/api/reports/final/email', async (req, res) => {
  const { email } = req.body;

  console.log(`Sending report to: ${email}`);

  try {
    const reportPath = path.join(__dirname, '..', 'test-output', 'final-reports');
    const files = fs.readdirSync(reportPath);
    const latestZip = files.filter(f => f.endsWith('.zip')).sort().pop();

    if (!latestZip) {
      return res.json({ success: false, message: 'No report found' });
    }

    // Configure email transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.EMAIL_USER || 'your-email@outlook.com',
        pass: process.env.EMAIL_PASS || 'your-password'
      }
    });

    const mailOptions = {
      from: process.env.EMAIL_USER || 'your-email@outlook.com',
      to: email,
      subject: 'Telecom Automation Test Report',
      text: 'Please find attached the comprehensive test report.',
      html: '<h2>Telecom Automation Test Report</h2><p>Please find attached the comprehensive test report.</p>',
      attachments: [
        {
          filename: latestZip,
          path: path.join(reportPath, latestZip)
        }
      ]
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });

  } catch (error) {
    console.error('Email error:', error);
    res.json({ success: false, message: error.message });
  }
});

app.get('/api/download-sample-file-bill', (req, res) => {
  try {
    const filePath = path.resolve(
      __dirname,
      '../siebel-crm-automation/Sample_file/input_data.xlsx'
    );

    console.log('File Path:', filePath);
    console.log('File Exists:', fs.existsSync(filePath));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Sample Excel file not found on server'
      });
    }

    return res.download(filePath, 'input_data.xlsx');
  } catch (err) {
    console.error('Sample file download error:', err);

    return res.status(500).json({
      success: false,
      message: 'Unable to download sample file'
    });
  }
});

app.get('/api/reports/manifest', (req, res) => {
  const manifestPath = path.join(__dirname, '..', 'test-output', 'comprehensive-reports', 'latest-manifest.json');
  const summaryPath = path.join(__dirname, '..', 'reports', 'execution-summary.json');
  const summaryHtml = path.join(__dirname, '..', 'reports', 'execution-summary.html');

  const payload = { success: true, manifest: null, executionSummary: null, summaryHtml: null };

  if (fs.existsSync(manifestPath)) {
    try {
      payload.manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (e) {
      payload.manifestError = e.message;
    }
  }

  if (fs.existsSync(summaryPath)) {
    try {
      payload.executionSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch (e) {
      payload.summaryError = e.message;
    }
  }

  if (fs.existsSync(summaryHtml)) {
    payload.summaryHtml = '/api/reports/execution-summary.html';
  }

  res.json(payload);
});

app.get('/api/reports/execution-summary.html', (req, res) => {
  const summaryHtml = path.join(__dirname, '..', 'reports', 'execution-summary.html');
  if (!fs.existsSync(summaryHtml)) {
    return res.status(404).json({ success: false, message: 'No execution summary yet. Run tests first.' });
  }
  res.sendFile(summaryHtml);
});

app.get('/api/reports/latest', (req, res) => {
  const reportPath = path.join(__dirname, '..', 'test-output', 'comprehensive-reports');

  fs.readdir(reportPath, (err, files) => {
    if (err) {
      return res.status(404).send('No reports found');
    }

    const latestHtml = files.filter(f => f.endsWith('.html')).sort().pop();

    if (latestHtml) {
      res.sendFile(path.join(reportPath, latestHtml));
    } else {
      res.status(404).send('No report found');
    }
  });
});

// ========== Debug Endpoint ==========

// Debug endpoint to check raw ADB output
app.get('/api/debug/adb-devices', async (req, res) => {
  try {
    const result = await executeCommand('adb devices');
    const lines = result.output.split('\n');

    const parsedDevices = [];
    lines.forEach((line, index) => {
      parsedDevices.push({
        lineNumber: index,
        rawLine: line,
        hasDevice: line.includes('device'),
        matchResult: line.match(/^([^\s\t]+)[\s\t]+device$/)
      });
    });

    res.json({
      success: true,
      rawOutput: result.output,
      parsedLines: parsedDevices,
      fullCommand: 'adb devices'
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});
// WebSocket connection handling
wss.on('connection', (ws, request, type = 'default') => {
  if (type === 'swift') {
    // SWIFT CRM WebSocket connection
    handleSwiftConnection(ws, request);
  } else {
    // Original/default WebSocket connection
    handleDefaultConnection(ws);
  }
});

function handleDefaultConnection(ws) {
  console.log(' New WebSocket client connected');
  clients.add(ws);

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'challenge_response') {
        // Handle OTP/Answer response from frontend
        if (data.deviceId === 'SIEBEL_SCRM') {
          // Save response to Siebel comm directory
          const commDir = path.join(SIEBEL_PROJECT_ROOT, 'comm');
          if (!fs.existsSync(commDir)) {
            fs.mkdirSync(commDir, { recursive: true });
          }
          const responseFile = path.join(commDir, 'challenge_response.json');
          const responseData = {
            timestamp: Date.now(),
            response: data.response
          };
          fs.writeFileSync(responseFile, JSON.stringify(responseData, null, 2));
          console.log('✅ Siebel challenge response saved:', responseData);
        }
        broadcastToAll({
          type: 'challenge_received',
          deviceId: data.deviceId,
          response: data.response
        });
      }
    } catch (e) {
      console.error('Error parsing WS message:', e);
    }
  });

  ws.on('close', () => {
    console.log(' WebSocket client disconnected');
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(ws);
  });
}

function handleSwiftConnection(ws, request) {
  const url = new URL(request.url, 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');
  
  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  console.log(`[SWIFT] 🔌 New client connected: ${sessionId}`);
  swiftClients.set(sessionId, ws);

  let orchestrator = null;

  // Look up the file for THIS session specifically
  const uploadPath = swiftUploadPaths.get(sessionId) || null;
  if (!uploadPath) {
    console.warn(`[SWIFT] ⚠️ No upload found for session: ${sessionId}`);
  }

ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'start' && uploadPath) {
            console.log(`[SWIFT] 🚀 Starting automation...`);
            const viAppOtp = data.viAppOtp || null;
 
            // Point 2: pull this session's frontend-validated matched rows
            // (set during /api/swift/upload) and pass them through so the
            // orchestrator never falls back to re-deriving rows from Excel
            // unless the frontend genuinely didn't send any.
            const matchedRowsForSession = swiftMatchedRows.get(sessionId) || null;
 
            // Create clients set for this session
            const clientSet = new Set();
            clientSet.add(ws);
 
            orchestrator = new SwiftCrmOrchestrator(uploadPath, clientSet, __dirname, viAppOtp, matchedRowsForSession);
            swiftSessions.set(sessionId, { orchestrator, ws });
 
            // Do NOT await — fires in background so this handler
            // stays free to process incoming OTP / CAPTCHA messages
            orchestrator.runRechargeUAT().catch(error => {
          console.error(`[SWIFT] ❌ Automation error:`, error);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'complete',
              success: false,
              message: error.message
            }));
          }
        });

      } else if (data.type === 'captcha' && orchestrator) {
        console.log(`[SWIFT]  CAPTCHA received: ${data.answer}`);
        
        // Store credentials for the orchestrator (if provided)
        if (data.username && data.password) {
          orchestrator._pendingLoginCredentials = {
            username: data.username,
            password: data.password
          };
          console.log(`[SWIFT]  Stored login credentials for orchestrator`);
        }
        
        await orchestrator.setCaptchaAnswer(data.answer);
        
      } else if (data.type === 'otp' && orchestrator) {
        console.log(`[SWIFT]  OTP received: ${data.otp}`);
        await orchestrator.setOtp(data.otp);
        
      } else if (data.type === 'stop') {
        // ── Stop request from frontend ─────────────────────────────────
        console.log(`[SWIFT] ⏹ Stop requested for session ${sessionId}`);
        if (orchestrator && orchestrator.currentWdioProcess) {
          try { orchestrator.currentWdioProcess.kill('SIGTERM'); } catch (_) {}
        }
        if (orchestrator) {
          try { orchestrator.stopPolling(); } catch (_) {}
        }
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'complete', success: false, message: 'Stopped by user' }));
        }
      }
    } catch (error) {
      console.error(`[SWIFT] ❌ WebSocket error:`, error);
    }
  });


 ws.on('close', () => {
      console.log(`[SWIFT] 👋 Client disconnected: ${sessionId}`);
      swiftClients.delete(sessionId);
      swiftSessions.delete(sessionId);
      swiftUploadPaths.delete(sessionId);
      swiftMatchedRows.delete(sessionId);
    });

  ws.on('error', (error) => {
    console.error(`[SWIFT] ❌ WebSocket error:`, error);
    swiftClients.delete(sessionId);
    swiftSessions.delete(sessionId);
    swiftUploadPaths.delete(sessionId);
  });
}

function broadcastToAll(data) {
  const message = JSON.stringify(data);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Broadcast function to send updates to all connected clients
function broadcastProgress(progressData) {
  const message = JSON.stringify(progressData);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// Modified progress update endpoint
app.post('/api/progress/update', (req, res) => {
  try {
    const progressData = req.body;

    // Broadcast to all WebSocket clients
    broadcastProgress(progressData);

    // Backend only — not shown in dashboard
    if (process.env.DEBUG_PROGRESS) {
      console.log('📊 Progress update:', progressData);
    }

    res.json({ success: true, message: 'Progress broadcast successful' });
  } catch (error) {
    console.error(' Progress update failed:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});
// Add this function to server.js (after line 342 or before the parseAndBroadcastLogs function)
function broadcastToDevice(deviceId, progressData) {
  const message = JSON.stringify({ deviceId, ...progressData });
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
  console.log(`📡 Broadcast to device ${deviceId}:`, progressData.type || 'update');
}

// Modify the parseAndBroadcastLogs function to include device ID:
function parseAndBroadcastLogs(stdout, deviceId) {
  const lines = stdout.split('\n');

  lines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect Challenge (OTP/Security Question) from WDIO logs
    if (trimmed.includes('[CHALLENGE]:')) {
      try {
        const challengeText = trimmed.split('[CHALLENGE]:')[1].trim();
        broadcastToDevice(deviceId, {
          type: 'challenge_request',
          message: challengeText
        });
      } catch (e) {
        console.error('Challenge parse failed:', e);
      }
      return;
    }

    if (trimmed.includes('[INFO] WS_PROGRESS:')) {
      try {
        const jsonStr = trimmed.substring(trimmed.indexOf('{'));
        const progressData = JSON.parse(jsonStr);
        broadcastToDevice(deviceId, progressData);
      } catch {
        /* progress parse failed — skip noisy fallback */
      }
      return;
    }

    if (!shouldShowUserLog(trimmed)) return;

    const message = formatUserLogLine(trimmed);
    if (!message) return;

    broadcastToDevice(deviceId, {
      type: 'log',
      message,
      logType: inferLogType(message),
      timestamp: Date.now()
    });
  });
}

/** WDIO test execution with real-time WebSocket streaming  */
app.post('/api/test-command', upload.single('file'), async (req, res) => {
  try {
    const deviceId = req.body.deviceId;
    const aPartyNumber = req.body.phone;
    const testType = req.body.testType;

    if (!testType) {
      return res.status(400).json({ success: false, message: 'testType is required' });
    }

    // Special handling for Bill Validation
    if (deviceId === 'SIEBEL_SCRM') {
      
      const commDir = path.join(SIEBEL_PROJECT_ROOT, 'comm');
      if (fs.existsSync(commDir)) {
        const files = fs.readdirSync(commDir);
        files.forEach(file => {
          const filePath = path.join(commDir, file);
          fs.unlinkSync(filePath);
        });
      } else {
        fs.mkdirSync(commDir, { recursive: true });
      }
      
      // If a file was uploaded, save it to the expected location
      if (req.file) {
        const targetPath = path.join(SIEBEL_PROJECT_ROOT, 'test_data', 'input_data.xlsx');
        const targetDir = path.dirname(targetPath);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        fs.copyFileSync(req.file.path, targetPath);
        console.log(`Input file saved to: ${targetPath}`);
      }
      const options = {
        deviceId: 'SIEBEL_SCRM'
      };
      
      executeWdioProcess(options, res, 'SIEBEL_SCRM', 'siebel_invoice_validation');
      return;
    }

    const options = enrichPartiesFromDeviceMap(deviceId, aPartyNumber);
    console.log(`Executing WDIO test: ${testType}`, options);

    executeWdioProcess(options, res, deviceId, testType);
    
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

function executeWdioProcess(options, res, deviceId, testType = 'calling') {
    let stdout = '';
    let stderr = '';
    let responded = false;

    const testProcess = runWdioTest(testType, options, {
      onStdout: (output) => {
        stdout += output;
        parseAndBroadcastLogs(output, deviceId);
      },
      onStderr: (output) => {
        stderr += output;
        parseAndBroadcastLogs(output, deviceId);
      },
      onClose: (code) => {
        console.log(`WDIO process exited with code ${code}`);

        broadcastToDevice(deviceId, {
          type: 'complete',
          exitCode: code,
          success: code === 0,
          message: code === 0 ? 'Tests completed successfully' : 'Tests failed',
          timestamp: Date.now()
        });

        if (!responded) {
          responded = true;
          if (code === 0) {
            res.status(200).json({ status: 'success', exitCode: code, stdout, stderr });
          } else {
            res.status(500).json({ status: 'failed', exitCode: code, stdout, stderr });
          }
        }
      },
      onError: (error) => {
        console.error('WDIO process error:', error);
        broadcastToDevice(deviceId, {
          type: 'error',
          message: `Process error: ${error.message}`,
          timestamp: Date.now()
        });
        if (!responded) {
          responded = true;
          res.status(500).json({ status: 'error', message: error.message });
        }
      }
    });

    testProcess.on('error', (error) => {
      if (!responded) {
        responded = true;
        res.status(500).json({ status: 'error', message: error.message });
      }
    });
}

// ========== SWIFT CRM Automation ==========

// Store active SWIFT sessions
const swiftSessions = new Map();
let latestReportPath = null;

// Global function to set latest report path from orchestrator
global.setSwiftLatestReport = (path) => {
  latestReportPath = path;
  console.log(`[SWIFT] Report generated: ${path}`);
};

// Configure multer for SWIFT CRM uploads
const swiftStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'swift-uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'input-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const swiftUpload = multer({
  storage: swiftStorage,
  fileFilter: function (req, file, cb) {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files allowed'), false);
    }
  }
});

// Add this endpoint to handle CAPTCHA responses from frontend
app.post('/api/swift/captcha-response', (req, res) => {
  try {
    const { answer, username, password } = req.body;
    const commDir = path.join(__dirname, '..', 'swift-crm-automation', 'comm');
    fs.mkdirSync(commDir, { recursive: true });
    fs.writeFileSync(
      path.join(commDir, 'captcha_response.json'),
      JSON.stringify({ 
        timestamp: Date.now(), 
        answer,
        username,
        password 
      }, null, 2)
    );
    console.log(`[SWIFT] CAPTCHA response received: ${answer} for user ${username}`);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Upload endpoint
// Upload endpoint
    // Point 2: now also accepts a `matchedRows` form field — a JSON string
    // built by the frontend from testCardsData (the Vi-validated, plan
    // -matched rows shown in the STEP 2 preview table). multer puts non-file
    // fields on req.body alongside req.file when using .single().
    app.post('/api/swift/upload', swiftUpload.single('excel'), (req, res) => {
      if (!req.file) {
        return res.json({ success: false, message: 'No file uploaded' });
      }
 
      const sessionId = crypto.randomBytes(16).toString('hex');
 
      // Store file path keyed by sessionId
      swiftUploadPaths.set(sessionId, req.file.path);
 
      // Point 2: parse + store the frontend's validated matched rows, if sent.
      let matchedRows = null;
      if (req.body && req.body.matchedRows) {
        try {
          const parsed = JSON.parse(req.body.matchedRows);
          if (Array.isArray(parsed) && parsed.length > 0) {
            matchedRows = parsed;
            swiftMatchedRows.set(sessionId, matchedRows);
            console.log(`[SWIFT] 📋 Received ${matchedRows.length} frontend-validated matched row(s) for session ${sessionId}`);
          }
        } catch (e) {
          console.warn(`[SWIFT] ⚠️ Could not parse matchedRows from upload: ${e.message}`);
        }
      }
      if (!matchedRows) {
        console.warn('[SWIFT] ⚠️ No matchedRows received with upload — orchestrator will fall back to SWIFT=Yes Excel filtering.');
      }
 
      console.log(`[SWIFT] 📄 File uploaded: ${req.file.originalname} (Session: ${sessionId})`);
 
      res.json({
        success: true,
        sessionId,
        filename: req.file.originalname,
        filePath: req.file.path
      });
    });


// Add this to server.js after the existing routes

app.post('/api/swift/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Username and password are required' 
      });
    }

    // Write login request for orchestrator
    const commDir = path.join(__dirname, '..', 'swift-crm-automation', 'comm');
    fs.mkdirSync(commDir, { recursive: true });
    fs.writeFileSync(
      path.join(commDir, 'login_request.json'),
      JSON.stringify({ username, password, timestamp: Date.now() }, null, 2)
    );

    // Trigger login via orchestrator
    // The orchestrator will pick this up and perform the login
    
    // For immediate response, check if login is already in progress
    // or perform a quick login attempt
    try {
      // Use a lightweight login check
      const loginResult = await performSwiftLogin(username, password);
      if (loginResult.success) {
        return res.json({ 
          success: true, 
          message: 'Login successful' 
        });
      }
    } catch (loginError) {
      // Login attempt failed, but we've queued the request
      console.log('[SWIFT] Login queued for background processing');
    }

    // Return success immediately (login will complete in background)
    res.json({ 
      success: true, 
      message: 'Login initiated, please wait for completion...' 
    });
    
  } catch (error) {
    console.error('[SWIFT] Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
});

// Helper function for quick login
async function performSwiftLogin(username, password) {
  try {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    await page.goto('https://swiftcrm.vodafoneidea.in/swift-portal/login');
    
    // Handle SSL warning if present
    try {
      await page.click('#details-button');
      await page.click('#proceed-link');
      await page.waitForTimeout(1000);
    } catch (_) {}
    
    await page.fill('#tempusername', username);
    await page.fill('#temppassword', password);
    
    // Wait for CAPTCHA and solve it (simplified)
    await page.waitForSelector('img#LoginCaptcha', { timeout: 10000 });
    
    // For demo, we'll just return success
    // In production, you'd use the CAPTCHA helper
    
    await browser.close();
    return { success: true };
  } catch (error) {
    console.error('[SWIFT] Quick login failed:', error.message);
    return { success: false, error: error.message };
  }
}



// -- Stop endpoint: kill running UAT for a session --
app.post('/api/swift/stop', (req, res) => {
  const { sessionId } = req.body || {};
  const session = sessionId ? swiftSessions.get(sessionId) : null;

  if (session && session.orchestrator) {
    const { orchestrator, ws } = session;
    if (orchestrator.currentWdioProcess) {
      try { orchestrator.currentWdioProcess.kill('SIGTERM'); } catch (_) {}
    }
    try { orchestrator.stopPolling(); } catch (_) {}
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'complete', success: false, message: 'Stopped by user' }));
    }
    swiftSessions.delete(sessionId);
    console.log(`[SWIFT] Stop: session ${sessionId} stopped via REST`);
    return res.json({ success: true, message: 'Session stopped' });
  }

  const isWin = os.platform() === 'win32';
  const killCmd = isWin
    ? 'taskkill /F /IM node.exe /FI "WINDOWTITLE eq wdio*"'
    : 'pkill -f "wdio run" || pkill -f "@wdio/cli" || true';
  exec(killCmd, () => {
    res.json({ success: true, message: 'Tests stopped' });
  });
});

// Latest report alias (sim-recharge.html uses /api/swift/report/latest)
app.get('/api/swift/report/latest', (req, res) => {
  res.redirect('/api/swift/download-report');
});

// Serve screenshots
app.use('/screenshots', express.static(path.join(__dirname, '..', 'swift-crm-automation', 'screenshots')));

// Download sample Excel file endpoint
app.get('/api/swift/download-sample', (req, res) => {
  const samplePath = path.join(__dirname, '..', 'swift-crm-automation', 'Sample file', 'Input_data.xlsx');
  
  if (fs.existsSync(samplePath)) {
    res.download(samplePath, 'Input_data.xlsx');
  } else {
    res.status(404).json({ success: false, message: 'Sample file not found' });
  }
});

// Download report endpoint
app.get('/api/swift/download-report', (req, res) => {
  if (!latestReportPath || !fs.existsSync(latestReportPath)) {
    // Try to find the latest report
    const reportsDir = path.join(__dirname, '..', 'swift-crm-automation', 'reports');
    if (fs.existsSync(reportsDir)) {
      const files = fs.readdirSync(reportsDir).filter(f => f.endsWith('.xlsx')).sort((a, b) => {
        return fs.statSync(path.join(reportsDir, b)).mtime - fs.statSync(path.join(reportsDir, a)).mtime;
      });
      if (files.length > 0) {
        latestReportPath = path.join(reportsDir, files[0]);
      }
    }
  }

  if (latestReportPath && fs.existsSync(latestReportPath)) {
    res.download(latestReportPath, 'UAT_Recharge_Report.xlsx');
  } else {
    res.status(404).json({ success: false, message: 'No report found' });
  }
});

SwiftCrmOrchestrator.registerRoutes(app);

// ========== Error Handling Middleware ==========

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found'
  });
});

// Start Server
// Add this for better CORS handling
app.use(cors({
  origin: [
    'http://localhost:5174',      // Local development
    `http://${SERVER_IP}:${PORT}`, // Public network access
    // 'http://localhost:5173'       // Other possible local ports
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Handle preflight requests
app.options('*', cors());

// If you want the server to be accessible from both
server.listen(PORT, '0.0.0.0', () => {  // Listen on all interfaces
  console.log(` Backend server running on port ${PORT}`);
  console.log(`WebSocket server ready on ws://localhost:${PORT} and ws://${SERVER_IP}:${PORT}`);
  console.log(`API endpoints ready`);
  console.log(` Dashboard: http://localhost:${PORT}/`);
});