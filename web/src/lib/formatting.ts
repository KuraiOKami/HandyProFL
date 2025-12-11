/**
 * Shared formatting utilities for the HandyProFL app
 */

/**
 * Formats a time string for display.
 * Handles both ISO datetime strings (e.g., "2025-12-11T15:00:00+00:00")
 * and simple time strings (e.g., "9:00 AM", "14:00").
 */
export function formatTime(timeStr: string | null | undefined): string {
  if (!timeStr) return '';

  // Handle ISO datetime strings like "2025-12-11T15:00:00+00:00"
  if (timeStr.includes('T')) {
    const date = new Date(timeStr);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

  // Return simple time strings as-is
  return timeStr;
}

/**
 * Formats a number of cents as a currency string.
 */
export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

/**
 * Formats a service type slug into a human-readable string.
 * e.g., "bike_assembly" -> "Bike Assembly"
 */
export function formatServiceType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Formats a duration in minutes to a human-readable string.
 * e.g., 90 -> "1h 30m", 45 -> "45 min"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Sanitizes job details to remove pricing information before showing to agents.
 * Removes: Subtotal, Urgency surcharge, and any dollar amounts
 */
export function sanitizeDetailsForAgent(details: string | null | undefined): string | null {
  if (!details) return null;

  // Remove pricing patterns:
  // - "| Subtotal: $XXX.XX"
  // - "| Urgency surcharge: $XXX.XX"
  // - "| Estimated minutes: XX" (keep this one, it's useful)
  let sanitized = details
    // Remove subtotal
    .replace(/\s*\|\s*Subtotal:\s*\$[\d,]+\.?\d*/gi, '')
    // Remove urgency surcharge
    .replace(/\s*\|\s*Urgency surcharge:\s*\$[\d,]+\.?\d*/gi, '')
    // Remove any remaining standalone dollar amounts that might be pricing
    .replace(/\s*\|\s*(?:Price|Cost|Fee|Total|Amount):\s*\$[\d,]+\.?\d*/gi, '')
    // Clean up any double pipes or trailing pipes
    .replace(/\|\s*\|/g, '|')
    .replace(/\|\s*$/g, '')
    .replace(/^\s*\|/g, '')
    .trim();

  return sanitized || null;
}
