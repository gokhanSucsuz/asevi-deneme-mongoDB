'use client';

import { useState, useRef, useMemo } from 'react';
import { useAppQuery } from '@/lib/hooks';
import { db, Driver, Route, RouteStop } from '@/lib/db';
import { Plus, Edit2, Trash2, X, FileText, Download, Calendar, Eye, EyeOff, BarChart as BarChartIcon } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format, subMonths, subWeeks, subDays, isWithinInterval, startOfDay, endOfDay, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { maskSensitive, isValidTcNo } from '@/lib/validation';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';
import { toPng } from 'html-to-image';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

export default function DriversPage() {
  const { user, role, personnel } = useAuth();
  const isDemo = role === 'demo';
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [driverToReport, setDriverToReport] = useState<Driver | null>(null);
  const [reportRange, setReportRange] = useState('m1'); // default 1 month
  const [customStartDate, setCustomStartDate] = useState(safeFormat(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({});
  const chartRef = useRef<HTMLDivElement>(null);
  
  const drivers = useAppQuery(() => db.drivers.toArray(), [], 'drivers');
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const routeStops = useAppQuery(() => db.routeStops.toArray(), [], 'route_stops');
  const personnelName = personnel?.name || 'Bilinmeyen Personel';

  const addLog = async (action: string, details?: string) => {
    await addSystemLog(user, personnel, action, details, 'driver');
  };

  const { register, handleSubmit, reset } = useForm<Driver>({
    defaultValues: {
      tcNo: '',
      name: '',
      phone: '',
      vehiclePlate: '',
      isActive: true,
    }
  });

  const openModal = (driver?: Driver) => {
    if (driver) {
      setEditingId(driver.id!);
      reset(driver);
    } else {
      setEditingId(null);
      reset({
        tcNo: '',
        name: '',
        phone: '',
        vehiclePlate: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
  };

  const toggleSensitive = (id: string) => {
    setShowSensitive(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const onSubmit = async (data: Driver) => {
    const loadingToast = toast.loading('Kaydediliyor...');
    try {
      if (data.tcNo && !isValidTcNo(data.tcNo)) {
        toast.error('Geçersiz TC Kimlik Numarası.', { id: loadingToast });
        return;
      }

      // Uniqueness check for tcNo
      const duplicate = drivers?.find(d => d.tcNo === data.tcNo && d.id !== editingId);
      if (duplicate) {
        toast.error('Bu TC Kimlik No ile kayıtlı başka bir şoför var.', { id: loadingToast });
        return;
      }

      if (editingId) {
        await db.drivers.put({ ...data, id: editingId });
        await addLog('Şoför Güncellendi', `${data.name} şoförünün bilgileri güncellendi.`);
        toast.success('Şoför başarıyla güncellendi', { id: loadingToast });
      } else {
        await db.drivers.add(data);
        await addLog('Şoför Eklendi', `${data.name} şoförü sisteme eklendi.`);
        toast.success('Şoför başarıyla eklendi', { id: loadingToast });
      }
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const deleteDriver = async (id: string) => {
    if (confirm('Bu şoförü silmek istediğinize emin misiniz? Geçmiş istatistiklerde şoför adı görünmeye devam edecektir.')) {
      try {
        const driver = await db.drivers.get(id);
        await db.drivers.delete(id);
        if (driver) {
          await addLog('Şoför Silindi', `${driver.name} şoförü sistemden silindi.`);
        }
        toast.success('Şoför başarıyla silindi');
      } catch (error) {
        console.error(error);
        toast.error('Silme işlemi sırasında bir hata oluştu');
      }
    }
  };

  const openReportModal = (driver: Driver) => {
    setDriverToReport(driver);
    setReportModalOpen(true);
  };

  const getDriverRoutes = (id: string | undefined, name?: string) => {
    if (!id) return [];
    return routes?.filter(r => (String(r.driverId) === String(id) || (name && r.driverSnapshotName === name)) && (r.status === 'completed' || r.status === 'approved')).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];
  };

  // Helper calculations for reports - moved to memo for UI access
  const driverReportStats = useMemo(() => {
    if (!reportModalOpen || !driverToReport) return null;

    let startDate = new Date();
    let endDate = new Date();
    switch (reportRange) {
      case 'd1': startDate = subDays(endDate, 1); break;
      case 'w1': startDate = subWeeks(endDate, 1); break;
      case 'm1': startDate = subMonths(endDate, 1); break;
      case 'm3': startDate = subMonths(endDate, 3); break;
      case 'm6': startDate = subMonths(endDate, 6); break;
      case 'custom':
        startDate = parseISO(customStartDate);
        endDate = parseISO(customEndDate);
        break;
      default: startDate = subMonths(endDate, 1);
    }

    const driverRoutes = routes?.filter((r: Route) => {
      const idMatch = String(r.driverId) === String(driverToReport.id!);
      const nameMatch = r.driverSnapshotName && r.driverSnapshotName === driverToReport.name;
      const isThisDriver = idMatch || nameMatch;
      
      return isThisDriver && 
             (r.status === 'completed' || r.status === 'approved') &&
             isWithinInterval(new Date(r.date), { start: startOfDay(startDate), end: endOfDay(endDate) });
    }).sort((a: Route, b: Route) => new Date(b.date).getTime() - new Date(a.date).getTime()) || [];

    const driverStops = (routeStops || []).filter((s: RouteStop) => driverRoutes.some((r: Route) => String(r.id) === String(s.routeId)));

    const totalKm = driverRoutes.reduce((acc: number, r: Route) => acc + ((r.endKm || 0) - (r.startKm || 0)), 0);
    
    let totalDeliveredPeople = 0;
    let totalHouseholdDeliveries = 0;
    let totalFailedStops = 0;
    
    driverRoutes.forEach(r => {
      const stopsForRoute = driverStops.filter(s => String(s.routeId) === String(r.id));
      totalFailedStops += stopsForRoute.filter(s => s.status === 'failed').length;
      
      const deliveredStops = stopsForRoute.filter(s => s.status === 'delivered');
      const uniqueHouseholdsInRoute = new Map();
      
      deliveredStops.forEach(s => {
        if (!uniqueHouseholdsInRoute.has(s.householdId)) {
          uniqueHouseholdsInRoute.set(s.householdId, s.householdSnapshotMemberCount || 0);
        }
      });
      
      totalHouseholdDeliveries += uniqueHouseholdsInRoute.size;
      uniqueHouseholdsInRoute.forEach(count => {
        totalDeliveredPeople += count;
      });
    });

    return {
      startDate,
      endDate,
      driverRoutes,
      driverStops,
      totalKm,
      totalDeliveredPeople,
      totalHouseholdDeliveries,
      totalFailedStops
    };
  }, [reportModalOpen, driverToReport, reportRange, customStartDate, customEndDate, routes, routeStops]);

  const exportDriverReportPDF = async () => {
    if (!driverToReport || !driverReportStats) return;
    const { startDate, endDate, driverRoutes, driverStops, totalKm, totalDeliveredPeople, totalHouseholdDeliveries, totalFailedStops } = driverReportStats;
    const loadingToast = toast.loading('Rapor hazırlanıyor...');
    
    try {
      const doc = await getTurkishPdf('portrait');

      await addVakifLogo(doc, 14, 10, 20);

      let periodLabel = '';
      switch (reportRange) {
        case 'd1': periodLabel = 'Son 1 Gün'; break;
        case 'w1': periodLabel = 'Son 1 Hafta'; break;
        case 'm1': periodLabel = 'Son 1 Ay'; break;
        case 'm3': periodLabel = 'Son 3 Ay'; break;
        case 'm6': periodLabel = 'Son 6 Ay'; break;
        case 'custom': periodLabel = 'Özel Aralık'; break;
        default: periodLabel = '';
      }

      doc.setFontSize(14);
      doc.setFont('Roboto', 'bold');
      doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
      doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
      
      doc.setFontSize(12);
      doc.text('ŞOFÖR PERFORMANS VE DAĞITIM RAPORU', doc.internal.pageSize.width / 2, 32, { align: 'center' });

      doc.setFont('Roboto', 'bold');
      doc.setFontSize(10);
      doc.text('Personel / Şoför:', 14, 45);
      doc.text('Araç Plakası:', 14, 51);
      doc.text('Rapor Dönemi:', 14, 57);
      
      doc.setFont('Roboto', 'normal');
      doc.text(driverToReport.name || '-', 42, 45);
      doc.text(driverToReport.vehiclePlate || '-', 42, 51);
      doc.text(`${safeFormat(startDate, 'dd.MM.yyyy')} - ${safeFormat(endDate, 'dd.MM.yyyy')} (${periodLabel})`, 42, 57);
      
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 45, { align: 'right' });

      // Summary Table
      autoTable(doc, {
        head: [['Toplam KM', 'Hane Teslimatı', 'Ulaşılan Kişi', 'Başarısız Gidilen', 'Toplam Rota']],
        body: [[totalKm, totalHouseholdDeliveries, totalDeliveredPeople, totalFailedStops, driverRoutes.length]],
        startY: 65,
        styles: { font: 'Roboto', fontSize: 10, halign: 'center' },
        headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [41, 128, 185] }
      });

      // Detailed Table
      const tableColumn = ["Tarih", "KM", "Teslim (Hane/Kişi)", "Başarısız", "Kalan Y/E"];
      const tableRows = driverRoutes.map((route: Route) => {
        const _routeStops = driverStops.filter((s: RouteStop) => String(s.routeId) === String(route.id));
        const _delivered = _routeStops.filter((s: RouteStop) => s.status === 'delivered');
        const _failed = _routeStops.filter((s: RouteStop) => s.status === 'failed').length;
        
        const _uniqueHouseholds = new Map();
        _delivered.forEach(s => {
          if (!_uniqueHouseholds.has(s.householdId)) {
            _uniqueHouseholds.set(s.householdId, s.householdSnapshotMemberCount || 0);
          }
        });
        
        let _deliveredPeople = 0;
        _uniqueHouseholds.forEach(count => _deliveredPeople += count);

        return [
          safeFormat(new Date(route.date), 'dd.MM.yyyy'),
          (route.endKm && route.startKm) ? (route.endKm - route.startKm) : '-',
          `${_uniqueHouseholds.size} / ${_deliveredPeople}`,
          _failed,
          `${route.remainingFood || 0} / ${route.remainingBread || 0}`
        ];
      });

      let currentY = (doc as any).lastAutoTable.finalY + 10;
      
      // Add Chart to PDF
      if (chartRef.current) {
        try {
          // Temporarily force light theme / standard colors for capture
          const originalStyle = chartRef.current.style.backgroundColor;
          chartRef.current.style.backgroundColor = 'white';
          
          const imgData = await toPng(chartRef.current, {
            quality: 0.95,
            backgroundColor: 'white',
            pixelRatio: 2,
          });
          
          chartRef.current.style.backgroundColor = originalStyle;
          
          if (currentY + 100 > 280) { // check if chart fits on page
            doc.addPage();
            currentY = 20;
          }
          
          doc.addImage(imgData, 'PNG', 15, currentY, 180, 80);
          currentY += 90;
        } catch (chartErr) {
          console.error("PDF chart adding failed", chartErr);
        }
      }

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: currentY,
        styles: { font: 'Roboto', fontSize: 9 },
        headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [52, 73, 94] }
      });

      // Failed Deliveries Explanations
      const failedStops = driverStops.filter((s: RouteStop) => s.status === 'failed' && s.issueReport);
      if (failedStops.length > 0) {
        doc.addPage();
        await addVakifLogo(doc, 14, 10, 20);
        doc.setFontSize(12);
        doc.text('Başarısız Teslimat Gerekçeleri', 40, 25);
        
        const failedTableColumn = ["Tarih", "Hane", "Gerekçe"];
        const failedTableRows = failedStops.map((stop: RouteStop) => {
          const route = driverRoutes.find((r: Route) => r.id === stop.routeId);
          return [
            route ? safeFormat(new Date(route.date), 'dd.MM.yyyy') : '-',
            stop.householdSnapshotName || '-',
            stop.issueReport || '-'
          ];
        });

        autoTable(doc, {
          head: [failedTableColumn],
          body: failedTableRows,
          startY: 35,
          styles: { font: 'Roboto', fontSize: 9 },
          headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [192, 57, 43] }
        });
      }

      addReportFooter(doc, personnelName);
      await addLog('Rapor İndirme', `${driverToReport.name} şoförüne ait performans ve faaliyet raporu (PDF) indirildi.`);
      doc.save(`Sofor_Performans_${driverToReport.name.replace(/\s+/g, '_')}.pdf`);
      toast.success('Rapor başarıyla oluşturuldu', { id: loadingToast });
      setReportModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Rapor oluşturulurken bir hata oluştu', { id: loadingToast });
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Şoförler ve Araçlar</h2>
        {!isDemo && (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
          >
            <Plus size={20} className="mr-2" />
            Yeni Şoför Ekle
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TC Kimlik No</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ad Soyad</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Telefon</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Araç Plakası</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drivers?.map((driver) => (
              <tr key={driver.id}>
                <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    {showSensitive[driver.id!] ? driver.tcNo : maskSensitive(driver.tcNo)}
                    {driver.tcNo && (
                      <button onClick={() => toggleSensitive(driver.id!)} className="text-gray-400 hover:text-blue-600">
                        {showSensitive[driver.id!] ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm font-medium text-gray-900">{driver.name}</td>
                <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                  {showSensitive[driver.id!] ? driver.phone : maskSensitive(driver.phone, 4)}
                </td>
                <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">{driver.vehiclePlate}</td>
                <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${driver.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {driver.isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-right text-sm font-medium">
                  <button onClick={() => openReportModal(driver)} className="text-gray-600 hover:text-gray-900 mr-4" title="Rapor">
                    <FileText size={18} />
                  </button>
                  {!isDemo && (
                    <>
                      <button onClick={() => openModal(driver)} className="text-blue-600 hover:text-blue-900 mr-4" title="Düzenle">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => deleteDriver(driver.id!)} className="text-red-600 hover:text-red-900" title="Sil">
                        <Trash2 size={18} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
            {drivers?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-4 text-center text-sm text-gray-500">
                  Henüz şoför eklenmemiş.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reportModalOpen && driverToReport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {driverToReport.name} - Detaylı Rapor
              </h3>
              <button onClick={() => setReportModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              <div className="mb-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Araç Plakası</p>
                  <p className="text-lg font-black text-gray-900">{driverToReport.vehiclePlate}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Toplam Rota</p>
                  <p className="text-lg font-black text-gray-900">{driverReportStats?.driverRoutes.length || 0}</p>
                </div>
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Rapor Dönemi</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <select
                      value={reportRange}
                      onChange={(e) => setReportRange(e.target.value)}
                      className="block w-full sm:w-auto rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm border p-2.5 bg-white"
                    >
                      <option value="d1">Son 1 Gün</option>
                      <option value="w1">Son 1 Hafta</option>
                      <option value="m1">Son 1 Ay</option>
                      <option value="m3">Son 3 Ay</option>
                      <option value="m6">Son 6 Ay</option>
                      <option value="custom">Özel Tarih Aralığı</option>
                    </select>
                    {reportRange === 'custom' && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm border p-2 bg-white"
                        />
                        <span className="text-gray-400 font-bold">-</span>
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(e) => setCustomEndDate(e.target.value)}
                          className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm border p-2 bg-white"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Performance Cards */}
              {driverReportStats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                  {[
                    { label: 'Toplam KM', val: driverReportStats.totalKm, color: 'text-gray-900', bg: 'bg-gray-50' },
                    { label: 'Hane Teslim', val: driverReportStats.totalHouseholdDeliveries, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Ulaşılan Kişi', val: driverReportStats.totalDeliveredPeople, color: 'text-green-600', bg: 'bg-green-50' },
                    { label: 'Başarısız', val: driverReportStats.totalFailedStops, color: 'text-red-500', bg: 'bg-red-50' },
                    { label: 'Tamamlanan', val: driverReportStats.driverRoutes.length, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                  ].map((stat, i) => (
                    <div key={i} className={`${stat.bg} p-4 rounded-2xl border border-gray-100 flex flex-col items-center justify-center text-center`}>
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">{stat.label}</p>
                      <p className={`text-2xl font-black ${stat.color}`}>{stat.val}</p>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="mb-6 p-6 bg-white border border-gray-200 rounded-[2rem] shadow-sm" ref={chartRef}>
                <h4 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BarChartIcon className="text-blue-600" size={20} />
                  Performans Grafiği (Günlük Dağılım)
                </h4>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                      data={getDriverRoutes(driverToReport.id!, driverToReport.name)
                            .filter(r => {
                               let sd = new Date(); let ed = new Date();
                               switch (reportRange) {
                                 case 'd1': sd = subDays(ed, 1); break;
                                 case 'w1': sd = subWeeks(ed, 1); break;
                                 case 'm1': sd = subMonths(ed, 1); break;
                                 case 'm3': sd = subMonths(ed, 3); break;
                                 case 'm6': sd = subMonths(ed, 6); break;
                                 case 'custom':
                                   sd = parseISO(customStartDate);
                                   ed = parseISO(customEndDate);
                                   break;
                                 default: sd = subMonths(ed, 1);
                               }
                               return isWithinInterval(new Date(r.date), { start: startOfDay(sd), end: endOfDay(ed) });
                            })
                            .slice(0, 30)
                            .reverse()
                            .map(route => {
                              const stops = (routeStops || []).filter((s: RouteStop) => String(s.routeId) === String(route.id));
                              const delivered = stops.filter((s: RouteStop) => s.status === 'delivered');
                              const failedCount = stops.filter((s: RouteStop) => s.status === 'failed').length;
                              
                              const uniqueHouseholds = new Map();
                              delivered.forEach((s: RouteStop) => {
                                if (!uniqueHouseholds.has(s.householdId)) {
                                  uniqueHouseholds.set(s.householdId, s.householdSnapshotMemberCount || 0);
                                }
                              });
                              let deliveredPeople = 0;
                              uniqueHouseholds.forEach(count => deliveredPeople += count);
                              
                              return {
                                name: safeFormat(new Date(route.date), 'dd.MM'),
                                'Ulaşılan Kişi': deliveredPeople,
                                'Hane Teslimatı': uniqueHouseholds.size,
                                'Başarısız': failedCount,
                                km: (route.endKm || 0) - (route.startKm || 0)
                              }
                            })}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={12} />
                      <YAxis yAxisId="left" fontSize={12} />
                      <RechartsTooltip />
                      <Legend />
                      <Bar yAxisId="left" dataKey="Ulaşılan Kişi" fill="#3b82f6" name="Kişi Sayısı" />
                      <Bar yAxisId="left" dataKey="Hane Teslimatı" fill="#10b981" name="Hane Sayısı" />
                      <Bar yAxisId="left" dataKey="Başarısız" fill="#ef4444" name="Başarısız Gidilen" />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <h4 className="font-bold text-gray-900 mb-4">Günlük Rota ve Teslimat Detayları</h4>
              <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Yapılan KM</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Teslim (Hane / Kişi)</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başarısız</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kalan (Y/E)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {getDriverRoutes(driverToReport.id!, driverToReport.name).map((route) => {
                      const stops = (routeStops || []).filter((s: RouteStop) => String(s.routeId) === String(route.id));
                      const delivered = stops.filter((s: RouteStop) => s.status === 'delivered');
                      const failedCount = stops.filter((s: RouteStop) => s.status === 'failed').length;
                      
                      const uniqueHouseholds = new Map();
                      delivered.forEach((s: RouteStop) => {
                         if (!uniqueHouseholds.has(s.householdId)) {
                           uniqueHouseholds.set(s.householdId, s.householdSnapshotMemberCount || 0);
                         }
                      });
                      let deliveredPeople = 0;
                      uniqueHouseholds.forEach(count => deliveredPeople += count);

                      return (
                        <tr key={route.id}>
                          <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm font-medium text-gray-900">
                            {safeFormat(new Date(route.date), 'dd.MM.yyyy')}
                          </td>
                          <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                            {(route.endKm && route.startKm) ? (route.endKm - route.startKm) : '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm font-medium text-blue-600">
                            {uniqueHouseholds.size} / {deliveredPeople}
                          </td>
                          <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-red-500 font-medium">
                            {failedCount}
                          </td>
                          <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                            {route.remainingFood || 0} / {route.remainingBread || 0}
                          </td>
                        </tr>
                      );
                    })}
                    {getDriverRoutes(driverToReport.id!, driverToReport.name).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                          Henüz tamamlanmış rota kaydı bulunmuyor.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setReportModalOpen(false)}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
              <button
                onClick={exportDriverReportPDF}
                className="bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 flex items-center text-sm font-medium"
              >
                <Download size={16} className="mr-2" />
                PDF İndir
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                {editingId ? 'Şoför Düzenle' : 'Yeni Şoför Ekle'}
              </h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">TC Kimlik No</label>
                <input
                  type="text"
                  {...register('tcNo', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                  placeholder="11 haneli TC No"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Ad Soyad</label>
                <input
                  type="text"
                  {...register('name', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Telefon</label>
                <input
                  type="text"
                  {...register('phone', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Araç Plakası</label>
                <input
                  type="text"
                  {...register('vehiclePlate', { required: true })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  {...register('isActive')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Aktif
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
