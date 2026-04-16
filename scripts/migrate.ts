import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;
const FIREBASE_SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

async function migrate() {
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not set in .env');
    process.exit(1);
  }

  // Initialize Firebase Admin
  if (getApps().length === 0) {
    if (FIREBASE_SERVICE_ACCOUNT_PATH && fs.existsSync(FIREBASE_SERVICE_ACCOUNT_PATH)) {
      const serviceAccount = JSON.parse(fs.readFileSync(FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount)
      });
    } else {
      // Try default initialization (works in AI Studio if provisioned)
      initializeApp();
    }
  }

  const firestore = getFirestore();
  const mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  const mongoDb = mongoClient.db();

  const collections = [
    'households',
    'drivers',
    'routes',
    'route_stops',
    'route_templates',
    'personnel',
    'system_logs',
    'surveys',
    'survey_responses',
    'working_days',
    'bread_tracking',
    'leftover_food',
    'system_settings'
  ];

  for (const collectionName of collections) {
    console.log(`Migrating collection: ${collectionName}...`);
    const snapshot = await firestore.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`Collection ${collectionName} is empty, skipping.`);
      continue;
    }

    const docs = snapshot.docs.map(doc => {
      const data = doc.data();
      // Convert Firestore Timestamps to Dates for MongoDB
      for (const key in data) {
        if (data[key] && typeof data[key].toDate === 'function') {
          data[key] = data[key].toDate();
        }
      }
      return { _id: doc.id, ...data };
    });

    const mongoCollection = mongoDb.collection(collectionName);
    
    // Clear existing data in MongoDB for this collection? 
    // Maybe better to use upsert or just insert if empty.
    // Let's use bulkWrite with upsert to be safe and allow re-runs.
    const operations: any[] = docs.map(doc => ({
      replaceOne: {
        filter: { _id: doc._id },
        replacement: doc,
        upsert: true
      }
    }));

    await mongoCollection.bulkWrite(operations);
    console.log(`Migrated ${docs.length} documents for ${collectionName}.`);
  }

  await mongoClient.close();
  console.log('Migration completed successfully!');
}

migrate().catch(console.error);
