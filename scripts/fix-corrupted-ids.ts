import { MongoClient, ObjectId } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function fixDb() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not defined in the environment variables');
  }
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    console.log('Starting DB fix operation for route_stops...');
    
    const stops = await db.collection('route_stops').find({ "routeId.$in": { $exists: true } }).toArray();
    console.log(`Found ${stops.length} corrupted route_stops with routeId as $in operator`);
    
    let fixedStops = 0;
    
    for (const stop of stops) {
       try {
         const correctRouteIdStr = stop.routeId.$in[0];
         await db.collection('route_stops').updateOne(
           { _id: stop._id },
           { $set: { routeId: correctRouteIdStr } }
         );
         fixedStops++;
       } catch (err) {
         console.error(`Error fixing stop ${stop._id}:`, (err as any).message);
       }
    }
    
    console.log(`Fixed ${fixedStops} corrupted 'routeId' in route_stops.`);

    // Similarly check householdId
    const stopsH = await db.collection('route_stops').find({ "householdId.$in": { $exists: true } }).toArray();
    console.log(`Found ${stopsH.length} corrupted route_stops with householdId as $in operator`);
    
    let fixedStopsH = 0;
    for (const stop of stopsH) {
       try {
         const correctHIdStr = stop.householdId.$in[0];
         await db.collection('route_stops').updateOne(
           { _id: stop._id },
           { $set: { householdId: correctHIdStr } }
         );
         fixedStopsH++;
       } catch (err) {
         console.error(`Error fixing stop householdId ${stop._id}:`, (err as any).message);
       }
    }
    
    console.log(`Fixed ${fixedStopsH} corrupted 'householdId' in route_stops.`);
    
    // Check drivers corruption in routes
    const routesDriver = await db.collection('routes').find({ "driverId.$in": { $exists: true } }).toArray();
    console.log(`Found ${routesDriver.length} routes with corrupted driverId -> Object`);
    
    let fixRtrCount = 0;
    for (const r of routesDriver) {
      const correctDriverId = r.driverId.$in[0];
      await db.collection('routes').updateOne({ _id: r._id }, { $set: { driverId: correctDriverId }});
      fixRtrCount++;
    }
    console.log(`Fixed ${fixRtrCount} corrupted routes with driverId.`);

  } finally {
    await client.close();
    console.log('Finished DB fix operation.');
  }
}

fixDb().catch(console.error);
