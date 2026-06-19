#!/usr/bin/env bash
set -euo pipefail

echo "============================================"
echo " Telecom Test Automation Runner"
echo "============================================"
echo ""

echo "Checking connected devices..."
adb devices
echo ""

DEFAULT_A_PARTY="LFMVIBEMW8HUR4XK"
DEFAULT_A_NUMBER="8696904544"
DEFAULT_B_NUMBER="9773328866"

echo "Looking for wireless/B-party device..."
B_PARTY_DEVICE=""
while read -r line; do
  [[ -z "$line" || "$line" == List* ]] && continue
  id="${line%%[[:space:]]*}"
  state="${line##*[[:space:]]}"
  [[ "$state" != "device" ]] && continue
  if [[ "$id" != "$DEFAULT_A_PARTY" ]]; then
    B_PARTY_DEVICE="$id"
    echo " Found wireless device: $id"
    break
  fi
done < <(adb devices)

if [[ -z "$B_PARTY_DEVICE" ]]; then
  echo "No wireless device found. Please connect B-party device."
  exit 1
fi

echo ""
echo "TEST CONFIGURATION:"
echo "   A-Party: ${DEFAULT_A_PARTY} (${DEFAULT_A_NUMBER})"
echo "   B-Party: ${B_PARTY_DEVICE} (${DEFAULT_B_NUMBER})"
echo ""

echo "Starting Calling Tests..."
mvn test -Dtest=CallingTest \
  -DaPartyDevice="${DEFAULT_A_PARTY}" \
  -DaPartyNumber="${DEFAULT_A_NUMBER}" \
  -DbPartyDevice="${B_PARTY_DEVICE}" \
  -DbPartyNumber="${DEFAULT_B_NUMBER}"

echo ""
echo "Test execution complete!"
