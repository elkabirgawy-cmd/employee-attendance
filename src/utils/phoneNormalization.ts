export function sanitizePhone(phone: string): string {
  if (!phone) return '';

  const str = String(phone).trim();

  let cleaned = str.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u200B\u200C\u200D\uFEFF]/g, '');

  cleaned = cleaned.replace(/[^0-9]/g, '');

  return cleaned;
}

export function normalizeEgyptPhone(phone: string): string {
  if (!phone) return '';

  const digitsOnly = sanitizePhone(phone);

  if (digitsOnly.startsWith('01') && digitsOnly.length === 11) {
    return '+20' + digitsOnly.substring(1);
  }

  if (digitsOnly.startsWith('201') && digitsOnly.length === 12) {
    return '+' + digitsOnly;
  }

  if (digitsOnly.startsWith('20') && digitsOnly.length === 12) {
    return '+' + digitsOnly;
  }

  return phone;
}

export function validateEgyptPhone(phone: string): boolean {
  const normalized = normalizeEgyptPhone(phone);
  const regex = /^\+201[0-9]{9}$/;
  return regex.test(normalized);
}
