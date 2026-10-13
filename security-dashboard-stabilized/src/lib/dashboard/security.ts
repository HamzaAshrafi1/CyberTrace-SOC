/**
 * Input sanitization and security utilities.
 */

export function sanitizeString(val: string): string {
  if (typeof val !== "string") return val;
  // Strip out any HTML/Script tags to prevent stored XSS
  return val.replace(/<[^>]*>/g, "").trim();
}
