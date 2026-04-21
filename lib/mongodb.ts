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
  connectTimeoutMS: 20000,
  socketTimeoutMS: 60000,
  maxPoolSize: 5, // Bir bağlantı havuzuna 5 bağlantı yeterlidir (Atlas M0 limitini korumak için)
  minPoolSize: 0, // Boştayken 0'a inmesine izin ver (bağlantı sızıntısını önler)
  maxIdleTimeMS: 15000, // Boştaki bağlantıları 15 saniye sonra kapat
  waitQueueTimeoutMS: 10000, // Bağlantı için 10 saniye bekle, sonra hata ver
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
