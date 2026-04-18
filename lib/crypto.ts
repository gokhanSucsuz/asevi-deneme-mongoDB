import CryptoJS from 'crypto-js';

// The key should be 32 bytes for AES-256
const SECRET_KEY = process.env.ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!';
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
  if (!ciphertext || typeof ciphertext !== 'string') return ciphertext || '';
  
  // If it doesn't look like our encrypted format (Base64 and specific length), return as is
  // AES block size is 16 bytes, so Base64 length will be 24, 44, 64 etc.
  if (ciphertext.length < 20 || !/^[a-zA-Z0-9+/=]+$/.test(ciphertext)) {
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
    
    // If originalText is empty, it might be because the key is wrong 
    // or the data wasn't actually encrypted but looked like it.
    return originalText || ciphertext;
  } catch (error) {
    console.error('Decryption error:', error);
    return ciphertext;
  }
};

/**
 * Helper to check if a string is likely encrypted.
 */
export const isEncrypted = (text: string | undefined): boolean => {
  if (!text || typeof text !== 'string') return false;
  
  // Basic heuristic: Encrypted strings in our system are Base64 and usually 24+ chars
  // and contain non-numeric characters.
  if (text.length < 20) return false;
  if (!/^[a-zA-Z0-9+/=]+$/.test(text)) return false;
  
  // If it's all numbers, it's definitely not our encrypted string
  if (/^\d+$/.test(text)) return false;

  return true;
};
