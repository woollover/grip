import { compare } from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import type { Database } from 'bun:sqlite';
import { getConfigValue, setConfigValue, deleteConfigKey } from '../data/config';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface LockoutRow { count: number; locked_until: number }

export function isLockedOut(db: Database, ip: string): boolean {
  const row = db.prepare('SELECT count, locked_until FROM auth_lockouts WHERE ip = ?').get(ip) as LockoutRow | null;
  if (!row) return false;
  if (row.locked_until > Date.now()) return true;
  db.prepare('DELETE FROM auth_lockouts WHERE ip = ?').run(ip);
  return false;
}

export function recordFailedAttempt(db: Database, ip: string): void {
  const row = db.prepare('SELECT count, locked_until FROM auth_lockouts WHERE ip = ?').get(ip) as LockoutRow | null;
  const count = (row?.count ?? 0) + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
  db.prepare('INSERT OR REPLACE INTO auth_lockouts (ip, count, locked_until) VALUES (?, ?, ?)').run(ip, count, lockedUntil);
}

export function clearAttempts(db: Database, ip: string): void {
  db.prepare('DELETE FROM auth_lockouts WHERE ip = ?').run(ip);
}

export function getSessionToken(db: Database): string | null {
  return getConfigValue(db, 'session_token');
}

export function getSessionExpiry(db: Database): number {
  const v = getConfigValue(db, 'session_expires_at');
  return v ? parseInt(v, 10) : 0;
}

export function createSession(db: Database): string {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  setConfigValue(db, 'session_token', token);
  setConfigValue(db, 'session_expires_at', String(expiresAt));
  return token;
}

export function destroySession(db: Database): void {
  deleteConfigKey(db, 'session_token');
  deleteConfigKey(db, 'session_expires_at');
}

export function verifySession(db: Database, cookie: string | undefined): boolean {
  if (!cookie) return false;
  const stored = getSessionToken(db);
  if (!stored) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(cookie);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Date.now() < getSessionExpiry(db);
}

export async function verifyPassphrase(db: Database, submitted: string): Promise<boolean> {
  const hash = getConfigValue(db, 'passphrase_hash');
  if (!hash) return false;
  return compare(submitted, hash);
}
