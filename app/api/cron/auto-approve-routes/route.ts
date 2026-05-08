import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { formatInTimeZone } from 'date-fns-tz';

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Vercel Cron Job: Her iş günü saat 18:00 TRT (15:00 UTC) çalışır.
 * O güne ait onaylanmamış (pending, in_progress, completed) tüm rotaları otomatik olarak 'approved' yapar.
 */
export async function GET(req: NextRequest) {
  // Güvenlik: Vercel cron veya yetkili istek kontrolü
  const authHeader = req.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getDb();

    // Bugünün tarihini TRT (Europe/Istanbul) saat dilimine göre hesapla
    const todayStr = formatInTimeZone(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd');

    // O güne ait onaylanmamış tüm rotaları bul
    const routesToApprove = await db
      .collection('routes')
      .find({
        date: todayStr,
        status: { $in: ['pending', 'in_progress', 'completed'] }
      })
      .toArray();

    if (routesToApprove.length === 0) {
      return NextResponse.json({
        success: true,
        message: `${todayStr} tarihi için onaylanacak rota bulunamadı.`,
        approved: 0
      });
    }

    const routeIds = routesToApprove.map(r => r._id);
    const now = new Date();

    // Tüm rotaları approved yap ve history'ye sistem logu ekle
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

    // Sistem log kaydı
    await db.collection('system_logs').insertOne({
      action: 'Otomatik Rota Onayı',
      details: `${todayStr} tarihine ait ${routesToApprove.length} rota saat 18:00 otomatik onaylandı.`,
      personnelName: 'Sistem',
      personnelEmail: 'system@localhost',
      timestamp: now,
      category: 'route'
    });

    console.log(`[AUTO_APPROVE] ${todayStr}: ${routesToApprove.length} rota otomatik onaylandı.`);

    return NextResponse.json({
      success: true,
      date: todayStr,
      approved: routesToApprove.length,
      message: `${routesToApprove.length} rota başarıyla otomatik onaylandı.`
    });
  } catch (error: any) {
    console.error('[AUTO_APPROVE] Hata:', error);
    return NextResponse.json(
      { error: 'Otomatik onay işlemi başarısız', details: error.message },
      { status: 500 }
    );
  }
}
