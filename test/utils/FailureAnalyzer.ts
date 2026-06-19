export interface FailureAnalysis {
  rootCause: string;
  category: string;
  suggestions: string[];
}

export class FailureAnalyzer {
  async analyzeAsync(error: Error, testTitle: string): Promise<FailureAnalysis> {
    const msg = `${error.message} ${error.stack || ''}`.toLowerCase();
    
    // Use AI if enabled
    if (process.env.AI_ENABLED === 'true' && process.env.AI_API_KEY) {
      try {
        return await this.analyzeWithAI(error, testTitle);
      } catch {
        return this.ruleBasedAnalysis(msg, testTitle);
      }
    }
    
    return this.ruleBasedAnalysis(msg, testTitle);
  }

  private async analyzeWithAI(error: Error, testTitle: string): Promise<FailureAnalysis> {
    const endpoint = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a mobile test automation expert. Return JSON: {rootCause, category, suggestions[]}'
          },
          {
            role: 'user',
            content: `Test: ${testTitle}\nError: ${error.message}\nStack: ${error.stack?.slice(0, 500)}`
          }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' }
      })
    });
    
    const data = await response.json() as any;
    const content = data.choices?.[0]?.message?.content || '';
    return JSON.parse(content) as FailureAnalysis;
  }

  private ruleBasedAnalysis(msg: string, testTitle: string): FailureAnalysis {
    // Appium connection issues
    if (msg.includes('econnrefused') || msg.includes('failed to connect')) {
      return {
        category: 'APPIUM',
        rootCause: 'Appium server is not running or unreachable',
        suggestions: [
          'Start Appium server: `appium`',
          'Check APPIUM_HOST and APPIUM_PORT environment variables',
          'Verify no firewall blocking port 4723'
        ]
      };
    }
    
    // Device issues
    if (msg.includes('device offline') || msg.includes('no devices') || msg.includes('not found')) {
      return {
        category: 'DEVICE',
        rootCause: 'ADB device is disconnected or not recognized',
        suggestions: [
          'Run `adb devices` to verify connection',
          'Reconnect USB cable and restart ADB: `adb kill-server && adb start-server`',
          'Check device ID in environment variables'
        ]
      };
    }
    
    // Element not found
    if (msg.includes('no such element') || msg.includes('element not found')) {
      return {
        category: 'LOCATOR',
        rootCause: `UI element not found during "${testTitle}" - app may have changed or not in expected state`,
        suggestions: [
          'Update locators in ElementConfig.ts',
          'Add wait conditions before interacting with elements',
          'Take screenshot to see current UI state'
        ]
      };
    }
    
    // Timeout issues
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        category: 'TIMEOUT',
        rootCause: 'Operation timed out - network or app response too slow',
        suggestions: [
          'Increase waitforTimeout in wdio.conf.ts',
          'Check network connectivity on device',
          'Verify device is not under heavy load'
        ]
      };
    }
    
    // USSD issues
    if (msg.includes('ussd') || msg.includes('balance')) {
      return {
        category: 'USSD',
        rootCause: 'USSD balance check failed - network may be unavailable',
        suggestions: [
          'Verify USSD code (*199#) works manually on device',
          'Check if device has network signal',
          'Ensure no ongoing USSD session is blocking'
        ]
      };
    }
    
    // Call issues
    if (msg.includes('call') || msg.includes('dial') || msg.includes('ringing')) {
      return {
        category: 'CALL',
        rootCause: 'Call operation failed - network or dialer issue',
        suggestions: [
          'Verify dialer app is installed and working',
          'Check if device can make manual calls',
          'Ensure phone number format is correct (10 digits)'
        ]
      };
    }
    
    // Default
    return {
      category: 'UNKNOWN',
      rootCause: msg.slice(0, 200) || 'Unknown error occurred',
      suggestions: [
        'Check logs/ directory for details',
        'Review screenshots for UI state',
        'Run test with DEBUG=true for more info'
      ]
    };
  }
}