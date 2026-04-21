import { NextRequest, NextResponse } from 'next/server';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCachedReportData } from '@/lib/server-data';
import { safeFormat } from '@/lib/date-utils';

/**
 * API Route Handler for generating PDF reports using cached data.
 * Demonstrates on-demand revalidation and data caching.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || safeFormat(new Date(), 'yyyy-MM-dd');
    const endDate = searchParams.get('endDate') || safeFormat(new Date(), 'yyyy-MM-dd');

    // 1. Fetch data from CACHE (or Firestore if cache miss)
    // This uses unstable_cache internally with tags ['reports', 'routes', 'route_stops']
    const { routes, stops } = await getCachedReportData(startDate, endDate);

    // 2. Initialize PDF (Server-side compatible)
    const doc = new jsPDF('portrait');
    
    // Add Title
    doc.setFontSize(16);
    doc.text('AŞEVİ DAĞITIM OPERASYON RAPORU', 105, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Tarih Aralığı: ${startDate} - ${endDate}`, 105, 30, { align: 'center' });
    doc.text(`Rapor Oluşturma: ${new Date().toLocaleString('tr-TR')}`, 105, 35, { align: 'center' });

    // 3. Prepare Table Data
    const tableData = routes.map(route => {
      const routeStopsForRoute = stops.filter(rs => rs.routeId === route.id);
      const delivered = routeStopsForRoute.filter(rs => rs.status === 'delivered').length;
      return [
        safeFormat(new Date(route.date), 'dd.MM.yyyy'),
        route.driverSnapshotName || 'Bilinmeyen Şoför',
        route.status === 'approved' ? 'Onaylandı' : 
        route.status === 'completed' ? 'Tamamlandı' : 
        route.status === 'in_progress' ? 'Devam Ediyor' : 'Bekliyor',
        `${delivered} / ${routeStopsForRoute.length}`
      ];
    });

    // 4. Generate Table
    autoTable(doc, {
      head: [['Tarih', 'Şoför', 'Durum', 'Teslimat']],
      body: tableData,
      startY: 45,
      styles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      headStyles: { fillColor: [100, 100, 100] }
    });

    // 5. Return PDF as Stream/Buffer
    const pdfBuffer = doc.output('arraybuffer');
    
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Asevi_Rapor_${startDate}_${endDate}.pdf"`,
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=59' // Browser/CDN cache
      }
    });

  } catch (error) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: 'Rapor oluşturulurken bir hata oluştu' }, { status: 500 });
  }
}
