import fs from 'fs';

export function normalizePhone(value: unknown): string {
  if (value == null || value === '' || value === '-') return '';
  const digits = String(value).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return digits;
}

export function loadPhoneDeviceMap(): Record<string, string> {
  const file = process.env.PHONE_DEVICE_MAP_FILE;
  if (!file || !fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, string>;
  } catch {
    return {};
  }
}

export function resolveDeviceForNumber(
  phoneNumber: string,
  map: Record<string, string>
): string {
  const key = normalizePhone(phoneNumber);
  return key ? map[key] || '' : '';
}
