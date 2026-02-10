/**
 * Structured Logger - provides consistent logging across client and server
 *
 * In development: logs to console with structured formatting
 * In production: logs are captured and sent via telemetry API
 *
 * Log levels: debug < info < warn < error
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, unknown>;
  sessionId?: string;
}

// Session ID for correlating logs from a single user session
let sessionId: string | null = null;

const getSessionId = (): string => {
  if (!sessionId) {
    sessionId = `s_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  }
  return sessionId;
};

// In-memory log buffer for the current session
const logBuffer: LogEntry[] = [];
const MAX_BUFFER_SIZE = 500;

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = process.env.NODE_ENV === 'development' ? 'debug' : 'info';

const shouldLog = (level: LogLevel): boolean => {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
};

const formatForConsole = (entry: LogEntry): string => {
  const time = new Date(entry.timestamp).toISOString().substring(11, 23);
  return `[${time}] [${entry.level.toUpperCase().padEnd(5)}] [${entry.category}] ${entry.message}`;
};

const LOG_LEVEL_STYLES: Record<LogLevel, string> = {
  debug: 'color: #6b7280',
  info: 'color: #2563eb',
  warn: 'color: #d97706; font-weight: bold',
  error: 'color: #dc2626; font-weight: bold',
};

function writeLog(entry: LogEntry): void {
  // Buffer the log
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Console output in development
  if (process.env.NODE_ENV === 'development') {
    const formatted = formatForConsole(entry);
    const style = LOG_LEVEL_STYLES[entry.level];

    if (typeof window !== 'undefined') {
      // Browser with colors
      if (entry.data) {
        console[entry.level === 'warn' ? 'warn' : entry.level === 'error' ? 'error' : 'log'](
          `%c${formatted}`, style, entry.data
        );
      } else {
        console[entry.level === 'warn' ? 'warn' : entry.level === 'error' ? 'error' : 'log'](
          `%c${formatted}`, style
        );
      }
    } else {
      // Server-side plain text
      const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
      if (entry.data) {
        fn(formatted, JSON.stringify(entry.data));
      } else {
        fn(formatted);
      }
    }
  }
}

/**
 * Create a logger scoped to a category (e.g., 'compression', 'upload', 'telemetry')
 */
export function createLogger(category: string) {
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>) => {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      sessionId: typeof window !== 'undefined' ? getSessionId() : undefined,
    };

    writeLog(entry);
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
  };
}

/**
 * Get all buffered logs (for sending via telemetry)
 */
export function getLogBuffer(): LogEntry[] {
  return [...logBuffer];
}

/**
 * Get logs filtered by level
 */
export function getLogsByLevel(level: LogLevel): LogEntry[] {
  const minPriority = LOG_LEVEL_PRIORITY[level];
  return logBuffer.filter(e => LOG_LEVEL_PRIORITY[e.level] >= minPriority);
}

/**
 * Get current session ID
 */
export function getCurrentSessionId(): string {
  return getSessionId();
}

/**
 * Clear the log buffer
 */
export function clearLogBuffer(): void {
  logBuffer.length = 0;
}

/**
 * Get a summary of the log buffer for quick diagnostics
 */
export function getLogSummary(): {
  total: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
  errors: LogEntry[];
} {
  const byLevel: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
  const byCategory: Record<string, number> = {};
  const errors: LogEntry[] = [];

  for (const entry of logBuffer) {
    byLevel[entry.level]++;
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    if (entry.level === 'error') errors.push(entry);
  }

  return { total: logBuffer.length, byLevel, byCategory, errors };
}
