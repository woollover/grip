import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ── ANSI color codes ──────────────────────────────────────────────────────────

const ANSI: Record<LogLevel, string> = {
  debug: '\x1b[2m',        // dim/gray
  info:  '\x1b[36m',       // cyan
  warn:  '\x1b[33m',       // yellow
  error: '\x1b[1m\x1b[31m', // bold red
};
const RESET = '\x1b[0m';

// ── Padding ───────────────────────────────────────────────────────────────────

const PADDED: Record<LogLevel, string> = {
  debug: 'DEBUG',
  info:  'INFO ',
  warn:  'WARN ',
  error: 'ERROR',
};

// ── Serialization ─────────────────────────────────────────────────────────────

function serialize(arg: unknown): string {
  if (arg === null || arg === undefined) return String(arg);
  if (typeof arg === 'object') {
    try { return JSON.stringify(arg); } catch { return String(arg); }
  }
  return String(arg);
}

function formatArgs(args: unknown[]): string {
  if (args.length === 0) return '';
  return ' ' + args.map(serialize).join(' ');
}

// ── Time helpers ──────────────────────────────────────────────────────────────

function hms(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// ── Logger singleton ──────────────────────────────────────────────────────────

class Logger {
  private minLevel: number = LEVELS.info;
  private filePath: string | null = null;

  setLevel(level: LogLevel): void {
    this.minLevel = LEVELS[level] ?? LEVELS.info;
  }

  initFile(filePath: string): void {
    try {
      mkdirSync(dirname(filePath), { recursive: true });
      this.filePath = filePath;
    } catch (err) {
      // Can't create log dir — console-only logging continues
      console.warn(`[logger] Could not initialize log file at ${filePath}:`, err);
    }
  }

  private write(level: LogLevel, message: string, args: unknown[]): void {
    if (LEVELS[level] < this.minLevel) return;

    const extra = formatArgs(args);

    // Console output
    const color = ANSI[level];
    const label = PADDED[level];
    const consoleLine = `${color}[${hms()}] ${label}${RESET}  ${message}${extra}`;
    if (level === 'error') {
      process.stderr.write(consoleLine + '\n');
    } else {
      process.stdout.write(consoleLine + '\n');
    }

    // File output (sync, opt-in)
    if (this.filePath) {
      const iso = new Date().toISOString();
      const fileLine = `${iso} [${level.toUpperCase()}] ${message}${extra}\n`;
      try {
        appendFileSync(this.filePath, fileLine, 'utf8');
      } catch {
        // Swallow — don't crash the server over a logging failure
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    this.write('debug', message, args);
  }

  info(message: string, ...args: unknown[]): void {
    this.write('info', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('warn', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write('error', message, args);
  }
}

export const log = new Logger();
