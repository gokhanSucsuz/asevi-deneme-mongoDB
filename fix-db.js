const { MongoClient } = require('mongodb');

async function fixCorruptedRouteStops() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set');
    return;
  }
  
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('Connected to MongoDB.');
    const db = client.db();
    
    // Fix route_stops where routeId is an object with $in
    const routeStopsCol = db.collection('route_stops');
    const corruptedStops = await routeStopsCol.find({ "routeId.$in": { $exists: true } }).toArray();
    
    console.log(`Found ${corruptedStops.length} corrupted route_stops.`);
    
    let count = 0;
    for (const stop of corruptedStops) {
      if (stop.routeId && stop.routeId.$in && Array.isArray(stop.routeId.$in)) {
        const correctId = stop.routeId.$in[0];
        if (typeof correctId === 'string' || typeof correctId === 'object') {
          await routeStopsCol.updateOne(
            { _id: stop._id },
            { $set: { routeId: correctId } }
          );
          count++;
        }
      }
    }
    console.log(`Fixed ${count} route_stops.`);
    
    // Fix routes where driverId might be corrupted
    const routesCol = db.collection('routes');
    const corruptedRoutes = await routesCol.find({ "driverId.$in": { $exists: true } }).toArray();
    console.log(`Found ${corruptedRoutes.length} corrupted routes.`);
    let rCount = 0;
    for (const route of corruptedRoutes) {
      if (route.driverId && route.driverId.$in && Array.isArray(route.driverId.$in)) {
        const correctId = route.driverId.$in[0];
        if (typeof correctId === 'string' || typeof correctId === 'object') {
            await routesCol.updateOne(
              { _id: route._id },
              { $set: { driverId: correctId } }
            );
            rCount++;
        }
      }
    }
    console.log(`Fixed ${rCount} routes.`);
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
    console.log('Done.');
  }
}

fixCorruptedRouteStops();
