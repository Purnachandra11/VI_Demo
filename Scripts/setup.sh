#!/bin/bash
# test/scripts/setup.sh

echo "🔧 Setting up invoice validation directories..."

# Create directories
mkdir -p test/screenshots/invoice
mkdir -p test/reports/invoice
mkdir -p test/test_data

echo "✅ Directories created:"
echo "   📁 test/screenshots/invoice/"
echo "   📁 test/reports/invoice/"
echo "   📁 test/test_data/"

echo ""
echo "📋 Next steps:"
echo "1. Place input_data.xlsx in test/test_data/"
echo "2. Update .env with your credentials"
echo "3. Run: npx wdio run test/config/wdio.siebel.conf.ts --spec test/specs/siebel_invoice_validation.spec.ts"