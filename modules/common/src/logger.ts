export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  level: LogLevel;
  module: string;
  message: string;
  data?: unknown;
  timestamp: string;
}

export interface Logger {
  debug(message: string, data?: unknown): void;
  info(message: string, data?: unknown): void;
  warn(message: string, data?: unknown): void;
  error(message: string, data?: unknown): void;
}

function write(level: LogLevel, module: string, message: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    module,
    message,
    timestamp: new Date().toISOString(),
    ...(data !== undefined ? { data } : {}),
  };
  if (level === "error") {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export function createLogger(module: string): Logger {
  return {
    debug: (message, data) => write("debug", module, message, data),
    info:  (message, data) => write("info",  module, message, data),
    warn:  (message, data) => write("warn",  module, message, data),
    error: (message, data) => write("error", module, message, data),
  };
}

/** No-op logger for tests. */
export const noopLogger: Logger = {
  debug: () => {},
  info:  () => {},
  warn:  () => {},
  error: () => {},
};
