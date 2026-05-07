const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function checkWhereStopsGo() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const routes = await db.collection('routes').find().toArray();
    const routeIds = new Set(routes.map(r => r._id.toString()));
    
    // Look at routeStops
    const stops = await db.collection('route_stops').find().toArray();
    
    let validMappings = 0;
    let missingRoutes = new Set();
    
    for (const s of stops) {
       const rId = s.routeId instanceof ObjectId ? s.routeId.toString() : String(s.routeId);
       if (routeIds.has(rId)) {
          validMappings++;
       } else {
          missingRoutes.add(rId);
       }
    }
    
    console.log(`Total stops: ${stops.length}`);
    console.log(`Valid stops mapping to existing routes: ${validMappings}`);
    console.log(`Orphaned stops pointing to NON-EXISTING routes: ${stops.length - validMappings}`);
    console.log(`Missing route IDs referenced by stops:`, Array.from(missingRoutes).slice(0, 10));

  } finally {
    await client.close();
  }
}

checkWhereStopsGo().catch(console.error);
