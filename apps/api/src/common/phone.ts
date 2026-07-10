/**
 * India-pilot phone matching: Firebase hands back E.164 (+919800000001) while
 * admin-entered rider/staff numbers are usually bare 10 digits. Compare on the
 * last 10 digits so both spellings refer to the same person.
 */
export function last10Digits(phone: string): string {
  return phone.replace(/\D/g, '').slice(-10);
}
