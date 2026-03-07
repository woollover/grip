const encoder = new TextEncoder();

/**
 * Sign an outbound POST request by adding Date, Digest, and Signature headers.
 */
export async function signRequest(params: {
  method: 'POST';
  url: URL;
  body: string;
  keyId: string;
  privateKey: CryptoKey;
  headers: Record<string, string>;
}): Promise<void> {
  const { method, url, body, keyId, privateKey, headers } = params;

  // 1. Compute Digest
  const digestBuf = await crypto.subtle.digest('SHA-256', encoder.encode(body));
  const digestB64 = Buffer.from(digestBuf).toString('base64');
  headers['Digest'] = `SHA-256=${digestB64}`;

  // 2. Set Date
  headers['Date'] = new Date().toUTCString();

  // 3. Set Host
  headers['Host'] = url.host;

  // 4. Build signing string
  const signingString = [
    `(request-target): ${method.toLowerCase()} ${url.pathname}`,
    `host: ${headers['Host']}`,
    `date: ${headers['Date']}`,
    `digest: ${headers['Digest']}`,
  ].join('\n');

  // 5. Sign
  const sigBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    encoder.encode(signingString),
  );
  const sigB64 = Buffer.from(sigBuf).toString('base64');

  // 6. Set Signature header
  headers['Signature'] = `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date digest",signature="${sigB64}"`;
}

/**
 * Sign an outbound GET request (no body/digest).
 */
export async function signGetRequest(params: {
  url: URL;
  keyId: string;
  privateKey: CryptoKey;
  headers: Record<string, string>;
}): Promise<void> {
  const { url, keyId, privateKey, headers } = params;

  headers['Date'] = new Date().toUTCString();
  headers['Host'] = url.host;

  const signingString = [
    `(request-target): get ${url.pathname}${url.search}`,
    `host: ${headers['Host']}`,
    `date: ${headers['Date']}`,
  ].join('\n');

  const sigBuf = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    privateKey,
    encoder.encode(signingString),
  );
  const sigB64 = Buffer.from(sigBuf).toString('base64');

  headers['Signature'] = `keyId="${keyId}",algorithm="rsa-sha256",headers="(request-target) host date",signature="${sigB64}"`;
}

/**
 * Verify an inbound request's HTTP Signature.
 * Returns the verified actor URI, or throws on failure.
 * Pass ownKeyId + ownPrivateKey so the key-fetch GET can be signed.
 */
export async function verifyInboundSignature(
  request: Request,
  ownKeyId?: string,
  ownPrivateKey?: CryptoKey,
): Promise<string> {
  const sigHeader = request.headers.get('Signature');
  if (!sigHeader) throw new Error('Missing Signature header');

  // Parse Signature header fields
  const sigParts: Record<string, string> = {};
  for (const part of sigHeader.split(',')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const val = part.slice(eq + 1).trim().replace(/^"|"$/g, '');
    sigParts[key] = val;
  }

  const { keyId, signature, headers: signedHeaderNames } = sigParts;
  if (!keyId || !signature || !signedHeaderNames) {
    throw new Error('Incomplete Signature header');
  }

  // Check Date freshness (within 60 seconds)
  const dateStr = request.headers.get('Date');
  if (!dateStr) throw new Error('Missing Date header');
  const requestDate = new Date(dateStr).getTime();
  if (Math.abs(Date.now() - requestDate) > 60_000) {
    throw new Error('Request Date is too far from current time');
  }

  // Fetch actor's public key (sign the GET if we have our own key)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  let actorDoc: any;
  try {
    const fetchHeaders: Record<string, string> = { 'Accept': 'application/activity+json' };
    if (ownKeyId && ownPrivateKey) {
      await signGetRequest({ url: new URL(keyId), keyId: ownKeyId, privateKey: ownPrivateKey, headers: fetchHeaders });
    }
    const resp = await fetch(keyId, { headers: fetchHeaders, signal: controller.signal });
    if (!resp.ok) throw new Error(`Failed to fetch actor key: ${resp.status}`);
    actorDoc = await resp.json();
  } finally {
    clearTimeout(timeout);
  }

  // Extract public key PEM
  const publicKeyPem: string = actorDoc?.publicKey?.publicKeyPem;
  if (!publicKeyPem) throw new Error('No publicKey.publicKeyPem in actor document');

  // Import the public key
  const pemBody = publicKeyPem
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\s/g, '');
  const der = Buffer.from(pemBody, 'base64');
  const publicKey = await crypto.subtle.importKey(
    'spki',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  // Rebuild signing string from specified headers
  const url = new URL(request.url);
  const headerList = signedHeaderNames.split(' ');
  const signingString = headerList
    .map((h) => {
      if (h === '(request-target)') {
        return `(request-target): ${request.method.toLowerCase()} ${url.pathname}`;
      }
      const val = request.headers.get(h);
      if (val === null) throw new Error(`Missing signed header: ${h}`);
      return `${h}: ${val}`;
    })
    .join('\n');

  // Verify
  const sigBytes = Buffer.from(signature, 'base64');
  const valid = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    publicKey,
    sigBytes,
    encoder.encode(signingString),
  );

  if (!valid) throw new Error('Signature verification failed');

  // Return the actor URI from the actor document
  const actorUri: string = actorDoc?.id || actorDoc?.actor;
  if (!actorUri) throw new Error('Cannot determine actor URI from key document');
  return actorUri;
}
