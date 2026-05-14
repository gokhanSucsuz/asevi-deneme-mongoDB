import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { formatInTimeZone } from 'date-fns-tz';
import { ObjectId } from 'mongodb';

const CRON_SECRET = process.env.CRON_SECRET;

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

async function checkIsWorkingDay(db: any, dateStr: string): Promise<boolean> {
  const workingDay = await db.collection('working_days').findOne({ date: dateStr });
  if (workingDay) return workingDay.isWorkingDay === true;
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return !isWeekend(d);
}

async function getNextWorkingDayStr(db: any, currentDateStr: string): Promise<string> {
  let parts = currentDateStr.split('-');
  let d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  
  while (true) {
    d.setDate(d.getDate() + 1);
    const nextStr = formatInTimeZone(d, 'Europe/Istanbul', 'yyyy-MM-dd');
    const isWorking = await checkIsWorkingDay(db, nextStr);
    if (isWorking) return nextStr;
  }
}

async function isLastWorkingDayOfWeek(db: any, dateStr: string): Promise<boolean> {
  const parts = dateStr.split('-');
  const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  
  const currentDayOfWeek = date.getDay();
  if (currentDayOfWeek === 0 || currentDayOfWeek === 6) return false;

  for (let i = 1; i <= 5 - currentDayOfWeek; i++) {
    const next = new Date(date);
    next.setDate(next.getDate() + i);
    const nextStr = formatInTimeZone(next, 'Europe/Istanbul', 'yyyy-MM-dd');
    const nextIsWorking = await checkIsWorkingDay(db, nextStr);
    if (nextIsWorking) {
      return false;
    }
  }
  return true;
}

