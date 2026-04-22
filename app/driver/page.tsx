'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Route, RouteStop, Household } from '@/lib/db';
import { generateRouteFromTemplate, getNextWorkingDay, checkAndGenerateNextDayRoutes } from '@/lib/route-utils';
import { safeFormat } from '@/lib/date-utils';
import { getTurkishPdf, addVakifLogo } from '@/lib/pdfUtils';
import autoTable from 'jspdf-autotable';
import { CheckCircle, XCircle, AlertTriangle, Navigation, MapPin, LogOut, Clock, FileText, Wifi, WifiOff, RefreshCw, Info, User, Phone, Edit2, X } from 'lucide-react';
import { toast } from 'sonner';
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/components/AuthProvider';
import { localDb } from '@/lib/local-db';
import { safeFormatTRT } from '@/lib/date-utils';

export default function DriverPage() {
  const { user, role } = useAuth();
  const isDemo = role === 'demo';
  const router = useRouter();
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
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
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [offlineUpdates, setOfflineUpdates] = useState<any[]>([]);
  const [currentCoords, setCurrentCoords] = useState<{lat: number, lng: number} | null>(null);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown');

  const checkLocationPermission = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationPermission('denied');
      return;
    }
    
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const result = await navigator.permissions.query({ name: 'geolocation' });
        setLocationPermission(result.state);
        result.onchange = () => {
          setLocationPermission(result.state);
        };
      } catch (e) {
        console.error("Permission query error:", e);
        setLocationPermission('unknown');
      }
    } else {
      // Fallback
      navigator.geolocation.getCurrentPosition(
        () => setLocationPermission('granted'),
        (err) => {
          if (err.code === 1) setLocationPermission('denied'); // 1 is PERMISSION_DENIED
          else setLocationPermission('prompt');
        },
        { timeout: 2000 }
      );
    }
  }, []);

  useEffect(() => {
    checkLocationPermission();
  }, [checkLocationPermission]);

  const requestLocationPermission = async () => {
    const loadingToast = toast.loading('Konum izni isteniyor...');
    try {
      await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(err),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
      setLocationPermission('granted');
      toast.success('Konum izni başarıyla alındı.', { id: loadingToast });
    } catch (error: any) {
      console.error("Permission request error:", error);
      if (error.code === 1) { // PERMISSION_DENIED
        setLocationPermission('denied');
        toast.error('Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.', { id: loadingToast });
      } else {
        toast.error('Konum alınamadı. Lütfen GPS\'inizi kontrol edin.', { id: loadingToast });
      }
    }
  };

  // Helper to get current location
  const getCurrentLocation = useCallback((): Promise<{lat: number, lng: number} | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Geolocation error:", error);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    });
  }, []);

  const drivers = useAppQuery(() => db.drivers.filter(d => !!d.isActive).toArray(), [], 'drivers');
  const systemSettings = useAppQuery(() => db.system_settings.get('global'), [], 'system_settings');
  const today = safeFormatTRT(new Date(), 'yyyy-MM-dd');
  
  const currentDriver = useMemo(() => drivers?.find(dr => dr.id === selectedDriverId), [drivers, selectedDriverId]);
  const driverName = currentDriver?.name || 'Bilinmeyen Şoför';

  const [showLocationPrompt, setShowLocationPrompt] = useState(false);

  // Sync geolocation permission
  useEffect(() => {
    if (!currentDriver || isDemo) return;

    const checkPerms = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'geolocation' });
          if ((currentDriver as any).locationPermissionStatus !== result.state) {
            await db.drivers.update(currentDriver.id!, { locationPermissionStatus: result.state as any });
          }

          result.onchange = async () => {
             await db.drivers.update(currentDriver.id!, { locationPermissionStatus: result.state as any });
          };
        } else if (navigator.geolocation) {
           // Fallback for warming up and tracking if permissions API is not fully capable
           navigator.geolocation.getCurrentPosition(
             async () => await db.drivers.update(currentDriver.id!, { locationPermissionStatus: 'granted' }), 
             async () => await db.drivers.update(currentDriver.id!, { locationPermissionStatus: 'denied' })
           );
        }
      } catch (e) {
        console.error("Permission check failed:", e);
      }
    };
    checkPerms();
  }, [currentDriver, isDemo]);

  useEffect(() => {
     const isPending = (currentDriver as any)?.locationPermissionRequestPending;
     if (currentDriver && isPending) {
        setShowLocationPrompt(true);
     } else {
        setShowLocationPrompt(false);
     }
  }, [currentDriver]);

  const handleAcceptLocation = () => {
     if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
             toast.success("Konum izni başarıyla alındı.");
             if (currentDriver?.id) {
               await db.drivers.update(currentDriver.id, { 
                 locationPermissionStatus: 'granted', 
                 locationPermissionRequestPending: false 
               });
             }
             setShowLocationPrompt(false);
          },
          async (err) => {
             toast.error("Konum izni reddedildi. Lütfen tarayıcı ayarlarından izin verin.");
             if (currentDriver?.id) {
               await db.drivers.update(currentDriver.id, { 
                 locationPermissionStatus: 'denied', 
                 locationPermissionRequestPending: false 
               });
             }
             setShowLocationPrompt(false);
          }
        );
     }
  };

  const syncOfflineData = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;
    
    try {
      const updates = await localDb.offlineUpdates.toArray();
      if (updates.length === 0) {
        setOfflineUpdates([]);
        return;
      }

      setIsSyncing(true);
      for (const update of updates) {
        try {
          const stop = await db.routeStops.get(update.stopId);
          if (stop) {
            const newHistory = stop.history || [];
            newHistory.push({
              status: update.status,
              timestamp: new Date(update.deliveredAt),
              note: update.issueReport || (update.lat ? `Konum kaydedildi: ${update.lat}, ${update.lng}` : 'Çevrimdışı işlendi ve senkronize edildi'),
              personnelName: driverName
            });

            await db.routeStops.update(stop.id!, {
              status: update.status,
              deliveredAt: new Date(update.deliveredAt),
              issueReport: update.issueReport,
              history: newHistory,
              lat: update.lat,
              lng: update.lng
            });
          }
          await localDb.offlineUpdates.delete(update.id!);
        } catch (innerError) {
          console.error('Error syncing single update:', innerError);
        }
      }
      
      const remaining = await localDb.offlineUpdates.toArray();
      setOfflineUpdates(remaining);
      if (remaining.length === 0) {
        toast.success('Tüm veriler başarıyla senkronize edildi.');
      }
    } catch (error) {
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
      notifyDbChange('route_stops');
    }
  }, [isSyncing, driverName]);

  // Auto-detect or load driver from localStorage
  useEffect(() => {
    const detectDriver = async () => {
      // 1. Check local storage first for persistence
      const savedId = localStorage.getItem('last_driver_id');
      
      if (user?.email && drivers && drivers.length > 0) {
        const matchingDriver = drivers.find(d => d.googleEmail?.toLowerCase() === user.email?.toLowerCase());
        
        if (matchingDriver) {
          if (selectedDriverId !== matchingDriver.id!) {
            setSelectedDriverId(matchingDriver.id!);
            localStorage.setItem('last_driver_id', matchingDriver.id!);
            toast.success(`Hoş geldiniz, ${matchingDriver.name}`);
          }
        } else if (savedId && !selectedDriverId) {
          // If not matching by email (e.g. admin spoofing), but we have a saved ID
          setSelectedDriverId(savedId);
        }
      }
    };
    detectDriver();
  }, [user, drivers, selectedDriverId]);

  // Persist selectedDriverId manually when changed
  const handleSetDriverId = (id: string | null) => {
    setSelectedDriverId(id);
    if (id) localStorage.setItem('last_driver_id', id);
    else localStorage.removeItem('last_driver_id');
  };

  // Sync paused state from DB
  useEffect(() => {
    if (todayRoute) {
      setIsPausedLocal(!!todayRoute.isPaused);
    }
  }, [todayRoute]);

  // Offline/Online Status & Sync Logic
  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      toast.info('Bağlantı geri geldi, veriler senkronize ediliyor...');
      syncOfflineData();
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Bağlantı koptu, veriler yerel belleğe kaydedilecek.');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial sync check
    syncOfflineData();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineData]);

  // Load offline updates into local state for UI merging
  useEffect(() => {
    const loadOffline = async () => {
      const updates = await localDb.offlineUpdates.toArray();
      setOfflineUpdates(updates);
    };
    loadOffline();
  }, []);

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
      const currentMinute = now.getMinutes();
      const isPast1730 = currentHour > 17 || (currentHour === 17 && currentMinute >= 30);

      try {
        // Sync first if past 17:30 to ensure client's local work is preserved before auto-completion
        if (isPast1730 && navigator.onLine) {
          await syncOfflineData();
        }

        // 1. Check expired pauses and activate them
        const expired = await db.households.where('isActive').equals(0).toArray() // isActive is boolean but stored as 0/1 usually, but filter check is safer
          .then(list => list.filter(h => h.pausedUntil && h.pausedUntil !== '9999-12-31' && h.pausedUntil < todayStr));
        for (const h of expired) {
          await db.households.update(h.id!, {
            isActive: true,
            pausedUntil: '',
            history: [...(h.history || []), {
              action: 'activated',
              timestamp: new Date(),
              note: 'Pasif süresi dolduğu için otomatik aktifleştirildi',
              personnelName: 'Sistem (Otomatik)'
            }]
          });
        }

        // 2. Auto-complete past routes
        const pendingRoutes = await db.routes.where('status').anyOf(['pending', 'in_progress']).toArray();
        
        for (const route of pendingRoutes) {
          const isPastDay = route.date < todayStr;
          const isTodayPast1730 = route.date === todayStr && isPast1730;
          
          if (isPastDay || isTodayPast1730) {
            const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
            for (const stop of stops) {
              if (stop.status === 'pending') {
                await db.routeStops.update(stop.id!, {
                  status: 'delivered',
                  deliveredAt: new Date(),
                  history: [...(stop.history || []), { 
                    status: 'delivered', 
                    timestamp: new Date(), 
                    note: 'Otomatik tamamlandı (Saat 17:30 sonrası)',
                    personnelName: 'Sistem (Otomatik)' 
                  }]
                });
              }
            }
            await db.routes.update(route.id!, {
              status: 'completed',
              endKm: route.startKm || 0,
              remainingFood: 0,
              remainingBread: 0,
              history: [...(route.history || []), { 
                action: 'auto_completed', 
                timestamp: new Date(), 
                note: 'Saat 17:30 sonrası otomatik tamamlandı',
                personnelName: 'Sistem (Otomatik)'
              }]
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
  }, [isDemo, syncOfflineData]);

  // Fetch route when driver is selected
  useEffect(() => {
    const fetchRoute = async () => {
      if (selectedDriverId) {
        setLoadingRoute(true);
        try {
          const now = new Date();
          const todayStr = safeFormat(now, 'yyyy-MM-dd');

          // 1. Check for any "in_progress" route first (resume capability)
          const driverRoutes = await db.routes.where('driverId').equals(selectedDriverId).toArray();
          const inProgressRoute = driverRoutes.find(r => r.status === 'in_progress');
          
          if (inProgressRoute) {
            setTodayRoute(inProgressRoute);
            return;
          }

          // 2. Check for today's route (even if pending or completed)
          // We always prefer SHOWING today's route even if it's afternoon
          const existingTodayRoute = driverRoutes.find(r => r.date === todayStr);
          if (existingTodayRoute) {
            setTodayRoute(existingTodayRoute);
            return;
          }

          // 3. If no route exists for today, let's see if we should generate it or look for tomorrow's
          const currentHour = now.getHours();
          const currentMinute = now.getMinutes();
          
          let targetDateStr = todayStr;
          // If it's late afternoon (past 15:00) and no route exists for today, maybe we look for tomorrow
          if (currentHour >= 15) {
            const nextWorkDay = await getNextWorkingDay(now);
            targetDateStr = safeFormat(nextWorkDay, 'yyyy-MM-dd');
          }
          
          // Try to generate if missing
          const routeId = await generateRouteFromTemplate(selectedDriverId, targetDateStr);
          if (routeId) {
             const newRoute = await db.routes.get(routeId);
             if (newRoute) {
                setTodayRoute(newRoute);
                return;
             }
          }
          
          // Last resort: find the latest route for this driver to show something
          const latestRoute = driverRoutes.sort((a, b) => b.date.localeCompare(a.date))[0];
          setTodayRoute(latestRoute || null);
        } catch (err) {
          console.error("Fetch route error:", err);
        } finally {
          setLoadingRoute(false);
        }
      }
    };
    fetchRoute();
  }, [selectedDriverId]);

  const routeStopsRaw = useAppQuery(
    async () => {
      if (!todayRoute) return [];
      const stops = await db.routeStops.where('routeId').equals(todayRoute.id!).toArray();
      return stops.sort((a: any, b: any) => a.order - b.order);
    },
    [todayRoute],
    'route_stops'
  );

  // Merge raw stops with offline updates for current UI state
  const routeStops = useMemo(() => {
    if (!routeStopsRaw) return [];
    
    // Yalnızca pasif olduğu açıkça belirtilenleri filtrele, eski kayıtların memberCount değeri olmadığı için 0 gelirse diye hepsini filtrelemeyi kaldırıyoruz
    // Şoför ekranında tüm evlerin tam görünmesi esastır
    const activeStopsRaw = routeStopsRaw;
    
    return activeStopsRaw.map((stop: RouteStop) => {
      const offline = offlineUpdates.find(u => u.stopId === stop.id);
      if (offline) {
        return {
          ...stop,
          status: offline.status,
          deliveredAt: new Date(offline.deliveredAt),
          issueReport: offline.issueReport
        };
      }
      return stop;
    });
  }, [routeStopsRaw, offlineUpdates]);

  const households = useAppQuery(
    async () => {
      if (!routeStopsRaw || routeStopsRaw.length === 0) return [];
      const householdIds = routeStopsRaw.map((rs: RouteStop) => rs.householdId).filter(id => !!id) as string[];
      if (householdIds.length === 0) return [];
      
      // Bulk fetch households to avoid N+1 query problem using parallel requests
      const householdPromises = householdIds.map(id => db.households.get(id));
      const results = await Promise.all(householdPromises);
      return results.filter(h => !!h) as Household[];
    },
    [routeStopsRaw],
    'households'
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
    if (!todayRoute || todayRoute.driverId === 'vakif_pickup') return;
    setIsSaving(true);
    const newPausedState = !isPausedLocal;
    try {
      const now = new Date();
      const newHistory = [...(todayRoute.history || [])];
      newHistory.push({
        action: newPausedState ? 'paused' : 'resumed',
        timestamp: now,
        note: newPausedState ? 'Şoför mola verdi' : 'Şoför moladan döndü'
      });

      await db.routes.update(todayRoute.id!, {
        isPaused: newPausedState,
        history: newHistory
      });
      setIsPausedLocal(newPausedState);
      setTodayRoute({ ...todayRoute, isPaused: newPausedState, history: newHistory });
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
    if (confirm('Günü tamamlamak istediğinize emin misiniz? Bekleyen adresler otomatik olarak "Teslim Edildi" işaretlenecektir.')) {
      if (offlineUpdates.length > 0) {
        if (navigator.onLine) {
          toast.info('Bekleyen veriler senkronize ediliyor...');
          await syncOfflineData();
        } else {
          toast.error('İnternet bağlantısı olmadan günü bitiremezsiniz. Lütfen bağlantı sağlayın.');
          return;
        }
      }

      setIsSaving(true);
      const loadingToast = toast.loading('Günü tamamlanıyor...');
      try {
        const totalRemainingFood = autoRemainingFood + Number(extraFood);
        const totalRemainingBread = autoRemainingBread + Number(extraBread);

        // Fetch remaining points that are still "pending" (bekliyor) and update them to "delivered".
        const pendingStops = await db.routeStops.where('routeId').equals(todayRoute!.id!).toArray()
          .then((arr: RouteStop[]) => arr.filter(s => s.status === 'pending'));

        if (pendingStops.length > 0) {
          toast.info(`${pendingStops.length} adet bekleyen teslimat otomatik olarak kaydediliyor...`);
          const deliveredAt = new Date();
          for (const stop of pendingStops) {
            await db.routeStops.update(stop.id!, {
              status: 'delivered',
              deliveredAt: deliveredAt,
              history: [...(stop.history || []), { status: 'delivered', timestamp: deliveredAt, personnelName: driverName }]
            });
          }
        }

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
        notifyDbChange('route_stops');
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
    // 1. ANLIK ARAYÜZ (UI) GÜNCELLEMESİ 
    const deliveredAt = new Date();
    const issueReport = status === 'failed' ? issueText : undefined;

    // Hemen UI durumunu güncelliyoruz (Optimistic Update)
    // Not: Koordinatlar arka planda alınacağı için UI'da ilk etapta boş kalacak, bu şoförün akışını bozmaz.
    setOfflineUpdates(prev => [...prev, { stopId, status, issueReport, deliveredAt, timestamp: Date.now() }]);
    
    // Şoförün beklemesini engelleyip hemen diğer karta geçmesini sağlıyoruz.
    setIssueText('');
    setActiveStopId(null);
    setEditingPastStopId(null);
    
    // Yükleniyor gibi durduran toast yerine hızlı geri bildirim veriyoruz:
    toast.success(status === 'delivered' ? 'Teslimat kaydedildi' : 'Sorun bildirildi');

    // 2. ARKA PLAN (BACKGROUND) İŞLEMLERİ
    (async () => {
      try {
        // Koordinatları ARKA PLANDA al (UI'ı bekletmez)
        const coords = await getCurrentLocation();

        // Her ihtimale karşı (Offline desteği) local veritabanına at
        await localDb.offlineUpdates.add({
          stopId,
          status,
          issueReport,
          deliveredAt,
          timestamp: Date.now(),
          lat: coords?.lat,
          lng: coords?.lng
        });

        // Online isek, arka planda MongoDB sunucu güncellemesini yap
        if (navigator.onLine) {
          const stop = await db.routeStops.get(stopId);
          if (!stop) return; // Durak yoksa (silinmişse vb.) işlem yapma
          
          const newHistory = stop.history || [];
          newHistory.push({
            status,
            timestamp: deliveredAt,
            note: issueReport || (coords ? `Konum kaydedildi: ${coords.lat}, ${coords.lng}` : undefined),
            personnelName: driverName
          });

          // Sunucu güncellemesi
          await db.routeStops.update(stop.id!, {
            status,
            deliveredAt,
            issueReport,
            history: newHistory,
            lat: coords?.lat,
            lng: coords?.lng
          });

          // Başarılı sunucu işleminden sonra, ilgili offline kaydını yerelden sil
          const lastUpdate = await localDb.offlineUpdates.where('stopId').equals(stopId).last();
          if (lastUpdate) {
            await localDb.offlineUpdates.delete(lastUpdate.id!);
            setOfflineUpdates(prev => prev.filter(u => u.stopId !== stopId));
          }
          notifyDbChange('route_stops');
        }
      } catch (error) {
        console.error('Arka plan veritabanı güncelleme hatası:', error);
      }
    })();
  };

  const exportMarkingFormPDF = async () => {
    if (!todayRoute) return;
    
    const doc = await getTurkishPdf('portrait');
    
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
      const household = households?.find((h: Household) => h.id === stop.householdId);
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
      alternateRowStyles: { fillColor: [248, 250, 252] },
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
    const isDriverRole = !!(user && drivers?.some(d => d.googleEmail?.toLowerCase() === user.email?.toLowerCase()));

    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-10 bg-slate-50">
        <div className="w-full max-w-sm space-y-6">
          <div className="bg-white px-6 py-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 flex flex-col items-center">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-blue-100 rounded-full blur-xl opacity-50"></div>
              <Image 
                src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
                alt="Vakıf Logosu" 
                width={90} 
                height={90} 
                className="relative rounded-full shadow-lg border-4 border-white"
                referrerPolicy="no-referrer"
              />
            </div>
            
            <div className="text-center mb-8">
              <h1 className="text-2xl font-black text-slate-800 tracking-tight">Şoför Portalı</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Sosyal Yardımlaşma ve Dayanışma Vakfı</p>
            </div>
            
            <div className="w-full space-y-4">
              <div className="space-y-1.5 text-left">
                <label className="text-sm font-bold text-slate-600 px-1">Lütfen isminizi seçiniz</label>
                <select
                  className="w-full bg-slate-50 border-0 rounded-2xl ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-blue-600 text-slate-900 text-base font-medium py-4 px-4 appearance-none shadow-sm disabled:opacity-60 disabled:bg-slate-100 transition-all"
                  onChange={(e) => handleSetDriverId(e.target.value)}
                  defaultValue=""
                  disabled={isDriverRole}
                >
                  <option value="" disabled>Şoför Seçiniz</option>
                  {drivers?.filter(d => !isDriverRole || d.googleEmail?.toLowerCase() === user?.email?.toLowerCase()).map(d => (
                    <option key={d.id} value={d.id}>{d.name} • {d.vehiclePlate}</option>
                  ))}
                </select>
              </div>

              {isDriverRole && (
                <div className="flex items-start gap-2 bg-blue-50/50 p-3 rounded-2xl border border-blue-100/50">
                  <Info size={16} className="text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-blue-800 font-medium leading-relaxed">
                    Güvenli giriş yapılmıştır. Sadece kendinize atanmış aktif rotaları görüntüleyebilirsiniz.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Active Account Info at Bottom */}
          <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                <User size={16} className="text-slate-500" />
              </div>
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mevcut Hesap</span>
                <span className="text-sm font-semibold text-slate-700 truncate">{user?.email}</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2.5 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors shrink-0"
              title="Çıkış Yap"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const isDriverRole = !!(user && drivers?.some(d => d.googleEmail?.toLowerCase() === user.email?.toLowerCase()));

  if (loadingRoute) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 bg-slate-50">
        <div className="relative">
          <div className="h-20 w-20 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
             <MapPin className="text-indigo-600 animate-pulse" size={24} />
          </div>
        </div>
        <p className="mt-6 text-sm font-bold text-slate-500 animate-pulse">Rota bilgileriniz getiriliyor...</p>
      </div>
    );
  }

  if (!todayRoute) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center text-center max-w-sm w-full">
          <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mb-6 shadow-inner">
            <MapPin className="h-10 w-10 text-slate-300" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Aktif Rota Bulunamadı</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
            Bugün için size atanmış herhangi bir dağıtım rotası görünmüyor. Lütfen yönetim birimi ile iletişime geçiniz.
          </p>
          <button 
            onClick={isDriverRole ? handleLogout : () => handleSetDriverId(null)}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {isDriverRole ? <><LogOut size={18} /> Çıkış Yap</> : 'Farklı Şoför Seç'}
          </button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isWithinWorkingHours = (currentHour > 8 || (currentHour === 8 && currentMinute >= 30)) && (currentHour < 18 || (currentHour === 18 && currentMinute <= 30));
  const isRouteToday = todayRoute.date === today;
  const isInProgress = todayRoute.status === 'in_progress';
  const isCompleted = todayRoute.status === 'completed' || todayRoute.status === 'approved';

  // Allow if: route is today, OR route is in progress, OR route is already completed (viewing mode)
  const canViewRoute = isRouteToday || isInProgress || isCompleted;

  if (!canViewRoute && !isWithinWorkingHours) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 bg-slate-50">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center text-center max-w-sm w-full">
          <div className="h-20 w-20 bg-orange-50 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-orange-50/50">
            <Clock className="h-10 w-10 text-orange-400" />
          </div>
          <h2 className="text-xl font-black text-slate-800 mb-2">Henüz Dağıtım Başlamadı</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed mb-8">
            Seçilen rota <b>{safeFormat(new Date(todayRoute.date), 'dd.MM.yyyy')}</b> tarihlidir. Dağıtım işlemleri mesai saatlerinde gerçekleştirilmektedir.
          </p>
          <button 
            onClick={isDriverRole ? handleLogout : () => handleSetDriverId(null)}
            className="w-full bg-slate-900 text-white font-bold py-4 rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
          >
            {isDriverRole ? <><LogOut size={18} /> Çıkış Yap</> : 'Geri Dön'}
          </button>
        </div>
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
    routeStops.forEach((stop: RouteStop) => {
      const household = households.find((h: Household) => h.id === stop.householdId) as Household | undefined;
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
    const hA = households?.find((h: Household) => h?.id === a.householdId);
    const hB = households?.find((h: Household) => h?.id === b.householdId);
    
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
    const h = households?.find((hh: Household) => hh?.id === rs.householdId);
    const isDeleted = h?.pausedUntil === '9999-12-31';
    const isPaused = h?.pausedUntil && h.pausedUntil >= todayRoute.date;
    return rs.status === 'pending' && !isDeleted && !isPaused;
  });
  const nextHousehold = nextStop ? (households?.find((hh: Household) => hh?.id === nextStop.householdId) as Household | null) : null;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 pb-12 font-sans selection:bg-blue-100">
      {/* Sticky Mobile App Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3 truncate">
          <Image 
            src="https://pbs.twimg.com/profile_images/1456143975845404674/xGjOJe4S_400x400.jpg" 
            alt="Vakıf Logosu" 
            width={38} 
            height={38} 
            className="rounded-full shadow-sm border border-slate-100 shrink-0"
            referrerPolicy="no-referrer"
          />
          <div className="flex flex-col truncate">
            <div className="flex items-center gap-1.5">
              <h2 className="text-[13px] font-black text-slate-900 leading-none truncate max-w-[120px] sm:max-w-xs">
                {drivers?.find(d => d.id === selectedDriverId)?.name || 'Şoför'}
              </h2>
              {isOnline ? (
                <span className="flex h-2 w-2 relative shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              ) : (
                <span className="h-2 w-2 rounded-full bg-red-500 relative shrink-0"></span>
              )}
            </div>
            <p className="text-[11px] font-semibold text-slate-500 mt-0.5 uppercase tracking-wide truncate">
              {drivers?.find(d => d.id === selectedDriverId)?.vehiclePlate || 'SYDV ROTA'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          {locationPermission === 'granted' && (
            <div className="flex items-center gap-1 bg-green-50 text-green-600 text-[10px] px-2 py-1 rounded-full font-bold border border-green-100">
              <MapPin size={10} />
              Konum OK
            </div>
          )}
          {offlineUpdates.length > 0 && (
            <div className="flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] px-2 py-1 rounded-full font-bold shadow-sm">
              <RefreshCw size={10} className={isSyncing ? "animate-spin" : ""} />
              {offlineUpdates.length}
            </div>
          )}
          {!isDriverRole && (
            <button
              onClick={() => handleSetDriverId(null)}
              className="text-[11px] font-bold uppercase tracking-wide text-slate-600 bg-slate-100 px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Değiştir
            </button>
          )}
          <button
            onClick={handleLogout}
            className="h-9 w-9 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center border border-red-100/50"
            title="Güvenli Çıkış"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {locationPermission !== 'granted' && (
        <div className="mx-4 mt-6 bg-indigo-600 rounded-2xl p-4 shadow-lg shadow-indigo-200 animate-in fade-in slide-in-from-top-4 duration-500 overflow-hidden relative">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <MapPin size={80} />
           </div>
           <div className="flex items-center justify-between gap-4 relative z-10">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-white/20 rounded-xl">
                    <MapPin size={24} className="text-white animate-bounce" />
                 </div>
                 <div>
                    <h4 className="text-white font-bold text-sm italic tracking-tight leading-none">Konum Hizmeti Gerekli</h4>
                    <p className="text-indigo-100 text-[10px] font-medium max-w-[180px] mt-1.5 leading-tight">Teslimat konumlarını doğrulamak için konum iznine ihtiyacımız var.</p>
                 </div>
              </div>
              <button 
                 onClick={requestLocationPermission}
                 className="bg-white text-indigo-600 px-5 py-2.5 rounded-xl text-[11px] font-black shadow-lg shadow-indigo-900/20 active:scale-95 transition-transform uppercase tracking-wider shrink-0"
              >
                 İzin Ver
              </button>
           </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-lg mx-auto px-4 pt-6 space-y-6">
        {isPanelPassive && (
          <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-4 shadow-sm">
            <div className="bg-red-100 p-2 rounded-full shrink-0 mt-0.5">
               <AlertTriangle className="text-red-600" size={20} />
            </div>
            <div>
              <h3 className="font-bold text-red-900 font-sans">Sistem Geçici Olarak Kapalı</h3>
              <p className="text-xs font-medium text-red-800 leading-relaxed mt-1">
                Yönetim tarafından dağıtım paneli durdurulmuştur. Şu an teslimat girişi yapamazsınız. Merkezle iletişime geçiniz.
              </p>
            </div>
          </div>
        )}
        
        {/* Status Overview Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-500"></div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 mt-1">Kalan Hane</p>
            <p className="text-4xl font-black text-slate-800 tracking-tight">{pendingCount}</p>
          </div>
          
          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-green-400 to-green-500"></div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 mt-1">Teslim Edilen</p>
            <p className="text-4xl font-black text-green-600 tracking-tight">{deliveredCount}</p>
          </div>
          
          <div className="col-span-2 bg-slate-900 p-4 rounded-3xl shadow-md border border-slate-800 flex items-center justify-around text-center">
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Toplam Yemek</p>
                <p className="text-xl font-black text-white">{totalFood} <span className="text-xs font-semibold text-slate-500">kişi</span></p>
             </div>
             <div className="w-px h-8 bg-slate-700"></div>
             <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Toplam Ekmek</p>
                <p className="text-xl font-black text-white">{totalBread} <span className="text-xs font-semibold text-slate-500">adet</span></p>
             </div>
          </div>
        </div>

      {todayRoute.status === 'pending' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/60 text-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-500"></div>
          <div className="bg-blue-50 h-16 w-16 mx-auto rounded-full flex items-center justify-center mb-4">
             <MapPin className="text-blue-500" size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-800 mb-2">Dağıtıma Başlayabilirsiniz</h3>
          <p className="text-sm text-slate-500 mb-6 px-4">Lütfen aracınızın başlangıç KM bilgisini girerek bugünkü rotanızı başlatın.</p>
          <div className="max-w-xs mx-auto space-y-4">
            <div className="text-left bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Başlangıç KM</label>
              <input
                type="number"
                value={startKm}
                onChange={(e) => setStartKm(e.target.value)}
                className="block w-full bg-white rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-blue-500 text-lg font-bold text-slate-800 p-3 text-center shadow-sm"
                placeholder="Örn: 125000"
              />
            </div>
            <button
              onClick={handleStartRoute}
              disabled={isSaving || isDemo}
              className={`w-full py-4 rounded-2xl font-bold text-lg shadow-md transition-all flex items-center justify-center gap-2 ${
                isDemo ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-900 text-white hover:bg-slate-800 hover:-translate-y-0.5 hover:shadow-xl'
              }`}
            >
              {isDemo ? 'Demoda Başlatılamaz' : <><Navigation size={20} /> Rotayı Başlat</>}
            </button>
            <button
              onClick={exportMarkingFormPDF}
              className="w-full bg-white text-slate-700 border border-slate-200 py-3.5 rounded-2xl hover:bg-slate-50 font-bold text-sm flex items-center justify-center shadow-sm transition-all"
            >
              <FileText className="mr-2 text-slate-400" size={18} />
              İşaretleme Formu İndir
            </button>
          </div>
        </div>
      )}

      {todayRoute.status === 'in_progress' && nextStop && nextHousehold && (
        <div className={`p-5 sm:p-6 rounded-3xl shadow-lg border transition-all ${isPausedLocal ? 'bg-white border-orange-200 shadow-orange-100/50 relative overflow-hidden' : 'bg-white border-blue-200 shadow-blue-100/50 relative overflow-hidden'}`}>
          <div className={`absolute top-0 w-full h-1.5 left-0 right-0 ${isPausedLocal ? 'bg-gradient-to-r from-orange-400 to-orange-500' : 'bg-gradient-to-r from-blue-400 to-cyan-500'}`}></div>
          
          <div className="flex items-start justify-between mb-6 pt-2">
            <div>
               <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${isPausedLocal ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                 {isPausedLocal ? <Clock size={12} /> : <MapPin size={12} />}
                 {isPausedLocal ? 'Mola Verildi' : 'Sıradaki Teslimat'}
               </div>
               
               <div className="flex gap-2">
                 <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold shadow-sm">
                   <div className="w-2 h-2 rounded-full bg-indigo-400"></div>
                   {nextHousehold.memberCount * (isLastWorkingDay ? 2 : 1)} Yemek
                 </span>
                 <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold shadow-sm">
                   <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                   {(nextStop.householdSnapshotBreadCount ?? nextHousehold.breadCount ?? nextHousehold.memberCount) * (isLastWorkingDay ? 2 : 1)} Ekmek
                 </span>
               </div>
            </div>
            
            {todayRoute?.driverId !== 'vakif_pickup' && (
              <button
                onClick={handleTogglePause}
                disabled={isPanelPassive || isDemo}
                className={`shrink-0 flex items-center justify-center h-12 w-12 rounded-2xl border-2 transition-all shadow-sm ${
                  isPausedLocal 
                    ? 'bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:scale-105' 
                    : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-orange-500 hover:border-orange-200'
                }`}
                title={isPausedLocal ? "Teslimata Dön" : "Mola Ver"}
              >
                {isPausedLocal ? <Navigation fill="currentColor" size={20} /> : <Clock size={20} />}
              </button>
            )}
          </div>
          
          {isPausedLocal ? (
            <div className="bg-orange-50/50 p-6 rounded-2xl mb-6 text-center border border-orange-100/50">
               <div className="bg-orange-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-3">
                 <Clock className="text-orange-500 h-8 w-8" />
               </div>
               <h3 className="text-orange-900 font-black text-xl mb-1 tracking-tight">Şu an mola modundasınız</h3>
               <p className="text-orange-700 text-sm font-medium leading-relaxed">Yeni teslimatlara başlamak için yukarıdaki butona tıklayarak devam edin.</p>
            </div>
          ) : (
            <div className="bg-slate-50 p-5 rounded-2xl mb-6 border border-slate-100">
              <h2 className="font-black text-2xl text-slate-800 tracking-tight leading-tight mb-2">
                 {nextHousehold.headName}
              </h2>
              <div className="flex items-start gap-2 text-slate-600 font-medium text-[15px] leading-relaxed">
                 <MapPin className="shrink-0 mt-0.5 text-slate-400" size={18} />
                 <p className="line-clamp-3">{nextHousehold.address}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200 flex items-center gap-2">
                 <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">
                    <Phone className="text-slate-500" size={14} />
                 </div>
                 <a href={`tel:${nextHousehold.phone}`} className="text-blue-600 font-bold text-lg hover:underline decoration-2 underline-offset-4">
                    {nextHousehold.phone}
                 </a>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => setConfirmAction({ type: 'delivered', stopId: nextStop.id! })}
              disabled={isPanelPassive || isDemo || isPausedLocal}
              className={`flex-1 relative overflow-hidden py-4 rounded-2xl font-black text-lg flex items-center justify-center transition-all ${
                isPanelPassive || isDemo || isPausedLocal 
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-none' 
                  : 'bg-green-500 text-white hover:bg-green-600 shadow-[0_4px_20px_-4px_rgba(34,197,94,0.4)] hover:-translate-y-0.5'
              }`}
            >
              <CheckCircle className="mr-2 h-6 w-6" />
              {isPausedLocal ? 'Mola Verildi' : 'Teslim Edildi'}
            </button>
            <button
              onClick={() => setActiveStopId(nextStop.id!)}
              disabled={isPanelPassive || isDemo || isPausedLocal}
              className={`sm:w-auto w-full px-6 py-4 rounded-2xl font-bold text-base flex items-center justify-center transition-all ${
                isPanelPassive || isDemo || isPausedLocal 
                  ? 'bg-slate-50 text-slate-300 cursor-not-allowed border-none' 
                  : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 hover:-translate-y-0.5'
              }`}
            >
              <XCircle className="mr-2 h-5 w-5" />
              Teslim Edilemedi
            </button>
          </div>

          {activeStopId === nextStop.id && (
            <div className="mt-4 bg-red-50/50 p-4 rounded-2xl border border-red-200">
              <label className="block text-xs font-bold uppercase tracking-wider text-red-800 mb-2">Kuruma İletilecek Sorun / Neden</label>
              <textarea
                value={issueText}
                onChange={(e) => setIssueText(e.target.value)}
                className="block w-full rounded-xl border-red-200 bg-white shadow-sm focus:border-red-500 focus:ring-red-500 text-sm p-3 mb-3"
                rows={3}
                placeholder="Örn: Kapıyı açmadılar, adresten taşınmışlar..."
              ></textarea>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setActiveStopId(null)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'failed', stopId: nextStop.id! })}
                  className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-sm flex items-center gap-1.5 shadow-sm"
                >
                  <XCircle size={16} /> Kaydet
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {todayRoute.status === 'in_progress' && !nextStop && (
        <div className="bg-white p-6 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/60 text-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-50 mb-4 ring-8 ring-emerald-50/50">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Görev Tamamlandı!</h3>
          <p className="text-sm font-medium text-slate-500 mb-8 px-2">Tüm teslimatlar bitti. Lütfen gün sonu bilgilerinizi girerek rotayı kapatın.</p>
          
          <div className="max-w-md mx-auto space-y-5 text-left">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5">Bitiş KM</label>
              <input
                type="number"
                value={endKm}
                onChange={(e) => setEndKm(e.target.value)}
                className="block w-full bg-white rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-emerald-500 text-lg font-bold text-slate-800 p-3 text-center shadow-sm"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-2">Kalan Yemek</label>
                <div className="flex pl-2 items-center gap-1">
                  <span className="text-xl font-black text-slate-700">{autoRemainingFood}</span>
                  <span className="text-xs font-semibold text-slate-400 mt-1">otomatik</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ekstra Kalan Yemek</label>
                <input
                  type="number"
                  value={extraFood}
                  onChange={(e) => setExtraFood(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white shadow-sm focus:border-emerald-500 text-center font-bold text-lg p-2"
                />
              </div>
              
              <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300"></div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 pl-2">Kalan Ekmek</label>
                <div className="flex pl-2 items-center gap-1">
                  <span className="text-xl font-black text-slate-700">{autoRemainingBread}</span>
                  <span className="text-xs font-semibold text-slate-400 mt-1">otomatik</span>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner">
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Ekstra Kalan Ekmek</label>
                <input
                  type="number"
                  value={extraBread}
                  onChange={(e) => setExtraBread(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white shadow-sm focus:border-emerald-500 text-center font-bold text-lg p-2"
                />
              </div>
            </div>

            <div className="pt-2">
              {(!isDemo && (safeFormatTRT(new Date(), 'yyyy-MM-dd') > todayRoute.date || new Date().getHours() >= 11)) ? (
                <button
                  onClick={handleEndRoute}
                  className="w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:-translate-y-0.5"
                >
                  Günü Tamamla ve Kapat
                </button>
              ) : !isDemo && (
                <div className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-100 text-slate-500 border border-slate-200 text-center">
                  {safeFormatTRT(new Date(), 'yyyy-MM-dd') === todayRoute.date ? 'Saat 11:00\'den Sonra Tamamlanabilir' : 'Bu Rota Gelecek Tarihlidir'}
                </div>
              )}
              
              {isDemo && (
                <button disabled className="w-full py-4 rounded-2xl font-bold text-sm bg-slate-200 text-slate-400 cursor-not-allowed">
                  Demo Modunda Tamamlanamaz
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {todayRoute.status === 'completed' && (
        <div className="bg-white p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/60 text-center relative overflow-hidden">
          <div className="absolute top-0 w-full h-1.5 bg-gradient-to-r from-teal-400 to-emerald-500"></div>
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-50 mb-6 ring-8 ring-emerald-50/50">
            <CheckCircle className="h-12 w-12 text-emerald-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Elinize Sağlık!</h2>
          <p className="text-slate-500 font-medium mb-8">Bugünkü görevlerinizi başarıyla tamamladınız. Artık çıkış yapabilirsiniz.</p>
          <button 
            onClick={isDriverRole ? handleLogout : () => handleSetDriverId(null)}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800 shadow-lg hover:-translate-y-0.5"
          >
            <LogOut size={20} />
            {isDriverRole ? 'Güvenle Çıkış Yap' : 'Farklı Bir Şoför Seç'}
          </button>
        </div>
      )}

      {/* Route List */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-800">Tüm Teslimat Listesi</h3>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 bg-white px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
            {sortedStops.length} Hane
          </span>
        </div>
        <ul className="divide-y divide-slate-100">
          {sortedStops.map((stop: RouteStop) => {
            const household = households?.find((h: Household) => h?.id === stop.householdId);
            if (!household) return null;
            
            const isDeleted = household.pausedUntil === '9999-12-31';
            const isPaused = household.pausedUntil && household.pausedUntil >= todayRoute.date;
            const index = routeStops?.findIndex((s: RouteStop) => s.id === stop.id) ?? 0;
            const isDelivered = stop.status === 'delivered';
            const isFailed = stop.status === 'failed';
            const isPending = stop.status === 'pending';

            return (
              <li key={stop.id} className={`p-4 transition-colors ${
                isDeleted ? 'bg-red-50/50' : 
                isPaused ? 'bg-orange-50/50' : 
                isPending ? 'bg-white' : 'bg-slate-50/50'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-black
                      ${isDeleted ? 'bg-red-100 text-red-600' :
                        isPaused ? 'bg-orange-100 text-orange-600' :
                        isDelivered ? 'bg-green-100 text-green-600' : 
                        isFailed ? 'bg-red-100 text-red-600' : 
                        'bg-slate-100 text-slate-500 border border-slate-200 shadow-inner'}`}
                    >
                      {isDelivered ? <CheckCircle size={16} /> : isFailed ? <XCircle size={16} /> : index + 1}
                    </div>
                    <div className="flex flex-col mt-1">
                      <p className={`text-[13px] leading-tight ${
                        isDeleted ? 'text-red-900 font-bold' :
                        isPaused ? 'text-orange-900 font-bold' :
                        isPending ? 'text-slate-900 font-bold' : 'text-slate-400 font-medium line-through decoration-slate-300'
                      }`}>
                        {household.headName}
                        {isDeleted && <span className="ml-1 text-[9px] uppercase bg-red-200 text-red-800 px-1 py-0.5 rounded leading-none border border-red-300/50">Silindi</span>}
                        {isPaused && <span className="ml-1 text-[9px] uppercase bg-orange-200 text-orange-800 px-1 py-0.5 rounded leading-none border border-orange-300/50">Pasif</span>}
                      </p>
                      <p className={`text-xs mt-1 line-clamp-2 ${isPending ? 'text-slate-500' : 'text-slate-400'}`}>
                        {household.address}
                      </p>
                      {stop.issueReport && (
                        <p className="text-[11px] font-medium text-red-600 mt-1.5 flex items-start gap-1 bg-red-50 p-1.5 rounded-lg border border-red-100">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{stop.issueReport}</span>
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2 shrink-0 pt-0.5">
                    <div className="flex flex-col gap-1 items-end">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border ${
                        isDeleted ? 'bg-white border-red-200 text-red-700' :
                        isPaused ? 'bg-white border-orange-200 text-orange-700' :
                        'bg-white border-slate-200 text-indigo-700'
                      }`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current mr-1 opacity-50"></div>
                        {household.memberCount * (isLastWorkingDay ? 2 : 1)} Yemek
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold shadow-sm border ${
                        isDeleted ? 'bg-white border-red-200 text-red-700' :
                        isPaused ? 'bg-white border-orange-200 text-orange-700' :
                        'bg-white border-slate-200 text-amber-700'
                      }`}>
                        <div className="w-1.5 h-1.5 rounded-full bg-current mr-1 opacity-50"></div>
                        {(stop.householdSnapshotBreadCount ?? household.breadCount ?? household.memberCount) * (isLastWorkingDay ? 2 : 1)} Ekmek
                      </span>
                    </div>
                    
                    {!isPending && todayRoute.status === 'in_progress' && !isDeleted && !isPaused && !isDemo && (
                      <button
                        onClick={() => { setEditingPastStopId(stop.id!); setIssueText(''); setActiveStopId(null); }}
                        className="text-blue-600 hover:text-blue-800 text-[11px] font-bold flex items-center gap-1 bg-blue-50 px-2 py-1.5 rounded-lg border border-blue-100 transition-colors mt-auto"
                      >
                        <Edit2 size={10} />
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
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-3xl max-w-sm w-full p-6 max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 transform scale-100 transition-all">
              <div className="flex justify-between items-center mb-5 border-b border-slate-100 pb-4">
                <h3 className="text-lg font-black text-slate-800">Teslimatı Düzenle</h3>
                <button onClick={() => { setEditingPastStopId(null); setIssueText(''); setActiveStopId(null); }} className="text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1.5 transition-colors">
                  <X size={18} />
                </button>
              </div>
              
              <div className="mb-5 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="font-black text-slate-800 tracking-tight leading-tight mb-1">{household.headName}</p>
                <p className="text-xs text-slate-500 font-medium leading-relaxed">{household.address}</p>
              </div>

              <div className="mb-6">
                <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-1">İşlem Geçmişi</h4>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 space-y-2.5 text-sm max-h-32 overflow-y-auto shadow-inner">
                  {stop.history && stop.history.length > 0 ? stop.history.map((h: any, i: number) => (
                    <div key={i} className="border-b border-slate-200/60 last:border-0 pb-2.5 last:pb-0">
                      <div className="flex items-center gap-2">
                         <span className="text-slate-400 font-mono text-[11px] tracking-tight">{safeFormatTRT(new Date(h.timestamp), 'dd.MM.yyyy HH:mm')}</span> 
                         <span className={`font-bold text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${h.status === 'delivered' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                           {h.status === 'delivered' ? 'Teslim' : 'Hata'}
                         </span>
                      </div>
                      {h.note && <p className="text-slate-600 mt-1.5 text-xs font-medium leading-tight">Neden: {h.note}</p>}
                    </div>
                  )) : (
                    <div className="border-b border-slate-200/60 pb-2">
                       <div className="flex items-center gap-2">
                         <span className="text-slate-400 font-mono text-[11px] tracking-tight">{stop.deliveredAt ? safeFormatTRT(new Date(stop.deliveredAt), 'dd.MM.yyyy HH:mm') : '-'}</span> 
                         <span className={`font-bold text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded border ${stop.status === 'delivered' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                           {stop.status === 'delivered' ? 'Teslim' : 'Hata'}
                         </span>
                      </div>
                      {stop.issueReport && <p className="text-slate-600 mt-1.5 text-xs font-medium leading-tight">Neden: {stop.issueReport}</p>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <button
                  onClick={() => setConfirmAction({ type: 'delivered', stopId: stop.id! })}
                  className="w-full bg-green-500 text-white py-3.5 rounded-2xl font-bold flex items-center justify-center transition-all hover:bg-green-600 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                >
                  <CheckCircle className="mr-2 shrink-0 h-5 w-5" />
                  Teslim Edildi Yap
                </button>
                
                {activeStopId === stop.id ? (
                  <div className="bg-red-50/80 p-4 rounded-2xl border border-red-200 mt-2 shadow-inner">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-red-800 mb-2">Neden teslim edilemedi?</label>
                    <textarea
                      value={issueText}
                      onChange={(e) => setIssueText(e.target.value)}
                      className="block w-full rounded-xl border border-red-200 bg-white shadow-sm focus:border-red-500 focus:ring-red-500 text-sm p-3 mb-3 font-medium transition-colors"
                      rows={2}
                      placeholder="Gerekçeyi yazın..."
                    ></textarea>
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setActiveStopId(null)} className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold text-xs transition-colors">İptal</button>
                      <button onClick={() => setConfirmAction({ type: 'failed', stopId: stop.id! })} className="px-5 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 font-bold text-xs shadow-sm shadow-red-300">Kaydet</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setActiveStopId(stop.id!); setIssueText(''); }}
                    className="w-full bg-red-50 text-red-600 border border-red-200 py-3.5 rounded-2xl font-bold flex items-center justify-center transition-all hover:bg-red-100"
                  >
                    <XCircle className="mr-2 shrink-0 h-5 w-5" />
                    Teslim Edilemedi Yap
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl max-w-xs w-full p-6 text-center shadow-2xl border border-slate-200 transform transition-all scale-100">
            <div className={`mx-auto flex items-center justify-center h-16 w-16 mb-4 relative`}>
              <div className={`absolute inset-0 rounded-full opacity-20 ${confirmAction.type === 'delivered' ? 'bg-green-500 blur-md' : 'bg-red-500 blur-md'}`}></div>
              <div className={`relative flex items-center justify-center h-16 w-16 rounded-full border-4 border-white shadow-sm ${confirmAction.type === 'delivered' ? 'bg-green-100' : 'bg-red-100'}`}>
                 {confirmAction.type === 'delivered' ? (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                 ) : (
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                 )}
              </div>
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">İşlemi Onayla</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6 px-2">
              {confirmAction.type === 'delivered' 
                ? 'Bu hane için yemeğin teslim edildiğini onaylıyor musunuz?' 
                : 'Bu hane için yemeğin teslim edilemediğini onaylıyor musunuz?'}
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-2.5">
              <button
                onClick={() => setConfirmAction(null)}
                className="w-full sm:w-auto px-5 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 font-bold transition-all shadow-sm"
              >
                Vazgeç
              </button>
              <button
                onClick={() => {
                  updateStopStatus(confirmAction.stopId, confirmAction.type);
                  setConfirmAction(null);
                }}
                className={`w-full sm:w-auto px-6 py-3 text-white rounded-xl font-bold transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 ${confirmAction.type === 'delivered' ? 'bg-green-500 hover:bg-green-600 shadow-green-600/20' : 'bg-red-600 hover:bg-red-700 shadow-red-600/20'}`}
              >
                Evet, Onayla
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showLocationPrompt && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative animate-in zoom-in-95 duration-300">
            <div className="mx-auto w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 ring-8 ring-blue-50/50">
              <MapPin className="h-8 w-8 text-blue-500" />
            </div>
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Konum İzni Gerekli</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed mb-6">
              Sistem yöneticiniz takibi sağlayabilmek için konum iznine ihtiyaç duyuyor. Lütfen konum erişimine izin verin.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleAcceptLocation}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold transition-all shadow-md hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5"
              >
                Konuma İzin Ver
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}
