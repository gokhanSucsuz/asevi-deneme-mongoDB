import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { adminAuth } from '@/lib/firebase-admin';
import { ObjectId } from 'mongodb';

async function verifyAuth(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    if (!adminAuth) {
      console.error('Firebase Admin not initialized');
      return null;
    }
    const decodedToken = await adminAuth.verifyIdToken(token);
    return decodedToken;
  } catch (error) {
    console.error('Auth verification failed:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  const user = await verifyAuth(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { collection, operation, data, id, query: queryObj, sort, limit: limitVal } = await req.json();
    const db = await getDb();
    const col = db.collection(collection);

    const getQueryId = (id: string) => {
      try {
        return new ObjectId(id);
      } catch (e) {
        return id;
      }
    };

    switch (operation) {
      case 'list': {
        let cursor = col.find(queryObj || {});
        if (sort) cursor = cursor.sort(sort);
        if (limitVal) cursor = cursor.limit(limitVal);
        const results = await cursor.toArray();
        return NextResponse.json(results.map(doc => ({ ...doc, id: doc._id.toString(), _id: undefined })));
      }
      case 'get': {
        const doc = await col.findOne({ _id: getQueryId(id) } as any);
        if (!doc) return NextResponse.json(null);
        return NextResponse.json({ ...doc, id: doc._id.toString(), _id: undefined });
      }
      case 'add': {
        const result = await col.insertOne(data);
        return NextResponse.json({ id: result.insertedId.toString() });
      }
      case 'put': {
        const { id: docId, ...rest } = data;
        await col.replaceOne({ _id: getQueryId(docId) } as any, rest, { upsert: true });
        return NextResponse.json({ success: true });
      }
      case 'update': {
        await col.updateOne({ _id: getQueryId(id) } as any, { $set: data });
        return NextResponse.json({ success: true });
      }
      case 'delete': {
        if (id) {
          await col.deleteOne({ _id: getQueryId(id) } as any);
        } else if (queryObj) {
          await col.deleteMany(queryObj);
        }
        return NextResponse.json({ success: true });
      }
      case 'bulkAdd': {
        if (Array.isArray(data) && data.length > 0) {
          await col.insertMany(data);
        }
        return NextResponse.json({ success: true });
      }
      case 'restore': {
        const backupData = data;
        // Tüm olası koleksiyon eşleşmeleri
        const mapping: any = {
          households: 'households',
          drivers: 'drivers',
          routes: 'routes',
          routeStops: 'route_stops',
          route_stops: 'route_stops',
          personnel: 'personnel',
          logs: 'system_logs',
          system_logs: 'system_logs',
          routeTemplates: 'route_templates',
          route_templates: 'route_templates',
          surveys: 'surveys',
          survey_responses: 'survey_responses',
          surveyResponses: 'survey_responses',
          working_days: 'working_days',
          workingDays: 'working_days',
          bread_tracking: 'bread_tracking',
          breadTracking: 'bread_tracking',
          leftover_food: 'leftover_food',
          leftoverFood: 'leftover_food',
          system_settings: 'system_settings',
          systemSettings: 'system_settings',
          tenders: 'tenders'
        };

        const results: any = {};

        for (const [jsonKey, mongoCollection] of Object.entries(mapping)) {
          const items = backupData[jsonKey];
          if (Array.isArray(items) && items.length > 0) {
            const collection = db.collection(mongoCollection as string);
            const operations = items.map((item: any) => {
              const { id, _id, ...rest } = item;
              const docId = id || _id;
              
              // Tarih alanlarını MongoDB Date objesine çevir (Sıralama ve filtreleme için kritik)
              const processedItem: any = { ...rest };
              for (const key in processedItem) {
                if (typeof processedItem[key] === 'string' && 
                   (key.endsWith('At') || key === 'timestamp' || key === 'submittedAt' || key === 'lastBackupDate')) {
                  const d = new Date(processedItem[key]);
                  if (!isNaN(d.getTime())) processedItem[key] = d;
                }
              }

              return {
                replaceOne: {
                  filter: { _id: getQueryId(docId) } as any,
                  replacement: { ...processedItem, _id: getQueryId(docId) },
                  upsert: true
                }
              };
            });
            
            await collection.bulkWrite(operations);
            results[mongoCollection as string] = (results[mongoCollection as string] || 0) + items.length;
          }
        }
        return NextResponse.json({ success: true, results });
      }
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database operation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
