const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function mapCheck() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    // Check old routes
    const routes = await db.collection('routes').find().toArray();
    console.log(`Total routes: ${routes.length}`);
    
    const stops = await db.collection('route_stops').find().toArray();
    console.log(`Total stops: ${stops.length}`);

    // Map route IDs from stops
    const stopRouteIds = new Set(stops.map(s => {
       if (s.routeId instanceof ObjectId) return s.routeId.toString();
       if (typeof s.routeId === 'string') return s.routeId;
       if (s.routeId && s.routeId.$in) return s.routeId.$in[0].toString();
       return String(s.routeId);
    }));

    let orphanedRoutes = 0;
    
    for (const r of routes) {
       const rId = r._id.toString();
       if (!stopRouteIds.has(rId)) {
          console.log(`Route ${rId} (Date: ${r.date}, driver: ${r.driverId}) HAS NO STOPS!`);
          orphanedRoutes++;
       }
    }
    
    console.log(`Total routes without stops: ${orphanedRoutes}`);

  } finally {
    await client.close();
  }
}

mapCheck().catch(console.error);
