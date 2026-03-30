import type { Database } from 'bun:sqlite';

interface KeyRow {
  public_pem: string;
  private_pem: string;
}

let _cached: { privateKey: CryptoKey; publicKeyPem: string } | null = null;

function wrapPem(label: string, b64: string): string {
  const lines: string[] = [];
  lines.push(`-----BEGIN ${label}-----`);
  for (let i = 0; i < b64.length; i += 64) {
    lines.push(b64.slice(i, i + 64));
  }
  lines.push(`-----END ${label}-----`);
  return lines.join('\n');
}

function unwrapPem(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [A-Z ]+-----/, '')
    .replace(/-----END [A-Z ]+-----/, '')
    .replace(/\s/g, '');
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

const ALGO = { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' } as const;

export async function ensureKeyPair(db: Database): Promise<void> {
  const row = db.query('SELECT 1 FROM ap_keys WHERE id = ?').get('main');
  if (row) return;

  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  const pubBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const privBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);

  const publicPem = wrapPem('PUBLIC KEY', Buffer.from(pubBuf).toString('base64'));
  const privatePem = wrapPem('PRIVATE KEY', Buffer.from(privBuf).toString('base64'));

  db.query('INSERT INTO ap_keys (id, public_pem, private_pem, created_at) VALUES (?, ?, ?, ?)').run(
    'main',
    publicPem,
    privatePem,
    Date.now(),
  );
}

export async function getKeyPair(db: Database): Promise<{ privateKey: CryptoKey; publicKeyPem: string }> {
  if (_cached) return _cached;

  const row = db.query('SELECT public_pem, private_pem FROM ap_keys WHERE id = ?').get('main') as KeyRow | null;
  if (!row) throw new Error('No key pair found — call ensureKeyPair first');

  const privateDer = unwrapPem(row.private_pem);
  const privateKey = await crypto.subtle.importKey('pkcs8', privateDer as unknown as ArrayBuffer, ALGO, false, ['sign']);

  _cached = { privateKey, publicKeyPem: row.public_pem };
  return _cached;
}
