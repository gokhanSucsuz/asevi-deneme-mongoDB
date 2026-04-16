import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { getDb } from '@/lib/mongodb';

export async function GET(req: Request) {
  try {
    // Güvenlik için basit bir anahtar kontrolü eklenebilir
    // const { searchParams } = new URL(req.url);
    // if (searchParams.get('key') !== process.env.MIGRATION_KEY) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    // }

    console.log('Migration started via API...');
    const mongoDb = await getDb();

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

    const results: any = {};

    for (const collectionName of collections) {
      console.log(`Migrating collection: ${collectionName}...`);
      const snapshot = await adminDb.collection(collectionName).get();
      
      if (snapshot.empty) {
        results[collectionName] = 0;
        continue;
      }

      const docs = snapshot.docs.map(doc => {
        const data = doc.data();
        // Firestore Timestamp'leri MongoDB için Date nesnelerine dönüştür
        for (const key in data) {
          if (data[key] && typeof data[key].toDate === 'function') {
            data[key] = data[key].toDate();
          }
        }
        return { _id: doc.id, ...data };
      });

      const mongoCollection = mongoDb.collection(collectionName);
      
      const operations: any[] = docs.map(doc => ({
        replaceOne: {
          filter: { _id: doc._id },
          replacement: doc,
          upsert: true
        }
      }));

      await mongoCollection.bulkWrite(operations);
      results[collectionName] = docs.length;
      console.log(`Migrated ${docs.length} documents for ${collectionName}.`);
    }

    return NextResponse.json({ 
      message: 'Migration completed successfully!', 
      results 
    });
  } catch (error: any) {
    console.error('Migration error:', error);
    return NextResponse.json({ 
      error: error.message || 'Migration failed' 
    }, { status: 500 });
  }
}
