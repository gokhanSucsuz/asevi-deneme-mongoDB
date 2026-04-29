import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';

let app: App;

if (!getApps().length) {
  try {
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (privateKey) {
      // Vercel/Environment variable temizliği
      privateKey = privateKey.trim();
      
      // Eğer tırnak içindeyse temizle
      if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
        privateKey = privateKey.substring(1, privateKey.length - 1);
      }
      
      // \n karakterlerini gerçek satır sonlarına dönüştür (En kritik kısım)
      // Hem \\n hem de \n durumlarını kontrol eder
      privateKey = privateKey.split('\\n').join('\n');

      if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
        app = initializeApp({
          credential: cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: privateKey,
          }),
        });
        console.log('Firebase Admin initialized successfully with Service Account.');
      } else {
        throw new Error('Missing FIREBASE_PROJECT_ID or FIREBASE_CLIENT_EMAIL');
      }
    } else {
      // Yerel geliştirme veya sadece Project ID ile başlatma
      app = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asevi-ys',
      });
      console.log('Firebase Admin initialized with Project ID only (Fallback).');
    }
  } catch (error) {
    console.error('Firebase Admin initialization error:', error);
    // Hata durumunda bile objelerin null dönmemesi için boş başlatmayı dene
    app = initializeApp({ projectId: 'error-fallback' });
  }
} else {
  app = getApps()[0];
}

export const adminAuth: Auth = getAuth(app);
