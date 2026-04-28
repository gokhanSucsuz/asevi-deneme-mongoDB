import { db } from './db';
import { format, differenceInDays } from 'date-fns';
import { getPreviousWorkingDay, isLastWorkingDayOfWeek } from './route-utils';

export async function calculateBreadForNextDay(dateStr: string) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isPast = dateStr < todayStr;

  // 1. Get existing tracking record
  const existing = await db.breadTracking.where('date').equals(dateStr).first();

  // 2. Get leftover for the SAME day (from routes + manual)
  // For past dates with existing records, we respect the stored leftover amount
  // to allow for manual corrections to stay fixed.
  let leftoverAmount = 0;
  if (isPast && existing) {
    leftoverAmount = existing.leftoverAmount;
  } else {
    const routes = await db.routes.where('date').equals(dateStr).toArray();
    // Deneme içeren test rotalarından artan ekmek sayımını çıkarıyoruz
    const validRoutes = routes.filter(r => !r.driverSnapshotName?.toLowerCase().includes('deneme'));
    const routeLeftover = validRoutes.reduce((sum, r) => sum + (r.remainingBread || 0), 0);
    const manualLeftover = existing?.manualLeftoverAmount || 0;
    leftoverAmount = routeLeftover + manualLeftover;
  }

  // 3. Calculate total needed
  let totalNeeded = 0;
  if (isPast && existing) {
    // Freeze totalNeeded for past dates if record exists
    totalNeeded = existing.totalNeeded;
    
    // Formula: Total Needed - Today's Leftover = Ordered Bread
    const finalOrderAmount = existing.finalOrderAmount;

    return { 
      totalNeeded, 
      leftoverAmount, 
      finalOrderAmount, 
      containerCount: existing?.containerCount,
      ownContainerCount: existing?.ownContainerCount,
      note: existing?.note,
      manualLeftoverAmount: existing?.manualLeftoverAmount,
      manualLeftoverNote: existing?.manualLeftoverNote,
      manualTotalAmountAdjustment: existing?.manualTotalAmountAdjustment
    };
  } else {
    // Calculate dynamically for today/future or if no past record exists
    const allHouseholds = await db.households.toArray();
    const activeHouseholds = allHouseholds.filter(h => {
      if (!h.isActive) return false;
      if (h.headName?.toLowerCase().includes('deneme')) return false;
      if (h.pausedUntil && h.pausedUntil >= dateStr) return false;
      if (h.pausedUntil === '9999-12-31') return false;
      return true;
    });

    const totalPeople = activeHouseholds.reduce((sum, h) => sum + (h.memberCount || 0), 0);
    const calculatedTotalNeeded = activeHouseholds.reduce((sum, h) => sum + (h.breadCount ?? h.memberCount ?? 0), 0);
    const manualTotalAdjustment = existing?.manualTotalAmountAdjustment || 0;
    totalNeeded = calculatedTotalNeeded + manualTotalAdjustment;

    // Calculate ownContainerCount
    const ownContainerCount = activeHouseholds.reduce((sum, h) => {
      if (h.usesOwnContainer) {
        return sum + (h.memberCount || 0);
      }
      return sum;
    }, 0);

    // Calculate containerCount (Vakıf Kabı)
    // Formula: Total Meals (People) - Own Container (People)
    let containerCount = totalPeople - ownContainerCount;

    // Check if it's the last working day of the week (e.g., Friday)
    const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(dateStr));
    
    // Formula: Total Needed - Today's Leftover = Ordered Bread
    let finalOrderAmount = Math.max(0, totalNeeded - leftoverAmount);

    // User special request logic:
    // "ekmek takibi sayfasında içinde bulunulan haftanın son iş günü toplam ekmek ihtiyacını sipariş miktarı olarak verebilir, artan ekmek miktarı dahil edilmez."
    if (isLastWorkingDay) {
      finalOrderAmount = totalNeeded;
    }

    if (isLastWorkingDay) {
      // Food is doubled (Standard + Breakfast), but bread stays 1x
      // Breakfast count excludes households with noBreakfast: true
      const breakfastPeople = activeHouseholds
        .filter(h => !h.noBreakfast)
        .reduce((sum, h) => sum + (h.memberCount || 0), 0);
      
      const breakfastOwnContainerCount = activeHouseholds
        .filter(h => !h.noBreakfast && h.usesOwnContainer)
        .reduce((sum, h) => sum + (h.memberCount || 0), 0);
      
      const breakfastVakifContainerCount = breakfastPeople - breakfastOwnContainerCount;
      
      containerCount += breakfastVakifContainerCount;
    }

    // Formula: Total Needed - Today's Leftover = Ordered Bread
    return { 
      totalNeeded, 
      leftoverAmount, 
      finalOrderAmount, 
      containerCount,
      ownContainerCount,
      note: existing?.note,
      manualLeftoverAmount: existing?.manualLeftoverAmount,
      manualLeftoverNote: existing?.manualLeftoverNote,
      manualTotalAmountAdjustment: existing?.manualTotalAmountAdjustment
    };
  }
}
