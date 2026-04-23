import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { adminAuth } from '@/lib/firebase-admin';
import { ObjectId } from 'mongodb';
import { encrypt, decrypt, isEncrypted } from '@/lib/crypto';

const SENSITIVE_FIELDS = ['tcNo', 'householdNo', 'phone', 'address', 'password', 'details'];

// In-memory cache for personnel roles to reduce DB lookups
interface RoleCacheEntry {
  userRole: string | null;
  isActive: boolean;
  isApproved: boolean;
  timestamp: number;
}
const roleCache = new Map<string, RoleCacheEntry>();
const ROLE_CACHE_TTL = 30000; // 30 seconds

function decryptSensitiveFields(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(decryptSensitiveFields);
  
  const result = { ...doc };
  for (const field of SENSITIVE_FIELDS) {
    if (typeof result[field] === 'string' && isEncrypted(result[field])) {
      result[field] = decrypt(result[field]);
    }
  }
  
  // Also process nested objects (like history)
  for (const key in result) {
    if (typeof result[key] === 'object' && result[key] !== null && !(result[key] instanceof Date) && !(result[key] instanceof ObjectId)) {
      result[key] = decryptSensitiveFields(result[key]);
    }
  }
  
  return result;
}

function encryptSensitiveFields(doc: any): any {
  if (!doc || typeof doc !== 'object') return doc;
  if (Array.isArray(doc)) return doc.map(encryptSensitiveFields);

  const result = { ...doc };
  for (const field of SENSITIVE_FIELDS) {
    if (typeof result[field] === 'string' && !isEncrypted(result[field])) {
      result[field] = encrypt(result[field]);
    }
  }

  // Also process nested objects
  for (const key in result) {
    if (typeof result[key] === 'object' && result[key] !== null && !(result[key] instanceof Date) && !(result[key] instanceof ObjectId)) {
      result[key] = encryptSensitiveFields(result[key]);
    }
  }

  return result;
}

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
    
    // Role-based Access Control
    const userEmail = user.email;
    const adminEmails = ["edirnesydv@gmail.com", "edirneysdv@gmail.com", "real.lucifer22@gmail.com"];
    
    // Check if user is a hardcoded admin
    const andIsHardcodedAdmin = userEmail && adminEmails.includes(userEmail);
    
    let userRole: string | null = andIsHardcodedAdmin ? 'admin' : null;
    let isActive: boolean = !!andIsHardcodedAdmin;
    let isApproved: boolean = !!andIsHardcodedAdmin;
    
    // Use cache for roles if not hardcoded admin
    if (!andIsHardcodedAdmin && userEmail) {
      const cached = roleCache.get(userEmail);
      if (cached && Date.now() - cached.timestamp < ROLE_CACHE_TTL) {
        userRole = cached.userRole;
        isActive = cached.isActive;
        isApproved = cached.isApproved;
      } else {
        const p = await db.collection('personnel').findOne({ email: userEmail });
        if (p) {
          userRole = p.role;
          isActive = p.isActive === true;
          isApproved = p.isApproved === true;
        } else {
          const d = await db.collection('dr_drivers').findOne({ googleEmail: userEmail }) || 
                    await db.collection('drivers').findOne({ googleEmail: userEmail });
          
          if (d) {
            userRole = 'driver';
            isActive = d.isActive !== false;
            isApproved = true;
          }
        }
        // Cache the result
        roleCache.set(userEmail, { userRole, isActive, isApproved, timestamp: Date.now() });
      }
    }
    
    const isAdmin = userRole === 'admin';
    const isAuthorized = isAdmin || (isActive && isApproved);
    
    if (!isAuthorized) {
      // Allow only self-fetching of personnel record for approval status check
      if (collection === 'personnel' && operation === 'list' && queryObj?.email === userEmail) {
        // Continue
      } else if (collection === 'personnel' && operation === 'count') {
        // Continue for first-time setup check
      } else if (collection === 'dr_drivers' || collection === 'drivers') {
        // Continue if they are trying to check their own driver status
      } else {
        return NextResponse.json({ error: 'Access Denied: Account not active or approved' }, { status: 403 });
      }
    }

    // Restriction 1: Only admins can delete anything
    if (operation === 'delete' && !isAdmin) {
      return NextResponse.json({ error: 'Only admins can delete data' }, { status: 403 });
    }
    
    // Restriction 2: Only admins can manage personnel or system settings
    if (['personnel', 'system_settings', 'working_days'].includes(collection) && !['get', 'list', 'count'].includes(operation) && !isAdmin) {
       // Allow self-update for profile (optional, but keep it strict for now)
       return NextResponse.json({ error: 'Only admins can modify system configurations' }, { status: 403 });
    }

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

    const convertIncomingObjectIds = (obj: any, isQuery: boolean = false): any => {
      if (obj === null || obj === undefined) return obj;
      
      if (Array.isArray(obj)) {
         return obj.map(item => convertIncomingObjectIds(item, isQuery));
      }
      
      if (typeof obj === 'object') {
        if (obj instanceof ObjectId || obj instanceof Date) return obj;
        
        const newObj: any = {};
        const dateFields = [
          'createdAt', 'updatedAt', 'timestamp', 'submittedAt', 
          'lastBackupDate', 'deliveredAt', 'personnelCompletionTime'
        ];

        for (const [key, value] of Object.entries(obj)) {
          // Rule 1: Map 'id' to '_id' for MongoDB compat ONLY if we are returning or querying by it... actually for inserts we should also strip 'id'
          const targetKey = (key === 'id') ? '_id' : key;
          
          if (typeof value === 'string') {
            // Check if it's a 24-char hex ID
            if (/^[0-9a-fA-F]{24}$/.test(value)) {
              // Primary ID or field ending with Id
              if (targetKey === '_id' || targetKey.endsWith('Id') || targetKey === 'defaultDriverId') {
                 if (isQuery) {
                   // Use $in to support both string and ObjectId for mixed data queries
                   newObj[targetKey] = { $in: [value, new ObjectId(value)] };
                 } else {
                   // For inserts/updates, strictly save as ObjectId if it's a 24-char hex, or save as string?
                   // Currently, we'll store as string to be safe and consistent with React, 
                   // except for _id which should be ObjectId (let mongo generate or parse correctly)
                   newObj[targetKey] = targetKey === '_id' ? new ObjectId(value) : value; // DO NOT convert foreign keys to ObjectId forcibly unless required, string works.
                 }
              } else {
                 newObj[targetKey] = value;
              }
            } 
            // Check if it's a date string that should be a Date object
            else if (targetKey.endsWith('At') || dateFields.includes(targetKey)) {
              const d = new Date(value);
              if (!isNaN(d.getTime())) {
                newObj[targetKey] = d;
              } else {
                newObj[targetKey] = value;
              }
            } else {
              newObj[targetKey] = value;
            }
          } else if (typeof value === 'object' && value !== null) {
            // Case for $in, $nin or nested objects
            if (!Array.isArray(value)) {
               // Handle MongoDB operators like $in
               const processedVal: any = {};
               for (const [opKey, opVal] of Object.entries(value)) {
                 if (['$in', '$nin', '$ne', '$eq'].includes(opKey) && Array.isArray(opVal)) {
                    processedVal[opKey] = opVal.flatMap(item => {
                      if (typeof item === 'string' && /^[0-9a-fA-F]{24}$/.test(item) && (targetKey === '_id' || targetKey.endsWith('Id'))) {
                         // Support both formats in the $in/$nin array
                        return [item, new ObjectId(item)];
                      }
                      return [item];
                    });
                 } else if (typeof opVal === 'object' && opVal !== null) {
                    processedVal[opKey] = convertIncomingObjectIds(opVal, isQuery);
                 } else {
                    processedVal[opKey] = opVal;
                 }
               }
               newObj[targetKey] = processedVal;
            } else {
               newObj[targetKey] = convertIncomingObjectIds(value, isQuery);
            }
          } else {
            newObj[targetKey] = value;
          }
        }
        return newObj;
      }
      
      return obj;
    };

    const safeData = data ? encryptSensitiveFields(convertIncomingObjectIds(data, false)) : {};
    const safeQuery = queryObj ? encryptSensitiveFields(convertIncomingObjectIds(queryObj, true)) : {};

    switch (operation) {
      case 'count': {
        const count = await col.countDocuments(safeQuery);
        return NextResponse.json({ count });
      }
      case 'list': {
        let cursor = col.find(safeQuery);
        if (sort) cursor = cursor.sort(sort);
        if (limitVal) cursor = cursor.limit(limitVal);
        const results = await cursor.toArray();
        return NextResponse.json(results.map(doc => decryptSensitiveFields(convertObjectIds(doc))));
      }
      case 'get': {
        const doc = await col.findOne({ _id: getQueryId(id) } as any);
        if (!doc) return NextResponse.json(null);
        return NextResponse.json(decryptSensitiveFields(convertObjectIds(doc)));
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
  } catch (error: any) {
    console.error('Database operation failed:', error);
    // Explicitly check for Mongodb connection errors or timeouts
    const errorStr = String(error);
    if (errorStr.includes('pool') || errorStr.includes('topology') || errorStr.includes('serverSelectionTimeout') || errorStr.includes('timed out')) {
       return NextResponse.json({ 
         error: 'Database Connection Error. The server is currently under high load. Please try again in 5-10 seconds.', 
         details: errorStr 
       }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal Server Error', details: errorStr }, { status: 500 });
  }
}
