/**
 * server-swift-ws-patch.js
 *
 * Drop-in replacement for the handleSwiftConnection() function
 * already in your server.js.
 *
 * CHANGES vs original:
 *  • Routes  { type: 'challenge_response' }  →  orchestrator.setChallengeResponse()
 *  • Routes  { type: 'captcha'            }  →  orchestrator.setCaptchaAnswer()
 *  • Routes  { type: 'resend_otp'         }  →  logs + broadcasts resend_requested
 *  • Routes  { type: 'stop'               }  →  kills child process (existing behaviour)
 *
 * HOW TO APPLY:
 *   1. Open your server.js.
 *   2. Find the existing `function handleSwiftConnection(ws, request) { … }` block.
 *   3. Replace the entire function body with the one below.
 *   4. No other changes needed — the rest of server.js stays as-is.
 */

function handleSwiftConnection(ws, request) {
  const url       = new URL(request.url, 'http://localhost');
  const sessionId = url.searchParams.get('sessionId');

  if (!sessionId) {
    ws.close(1008, 'Session ID required');
    return;
  }

  console.log(`[SWIFT] 🔌 New client connected: ${sessionId}`);
  swiftClients.set(sessionId, ws);

  let orchestrator = null;

  // ── Find the uploaded file for this session ───────────────────────────────
  let uploadPath = null;
  const uploadDir = path.join(__dirname, 'swift-uploads');
  if (fs.existsSync(uploadDir)) {
    const files = fs.readdirSync(uploadDir).sort((a, b) => {
      return fs.statSync(path.join(uploadDir, b)).mtime -
             fs.statSync(path.join(uploadDir, a)).mtime;
    });
    if (files.length > 0) {
      uploadPath = path.join(uploadDir, files[0]);
    }
  }

  // ── WebSocket message router ──────────────────────────────────────────────
  ws.on('message', async (message) => {
    let data;
    try {
      data = JSON.parse(message);
    } catch (e) {
      console.error('[SWIFT] Malformed WS message:', e.message);
      return;
    }

    switch (data.type) {

      // ── Start automation ────────────────────────────────────────────────
      case 'start': {
        if (!uploadPath) {
          ws.send(JSON.stringify({
            type:    'log',
            message: 'No uploaded file found for this session.',
            logType: 'error',
          }));
          return;
        }

        console.log('[SWIFT] 🚀 Starting automation…');

        const clientSet = new Set([ws]);
        orchestrator = new SwiftCrmOrchestrator(uploadPath, clientSet, __dirname);
        swiftSessions.set(sessionId, { orchestrator, ws });

        orchestrator.runRechargeUAT().catch((err) => {
          console.error('[SWIFT] ❌ Automation error:', err);
          ws.send(JSON.stringify({
            type:    'complete',
            success: false,
            message: err.message,
          }));
        });
        break;
      }

      // ── CAPTCHA answer from user ────────────────────────────────────────
      case 'captcha': {
        if (orchestrator) {
          console.log('[SWIFT] 🔐 CAPTCHA received:', data.answer);
          orchestrator.setCaptchaAnswer(data.answer);
        } else {
          console.warn('[SWIFT] CAPTCHA received but no active orchestrator.');
        }
        break;
      }

      // ── OTP / security-challenge answer from user ───────────────────────
      case 'challenge_response': {
        if (orchestrator) {
          console.log('[SWIFT] 🔑 Challenge response received:', data.cancelled ? '(cancelled)' : data.response);
          orchestrator.setChallengeResponse(data.response || '', data.cancelled === true);
        } else {
          // Fallback: broadcast so any existing listener (legacy default WS handler) can hear it
          broadcastToAll({
            type:      'challenge_received',
            sessionId: sessionId,
            response:  data.response || '',
          });
        }
        break;
      }

      // ── Resend OTP request ──────────────────────────────────────────────
      case 'resend_otp': {
        console.log('[SWIFT] 🔄 Resend OTP requested by user.');
        // Notify the orchestrator (it will log; actual resend depends on portal support)
        if (orchestrator) {
          orchestrator._log('User requested OTP resend — please wait…', 'info');
        }
        ws.send(JSON.stringify({
          type:    'log',
          message: 'OTP resend requested. It may take up to 30 seconds.',
          logType: 'info',
        }));
        break;
      }

      // ── Stop request ────────────────────────────────────────────────────
      case 'stop': {
        console.log('[SWIFT] 🛑 Stop requested by user.');
        if (orchestrator) {
          orchestrator._log('Stop requested — terminating automation.', 'warning');
          // If the WDIO child process is tracked, kill it
          if (orchestrator._wdioChild) {
            orchestrator._wdioChild.kill('SIGTERM');
          }
        }
        ws.send(JSON.stringify({
          type:    'complete',
          success: false,
          message: 'Stopped by user.',
        }));
        break;
      }

      default:
        console.warn('[SWIFT] Unknown message type:', data.type);
    }
  });

  // ── Cleanup on disconnect ─────────────────────────────────────────────────
  ws.on('close', () => {
    console.log(`[SWIFT] 👋 Client disconnected: ${sessionId}`);
    swiftClients.delete(sessionId);
    swiftSessions.delete(sessionId);
  });

  ws.on('error', (err) => {
    console.error(`[SWIFT] ❌ WebSocket error (${sessionId}):`, err.message);
    swiftClients.delete(sessionId);
    swiftSessions.delete(sessionId);
  });
}