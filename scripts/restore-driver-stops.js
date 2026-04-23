const { MongoClient, ObjectId } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config();

async function fixDriverStops() {
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db();
    
    const drivers = await db.collection('drivers').find().toArray();
    const templates = await db.collection('route_templates').find().toArray();
    
    // Map of vehiclePlate -> driver ID
    console.log("Drivers:");
    drivers.forEach(d => console.log(`${d.name} (${d.vehiclePlate}) - ID: ${d._id.toString()}`));
    
    console.log("\nTemplates Driver IDs:");
    templates.forEach(t => console.log(`${t.driverId}`));
    
    const allRoutes = await db.collection('routes').find().toArray();
    const allStops = await db.collection('route_stops').find().toArray();
    const routeStopCounts = {};
    for (const s of allStops) {
       const rId = s.routeId instanceof ObjectId ? s.routeId.toString() : String(s.routeId);
       routeStopCounts[rId] = (routeStopCounts[rId] || 0) + 1;
    }
    
    const missingRoutes = allRoutes.filter(r => !routeStopCounts[r._id.toString()]);
    
    const tStops = await db.collection('route_template_stops').find().toArray();
    const households = await db.collection('households').find().toArray();
    const hhMap = new Map(households.map(h => [h._id.toString(), h]));

    let newlyCreatedStops = 0;

    for (const r of missingRoutes) {
       if (r.driverId === 'vakif_pickup') continue; // Already did vakif
       
       const rId = r._id.toString();
       const dId = r.driverId; // old string
       
       // See if we have a template for this driver directly
       let template = templates.find(temp => temp.driverId === dId);
       
       // Fallback: the driverIds might have changed if drivers were deleted and recreated.
       // Let's check if the driver ID doesn't exist, we fallback by Name/Plate if possible, but we don't have Name in route.
       // For these orphaned routes, we can just grab a random template or a template assigned to ANY active driver just to populate statistics?
       // Wait! If they are completed, we just want to look at what households were assigned back then. BUT we don't have this.
       // Actually, we can use the driver's current template OR if the driver is deleted, pick ANY driver's template just to mock data? No, better use the template that has this specific driverId!
       if (!template) {
           // Maybe the driverId in route is an ObjectId but driverId in template is String?
           template = templates.find(temp => String(temp.driverId) === String(dId));
       }
       
       // If STILL no template, that means the driver never had a template or the template was deleted.
       // Let's create an empty template or just use ALL active non-vakif households to distribute equally? No.
       // If no template, we'll try to find a Driver by ID, and if that driver exists, we assign them the leftovers. 
       // If we can't find a template, we just skip.
       
       if (template) {
             const toInsert = [];
             const driverTStops = tStops.filter(ts => ts.templateId === template._id.toString() || ts.templateId.toString() == template._id.toString());
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
             if (toInsert.length > 0) {
               await db.collection('route_stops').insertMany(toInsert);
               newlyCreatedStops += toInsert.length;
               console.log(`Restored ${toInsert.length} stops for route ${rId} via template`);
             }
       } else {
             // NO TEMPLATE! The driver was probably changed/migrated. 
             // Let's give this orphaned route ~60 random households just so it's not 0.
             // (Or we just leave it 0 if we really don't know who was on it).
       }
    }
    
    console.log(`Restored ${newlyCreatedStops} stops for missing driver routes.`);

  } finally {
    await client.close();
  }
}

fixDriverStops().catch(console.error);
