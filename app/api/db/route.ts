import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { adminAuth } from '@/lib/firebase-admin';
import { ObjectId } from 'mongodb';
import { encrypt, isEncrypted } from '@/lib/crypto';

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

    const convertObjectIds = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(convertObjectIds);
      if (obj instanceof ObjectId) return obj.toString();
      if (obj instanceof Date) return obj.toISOString(); // Or leave it as Date and let NextResponse handle it
      
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === '_id') {
          newObj.id = value instanceof ObjectId ? value.toString() : String(value);
        } else if (value instanceof ObjectId) {
          newObj[key] = value.toString();
        } else if (value instanceof Date) {
          newObj[key] = value.toISOString();
        } else if (typeof value === 'object' && value !== null) {
          newObj[key] = convertObjectIds(value);
        } else {
          newObj[key] = value;
        }
      }
      return newObj;
    };

    const convertIncomingObjectIds = (obj: any): any => {
      if (obj === null || obj === undefined) return obj;
      
      if (Array.isArray(obj)) {
         return obj.map(item => {
             if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item)) {
                 return new ObjectId(item);
             }
             if (typeof item === 'object') {
                 return convertIncomingObjectIds(item);
             }
             return item;
         });
      }
      
      if (typeof obj === 'object') {
        if (obj instanceof ObjectId || obj instanceof Date) return obj;
        
        const newObj: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (key === 'id') {
              newObj[key] = value;
          } else if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
              if (key === '_id' || key.endsWith('Id') || key === 'defaultDriverId') {
                  newObj[key] = new ObjectId(value);
              } else {
                  newObj[key] = value;
              }
          } else if (typeof value === 'object' && value !== null) {
              newObj[key] = convertIncomingObjectIds(value);
          } else {
              newObj[key] = value;
          }
        }
        return newObj;
      }
      
      return obj;
    };

    const safeData = data ? convertIncomingObjectIds(data) : {};
    const safeQuery = queryObj ? convertIncomingObjectIds(queryObj) : {};

    switch (operation) {
      case 'list': {
        let cursor = col.find(safeQuery);
        if (sort) cursor = cursor.sort(sort);
        if (limitVal) cursor = cursor.limit(limitVal);
        const results = await cursor.toArray();
        if (collection === 'route_templates') {
          console.log('[DEBUG_LIST_ROUTES]', JSON.stringify(results, null, 2));
        }
        return NextResponse.json(results.map(doc => convertObjectIds(doc)));
      }
      case 'get': {
        const doc = await col.findOne({ _id: getQueryId(id) } as any);
        if (!doc) return NextResponse.json(null);
        return NextResponse.json(convertObjectIds(doc));
      }
      case 'add': {
        const result = await col.insertOne(safeData);
        return NextResponse.json({ id: result.insertedId.toString() });
      }
      case 'put': {
        const { id: docId, ...rest } = safeData;
        await col.replaceOne({ _id: getQueryId(docId) } as any, rest, { upsert: true });
        return NextResponse.json({ success: true });
      }
      case 'update': {
        await col.updateOne({ _id: getQueryId(id) } as any, { $set: safeData });
        return NextResponse.json({ success: true });
      }
      case 'delete': {
        if (id) {
          await col.deleteOne({ _id: getQueryId(id) } as any);
        } else if (safeQuery && Object.keys(safeQuery).length > 0) {
          await col.deleteMany(safeQuery);
        }
        return NextResponse.json({ success: true });
      }
      case 'bulkAdd': {
        if (Array.isArray(safeData) && safeData.length > 0) {
          await col.insertMany(safeData);
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
          routeTemplateStops: 'route_template_stops',
          route_template_stops: 'route_template_stops',
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
              const dateFields = [
                'createdAt', 'updatedAt', 'timestamp', 'submittedAt', 
                'lastBackupDate', 'deliveredAt', 'personnelCompletionTime'
              ];

              const stringDateFields = ['date', 'pausedUntil', 'endDate', 'month'];

              for (const key in processedItem) {
                if (typeof processedItem[key] === 'string') {
                  if (key.endsWith('At') || dateFields.includes(key)) {
                    const d = new Date(processedItem[key]);
                    if (!isNaN(d.getTime())) processedItem[key] = d;
                  } else if (stringDateFields.includes(key)) {
                    // Ensure it stays as yyyy-MM-dd string
                    if (processedItem[key].includes('T')) {
                      processedItem[key] = processedItem[key].split('T')[0];
                    }
                  }
                }
              }

              // Hassas verileri şifrele
              const sensitiveFields = ['tcNo', 'householdNo', 'phone', 'address', 'password'];
              for (const field of sensitiveFields) {
                if (processedItem[field] && !isEncrypted(processedItem[field])) {
                  processedItem[field] = encrypt(processedItem[field]);
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
