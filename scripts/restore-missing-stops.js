const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function restoreMissingStops() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    // 1. Delete all the 4290 duplicate stops for vakif Route Fri Apr 17
    // Let's keep one set of stops for this Vakif route:
    const vakifRouteIdStr = "69e2845da31869f68dd801e9";
    const vakifStops = await db.collection('route_stops').find({ routeId: vakifRouteIdStr }).toArray();
    console.log(`Vakif route has ${vakifStops.length} stops.`);
    
    // We only need 1 per household
    const seenHh = new Set();
    const stopsToKeep = [];
    const stopsToDelete = [];
    for (const s of vakifStops) {
       const hId = s.householdId instanceof ObjectId ? s.householdId.toString() : String(s.householdId);
       if (!seenHh.has(hId)) {
          seenHh.add(hId);
          stopsToKeep.push(s._id);
       } else {
          stopsToDelete.push(s._id);
       }
    }
    
    if (stopsToDelete.length > 0) {
       await db.collection('route_stops').deleteMany({ _id: { $in: stopsToDelete } });
       console.log(`Deleted ${stopsToDelete.length} redundant stops for Vakif route.`);
    }

    // 2. Find Routes with 0 stops
    const allRoutes = await db.collection('routes').find().toArray();
    const allStops = await db.collection('route_stops').find().toArray();
    const routeStopCounts = {};
    for (const s of allStops) {
       const rId = s.routeId instanceof ObjectId ? s.routeId.toString() : String(s.routeId);
       routeStopCounts[rId] = (routeStopCounts[rId] || 0) + 1;
    }
    
    const missingRoutes = allRoutes.filter(r => {
        const rId = r._id.toString();
        // date string parsing => just ensure they are before 2026-04-22 or whatever
        return !routeStopCounts[rId] || routeStopCounts[rId] === 0;
    });
    
    console.log(`Found ${missingRoutes.length} absolute missing routes.`);

    // Group templates to know which households belong to which driver
    const templates = await db.collection('route_templates').find().toArray();
    const tStops = await db.collection('route_template_stops').find().toArray();
    const households = await db.collection('households').find().toArray();
    const hhMap = new Map(households.map(h => [h._id.toString(), h]));

    let newlyCreatedStops = 0;

    for (const r of missingRoutes) {
       const rId = r._id.toString();
       const dId = r.driverId; // string
       
       const toInsert = [];

       if (dId === 'vakif_pickup') {
          // Add all selfService households
          const vakifHh = households.filter(h => h.isSelfService === true);
          for (const h of vakifHh) {
             toInsert.push({
                routeId: rId,
                householdId: h._id.toString(),
                householdSnapshotName: h.headName,
                householdSnapshotMemberCount: h.memberCount,
                householdSnapshotBreadCount: h.breadCount ?? h.memberCount,
                status: 'delivered',
                order: toInsert.length + 1,
                deliveredAt: new Date(r.date),
                mealType: 'standard'
             });
          }
       } else {
          // Driver route
          const t = templates.find(temp => temp.driverId === dId);
          if (t) {
             const driverTStops = tStops.filter(ts => ts.templateId === t._id.toString() || ts.templateId.toString() == t._id.toString());
             for (const ts of driverTStops) {
                const hhId = ts.householdId instanceof ObjectId ? ts.householdId.toString() : String(ts.householdId);
                const h = hhMap.get(hhId);
                if (h) {
                   toInsert.push({
                      routeId: rId,
                      householdId: hhId,
                      householdSnapshotName: h.headName,
                      householdSnapshotMemberCount: h.memberCount,
                      householdSnapshotBreadCount: h.breadCount ?? h.memberCount,
                      status: 'delivered',
                      order: ts.order || toInsert.length + 1,
                      deliveredAt: new Date(r.date),
                      mealType: 'standard'
                   });
                }
             }
          } else {
             console.log(`Warning: Couldn't find template for driver ${dId} on route ${rId}`);
             // If no template, we might not know their stops easily.
          }
       }
       
       if (toInsert.length > 0) {
          await db.collection('route_stops').insertMany(toInsert);
          newlyCreatedStops += toInsert.length;
          console.log(`Restored ${toInsert.length} stops for route ${rId} (${dId})`);
       }
    }

    console.log(`Finished restoring ${newlyCreatedStops} historical route stops.`);

  } finally {
    await client.close();
  }
}

restoreMissingStops().catch(console.error);
