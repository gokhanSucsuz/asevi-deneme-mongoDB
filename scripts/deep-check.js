const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function deepCheck() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    // Find routes before 2026-04-22
    const oldRoutes = await db.collection('routes').find({ date: { $lt: '2026-04-22' } }).toArray();
    console.log(`Checking ${oldRoutes.length} old routes...`);
    
    const rIds = oldRoutes.map(r => r._id.toString());
    const rIdsObj = oldRoutes.map(r => r._id);
    
    // Find all stops that belong to these old routes
    const stopsForOld = await db.collection('route_stops').find({ routeId: { $in: rIds } }).toArray();
    console.log(`Found ${stopsForOld.length} stops for old routes based on string match`);

    const stopsForOldObj = await db.collection('route_stops').find({ routeId: { $in: rIdsObj } }).toArray();
    console.log(`Found ${stopsForOldObj.length} stops for old routes based on ObjectId match`);

    // Let's just grab 5 random route_stops and check their routeId and householdId
    const sampleStops = await db.collection('route_stops').find({}).limit(5).toArray();
    for (const stop of sampleStops) {
      console.log(`Stop ID: ${stop._id}`);
      console.log(`  routeId: ${stop.routeId} (typeof: ${typeof stop.routeId}) ${stop.routeId instanceof ObjectId ? 'is ObjectId' : ''}`);
      console.log(`  date in stop?: ${stop.createdAt}`);
    }

  } finally {
    await client.close();
  }
}

deepCheck().catch(console.error);
