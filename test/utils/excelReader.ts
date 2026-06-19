import path from 'path';
import fs from 'fs';
import ExcelJS from 'exceljs';
import { normalizePhone } from './phoneMap';

export interface CallingRow {
  name: string;
  aPartyNumber?: string;
  bPartyNumber: string;
  cPartyNumber?: string;
  preferredNetwork: string;
  volteSupported: boolean;
  volteRequired?: boolean;
  duration: number;
  attempts: number;
  callType: string;
  direction: string;
  isConference?: boolean;
  isIncoming?: boolean;
}

export interface SmsRow {
  testType: string;
  isIndividual?: boolean;
  isGroup?: boolean;
  groupName?: string;
  name?: string;
  aPartyNumber?: string;
  bPartyNumber?: string;
  recipient?: string;
  message: string;
  messageType?: string;
  smsCount: number;
  direction: string;
  isIncoming?: boolean;
  expectedMembers?: number;
}

export interface DataUsageRow {
  scenario: string;
  targetDataGB: number;
  durationMin: number;
  appsToUse: string[];
  validationCriteria: string;
}

export interface SIMLatchRow {
  partyNumber?: string;
  scenario?: string;
  preferredNetwork: string;
  timeoutSec: number;
  attempts: number;
  name?: string;
}

export interface TestPlanRecord {
  userName: string;
  password: string;
  msisdn: string;
  planName: string;
  activationDate: Date;
  activationTillDate: Date;
  usageTypes: string;
  usageDate1: Date;
  usageDate2?: Date;
  usageDate3?: Date;
}

export interface PlanDetailRecord {
  attributes: string;
  planName: string;
  baseData: string;
  voiceSMS: string;
  rental: number;
  displayValue: number;
}

function cellStr(v: ExcelJS.CellValue): string {
  if (v == null) return '';
  if (typeof v === 'object' && 'text' in (v as { text?: string })) {
    return String((v as { text?: string }).text || '');
  }
  if (typeof v === 'object' && 'result' in (v as { result?: number })) {
    return String((v as { result?: number }).result ?? '');
  }
  return String(v).trim();
}

function getHeaderColumns(sheet: ExcelJS.Worksheet): Map<string, number> {
  const cols = new Map<string, number>();
  const headerRow = sheet.getRow(1);
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const label = cellStr(cell.value).toLowerCase();
    if (label) cols.set(label, colNumber);
  });
  return cols;
}

function matchColumn(headers: Map<string, number>, needles: string[]): number {
  for (const [label, colNumber] of headers.entries()) {
    for (const needle of needles) {
      if (label.includes(needle.toLowerCase())) return colNumber;
    }
  }
  return -1;
}

function pickDurationFromRow(row: ExcelJS.Row, colDuration: number): number {
  if (colDuration <= 0) return 15;
  const d = row.getCell(colDuration).value;
  if (typeof d === 'number' && d > 0) return Math.round(d);
  const parsed = parseInt(cellStr(d), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 15;
}

function cleanPhoneNumber(phone: string): string {
  if (!phone || phone.trim() === '' || phone === '-') return '';
  const cleaned = phone.replace(/[^0-9+]/g, '').trim();
  if (cleaned.startsWith('++')) {
    return '+' + cleaned.substring(2);
  }
  return cleaned;
}

function normalizeNetworkType(network: string): string {
  if (!network || network.trim() === '') return 'AUTO';
  const upper = network.toUpperCase().trim();
  
  if (upper.includes('5G')) return '5G';
  if (upper.includes('4G') || upper.includes('LTE')) return '4G';
  if (upper.includes('3G')) return '3G';
  if (upper.includes('2G')) return '2G';
  if (upper.includes('AUTO')) return 'AUTO';
  
  return 'AUTO';
}

function normalizeCallType(type: string): string {
  if (!type || type.trim() === '') return 'VOICE';
  const upper = type.toUpperCase().trim();
  
  if (upper.includes('VIDEO')) return 'VIDEO';
  if (upper.includes('CONFERENCE') || upper.includes('3-WAY')) return 'CONFERENCE';
  if (upper.includes('VOLTE')) return 'VOLTE';
  
  return 'VOICE';
}

function normalizeDirection(direction: string): string {
  if (!direction || direction.trim() === '') return 'OUTGOING';
  const upper = direction.toUpperCase().trim();
  
  if (upper.includes('INCOMING') || upper.includes('INBOUND') || upper === '←') return 'INCOMING';
  
  return 'OUTGOING';
}

function normalizeMessageType(messageType: string): string {
  if (!messageType || messageType.trim() === '') return 'text';
  
  const lower = messageType.toLowerCase().trim();
  
  if (lower.includes('voice') || lower.includes('audio')) {
    return 'voice';
  }
  
  if (lower.includes('mms') || lower.includes('multimedia')) {
    return 'mms';
  }
  
  return 'text';
}

function parseIntValue(value: string, defaultValue: number): number {
  if (!value || value.trim() === '') return defaultValue;
  try {
    const cleaned = value.replace(/[^0-9-]/g, '');
    if (!cleaned) return defaultValue;
    return parseInt(cleaned, 10);
  } catch (e) {
    return defaultValue;
  }
}

function parseDoubleValue(value: string, defaultValue: number): number {
  if (!value || value.trim() === '') return defaultValue;
  try {
    const cleaned = value.replace(/[^0-9.-]/g, '');
    if (!cleaned) return defaultValue;
    return parseFloat(cleaned);
  } catch (e) {
    return defaultValue;
  }
}

function parseBoolean(value: string): boolean {
  if (!value) return false;
  const lower = value.toLowerCase().trim();
  return lower === 'true' || lower === 'yes' || lower === '1' || lower === 'enabled';
}

function isEmptyRow(row: ExcelJS.Row): boolean {
  if (!row) return true;
  let hasValue = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    const value = cellStr(cell.value);
    if (value && value.trim() && value !== '-') {
      hasValue = true;
    }
  });
  return !hasValue;
}

