import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

async function updateBread() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("No MONGODB_URI");
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    let result = await db.collection('bread_tracking').updateOne(
      { date: '2026-04-16' },
      { $set: { leftoverAmount: 7, finalOrderAmount: 499 } }
    );
    console.log("Matched exactly:", result.matchedCount, "Modified:", result.modifiedCount);
    
    // Also try listing all tracking dates to see if 2026-04-16 is differently formatted
    if (result.matchedCount === 0) {
       const docs = await db.collection('bread_tracking').find({}).toArray();
       console.log("Existing dates:", docs.map(d => d.date));
    }
  } finally {
    await client.close();
  }
}
updateBread().catch(console.error);
