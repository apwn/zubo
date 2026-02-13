/**
 * A ring buffer of recent errors for agent visibility.
 * The agent can check this to explain what went wrong.
 */

interface ErrorEntry {
  source: string;
  message: string;
  timestamp: string;
}

const MAX_ENTRIES = 20;
const buffer: ErrorEntry[] = [];

export function recordError(source: string, message: string): void {
  buffer.push({
    source,
    message,
    timestamp: new Date().toISOString(),
  });
  if (buffer.length > MAX_ENTRIES) {
    buffer.shift();
  }
}

export function getRecentErrors(limit: number = 10): ErrorEntry[] {
  return buffer.slice(-limit);
}

export function clearErrors(): void {
  buffer.length = 0;
}