function getCallTypeEmoji(type: string): string {
  switch (type) {
    case 'VOICE': return '☎️';
    case 'VIDEO': return '📹';
    case 'VOLTE': return '📞';
    case 'CONFERENCE': return '👥';
    default: return '☎️';
  }
}

function logCallingTestCase(testCase: CallingRow): void {
  const emoji = getCallTypeEmoji(testCase.callType);
  const direction = testCase.isIncoming ? '←' : '→';
  const conference = testCase.isConference ? ' [CONF]' : '';
  const volte = testCase.volteSupported ? ' [VoLTE]' : '';
  
  console.log(
    `${emoji} ${direction} ${testCase.name.padEnd(40)} | ${testCase.aPartyNumber || 'N/A'} -> ${testCase.bPartyNumber} | ${testCase.preferredNetwork} | ${testCase.duration}s | ${testCase.attempts} attempts${volte}${conference}`
  );
}

function logSMSTestCase(testCase: SmsRow): void {
  const emoji = testCase.isIndividual ? '👤' : '👥';
  const direction = testCase.isIncoming ? '← INCOMING' : '→ OUTGOING';
  const messageType = (testCase.messageType || 'text').toUpperCase();
  const typeEmoji = messageType === 'VOICE' ? '🎤' : messageType === 'MMS' ? '🖼️' : '💬';
  
  console.log(`${emoji} ${typeEmoji} ${direction} ${messageType} ${testCase.isIndividual ? 'INDIVIDUAL' : 'GROUP'}`);
  
  if (testCase.isIndividual) {
    console.log(`   A-Party: ${testCase.aPartyNumber} | B-Party: ${testCase.bPartyNumber}`);
    if (testCase.message && testCase.message.length > 0) {
      const displayMsg = testCase.message.length > 50 ? testCase.message.substring(0, 50) + '...' : testCase.message;
      console.log(`   Message: '${displayMsg}'`);
    }
  } else {
    console.log(`   Group: ${testCase.groupName} | A-Party: ${testCase.aPartyNumber}`);
    if (testCase.message && testCase.message.length > 0) {
      const displayMsg = testCase.message.length > 50 ? testCase.message.substring(0, 50) + '...' : testCase.message;
      console.log(`   Message: '${displayMsg}'`);
    }
  }
  console.log();
}

