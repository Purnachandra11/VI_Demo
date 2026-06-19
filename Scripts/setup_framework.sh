#!/usr/bin/env bash
set -euo pipefail

echo "Setting up Telecom Automation Framework..."
echo ""

mkdir -p src/main/java/com/telecom
mkdir -p src/test/resources
mkdir -p test-output/comprehensive-reports test-output/screenshots test-output/extent-reports
mkdir -p testng-xml

echo " Directory structure created"

CONFIG="src/test/resources/config.properties"
if [[ ! -f "$CONFIG" ]]; then
  cat > "$CONFIG" << 'EOF'
# Telecom Automation Configuration
appPackage=com.google.android.dialer
appActivity=com.google.android.dialer.extensions.GoogleDialtactsActivity
dialing.number=+919876543210
excelFilePath=src/test/resources/contacts.xlsx
EOF
  echo " Sample config.properties created"
fi

echo ""
echo " Framework setup completed!"
echo ""
echo "Next steps:"
echo "1. Update src/test/resources/config.properties with your settings"
echo "2. Run: mvn clean install"
echo "3. Add test numbers to contacts.xlsx"
echo "4. Run: ./Scripts/run_tests.sh"
