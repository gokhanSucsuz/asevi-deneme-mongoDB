import CryptoJS from 'crypto-js';

// The key should be 32 bytes for AES-256
const SECRET_KEY = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!';
// Fixed IV for determinism - allows Firestore 'where' queries to work
const FIXED_IV = CryptoJS.enc.Hex.parse('000102030405060708090a0b0c0d0e0f');

/**
 * Encrypts a string using AES-256.
 * Deterministic: Same input + Same key = Same output.
 */
export const encrypt = (text: string | undefined): string => {
  if (!text) return '';
  const key = CryptoJS.SHA256(SECRET_KEY);
  const encrypted = CryptoJS.AES.encrypt(text, key, {
    iv: FIXED_IV,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  return encrypted.toString();
};

/**
 * Decrypts an AES-256 encrypted string.
 */
export const decrypt = (ciphertext: string | undefined): string => {
  if (!ciphertext) return '';
  try {
    const key = CryptoJS.SHA256(SECRET_KEY);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv: FIXED_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    const originalText = decrypted.toString(CryptoJS.enc.Utf8);
    return originalText || ciphertext; // Fallback to ciphertext if decryption results in empty (might be unencrypted)
  } catch (error) {
    return ciphertext; // Return original if decryption fails
  }
};

/**
 * Helper to check if a string is likely encrypted.
 */
export const isEncrypted = (text: string | undefined): boolean => {
  if (!text) return false;
  // Simple check: if it's a valid Base64 and can be decrypted, it's encrypted.
  // For our purposes, we'll try to decrypt it in the UI or just assume if it looks like Base64.
  // But a better way is to just try decrypting and see if it works.
  try {
    const d = decrypt(text);
    return d !== text;
  } catch {
    return false;
  }
};