function printSMSTestSummary(testCases: SmsRow[]): void {
  const individualCount = testCases.filter(t => t.isIndividual).length;
  const groupCount = testCases.filter(t => t.isGroup).length;
  const incomingCount = testCases.filter(t => t.isIncoming).length;
  const outgoingCount = testCases.length - incomingCount;
  const voiceCount = testCases.filter(t => t.messageType === 'voice').length;
  const textCount = testCases.filter(t => t.messageType === 'text').length;
  const mmsCount = testCases.filter(t => t.messageType === 'mms').length;
  
  console.log('📊 SMS TEST SUMMARY:');
  console.log('┌────────────────────────────────────────────────────────────────┐');
  console.log('│ TEST TYPE BREAKDOWN                                           │');
  console.log('├────────────────────────────────────────────────────────────────┤');
  console.log(`│  Individual SMS:    ${individualCount.toString().padEnd(41)}│`);
  console.log(`│ 👥 Group SMS:         ${groupCount.toString().padEnd(41)}│`);
  console.log('└────────────────────────────────────────────────────────────────┘');
  
  console.log('\n┌────────────────────────────────────────────────────────────────┐');
  console.log('│ DIRECTION BREAKDOWN                                           │');
  console.log('├────────────────────────────────────────────────────────────────┤');
  console.log(`│ 📤 Outgoing:          ${outgoingCount.toString().padEnd(41)}│`);
  console.log(`│ 📥 Incoming:          ${incomingCount.toString().padEnd(41)}│`);
  console.log('└────────────────────────────────────────────────────────────────┘');
  
  console.log('\n┌────────────────────────────────────────────────────────────────┐');
  console.log('│ MESSAGE TYPE BREAKDOWN                                        │');
  console.log('├────────────────────────────────────────────────────────────────┤');
  console.log(`│ 💬 Text Messages:     ${textCount.toString().padEnd(41)}│`);
  console.log(`│ 🎤 Voice Messages:    ${voiceCount.toString().padEnd(41)}│`);
  console.log(`│ 🖼️ MMS Messages:      ${mmsCount.toString().padEnd(41)}│`);
  console.log('└────────────────────────────────────────────────────────────────┘');
  
  // Group by A Party Number
  const byAParty = new Map<string, number>();
  testCases.forEach(t => {
    const aParty = t.aPartyNumber || 'UNKNOWN';
    byAParty.set(aParty, (byAParty.get(aParty) || 0) + 1);
  });
  
  if (byAParty.size > 0) {
    console.log('\n┌────────────────────────────────────────────────────────────────┐');
    console.log('│ TESTS BY A-PARTY NUMBER                                       │');
    console.log('├────────────────────────────────────────────────────────────────┤');
    byAParty.forEach((count, aParty) => {
      console.log(`│ ${`${aParty}: ${count} tests`.padEnd(62)}│`);
    });
    console.log('└────────────────────────────────────────────────────────────────┘');
  }
  console.log();
}

function printCallingTestSummary(testCases: CallingRow[]): void {
  const networkCount = new Map<string, number>();
  const typeCount = new Map<string, number>();
  let volteCount = 0;
  let conferenceCount = 0;
  let incomingCount = 0;
  
  testCases.forEach(t => {
    networkCount.set(t.preferredNetwork, (networkCount.get(t.preferredNetwork) || 0) + 1);
    typeCount.set(t.callType, (typeCount.get(t.callType) || 0) + 1);
    if (t.volteSupported) volteCount++;
    if (t.isConference) conferenceCount++;
    if (t.isIncoming) incomingCount++;
  });
  
  console.log('📊 CALLING TEST SUMMARY:');
  console.log(`   Networks: ${Object.fromEntries(networkCount)}`);
  console.log(`   Call Types: ${Object.fromEntries(typeCount)}`);
  console.log(`   VoLTE Tests: ${volteCount}`);
  console.log(`   Conference Calls: ${conferenceCount}`);
  console.log(`   Incoming Calls: ${incomingCount}\n`);
}

