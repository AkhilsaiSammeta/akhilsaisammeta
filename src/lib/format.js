export function formatCurrency(amount, currency = 'INR', locale = 'en-IN') {
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount || 0)
  } catch {
    // Fallback simple formatting
    return `₹${Number(amount || 0).toFixed(2)}`
  }
}

export const DEFAULT_CURRENCY = 'INR'
export const DEFAULT_LOCALE = 'en-IN'
