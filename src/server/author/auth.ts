import { compare } from 'bcryptjs';
import type { Database } from 'bun:sqlite';
import type { Context } from 'elysia';

// In-memory rate limiter: ip → { count, lockedUntil }
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function isLockedOut(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  loginAttempts.delete(ip);
  return false;
}

export function recordFailedAttempt(ip: string): void {
  const entry = loginAttempts.get(ip) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_MS;
  }
  loginAttempts.set(ip, entry);
}

export function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

export function getSessionToken(db: Database): string | null {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('session_token') as
    { value: string } | null;
  return row?.value ?? null;
}

export function getSessionExpiry(db: Database): number {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('session_expires_at') as
    { value: string } | null;
  return row ? parseInt(row.value, 10) : 0;
}

export function createSession(db: Database): string {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('session_token', token);
  db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)').run('session_expires_at', String(expiresAt));
  return token;
}

export function destroySession(db: Database): void {
  db.prepare('DELETE FROM config WHERE key IN (?, ?)').run('session_token', 'session_expires_at');
}

export function verifySession(db: Database, cookie: string | undefined): boolean {
  if (!cookie) return false;
  const stored = getSessionToken(db);
  if (!stored || stored !== cookie) return false;
  const expiry = getSessionExpiry(db);
  return Date.now() < expiry;
}

export async function verifyPassphrase(db: Database, submitted: string): Promise<boolean> {
  const row = db.prepare('SELECT value FROM config WHERE key = ?').get('passphrase_hash') as
    { value: string } | null;
  if (!row) return false;
  return compare(submitted, row.value);
}
