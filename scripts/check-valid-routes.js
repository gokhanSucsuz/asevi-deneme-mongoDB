const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function checkValidRoutes() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const routes = await db.collection('routes').find().toArray();
    const routeIds = new Map(routes.map(r => [r._id.toString(), r]));
    
    // Look at routeStops
    const stops = await db.collection('route_stops').find().toArray();
    
    let validRoutes = new Set();
    
    for (const s of stops) {
       const rId = s.routeId instanceof ObjectId ? s.routeId.toString() : String(s.routeId);
       if (routeIds.has(rId)) {
          validRoutes.add(rId);
       }
    }
    
    console.log(`Routes that HAVE stops (${validRoutes.size}):`);
    for (const id of validRoutes) {
       const r = routeIds.get(id);
       console.log(`  Route ${id} - Date: ${r.date} - Driver: ${r.driverId}`);
    }

  } finally {
    await client.close();
  }
}

checkValidRoutes().catch(console.error);
