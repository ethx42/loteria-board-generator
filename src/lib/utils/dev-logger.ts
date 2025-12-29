/**
 * Development-only Logger Utility
 *
 * Provides logging functions that only output in development environment.
 * In production builds, these calls become no-ops for zero runtime overhead.
 *
 * @example
 * import { devLog, devWarn, devError } from '@/lib/utils/dev-logger';
 *
 * devLog('Connection', 'WebSocket connected', { roomId: 'ABC123' });
 * devWarn('State', 'Unexpected state transition');
 * devError('Socket', 'Connection failed', error);
 */

// Check if we're in development mode
const isDev = process.env.NODE_ENV === "development";

// Color codes for different log types (browser console)
const COLORS = {
  log: "#4CAF50", // Green
  warn: "#FF9800", // Orange
  error: "#F44336", // Red
  info: "#2196F3", // Blue
  debug: "#9C27B0", // Purple
} as const;

type LogLevel = keyof typeof COLORS;

/**
 * Formats a log message with a prefix tag
 */
function formatMessage(tag: string, message: string): string {
  return `[${tag}] ${message}`;
}

/**
 * Creates a styled console log (browser only)
 */
function styledLog(
  level: LogLevel,
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  if (!isDev) return;

  const formattedMessage = formatMessage(tag, message);
  const color = COLORS[level];

  // Use styled console in browser, plain in Node
  if (typeof window !== "undefined") {
    const style = `color: ${color}; font-weight: bold;`;
    console[level === "log" ? "log" : level](
      `%c${formattedMessage}`,
      style,
      ...args
    );
  } else {
    console[level === "log" ? "log" : level](formattedMessage, ...args);
  }
}

/**
 * Development-only log (green)
 * @param tag - Category/component name
 * @param message - Log message
 * @param args - Additional data to log
 */
export function devLog(tag: string, message: string, ...args: unknown[]): void {
  styledLog("log", tag, message, ...args);
}

/**
 * Development-only warning (orange)
 * @param tag - Category/component name
 * @param message - Warning message
 * @param args - Additional data to log
 */
export function devWarn(
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  styledLog("warn", tag, message, ...args);
}

/**
 * Development-only error (red)
 * @param tag - Category/component name
 * @param message - Error message
 * @param args - Additional data to log
 */
export function devError(
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  styledLog("error", tag, message, ...args);
}

/**
 * Development-only info (blue)
 * @param tag - Category/component name
 * @param message - Info message
 * @param args - Additional data to log
 */
export function devInfo(
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  styledLog("info", tag, message, ...args);
}

/**
 * Development-only debug (purple)
 * @param tag - Category/component name
 * @param message - Debug message
 * @param args - Additional data to log
 */
export function devDebug(
  tag: string,
  message: string,
  ...args: unknown[]
): void {
  styledLog("debug", tag, message, ...args);
}

/**
 * Creates a scoped logger for a specific component/module
 * @param tag - The tag to use for all logs from this logger
 */
export function createDevLogger(tag: string) {
  return {
    log: (message: string, ...args: unknown[]) => devLog(tag, message, ...args),
    warn: (message: string, ...args: unknown[]) =>
      devWarn(tag, message, ...args),
    error: (message: string, ...args: unknown[]) =>
      devError(tag, message, ...args),
    info: (message: string, ...args: unknown[]) =>
      devInfo(tag, message, ...args),
    debug: (message: string, ...args: unknown[]) =>
      devDebug(tag, message, ...args),
  };
}

export default {
  log: devLog,
  warn: devWarn,
  error: devError,
  info: devInfo,
  debug: devDebug,
  create: createDevLogger,
};

