/**
 * Phone normalisation shared by the intake form (browser), the intake API,
 * and the Pipedrive webhook. ClickUp phone fields only accept E.164.
 */

export const PHONE_ERROR =
  'Please enter a valid phone number, e.g. (858) 555-1234. For numbers outside the US, start with + and the country code.'

/** Convert what a person typed into E.164, or null if it can't be. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Drop extensions like "x123", "ext. 123", "extension 123", "#123"
  const noExt = raw.replace(/\s*(?:x|ext\.?|extension|#)\s*\d+\s*$/i, '')
  const hasPlus = /^\s*\+/.test(noExt)
  const digits = noExt.replace(/\D/g, '')
  if (!digits) return null

  if (hasPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null
  }
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return null
}
