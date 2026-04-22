import { db } from './lib/db';
import { generateRouteFromTemplate, isLastWorkingDayOfWeek } from './lib/route-utils';

async function forceRepairOzkan() {
  const driverId = '69e28cd7c6c220fd2a8360da';
  const driverName = 'ÖZKAN ÇAĞDAVULCU';
  const targetDate = '2026-04-22';

  console.log(`--- FORCING REPAIR FOR ${driverName} ON ${targetDate} ---`);

  try {
    // 1. Find the driver to confirm ID
    const driver = await db.drivers.get(driverId);
    if (!driver) {
      console.error('Driver not found by ID!');
      // Try search by name just in case
      const drivers = await db.drivers.toArray();
      const ozkan = drivers.find(d => d.name.toUpperCase().includes('ÖZKAN'));
      if (!ozkan) throw new Error('Özkan driver not found at all!');
      console.log(`Found driver by name search: ${ozkan.name} (${ozkan.id})`);
    } else {
      console.log(`Found driver: ${driver.name}`);
    }

    // 2. Identify the template
    const template = await db.routeTemplates.where('driverId').equals(driverId).first();
    if (!template) throw new Error('No template found for this driver!');
    console.log(`Found template: ${template.id}`);

    const templateStops = await db.routeTemplateStops.where('templateId').equals(template.id!).toArray();
    console.log(`Template has ${templateStops.length} stops.`);
    const targetHouseholdIds = templateStops.map(ts => ts.householdId);

    // 3. CLEANUP: Delete ALL routes and stops for this driver on this date
    const existingRoutes = await db.routes.where('date').equals(targetDate).toArray();
    const ozkanRoutes = existingRoutes.filter(r => r.driverId === driverId);
    
    console.log(`Found ${ozkanRoutes.length} existing routes for this driver today. Deleting...`);
    for (const r of ozkanRoutes) {
      await db.routeStops.where('routeId').equals(r.id!).delete();
      await db.routes.delete(r.id!);
    }

    // 4. CONFLICT CLEANUP: Remove these specific households from ANY other routes on this date
    console.log('Cleaning target households from other drivers routes (Force Reclaim)...');
    const allRoutesToday = await db.routes.where('date').equals(targetDate).toArray();
    const allRouteIds = allRoutesToday.map(r => r.id!);
    
    // We'll iterate through all stops of today's routes
    for (const rid of allRouteIds) {
      const stopsOnOtherRoute = await db.routeStops.where('routeId').equals(rid).toArray();
      const conflicts = stopsOnOtherRoute.filter(s => targetHouseholdIds.includes(s.householdId));
      if (conflicts.length > 0) {
        console.log(`Route ${rid} has ${conflicts.length} conflicting stops. Deleting them...`);
        for (const c of conflicts) {
          await db.routeStops.delete(c.id!);
        }
      }
    }

    // 5. GENERATE
    console.log('Generating new route...');
    const resultId = await generateRouteFromTemplate(template.id!, targetDate);

    if (resultId) {
      const finalStops = await db.routeStops.where('routeId').equals(resultId).toArray();
      console.log(`SUCCESS! Route created with ID: ${resultId}`);
      console.log(`Total stops created: ${finalStops.length}`);
    } else {
      console.log('FAILED to generate route. Checking why...');
      // Manually try to insert if logic fails
      console.log('Attempting manual insertion...');
      const routeId = await db.routes.add({
        driverId,
        driverSnapshotName: driverName,
        date: targetDate,
        status: 'pending',
        createdAt: new Date(),
        history: [{ action: 'created', timestamp: new Date(), note: 'Zorunlu manuel onarım' }]
      });

      const households = await db.households.where('id').anyOf(targetHouseholdIds).toArray();
      const hMap = new Map(households.map(h => [h.id, h]));
      const isLastDay = await isLastWorkingDayOfWeek(new Date(targetDate));

      const newStops = [];
      for (const ts of templateStops) {
        const h = hMap.get(ts.householdId);
        if (!h) continue;
        
        const isActuallyPassive = !h.isActive || (h.pausedUntil && h.pausedUntil >= targetDate);

        newStops.push({
          routeId: routeId,
          householdId: h.id!,
          householdSnapshotName: isActuallyPassive ? `${h.headName} (PASİF)` : h.headName,
          householdSnapshotMemberCount: isActuallyPassive ? 0 : h.memberCount,
          householdSnapshotBreadCount: isActuallyPassive ? 0 : (h.breadCount ?? h.memberCount),
          order: ts.order * 2 - 1,
          status: isActuallyPassive ? 'failed' : 'pending',
          issueReport: isActuallyPassive ? 'Sistem zorlaması ile eklendi (Pasif kontrolü yapıldı)' : undefined,
          mealType: 'standard'
        });

        if (isLastDay && !h.noBreakfast) {
          newStops.push({
            routeId: routeId,
            householdId: h.id!,
            householdSnapshotName: isActuallyPassive ? `${h.headName} (Kahvaltı-PASİF)` : `${h.headName} (Kahvaltı)`,
            householdSnapshotMemberCount: isActuallyPassive ? 0 : h.memberCount,
            householdSnapshotBreadCount: 0,
            order: ts.order * 2,
            status: isActuallyPassive ? 'failed' : 'pending',
            mealType: 'breakfast'
          });
        }
      }

      if (newStops.length > 0) {
        await db.routeStops.bulkAdd(newStops);
        console.log(`MANUAL SUCCESS! Created ${newStops.length} stops.`);
      } else {
        console.error('CRITICAL: No stops could be added even manually.');
      }
    }

  } catch (error) {
    console.error('Error during force repair:', error);
  }
}

forceRepairOzkan();
