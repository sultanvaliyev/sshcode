import nacl from "tweetnacl";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getKey(): Uint8Array {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY env var must be a 64-char hex string (32 bytes)"
    );
  }
  return hexToBytes(hex);
}

/**
 * Encrypt a plaintext string using NaCl secretbox (XSalsa20-Poly1305).
 * Returns a base64 string containing the nonce + ciphertext.
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);
  const messageBytes = new TextEncoder().encode(plaintext);
  const encrypted = nacl.secretbox(messageBytes, nonce, key);

  const combined = new Uint8Array(nonce.length + encrypted.length);
  combined.set(nonce);
  combined.set(encrypted, nonce.length);

  return bytesToBase64(combined);
}

/**
 * Decrypt a base64-encoded ciphertext (nonce + secretbox) back to plaintext.
 */
export function decrypt(encryptedBase64: string): string {
  const key = getKey();
  const combined = base64ToBytes(encryptedBase64);

  const nonce = combined.slice(0, nacl.secretbox.nonceLength);
  const ciphertext = combined.slice(nacl.secretbox.nonceLength);

  const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
  if (!decrypted) {
    throw new Error("Decryption failed — invalid key or corrupted data");
  }

  return new TextDecoder().decode(decrypted);
}
