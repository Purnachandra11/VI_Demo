#!/usr/bin/env bash
set -euo pipefail

echo "==============================================="
echo "   TELECOM AUTOMATION — WebdriverIO + TypeScript"
echo "==============================================="

echo "Checking Node.js..."
command -v node >/dev/null 2>&1 || { echo "Node.js is not installed or not in PATH"; exit 1; }
node -v

echo "Checking ADB..."
if ! command -v adb >/dev/null 2>&1; then
  echo "ADB not found. Add Android SDK platform-tools to PATH."
fi

DEVICE_ID="${1:-}"
TEST_TYPE="${2:-all}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -d node_modules ]]; then
  echo "Installing dependencies (npm run setup)..."
  npm install
fi

export APARTY_DEVICE="${DEVICE_ID:-${APARTY_DEVICE:-}}"
if [[ -z "$APARTY_DEVICE" ]]; then
  echo "No device ID — WDIO will use APARTY_DEVICE from .env if set."
fi

case "$TEST_TYPE" in
  smoke) npm run test:smoke ;;
  ussd) npm run test:ussd ;;
  calling) npm run test:calling ;;
  sms) npm run test:sms ;;
  data) npm run test:data ;;
  sim-latch|latch) npm run test:sim-latch ;;
  sim-toolkit) npm run test:sim-toolkit ;;
  calling-sms) npm run test:calling-sms ;;
  calling-data) npm run test:calling-data ;;
  sms-data) npm run test:sms-data ;;
  *) npm run test:all ;;
esac

echo ""
echo "Reports: test-output/comprehensive-reports/ | reports/execution-summary.html"
echo "Allure:  npm run report:allure:open"
echo "Screenshots: test-output/screenshots/"
