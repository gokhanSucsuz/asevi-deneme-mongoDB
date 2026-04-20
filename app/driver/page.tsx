'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Route, RouteStop, Household } from '@/lib/db';
import { generateRouteFromTemplate, getNextWorkingDay, checkAndGenerateNextDayRoutes } from '@/lib/route-utils';
import { safeFormat } from '@/lib/date-utils';
import { getTurkishPdf, addVakifLogo } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { CheckCircle, XCircle, AlertTriangle, Navigation, MapPin, LogOut, Clock, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';

export default function DriverPage() {
  const { user, role } = useAuth();
  const isDemo = role === 'demo';
  const router = useRouter();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [todayRoute, setTodayRoute] = useState<Route | null>(null);
  const [startKm, setStartKm] = useState<string>('');
  const [endKm, setEndKm] = useState<string>('');
  const [extraFood, setExtraFood] = useState<string>('0');
  const [extraBread, setExtraBread] = useState<string>('0');
  const [issueText, setIssueText] = useState<string>('');
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [editingPastStopId, setEditingPastStopId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'delivered' | 'failed', stopId: string } | null>(null);
  const [isLastWorkingDay, setIsLastWorkingDay] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPausedLocal, setIsPausedLocal] = useState(false);

  const drivers = useAppQuery(() => db.drivers.filter(d => !!d.isActive).toArray(), [], 'drivers');
  const systemSettings = useAppQuery(() => db.system_settings.get('global'), [], 'system_settings');
  const today = safeFormat(new Date(), 'yyyy-MM-dd');

  // Auto-select driver based on google email
  useEffect(() => {
    const detectDriver = async () => {
      if (user?.email && drivers && drivers.length > 0) {
        const matchingDriver = drivers.find(d => d.googleEmail?.toLowerCase() === user.email?.toLowerCase());
        if (matchingDriver && !selectedDriverId) {
          setSelectedDriverId(matchingDriver.id!);
          toast.success(`Hoş geldiniz, ${matchingDriver.name}`);
        }
      }
    };
    detectDriver();
  }, [user, drivers, selectedDriverId]);

  // Sync paused state from DB
  useEffect(() => {
    if (todayRoute) {
      setIsPausedLocal(!!todayRoute.isPaused);
    }
  }, [todayRoute]);

  // Auth check
  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  // Check if todayRoute is the last working day of the week
  useEffect(() => {
    const checkLastWorkingDay = async () => {
      if (todayRoute) {
        const { isLastWorkingDayOfWeek } = await import('@/lib/route-utils');
        const isLast = await isLastWorkingDayOfWeek(new Date(todayRoute.date));
        setIsLastWorkingDay(isLast);
      }
    };
    checkLastWorkingDay();
  }, [todayRoute]);

  // Run background tasks on mount
  useEffect(() => {
    if (isDemo) return;
    const runBackgroundTasks = async () => {
      const now = new Date();
      const todayStr = safeFormat(now, 'yyyy-MM-dd');
      const currentHour = now.getHours();

      try {
        // 1. Check expired pauses and activate them
        const households = await db.households.toArray();
        const expired = households.filter(h => !h.isActive && h.pausedUntil && h.pausedUntil !== '9999-12-31' && h.pausedUntil < todayStr);
        for (const h of expired) {
          await db.households.update(h.id!, {
            isActive: true,
            pausedUntil: '',
            history: [...(h.history || []), {
              action: 'activated',
              date: new Date(),
              note: 'Pasif süresi dolduğu için otomatik aktifleştirildi'
            }]
          });
        }

        // 2. Auto-complete past routes
        const allRoutes = await db.routes.toArray();
        const pendingRoutes = allRoutes.filter(r => r.status !== 'completed' && r.status !== 'approved');
        const currentMinute = now.getMinutes();
        
        for (const route of pendingRoutes) {
          const isPastDay = route.date < todayStr;
          const isTodayPast1730 = route.date === todayStr && (currentHour > 17 || (currentHour === 17 && currentMinute >= 30));
          
          if (isPastDay || isTodayPast1730) {
            const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
            for (const stop of stops) {
              if (stop.status === 'pending') {
                await db.routeStops.update(stop.id!, {
                  status: 'delivered',
                  deliveredAt: new Date(),
                  history: [...(stop.history || []), { status: 'delivered', timestamp: new Date(), note: 'Otomatik tamamlandı (Saat 17:30 sonrası)' }]
                });
              }
            }
            await db.routes.update(route.id!, {
              status: 'completed',
              endKm: route.startKm || 0,
              remainingFood: 0,
              remainingBread: 0,
              history: [...(route.history || []), { action: 'auto_completed', date: new Date(), note: 'Saat 17:30 sonrası otomatik tamamlandı' }]
            });
            
            // Generate next working day's route
            await checkAndGenerateNextDayRoutes(new Date(route.date));
          }
        }
      } catch (error) {
        console.error("Background tasks error:", error);
      }
    };
    runBackgroundTasks();
  }, [isDemo]);

  // Fetch route when driver is selected
  useEffect(() => {
    const fetchRoute = async () => {
      if (selectedDriverId) {
        const now = new Date();
        const todayStr = safeFormat(now, 'yyyy-MM-dd');
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const isWithinWorkHours = (currentHour > 8 || (currentHour === 8 && currentMinute >= 30)) && (currentHour < 17 || (currentHour === 17 && currentMinute <= 30));

        // 1. Check for any "in_progress" route first (resume capability)
        const driverRoutes = await db.routes.where('driverId').equals(selectedDriverId).toArray();
        const inProgressRoute = driverRoutes.find(r => r.status === 'in_progress');
        
        if (inProgressRoute) {
          setTodayRoute(inProgressRoute);
          return;
        }

        // 2. Check for today's route (even if pending) if within hours
        const existingTodayRoute = driverRoutes.find(r => r.date === todayStr);
        if (existingTodayRoute && (existingTodayRoute.status === 'pending' || isWithinWorkHours)) {
          setTodayRoute(existingTodayRoute);
          return;
        }

        // 3. Fallback to logic for generating/finding next route
        let targetDate = new Date();
        if (currentHour > 9 || (currentHour === 9 && currentMinute >= 30)) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        while (targetDate.getDay() === 0 || targetDate.getDay() === 6) {
          targetDate.setDate(targetDate.getDate() + 1);
        }
        const targetDateStr = safeFormat(targetDate, 'yyyy-MM-dd');
        
        await generateRouteFromTemplate(selectedDriverId, targetDateStr);
        const route = driverRoutes.find(r => r.date === targetDateStr);
        setTodayRoute(route || null);
      }
    };
    fetchRoute();
  }, [selectedDriverId]);

  const routeStops = useAppQuery(
    async () => {
      if (!todayRoute) return [];
      const stops = await db.routeStops.where('routeId').equals(todayRoute.id!).toArray();
      return stops.sort((a: any, b: any) => a.order - b.order);
    },
    [todayRoute]
  );

  const households = useAppQuery(
    async () => routeStops ? Promise.all(routeStops.map((rs: RouteStop) => db.households.get(rs.householdId))) : [],
    [routeStops]
  );

  const handleStartRoute = async () => {
    if (!startKm) {
      toast.error('Lütfen başlangıç KM bilgisini giriniz.');
      return;
    }
    setIsSaving(true);
    const loadingToast = toast.loading('Rota başlatılıyor...');
    try {
      if (todayRoute) {
        await db.routes.update(todayRoute.id!, {
          status: 'in_progress',
          startKm: Number(startKm),
          isPaused: false
        });
        setTodayRoute({ ...todayRoute, status: 'in_progress', startKm: Number(startKm), isPaused: false });
        toast.success('Rota başarıyla başlatıldı', { id: loadingToast });
      }
    } catch (error) {
      console.error(error);
      toast.error('Rota başlatılırken bir hata oluştu', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePause = async () => {
    if (!todayRoute) return;
    setIsSaving(true);
    const newPausedState = !isPausedLocal;
    try {
      await db.routes.update(todayRoute.id!, {
        isPaused: newPausedState
      });
      setIsPausedLocal(newPausedState);
      setTodayRoute({ ...todayRoute, isPaused: newPausedState });
      toast.info(newPausedState ? 'Rota duraklatıldı (Mola)' : 'Rota devam ettiriliyor');
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndRoute = async () => {
    if (!endKm) {
      toast.error('Lütfen bitiş KM bilgisini giriniz.');
      return;
    }
    if (confirm('Günü tamamlamak istediğinize emin misiniz?')) {
      setIsSaving(true);
      const loadingToast = toast.loading('Günü tamamlanıyor...');
      try {
        const totalRemainingFood = autoRemainingFood + Number(extraFood);
        const totalRemainingBread = autoRemainingBread + Number(extraBread);

        await db.routes.update(todayRoute!.id!, {
          status: 'completed',
          endKm: Number(endKm),
          remainingFood: totalRemainingFood,
          remainingBread: totalRemainingBread
        });

        // Auto-generate route for the next working day if all are completed
        await checkAndGenerateNextDayRoutes(new Date());

        setTodayRoute({ 
          ...todayRoute!, 
          status: 'completed', 
          endKm: Number(endKm),
          remainingFood: totalRemainingFood,
          remainingBread: totalRemainingBread
        });
        setEndKm('');
        setExtraFood('0');
        setExtraBread('0');
        toast.success('Günü başarıyla tamamladınız. Elinize sağlık!', { id: loadingToast });
      } catch (error) {
        console.error(error);
        toast.error('Günü tamamlarken bir hata oluştu', { id: loadingToast });
      } finally {
        setIsSaving(false);
      }
    }
  };

  const updateStopStatus = async (stopId: string, status: 'delivered' | 'failed') => {
    setIsSaving(true);
    const loadingToast = toast.loading('Kaydediliyor...');
    try {
      const stop = await db.routeStops.get(stopId);
      if (stop) {
        const newHistory = stop.history || [];
        newHistory.push({
          status,
          timestamp: new Date(),
          note: status === 'failed' ? issueText : undefined
        });

        await db.routeStops.update(stop.id!, {
          status,
          deliveredAt: new Date(),
          issueReport: status === 'failed' ? issueText : undefined,
          history: newHistory
        });
        toast.success(status === 'delivered' ? 'Teslimat kaydedildi' : 'Sorun bildirildi', { id: loadingToast });
      }
      setIssueText('');
      setActiveStopId(null);
      setEditingPastStopId(null);
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu', { id: loadingToast });
    } finally {
      setIsSaving(false);
    }
  };

  const exportMarkingFormPDF = async () => {
    if (!todayRoute) return;
    
    const doc = await getTurkishPdf('portrait');
    const driver = drivers?.find(d => d.id === selectedDriverId);
    const driverName = driver?.name || 'Bilinmeyen Şoför';
    
    await addVakifLogo(doc, 14, 10, 20);

    doc.setFontSize(14);
    doc.text('T.C.', 40, 16);
    doc.text('Sosyal Yardımlaşma ve Dayanışma Vakfı Başkanlığı', 40, 22);
    doc.setFontSize(12);
    doc.text('GÜNLÜK YEMEK DAĞITIM İŞARETLEME FORMU', doc.internal.pageSize.width / 2, 35, { align: 'center' });
    
    doc.setFontSize(10);
    doc.text(`Tarih: ${safeFormat(new Date(todayRoute.date), 'dd.MM.yyyy')}`, doc.internal.pageSize.width - 40, 22);
    doc.text(`Şoför Adı Soyadı: ${driverName}`, 14, 45);

    let totalPeople = 0;
    let totalBread = 0;

    const tableColumn = ["Sıra", "Hane Sorumlusu", "Adres", "Yemek", "Ekmek", "Teslim Durumu"];
    const tableRows = routeStops.map((stop: RouteStop, i: number) => {
      const household = households?.find(h => h.id === stop.householdId);
      const memberCount = stop.householdSnapshotMemberCount || household?.memberCount || 0;
      const breadCount = stop.householdSnapshotBreadCount ?? household?.breadCount ?? memberCount;
      
      totalPeople += memberCount;
      totalBread += breadCount;
      
      return [
        (i + 1).toString(),
        stop.householdSnapshotName || household?.headName || '',
        household?.address || '',
        memberCount.toString(),
        breadCount.toString(),
        '[  ] Teslim Edildi   [  ] Edilemedi'
      ];
    });

    // Add total row
    tableRows.push([
      '',
      'TOPLAM',
      '',
      totalPeople.toString(),
      totalBread.toString(),
      ''
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 50,
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 3 },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [66, 66, 66] },
      footStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] },
      columnStyles: {
        5: { cellWidth: 50 }
      },
      willDrawCell: function(data) {
        if (data.row.index === tableRows.length - 1) {
          doc.setFont('Roboto', 'bold');
          data.cell.styles.fillColor = [240, 240, 240];
        }
      }
    });

    doc.save(`Isaretleme_Formu_${safeFormat(new Date(todayRoute.date), 'yyyy-MM-dd')}_${driverName.replace(/\s+/g, '_')}.pdf`);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success('Başarıyla çıkış yapıldı');
      router.push('/login');
    } catch (error) {
      console.error(error);
      toast.error('Çıkış yapılırken bir hata oluştu');
    }
  };

  if (!selectedDriverId) {
    return (
      <div className="max-w-md mx-auto mt-10 space-y-4">
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center">
          <Image 
            src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
            alt="Vakıf Logosu" 
            width={80} 
            height={80} 
            className="rounded-full mb-6 shadow-md"
            referrerPolicy="no-referrer"
          />
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Şoför Girişi</h2>
          <div className="space-y-4 w-full">
            <label className="block text-sm font-medium text-gray-700">Lütfen isminizi seçin</label>
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-lg border p-3"
              onChange={(e) => setSelectedDriverId(e.target.value)}
              defaultValue=""
            >
              <option value="" disabled>Şoför Seçiniz</option>
              {drivers?.map(d => (
                <option key={d.id} value={d.id}>{d.name} ({d.vehiclePlate})</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
          <span className="text-sm text-gray-500 truncate max-w-[200px]">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center text-sm font-medium text-red-600 hover:text-red-800"
          >
            <LogOut size={16} className="mr-1" />
            Çıkış Yap
          </button>
        </div>
      </div>
    );
  }

  if (!todayRoute) {
    return (
      <div className="text-center mt-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <Navigation className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Bugün için atanmış rotanız bulunmuyor.</h2>
        <p className="text-gray-500">Lütfen yönetim birimi ile iletişime geçin.</p>
        <button 
          onClick={() => setSelectedDriverId(null)}
          className="mt-6 text-green-600 hover:text-green-800 font-medium"
        >
          Farklı bir şoför seç
        </button>
      </div>
    );
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isWithinWorkingHours = (currentHour > 8 || (currentHour === 8 && currentMinute >= 30)) && (currentHour < 17 || (currentHour === 17 && currentMinute <= 30));
  const isRouteToday = todayRoute.date === today;

  if (!isRouteToday || !isWithinWorkingHours) {
    return (
      <div className="text-center mt-20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
          <Clock className="h-8 w-8 text-gray-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Rota Görüntüleme Kapalı</h2>
        <p className="text-gray-500">Günlük rotanızı sadece rotanın ait olduğu gün 08:30 ile 17:30 saatleri arasında görebilirsiniz.</p>
        <button 
          onClick={() => setSelectedDriverId(null)}
          className="mt-6 text-green-600 hover:text-green-800 font-medium"
        >
          Farklı bir şoför seç
        </button>
      </div>
    );
  }

  const isPanelPassive = systemSettings?.isDistributionPanelActive === false;

  // Calculate totals
  let totalFood = 0;
  let totalBread = 0;
  let deliveredCount = 0;
  let pendingCount = 0;
  let autoRemainingFood = 0;
  let autoRemainingBread = 0;

  if (routeStops && households) {
    routeStops.forEach((stop: RouteStop, index: number) => {
      const household = households[index] as Household | null;
      if (household) {
        // Skip deleted/paused from totals if they are not active
        const isDeleted = household.pausedUntil === '9999-12-31';
        const isPaused = household.pausedUntil && household.pausedUntil >= todayRoute.date;
        
        if (!isDeleted && !isPaused) {
          const multiplier = isLastWorkingDay ? 2 : 1;
          const breadCount = stop.householdSnapshotBreadCount ?? household.breadCount ?? household.memberCount;
          totalFood += household.memberCount * multiplier;
          totalBread += breadCount * multiplier;
          if (stop.status === 'delivered') deliveredCount++;
          if (stop.status === 'pending') pendingCount++;
        }
        
        if (stop.status === 'failed') {
          const count = stop.householdSnapshotMemberCount || household.memberCount;
          const breadCount = stop.householdSnapshotBreadCount ?? household.breadCount ?? household.memberCount;
          const multiplier = isLastWorkingDay ? 2 : 1;
          autoRemainingFood += count * multiplier;
          autoRemainingBread += breadCount * multiplier;
        }
      }
    });
  }

  const sortedStops = routeStops ? [...routeStops].sort((a, b) => {
    const hA = households?.find(h => h?.id === a.householdId);
    const hB = households?.find(h => h?.id === b.householdId);
    
    const isDeletedA = hA?.pausedUntil === '9999-12-31';
    const isDeletedB = hB?.pausedUntil === '9999-12-31';
    const isPausedA = hA?.pausedUntil && hA.pausedUntil >= todayRoute.date;
    const isPausedB = hB?.pausedUntil && hB.pausedUntil >= todayRoute.date;

    // Deleted at the very bottom
    if (isDeletedA && !isDeletedB) return 1;
    if (!isDeletedA && isDeletedB) return -1;
    
    // Paused above deleted but below active
    if (isPausedA && !isPausedB && !isDeletedB) return 1;
    if (!isPausedA && isPausedB && !isDeletedA) return -1;

    return a.order - b.order;
  }) : [];

  const nextStop = sortedStops.find((rs: RouteStop) => {
    const h = households?.find(hh => hh?.id === rs.householdId);
    const isDeleted = h?.pausedUntil === '9999-12-31';
    const isPaused = h?.pausedUntil && h.pausedUntil >= todayRoute.date;
    return rs.status === 'pending' && !isDeleted && !isPaused;
  });
  const nextHousehold = nextStop ? (households?.find(hh => hh?.id === nextStop.householdId) as Household | null) : null;

  return (
    <div className="flex flex-col pb-10">
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm mb-6 rounded-lg">
        <div className="flex items-center gap-3">
          <Image 
            src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
            alt="Vakıf Logosu" 
            width={40} 
            height={40} 
            className="rounded-full"
            referrerPolicy="no-referrer"
          />
          <div>
            <h2 className="text-sm font-bold text-gray-900 leading-none">Aktif Şoför</h2>
            <p className="text-xs text-gray-500 mt-1">
              {drivers?.find(d => d.id === selectedDriverId)?.name || 'Şoför Seçilmedi'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSelectedDriverId(null)}
            className="text-xs font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors border border-blue-100"
          >
            Şoför Değiştir
          </button>
          <button
            onClick={handleLogout}
            className="text-xs font-medium text-red-600 bg-red-50 p-2 rounded-lg hover:bg-red-100 transition-colors border border-red-100 flex items-center"
            title="Güvenli Çıkış Yap"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <main className="flex-1 space-y-6 max-w-3xl mx-auto w-full">
        {isPanelPassive && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-start gap-3 shadow-sm">
            <AlertTriangle className="text-red-600 shrink-0" size={24} />
            <div>
              <h3 className="font-bold text-red-900">Dağıtım Paneli Kapalı</h3>
              <p className="text-sm text-red-800 leading-relaxed">
                Yönetim tarafından yemek dağıtım paneli geçici olarak kapatılmıştır. 
                Şu an için teslimat girişi yapamazsınız. Lütfen merkez ile iletişime geçiniz.
              </p>
            </div>
          </div>
        )}
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Toplam Yemek</p>
          <p className="text-2xl font-bold text-gray-900">{totalFood}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Toplam Ekmek</p>
          <p className="text-2xl font-bold text-gray-900">{totalBread}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Teslim Edilen</p>
          <p className="text-2xl font-bold text-green-600">{deliveredCount}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-sm text-gray-500 mb-1">Kalan Hane</p>
          <p className="text-2xl font-bold text-blue-600">{pendingCount}</p>
        </div>
      </div>

      {todayRoute.status === 'pending' && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Dağıtıma Başla</h3>
          <div className="max-w-xs mx-auto space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 text-left mb-1">Başlangıç KM</label>
              <input
                type="number"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-lg border p-3"
                placeholder="Örn: 125000"
              />
            </div>
            <button
              onClick={handleStartRoute}
              disabled={isSaving || isDemo}
              className={`w-full px-4 py-3 rounded-md font-medium text-lg ${
                isDemo ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {isDemo ? 'Demo Modunda Başlatılamaz' : 'Rotayı Başlat'}
            </button>
            <button
              onClick={exportMarkingFormPDF}
              className="w-full bg-blue-50 text-blue-700 border border-blue-200 px-4 py-3 rounded-md hover:bg-blue-100 font-medium text-lg flex items-center justify-center mt-2"
            >
              <FileText className="mr-2" size={20} />
              İşaretleme Formu İndir
            </button>
          </div>
        </div>
      )}

      {todayRoute.status === 'in_progress' && nextStop && nextHousehold && (
        <div className={`p-6 rounded-lg shadow-sm border transition-all ${isPausedLocal ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-xl font-bold flex items-center ${isPausedLocal ? 'text-orange-900' : 'text-blue-900'}`}>
              {isPausedLocal ? <Clock className="mr-2" /> : <MapPin className="mr-2" />}
              {isPausedLocal ? 'Mola Verildi' : 'Sıradaki Teslimat'}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTogglePause}
                className={`text-xs px-3 py-1.5 rounded-lg font-bold border transition-colors flex items-center gap-1.5 ${
                  isPausedLocal 
                    ? 'bg-white text-orange-700 border-orange-300 hover:bg-orange-50 shadow-sm' 
                    : 'bg-white text-blue-700 border-blue-200 hover:bg-blue-50'
                }`}
              >
                {isPausedLocal ? (
                  <><Navigation size={14} /> Teslimata Dön</>
                ) : (
                  <><Clock size={14} /> Mola Ver</>
                )}
              </button>
              <span className={`text-xs font-bold px-3 py-1 rounded-full ${isPausedLocal ? 'bg-orange-200 text-orange-800' : 'bg-blue-200 text-blue-800'}`}>
                {nextHousehold.memberCount * (isLastWorkingDay ? 2 : 1)} Yemek / {(nextStop.householdSnapshotBreadCount ?? nextHousehold.breadCount ?? nextHousehold.memberCount) * (isLastWorkingDay ? 2 : 1)} Ekmek
              </span>
            </div>
          </div>
          
          {isPausedLocal ? (
            <div className="bg-white p-6 rounded-md mb-6 text-center shadow-inner border border-orange-100">
               <p className="text-orange-900 font-bold text-lg italic">Şu an mola modundasınız.</p>
               <p className="text-orange-700 mt-2 text-sm italic">Teslimatlara devam etmek için &quot;Teslimata Dön&quot; butonuna tıklayınız.</p>
            </div>
          ) : (
            <div className="bg-white p-4 rounded-md mb-6 shadow-sm border border-blue-100">
              <p className="font-bold text-lg text-gray-900">{nextHousehold.headName}</p>
              <p className="text-gray-600 mt-1">{nextHousehold.address}</p>
              <p className="text-gray-800 font-medium mt-2">Tel: {nextHousehold.phone}</p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setConfirmAction({ type: 'delivered', stopId: nextStop.id! })}
              disabled={isPanelPassive || isDemo || isPausedLocal}
              className={`flex-1 px-4 py-4 rounded-md font-medium text-lg flex items-center justify-center transition-colors ${
                isPanelPassive || isDemo || isPausedLocal ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300' : 'bg-green-600 text-white hover:bg-green-700 shadow-md'
              }`}
            >
              <CheckCircle className="mr-2" />
              {isPausedLocal ? 'Mola Devam Ediyor' : 'Teslim Edildi'}
            </button>
            <button
              onClick={() => setActiveStopId(nextStop.id!)}
              disabled={isPanelPassive || isDemo || isPausedLocal}
              className={`flex-1 px-4 py-4 rounded-md font-medium text-lg flex items-center justify-center transition-colors ${
                isPanelPassive || isDemo || isPausedLocal ? 'bg-gray-200 text-gray-400 cursor-not-allowed border border-gray-300' : 'bg-red-600 text-white hover:bg-red-700 shadow-md'
              }`}
            >
              <XCircle className="mr-2" />
              {isPausedLocal ? 'Mola Devam Ediyor' : 'Teslim Edilemedi'}
            </button>
          </div>

          {activeStopId === nextStop.id && (
            <div className="mt-4 bg-white p-4 rounded-md border border-red-200">
              <label className="block text-sm font-medium text-gray-700 mb-2">Sorun Bildir (Neden teslim edilemedi?)</label>
              <textarea
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm border p-2 mb-3"
                rows={3}
                placeholder="Örn: Evde yoktular, adres yanlış..."
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setActiveStopId(null)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
                >
                  İptal
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'failed', stopId: nextStop.id! })}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  Kaydet ve Geç
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {todayRoute.status === 'in_progress' && !nextStop && (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">Tüm teslimatlar tamamlandı!</h3>
          <p className="text-gray-500 mb-6">Lütfen gün sonu bilgilerini girerek rotayı bitirin.</p>
          
          <div className="max-w-md mx-auto space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Bitiş KM</label>
              <input
                type="number"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-lg border p-3"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Otomatik Kalan Yemek</label>
                <input
                  type="text"
                  disabled
                  value={autoRemainingFood}
                  className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-lg border p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ekstra Kalan Yemek</label>
                <input
                  type="number"
                  value={extraFood}
                  onChange={(e) => setExtraFood(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-lg border p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Otomatik Kalan Ekmek</label>
                <input
                  type="text"
                  disabled
                  value={autoRemainingBread}
                  className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm sm:text-lg border p-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ekstra Kalan Ekmek</label>
                <input
                  type="number"
                  value={extraBread}
                  onChange={(e) => setExtraBread(e.target.value)}
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-lg border p-3"
                />
              </div>
            </div>
            {(!isDemo && (safeFormat(new Date(), 'yyyy-MM-dd') > todayRoute.date || new Date().getHours() >= 11)) ? (
              <button
                onClick={handleEndRoute}
                className="w-full px-4 py-3 rounded-md font-medium text-lg mt-4 bg-green-600 text-white hover:bg-green-700 shadow-sm"
              >
                Günü Tamamla
              </button>
            ) : !isDemo && (
              <div className="w-full px-4 py-3 rounded-md font-medium text-lg mt-4 bg-gray-50 text-gray-500 border-2 border-dashed border-gray-300 text-center">
                {safeFormat(new Date(), 'yyyy-MM-dd') === todayRoute.date ? 'Saat 11:00\'den Sonra Tamamlanabilir' : 'Bu Rota Gelecek Tarihlidir'}
              </div>
            )}
            
            {isDemo && (
              <button
                disabled
                className="w-full px-4 py-3 rounded-md font-medium text-lg mt-4 bg-gray-300 text-gray-500 cursor-not-allowed"
              >
                Demo Modunda Tamamlanamaz
              </button>
            )}
          </div>
        </div>
      )}

      {todayRoute.status === 'completed' && (
        <div className="bg-green-50 p-8 rounded-lg shadow-sm border border-green-200 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-10 w-10 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-900 mb-2">Bugünkü göreviniz tamamlandı.</h2>
          <p className="text-green-700">Elinize sağlık!</p>
          <button 
            onClick={() => setSelectedDriverId(null)}
            className="mt-6 text-green-700 hover:text-green-900 font-medium underline"
          >
            Çıkış Yap
          </button>
        </div>
      )}

      {/* Route List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900">Tüm Rota Listesi</h3>
        </div>
        <ul className="divide-y divide-gray-200">
          {sortedStops.map((stop: RouteStop) => {
            const household = households?.find(h => h?.id === stop.householdId);
            if (!household) return null;
            
            const isDeleted = household.pausedUntil === '9999-12-31';
            const isPaused = household.pausedUntil && household.pausedUntil >= todayRoute.date;
            const index = routeStops?.findIndex((s: RouteStop) => s.id === stop.id) ?? 0;

            return (
              <li key={stop.id} className={`p-4 ${
                isDeleted ? 'bg-red-50' : 
                isPaused ? 'bg-orange-50' : 
                stop.status === 'pending' ? 'bg-white' : 'bg-gray-50'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium
                      ${isDeleted ? 'bg-red-200 text-red-800' :
                        isPaused ? 'bg-orange-200 text-orange-800' :
                        stop.status === 'delivered' ? 'bg-green-100 text-green-600' : 
                        stop.status === 'failed' ? 'bg-red-100 text-red-600' : 
                        'bg-gray-200 text-gray-600'}`}
                    >
                      {index + 1}
                    </div>
                    <div className="ml-4">
                      <p className={`text-sm font-medium ${
                        isDeleted ? 'text-red-900 font-bold' :
                        isPaused ? 'text-orange-900 font-bold' :
                        stop.status === 'pending' ? 'text-gray-900' : 'text-gray-500 line-through'
                      }`}>
                        {household.headName}
                        {isDeleted && <span className="ml-2 text-xs uppercase">[SİLİNDİ]</span>}
                        {isPaused && <span className="ml-2 text-xs uppercase">[PASİF]</span>}
                      </p>
                      <p className="text-sm text-gray-500">{household.address}</p>
                      {stop.issueReport && (
                        <p className="text-xs text-red-500 mt-1 flex items-center">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {stop.issueReport}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-1 ${
                      isDeleted ? 'bg-red-100 text-red-800' :
                      isPaused ? 'bg-orange-100 text-orange-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {household.memberCount * (isLastWorkingDay ? 2 : 1)} Y / {(stop.householdSnapshotBreadCount ?? household.breadCount ?? household.memberCount) * (isLastWorkingDay ? 2 : 1)} E
                    </span>
                    {stop.status !== 'pending' && todayRoute.status === 'in_progress' && !isDeleted && !isPaused && !isDemo && (
                      <button
                        onClick={() => { setEditingPastStopId(stop.id!); setIssueText(''); setActiveStopId(null); }}
                        className="text-blue-600 hover:text-blue-800 text-xs font-medium underline"
                      >
                        Düzenle
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Edit Past Stop Modal */}
      {editingPastStopId && (() => {
        const stop = routeStops?.find((s: RouteStop) => s.id === editingPastStopId);
        const household = households?.find((h: Household | null) => h?.id === stop?.householdId);
        if (!stop || !household) return null;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-gray-900">Teslimat Düzenle</h3>
                <button onClick={() => { setEditingPastStopId(null); setIssueText(''); setActiveStopId(null); }} className="text-gray-400 hover:text-gray-500">
                  <XCircle size={24} />
                </button>
              </div>
              
              <div className="mb-4">
                <p className="font-bold text-gray-900">{household.headName}</p>
                <p className="text-sm text-gray-500">{household.address}</p>
              </div>

              <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-700 mb-2">İşlem Geçmişi</h4>
                <div className="bg-gray-50 rounded-md p-3 space-y-2 text-sm max-h-40 overflow-y-auto">
                  {stop.history && stop.history.length > 0 ? stop.history.map((h: any, i: number) => (
                    <div key={i} className="border-b border-gray-200 last:border-0 pb-2 last:pb-0">
                      <span className="text-gray-500">{safeFormat(new Date(h.timestamp), 'dd.MM.yyyy HH:mm')}</span> - 
                      <span className={`ml-2 font-medium ${h.status === 'delivered' ? 'text-green-600' : 'text-red-600'}`}>
                        {h.status === 'delivered' ? 'Teslim Edildi' : 'Edilemedi'}
                      </span>
                      {h.note && <p className="text-gray-600 mt-1 text-xs">Açıklama: {h.note}</p>}
                    </div>
                  )) : (
                    <div className="border-b border-gray-200 pb-2">
                      <span className="text-gray-500">{stop.deliveredAt ? safeFormat(new Date(stop.deliveredAt), 'dd.MM.yyyy HH:mm') : '-'}</span> - 
                      <span className={`ml-2 font-medium ${stop.status === 'delivered' ? 'text-green-600' : 'text-red-600'}`}>
                        {stop.status === 'delivered' ? 'Teslim Edildi' : 'Edilemedi'}
                      </span>
                      {stop.issueReport && <p className="text-gray-600 mt-1 text-xs">Açıklama: {stop.issueReport}</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setConfirmAction({ type: 'delivered', stopId: stop.id! })}
                  className="w-full bg-green-600 text-white px-4 py-3 rounded-md hover:bg-green-700 font-medium flex items-center justify-center"
                >
                  <CheckCircle className="mr-2" />
                  Teslim Edildi Olarak Değiştir
                </button>
                
                {activeStopId === stop.id ? (
                  <div className="bg-red-50 p-3 rounded-md border border-red-200 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Neden teslim edilemedi?</label>
                    <textarea
                      value={issueText}
                      onChange={(e) => setIssueText(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 sm:text-sm border p-2 mb-3"
                      rows={2}
                    ></textarea>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setActiveStopId(null)} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded-md text-sm">İptal</button>
                      <button onClick={() => setConfirmAction({ type: 'failed', stopId: stop.id! })} className="px-3 py-1.5 bg-red-600 text-white rounded-md text-sm">Kaydet</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveStopId(stop.id!); setIssueText(''); }}
                    className="w-full bg-red-600 text-white px-4 py-3 rounded-md hover:bg-red-700 font-medium flex items-center justify-center"
                  >
                    <XCircle className="mr-2" />
                    Teslim Edilemedi Olarak Değiştir
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full p-6 text-center">
            <div className={`mx-auto flex items-center justify-center h-12 w-12 rounded-full mb-4 ${confirmAction.type === 'delivered' ? 'bg-green-100' : 'bg-red-100'}`}>
              {confirmAction.type === 'delivered' ? (
                <CheckCircle className="h-6 w-6 text-green-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-red-600" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">İşlemi Onaylayın</h3>
            <p className="text-sm text-gray-500 mb-6">
              {confirmAction.type === 'delivered' 
                ? 'Bu haneye teslimat yapıldığını onaylıyor musunuz?' 
                : 'Bu haneye teslimat yapılamadığını onaylıyor musunuz?'}
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 font-medium"
              >
                İptal
              </button>
              <button
                onClick={() => {
                  updateStopStatus(confirmAction.stopId, confirmAction.type);
                  setConfirmAction(null);
                }}
                className={`px-4 py-2 text-white rounded-md font-medium ${confirmAction.type === 'delivered' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
              >
                Evet, Onaylıyorum
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
