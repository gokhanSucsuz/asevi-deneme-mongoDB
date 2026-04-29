'use client';

import { useState, useEffect } from 'react';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Tender, BreadTracking } from '@/lib/db';
import { format, isWithinInterval, startOfDay, endOfDay, addDays, isBefore, isAfter, subHours } from 'date-fns';
import { safeFormat } from '@/lib/date-utils';
import { calculateBreadForNextDay } from '@/lib/breadUtils';
import { checkIsWorkingDay, getNextWorkingDay } from '@/lib/route-utils';
import { Plus, Save, X, AlertCircle, FileText, Download, TrendingDown, Calendar, Gavel, CheckCircle, Info, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { useAuth } from '@/components/AuthProvider';
import { addSystemLog } from '@/lib/logger';

export default function BreadTrackingPage() {
  const { user, role, personnel } = useAuth();
  const [startDate, setStartDate] = useState('2026-04-14');
  const [endDate, setEndDate] = useState(safeFormat(new Date(), 'yyyy-MM-dd'));
  const [reportData, setReportData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isTenderModalOpen, setIsTenderModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [manualAmount, setManualAmount] = useState<number>(0);
  const [manualTotalAdjustment, setManualTotalAdjustment] = useState<number>(0);
  const [manualContainerAdjustment, setManualContainerAdjustment] = useState<number>(0);
  const [manualNote, setManualNote] = useState('');

  // Tender form state
  const [tenderForm, setTenderForm] = useState({
    name: '',
    date: safeFormat(new Date(), 'yyyy-MM-dd'),
    tenderNo: '',
    endDate: safeFormat(addDays(new Date(), 365), 'yyyy-MM-dd'),
    maxBreadCount: 0
  });

  const breadTracking = useAppQuery(() => db.breadTracking.toArray(), [], 'bread_tracking');
  const households = useAppQuery(() => db.households.toArray(), [], 'households');
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  const tenders = useAppQuery(() => db.tenders.toArray(), [], 'tenders');

  const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
  const todaysRoutes = routes?.filter(r => r.date === todayStr) || [];
  const isTodayRoutesApproved = todaysRoutes.length > 0 && todaysRoutes.every(r => r.status === 'approved');

  const [nextWorkDayInfo, setNextWorkDayInfo] = useState<{date: string, totalNeeded: number} | null>(null);

  useEffect(() => {
    const fetchNextDayInfo = async () => {
      if (isTodayRoutesApproved) {
        const { getNextWorkingDay } = await import('@/lib/route-utils');
        const nextDate = await getNextWorkingDay(new Date());
        const nextDateStr = safeFormat(nextDate, 'yyyy-MM-dd');
        // Lazy calculate to avoid circular or heavy load
        const breadData = await calculateBreadForNextDay(nextDateStr);
        setNextWorkDayInfo({ date: nextDateStr, totalNeeded: breadData.totalNeeded });
      } else {
        setNextWorkDayInfo(null);
      }
    };
    fetchNextDayInfo();
  }, [isTodayRoutesApproved, routes]);

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
      // 3. Fix 16.04.2026 (User Request)
      const targetDate2 = '2026-04-16';
      const existing2 = await db.breadTracking.where('date').equals(targetDate2).first();
      // Total = 499 + 7 = 506
      if (existing2 && (existing2.totalNeeded !== 506 || existing2.leftoverAmount !== 7)) {
        await db.breadTracking.update(existing2.id!, { 
          totalNeeded: 506, 
          leftoverAmount: 7,
          finalOrderAmount: 499 
        });
      } else if (!existing2) {
        await db.breadTracking.add({
          date: targetDate2,
          totalNeeded: 506,
          delivered: 0,
          leftoverAmount: 7,
          finalOrderAmount: 499,
          status: 'ordered',
          note: 'Kullanıcı talebi doğrultusunda düzeltildi'
        });
      }

      // 4. Fix 18.04.2026 (User Request: Holiday record removal)
      const targetDate3 = '2026-04-18';
      const existing3 = await db.breadTracking.where('date').equals(targetDate3).first();
      if (existing3) {
        await db.breadTracking.delete(existing3.id!);
      }

      // 5. Fix 17.04.2026 (User Request: Last working day rule)
      const targetDate4 = '2026-04-17';
      const existing4 = await db.breadTracking.where('date').equals(targetDate4).first();
      // User says: total need 507, order should be 507. 
      // Ensure finalOrderAmount equals totalNeeded (ignoring leftovers for calculation)
      const exactTotalNeeded = 507;
      
      if (existing4) {
        if (existing4.totalNeeded !== exactTotalNeeded || existing4.finalOrderAmount !== exactTotalNeeded) {
          await db.breadTracking.update(existing4.id!, { 
            totalNeeded: exactTotalNeeded,
            finalOrderAmount: exactTotalNeeded,
            note: 'Haftanın son iş günü kuralı (507) uygulandı' 
          });
        }
      } else {
        await db.breadTracking.add({
          date: targetDate4,
          totalNeeded: exactTotalNeeded,
          delivered: 0,
          leftoverAmount: 0,
          finalOrderAmount: exactTotalNeeded,
          status: 'ordered',
          note: 'Haftanın son iş günü kuralı (507) gereği oluşturuldu'
        });
      }

      notifyDbChange('bread_tracking');
    };
    fixDate();
  }, []);

  useEffect(() => {
    const getNextDay = async () => {
      const { getNextWorkingDay } = await import('@/lib/route-utils');
      const nextDay = await getNextWorkingDay(new Date());
      setNextWorkingDayStr(safeFormat(nextDay, 'yyyy-MM-dd'));
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
          dates.push(safeFormat(curr, 'yyyy-MM-dd'));
          curr.setDate(curr.getDate() + 1);
        }

        const data = await Promise.all(dates.map(async (dateStr) => {
          // Check if there's an existing record
          const existing = breadTracking?.find(b => b.date === dateStr);
          const isWorkingDay = await checkIsWorkingDay(new Date(dateStr));
          
          // Calculate dynamically to reflect household changes instantly
          const breadData = await calculateBreadForNextDay(dateStr);
          
          // Check if all routes for this date are approved
          const dayRoutes = routes?.filter(r => r.date === dateStr) || [];
          const allApproved = dayRoutes.length > 0 && dayRoutes.every(r => r.status === 'approved');
          
          const deliveryDate = existing?.deliveryDate || (await getNextWorkingDay(new Date(dateStr))).toISOString().split('T')[0];

          return {
            id: existing?.id || dateStr,
            date: dateStr,
            deliveryDate,
            totalNeeded: breadData.totalNeeded,
            leftoverAmount: breadData.leftoverAmount,
            finalOrderAmount: breadData.finalOrderAmount,
            status: existing?.status || 'pending',
            allApproved,
            isWorkingDay,
            note: existing?.note || breadData.note || '',
            manualLeftoverAmount: breadData.manualLeftoverAmount,
            manualLeftoverNote: breadData.manualLeftoverNote,
            manualTotalAmountAdjustment: breadData.manualTotalAmountAdjustment
          };
        })).then(results => results.filter(item => item.isWorkingDay || item.status === 'ordered'));
        
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
      const today = safeFormat(new Date(), 'yyyy-MM-dd');
      
      for (const item of reportData) {
        // Tatil gününe ait sipariş kaydı varsa temizle (kullanıcı isteği)
        if (!item.isWorkingDay) {
          const existing = await db.breadTracking.where('date').equals(item.date).first();
          if (existing) {
            await db.breadTracking.delete(existing.id!);
            continue;
          }
        }

        if (item.date < today && item.date >= '2026-04-14') {
          const existing = await db.breadTracking.where('date').equals(item.date).first();
          if (!existing && item.isWorkingDay) {
            await db.breadTracking.add({
              date: item.date,
              deliveryDate: item.deliveryDate,
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
      const { totalNeeded: calculatedTotalNeeded, leftoverAmount: calculatedLeftoverAmount, containerCount, ownContainerCount } = await calculateBreadForNextDay(selectedDate);
      
      // Calculate current base values without manual adjustments if we are adding more
      const currentManualLeftover = existing?.manualLeftoverAmount || 0;
      const currentManualTotalAdj = existing?.manualTotalAmountAdjustment || 0;
      const currentManualContainerAdj = existing?.manualContainerAdjustment || 0;
      
      const newManualLeftover = currentManualLeftover + manualAmount;
      const newManualTotalAdj = currentManualTotalAdj + manualTotalAdjustment;
      const newManualContainerAdj = currentManualContainerAdj + manualContainerAdjustment;
      
      const finalTotalNeeded = (calculatedTotalNeeded - currentManualTotalAdj) + newManualTotalAdj;
      const finalLeftover = (calculatedLeftoverAmount - currentManualLeftover) + newManualLeftover;
      const finalContainerCount = Math.max(0, (containerCount - currentManualContainerAdj) + newManualContainerAdj);
      const newFinalOrder = Math.max(0, finalTotalNeeded - finalLeftover);

      if (existing) {
        await db.breadTracking.update(existing.id!, {
          totalNeeded: finalTotalNeeded,
          leftoverAmount: finalLeftover,
          finalOrderAmount: newFinalOrder,
          containerCount: finalContainerCount,
          ownContainerCount: existing.ownContainerCount ?? ownContainerCount,
          manualLeftoverAmount: newManualLeftover,
          manualTotalAmountAdjustment: newManualTotalAdj,
          manualContainerAdjustment: newManualContainerAdj,
          manualLeftoverNote: manualNote,
          note: existing.note ? `${existing.note} | Manuel Düzeltme: ${manualNote}` : `Manuel Düzeltme: ${manualNote}`
        });
      } else {
        await db.breadTracking.add({
          date: selectedDate,
          totalNeeded: finalTotalNeeded,
          delivered: 0,
          leftoverAmount: finalLeftover,
          finalOrderAmount: newFinalOrder,
          containerCount: finalContainerCount,
          ownContainerCount,
          status: 'pending',
          manualLeftoverAmount: newManualLeftover,
          manualTotalAmountAdjustment: newManualTotalAdj,
          manualContainerAdjustment: newManualContainerAdj,
          manualLeftoverNote: manualNote,
          note: `Manuel Düzeltme: ${manualNote}`
        });
      }

      toast.success('Manuel düzeltme kaydedildi.');
      await addSystemLog(user, personnel, 'Ekmek Manuel Düzeltme', `${selectedDate} tarihi için Artan: ${manualAmount}, Toplam İhtiyaç: ${manualTotalAdjustment}, Kap: ${manualContainerAdjustment} manuel düzeltme yapıldı. Not: ${manualNote}`, 'bread');
      setIsManualModalOpen(false);
      setManualAmount(0);
      setManualTotalAdjustment(0);
      setManualContainerAdjustment(0);
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
      if ((tenderForm as any).id) {
         // Update existing
         const existing = await db.tenders.toArray().then(arr => arr.find(t => t.id === (tenderForm as any).id));
         if (existing) {
             const diff = tenderForm.maxBreadCount - existing.maxBreadCount;
             await db.tenders.update(existing.id!, {
                name: tenderForm.name,
                date: tenderForm.date,
                tenderNo: tenderForm.tenderNo,
                endDate: tenderForm.endDate,
                maxBreadCount: tenderForm.maxBreadCount,
                remainingMaxBreadCount: existing.remainingMaxBreadCount + diff
             });
             toast.success('İhale başarıyla güncellendi.');
             await addSystemLog(user, personnel, 'İhale Güncellendi', `${tenderForm.name} ihalesi güncellendi. Yeni Kapasite: ${tenderForm.maxBreadCount}`, 'tender');
         }
      } else {
         // Create new
         await db.tenders.add({
           ...tenderForm,
           remainingMaxBreadCount: tenderForm.maxBreadCount,
           createdAt: new Date()
         });
         toast.success('Yeni ihale başarıyla eklendi.');
         await addSystemLog(user, personnel, 'Yeni İhale Tanımlandı', `${tenderForm.name} ihalesi ${tenderForm.maxBreadCount} adet kapasite ile tanımlandı.`, 'tender');
      }
      setIsTenderModalOpen(false);
      setTenderForm({
        name: '',
        date: safeFormat(new Date(), 'yyyy-MM-dd'),
        tenderNo: '',
        endDate: safeFormat(addDays(new Date(), 365), 'yyyy-MM-dd'),
        maxBreadCount: 0
      });
    } catch (error) {
      console.error(error);
      toast.error('İhale kaydedilirken bir hata oluştu.');
    }
  };

  const handleEditTender = (tender: Tender) => {
     setTenderForm({
         ...tender,
         date: tender.date || safeFormat(tender.createdAt || new Date(), 'yyyy-MM-dd')
     } as any);
     setIsTenderModalOpen(true);
  };

  const handleDeleteTender = async (id: string) => {
      if (confirm('Bu ihaleyi tamamen silmek istediğinize emin misiniz?')) {
          try {
             await db.tenders.delete(id);
             toast.success('İhale başarıyla silindi.');
             await addSystemLog(user, personnel, 'İhale Silindi', `İhale kaydı (ID: ${id}) sistemden silindi.`, 'tender');
          } catch (error) {
             toast.error('Silme sırasında hata oluştu.');
          }
      }
  };

  const handleOrderBread = async (item: any) => {
    if (confirm(`${safeFormat(new Date(item.date), 'dd.MM.yyyy')} tarihi için ${item.finalOrderAmount} adet ekmek siparişi verilecek. Onaylıyor musunuz?`)) {
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
        await addSystemLog(user, personnel, 'Ekmek Siparişi Verildi', `${item.date} tarihi için ${item.finalOrderAmount} adet ekmek siparişi verildi.`, 'bread');
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
      
      doc.setFontSize(11);
      doc.setFont('Roboto', 'bold');
      doc.text('T.C.', doc.internal.pageSize.width / 2, 12, { align: 'center' });
      doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 18, { align: 'center' });
      doc.text('AŞEVİ EKMEK TAKİP VE SİPARİŞ ÇİZELGESİ', doc.internal.pageSize.width / 2, 24, { align: 'center' });
      
      doc.setFontSize(9);
      doc.setFont('Roboto', 'normal');
      doc.text(`Rapor Tarihi: ${safeFormat(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 12, { align: 'right' });
      doc.text(`Rapor Aralığı: ${safeFormat(new Date(startDate), 'dd.MM.yyyy')} - ${safeFormat(new Date(endDate), 'dd.MM.yyyy')}`, 14, startY + 5);

      const tableData = reportData.map(b => [
        safeFormat(new Date(b.date), 'dd.MM.yyyy'),
        b.totalNeeded.toString(),
        b.leftoverAmount.toString(),
        b.finalOrderAmount.toString(),
        `${b.containerCount ?? '-'} / ${b.ownContainerCount ?? '-'}`,
        b.status === 'ordered' ? 'SİPARİŞ VERİLDİ' : 'BEKLİYOR',
        b.note || '-'
      ]);

      autoTable(doc, {
        startY: startY + 10,
        head: [['TARİH', 'TOPLAM İHTİYAÇ', 'ARTAN EKMEK', 'SİPARİŞ', 'KAP(VAKIF/KENDİ)', 'DURUM', 'DÜŞÜNCELER']],
        body: tableData,
        styles: { font: 'Roboto', fontSize: 8, cellPadding: 2, lineWidth: 0.1, lineColor: [80, 80, 80] },
        headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1 },
        alternateRowStyles: { fillColor: [252, 252, 252] }
      });

      const finalY = (doc as any).lastAutoTable.finalY + 20;
      doc.setFontSize(10);
      doc.setFont('Roboto', 'normal');
      
      // Signatures
      const pageWidth = doc.internal.pageSize.width;
      doc.text('HAZIRLAYAN', 40, finalY);
      doc.text('(İmza)', 45, finalY + 12);
      doc.text(personnel?.name || '.........................', 35, finalY + 18);
      doc.text('Aşevi Personeli', 40, finalY + 23);

      doc.text('TASDİK OLUNUR', pageWidth - 80, finalY);
      doc.text('(İmza)', pageWidth - 70, finalY + 12);
      doc.text('.........................', pageWidth - 75, finalY + 18);
      doc.text('Vakıf Müdürü / Yetkili', pageWidth - 80, finalY + 23);

      await addSystemLog(user, personnel, 'Rapor İndirme', `${startDate} - ${endDate} dönemi Ekmek Takip Raporu (PDF) indirildi.`, 'report');
      doc.save(`EKMEK_TAKIP_RAPORU_${startDate}_${endDate}.pdf`);
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
              <div className="absolute top-0 right-0 flex gap-2">
                 <button onClick={() => handleEditTender(activeTender)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full" title="Düzenle">
                    <Edit2 size={16} />
                 </button>
                 <button onClick={() => handleDeleteTender(activeTender.id!)} className="p-2 text-red-600 hover:bg-red-50 rounded-full" title="Sil">
                    <Trash2 size={16} />
                 </button>
              </div>
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
                    {safeFormat(new Date(activeTender.endDate), 'dd.MM.yyyy')}
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
            <Info size={20} className="text-blue-600" />
            Sipariş Önerisi
          </h3>
          
          {nextWorkDayInfo ? (
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <CheckCircle size={20} />
                <span className="font-bold text-sm">Tüm Rotalar Onaylandı</span>
              </div>
              <p className="text-xs text-blue-700 mb-3">
                Bugünkü tüm rotalar onaylandığı için sistem bir sonraki çalışma günü ({safeFormat(new Date(nextWorkDayInfo.date), 'dd.MM.yyyy')}) SIPARISINI önermektedir.
              </p>
              <div className="bg-white p-3 rounded-lg border border-blue-100 flex justify-between items-center">
                <span className="text-xs font-bold text-gray-500 uppercase">Önerilen Sipariş</span>
                <span className="text-xl font-black text-blue-600">{nextWorkDayInfo.totalNeeded} Adet</span>
              </div>
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 p-4 rounded-xl">
              <p className="text-xs text-gray-500 italic leading-relaxed">
                {todaysRoutes.length === 0 
                  ? 'Henüz bugüne ait rota tanımlanmamış.'
                  : 'Sipariş önerisi için bugünkü tüm rotaların onaylanması gerekmektedir.'}
              </p>
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
              <thead className="bg-gray-50 text-[10px] uppercase font-bold tracking-tight text-gray-500">
                <tr>
                  <th className="px-3 py-3 text-left">Tarih</th>
                  <th className="px-3 py-3 text-left hidden sm:table-cell">Teslimat Tarihi</th>
                  <th className="px-3 py-3 text-left">Top. İhtiyaç</th>
                  <th className="px-3 py-3 text-left">Artan Ekmek</th>
                  <th className="px-3 py-3 text-left">Sipariş</th>
                  <th className="px-3 py-3 text-left hidden md:table-cell">Kap (Vakıf/Kendi)</th>
                  <th className="px-3 py-3 text-left">Durum</th>
                  <th className="px-3 py-3 text-left hidden lg:table-cell">Not</th>
                  <th className="px-3 py-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((b) => (
                    <tr key={b.id} className={b.date === safeFormat(new Date(), 'yyyy-MM-dd') ? 'bg-blue-50/30' : ''}>
                      <td className="px-3 py-3 whitespace-nowrap text-xs font-bold text-gray-900">
                        <div className="flex flex-col">
                          <span>{safeFormat(new Date(b.date), 'dd.MM.yyyy')}</span>
                          {!b.isWorkingDay && (
                            <span className="text-[9px] text-red-500 font-bold uppercase">Tatil</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 hidden sm:table-cell">
                        {safeFormat(new Date(b.deliveryDate), 'dd.MM.yyyy')}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                        <div className="flex flex-col">
                          <span className="font-medium">{b.totalNeeded}</span>
                          {b.manualTotalAmountAdjustment ? (
                            <span className={`text-[10px] font-bold ${b.manualTotalAmountAdjustment > 0 ? 'text-green-600' : 'text-red-600'}`}>
                              ({b.manualTotalAmountAdjustment > 0 ? '+' : ''}{b.manualTotalAmountAdjustment})
                            </span>
                          ) : null}
                        </div>
                      </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      <div className="flex flex-col">
                        <span className="font-medium">{b.leftoverAmount}</span>
                        {b.manualLeftoverAmount ? (
                          <span className={`text-[10px] font-bold ${b.manualLeftoverAmount > 0 ? 'text-orange-600' : 'text-purple-600'}`}>
                            ({b.manualLeftoverAmount > 0 ? '+' : ''}{b.manualLeftoverAmount})
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs font-black text-blue-600">{b.finalOrderAmount}</td>
                    <td className="px-3 py-3 text-xs text-gray-500 hidden md:table-cell">
                      <div className="flex flex-col gap-1">
                         <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit">Vakıf: {b.containerCount ?? '-'}</span>
                         <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-[10px] font-bold w-fit">Kendi: {b.ownContainerCount ?? '-'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500">
                      <span className={`px-2 py-0.5 inline-flex text-[9px] font-bold rounded-full uppercase tracking-wider ${
                        b.status === 'ordered'
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {b.status === 'ordered' ? 'BİTTİ' : 'BEKLİYOR'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-500 max-w-[120px] truncate hidden lg:table-cell" title={b.note}>{b.note || '-'}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-right text-xs font-medium">
                      <div className="flex justify-end gap-1.5">
                        {b.isWorkingDay && b.status !== 'ordered' && isBefore(new Date(), subHours(new Date(`${b.deliveryDate}T08:00:00`), 12)) && (
                          <button
                            onClick={() => handleOrderBread(b)}
                            className="text-green-600 hover:text-green-900 flex items-center gap-1 bg-green-50 px-2 py-1 rounded border border-green-200"
                            title="Siparişi Onayla"
                          >
                            <CheckCircle size={14} />
                            <span>Sipariş Ver</span>
                          </button>
                        )}
                        {isBefore(new Date(), subHours(new Date(`${b.deliveryDate}T08:00:00`), 12)) && (
                          <button
                            onClick={() => {
                              setSelectedDate(b.date);
                              setManualAmount(0);
                              setManualTotalAdjustment(0);
                              setManualContainerAdjustment(0);
                              setManualNote('');
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
                    <td colSpan={9} className="px-6 py-4 text-center text-sm text-gray-500">Bu tarih aralığı için kayıt bulunamadı.</td>
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
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm font-medium text-gray-900">{t.name}</td>
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">{t.tenderNo || '-'}</td>
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">{safeFormat(new Date(t.date), 'dd.MM.yyyy')}</td>
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">{safeFormat(new Date(t.endDate), 'dd.MM.yyyy')}</td>
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">{t.maxBreadCount}</td>
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm font-bold text-purple-600">{t.remainingMaxBreadCount}</td>
                  <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm">
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
              <h3 className="text-xl font-bold">Manuel Ekmek Düzeltmesi</h3>
              <button onClick={() => setIsManualModalOpen(false)} className="text-white/80 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-blue-50 p-4 rounded-xl flex items-start gap-3 border border-blue-100">
                <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Bu bölümden toplam ihtiyaca ekleme/çıkarma yapabilir veya artan ekmek sayısını manuel olarak düzeltebilirsiniz. Sipariş miktarı otomatik olarak güncellenecektir.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 italic transition-transform hover:scale-[1.02]">
                  <label className="block text-[10px] font-black uppercase tracking-tighter text-orange-800 mb-2">Artan Ekmek Düzeltme (+/-)</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setManualAmount(prev => prev - 1)}
                      className="bg-white text-orange-600 border border-orange-200 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-orange-100 flex-shrink-0"
                    >-</button>
                    <input
                      type="number"
                      value={manualAmount}
                      onChange={(e) => setManualAmount(parseInt(e.target.value) || 0)}
                      className="flex-1 rounded-lg border-orange-200 shadow-sm focus:ring-orange-500 border p-2 text-xl font-black text-center bg-white min-w-0"
                    />
                    <button 
                      onClick={() => setManualAmount(prev => prev + 1)}
                      className="bg-white text-orange-600 border border-orange-200 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-orange-100 flex-shrink-0"
                    >+</button>
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-xl border border-green-100 italic transition-transform hover:scale-[1.02]">
                  <label className="block text-[10px] font-black uppercase tracking-tighter text-green-800 mb-2">Toplam İhtiyaç Düzeltme (+/-)</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setManualTotalAdjustment(prev => prev - 1)}
                      className="bg-white text-green-600 border border-green-200 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-green-100 flex-shrink-0"
                    >-</button>
                    <input
                      type="number"
                      value={manualTotalAdjustment}
                      onChange={(e) => setManualTotalAdjustment(parseInt(e.target.value) || 0)}
                      className="flex-1 rounded-lg border-green-200 shadow-sm focus:ring-green-500 border p-2 text-xl font-black text-center bg-white min-w-0"
                    />
                    <button 
                      onClick={() => setManualTotalAdjustment(prev => prev + 1)}
                      className="bg-white text-green-600 border border-green-200 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-green-100 flex-shrink-0"
                    >+</button>
                  </div>
                </div>

                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 italic transition-transform hover:scale-[1.02] sm:col-span-2">
                  <label className="block text-[10px] font-black uppercase tracking-tighter text-purple-800 mb-2">Kap Sayısı Düzeltme (+/-)</label>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setManualContainerAdjustment(prev => prev - 1)}
                      className="bg-white text-purple-600 border border-purple-200 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-purple-100 flex-shrink-0"
                    >-</button>
                    <input
                      type="number"
                      value={manualContainerAdjustment}
                      onChange={(e) => setManualContainerAdjustment(parseInt(e.target.value) || 0)}
                      className="flex-1 rounded-lg border-purple-200 shadow-sm focus:ring-purple-500 border p-2 text-xl font-black text-center bg-white min-w-0"
                    />
                    <button 
                      onClick={() => setManualContainerAdjustment(prev => prev + 1)}
                      className="bg-white text-purple-600 border border-purple-200 w-8 h-8 rounded-full font-black flex items-center justify-center hover:bg-purple-100 flex-shrink-0"
                    >+</button>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Düzeltme Gerekçesi (Zorunlu)</label>
                <textarea
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="Neden düzeltme yapıldığını açıklayın (Örn: Hatalı sayım, ekstra hane eklemesi vb.)"
                  className="w-full rounded-lg border-gray-300 shadow-sm focus:ring-blue-500 border p-2 h-20 text-sm"
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

