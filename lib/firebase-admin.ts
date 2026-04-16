import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      // Vercel'de bazen anahtar tırnak içinde gelebilir, onları temizleyelim
      privateKey = privateKey.trim();
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      
      // \n karakterlerini gerçek satır sonlarına dönüştürelim
      privateKey = privateKey.replace(/\\n/g, '\n');

      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
        console.log('Firebase Admin initialized successfully with Service Account.');
      } else {
        throw new Error('Missing Firebase Project ID or Client Email');
      }
    } else {
      // Fallback for local development
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asevi-ys',
      });
      console.log('Firebase Admin initialized with Project ID only (Fallback).');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // Build sırasında çökmemesi için boş bir uygulama başlatmayı deneyebiliriz 
    // veya sadece hatayı loglayıp geçebiliriz.
  }
}

export const adminAuth = admin.apps.length ? admin.auth() : null as any;
export const adminDb = admin.apps.length ? admin.firestore() : null as any;
