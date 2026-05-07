const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

async function checkOldRoutes() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    // Find a route before 2026-04-22
    const oldRoutes = await db.collection('routes').find({ date: { $lt: '2026-04-22' } }).toArray();
    console.log(`Found ${oldRoutes.length} old routes.`);
    
    for (const route of oldRoutes.slice(0, 3)) {
       console.log(`\nRoute: ${route._id} (String: ${route._id.toString()}) - Date: ${route.date}`);
       
       // check stops for this route with straight string vs ObjectId vs $in
       const stopsIds = await db.collection('route_stops').find({ routeId: route._id }).toArray();
       const stopsStrs = await db.collection('route_stops').find({ routeId: route._id.toString() }).toArray();
       const stopsObjObj = await db.collection('route_stops').find({ "routeId.$in": { $exists: true } }).toArray();

       console.log(`  Stops finding with ObjectId: ${stopsIds.length}`);
       console.log(`  Stops finding with String: ${stopsStrs.length}`);
       
       if (stopsIds.length > 0) {
           console.log(`  Sample stop routeId type: typeof ${typeof stopsIds[0].routeId}, instanceof ObjectId: ${stopsIds[0].routeId instanceof ObjectId}`);
       }
       if (stopsStrs.length > 0) {
           console.log(`  Sample stop routeId type: typeof ${typeof stopsStrs[0].routeId}, value: ${stopsStrs[0].routeId}`);
       }
    }

    const corruptedStopsCount = await db.collection('route_stops').countDocuments({ "routeId.$in": { $exists: true } });
    console.log(`\nTotal corrupted route stops with $in remaining: ${corruptedStopsCount}`);
    
  } finally {
    await client.close();
  }
}

checkOldRoutes().catch(console.error);
