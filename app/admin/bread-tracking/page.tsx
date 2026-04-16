'use client';

import { useState, useEffect } from 'react';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Tender, BreadTracking } from '@/lib/db';
import { format, isWithinInterval, startOfDay, endOfDay, addDays, isBefore, isAfter } from 'date-fns';
import { calculateBreadForNextDay } from '@/lib/breadUtils';
import { Plus, Save, X, AlertCircle, FileText, Download, TrendingDown, Calendar, Gavel, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/components/AuthProvider';

export default function BreadTrackingPage() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState('2026-04-14');
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isTenderModalOpen, setIsTenderModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualNote, setManualNote] = useState('');

  // Tender form state
  const [tenderForm, setTenderForm] = useState({
    name: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    tenderNo: '',
    endDate: format(addDays(new Date(), 365), 'yyyy-MM-dd'),
    maxBreadCount: 0
  });

  const breadTracking = useAppQuery(() => db.breadTracking.toArray(), [], 'bread_tracking');
  const households = useAppQuery(() => db.households.toArray(), [], 'households');
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const tenders = useAppQuery(() => db.tenders.toArray(), [], 'tenders');
  const [nextWorkingDayStr, setNextWorkingDayStr] = useState('');

  // Fix for 14.04.2026 and clear older records
  useEffect(() => {
    const fixDate = async () => {
      // 1. Clear records before 14.04.2026
      const allRecords = await db.breadTracking.toArray();
      const recordsToDelete = allRecords.filter(r => r.date < '2026-04-14');
      for (const record of recordsToDelete) {
        await db.breadTracking.delete(record.id!);
      }

      // 2. Fix 14.04.2026
      const targetDate = '2026-04-14';
      const existing = await db.breadTracking.where('date').equals(targetDate).first();
      if (existing && existing.totalNeeded !== 503) {
        await db.breadTracking.update(existing.id!, { totalNeeded: 503 });
      } else if (!existing) {
        await db.breadTracking.add({
          date: targetDate,
          totalNeeded: 503,
          delivered: 0,
          leftoverAmount: 0,
          finalOrderAmount: 503,
          status: 'ordered'
        });
      }
    };
    fixDate();
  }, []);

  useEffect(() => {
    const getNextDay = async () => {
      const { getNextWorkingDay } = await import('@/lib/route-utils');
      const nextDay = await getNextWorkingDay(new Date());
      setNextWorkingDayStr(format(nextDay, 'yyyy-MM-dd'));
    };
    getNextDay();
  }, []);

  useEffect(() => {
    const generateReport = async () => {
      setIsLoading(true);
      try {
        const start = startOfDay(new Date(startDate));
        const end = endOfDay(new Date(endDate));
        
        // Get all dates in range
        const dates = [];
        let curr = new Date(start);
        while (curr <= end) {
          dates.push(format(curr, 'yyyy-MM-dd'));
          curr.setDate(curr.getDate() + 1);
        }

        const data = await Promise.all(dates.map(async (dateStr) => {
          // Check if there's an existing record
          const existing = breadTracking?.find(b => b.date === dateStr);
          
          // Calculate dynamically to reflect household changes instantly
          const breadData = await calculateBreadForNextDay(dateStr);
          
          // Check if all routes for this date are approved
          const dayRoutes = routes?.filter(r => r.date === dateStr) || [];
          const allApproved = dayRoutes.length > 0 && dayRoutes.every(r => r.status === 'approved');
          
          return {
            id: existing?.id || dateStr,
            date: dateStr,
            totalNeeded: breadData.totalNeeded,
            leftoverAmount: breadData.leftoverAmount,
            finalOrderAmount: breadData.finalOrderAmount,
            status: existing?.status || 'pending',
            allApproved,
            note: existing?.note || breadData.note || '',
            manualLeftoverAmount: breadData.manualLeftoverAmount,
            manualLeftoverNote: breadData.manualLeftoverNote
          };
        }));
        
        setReportData(data);
      } catch (error) {
        console.error("Error generating bread report:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (breadTracking && households && routes) {
      generateReport();
    }
  }, [startDate, endDate, breadTracking, households, routes]);

  useEffect(() => {
    const lockPastDates = async () => {
      if (!reportData.length || isLoading) return;
      const today = format(new Date(), 'yyyy-MM-dd');
      
      for (const item of reportData) {
        if (item.date < today && item.date >= '2026-04-14') {
          const existing = await db.breadTracking.where('date').equals(item.date).first();
          if (!existing) {
            await db.breadTracking.add({
              date: item.date,
              totalNeeded: item.totalNeeded,
              delivered: 0,
              leftoverAmount: item.leftoverAmount,
              finalOrderAmount: item.finalOrderAmount,
              status: 'ordered',
              note: 'Sistem tarafından otomatik donduruldu'
            });
          }
        }
      }
    };
    lockPastDates();
  }, [reportData, isLoading]);

  const handleManualEntry = async () => {
    if (!manualNote.trim()) {
      toast.error('Lütfen bir açıklama giriniz.');
      return;
    }

    try {
      const existing = await db.breadTracking.where('date').equals(selectedDate).first();
      const { totalNeeded, leftoverAmount, containerCount, ownContainerCount } = await calculateBreadForNextDay(selectedDate);
      
      const newLeftover = (existing?.leftoverAmount ?? leftoverAmount) + manualAmount;
      const newFinalOrder = Math.max(0, totalNeeded - newLeftover);

      if (existing) {
        await db.breadTracking.update(existing.id!, {
          leftoverAmount: newLeftover,
          finalOrderAmount: newFinalOrder,
          containerCount: existing.containerCount ?? containerCount,
          ownContainerCount: existing.ownContainerCount ?? ownContainerCount,
          manualLeftoverAmount: (existing.manualLeftoverAmount || 0) + manualAmount,
          manualLeftoverNote: manualNote,
          note: existing.note ? `${existing.note} | Manuel: ${manualNote}` : `Manuel: ${manualNote}`
        });
      } else {
        await db.breadTracking.add({
          date: selectedDate,
          totalNeeded,
          delivered: 0,
          leftoverAmount: newLeftover,
          finalOrderAmount: newFinalOrder,
          containerCount,
          ownContainerCount,
          status: 'pending',
          manualLeftoverAmount: manualAmount,
          manualLeftoverNote: manualNote,
          note: `Manuel: ${manualNote}`
        });
      }

      toast.success('Manuel artan ekmek girişi kaydedildi.');
      setIsManualModalOpen(false);
      setManualAmount(0);
      setManualNote('');
    } catch (error) {
      console.error(error);
      toast.error('Kayıt sırasında bir hata oluştu.');
    }
  };

  const handleAddTender = async () => {
    if (!tenderForm.name || tenderForm.maxBreadCount <= 0) {
      toast.error('Lütfen tüm zorunlu alanları doldurunuz.');
      return;
    }

    try {
      await db.tenders.add({
        ...tenderForm,
        remainingMaxBreadCount: tenderForm.maxBreadCount,
        createdAt: new Date()
      });
      toast.success('Yeni ihale başarıyla eklendi.');
      setIsTenderModalOpen(false);
      setTenderForm({
        name: '',
        date: format(new Date(), 'yyyy-MM-dd'),
        tenderNo: '',
        endDate: format(addDays(new Date(), 365), 'yyyy-MM-dd'),
        maxBreadCount: 0
      });
    } catch (error) {
      console.error(error);
      toast.error('İhale eklenirken bir hata oluştu.');
    }
  };

  const handleOrderBread = async (item: any) => {
    if (confirm(`${format(new Date(item.date), 'dd.MM.yyyy')} tarihi için ${item.finalOrderAmount} adet ekmek siparişi verilecek. Onaylıyor musunuz?`)) {
      const loadingToast = toast.loading('Sipariş işleniyor...');
      try {
        // Find active tender (oldest with remaining count > 0)
        const sortedTenders = [...(tenders || [])].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        const activeTender = sortedTenders.find(t => t.remainingMaxBreadCount > 0);

        if (!activeTender) {
          toast.error('Aktif bir ihale bulunamadı veya ihale limiti dolmuş.', { id: loadingToast });
          return;
        }

        if (activeTender.remainingMaxBreadCount < item.finalOrderAmount) {
          toast.error(`İhale limiti yetersiz! Kalan: ${activeTender.remainingMaxBreadCount}`, { id: loadingToast });
          return;
        }

        // Update tender
        await db.tenders.update(activeTender.id!, {
          remainingMaxBreadCount: activeTender.remainingMaxBreadCount - item.finalOrderAmount
        });

        // Update bread tracking
        const existing = await db.breadTracking.where('date').equals(item.date).first();
        if (existing) {
          await db.breadTracking.update(existing.id!, { status: 'ordered' });
        } else {
          const { totalNeeded, leftoverAmount, containerCount, ownContainerCount } = await calculateBreadForNextDay(item.date);
          await db.breadTracking.add({
            date: item.date,
            totalNeeded,
            delivered: 0,
            leftoverAmount,
            finalOrderAmount: item.finalOrderAmount,
            containerCount,
            ownContainerCount,
            status: 'ordered'
          });
        }

        toast.success('Sipariş verildi ve ihale limitinden düşüldü.', { id: loadingToast });
      } catch (error) {
        console.error(error);
        toast.error('Sipariş sırasında bir hata oluştu.', { id: loadingToast });
      }
    }
  };

  const exportPDF = async () => {
    const loadingToast = toast.loading('PDF hazırlanıyor...');
    try {
      const doc = await getTurkishPdf('landscape');
      const startY = await addVakifLogo(doc, 14, 10, 20);
      
      doc.setFontSize(18);
      doc.setFont('Roboto', 'bold');
      doc.text('EKMEK TAKİP VE SİPARİŞ RAPORU', 14, startY + 10);
      
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      doc.text(`Rapor Aralığı: ${format(new Date(startDate), 'dd.MM.yyyy')} - ${format(new Date(endDate), 'dd.MM.yyyy')}`, 14, startY + 18);

      const tableData = reportData.map(b => [
        format(new Date(b.date), 'dd.MM.yyyy'),
        b.totalNeeded.toString(),
        b.leftoverAmount.toString(),
        b.finalOrderAmount.toString(),
        b.status === 'ordered' ? 'Sipariş Verildi' : 'Bekliyor',
        b.note || '-'
      ]);

      autoTable(doc, {
        startY: startY + 25,
        head: [['Tarih', 'Toplam İhtiyaç', 'Artan Ekmek', 'Sipariş Miktarı', 'Durum', 'Not']],
        body: tableData,
        styles: { font: 'Roboto', fontSize: 9 },
        headStyles: { fillColor: [59, 130, 246] }
      });

      addReportFooter(doc, user?.displayName || 'Sistem Yöneticisi');
      doc.save(`ekmek-takip-raporu-${startDate}-${endDate}.pdf`);
      toast.success('Rapor başarıyla indirildi.', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('PDF oluşturulurken bir hata oluştu.', { id: loadingToast });
    }
  };

  const activeTender = [...(tenders || [])]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .find(t => t.remainingMaxBreadCount > 0);

  const showTenderWarning = activeTender && (
    isBefore(new Date(activeTender.endDate), addDays(new Date(), 7)) ||
    activeTender.remainingMaxBreadCount < (reportData[reportData.length - 1]?.finalOrderAmount || 500) * 1.5
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Ekmek Takip ve İhale Yönetimi</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setIsTenderModalOpen(true)}
            className="bg-purple-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-purple-700 transition-colors shadow-sm"
          >
            <Gavel size={18} />
            Yeni İhale Tanımla
          </button>
          <button
            onClick={exportPDF}
            className="bg-green-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-green-700 transition-colors shadow-sm"
          >
            <Download size={18} />
            PDF Rapor Al
          </button>
        </div>
      </div>

      {/* Tender Info Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white shadow-sm rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
              <Gavel size={24} />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Aktif İhale Bilgileri</h3>
          </div>
          
          {activeTender ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">İhale Adı:</span>
                  <span className="font-bold">{activeTender.name}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">İhale No:</span>
                  <span className="font-bold">{activeTender.tenderNo || '-'}</span>
                </div>
                <div className="flex justify-between border-b pb-2">
                  <span className="text-gray-500">Bitiş Tarihi:</span>
                  <span className={`font-bold ${isBefore(new Date(activeTender.endDate), addDays(new Date(), 7)) ? 'text-red-600' : ''}`}>
                    {format(new Date(activeTender.endDate), 'dd.MM.yyyy')}
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-sm text-gray-500">Kalan Ekmek Kapasitesi</span>
                    <span className="text-2xl font-black text-purple-600">{activeTender.remainingMaxBreadCount}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className={`h-2.5 rounded-full ${activeTender.remainingMaxBreadCount < activeTender.maxBreadCount * 0.2 ? 'bg-red-600' : 'bg-purple-600'}`}
                      style={{ width: `${(activeTender.remainingMaxBreadCount / activeTender.maxBreadCount) * 100}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-[10px] text-gray-400">Toplam: {activeTender.maxBreadCount}</span>
                    <span className="text-[10px] text-gray-400">%{Math.round((activeTender.remainingMaxBreadCount / activeTender.maxBreadCount) * 100)} kaldı</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 italic">
              Tanımlı aktif ihale bulunamadı. Lütfen yeni bir ihale ekleyin.
            </div>
          )}

          {showTenderWarning && (
            <div className="mt-4 bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 animate-pulse">
              <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
              <div>
                <h4 className="text-sm font-bold text-red-800">Kritik İhale Uyarısı!</h4>
                <p className="text-xs text-red-700">
                  {isBefore(new Date(activeTender!.endDate), addDays(new Date(), 7)) 
                    ? 'İhale bitiş tarihine 1 haftadan az süre kaldı!' 
                    : 'Kalan ekmek sayısı kritik seviyeye ulaştı! Lütfen yeni ihale hazırlıklarına başlayın.'}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white shadow-sm rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-blue-600" />
            Rapor Aralığı
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Başlangıç Tarihi</label>
              <input
                type="date"
                value={startDate}
                min="2026-04-14"
                onKeyDown={(e) => e.preventDefault()}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Bitiş Tarihi</label>
              <input
                type="date"
                value={endDate}
                min="2026-04-14"
                onKeyDown={(e) => e.preventDefault()}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">Günlük Ekmek Takip Çizelgesi</h3>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Yükleniyor...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam İhtiyaç</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Artan Ekmek</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sipariş Miktarı</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Not</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((b) => (
                  <tr key={b.id} className={b.date === format(new Date(), 'yyyy-MM-dd') ? 'bg-blue-50/30' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">{format(new Date(b.date), 'dd.MM.yyyy')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{b.totalNeeded}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex flex-col">
                        <span className="font-medium">{b.leftoverAmount}</span>
                        {b.manualLeftoverAmount && (
                          <span className="text-[10px] text-orange-600 font-bold">
                            (Manuel: +{b.manualLeftoverAmount})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-blue-600">{b.finalOrderAmount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 inline-flex text-[10px] leading-5 font-bold rounded-full uppercase tracking-wider ${
                        b.status === 'ordered'
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {b.status === 'ordered' ? 'Sipariş Verildi' : 'Bekliyor'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={b.note}>{b.note || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {b.date === format(new Date(), 'yyyy-MM-dd') && b.status !== 'ordered' && (
                          <button
                            onClick={() => handleOrderBread(b)}
                            className="text-green-600 hover:text-green-900 flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-200"
                            title="Siparişi Onayla"
                          >
                            <CheckCircle size={14} />
                            <span>Sipariş Ver</span>
                          </button>
                        )}
                        {b.date === format(new Date(), 'yyyy-MM-dd') && (
                          <button
                            onClick={() => {
                              setSelectedDate(b.date);
                              setIsManualModalOpen(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200"
                          >
                            <Plus size={14} />
                            <span>Manuel Giriş</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {reportData.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">Bu tarih aralığı için kayıt bulunamadı.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tender List */}
      <div className="bg-white shadow-sm rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <h3 className="font-bold text-gray-700">İhale Geçmişi ve Detayları</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İhale Adı</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İhale No</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Başlangıç</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bitiş</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Toplam Limit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kalan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tenders?.map((t) => (
                <tr key={t.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.tenderNo || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(t.date), 'dd.MM.yyyy')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{format(new Date(t.endDate), 'dd.MM.yyyy')}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.maxBreadCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-purple-600">{t.remainingMaxBreadCount}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`px-2 inline-flex text-[10px] leading-5 font-bold rounded-full uppercase ${
                      t.remainingMaxBreadCount > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {t.remainingMaxBreadCount > 0 ? 'Aktif' : 'Tamamlandı'}
                    </span>
                  </td>
                </tr>
              ))}
              {(!tenders || tenders.length === 0) && (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">Henüz ihale kaydı bulunmamaktadır.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tender Modal */}
      {isTenderModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-purple-600 text-white">
              <h3 className="text-xl font-bold">Yeni İhale Tanımla</h3>
              <button onClick={() => setIsTenderModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">İhale Adı *</label>
                  <input
                    type="text"
                    value={tenderForm.name}
                    onChange={(e) => setTenderForm({ ...tenderForm, name: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-purple-500 border p-2"
                    placeholder="Örn: 2026 Yılı Ekmek Alım İhalesi"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">İhale Tarihi</label>
                  <input
                    type="date"
                    value={tenderForm.date}
                    onChange={(e) => setTenderForm({ ...tenderForm, date: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">İhale No</label>
                  <input
                    type="text"
                    value={tenderForm.tenderNo}
                    onChange={(e) => setTenderForm({ ...tenderForm, tenderNo: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm border p-2"
                    placeholder="Varsa ihale numarası"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Bitiş Tarihi *</label>
                  <input
                    type="date"
                    value={tenderForm.endDate}
                    onChange={(e) => setTenderForm({ ...tenderForm, endDate: e.target.value })}
                    className="w-full rounded-lg border-gray-300 shadow-sm border p-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Max Ekmek Sayısı *</label>
                  <input
                    type="number"
                    value={tenderForm.maxBreadCount}
                    onChange={(e) => setTenderForm({ ...tenderForm, maxBreadCount: parseInt(e.target.value) || 0 })}
                    className="w-full rounded-lg border-gray-300 shadow-sm border p-2"
                    min="1"
                  />
                </div>
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsTenderModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleAddTender}
                className="px-6 py-2 text-sm font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl transition-colors shadow-lg shadow-purple-200"
              >
                İhaleyi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Entry Modal */}
      {isManualModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-blue-600 text-white">
              <h3 className="text-xl font-bold">Manuel Artan Ekmek Girişi</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 border border-blue-100">
                <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Bu giriş, mevcut artan ekmek sayısına eklenecek ve bugünkü sipariş miktarını otomatik olarak azaltacaktır.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Ekstra Artan Ekmek Sayısı</label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 border p-3 text-2xl font-black text-center"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Açıklama (Zorunlu)</label>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Neden manuel giriş yapıldığını açıklayın..."
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 border p-2 h-24 text-sm"
                />
              </div>
            </div>
            <div className="p-6 bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="px-6 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 rounded-xl transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleManualEntry}
                className="px-6 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-lg shadow-blue-200 flex items-center gap-2"
              >
                <Save size={18} />
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

