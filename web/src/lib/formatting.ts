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
