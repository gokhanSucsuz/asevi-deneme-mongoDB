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
  const workingDay = await db
    .collection('working_days')
    .findOne({ date: dateStr });

  if (workingDay) return workingDay.isWorkingDay === true;

  // Fallback: hafta sonu değilse çalışma günü say
  const parts = dateStr.split('-');
  const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  return !isWeekend(d);
}

/**
 * Vercel Cron Job: Her iş günü saat 09:00 TRT (06:00 UTC) çalışır.
 * Bugüne ait 'Vakıftan Yemek Alanlar' rotasını otomatik oluşturur.
 * Başka rotaların tamamlanması şartı yoktur.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    // Bugünün tarihini TRT'ye göre hesapla
    const todayStr = formatInTimeZone(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd');

    // İş günü kontrolü
    const isWorking = await checkIsWorkingDay(db, todayStr);
    if (!isWorking) {
      return NextResponse.json({
        success: true,
        message: `${todayStr} iş günü değil, rota oluşturulmadı.`,
        created: false
      });
    }

    // Bu güne ait vakıf rotası zaten var mı?
    const existing = await db.collection('routes').findOne({
      date: todayStr,
      driverId: 'vakif_pickup'
    });

    if (existing) {
      return NextResponse.json({
        success: true,
        message: `${todayStr} için vakıf rotası zaten mevcut.`,
        created: false
      });
    }

    // Aktif isSelfService haneleri getir (effectiveDate'i geçmiş veya bugün olanlar dahil)
    const allHouseholds = await db.collection('households').find({}).toArray();
    const pickupHouseholds = allHouseholds.filter((h: any) => {
      if (!h.isSelfService) return false;
      if (h.pausedUntil === '9999-12-31') return false; // silinmiş

      // effectiveDate kontrolü: varsa ve bugünden büyükse henüz aktif değil
      if (h.effectiveDate && h.effectiveDate > todayStr) return false;

      return true;
    });

    if (pickupHouseholds.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${todayStr} için vakıftan yemek alan aktif hane bulunamadı.`,
        created: false
      });
    }

    // Son iş günü kontrolü (kahvaltı için)
    const parts = todayStr.split('-');
    const todayDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const dayOfWeek = todayDate.getDay(); // 0=Pazar, 5=Cuma
    let isLastWorkingDay = false;

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      isLastWorkingDay = true;
      for (let i = 1; i <= 5 - dayOfWeek; i++) {
        const next = new Date(todayDate);
        next.setDate(next.getDate() + i);
        const nextStr = formatInTimeZone(next, 'Europe/Istanbul', 'yyyy-MM-dd');
        const nextIsWorking = await checkIsWorkingDay(db, nextStr);
        if (nextIsWorking) {
          isLastWorkingDay = false;
          break;
        }
      }
    }

    // Rotayı oluştur
    const now = new Date();
    const routeResult = await db.collection('routes').insertOne({
      driverId: 'vakif_pickup',
      driverSnapshotName: "Vakıf'tan Yemek Alanlar",
      date: todayStr,
      status: 'pending',
      createdAt: now,
      history: [{
        action: 'created',
        timestamp: now,
        note: 'Sistem tarafından 09:00 otomatik oluşturuldu'
      }]
    });

    const routeId = routeResult.insertedId.toString();
    const stops: any[] = [];
    let order = 1;

    for (const h of pickupHouseholds) {
      const isDeleted = h.pausedUntil === '9999-12-31';
      const isPaused = h.pausedUntil && h.pausedUntil >= todayStr;
      const isInactive = !h.isActive && !h.pausedUntil;
      const isActuallyPassive = isDeleted || isPaused || isInactive;

      const householdId = h._id instanceof ObjectId ? h._id.toString() : String(h._id);
      const headName = h.headName || 'Bilinmeyen';
      const memberCount = isActuallyPassive ? 0 : (h.memberCount || 0);
      const breadCount = isActuallyPassive ? 0 : (h.breadCount ?? h.memberCount ?? 0);

      stops.push({
        routeId,
        householdId,
        householdSnapshotName: isActuallyPassive ? `${headName} (PASİF)` : headName,
        householdSnapshotMemberCount: memberCount,
        householdSnapshotBreadCount: breadCount,
        order: order++,
        status: isActuallyPassive ? 'failed' : 'pending',
        issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
        mealType: 'standard'
      });

      if (isLastWorkingDay && !h.noBreakfast) {
        stops.push({
          routeId,
          householdId,
          householdSnapshotName: isActuallyPassive ? `${headName} (Kahvaltı-PASİF)` : `${headName} (Kahvaltı)`,
          householdSnapshotMemberCount: memberCount,
          householdSnapshotBreadCount: 0,
          order: order++,
          status: isActuallyPassive ? 'failed' : 'pending',
          issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
          mealType: 'breakfast'
        });
      }
    }

    if (stops.length > 0) {
      await db.collection('route_stops').insertMany(stops);
    }

    // Sistem log kaydı
    await db.collection('system_logs').insertOne({
      action: 'Vakıf Rotası Otomatik Oluşturuldu',
      details: `${todayStr} için Vakıf rotası otomatik oluşturuldu. ${pickupHouseholds.length} hane, ${stops.length} durak.`,
      personnelName: 'Sistem',
      personnelEmail: 'system@localhost',
      timestamp: now,
      category: 'route'
    });

    console.log(`[VAKIF_ROUTE] ${todayStr}: rota oluşturuldu. ${pickupHouseholds.length} hane, ${stops.length} durak.`);

    return NextResponse.json({
      success: true,
      date: todayStr,
      routeId,
      householdCount: pickupHouseholds.length,
      stopCount: stops.length,
      message: `${todayStr} için vakıf rotası başarıyla oluşturuldu.`
    });
  } catch (error: any) {
    console.error('[VAKIF_ROUTE] Hata:', error);
    return NextResponse.json(
      { error: 'Vakıf rotası oluşturulamadı', details: error.message },
      { status: 500 }
    );
  }
}
