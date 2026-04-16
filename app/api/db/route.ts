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
        const doc = await col.findOne({ _id: getQueryId(id) });
        if (!doc) return NextResponse.json(null);
        return NextResponse.json({ ...doc, id: doc._id.toString(), _id: undefined });
      }
      case 'add': {
        const result = await col.insertOne(data);
        return NextResponse.json({ id: result.insertedId.toString() });
      }
      case 'put': {
        const { id: docId, ...rest } = data;
        await col.replaceOne({ _id: getQueryId(docId) }, rest, { upsert: true });
        return NextResponse.json({ success: true });
      }
      case 'update': {
        await col.updateOne({ _id: getQueryId(id) }, { $set: data });
        return NextResponse.json({ success: true });
      }
      case 'delete': {
        if (id) {
          await col.deleteOne({ _id: getQueryId(id) });
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
      default:
        return NextResponse.json({ error: 'Invalid operation' }, { status: 400 });
    }
  } catch (error) {
    console.error('Database operation failed:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: String(error) }, { status: 500 });
  }
}
