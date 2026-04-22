import { MongoClient, Db, ServerApiVersion } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/asevi';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your Mongo URI to .env.local');
}

const options: any = {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
  connectTimeoutMS: 10000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10, // Optimize pool size for better reuse
  minPoolSize: 1, // Keep at least one connection warm
  maxIdleTimeMS: 30000, // Reuse connections for longer before closing
  waitQueueTimeoutMS: 5000, // Fail fast to avoid request buildup
  retryWrites: true,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

interface GlobalMongo {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoDb?: Db;
}

const globalWithMongo = global as typeof globalThis & GlobalMongo;

if (!globalWithMongo._mongoClientPromise) {
  client = new MongoClient(uri, options);
  globalWithMongo._mongoClientPromise = client.connect();
}
clientPromise = globalWithMongo._mongoClientPromise;

export default clientPromise;

export async function getDb(): Promise<Db> {
  if (globalWithMongo._mongoDb) {
    return globalWithMongo._mongoDb;
  }
  
  const client = await clientPromise;
  const db = client.db();
  globalWithMongo._mongoDb = db;
  return db;
}