export async function readCallingRows(filePath: string): Promise<CallingRow[]> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Excel file not found: ${resolved}`);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolved);

  const sheet =
    wb.getWorksheet('Calling') ||
    wb.worksheets.find((w) => /calling/i.test(w.name)) ||
    wb.worksheets[0];

  if (!sheet) {
    throw new Error(`No "Calling" sheet in ${resolved}. Found: ${wb.worksheets.map((w) => w.name).join(', ')}`);
  }

  console.log('📊 Reading CALLING Test Data');
  console.log('='.repeat(100));

  const headers = getHeaderColumns(sheet);
  const colName = matchColumn(headers, ['name', 'test name']);
  const colB = matchColumn(headers, ['b party number', 'b party', 'target number', 'target', 'recipient']);
  const colDuration = matchColumn(headers, ['duration (s)', 'duration', 'actual call duration']);
  const colNetwork = matchColumn(headers, ['preferred network', 'network']);
  const colVolte = matchColumn(headers, ['volte supported', 'volte']);
  const colA = matchColumn(headers, ['a party number', 'a party']);
  const colC = matchColumn(headers, ['c party number', 'c party']);
  const colAttempts = matchColumn(headers, ['attempts', 'attempt', 'no of attempt']);
  const colType = matchColumn(headers, ['call type', 'type']);
  const colDir = matchColumn(headers, ['direction']);

  if (colB <= 0) {
    throw new Error(
      `Could not find B Party column in sheet "${sheet.name}". Headers: ${[...headers.keys()].join(', ')}`
    );
  }

  const rows: CallingRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (isEmptyRow(row)) return;

    const bParty = cleanPhoneNumber(cellStr(row.getCell(colB).value));
    if (!bParty || bParty === '-') return;

    const aPartyNumber = colA > 0 ? cleanPhoneNumber(cellStr(row.getCell(colA).value)) : undefined;
    const cPartyNumber = colC > 0 ? cleanPhoneNumber(cellStr(row.getCell(colC).value)) || undefined : undefined;
    const preferredNetwork = normalizeNetworkType(cellStr(row.getCell(colNetwork).value));
    const volteSupported = colVolte > 0 ? parseBoolean(cellStr(row.getCell(colVolte).value)) : false;
    const callType = normalizeCallType(cellStr(row.getCell(colType).value));
    const direction = normalizeDirection(cellStr(row.getCell(colDir).value));
    const isConference = !!cPartyNumber && cPartyNumber.length > 0;
    const isIncoming = direction === 'INCOMING';

    const testCase: CallingRow = {
      name: colName > 0 ? cellStr(row.getCell(colName).value) || `Call-${rowNumber}` : `Call-${rowNumber}`,
      aPartyNumber,
      bPartyNumber: bParty,
      cPartyNumber,
      preferredNetwork,
      volteSupported,
      volteRequired: volteSupported && callType === 'VOICE',
      duration: pickDurationFromRow(row, colDuration),
      attempts: colAttempts > 0 ? parseIntValue(cellStr(row.getCell(colAttempts).value), 1) : 1,
      callType,
      direction,
      isConference,
      isIncoming,
    };

    rows.push(testCase);
    logCallingTestCase(testCase);
  });

  console.log('='.repeat(100));
  console.log(`✅ Successfully loaded ${rows.length} calling tests\n`);
  printCallingTestSummary(rows);

  return rows;
}

export async function readSmsRows(filePath: string): Promise<SmsRow[]> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log('❌ File path cannot be null or empty');
    return [];
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolved);
  const sheet = wb.getWorksheet('SMS');
  
  if (!sheet) {
    console.log(`❌ Sheet 'SMS' not found in file: ${resolved}`);
    return [];
  }

  console.log('📊 Reading SMS Test Data');
  console.log('='.repeat(100));

  const headers = getHeaderColumns(sheet);
  
  console.log('📋 Detected Columns:', [...headers.keys()]);

  const colTestType = matchColumn(headers, ['test type', 'type']);
  const colAParty = matchColumn(headers, ['a party number', 'a party']);
  const colRecipient = matchColumn(headers, ['recipient', 'b party number', 'b party']);
  const colGroupName = matchColumn(headers, ['group name', 'group']);
  const colMessageType = matchColumn(headers, ['message type', 'type']);
  const colMessage = matchColumn(headers, ['message', 'message template']);
  const colDirection = matchColumn(headers, ['direction']);

  const data: SmsRow[] = [];
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (isEmptyRow(row)) return;

    let testType = colTestType > 0 ? cellStr(row.getCell(colTestType).value).toUpperCase() : '';
    const aPartyNumber = cleanPhoneNumber(cellStr(row.getCell(colAParty).value));
    const recipient = cleanPhoneNumber(cellStr(row.getCell(colRecipient).value));
    let groupName = colGroupName > 0 ? cellStr(row.getCell(colGroupName).value) : '';
    let messageType = colMessageType > 0 ? cellStr(row.getCell(colMessageType).value).toUpperCase() : '';
    let message = colMessage > 0 ? cellStr(row.getCell(colMessage).value) : '';
    const direction = colDirection > 0 ? normalizeDirection(cellStr(row.getCell(colDirection).value)) : 'OUTGOING';

    // Determine if it's individual or group
    let isIndividual = testType.includes('INDIVIDUAL');
    let isGroup = testType.includes('GROUP');
    
    if (!isIndividual && !isGroup) {
      isGroup = !!(groupName && groupName !== '-');
      isIndividual = !isGroup;
    }

    // For individual tests: recipient is the B Party number
    const bPartyNumber = isIndividual ? recipient : '';
    
    // Validate required fields
    if (!aPartyNumber) {
      console.log('⏭️ Skipping test - No A Party number');
      return;
    }
    
    if (isIndividual && !bPartyNumber) {
      console.log('⏭️ Skipping individual SMS - No B Party number (recipient)');
      return;
    }
    
    if (isGroup && (!groupName || groupName === '-')) {
      console.log('⏭️ Skipping group SMS - No group name');
      return;
    }

    // Set default test type if empty
    if (!testType) {
      testType = isIndividual ? 'INDIVIDUAL' : 'GROUP';
    }

    // Normalize message type
    const normalizedMessageType = normalizeMessageType(messageType);
    
    // Handle empty messages
    if (!message || message === '-') {
      if (normalizedMessageType === 'voice') {
        message = ''; // Voice messages don't need text
      } else {
        message = `Test SMS from ${aPartyNumber}`;
      }
    }

    const isIncoming = direction === 'INCOMING';
    
    // Generate test name
    let name = '';
    if (isIndividual) {
      const phoneSuffix = bPartyNumber.length > 4 ? bPartyNumber.substring(bPartyNumber.length - 4) : bPartyNumber;
      name = `SMS_${normalizedMessageType.toUpperCase()}_${isIncoming ? 'IN_' : 'OUT_'}${phoneSuffix}`;
    } else {
      const groupNameClean = groupName.replace(/ /g, '_').replace(/-/g, '');
      name = `GROUP_${normalizedMessageType.toUpperCase()}_${isIncoming ? 'IN_' : 'OUT_'}${groupNameClean}`;
    }

    const smsRow: SmsRow = {
      testType,
      isIndividual,
      isGroup,
      groupName,
      name,
      aPartyNumber,
      bPartyNumber,
      recipient: bPartyNumber,
      message,
      messageType: normalizedMessageType,
      smsCount: 1,
      direction,
      isIncoming,
      expectedMembers: isGroup ? 2 : 0,
    };

    data.push(smsRow);
    logSMSTestCase(smsRow);
  });

  console.log('='.repeat(100));
  console.log(`✅ Successfully loaded ${data.length} SMS tests\n`);
  printSMSTestSummary(data);

  return data;
}

export async function readDataUsageRows(filePath: string, sheetName: string = 'DataUsage'): Promise<DataUsageRow[]> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log('❌ File path cannot be null or empty');
    return [];
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolved);
  
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) {
    console.log(`❌ Sheet '${sheetName}' not found`);
    return [];
  }

  console.log(`📄 Reading Data Usage Test Data: ${sheetName}`);

  const headers = getHeaderColumns(sheet);
  const colScenario = matchColumn(headers, ['test scenario', 'scenario']);
  const colTarget = matchColumn(headers, ['target data', 'target']);
  const colDuration = matchColumn(headers, ['duration']);
  const colApps = matchColumn(headers, ['apps']);
  const colValidation = matchColumn(headers, ['validation', 'criteria']);

  const rows: DataUsageRow[] = [];
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (isEmptyRow(row)) return;
    
    const scenario = colScenario > 0 ? cellStr(row.getCell(colScenario).value) : '';
    if (!scenario) return;
    
    const targetDataGB = colTarget > 0 ? parseDoubleValue(cellStr(row.getCell(colTarget).value), 0.5) : 0.5;
    const durationMin = colDuration > 0 ? parseIntValue(cellStr(row.getCell(colDuration).value), 15) : 15;
    let apps = colApps > 0 ? cellStr(row.getCell(colApps).value) : '';
    const criteria = colValidation > 0 ? cellStr(row.getCell(colValidation).value) : 'Data consumption validation';
    
    const dataRow: DataUsageRow = {
      scenario,
      targetDataGB,
      durationMin,
      appsToUse: apps ? apps.split(',').map(s => s.trim()).filter(Boolean) : ['Browser', 'YouTube'],
      validationCriteria: criteria,
    };
    
    rows.push(dataRow);
    console.log(`  ${scenario} | ${targetDataGB} GB | ${durationMin} min`);
  });
  
  console.log(`✅ Loaded ${rows.length} data usage tests\n`);
  
  return rows;
}

export async function readSIMLatchRows(filePath: string): Promise<SIMLatchRow[]> {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.log('❌ File path cannot be null or empty');
    return [];
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(resolved);
  
  const sheet = wb.getWorksheet('SIM_Auto_Latch');
  if (!sheet) {
    console.log(`❌ Sheet 'SIM_Auto_Latch' not found in file: ${resolved}`);
    return [];
  }

  const headers = getHeaderColumns(sheet);
  const colPartyNumber = matchColumn(headers, ['aparty number', 'a party number', 'party number', 'msisdn']);
  const colNetwork = matchColumn(headers, ['network & auto latch', 'preferred network', 'network']);
  const colTimeout = matchColumn(headers, ['auto latch time (s)', 'timeout', 'timeout (s)']);
  const colAttempts = matchColumn(headers, ['attempts', 'attempt']);

  const rows: SIMLatchRow[] = [];
  
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    if (isEmptyRow(row)) return;
    
    let partyNumber = '';
    if (colPartyNumber > 0) {
      const cell = row.getCell(colPartyNumber);
      const value = cell.value;
      if (value && typeof value === 'object' && 'result' in value) {
        partyNumber = String((value as { result?: number }).result ?? '');
      } else if (value && typeof value === 'object' && 'text' in value) {
        partyNumber = (value as { text?: string }).text || '';
      } else if (value) {
        partyNumber = String(value);
      }
      partyNumber = cleanPhoneNumber(partyNumber);
    }
    
    if (!partyNumber) return;
    
    const preferredNetwork = colNetwork > 0 ? cellStr(row.getCell(colNetwork).value) : 'AUTO';
    const timeoutSec = colTimeout > 0 ? parseIntValue(cellStr(row.getCell(colTimeout).value), 120) : 120;
    const attempts = colAttempts > 0 ? parseIntValue(cellStr(row.getCell(colAttempts).value), 1) : 1;
    
    const latchRow: SIMLatchRow = {
      partyNumber,
      preferredNetwork: preferredNetwork && preferredNetwork !== '-' ? preferredNetwork : 'AUTO',
      timeoutSec,
      attempts,
      name: `SIM Auto-Latch: ${partyNumber} -> ${preferredNetwork} (${timeoutSec}s, ${attempts} attempts)`,
    };
    
    rows.push(latchRow);
  });
  
  console.log(`✅ Read ${rows.length} SIM auto-latch test cases from Excel\n`);
  
  return rows;
}

export class ExcelReader {
  private workbook: ExcelJS.Workbook;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
  }

  async loadWorkbook(filePath: string): Promise<void> {
    await this.workbook.xlsx.readFile(filePath);
  }

  async getTestPlanData(sheetName: string = 'Testplan'): Promise<TestPlanRecord[]> {
    const worksheet = this.workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const records: TestPlanRecord[] = [];
    
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const msisdn = row.getCell(3).toString();
      
      if (!msisdn) continue;

      records.push({
        userName: row.getCell(1).toString(),
        password: row.getCell(2).toString(),
        msisdn: msisdn,
        planName: row.getCell(4).toString(),
        activationDate: this.parseDate(row.getCell(5).toString()),
        activationTillDate: this.parseDate(row.getCell(6).toString()),
        usageTypes: row.getCell(7).toString(),
        usageDate1: this.parseDate(row.getCell(8).toString()),
        usageDate2: this.parseDate(row.getCell(9).toString()),
        usageDate3: this.parseDate(row.getCell(10).toString()),
      });
    }

    return records;
  }

  async getPlanDetails(sheetName: string = 'Plan details'): Promise<PlanDetailRecord[]> {
    const worksheet = this.workbook.getWorksheet(sheetName);
    if (!worksheet) {
      throw new Error(`Sheet '${sheetName}' not found`);
    }

    const records: PlanDetailRecord[] = [];

    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const planName = row.getCell(2).toString();
      
      if (!planName) continue;

      records.push({
        attributes: row.getCell(1).toString(),
        planName: planName,
        baseData: row.getCell(3).toString(),
        voiceSMS: row.getCell(10).toString(),
        rental: parseFloat(row.getCell(11).toString()) || 0,
        displayValue: parseFloat(row.getCell(9).toString()) || 0,
      });
    }

    return records;
  }

  private parseDate(dateStr: string): Date {
    if (!dateStr) return new Date();
    
    if (!isNaN(Number(dateStr))) {
      const excelDate = Number(dateStr);
      const date = new Date((excelDate - 25569) * 86400 * 1000);
      return date;
    }
    
    return new Date(dateStr);
  }
}

export class EnhancedExcelReader {
  static readCallingTestData = readCallingRows;
  static readSMSTestData = readSmsRows;
  static readDataUsageTestData = readDataUsageRows;
  static readSIMAutoLatchTestData = readSIMLatchRows;
}