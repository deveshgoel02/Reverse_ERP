/**
 * Minimal signed-session-cookie implementation (HMAC-SHA256, no external
 * JWT library). Deliberately not a general-purpose JWT: fixed algorithm,
 * fixed claim shape, no "alg: none" footgun. Session payload is small
 * (userId/businessId/role) and short-lived, re-verified against the DB's
 * `active` flag on every request that needs authorization, not just
 * trusted from the token — see src/lib/auth/current-user.ts.
 *
 * Uses the Web Crypto API (globalThis.crypto.subtle) rather than
 * node:crypto so the same code runs unmodified in both the Node.js runtime
 * and Next.js Edge middleware, which does not reliably expose node:crypto.
 */

export interface SessionPayload {
  userId: string;
  businessId: string;
  role: string;
  /** Unix seconds expiry. */
  exp: number;
}

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "AUTH_SECRET is not set (or too short). Set a random 32-byte value in .env — see .env.example.",
    );
  }
  return secret;
}

let cachedKey: { secret: string; key: CryptoKey } | null = null;

async function getHmacKey(): Promise<CryptoKey> {
  const secret = getSecret();
  if (cachedKey && cachedKey.secret === secret) return cachedKey.key;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  cachedKey = { secret, key };
  return key;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(b64url.length / 4) * 4, "=");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function createSessionToken(claims: Omit<SessionPayload, "exp">): Promise<string> {
  const payload: SessionPayload = {
    ...claims,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const payloadB64 = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await getHmacKey();
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const signature = bytesToBase64Url(new Uint8Array(sigBuf));
  return `${payloadB64}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;

  try {
    const key = await getHmacKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64UrlToBytes(signature) as BufferSource,
      new TextEncoder().encode(payloadB64) as BufferSource,
    );
    if (!valid) return null;

    const payload = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadB64))) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "shoexpress_session";
export const SESSION_COOKIE_MAX_AGE = SESSION_MAX_AGE_SECONDS;
