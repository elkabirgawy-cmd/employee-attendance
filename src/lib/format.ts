export function toEnDigits(input: string | number): string {
    if (input === null || input === undefined) return '';

    const str = input.toString();
    return str
        .replace(/[٠١٢٣٤٥٦٧٨٩]/g, (d) => (d.charCodeAt(0) - 1632).toString()) // Arabic-Indic
        .replace(/[۰۱۲۳۴۵۶۷۸۹]/g, (d) => (d.charCodeAt(0) - 1776).toString()); // Eastern Arabic-Indic
}

export function formatNumber(value: number): string {
    // Always use en-US for 0-9 digits, effectively implementing English digits
    return new Intl.NumberFormat('en-US').format(value);
}
