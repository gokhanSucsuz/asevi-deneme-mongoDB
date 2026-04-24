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
  maxPoolSize: 50,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 10000,
  retryWrites: true,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

interface GlobalMongo {
  _mongoClientPromise?: Promise<MongoClient>;
  _mongoDb?: Db;
}

const globalWithMongo = global as typeof globalThis & GlobalMongo;

if (process.env.NODE_ENV === 'development') {
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect().then(c => {
      console.log('MongoDB connected successfully (Development)');
      return c;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  // In production (Cloud Run), we use the singleton pattern to reuse connections across requests
  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect().then(c => {
      console.log('MongoDB connected successfully (Production)');
      return c;
    });
  }
  clientPromise = globalWithMongo._mongoClientPromise;
}

export default clientPromise;

export async function getDb(): Promise<Db> {
  // Prioritize using the cached DB instance if available
  if (globalWithMongo._mongoDb) {
    return globalWithMongo._mongoDb;
  }
  
  const connectedClient = await clientPromise;
  const db = connectedClient.db();
  globalWithMongo._mongoDb = db;
  return db;
}
