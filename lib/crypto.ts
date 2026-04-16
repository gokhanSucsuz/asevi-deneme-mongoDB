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
  
  // If it doesn't look like Base64 or is too short, it's probably not encrypted
  if (ciphertext.length < 16 || !/^[A-Za-z0-9+/=]+$/.test(ciphertext)) {
    return ciphertext;
  }

  try {
    const key = CryptoJS.SHA256(SECRET_KEY);
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv: FIXED_IV,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7
    });
    
    const originalText = decrypted.toString(CryptoJS.enc.Utf8);
    
    // If decryption fails, originalText will be empty or gibberish.
    // Utf8 conversion usually fails or returns empty if the key is wrong.
    if (!originalText && ciphertext) {
      return ciphertext;
    }
    
    return originalText;
  } catch (error) {
    console.error('Decryption error:', error);
    return ciphertext;
  }
};

/**
 * Helper to check if a string is likely encrypted.
 * CryptoJS AES encrypted strings in Base64 usually start with 'U2FsdGVkX1' (Salted__)
 */
export const isEncrypted = (text: string | undefined): boolean => {
  if (!text) return false;
  return typeof text === 'string' && text.startsWith('U2FsdGVkX1');
};
