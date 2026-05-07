const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function distributionCheck() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const stops = await db.collection('route_stops').find().toArray();
    
    let routeCountMap = {};
    for (const s of stops) {
       const rId = s.routeId instanceof ObjectId ? s.routeId.toString() : String(s.routeId);
       routeCountMap[rId] = (routeCountMap[rId] || 0) + 1;
    }
    
    console.log(`Route stops distribution across routeIds:`);
    const routes = await db.collection('routes').find().toArray();
    const routeIdsMap = new Map(routes.map(r => [r._id.toString(), r]));

    for (const [rId, count] of Object.entries(routeCountMap)) {
       const r = routeIdsMap.get(rId);
       if (r) {
          console.log(`Route ${rId} (Date: ${r.date}, Driver: ${r.driverId}): ${count} stops`);
       } else {
          console.log(`Route ${rId} (DELETED OR MISSING): ${count} stops`);
       }
    }

  } finally {
    await client.close();
  }
}

distributionCheck().catch(console.error);
