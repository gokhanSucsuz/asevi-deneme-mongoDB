import { db, Route, RouteStop } from './db';
import { format, addDays, isWeekend, startOfWeek, endOfWeek } from 'date-fns';
import { calculateBreadForNextDay } from './breadUtils';

/**
 * Checks if a given date is a working day
 */
export async function checkIsWorkingDay(date: Date): Promise<boolean> {
  const dateStr = format(date, 'yyyy-MM-dd');
  const monthStr = format(date, 'yyyy-MM');
  
  const workingDay = await db.working_days.where('date').equals(dateStr).first();
  if (workingDay) {
    return workingDay.isWorkingDay;
  }
  
  // Fallback to weekend check if not explicitly defined
  return !isWeekend(date);
}

/**
 * Checks if a given date is the last working day of the week (Monday-Sunday).
 * This is used to determine if we need to double the food/bread for Saturday.
 */
export async function isLastWorkingDayOfWeek(date: Date): Promise<boolean> {
  const isWorking = await checkIsWorkingDay(date);
  if (!isWorking) return false;

  // Check the remaining days of the week (up to Friday)
  // If any of them is a working day, then this date is NOT the last working day.
  // We only care about Monday-Friday.
  const currentDayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
  
  // If it's Saturday or Sunday, it's not the last working day of the regular week
  if (currentDayOfWeek === 0 || currentDayOfWeek === 6) return false;

  // Check days from tomorrow up to Friday
  for (let i = 1; i <= 5 - currentDayOfWeek; i++) {
    const nextDate = addDays(date, i);
    const nextIsWorking = await checkIsWorkingDay(nextDate);
    if (nextIsWorking) {
      return false; // Found a working day later in the week
    }
  }

  return true;
}

/**
 * Returns the next working day
 */
export async function getNextWorkingDay(date: Date): Promise<Date> {
  let next = addDays(date, 1);
  const nextMonth = format(next, 'yyyy-MM');
  
  // Check if working days are defined for this month
  const workingDays = await db.working_days.where('month').equals(nextMonth).toArray();
  
  if (workingDays.length > 0) {
    // Search in defined working days
    let searchDate = next;
    while (format(searchDate, 'yyyy-MM') === nextMonth) {
      const dateStr = format(searchDate, 'yyyy-MM-dd');
      const wd = workingDays.find(d => d.date === dateStr);
      if (wd && wd.isWorkingDay) return searchDate;
      searchDate = addDays(searchDate, 1);
    }
    
    // If we passed the month and didn't find anything, check the next month
    return getNextWorkingDay(addDays(searchDate, -1));
  }
  
  // Fallback to weekdays
  while (isWeekend(next)) {
    next = addDays(next, 1);
  }
  return next;
}

/**
 * Returns the previous working day
 */
export async function getPreviousWorkingDay(date: Date): Promise<Date> {
  let prev = addDays(date, -1);
  const prevMonth = format(prev, 'yyyy-MM');
  
  // Check if working days are defined for this month
  const workingDays = await db.working_days.where('month').equals(prevMonth).toArray();
  
  if (workingDays.length > 0) {
    // Search in defined working days
    let searchDate = prev;
    while (format(searchDate, 'yyyy-MM') === prevMonth) {
      const dateStr = format(searchDate, 'yyyy-MM-dd');
      const wd = workingDays.find(d => d.date === dateStr);
      if (wd && wd.isWorkingDay) return searchDate;
      searchDate = addDays(searchDate, -1);
    }
    
    // If we passed the month and didn't find anything, check the previous month
    return getPreviousWorkingDay(addDays(searchDate, 1));
  }
  
  // Fallback to weekdays
  while (isWeekend(prev)) {
    prev = addDays(prev, -1);
  }
  return prev;
}

/**
 * Generates a daily route for a driver from their template for a specific date
 */
