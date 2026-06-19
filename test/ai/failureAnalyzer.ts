export interface FailureAnalysis {
  rootCause: string;
  category: string;
  suggestions: string[];
}

export class FailureAnalyzer {
  analyze(error: Error, testTitle: string): FailureAnalysis {
    const msg = `${error.message} ${error.stack || ''}`.toLowerCase();
    if (process.env.AI_ENABLED === 'true' && process.env.AI_API_KEY) {
      return this.ruleBased(msg, testTitle);
    }
    return this.ruleBased(msg, testTitle);
  }

  async analyzeAsync(error: Error, testTitle: string): Promise<FailureAnalysis> {
    const baseline = this.analyze(error, testTitle);
    if (process.env.AI_ENABLED !== 'true' || !process.env.AI_API_KEY) {
      return baseline;
    }
    try {
      const endpoint = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.AI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.AI_MODEL || 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content:
                'You are a mobile test automation expert. Return JSON: {rootCause,category,suggestions[]}'
            },
            {
              role: 'user',
              content: `Test: ${testTitle}\nError: ${error.message}\nStack: ${error.stack?.slice(0, 800)}`
            }
          ],
          temperature: 0.2
        }),
        signal: AbortSignal.timeout(15_000)
      });
      if (!res.ok) return baseline;
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content || '';
      const parsed = JSON.parse(text) as FailureAnalysis;
      if (parsed.rootCause && parsed.category) return parsed;
    } catch {
      /* fall back to rules */
    }
    return baseline;
  }

  private ruleBased(msg: string, testTitle: string): FailureAnalysis {
    if (msg.includes('econnrefused') || msg.includes('failed to connect')) {
      return {
        category: 'APPIUM',
        rootCause: 'Appium server unreachable on configured host/port.',
        suggestions: ['Start Appium: appium', 'Verify APPIUM_PORT in .env']
      };
    }
    if (msg.includes('no such element') || msg.includes('element not found')) {
      return {
        category: 'LOCATOR',
        rootCause: `Element not found during "${testTitle}" — locator may have changed.`,
        suggestions: ['Refresh page object selectors', 'Capture UI dump: adb shell uiautomator dump']
      };
    }
    if (msg.includes('device offline') || msg.includes('not found')) {
      return {
        category: 'DEVICE',
        rootCause: 'ADB device disconnected or wrong device id.',
        suggestions: ['Run adb devices', 'Reconnect USB/wireless ADB']
      };
    }
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return {
        category: 'TIMEOUT',
        rootCause: 'Operation timed out — network or UI slow.',
        suggestions: ['Increase waitforTimeout', 'Check device network registration']
      };
    }
    if (msg.includes('excel') || msg.includes('worksheet')) {
      return {
        category: 'DATA',
        rootCause: 'Excel test data missing or invalid sheet.',
        suggestions: ['Verify EXCEL_FILE path and sheet names: Calling, SMS, DataUsage']
      };
    }
    return {
      category: 'UNKNOWN',
      rootCause: errorMessage(msg),
      suggestions: ['Review screenshots/', 'Check logs/ and Appium server output']
    };
  }
}

function errorMessage(msg: string): string {
  const line = msg.split('\n').find((l) => l.trim().length > 0);
  return line || 'Unhandled test failure';
}
