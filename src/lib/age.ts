/**
 * Exact age calculation from a YYYY-MM-DD birth date string.
 * Falls back to year-only calculation when birthDate is null.
 */
export function calcAge(birthDate: string | null | undefined, birthYear?: number): number {
  if (birthDate) {
    const birth = new Date(birthDate)
    const today = new Date()
    let age = today.getFullYear() - birth.getFullYear()
    const m = today.getMonth() - birth.getMonth()
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
    return age
  }
  // Fallback: year-only
  return birthYear != null ? new Date().getFullYear() - birthYear : 0
}