export async function generateRouteFromTemplate(driverId: string, dateStr: string): Promise<string | null> {
  // Check if route already exists
  const existing = await db.routes.where('driverId').equals(driverId).toArray();
  if (existing.find(r => r.date === dateStr)) {
    return null;
  }

  const template = await db.routeTemplates.where('driverId').equals(driverId).first();
  if (!template) return null;

  const driver = await db.drivers.get(driverId);
  if (!driver || !driver.isActive) return null;

  // Create the route
  const routeId = await db.routes.add({
    driverId,
    driverSnapshotName: driver.name,
    date: dateStr,
    status: 'pending',
    createdAt: new Date(),
    history: [{ action: 'created', timestamp: new Date(), note: 'Sistem tarafından otomatik oluşturuldu' }]
  });

  if (!routeId) return null;

  const tStops = await db.routeTemplateStops.where('templateId').equals(template.id!).toArray();
  const stops: RouteStop[] = [];

  // Get all assigned households for this date to prevent duplicates
  const allRoutesOnDate = await db.routes.where('date').equals(dateStr).toArray();
  const allRouteIdsOnDate = allRoutesOnDate.map(r => r.id);
  const allStopsOnDate = await db.routeStops.toArray();
  const assignedHouseholdIds = allStopsOnDate
    .filter(rs => allRouteIdsOnDate.includes(rs.routeId))
    .map(rs => rs.householdId);

  for (const tStop of tStops) {
    const h = await db.households.get(tStop.householdId);
    if (!h) continue;
    
    // Skip if already assigned to another driver today
    if (assignedHouseholdIds.includes(h.id!)) continue;

    // Skip if deleted or paused (unless we want to show them as requested)
    // The user wants paused/deleted households shown at the bottom.
    // So we include them but maybe with a special status?
    // Actually, the user says: "if a household is deleted... specified at the bottom... only in the daily route where it was deleted."
    // And "if a household is paused... specified at the end in orange during the days it is paused."
    
    // For auto-generation, we should include paused households so they show up in orange.
    // For deleted ones, we only include them if they were deleted *after* the route was created? 
    // Or if they are part of the template but currently deleted?
    
    const isDeleted = h.pausedUntil === '9999-12-31';
    const isPaused = h.pausedUntil && h.pausedUntil >= dateStr;
    const isInactive = !h.isActive && !h.pausedUntil;

    // If it's hard inactive (not paused/deleted), we skip it.
    if (isInactive) continue;

    const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(dateStr));

    // Standard Meal
    stops.push({
      routeId: routeId as string,
      householdId: tStop.householdId,
      householdSnapshotName: h.headName,
      householdSnapshotMemberCount: h.memberCount,
      householdSnapshotBreadCount: h.breadCount ?? h.memberCount,
      order: tStop.order * 2 - 1,
      status: 'pending',
      mealType: 'standard'
    });

    // Breakfast Meal (only on last working day and if not opted out)
    if (isLastWorkingDay && !h.noBreakfast) {
      stops.push({
        routeId: routeId as string,
        householdId: tStop.householdId,
        householdSnapshotName: `${h.headName} (Kahvaltı)`,
        householdSnapshotMemberCount: h.memberCount,
        householdSnapshotBreadCount: 0, // Breakfast has no bread
        order: tStop.order * 2,
        status: 'pending',
        mealType: 'breakfast'
      });
    }
  }

  if (stops.length > 0) {
    await db.routeStops.bulkAdd(stops);
    return routeId as string;
  } else {
    await db.routes.delete(routeId as string);
    return null;
  }
}

/**
 * Automatically generates routes for all active drivers for the next working day
 */
export async function checkAndGenerateNextDayRoutes(currentDate: Date) {
  const dateStr = format(currentDate, 'yyyy-MM-dd');
  const allRoutesForDate = await db.routes.where('date').equals(dateStr).toArray();
  
  if (allRoutesForDate.length === 0) return;

  const allCompletedOrApproved = allRoutesForDate.every(r => r.status === 'completed' || r.status === 'approved');

  if (allCompletedOrApproved) {
    const nextDay = await getNextWorkingDay(currentDate);
    const nextDayStr = format(nextDay, 'yyyy-MM-dd');
    
    // Check if routes for next day already exist
    const existingRoutes = await db.routes.where('date').equals(nextDayStr).toArray();
    if (existingRoutes.length === 0) {
      const drivers = await db.drivers.toArray();
      for (const driver of drivers) {
        await generateRouteFromTemplate(driver.id!, nextDayStr);
      }
      
      // Generate Vakif Pickup Route
      const allHouseholds = await db.households.toArray();
      const pickupHouseholds = allHouseholds.filter(h => {
        if (!h.isActive) return false;
        if (!h.isSelfService) return false;
        if (h.pausedUntil === '9999-12-31') return false;
        if (h.pausedUntil && h.pausedUntil >= nextDayStr) return false;
        return true;
      });

      if (pickupHouseholds.length > 0) {
        const routeId = await db.routes.add({
          driverId: 'vakif_pickup',
          driverSnapshotName: 'Vakıf\'tan Yemek Alanlar',
          date: nextDayStr,
          status: 'pending',
          createdAt: new Date(),
          history: [{ action: 'created', timestamp: new Date(), note: 'Otomatik oluşturuldu' }]
        });

        const stops: RouteStop[] = [];
        let order = 1;
        const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(nextDayStr));

        for (const h of pickupHouseholds) {
          // Standard
          stops.push({
            routeId: routeId as string,
            householdId: h.id!,
            householdSnapshotName: h.headName,
            householdSnapshotMemberCount: h.memberCount,
            householdSnapshotBreadCount: h.breadCount ?? h.memberCount,
            order: order++,
            status: 'pending',
            mealType: 'standard'
          });

          // Breakfast
          if (isLastWorkingDay && !h.noBreakfast) {
            stops.push({
              routeId: routeId as string,
              householdId: h.id!,
              householdSnapshotName: `${h.headName} (Kahvaltı)`,
              householdSnapshotMemberCount: h.memberCount,
              householdSnapshotBreadCount: 0,
              order: order++,
              status: 'pending',
              mealType: 'breakfast'
            });
          }
        }

        await db.routeStops.bulkAdd(stops);
      }

      // Log the action
      await db.system_logs.add({
        action: 'Otomatik Rota Oluşturma',
        details: `${nextDayStr} tarihi için rotalar (Vakıf dahil) otomatik oluşturuldu.`,
        personnelName: 'Sistem',
        personnelEmail: 'system@localhost',
        timestamp: new Date(),
        category: 'route'
      });

      // Calculate and save bread tracking for the next day
      const nextIsWorking = await checkIsWorkingDay(nextDay);
      if (nextIsWorking) {
        const existingBreadTracking = await db.breadTracking.where('date').equals(nextDayStr).first();
        if (!existingBreadTracking) {
          const breadData = await calculateBreadForNextDay(nextDayStr);
          await db.breadTracking.add({
            date: nextDayStr,
            deliveryDate: nextDayStr,
            totalNeeded: breadData.totalNeeded,
            leftoverAmount: breadData.leftoverAmount,
            finalOrderAmount: breadData.finalOrderAmount,
            delivered: 0,
            status: 'pending',
            note: breadData.note
          });
        }
      }
    }
  }
}
