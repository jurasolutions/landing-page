/** Small Web Crypto helpers that run the same in Workers and in Node. */

const encoder = new TextEncoder();

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export function base64ToBytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export const base64UrlEncode = (bytes) =>
  bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function base64UrlDecode(text) {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  try {
    return base64ToBytes(padded);
  } catch {
    return null;
  }
}

export async function hmacKey(secretBytes) {
  return crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

/** Constant-time check of an HMAC-SHA256 signature: Web Crypto's verify does the comparison. */
export async function hmacVerify(key, signatureBytes, message) {
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(message));
}

export async function hmacSign(key, message) {
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}

export const utf8 = (text) => encoder.encode(text);
