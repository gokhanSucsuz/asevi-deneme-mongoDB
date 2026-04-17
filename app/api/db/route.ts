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

    // DIŞARI ÇIKAN VERİLER İÇİN (MongoDB -> Frontend)
    const convertObjectIds = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(convertObjectIds);
      if (obj instanceof ObjectId) return obj.toString();
      
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === '_id') {
          newObj.id = value instanceof ObjectId ? value.toString() : String(value);
        } else if (value instanceof ObjectId) {
          newObj[key] = value.toString();
        } else if (typeof value === 'object' && value !== null) {
          newObj[key] = convertObjectIds(value);
        } else {
          newObj[key] = value;
        }
      }
      return newObj;
    };

    // YENİ EKLENEN: İÇERİ GİREN VERİLER İÇİN (Frontend -> MongoDB)
    const processInboundData = (obj: any): any => {
      if (!obj || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(processInboundData);
      
      const newObj: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Eğer değer 24 karakterli geçerli bir ObjectId formatındaysa dönüştür
        if (typeof value === 'string' && value.length === 24 && /^[0-9a-fA-F]{24}$/.test(value)) {
          newObj[key] = new ObjectId(value);
        } else if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
          newObj[key] = processInboundData(value);
        } else {
          newObj[key] = value;
        }
      }
      return newObj;
    };

    switch (operation) {
      case 'list': {
        // Gelen sorgudaki id'leri objeye çeviriyoruz
        const processedQuery = queryObj ? processInboundData(queryObj) : {};
        let cursor = col.find(processedQuery);
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
        // Veriyi kaydederken id'leri objeye çeviriyoruz
        const result = await col.insertOne(processInboundData(data));
        return NextResponse.json({ id: result.insertedId.toString() });
      }
      case 'put': {
        const { id: docId, ...rest } = data;
        await col.replaceOne({ _id: getQueryId(docId) } as any, processInboundData(rest), { upsert: true });
        return NextResponse.json({ success: true });
      }
      case 'update': {
        await col.updateOne({ _id: getQueryId(id) } as any, { $set: processInboundData(data) });
        return NextResponse.json({ success: true });
      }
      case 'delete': {
        if (id) {
          await col.deleteOne({ _id: getQueryId(id) } as any);
        } else if (queryObj) {
          await col.deleteMany(processInboundData(queryObj));
        }
        return NextResponse.json({ success: true });
      }
      case 'bulkAdd': {
        if (Array.isArray(data) && data.length > 0) {
          await col.insertMany(processInboundData(data));
        }
        return NextResponse.json({ success: true });
      }
      case 'restore': {
        const backupData = data;
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
              
              // Restore işlemi de inbound bir işlemdir, processInboundData'dan geçirmeliyiz.
              const processedItem: any = processInboundData({ ...rest });
              
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
                    if (processedItem[key].includes('T')) {
                      processedItem[key] = processedItem[key].split('T')[0];
                    }
                  }
                }
              }

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
