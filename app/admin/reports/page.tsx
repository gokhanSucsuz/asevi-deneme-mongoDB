'use client';

import { useState, useRef } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db } from '@/lib/db';
import { format, parseISO, eachDayOfInterval, isWithinInterval, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { tr } from 'date-fns/locale';
import { safeFormat } from '@/lib/date-utils';
import { Download, FileSpreadsheet, FileText as FilePdf, BarChart3, PieChart as PieChartIcon, TrendingUp, Users, ShoppingBasket, Truck, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/components/AuthProvider';
import { toPng } from 'html-to-image';
import { addSystemLog } from '@/lib/logger';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';

const COLORS = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function ReportsPage() {
  const { user, personnel } = useAuth();
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom' | 'failed'>('daily');
  const [startDate, setStartDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
  const [selectedMonth, setSelectedMonth] = useState(safeFormat(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState(safeFormat(new Date(), 'yyyy'));
  const reportRef = useRef<HTMLDivElement>(null);
  const isDemo = typeof window !== 'undefined' && localStorage.getItem('isDemoUser') === 'true';

  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const routeStops = useAppQuery(() => db.routeStops.toArray(), [], 'route_stops');
  const households = useAppQuery(() => db.households.toArray(), [], 'households');
  const leftoverFoods = useAppQuery(() => db.leftover_food.toArray(), [], 'leftover_food');
  const breadTrackings = useAppQuery(() => db.breadTracking.toArray(), [], 'bread_tracking');
  const personnelList = useAppQuery(() => db.personnel.toArray(), [], 'personnel');
  
  const currentPersonnel = personnelList?.find(p => p.email === user?.email);
  const personnelName = currentPersonnel?.name || user?.displayName || user?.email || 'Bilinmeyen Personel';

  // Calculate date range based on report type
  let effectiveStartDate = startDate;
  let effectiveEndDate = endDate;

  if (reportType === 'daily') {
    effectiveStartDate = safeFormat(new Date(), 'yyyy-MM-dd');
    effectiveEndDate = safeFormat(new Date(), 'yyyy-MM-dd');
  } else if (reportType === 'weekly') {
    const now = new Date();
    effectiveStartDate = safeFormat(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    effectiveEndDate = safeFormat(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  } else if (reportType === 'monthly') {
    const [year, month] = selectedMonth.split('-');
    const date = new Date(Number(year), Number(month) - 1, 1);
    effectiveStartDate = safeFormat(startOfMonth(date), 'yyyy-MM-dd');
    effectiveEndDate = safeFormat(endOfMonth(date), 'yyyy-MM-dd');
  } else if (reportType === 'yearly') {
    const date = new Date(Number(selectedYear), 0, 1);
    effectiveStartDate = safeFormat(date, 'yyyy-01-01');
    effectiveEndDate = safeFormat(new Date(Number(selectedYear), 11, 31), 'yyyy-12-31');
  } else if (reportType === 'failed') {
    // For failed deliveries, use the custom date range or default to today
    effectiveStartDate = startDate;
    effectiveEndDate = endDate;
  }

  const activeHouseholds = households?.filter(h => h.isActive) || [];
  const householdsOnlyList = activeHouseholds.filter(h => !h.type || h.type === 'household');
  const institutionsOnlyList = activeHouseholds.filter(h => h.type === 'institution');
  
  // Current Snapshot Stats
  const totalPeople = activeHouseholds.reduce((sum, h) => sum + (h.memberCount || 0), 0);
  const totalBread = activeHouseholds.reduce((sum, h) => sum + (h.breadCount || 0), 0);
  
  const institutionBreadTotal = institutionsOnlyList.reduce((sum, h) => sum + (h.breadCount || 0), 0);
  const householdBreadTotal = totalBread - institutionBreadTotal;

  const selfServicePeople = activeHouseholds.filter(h => h.isSelfService).reduce((sum, h) => sum + (h.memberCount || 0), 0);
  const routePeople = totalPeople - selfServicePeople;

  const ownContainerPeople = activeHouseholds.filter(h => h.usesOwnContainer).reduce((sum, h) => sum + (h.memberCount || 0), 0);
  const vakifContainerPeople = totalPeople - ownContainerPeople;

  // Timeframe Stats
  const filteredRoutes = routes?.filter(r => r.date >= effectiveStartDate && r.date <= effectiveEndDate) || [];
  const filteredRouteIds = filteredRoutes.map(r => r.id);
  const filteredStops = routeStops?.filter(rs => filteredRouteIds.includes(rs.routeId)) || [];
  const filteredLeftovers = leftoverFoods?.filter(l => l.date >= effectiveStartDate && l.date <= effectiveEndDate) || [];
  const filteredBreads = breadTrackings?.filter(b => b.date >= effectiveStartDate && b.date <= effectiveEndDate) || [];

  const totalDeliveredMeals = filteredStops.filter(rs => rs.status === 'delivered').reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);
  const totalLeftoverFood = filteredLeftovers.reduce((sum, l) => sum + (l.quantity || 0), 0);
  
  // Artan ekmek sayısı = şoför günlük rotaları tamamlandığı andaki artan ekmek sayısı
  const totalBreadLeftover = filteredRoutes.reduce((sum, r) => sum + (r.remainingBread || 0), 0);
  
  // Dağıtılan ekmek sayısı = Rotalardaki onaylanmış teslimatların toplamı
  const approvedRouteIds = filteredRoutes.filter(r => r.status === 'approved').map(r => r.id);
  const totalBreadDelivered = filteredStops
    .filter(rs => approvedRouteIds.includes(rs.routeId) && rs.status === 'delivered')
    .reduce((sum, rs) => sum + (rs.householdSnapshotBreadCount || 0), 0);

  const failedStops = filteredStops.filter(rs => rs.status === 'failed');
  const failedHouseholdsCount = failedStops.length;
  const failedPeopleCount = failedStops.reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);

  // Dağıtılan yemeklerin yöntemine göre ayrımı (Kişi sayısı bazlı)
  const deliveredStops = filteredStops.filter(rs => rs.status === 'delivered');
  const routeDeliveredMeals = deliveredStops
    .filter(rs => {
      const route = filteredRoutes.find(r => r.id === rs.routeId);
      return route && route.driverId !== 'vakif_pickup';
    })
    .reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);
    
  const selfServiceDeliveredMeals = deliveredStops
    .filter(rs => {
      const route = filteredRoutes.find(r => r.id === rs.routeId);
      return route && route.driverId === 'vakif_pickup';
    })
    .reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);

  const deliveryMethodData = [
    { name: 'Adrese Teslim', value: routeDeliveredMeals },
    { name: 'Vakıftan Teslim', value: selfServiceDeliveredMeals },
  ].filter(d => d.value > 0);

  // Container Data (Frozen if possible)
  let totalVakifContainers = 0;
  let totalOwnContainers = 0;

  if (filteredBreads.length > 0) {
    totalVakifContainers = filteredBreads.reduce((sum, b) => sum + (b.containerCount || 0), 0);
    totalOwnContainers = filteredBreads.reduce((sum, b) => sum + (b.ownContainerCount || 0), 0);
  } else {
    // Fallback to current calculation if no bread tracking records exist for the range
    totalOwnContainers = activeHouseholds.reduce((sum, h) => {
      if (h.usesOwnContainer) {
        return sum + (h.memberCount || 0);
      }
      return sum;
    }, 0);

    totalVakifContainers = totalPeople - totalOwnContainers;
  }

  const containerData = [
    { name: 'Vakıf Kabı', value: totalVakifContainers },
    { name: 'Kendi Kabı', value: totalOwnContainers },
  ].filter(d => d.value > 0);

  const deliveryStatusData = [
    { name: 'Teslim Edildi', value: totalDeliveredMeals },
    { name: 'Teslim Edilemedi', value: failedPeopleCount },
  ].filter(d => d.value > 0);

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, value }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="#1f2937" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-[10px] font-bold">
        {`${value} (${(percent * 100).toFixed(0)}%)`}
      </text>
    );
  };

  // Trend Data
  const trendData = [];
  if (effectiveStartDate && effectiveEndDate) {
    if (reportType === 'yearly') {
      // Group by month
      for (let i = 0; i < 12; i++) {
        const monthDate = new Date(Number(selectedYear), i, 1);
        const monthStart = safeFormat(startOfMonth(monthDate), 'yyyy-MM-dd');
        const monthEnd = safeFormat(endOfMonth(monthDate), 'yyyy-MM-dd');
        
        const monthRoutes = filteredRoutes.filter(r => r.date >= monthStart && r.date <= monthEnd);
        const monthRouteIds = monthRoutes.map(r => r.id);
        const monthApprovedRouteIds = monthRoutes.filter(r => r.status === 'approved').map(r => r.id);
        const monthStops = filteredStops.filter(rs => monthRouteIds.includes(rs.routeId) && rs.status === 'delivered');
        const monthMeals = monthStops.reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);
        
        const monthLeftovers = filteredLeftovers.filter(l => l.date >= monthStart && l.date <= monthEnd);
        const monthLeftoverTotal = monthLeftovers.reduce((sum, l) => sum + (l.quantity || 0), 0);
        
        const monthBreadDelivered = filteredStops
          .filter(rs => monthApprovedRouteIds.includes(rs.routeId) && rs.status === 'delivered')
          .reduce((sum, rs) => sum + (rs.householdSnapshotBreadCount || 0), 0);

        trendData.push({
          date: safeFormat(monthDate, 'MMM'),
          'Teslim Edilen Yemek': monthMeals,
          'Artan Yemek': monthLeftoverTotal,
          'Dağıtılan Ekmek': monthBreadDelivered
        });
      }
    } else {
      // Daily trend
      const days = eachDayOfInterval({ start: parseISO(effectiveStartDate), end: parseISO(effectiveEndDate) });
      days.forEach(day => {
        const dateStr = safeFormat(day, 'yyyy-MM-dd');
        const dayRoutes = filteredRoutes.filter(r => r.date === dateStr);
        const dayRouteIds = dayRoutes.map(r => r.id);
        const dayApprovedRouteIds = dayRoutes.filter(r => r.status === 'approved').map(r => r.id);
        const dayStops = filteredStops.filter(rs => dayRouteIds.includes(rs.routeId) && rs.status === 'delivered');
        const dayMeals = dayStops.reduce((sum, rs) => sum + (rs.householdSnapshotMemberCount || 0), 0);
        const dayLeftover = filteredLeftovers.find(l => l.date === dateStr)?.quantity || 0;
        
        const dayBreadDelivered = filteredStops
          .filter(rs => dayApprovedRouteIds.includes(rs.routeId) && rs.status === 'delivered')
          .reduce((sum, rs) => sum + (rs.householdSnapshotBreadCount || 0), 0);

        trendData.push({
          date: safeFormat(day, 'dd MMM'),
          'Teslim Edilen Yemek': dayMeals,
          'Artan Yemek': dayLeftover,
          'Dağıtılan Ekmek': dayBreadDelivered
        });
      });
    }
  }

  const exportToExcel = () => {
    try {
      const data = filteredRoutes.map(route => {
        const routeStopsForRoute = filteredStops.filter(rs => rs.routeId === route.id);
        const delivered = routeStopsForRoute.filter(rs => rs.status === 'delivered').length;
        return {
          'Tarih': safeFormat(route.date, 'dd.MM.yyyy'),
          'Şoför': route.driverSnapshotName,
          'Durum': route.status === 'completed' ? 'Tamamlandı' : route.status === 'in_progress' ? 'Devam Ediyor' : 'Bekliyor',
          'Teslimat': `${delivered} / ${routeStopsForRoute.length}`
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      
      XLSX.utils.sheet_add_aoa(ws, [
        ['T.C. EDİRNE SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI'],
        ['AŞEVİ İSTATİSTİK VE OPERASYON RAPORU'],
        ['Tarih Aralığı:', `${effectiveStartDate} - ${effectiveEndDate}`],
        ['Toplam Verilen Yemek:', totalDeliveredMeals],
        ['Toplam Artan Yemek:', totalLeftoverFood],
        ['Toplam Dağıtılan Ekmek:', totalBreadDelivered],
        [],
        ['Raporlayan:', personnelName],
        ['Rapor Oluşturma Tarihi:', new Date().toLocaleString('tr-TR')],
        []
      ], { origin: 'A1' });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Rapor');
      XLSX.writeFile(wb, `Asevi_Istatistik_Raporu_${effectiveStartDate}_${effectiveEndDate}.xlsx`);
      toast.success('Excel raporu indirildi');
    } catch (error) {
      console.error(error);
      toast.error('Excel oluşturulurken hata oluştu');
    }
  };

  const exportToPDF = async () => {
    const loadingToast = toast.loading('PDF hazırlanıyor, lütfen bekleyin...');
    try {
      const doc = await getTurkishPdf('portrait');
      await addVakifLogo(doc, 14, 10, 20);

      doc.setFontSize(12);
      doc.setFont('Roboto', 'bold');
      doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
      
      doc.setFontSize(14);
      doc.text('AŞEVİ İSTATİSTİK VE OPERASYON RAPORU', doc.internal.pageSize.width / 2, 35, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });
      
      const startStr = safeFormat(effectiveStartDate, 'dd.MM.yyyy');
      const endStr = safeFormat(effectiveEndDate, 'dd.MM.yyyy');
      doc.text(`Rapor Tarih Aralığı: ${startStr} - ${endStr}`, 14, 45);

      // Add Summary Stats
      doc.setFont('Roboto', 'bold');
      doc.text('ÖZET İSTATİSTİKLER', 14, 55);
      doc.setFont('Roboto', 'normal');
      
      const summaryData = [
        ['Günlük Hedeflenen Yemek', `${totalPeople} Kişi`],
        ['Günlük Hedeflenen Ekmek', `${totalBread} Adet`],
        ['   - Kurum Ekmeği', `${institutionBreadTotal} Adet`],
        ['   - Hane Ekmeği', `${householdBreadTotal} Adet`],
        ['Vakıf Kabı Kullanan', `${vakifContainerPeople} Kişi`],
        ['Kendi Kabını Kullanan', `${ownContainerPeople} Kişi`],
        ['Rota ile Dağıtım', `${routePeople} Kişi`],
        ['Vakıftan Teslim Alan', `${selfServicePeople} Kişi`],
        ['Dönem İçi Teslim Edilen Yemek', `${totalDeliveredMeals} Porsiyon`],
        ['Dönem İçi Teslim Edilemeyen', `${failedPeopleCount} Porsiyon (${failedHouseholdsCount} Hane)`],
        ['Dönem İçi Artan Yemek', `${totalLeftoverFood} Porsiyon`],
        ['Dönem İçi Dağıtılan Ekmek', `${totalBreadDelivered} Adet`],
        ['Dönem İçi Artan Ekmek', `${totalBreadLeftover} Adet`]
      ];

      autoTable(doc, {
        body: summaryData,
        startY: 60,
        theme: 'grid',
        styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', fillColor: [245, 245, 245] } }
      });

      // Add Institution Breakdown
      if (institutionsOnlyList.length > 0) {
        let finalY = (doc as any).lastAutoTable.finalY + 10;
        doc.setFont('Roboto', 'bold');
        doc.text('KURUM EKMEK DAĞILIMI', 14, finalY);
        
        const instTableData = institutionsOnlyList.map(inst => [
          inst.headName,
          `${inst.memberCount} Kişi`,
          `${inst.breadCount} Adet`
        ]);
        
        autoTable(doc, {
          head: [['Kurum Adı', 'Kişi Sayısı', 'Ekmek Sayısı']],
          body: instTableData,
          startY: finalY + 5,
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { fillColor: [79, 70, 229] }
        });
      }

      // Capture Charts if reportRef is available
      if (reportRef.current) {
        try {
          const chartsEl = reportRef.current.querySelector('.charts-container') as HTMLElement;
          if (chartsEl) {
            // Force standard colors for capture to avoid issues with html-to-image
            const originalStyle = chartsEl.getAttribute('style') || '';
            chartsEl.setAttribute('style', originalStyle + '; --color-primary: #4f46e5; --color-success: #10b981; --color-warning: #f59e0b; --color-danger: #ef4444;');
            
            const imgData = await toPng(chartsEl, { 
              quality: 0.95,
              backgroundColor: '#ffffff',
              pixelRatio: 2,
              filter: (node) => {
                // Don't capture responsive containers that aren't rendered properly
                if (node.tagName === 'svg' && (node as any).width?.baseVal?.value === 0) return false;
                return true;
              }
            });
            
            // Restore original style
            chartsEl.setAttribute('style', originalStyle);
            
            let finalY = (doc as any).lastAutoTable.finalY + 10;
            
            // Check if we need a new page
            if (finalY + 100 > doc.internal.pageSize.height) {
              doc.addPage();
              finalY = 20;
            }
            
            doc.setFont('Roboto', 'bold');
            doc.text('GRAFİKSEL ANALİZ', 14, finalY);
            
            // Calculate height keeping aspect ratio (assume image is wide)
            const imgWidth = doc.internal.pageSize.width - 28;
            // Get original dimensions from a temporary image
            const img = new Image();
            img.src = imgData;
            await new Promise((resolve) => { img.onload = resolve; });
            
            const imgHeight = (img.height * imgWidth) / img.width;
            
            doc.addImage(imgData, 'PNG', 14, finalY + 5, imgWidth, imgHeight);
          }
        } catch (chartError) {
          console.error('Error capturing charts for PDF:', chartError);
          // Continue without charts if they fail
          doc.addPage();
          doc.setFont('Roboto', 'bold');
          doc.text('GRAFİKSEL ANALİZ (Grafikler yüklenemedi)', 14, 20);
        }
      }

      addReportFooter(doc, personnelName);
      await addSystemLog(user, personnel, 'Rapor İndirme', `${effectiveStartDate} - ${effectiveEndDate} tarihleri arasını kapsayan Detaylı İstatistik Raporu (PDF) indirildi.`, 'report');
      doc.save(`Asevi_Istatistik_Raporu_${effectiveStartDate}_${effectiveEndDate}.pdf`);
      toast.success('PDF raporu başarıyla oluşturuldu', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('PDF oluşturulurken hata oluştu', { id: loadingToast });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6 relative" ref={reportRef}>
      {isDemo && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden opacity-10">
          <div className="text-[150px] font-black text-gray-900 -rotate-45 whitespace-nowrap">
            DEMO VERİSİ
          </div>
        </div>
      )}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">İstatistikler ve Raporlar</h1>
          <p className="text-sm text-gray-500 mt-1">Aşevi operasyonlarına ait kapsamlı veriler ve analizler.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={exportToExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center text-sm shadow-sm"
          >
            <FileSpreadsheet size={18} className="mr-2" />
            Excel İndir
          </button>
          <button
            onClick={exportToPDF}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 flex items-center text-sm shadow-sm"
          >
            <FilePdf size={18} className="mr-2" />
            PDF İndir
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="w-full md:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Zaman Dilimi</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as any)}
              className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2.5"
            >
              <option value="daily">Günlük</option>
              <option value="weekly">Haftalık</option>
              <option value="monthly">Aylık</option>
              <option value="yearly">Yıllık</option>
              <option value="custom">Özel Tarih</option>
              <option value="failed">Teslim Edilemeyenler</option>
            </select>
          </div>
          
          {(reportType === 'monthly') && (
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ay Seçimi</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2.5"
              />
            </div>
          )}

          {reportType === 'yearly' && (
            <div className="w-full md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Yıl Seçimi</label>
              <input
                type="number"
                min="2020"
                max="2100"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2.5"
              />
            </div>
          )}

          {(reportType === 'custom' || reportType === 'failed') && (
            <>
              <div className="w-full md:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç</label>
                <input
                  type="date"
                  value={startDate}
                  min="2026-04-14"
                  onChange={(e) => setStartDate(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2.5"
                />
              </div>
              <div className="w-full md:w-48">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş</label>
                <input
                  type="date"
                  value={endDate}
                  min="2026-04-14"
                  onChange={(e) => setEndDate(e.target.value)}
                  className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2.5"
                />
              </div>
            </>
          )}
        </div>
      </div>

      {reportType === 'failed' ? (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <XCircle size={20} className="text-red-500" />
              Teslim Edilemeyen Kayıtlar Listesi
            </h3>
            <span className="text-sm text-gray-500">{failedStops.length} Kayıt Bulundu</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hane</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Şoför</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kişi/Ekmek</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Neden</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {failedStops.length > 0 ? (
                  failedStops.map((stop) => {
                    const route = filteredRoutes.find(r => r.id === stop.routeId);
                    return (
                      <tr key={stop.id}>
                        <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-900">
                          {route ? safeFormat(route.date, 'dd.MM.yyyy') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-900">
                          {stop.householdSnapshotName}
                        </td>
                        <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                          {route?.driverSnapshotName || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                          {stop.householdSnapshotMemberCount} / {stop.householdSnapshotBreadCount}
                        </td>
                        <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-red-600 font-medium">
                          {stop.issueReport || 'Belirtilmedi'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      Bu tarih aralığında teslim edilemeyen kayıt bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-indigo-50 text-indigo-600">
                <Users size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Toplam Kişi (Hedef)</p>
                <p className="text-2xl font-bold text-gray-900">{totalPeople}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-emerald-50 text-emerald-600">
                <ShoppingBasket size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Teslim Edilen Yemek</p>
                <p className="text-2xl font-bold text-gray-900">{totalDeliveredMeals}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-red-50 text-red-600">
                <XCircle size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Teslim Edilemeyen Hane Sayısı</p>
                <p className="text-2xl font-bold text-gray-900">{failedHouseholdsCount}</p>
                <p className="text-xs text-red-500 mt-1 font-medium">
                  {failedPeopleCount} Kişi Teslim Edilemedi
                </p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-amber-50 text-amber-600">
                <TrendingUp size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Artan Yemek</p>
                <p className="text-2xl font-bold text-gray-900">{totalLeftoverFood}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-rose-50 text-rose-600">
                <Truck size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Dağıtılan Ekmek</p>
                <p className="text-2xl font-bold text-gray-900">{totalBreadDelivered}</p>
                <div className="mt-1 text-xs text-gray-500 space-y-0.5">
                  <p>Hane: {activeHouseholds.filter(h => !h.type || h.type === 'household').reduce((sum, h) => sum + (h.breadCount || 0), 0)}</p>
                  <p>Kurum: {institutionsOnlyList.reduce((sum, h) => sum + (h.breadCount || 0), 0)}</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
              <div className="p-3 rounded-full bg-orange-50 text-orange-600">
                <BarChart3 size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Artan Ekmek</p>
                <p className="text-2xl font-bold text-gray-900">{totalBreadLeftover}</p>
              </div>
            </div>
          </div>

          <div className="charts-container grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <PieChartIcon size={20} className="text-indigo-500" />
                Yemek Teslimat Yöntemi
              </h3>
              <div className="h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={deliveryMethodData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={renderCustomizedLabel}
                      labelLine={false}
                    >
                      {deliveryMethodData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Kişi`, 'Sayı']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <PieChartIcon size={20} className="text-emerald-500" />
                Kap Kullanımı
              </h3>
              <div className="h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={containerData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={renderCustomizedLabel}
                      labelLine={false}
                    >
                      {containerData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Kişi`, 'Sayı']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <PieChartIcon size={20} className="text-red-500" />
                Teslimat Durumu
              </h3>
              <div className="h-64 min-h-[256px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      isAnimationActive={false}
                      data={deliveryStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={renderCustomizedLabel}
                      labelLine={false}
                    >
                      {deliveryStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[(index + 4) % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value} Porsiyon`, 'Sayı']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingBasket size={20} className="text-rose-500" />
              Kurum Ekmek Detayları
            </h3>
            <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
              {institutionsOnlyList.map(inst => (
                <div key={inst.id} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg border border-gray-100">
                  <span className="text-sm font-medium text-gray-700">{inst.headName}</span>
                  <span className="text-sm font-bold text-gray-900">{inst.breadCount} Ekmek</span>
                </div>
              ))}
              {institutionsOnlyList.length === 0 && (
                <p className="text-sm text-gray-500 italic">Kayıtlı kurum bulunmamaktadır.</p>
              )}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-3">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <BarChart3 size={20} className="text-blue-500" />
                Günlük Dağıtım ve Artan Yemek Trendi
              </h3>
              <div className="h-80 min-h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} tickMargin={10} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Line isAnimationActive={false} type="monotone" dataKey="Teslim Edilen Yemek" stroke="#4f46e5" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    <Line isAnimationActive={false} type="monotone" dataKey="Dağıtılan Ekmek" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} />
                    <Line isAnimationActive={false} type="monotone" dataKey="Artan Yemek" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
