import { compare } from 'bcryptjs';
import { timingSafeEqual } from 'crypto';
import type { GripDb } from '../data/index';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

interface LockoutRow { count: number; locked_until: number }

export function isLockedOut(db: GripDb, ip: string): boolean {
  const row = db.raw.prepare('SELECT count, locked_until FROM auth_lockouts WHERE ip = ?').get(ip) as LockoutRow | null;
  if (!row) return false;
  if (row.locked_until > Date.now()) return true;
  db.raw.prepare('DELETE FROM auth_lockouts WHERE ip = ?').run(ip);
  return false;
}

export function recordFailedAttempt(db: GripDb, ip: string): void {
  const row = db.raw.prepare('SELECT count, locked_until FROM auth_lockouts WHERE ip = ?').get(ip) as LockoutRow | null;
  const count = (row?.count ?? 0) + 1;
  const lockedUntil = count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
  db.raw.prepare('INSERT OR REPLACE INTO auth_lockouts (ip, count, locked_until) VALUES (?, ?, ?)').run(ip, count, lockedUntil);
}

export function clearAttempts(db: GripDb, ip: string): void {
  db.raw.prepare('DELETE FROM auth_lockouts WHERE ip = ?').run(ip);
}

export function getSessionToken(db: GripDb): string | null {
  return db.config.get('session_token');
}

export function getSessionExpiry(db: GripDb): number {
  const v = db.config.get('session_expires_at');
  return v ? parseInt(v, 10) : 0;
}

export function createSession(db: GripDb): string {
  const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  db.config.set('session_token', token);
  db.config.set('session_expires_at', String(expiresAt));
  return token;
}

export function destroySession(db: GripDb): void {
  db.config.delete('session_token');
  db.config.delete('session_expires_at');
}

export function verifySession(db: GripDb, cookie: string | undefined): boolean {
  if (!cookie) return false;
  const stored = getSessionToken(db);
  if (!stored) return false;
  const a = Buffer.from(stored);
  const b = Buffer.from(cookie);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Date.now() < getSessionExpiry(db);
}

export async function verifyPassphrase(db: GripDb, submitted: string): Promise<boolean> {
  const hash = db.config.get('passphrase_hash');
  if (!hash) return false;
  return compare(submitted, hash);
}