/**
 * Vercel Cron Job: Her iş günü saat 18:00 TRT (15:00 UTC) çalışır.
 * O güne ait onaylanmamış (pending, in_progress, completed) tüm rotaları otomatik olarak 'approved' yapar.
 * Sonrasında eğer tüm rotalar onaylıysa bir sonraki iş günü için şoför ve vakıf rotalarını otomatik oluşturur.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();
    const todayStr = formatInTimeZone(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd');

    // 1. O güne ait onaylanmamış tüm rotaları bul ve onayla
    const routesToApprove = await db.collection('routes').find({
      date: todayStr,
      status: { $in: ['pending', 'in_progress', 'completed'] }
    }).toArray();

    let approvedCount = 0;
    const now = new Date();

    if (routesToApprove.length > 0) {
      const routeIds = routesToApprove.map(r => r._id);
      await db.collection('routes').updateMany(
        { _id: { $in: routeIds } },
        {
          $set: { status: 'approved' },
          $push: {
            history: {
              action: 'approved',
              timestamp: now,
              note: 'Saat 18:00 geçildiği için sistem tarafından otomatik onaylandı',
              personnelName: 'Sistem'
            }
          } as any
        }
      );

      await db.collection('system_logs').insertOne({
        action: 'Otomatik Rota Onayı',
        details: `${todayStr} tarihine ait ${routesToApprove.length} rota saat 18:00 otomatik onaylandı.`,
        personnelName: 'Sistem',
        personnelEmail: 'system@localhost',
        timestamp: now,
        category: 'route'
      });
      approvedCount = routesToApprove.length;
      console.log(`[AUTO_APPROVE] ${todayStr}: ${routesToApprove.length} rota otomatik onaylandı.`);
    }

    // 2. Bir sonraki gün rotalarını oluştur (Kural: Tüm günlük rotaların onaylanması sonrasında)
    const allRoutesToday = await db.collection('routes').find({ date: todayStr }).toArray();
    
    // Eğer o güne ait rota yoksa ya da hepsi approved ise sonraki günü oluştur
    const allApproved = allRoutesToday.length === 0 || allRoutesToday.every(r => r.status === 'approved');

    if (allApproved) {
      const nextDayStr = await getNextWorkingDayStr(db, todayStr);
      
      // Geçmiş bir güne ait rota oluşturulamaz kuralı
      if (nextDayStr >= todayStr) {
        const existingNextDayRoutes = await db.collection('routes').find({ date: nextDayStr }).toArray();
        
        if (existingNextDayRoutes.length === 0) {
          console.log(`[AUTO_GENERATE] ${nextDayStr} tarihi için rotalar oluşturuluyor...`);
          
          const households = await db.collection('households').find({}).toArray();
          const isLastWorkingDay = await isLastWorkingDayOfWeek(db, nextDayStr);

          // Şoför rotaları
          const drivers = await db.collection('drivers').find({ isActive: true }).toArray();
          const templates = await db.collection('route_templates').find({}).toArray();
          const templateStops = await db.collection('route_template_stops').find({}).toArray();

          for (const driver of drivers) {
            const template = templates.find(t => String(t.driverId) === String(driver._id) || String(t.driverId) === String(driver.id));
            if (!template) continue;

            const tStops = templateStops.filter(ts => String(ts.templateId) === String(template._id) || String(ts.templateId) === String(template.id));
            if (tStops.length === 0) continue;

            tStops.sort((a, b) => a.order - b.order);

            const routeResult = await db.collection('routes').insertOne({
              driverId: driver._id instanceof ObjectId ? driver._id.toString() : String(driver._id || driver.id),
              driverSnapshotName: driver.name,
              date: nextDayStr,
              status: 'pending',
              createdAt: now,
              history: [{ action: 'created', timestamp: now, note: 'Sistem tarafından otomatik oluşturuldu' }]
            });

            const routeIdStr = routeResult.insertedId.toString();
            const stopsToInsert: any[] = [];
            let orderIdx = 1;

            for (const tStop of tStops) {
              const h = households.find(hh => String(hh._id) === String(tStop.householdId) || String(hh.id) === String(tStop.householdId));
              if (!h) continue;

              const isDeleted = h.pausedUntil === '9999-12-31';
              const isPaused = h.pausedUntil && h.pausedUntil >= nextDayStr;
              const isInactive = !h.isActive && !h.pausedUntil;
              const isActuallyPassive = isDeleted || isPaused || isInactive;
              
              if (h.effectiveDate && h.effectiveDate > nextDayStr) continue;

              const hId = h._id instanceof ObjectId ? h._id.toString() : String(h._id || h.id);
              const headName = h.headName || 'Bilinmeyen';
              const memberCount = isActuallyPassive ? 0 : (h.memberCount || 0);
              const breadCount = isActuallyPassive ? 0 : (h.breadCount ?? h.memberCount ?? 0);

              // Standard
              stopsToInsert.push({
                routeId: routeIdStr,
                householdId: hId,
                householdSnapshotName: isActuallyPassive ? `${headName} (PASİF)` : headName,
                householdSnapshotMemberCount: memberCount,
                householdSnapshotBreadCount: breadCount,
                order: orderIdx++,
                status: isActuallyPassive ? 'failed' : 'pending',
                issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
                mealType: 'standard'
              });

              // Breakfast
              if (isLastWorkingDay && !h.noBreakfast) {
                stopsToInsert.push({
                  routeId: routeIdStr,
                  householdId: hId,
                  householdSnapshotName: isActuallyPassive ? `${headName} (Kahvaltı-PASİF)` : `${headName} (Kahvaltı)`,
                  householdSnapshotMemberCount: memberCount,
                  householdSnapshotBreadCount: 0,
                  order: orderIdx++,
                  status: isActuallyPassive ? 'failed' : 'pending',
                  issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
                  mealType: 'breakfast'
                });
              }
            }

            if (stopsToInsert.length > 0) {
              await db.collection('route_stops').insertMany(stopsToInsert);
            } else {
              await db.collection('routes').deleteOne({ _id: routeResult.insertedId });
            }
          }

          // Vakıf rotası
          const pickupHouseholds = households.filter(h => h.isSelfService);
          if (pickupHouseholds.length > 0) {
            const vakifRouteResult = await db.collection('routes').insertOne({
              driverId: 'vakif_pickup',
              driverSnapshotName: 'Vakıf\'tan Yemek Alanlar',
              date: nextDayStr,
              status: 'pending',
              createdAt: now,
              history: [{ action: 'created', timestamp: now, note: 'Sistem tarafından otomatik oluşturuldu' }]
            });

            const vakifRouteIdStr = vakifRouteResult.insertedId.toString();
            const vakifStopsToInsert: any[] = [];
            let vakifOrderIdx = 1;

            for (const h of pickupHouseholds) {
              const isDeleted = h.pausedUntil === '9999-12-31';
              const isPaused = h.pausedUntil && h.pausedUntil >= nextDayStr;
              const isInactive = !h.isActive && !h.pausedUntil;
              const isActuallyPassive = isDeleted || isPaused || isInactive;
              
              if (h.effectiveDate && h.effectiveDate > nextDayStr) continue;

              const hId = h._id instanceof ObjectId ? h._id.toString() : String(h._id || h.id);
              const headName = h.headName || 'Bilinmeyen';
              const memberCount = isActuallyPassive ? 0 : (h.memberCount || 0);
              const breadCount = isActuallyPassive ? 0 : (h.breadCount ?? h.memberCount ?? 0);

              vakifStopsToInsert.push({
                routeId: vakifRouteIdStr,
                householdId: hId,
                householdSnapshotName: isActuallyPassive ? `${headName} (PASİF)` : headName,
                householdSnapshotMemberCount: memberCount,
                householdSnapshotBreadCount: breadCount,
                order: vakifOrderIdx++,
                status: isActuallyPassive ? 'failed' : 'pending',
                issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
                mealType: 'standard'
              });

              if (isLastWorkingDay && !h.noBreakfast) {
                vakifStopsToInsert.push({
                  routeId: vakifRouteIdStr,
                  householdId: hId,
                  householdSnapshotName: isActuallyPassive ? `${headName} (Kahvaltı-PASİF)` : `${headName} (Kahvaltı)`,
                  householdSnapshotMemberCount: memberCount,
                  householdSnapshotBreadCount: 0,
                  order: vakifOrderIdx++,
                  status: isActuallyPassive ? 'failed' : 'pending',
                  issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
                  mealType: 'breakfast'
                });
              }
            }

            if (vakifStopsToInsert.length > 0) {
              await db.collection('route_stops').insertMany(vakifStopsToInsert);
            } else {
              await db.collection('routes').deleteOne({ _id: vakifRouteResult.insertedId });
            }
          }

          await db.collection('system_logs').insertOne({
            action: 'Otomatik Rota Oluşturma',
            details: `${nextDayStr} tarihi için şoför ve vakıf rotaları otomatik oluşturuldu.`,
            personnelName: 'Sistem',
            personnelEmail: 'system@localhost',
            timestamp: now,
            category: 'route'
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: todayStr,
      approved: approvedCount,
      message: 'İşlem tamamlandı.'
    });
  } catch (error: any) {
    console.error('[AUTO_APPROVE] Hata:', error);
    return NextResponse.json(
      { error: 'İşlem başarısız', details: error.message },
      { status: 500 }
    );
  }
}
