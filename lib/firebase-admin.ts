import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'asevi-ys',
  });
}

export const adminAuth = admin.auth();
export const adminDb = admin.firestore();
