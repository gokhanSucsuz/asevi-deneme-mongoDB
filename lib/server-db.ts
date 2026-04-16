import { unstable_cache } from 'next/cache';
import { getDb } from './mongodb';

// Helper to convert MongoDB objects for Next.js serialization
const toPlainObject = (data: any) => {
  if (!data) return data;
  const result = { ...data };
  
  if (result._id) {
    result.id = result._id.toString();
    delete result._id;
  }

  for (const key in result) {
    if (result[key] instanceof Date) {
      result[key] = result[key].toISOString();
    } else if (Array.isArray(result[key])) {
      result[key] = result[key].map(toPlainObject);
    } else if (typeof result[key] === 'object' && result[key] !== null) {
      result[key] = toPlainObject(result[key]);
    }
  }
  return result;
};

export const getCachedHouseholds = unstable_cache(
  async () => {
    const db = await getDb();
    const docs = await db.collection('households').find({}).toArray();
    return docs.map(toPlainObject);
  },
  ['households'],
  { tags: ['households'], revalidate: 300 } // Cache for 5 minutes
);

export const getCachedDrivers = unstable_cache(
  async () => {
    const db = await getDb();
    const docs = await db.collection('drivers').find({}).toArray();
    return docs.map(toPlainObject);
  },
  ['drivers'],
  { tags: ['drivers'], revalidate: 300 }
);

export const getCachedRoutes = unstable_cache(
  async (date?: string) => {
    const db = await getDb();
    const query = date ? { date } : {};
    const docs = await db.collection('routes').find(query).toArray();
    return docs.map(toPlainObject);
  },
  ['routes'],
  { tags: ['routes'], revalidate: 60 } // Routes change more often
);

export const getCachedSystemLogs = unstable_cache(
  async (limitCount: number = 50) => {
    const db = await getDb();
    const docs = await db.collection('system_logs')
      .find({})
      .sort({ timestamp: -1 })
      .limit(limitCount)
      .toArray();
    return docs.map(toPlainObject);
  },
  ['system_logs'],
  { tags: ['system_logs'], revalidate: 60 }
);
