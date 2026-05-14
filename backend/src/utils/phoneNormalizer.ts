/**
 * Normalizes Brazilian phone numbers to the standard 13-digit format:
 * 55 + DDD (2 digits) + 9-digit mobile number.
 *
 * WhatsApp sometimes sends numbers without the 9th digit (e.g., 555496600588),
 * while Respondi sends the full format (e.g., 5554996600588).
 * This function ensures both match the same canonical format.
 */
export function normalizeBrazilianPhone(phone: string): string {
    // Strip all non-digits
    let digits = phone.replace(/\D/g, '');

    // Must start with country code 55
    if (!digits.startsWith('55')) {
        digits = '55' + digits;
    }

    // Brazilian format: 55 + 2-digit DDD + 8 or 9-digit number
    // If total is 12 digits (55 + DDD + 8-digit number), insert the 9
    if (digits.length === 12) {
        const countryCode = digits.slice(0, 2); // "55"
        const ddd = digits.slice(2, 4);          // e.g., "54"
        const number = digits.slice(4);           // 8 digits
        digits = countryCode + ddd + '9' + number;
    }

    return digits;
}
