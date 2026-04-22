'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Route, RouteStop, Household, RouteTemplateStop, RouteTemplate, SystemLog } from '@/lib/db';
import { generateRouteFromTemplate, getNextWorkingDay, checkAndGenerateNextDayRoutes, isLastWorkingDayOfWeek } from '@/lib/route-utils';
import { calculateBreadForNextDay } from '@/lib/breadUtils';
import { Plus, Edit2, Trash2, X, Clock, Eye, FileText, History, Download, ArrowRight, AlertTriangle, CheckCircle, BarChart3, Info, Navigation, MapPin, Users, ShoppingBasket } from 'lucide-react';
import { format, subMonths, startOfDay, differenceInDays, addDays, startOfWeek } from 'date-fns';
import { getTurkishPdf, addVakifLogo, addReportFooter } from '@/lib/pdfUtils';
import { safeFormat, safeFormatTRT } from '@/lib/date-utils';
import { normalizeTurkish } from '@/lib/utils';
import autoTable from 'jspdf-autotable';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { addSystemLog } from '@/lib/logger';

export default function RoutesPage() {
  const { user, role, personnel } = useAuth();
  const isDemo = role === 'demo';
  const [activeTab, setActiveTab] = useState<'daily' | 'templates'>('daily');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RouteTemplate | null>(null);
  const [viewRouteDetails, setViewRouteDetails] = useState<Route | null>(null);
  const [isEditingRouteDetails, setIsEditingRouteDetails] = useState(false);
  const [editRouteData, setEditRouteData] = useState<Partial<Route>>({});
  const [editRouteStopsData, setEditRouteStopsData] = useState<RouteStop[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | ''>('');
  const [selectedDate, setSelectedDate] = useState(() => {
    // Initial guess, will be refined in useEffect based on routes
    const now = new Date();
    return safeFormat(now, 'yyyy-MM-dd');
  });
  
  // Track if we have already auto-selected the date to prevent infinite re-renders
  const [hasAutoSelectedDate, setHasAutoSelectedDate] = useState(false);

  const [selectedHouseholds, setSelectedHouseholds] = useState<{ householdId: string, order: number }[]>([]);
  const [routeDetailsStops, setRouteDetailsStops] = useState<RouteStop[]>([]);
  
  // Template modal search and sort state
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');
  const [templateSortField, setTemplateSortField] = useState<'headName' | 'address'>('headName');
  const [templateSortOrder, setTemplateSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Daily modal search and sort state
  const [dailySearchTerm, setDailySearchTerm] = useState('');
  const [dailySortField, setDailySortField] = useState<'headName' | 'address'>('headName');
  const [dailySortOrder, setDailySortOrder] = useState<'asc' | 'desc'>('asc');
  
  const [isLeftoverModalOpen, setIsLeftoverModalOpen] = useState(false);
  const [routeForLeftover, setRouteForLeftover] = useState<Route | null>(null);
  const [manualLeftoverBread, setManualLeftoverBread] = useState<number>(0);
  const [leftoverStops, setLeftoverStops] = useState<RouteStop[]>([]);
  const [isManualCompletion, setIsManualCompletion] = useState(true);
  const [mapModalData, setMapModalData] = useState<{ lat: number, lng: number, title: string } | null>(null);
  
  const routes = useAppQuery(() => db.routes.toArray(), [], 'routes');
  
  // Auto-select the target viewing date when routes load
  useEffect(() => {
    if (routes && routes.length > 0 && !hasAutoSelectedDate) {
      const today = new Date();
      const todayStr = safeFormat(today, 'yyyy-MM-dd');
      const todaysRoutes = routes.filter(r => r.date === todayStr);
      
      let targetDate = todayStr;
      
      // If there are routes for today, and ALL of them are completed or approved, move to next working day.
      if (todaysRoutes.length > 0) {
        const allCompleted = todaysRoutes.every(r => r.status === 'completed' || r.status === 'approved');
        if (allCompleted) {
          let nextDateObj = new Date();
          nextDateObj.setDate(nextDateObj.getDate() + 1);
          while (nextDateObj.getDay() === 0 || nextDateObj.getDay() === 6) {
             nextDateObj.setDate(nextDateObj.getDate() + 1);
          }
          targetDate = safeFormat(nextDateObj, 'yyyy-MM-dd');
        }
      }
      
      setSelectedDate(targetDate);
      setHasAutoSelectedDate(true);
    }
  }, [routes, hasAutoSelectedDate]);

  const routeStops = useAppQuery(() => db.routeStops.toArray(), [], 'route_stops');
  const routeTemplates = useAppQuery(() => db.routeTemplates.toArray(), [], 'route_templates');
  const routeTemplateStops = useAppQuery(() => db.routeTemplateStops.toArray(), [], 'route_template_stops');
  const drivers = useAppQuery(() => db.drivers.toArray(), [], 'drivers');
  const activeDrivers = drivers?.filter(d => !!d.isActive) || [];
  const households = useAppQuery(() => db.households.toArray(), [], 'households');
  const systemLogs = useAppQuery(() => db.system_logs.toArray(), [], 'system_logs');
  const systemSettings = useAppQuery(() => db.system_settings.get('global'), [], 'system_settings');
  const personnelName = personnel?.name || 'Bilinmeyen Personel';

  const addLog = async (action: string, details?: string, category: string = 'route') => {
    await addSystemLog(user, personnel, action, details, category);
  };

  // Auto-fix template orders if they are missing or inconsistent
  useEffect(() => {
    if (routeTemplates && routeTemplateStops) {
      const fixOrders = async () => {
        let changed = false;
        for (const template of routeTemplates) {
          const tStops = routeTemplateStops.filter(ts => String(ts.templateId) === String(template.id));
          // Check if any order is missing or if there are duplicates
          const orders = tStops.map(ts => ts.order);
          const hasMissingOrDuplicates = orders.some(o => o === undefined || o === null || o === 0) || 
                                        new Set(orders).size !== orders.length;
          
          if (hasMissingOrDuplicates && tStops.length > 0) {
            console.log(`Fixing orders for template ${template.id}`);
            const sorted = [...tStops].sort((a, b) => (a.order || 0) - (b.order || 0));
            for (let i = 0; i < sorted.length; i++) {
              if (sorted[i].order !== i + 1) {
                await db.routeTemplateStops.update(sorted[i].id!, { order: i + 1 });
                changed = true;
              }
            }
          }
        }
        if (changed) notifyDbChange();
      };
      fixOrders();
    }
  }, [routeTemplates, routeTemplateStops]);
  // Auto-fix for 17.04.2026 Vakıf completion as requested by user
  useEffect(() => {
    const fixVakifCompletion = async () => {
      const targetDate = '2026-04-17';
      const vakifRoute = (routes || []).find((r: Route) => r.date === targetDate && r.driverId === 'vakif_pickup');
      if (vakifRoute) {
        const activeVakifHouseholds = households?.filter((h: Household) => h.isSelfService && h.isActive) || [];
        const stops = await db.routeStops.where('routeId').equals(vakifRoute.id!).toArray();
        let changed = false;

        // 1. Update existing stops to delivered
        for (const stop of stops) {
          if (stop.status !== 'delivered') {
            await db.routeStops.update(stop.id!, { status: 'delivered' });
            changed = true;
          }
        }

        // 2. Add missing stops as delivered
        for (const h of activeVakifHouseholds) {
          const hasStop = stops.some((s: RouteStop) => s.householdId === h.id);
          if (!hasStop) {
            await db.routeStops.add({
              routeId: vakifRoute.id!,
              householdId: h.id!,
              householdSnapshotName: h.headName,
              householdSnapshotMemberCount: h.memberCount,
              householdSnapshotBreadCount: h.breadCount ?? h.memberCount,
              status: 'delivered',
              order: stops.length + 1
            });
            changed = true;
          }
        }

        if (changed) {
          if (vakifRoute.status !== 'completed' && vakifRoute.status !== 'approved') {
            await db.routes.update(vakifRoute.id!, { status: 'completed' });
          }
          notifyDbChange('route_stops');
          notifyDbChange('routes');
        }
      }
    };
    if (routes && households) fixVakifCompletion();
  }, [routes, households]);

  const routesOnDate = routes?.filter((r: Route) => r.date === selectedDate) || [];
  const routeIdsOnDate = routesOnDate.map((r: Route) => r.id);
  const stopsOnDate = routeStops?.filter((rs: RouteStop) => routeIdsOnDate.includes(rs.routeId)) || [];
  const assignedHouseholdIds = stopsOnDate.map((rs: RouteStop) => rs.householdId);

  const assignedTemplateHouseholdIds = routeTemplateStops?.map((rts: RouteTemplateStop) => rts.householdId) || [];

  const availableHouseholds = households?.filter((h: Household) => {
    if (h.pausedUntil === '9999-12-31') return false; // Deleted
    if (h.pausedUntil && h.pausedUntil >= selectedDate) return false; // Paused for this date
    if (!h.isActive && !h.pausedUntil) return false; // Hard inactive
    if (h.isSelfService) return false; // Self service households are not in routes
    
    if (activeTab === 'daily') {
      if (assignedHouseholdIds.includes(h.id!)) return false; // Already assigned today
    } else {
      if (assignedTemplateHouseholdIds.includes(h.id!)) return false; // Already assigned to a template
    }
    
    return true;
  });

  const filteredAvailableHouseholds = availableHouseholds?.filter((h: Household) => {
    if (!templateSearchTerm) return true;
    const search = normalizeTurkish(templateSearchTerm);
    return (
      normalizeTurkish(h.headName).includes(search) ||
      normalizeTurkish(h.address).includes(search) ||
      (h.tcNo || '').includes(templateSearchTerm) ||
      (h.householdNo || '').toLowerCase().includes(search)
    );
  }).sort((a: Household, b: Household) => {
    const fieldA = normalizeTurkish((a[templateSortField] || '').toString());
    const fieldB = normalizeTurkish((b[templateSortField] || '').toString());
    
    if (templateSortOrder === 'asc') {
      return fieldA.localeCompare(fieldB, 'tr');
    } else {
      return fieldB.localeCompare(fieldA, 'tr');
    }
  });

  const filteredDailyHouseholds = availableHouseholds?.filter((h: Household) => {
    if (!dailySearchTerm) return true;
    const search = normalizeTurkish(dailySearchTerm);
    return (
      normalizeTurkish(h.headName).includes(search) ||
      normalizeTurkish(h.address).includes(search) ||
      (h.tcNo || '').includes(dailySearchTerm) ||
      (h.householdNo || '').toLowerCase().includes(search)
    );
  }).sort((a: Household, b: Household) => {
    const fieldA = normalizeTurkish((a[dailySortField] || '').toString());
    const fieldB = normalizeTurkish((b[dailySortField] || '').toString());
    
    if (dailySortOrder === 'asc') {
      return fieldA.localeCompare(fieldB, 'tr');
    } else {
      return fieldB.localeCompare(fieldA, 'tr');
    }
  });

  const getDefaultRouteDateFallback = () => {
    let nextDateObj = new Date();
    if (routes && routes.length > 0) {
      const todayStr = safeFormat(nextDateObj, 'yyyy-MM-dd');
      const todaysRoutes = routes.filter((r: Route) => r.date === todayStr);
      if (todaysRoutes.length > 0) {
        const allCompleted = todaysRoutes.every((r: Route) => r.status === 'completed' || r.status === 'approved');
        if (allCompleted) {
          nextDateObj.setDate(nextDateObj.getDate() + 1);
          while (nextDateObj.getDay() === 0 || nextDateObj.getDay() === 6) {
             nextDateObj.setDate(nextDateObj.getDate() + 1);
          }
        }
      }
    }
    return safeFormat(nextDateObj, 'yyyy-MM-dd');
  };

  const openModal = () => {
    setDailySearchTerm('');
    setDailySortField('headName');
    setDailySortOrder('asc');
    setSelectedDriverId('');
    setSelectedDate(getDefaultRouteDateFallback());
    setSelectedHouseholds([]);
    setIsModalOpen(true);
  };

  const openTemplateModal = (template?: RouteTemplate) => {
    setTemplateSearchTerm('');
    setTemplateSortField('headName');
    setTemplateSortOrder('asc');
    if (template) {
      setEditingTemplate(template);
      setSelectedDriverId(template.driverId);
      const tStops = routeTemplateStops?.filter((ts: RouteTemplateStop) => String(ts.templateId) === String(template.id)) || [];
      const sortedStops = [...tStops].sort((a: RouteTemplateStop, b: RouteTemplateStop) => a.order - b.order);
      setSelectedHouseholds(sortedStops.map((ts: RouteTemplateStop) => ({ householdId: ts.householdId, order: ts.order })));
    } else {
      setEditingTemplate(null);
      setSelectedDriverId('');
      setSelectedHouseholds([]);
    }
    setIsTemplateModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsTemplateModalOpen(false);
    setEditingTemplate(null);
  };

  const toggleHousehold = (id: string) => {
    setSelectedHouseholds(prev => {
      const exists = prev.find(h => h.householdId === id);
      if (exists) {
        const filtered = prev.filter(h => h.householdId !== id);
        // Re-order remaining
        return filtered.map((h, i) => ({ ...h, order: i + 1 }));
      } else {
        return [...prev, { householdId: id, order: prev.length + 1 }];
      }
    });
  };

  const handleOrderChange = (householdId: string, newOrder: number) => {
    setSelectedHouseholds(prev => {
      const oldStop = prev.find(h => h.householdId === householdId);
      if (!oldStop) return prev;

      const oldOrder = oldStop.order;
      const maxOrder = prev.length;
      const targetOrder = Math.max(1, Math.min(newOrder, maxOrder));

      if (oldOrder === targetOrder) return prev;

      return prev.map(h => {
        if (h.householdId === householdId) {
          return { ...h, order: targetOrder };
        }
        if (oldOrder < targetOrder) {
          // Moving down: shift items between old and new up
          if (h.order > oldOrder && h.order <= targetOrder) {
            return { ...h, order: h.order - 1 };
          }
        } else {
          // Moving up: shift items between new and old down
          if (h.order >= targetOrder && h.order < oldOrder) {
            return { ...h, order: h.order + 1 };
          }
        }
        return h;
      }).sort((a, b) => a.order - b.order);
    });
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId || selectedHouseholds.length === 0) {
      toast.error('Lütfen şoför seçin ve en az bir hane ekleyin.');
      return;
    }

    const loadingToast = toast.loading('Rota oluşturuluyor...');
    try {
      const driver = drivers?.find(d => d.id === selectedDriverId);
      const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(selectedDate));
      
      const routeId = await db.routes.add({
        driverId: selectedDriverId,
        driverSnapshotName: driver?.name,
        date: selectedDate,
        status: 'pending',
        createdAt: new Date(),
        history: [{ action: 'created', timestamp: new Date(), note: 'Sistem yöneticisi tarafından oluşturuldu' }]
      });

      const stops: RouteStop[] = [];
      
      selectedHouseholds.forEach((sh) => {
        const h = households?.find(hh => hh.id === sh.householdId);
        if (!h) return;
        
        // Standard Meal
        stops.push({
          routeId: routeId as string,
          householdId: sh.householdId,
          householdSnapshotName: h.headName,
          householdSnapshotMemberCount: h.memberCount,
          householdSnapshotBreadCount: h.breadCount ?? h.memberCount,
          order: sh.order * 2 - 1, // Multiply by 2 so we have space for breakfast
          status: 'pending',
          isManual: true,
          mealType: 'standard'
        });

        // Breakfast Meal
        if (isLastWorkingDay && !h.noBreakfast) {
          stops.push({
            routeId: routeId as string,
            householdId: sh.householdId,
            householdSnapshotName: `${h.headName} (Kahvaltı)`,
            householdSnapshotMemberCount: h.memberCount,
            householdSnapshotBreadCount: 0,
            order: sh.order * 2,
            status: 'pending',
            isManual: true,
            mealType: 'breakfast'
          });
        }
      });

      await db.routeStops.bulkAdd(stops);
      await addLog('Günlük Rota Oluşturuldu', `${safeFormat(selectedDate, 'dd.MM.yyyy')} tarihi için ${driver?.name} şoförüne rota oluşturuldu.`);
      toast.success('Rota başarıyla oluşturuldu', { id: loadingToast });
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('Rota oluşturulurken bir hata oluştu.', { id: loadingToast });
    }
  };

  const onTemplateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedDriverId || selectedHouseholds.length === 0) {
      toast.error('Lütfen şoför seçin ve en az bir hane ekleyin.');
      return;
    }

    // Check if driver already has a template (if not editing the same one)
    const existingTemplate = routeTemplates?.find(t => t.driverId === selectedDriverId && t.id !== editingTemplate?.id);
    if (existingTemplate) {
      toast.error('Bu şoför için zaten bir ana rota tanımlanmış. Mevcut olanı düzenleyebilirsiniz.');
      return;
    }

    const loadingToast = toast.loading(editingTemplate ? 'Ana rota güncelleniyor...' : 'Ana rota oluşturuluyor...');
    try {
      let templateId = editingTemplate?.id;
      const driver = drivers?.find(d => d.id === selectedDriverId);

      if (editingTemplate) {
        await db.routeTemplates.delete(editingTemplate.id!);
        await db.routeTemplateStops.where('templateId').equals(editingTemplate.id!).delete();
      }
      
      templateId = await db.routeTemplates.add({
        driverId: selectedDriverId,
        createdAt: new Date()
      }) as string;

      const stops = selectedHouseholds.map((h) => {
        return {
          templateId: templateId as string,
          householdId: h.householdId,
          order: h.order
        };
      });

      await db.routeTemplateStops.bulkAdd(stops);
      
      // Auto-generate or update route for the next working day
      const nextDay = await getNextWorkingDay(new Date());
      const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');
      
      // If a route already exists for this driver on nextDay, we should update it
      const existingRoute = await db.routes.where('driverId').equals(selectedDriverId).toArray();
      const routeForNextDay = existingRoute.find(r => r.date === nextDayStr);
      
      if (routeForNextDay && routeForNextDay.status === 'pending') {
        // Update existing pending route
        await db.routeStops.where('routeId').equals(routeForNextDay.id!).delete();
        const routeStops = stops.map(s => ({
          routeId: routeForNextDay.id!,
          householdId: s.householdId,
          status: 'pending' as const,
          order: s.order
        }));
        // We need to fetch household snapshots too for better consistency, 
        // but generateRouteFromTemplate handles that. Let's just re-run it if possible or mimic it.
        // For simplicity, let's just delete and re-generate if it was pending.
        await db.routes.delete(routeForNextDay.id!);
        await generateRouteFromTemplate(selectedDriverId, nextDayStr);
      } else if (!routeForNextDay) {
        await generateRouteFromTemplate(selectedDriverId, nextDayStr);
      }

      await addLog(editingTemplate ? 'Ana Rota Güncellendi' : 'Ana Rota Oluşturuldu', `${driver?.name} şoförü için ana rota ${editingTemplate ? 'güncellendi' : 'oluşturuldu'}.`);
      toast.success(editingTemplate ? 'Ana rota başarıyla güncellendi' : 'Ana rota başarıyla oluşturuldu', { id: loadingToast });
      closeModal();
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu.', { id: loadingToast });
    }
  };

  const deleteRoute = async (id: string) => {
    const route = await db.routes.get(id);
    if (route?.status === 'completed' || route?.status === 'approved') {
      toast.error('Tamamlanmış veya onaylanmış rotalar silinemez.');
      return;
    }
    if (confirm('Bu rotayı silmek istediğinize emin misiniz?')) {
      const loadingToast = toast.loading('Rota siliniyor...');
      try {
        const driverName = getDriverName(route!.driverId);
        await db.routes.delete(id);
        await db.routeStops.where('routeId').equals(id).delete();
        await addLog('Günlük Rota Silindi', `${safeFormat(route!.date, 'dd.MM.yyyy')} tarihli ${driverName} rotası silindi.`);
        toast.success('Rota başarıyla silindi', { id: loadingToast });
      } catch (error) {
        console.error(error);
        toast.error('Rota silinirken bir hata oluştu', { id: loadingToast });
      }
    }
  };

  const handleManualLeftoverEntry = async () => {
    if (!routeForLeftover) return;
    const loadingToast = toast.loading('İşlem yapılıyor...');
    try {
      const updateData: Partial<Route> = {
        status: 'completed',
        remainingBread: manualLeftoverBread,
        history: [...(routeForLeftover.history || []), { 
          action: isManualCompletion ? 'manual_completion' : 'completed', 
          timestamp: new Date(), 
          note: isManualCompletion ? 'Yönetici tarafından manuel tamamlandı' : 'Yönetici tarafından tamamlandı' 
        }]
      };

      if (isManualCompletion) {
        updateData.completedByPersonnel = true;
        updateData.personnelCompletionTime = new Date();
      }

      await db.routes.update(routeForLeftover.id!, updateData);
      
      // 1. Update bread tracking for the CURRENT route date
      const currentRouteDate = safeFormat(routeForLeftover.date, 'yyyy-MM-dd');
      const currentBreadData = await calculateBreadForNextDay(currentRouteDate);
      const existingCurrentTracking = await db.breadTracking.where('date').equals(currentRouteDate).first();
      
      if (existingCurrentTracking) {
        await db.breadTracking.update(existingCurrentTracking.id!, {
          totalNeeded: currentBreadData.totalNeeded,
          leftoverAmount: currentBreadData.leftoverAmount,
          finalOrderAmount: currentBreadData.finalOrderAmount,
          containerCount: currentBreadData.containerCount,
          ownContainerCount: currentBreadData.ownContainerCount
        });
      } else {
        await db.breadTracking.add({
          date: currentRouteDate,
          totalNeeded: currentBreadData.totalNeeded,
          delivered: 0,
          leftoverAmount: currentBreadData.leftoverAmount,
          finalOrderAmount: currentBreadData.finalOrderAmount,
          containerCount: currentBreadData.containerCount,
          ownContainerCount: currentBreadData.ownContainerCount,
          status: 'pending'
        });
      }

      // 2. Calculate bread for the NEXT working day
      const nextWorkingDay = await getNextWorkingDay(new Date(routeForLeftover.date));
      const nextDateStr = safeFormat(nextWorkingDay, 'yyyy-MM-dd');
      const { totalNeeded, leftoverAmount, finalOrderAmount, containerCount, ownContainerCount, note } = await calculateBreadForNextDay(nextDateStr);
      
      // Check if tracking already exists for that date
      const existingNextTracking = await db.breadTracking.where('date').equals(nextDateStr).first();
      if (existingNextTracking) {
        await db.breadTracking.update(existingNextTracking.id!, {
          totalNeeded,
          leftoverAmount,
          finalOrderAmount,
          containerCount,
          ownContainerCount,
          note
        });
      } else {
        await db.breadTracking.add({
          date: nextDateStr,
          totalNeeded,
          delivered: 0,
          leftoverAmount,
          finalOrderAmount,
          containerCount,
          ownContainerCount,
          status: 'pending',
          note
        });
      }
      
      // Update stop statuses
      for (const stop of leftoverStops) {
        await db.routeStops.update(stop.id!, { 
          status: stop.status, 
          deliveredAt: stop.status === 'delivered' ? new Date() : undefined,
          issueReport: stop.issueReport
        });
      }
      
      await addLog(isManualCompletion ? 'Rota Manuel Tamamlandı' : 'Rota Tamamlandı', `${safeFormat(routeForLeftover.date, 'dd.MM.yyyy')} tarihli ${getDriverName(routeForLeftover.driverId)} rotası ${isManualCompletion ? 'manuel tamamlandı' : 'tamamlandı'}.`);

      toast.success('Rota başarıyla tamamlandı.', { id: loadingToast });
      setIsLeftoverModalOpen(false);
      setRouteForLeftover(null);
      await checkAndGenerateNextDayRoutes(new Date(routeForLeftover.date));
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const handleUndoPersonnelCompletion = async (route: Route) => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setHours(17, 30, 0, 0);

    if (now > cutoff) {
      toast.error('Saat 17:30 geçtiği için bu işlem geri alınamaz.');
      return;
    }

    if (confirm('Bu işlemi geri almak istediğinize emin misiniz? Rota tekrar bekleme durumuna alınacaktır.')) {
      const loadingToast = toast.loading('İşlem geri alınıyor...');
      try {
        await db.routes.update(route.id!, {
          status: 'pending',
          remainingBread: 0,
          completedByPersonnel: false,
          personnelCompletionTime: undefined
        });

        await addLog('Personel Rota Tamamlama Geri Alındı', `${getDriverName(route.driverId)} şoförünün ${safeFormat(route.date, 'dd.MM.yyyy')} tarihli rotası için yapılan işlem geri alındı.`);
        
        toast.success('İşlem başarıyla geri alındı.', { id: loadingToast });
      } catch (error) {
        console.error(error);
        toast.error('İşlem geri alınırken bir hata oluştu.', { id: loadingToast });
      }
    }
  };

  const deleteTemplate = async (id: string) => {
    if (confirm('Bu ana rotayı silmek istediğinize emin misiniz?')) {
      const loadingToast = toast.loading('Ana rota siliniyor...');
      try {
        const template = routeTemplates?.find(t => t.id === id);
        const driverName = getDriverName(template?.driverId || '');
        await db.routeTemplates.delete(id);
        await db.routeTemplateStops.where('templateId').equals(id).delete();
        await addLog('Ana Rota Silindi', `${driverName} şoförüne ait ana rota silindi.`);
        toast.success('Ana rota başarıyla silindi', { id: loadingToast });
      } catch (error) {
        console.error(error);
        toast.error('Ana rota silinirken bir hata oluştu', { id: loadingToast });
      }
    }
  };

  const getDriverName = (id: string) => {
    if (id === 'vakif_pickup') return 'Vakıf\'tan Yemek Alanlar';
    return drivers?.find(d => d.id === id)?.name || 'Bilinmeyen Şoför';
  };

  const handleGenerateVakifPickupRoute = async () => {
    const loadingToast = toast.loading('Vakıf\'tan yemek alanlar listesi oluşturuluyor...');
    try {
      const pickupHouseholds = households?.filter(h => h.isSelfService) || [];

      if (pickupHouseholds.length === 0) {
        toast.error('Vakıf\'tan kendi imkanlarıyla yemek alan hane/kurum bulunamadı.', { id: loadingToast });
        return;
      }

      // Check if already exists
      const existing = routesOnDate.find(r => r.driverId === 'vakif_pickup');
      if (existing) {
        toast.error('Bu tarih için liste zaten oluşturulmuş.', { id: loadingToast });
        return;
      }

      const routeId = await db.routes.add({
        driverId: 'vakif_pickup',
        driverSnapshotName: 'Vakıf\'tan Yemek Alanlar',
        date: selectedDate,
        status: 'pending',
        createdAt: new Date(),
        history: [{ action: 'created', timestamp: new Date(), note: 'Yönetici tarafından oluşturuldu' }]
      });

      const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(selectedDate));
      const stops: RouteStop[] = [];
      let orderIdx = 1;

      pickupHouseholds.forEach(h => {
        const isDeleted = h.pausedUntil === '9999-12-31';
        const isPaused = h.pausedUntil && h.pausedUntil >= selectedDate;
        const isInactive = !h.isActive && !h.pausedUntil;
        const isActuallyPassive = isDeleted || isPaused || isInactive;

        // Standard
        stops.push({
          routeId: routeId as string,
          householdId: h.id!,
          householdSnapshotName: isActuallyPassive ? `${h.headName} (PASİF)` : h.headName,
          householdSnapshotMemberCount: isActuallyPassive ? 0 : h.memberCount,
          householdSnapshotBreadCount: isActuallyPassive ? 0 : (h.breadCount ?? h.memberCount),
          order: orderIdx++,
          status: isActuallyPassive ? 'failed' : 'pending',
          issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
          mealType: 'standard'
        });

        // Breakfast
        if (isLastWorkingDay && !h.noBreakfast) {
          stops.push({
            routeId: routeId as string,
            householdId: h.id!,
            householdSnapshotName: isActuallyPassive ? `${h.headName} (Kahvaltı-PASİF)` : `${h.headName} (Kahvaltı)`,
            householdSnapshotMemberCount: isActuallyPassive ? 0 : h.memberCount,
            householdSnapshotBreadCount: 0,
            order: orderIdx++,
            status: isActuallyPassive ? 'failed' : 'pending',
            issueReport: isActuallyPassive ? 'Pasif/Duraklatılmış Kayıt' : undefined,
            mealType: 'breakfast'
          });
        }
      });

      await db.routeStops.bulkAdd(stops);
      await addLog('Vakıf Pickup Listesi Oluşturuldu', `${selectedDate} tarihi için vakıftan yemek alanlar listesi oluşturuldu.`);
      toast.success('Liste başarıyla oluşturuldu.', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('Liste oluşturulurken bir hata oluştu.', { id: loadingToast });
    }
  };

  const handleAutoGenerateRoutesForSelectedDate = async () => {
    if (!selectedDate) {
      toast.error('Lütfen bir tarih seçin.');
      return;
    }

    if (confirm(`${safeFormat(selectedDate, 'dd.MM.yyyy')} tarihi için tüm aktif şoförlerin rotalarını otomatik oluşturmak istediğinize emin misiniz?`)) {
      const loadingToast = toast.loading('Rotalar oluşturuluyor...');
      try {
        const drivers = await db.drivers.toArray();
        let generatedCount = 0;
        for (const driver of drivers) {
          if (driver.isActive) {
            const routeId = await generateRouteFromTemplate(driver.id!, selectedDate);
            if (routeId) generatedCount++;
          }
        }
        
        if (generatedCount > 0) {
          await addLog('Otomatik Rota Oluşturma (Manuel Tetikleme)', `${safeFormat(selectedDate, 'dd.MM.yyyy')} tarihi için ${generatedCount} adet rota otomatik oluşturuldu.`);
          toast.success(`${generatedCount} adet rota başarıyla oluşturuldu.`, { id: loadingToast });
        } else {
          toast.info('Oluşturulacak yeni rota bulunamadı (Zaten mevcut olabilir veya şoförlerin ana rotası yok).', { id: loadingToast });
        }
      } catch (error) {
        console.error(error);
        toast.error('Rotalar oluşturulurken bir hata oluştu.', { id: loadingToast });
      }
    }
  };

  const handleApproveRoute = async (route: Route) => {
    if (confirm('Bu rotayı onaylamak ve raporu indirmek istediğinize emin misiniz?')) {
      const loadingToast = toast.loading('Rota onaylanıyor...');
      try {
        const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
        
        // If it's still pending, mark all as delivered (legacy behavior for quick approval)
        if (route.status === 'pending') {
          for (const stop of stops) {
            if (stop.status === 'pending') {
              await db.routeStops.update(stop.id!, { status: 'delivered', deliveredAt: new Date() });
            }
          }
        }

        // Mark route as approved
        await db.routes.update(route.id!, { 
          status: 'approved',
          completedByPersonnel: true,
          personnelCompletionTime: route.personnelCompletionTime || new Date(),
          history: [...(route.history || []), { action: 'approved', timestamp: new Date(), note: 'Yönetici tarafından onaylandı' }]
        });

        await addLog('Rota Onaylandı', `${safeFormat(route.date, 'dd.MM.yyyy')} tarihli ${getDriverName(route.driverId)} rotası onaylandı.`);
        
        // Automatically download PDF
        await generateRouteTutanakPDF(route, stops);
        
        // --- NEW: Generate next working day route for this driver upon approval --- //
        try {
          const nextDay = await getNextWorkingDay(new Date(route.date));
          const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');
          if (route.driverId !== 'vakif_pickup') {
            await generateRouteFromTemplate(route.driverId, nextDayStr);
            await addLog('Otomatik Rota Oluşturma', `${getDriverName(route.driverId)} şoförünün bir sonraki iş günü (${nextDayStr}) rotası otomatik oluşturuldu.`);
          }
        } catch(e) {
          console.error("Gelecek gün rotası oluşturulurken hata:", e);
        }
        // ----------------------------------------------------------------------- //

        // Trigger bread calculation for current and next day
        try {
          // 1. Current Day
          const currentRouteDate = safeFormat(route.date, 'yyyy-MM-dd');
          const currentBreadData = await calculateBreadForNextDay(currentRouteDate);
          const existingCurrentTracking = await db.breadTracking.where('date').equals(currentRouteDate).first();
          
          if (existingCurrentTracking) {
            await db.breadTracking.update(existingCurrentTracking.id!, {
              totalNeeded: currentBreadData.totalNeeded,
              leftoverAmount: currentBreadData.leftoverAmount,
              finalOrderAmount: currentBreadData.finalOrderAmount,
              containerCount: currentBreadData.containerCount,
              ownContainerCount: currentBreadData.ownContainerCount
            });
          } else {
            await db.breadTracking.add({
              date: currentRouteDate,
              totalNeeded: currentBreadData.totalNeeded,
              delivered: 0,
              leftoverAmount: currentBreadData.leftoverAmount,
              finalOrderAmount: currentBreadData.finalOrderAmount,
              containerCount: currentBreadData.containerCount,
              ownContainerCount: currentBreadData.ownContainerCount,
              status: 'pending'
            });
          }

          // 2. Next Day
          const nextWorkingDay = await getNextWorkingDay(new Date(route.date));
          const nextDateStr = safeFormat(nextWorkingDay, 'yyyy-MM-dd');
          const { totalNeeded, leftoverAmount, finalOrderAmount, containerCount, ownContainerCount, note } = await calculateBreadForNextDay(nextDateStr);
          
          const existingNextTracking = await db.breadTracking.where('date').equals(nextDateStr).first();
          if (existingNextTracking) {
            await db.breadTracking.update(existingNextTracking.id!, {
              totalNeeded,
              leftoverAmount,
              finalOrderAmount,
              containerCount,
              ownContainerCount,
              note
            });
          } else {
            await db.breadTracking.add({
              date: nextDateStr,
              totalNeeded,
              delivered: 0,
              leftoverAmount,
              finalOrderAmount,
              containerCount,
              ownContainerCount,
              status: 'pending',
              note
            });
          }
        } catch (breadErr) {
          console.error('Bread calculation error:', breadErr);
        }

        toast.success('Rota onaylandı ve rapor indirildi.', { id: loadingToast });
        await checkAndGenerateNextDayRoutes(new Date(route.date));
      } catch (error) {
        console.error(error);
        toast.error('Onaylama sırasında bir hata oluştu', { id: loadingToast });
      }
    }
  };

  const openRouteDetails = async (route: Route) => {
    const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
    
    // Fetch households to check status
    const householdsList = await db.households.toArray();
    
    const sortedStops = [...stops].sort((a, b) => {
      const hA = householdsList.find(h => h.id === a.householdId);
      const hB = householdsList.find(h => h.id === b.householdId);
      
      const isDeletedA = hA?.pausedUntil === '9999-12-31';
      const isDeletedB = hB?.pausedUntil === '9999-12-31';
      const isPausedA = hA?.pausedUntil && hA.pausedUntil >= route.date;
      const isPausedB = hB?.pausedUntil && hB.pausedUntil >= route.date;

      if (isDeletedA && !isDeletedB) return 1;
      if (!isDeletedA && isDeletedB) return -1;
      if (isPausedA && !isPausedB && !isDeletedB) return 1;
      if (!isPausedA && isPausedB && !isDeletedA) return -1;

      return a.order - b.order;
    });

    setRouteDetailsStops(sortedStops);
    setEditRouteStopsData(JSON.parse(JSON.stringify(sortedStops))); // Deep copy for editing
    setIsEditingRouteDetails(false);
    setViewRouteDetails(route);
  };

  const handleSaveRouteEdits = async () => {
    if (!viewRouteDetails) return;
    const loadingToast = toast.loading('Değişiklikler kaydediliyor...');
    try {
      for (const stop of editRouteStopsData) {
        const originalStop = routeDetailsStops.find(s => s.id === stop.id);
        if (originalStop && (originalStop.status !== stop.status || originalStop.issueReport !== stop.issueReport)) {
          await db.routeStops.update(stop.id!, {
            status: stop.status,
            issueReport: stop.issueReport,
            history: [...(stop.history || []), { status: stop.status, timestamp: new Date(), note: 'Yönetici tarafından düzenlendi' }]
          });
        }
      }
      await addLog('Rota Düzenlendi', `${safeFormat(viewRouteDetails.date, 'dd.MM.yyyy')} tarihli ${getDriverName(viewRouteDetails.driverId)} rotası düzenlendi.`);
      toast.success('Değişiklikler başarıyla kaydedildi', { id: loadingToast });
      setIsEditingRouteDetails(false);
      // Refresh details
      const updatedRoute = await db.routes.get(viewRouteDetails.id!);
      if (updatedRoute) openRouteDetails(updatedRoute);
    } catch (error) {
      console.error(error);
      toast.error('Değişiklikler kaydedilirken bir hata oluştu', { id: loadingToast });
    }
  };

  const exportDriverManifestPDF = async (route: Route) => {
    const doc = await getTurkishPdf('portrait');
    const driverName = route.driverSnapshotName || getDriverName(route.driverId);
    
    await addVakifLogo(doc, 14, 10, 20);

    doc.setFontSize(12);
    doc.setFont('Roboto', 'bold');
    doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
    doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('ŞOFÖR DAĞITIM LİSTESİ', doc.internal.pageSize.width / 2, 35, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Tarih: ${safeFormat(route.date, 'dd.MM.yyyy')}`, doc.internal.pageSize.width - 14, 45, { align: 'right' });
    doc.text(`Şoför: ${driverName}`, 14, 45);

    const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
    const householdsList = await db.households.toArray();
    const template = await db.routeTemplates.where('driverId').equals(route.driverId).first();
    const tStops = template ? await db.routeTemplateStops.where('templateId').equals(template.id!).toArray() : [];

    const sortedStops = [...stops].sort((a, b) => {
      // Priority: use template order if both are in template
      const templateStopA = tStops.find(ts => ts.householdId === a.householdId);
      const templateStopB = tStops.find(ts => ts.householdId === b.householdId);
      
      if (templateStopA && templateStopB) return templateStopA.order - templateStopB.order;
      if (templateStopA && !templateStopB) return -1;
      if (!templateStopA && templateStopB) return 1;
      
      // Fallback to daily order if neither in template (manual additions)
      return a.order - b.order;
    });

    const { isLastWorkingDayOfWeek } = await import('@/lib/route-utils');
    const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(route.date));

    // Grouping by household for the manifest to combine standard and breakfast
    const groupedStops: any[] = [];
    const processedHouseholdIds = new Set();

    for (const stop of sortedStops) {
      if (processedHouseholdIds.has(stop.householdId)) continue;
      
      const householdStops = sortedStops.filter(s => s.householdId === stop.householdId);
      const standardStop = householdStops.find(s => s.mealType === 'standard' || !s.mealType);
      const breakfastStop = householdStops.find(s => s.mealType === 'breakfast');
      
      const household = householdsList.find(h => h.id === stop.householdId);
      
      if (!standardStop && !breakfastStop) continue;

      const memberCount = standardStop?.householdSnapshotMemberCount || breakfastStop?.householdSnapshotMemberCount || household?.memberCount || 0;
      const breadCount = standardStop?.householdSnapshotBreadCount ?? household?.breadCount ?? memberCount;
      const breakfastCount = breakfastStop ? (breakfastStop.householdSnapshotMemberCount || household?.memberCount || 0) : 0;
      
      const multiplier = isLastWorkingDay ? 2 : 1;
      
      groupedStops.push({
        name: stop.householdSnapshotName || household?.headName || '',
        address: household?.address || '',
        food: memberCount * multiplier,
        bread: breadCount * multiplier,
        breakfast: breakfastCount, // Already 1x usually, or 0
        isManual: stop.isManual,
        isPaused: (household?.pausedUntil && household.pausedUntil >= route.date),
        isDeleted: household?.pausedUntil === '9999-12-31'
      });
      processedHouseholdIds.add(stop.householdId);
    }

    const tableColumn = ["Sıra", "Hane Sorumlusu", "Adres", "Yemek", "Ekmek", "K.Yemek", "İmza/Teslim"];
    const tableRows: any[] = [];
    
    let totalFood = 0;
    let totalBread = 0;
    let totalBreakfast = 0;

    for (let i = 0; i < groupedStops.length; i++) {
      const gs = groupedStops[i];
      totalFood += gs.food;
      totalBread += gs.bread;
      totalBreakfast += gs.breakfast;

      let displayName = gs.name;
      if (gs.isManual) displayName = `* ${displayName}`;
      if (gs.isDeleted) displayName = `${displayName} (SİLİNDİ)`;
      else if (gs.isPaused) displayName = `${displayName} (PASİF)`;

      tableRows.push([
        (i + 1).toString(),
        displayName,
        gs.address,
        gs.food.toString(),
        gs.bread.toString(),
        gs.breakfast > 0 ? gs.breakfast.toString() : '-',
        "[  ]"
      ]);
    }

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [['', 'TOPLAM', '', totalFood.toString(), totalBread.toString(), totalBreakfast.toString(), '']],
      showFoot: 'lastPage',
      startY: 50,
      styles: { font: 'Roboto', fontSize: 9, cellPadding: 3, lineColor: [0, 0, 0], lineWidth: 0.1 },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' },
      footStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'left', cellWidth: 45 },
        2: { halign: 'left' },
        3: { halign: 'center', cellWidth: 15 },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 15 },
        6: { halign: 'center', cellWidth: 30 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFont('Roboto', 'bold');
    doc.text('Teslim Eden', 40, finalY, { align: 'center' });
    doc.text('Teslim Alan (Şoför)', doc.internal.pageSize.width - 40, finalY, { align: 'center' });
    
    doc.setFont('Roboto', 'normal');
    doc.text('İmza', 40, finalY + 10, { align: 'center' });
    doc.text(driverName, doc.internal.pageSize.width - 40, finalY + 5, { align: 'center' });
    doc.text('İmza', doc.internal.pageSize.width - 40, finalY + 10, { align: 'center' });

    addReportFooter(doc, personnelName);
    await addLog('Rapor İndirme', `${safeFormat(route.date, 'yyyy-MM-dd')} tarihli ${driverName} Dağıtım Listesi (PDF) indirildi.`);
    doc.save(`Dagitim_Listesi_${safeFormat(route.date, 'yyyy-MM-dd')}_${driverName.replace(/\s+/g, '_')}.pdf`);
  };

  const generateRouteTutanakPDF = async (route: Route, stops: RouteStop[]) => {
    const doc = await getTurkishPdf('landscape');
    const driverName = route.driverSnapshotName || getDriverName(route.driverId);
    
    await addVakifLogo(doc, 14, 10, 20);

    doc.setFontSize(12);
    doc.setFont('Roboto', 'bold');
    doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
    doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text('GÜNLÜK YEMEK DAĞITIM TUTANAĞI', doc.internal.pageSize.width / 2, 35, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Tarih: ${safeFormat(route.date, 'dd.MM.yyyy')}`, doc.internal.pageSize.width - 14, 22, { align: 'right' });
    doc.text(`Şoför Adı Soyadı: ${driverName}`, 14, 45);
    
    let startY = 50;
    if (route.status === 'completed' || route.status === 'approved') {
      doc.text(`Araç Çıkış KM: ${route.startKm || 0}   -   Araç Giriş KM: ${route.endKm || 0}`, 14, 52);
      doc.text(`Kalan Yemek: ${route.remainingFood || 0}   -   Kalan Ekmek: ${route.remainingBread || 0}`, 14, 57);
      startY = 65;
    }

    const { isLastWorkingDayOfWeek } = await import('@/lib/route-utils');
    const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(route.date));

    // Fetch template to maintain original order
    const template = await db.routeTemplates.where('driverId').equals(route.driverId).first();
    const tStops = template ? await db.routeTemplateStops.where('templateId').equals(template.id!).toArray() : [];

    const sortedStops = [...stops].sort((a, b) => {
      const templateStopA = tStops.find(ts => ts.householdId === a.householdId);
      const templateStopB = tStops.find(ts => ts.householdId === b.householdId);
      if (templateStopA && templateStopB) return templateStopA.order - templateStopB.order;
      if (templateStopA && !templateStopB) return -1;
      if (!templateStopA && templateStopB) return 1;
      return a.order - b.order;
    });

    // Grouping by household for the tutanak
    const groupedStops: any[] = [];
    const processedHouseholdIdsForTutanak = new Set();

    for (const stop of sortedStops) {
      if (processedHouseholdIdsForTutanak.has(stop.householdId)) continue;
      
      const householdStops = sortedStops.filter(s => s.householdId === stop.householdId);
      const standardStop = householdStops.find(s => s.mealType === 'standard' || !s.mealType);
      const breakfastStop = householdStops.find(s => s.mealType === 'breakfast');
      const household = households?.find(h => h.id === stop.householdId);
      
      // Use snapshot values first, even if 0 (0 means they were passive during route generation)
      const memberCount = standardStop?.householdSnapshotMemberCount !== undefined 
        ? standardStop.householdSnapshotMemberCount 
        : (household?.memberCount || 0);
        
      const breadCount = standardStop?.householdSnapshotBreadCount !== undefined 
        ? standardStop.householdSnapshotBreadCount 
        : (household?.breadCount ?? memberCount);
        
      const breakfastCount = breakfastStop 
        ? (breakfastStop.householdSnapshotMemberCount !== undefined ? breakfastStop.householdSnapshotMemberCount : (household?.memberCount || 0)) 
        : 0;
      
      const multiplier = 1;
      
      groupedStops.push({
        id: stop.id,
        name: stop.householdSnapshotName || household?.headName || '',
        address: household?.address || '',
        memberCount,
        food: memberCount * multiplier,
        bread: breadCount * multiplier,
        breakfast: breakfastCount,
        status: standardStop?.status || breakfastStop?.status || 'pending',
        deliveredAt: standardStop?.deliveredAt || breakfastStop?.deliveredAt,
        issueReport: standardStop?.issueReport || breakfastStop?.issueReport || '',
        isManual: standardStop?.isManual || breakfastStop?.isManual,
        isPaused: (household?.pausedUntil && household.pausedUntil >= route.date),
        isDeleted: household?.pausedUntil === '9999-12-31'
      });
      processedHouseholdIdsForTutanak.add(stop.householdId);
    }

    let totalPeople = 0;
    let totalFood = 0;
    let totalBread = 0;
    let totalBreakfast = 0;
    let totalDeliveredFood = 0;

    const tableColumn = ["Sıra", "Hane Sorumlusu", "Adres", "Kişi", "Yemek", "Ekmek", "Kahv.", "Durum", "Saat", "Açıklama"];
    const tableRows = groupedStops.map((gs, i) => {
      totalPeople += gs.memberCount;
      totalFood += gs.food;
      totalBread += gs.bread;
      totalBreakfast += gs.breakfast;
      if (gs.status === 'delivered') {
        totalDeliveredFood += gs.food;
      }
      
      let nameStr = gs.name;
      if (gs.isManual) nameStr = `* ${nameStr}`;
      if (gs.isDeleted) nameStr = `${nameStr} (SİLİNDİ)`;
      else if (gs.isPaused) nameStr = `${nameStr} (PASİF)`;

      return [
        (i + 1).toString(),
        nameStr,
        gs.address,
        gs.memberCount.toString(),
        gs.food.toString(),
        gs.bread.toString(),
        gs.breakfast > 0 ? gs.breakfast.toString() : '-',
        gs.status === 'delivered' ? 'Teslim Edildi' : gs.status === 'failed' ? 'Edilemedi' : 'Bekliyor',
        gs.deliveredAt ? safeFormatTRT(gs.deliveredAt, 'HH:mm') : '-',
        gs.issueReport
      ];
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      foot: [['', 'TOPLAM', '', totalPeople.toString(), totalFood.toString(), totalBread.toString(), totalBreakfast.toString(), `Teslim: ${totalDeliveredFood}`, '', '']],
      showFoot: 'lastPage',
      startY: startY,
      styles: { font: 'Roboto', fontSize: 8, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' },
      footStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0], halign: 'center' },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 50 },
        3: { halign: 'center', cellWidth: 10 },
        4: { halign: 'center', cellWidth: 10 },
        5: { halign: 'center', cellWidth: 10 },
        6: { halign: 'center', cellWidth: 10 },
        8: { halign: 'center', cellWidth: 15 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15;
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    const text = "Yukarıda listelenen adreslere günlük sıcak yemek dağıtımı tarafımca eksiksiz ve hijyen kurallarına uygun olarak yapılmıştır. İşbu tutanak tarafımızca imza altına alınmıştır. (* ile işaretli olanlar rotaya sonradan eklenen hanelerdir.)";
    doc.text(text, 14, finalY, { maxWidth: doc.internal.pageSize.width - 28 });

    const signatureY = finalY + 20;
    
    doc.setFont('Roboto', 'bold');
    doc.text("Teslim Eden (Şoför)", 60, signatureY, { align: 'center' });
    doc.setFont('Roboto', 'normal');
    doc.text(driverName, 60, signatureY + 6, { align: 'center' });
    doc.text("İmza", 60, signatureY + 12, { align: 'center' });

    doc.setFont('Roboto', 'bold');
    doc.text("Vakıf Müdürü", doc.internal.pageSize.width - 60, signatureY, { align: 'center' });
    doc.setFont('Roboto', 'normal');
    doc.text("İmza", doc.internal.pageSize.width - 60, signatureY + 12, { align: 'center' });

    addReportFooter(doc, personnelName);
    await addLog('Rapor İndirme', `${safeFormat(route.date, 'yyyy-MM-dd')} tarihli ${driverName} Günlük Yemek Dağıtım Tutanağı (PDF) indirildi.`);
    doc.save(`Gunluk_Yemek_Dagitim_Tutanagi_${safeFormat(route.date, 'yyyy-MM-dd')}_${driverName.replace(/\s+/g, '_')}.pdf`);
  };

  const exportRouteDetailsPDF = async () => {
    if (!viewRouteDetails) return;
    await generateRouteTutanakPDF(viewRouteDetails, routeDetailsStops);
  };

  const exportWeeklyChecklistPDF = async (driverId: string, startDateStr: string) => {
    const driver = drivers?.find(d => d.id === driverId);
    if (!driver) return;

    const doc = await getTurkishPdf('landscape');
    await addVakifLogo(doc, 14, 10, 15);
    
    doc.setFontSize(14);
    doc.setFont('Roboto', 'bold');
    doc.text('HAFTALIK YEMEK DAĞITIM VE KONTROL LİSTESİ', doc.internal.pageSize.width / 2, 15, { align: 'center' });
    
    const start = new Date(startDateStr);
    const weekDays = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      weekDays.push(d);
    }

    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Şoför: ${driver.name}`, 14, 32);
    doc.text(`Hafta: ${safeFormat(weekDays[0], 'dd.MM.yyyy')} - ${safeFormat(weekDays[4], 'dd.MM.yyyy')}`, doc.internal.pageSize.width - 14, 32, { align: 'right' });

    // Get all routes for this driver in this week
    const weekDates = weekDays.map(d => safeFormat(d, 'yyyy-MM-dd'));
    const weekRoutes = routes?.filter(r => r.driverId === driverId && weekDates.includes(r.date)) || [];
    const weekRouteIds = weekRoutes.map(r => r.id);
    const weekStops = routeStops?.filter(rs => weekRouteIds.includes(rs.routeId)) || [];

    // Sorting households by template order
    const template = await db.routeTemplates.where('driverId').equals(driverId).first();
    const tStops = template ? await db.routeTemplateStops.where('templateId').equals(template.id!).toArray() : [];
    
    // Get unique households in these routes
    const householdIds = Array.from(new Set(weekStops.map(rs => rs.householdId)));
    
    // Sort householdIds by template order
    householdIds.sort((a, b) => {
      const orderA = tStops.find(ts => ts.householdId === a)?.order || 9999;
      const orderB = tStops.find(ts => ts.householdId === b)?.order || 9999;
      return orderA - orderB;
    });

    const previousWeekStart = addDays(start, -7);
    const previousWeekEnd = addDays(start, -1);
    const prevStartDateStr = safeFormat(previousWeekStart, 'yyyy-MM-dd');
    const prevEndDateStr = safeFormat(previousWeekEnd, 'yyyy-MM-dd');

    const tableColumn = ["Sıra", "Hane Adı", "Adres", ...weekDays.map(d => safeFormat(d, 'EEEE').substring(0, 3)), "Açıklama (Geçen Hafta)"];
    const tableRows = householdIds.map((hId, index) => {
      const h = households?.find(hh => hh.id === hId);
      
      // Calculate previous week summary for this household
      const hHistory = h?.history || [];
      const isNew = hHistory.some(hist => 
        hist.action === 'created' && 
        safeFormat(new Date((hist as any).timestamp || (hist as any).date), 'yyyy-MM-dd') >= prevStartDateStr && 
        safeFormat(new Date((hist as any).timestamp || (hist as any).date), 'yyyy-MM-dd') <= prevEndDateStr
      );

      let prevWeekNote = '';
      const prevStops = routeStops?.filter(rs => 
        rs.householdId === hId && 
        rs.status === 'delivered'
      ) || [];
      
      const servedDates: string[] = [];
      for (const ps of prevStops) {
        const r = routes?.find(route => route.id === ps.routeId);
        if (r && r.date >= prevStartDateStr && r.date <= prevEndDateStr) {
          servedDates.push(safeFormat(new Date(r.date), 'EEEE').substring(0, 3));
        }
      }
      
      const uniqueDates = Array.from(new Set(servedDates));
      
      if (uniqueDates.length > 0) {
        prevWeekNote = `${uniqueDates.join(', ')} günleri teslim edildi.`;
      } else {
        prevWeekNote = 'Geçen hafta teslim edilmedi.';
      }

      if (isNew) {
        prevWeekNote = `(Yeni Kayıt) ` + prevWeekNote;
      }

      const row = [
        (index + 1).toString(),
        h?.headName || 'Bilinmeyen',
        h?.address || '',
      ];

      const reportDateStr = safeFormat(new Date(), 'yyyy-MM-dd');

      weekDates.forEach(dateStr => {
        const route = weekRoutes.find(r => r.date === dateStr);
        const isPaused = h && !h.isActive && h.pausedUntil && h.pausedUntil >= dateStr && h.pausedUntil !== '9999-12-31';

        if (isPaused && h?.pausedUntil) {
           row.push(`${safeFormat(new Date(h.pausedUntil), 'dd.MM')} tarihine kadar pasiftir ve yemek bırakılmayacaktır.`);
        } else {
            if (dateStr < reportDateStr) {
              if (!route) {
                row.push('-');
              } else {
                const stop = weekStops.find(rs => rs.routeId === route.id && rs.householdId === hId && rs.mealType !== 'breakfast');
                if (!stop) row.push('-');
                else row.push(stop.status === 'delivered' ? 'TESLİM EDİLDİ' : stop.status === 'failed' ? 'TESLİM EDİLMEDİ' : '-');
              }
            } else {
              row.push(''); // Boş satır (gelecek/bugün)
            }
        }
      });

      row.push(prevWeekNote);
      return row;
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: 'grid',
      styles: { font: 'Roboto', fontSize: 7, cellPadding: 1.5, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
      alternateRowStyles: { fillColor: [250, 250, 250] },
      columnStyles: {
        0: { halign: 'center', cellWidth: 8 },
        1: { cellWidth: 35 },
        2: { cellWidth: 50 },
        // Geri kalan günler otomatik yayılacak
        8: { cellWidth: 35, fontSize: 6 } // Açıklama column
      }
    });

    addReportFooter(doc, personnelName);
    await addLog('Rapor İndirme', `${startDateStr} haftasına ait ${driver.name} Haftalık Çizelge (PDF) indirildi.`);
    doc.save(`Haftalik_Cizelge_${driver.name.replace(/\s+/g, '_')}_${startDateStr}.pdf`);
  };

  const exportHistoryPDF = async (months: number) => {
    const doc = await getTurkishPdf('landscape');
    const startDate = subMonths(new Date(), months);
    const filteredLogs = systemLogs?.filter(log => new Date(log.timestamp) >= startDate) || [];

    await addVakifLogo(doc, 14, 10, 20);

    doc.setFontSize(12);
    doc.setFont('Roboto', 'bold');
    doc.text('T.C.', doc.internal.pageSize.width / 2, 15, { align: 'center' });
    doc.text('SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI BAŞKANLIĞI', doc.internal.pageSize.width / 2, 22, { align: 'center' });
    
    doc.setFontSize(14);
    doc.text(`İŞLEM GEÇMİŞİ RAPORU (SON ${months} AY)`, doc.internal.pageSize.width / 2, 35, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setFont('Roboto', 'normal');
    doc.text(`Rapor Tarihi: ${safeFormatTRT(new Date(), 'dd.MM.yyyy HH:mm')}`, doc.internal.pageSize.width - 14, 15, { align: 'right' });

    const tableColumn = ["Tarih", "İşlem", "Detay", "Personel", "Kategori"];
    const tableRows = filteredLogs.map(log => [
      safeFormatTRT(log.timestamp, 'dd.MM.yyyy HH:mm'),
      log.action,
      log.details || '-',
      log.personnelName,
      log.category.toUpperCase()
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      styles: { font: 'Roboto', fontSize: 9, lineColor: [0, 0, 0], lineWidth: 0.1 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      headStyles: { font: 'Roboto', fontStyle: 'bold', fillColor: [240, 240, 240], textColor: [0, 0, 0] }
    });

    addReportFooter(doc, personnelName);
    await addLog('Rapor İndirme', `Son ${months} aylık İşlem Geçmişi Raporu (PDF) indirildi.`);
    doc.save(`Islem_Gecmisi_Son_${months}_Ay.pdf`);
  };

  const moveHouseholdToTemplate = async (householdId: string, targetDriverId: string) => {
    if (!targetDriverId) return;
    const targetTemplate = routeTemplates?.find(t => t.driverId === targetDriverId);
    if (!targetTemplate) {
      toast.error('Hedef şoförün henüz bir ana rotası yok. Önce hedef şoför için bir ana rota oluşturun.');
      return;
    }

    const loadingToast = toast.loading('Hane taşınıyor...');
    try {
      // Remove from current template if editing
      if (editingTemplate) {
        const currentStop = routeTemplateStops?.find(ts => ts.templateId === editingTemplate.id && ts.householdId === householdId);
        if (currentStop) {
          await db.routeTemplateStops.delete(currentStop.id!);
        }
      }

      // Remove from current selected (if in modal)
      setSelectedHouseholds(prev => {
        const filtered = prev.filter(h => h.householdId !== householdId);
        return filtered.map((h, i) => ({ ...h, order: i + 1 }));
      });
      
      // Add to target template in DB
      const targetStops = routeTemplateStops?.filter(ts => ts.templateId === targetTemplate.id) || [];
      await db.routeTemplateStops.add({
        templateId: targetTemplate.id!,
        householdId: householdId,
        order: targetStops.length + 1
      });

      // Sync with daily routes (if pending)
      const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
      const nextDay = await getNextWorkingDay(new Date());
      const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');
      
      const syncDates = [todayStr, nextDayStr];
      for (const dateStr of syncDates) {
        const allRoutesOnDate = await db.routes.where('date').equals(dateStr).toArray();
        const sourceRoute = allRoutesOnDate.find(r => r.driverId === selectedDriverId && r.status === 'pending');
        const targetRoute = allRoutesOnDate.find(r => r.driverId === targetDriverId && r.status === 'pending');

        if (sourceRoute) {
          await db.routeStops.where({ routeId: sourceRoute.id!, householdId: householdId }).delete();
        }
        if (targetRoute) {
          const h = await db.households.get(householdId);
          const tStops = await db.routeStops.where('routeId').equals(targetRoute.id!).toArray();
          
          const stopsToAdd: RouteStop[] = [];
          const isLastWorkingDay = await isLastWorkingDayOfWeek(new Date(dateStr));
          
          let nextOrder = tStops.length > 0 ? Math.max(...tStops.map((t: RouteStop) => t.order)) + 1 : 1;

          // Standard Meal
          stopsToAdd.push({
            routeId: targetRoute.id!,
            householdId: householdId,
            householdSnapshotName: h?.headName || '',
            householdSnapshotMemberCount: h?.memberCount || 0,
            householdSnapshotBreadCount: h?.breadCount ?? h?.memberCount ?? 0,
            status: 'pending',
            order: nextOrder++,
            mealType: 'standard'
          });

          // Breakfast Meal
          if (isLastWorkingDay && !h?.noBreakfast) {
            stopsToAdd.push({
              routeId: targetRoute.id!,
              householdId: householdId,
              householdSnapshotName: `${h?.headName} (Kahvaltı)`,
              householdSnapshotMemberCount: h?.memberCount || 0,
              householdSnapshotBreadCount: 0,
              status: 'pending',
              order: nextOrder++,
              mealType: 'breakfast'
            });
          }

          if (stopsToAdd.length > 0) {
              await db.routeStops.bulkAdd(stopsToAdd);
          }
        }
      }

      const h = households?.find(hh => hh.id === householdId);
      const targetDriver = drivers?.find(d => d.id === targetDriverId);
      await addLog('Hane Rota Değişikliği', `${h?.headName} hanesi ${targetDriver?.name} şoförünün ana rotasına taşındı.`);
      
      toast.success('Hane başarıyla taşındı', { id: loadingToast });
      notifyDbChange();
    } catch (error) {
      console.error(error);
      toast.error('Hane taşınırken bir hata oluştu', { id: loadingToast });
    }
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-gray-900">Rotalar</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('daily')}
            className={`px-4 py-2 rounded-md font-medium ${activeTab === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
          >
            Günlük Rotalar
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-md font-medium ${activeTab === 'templates' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-300'}`}
          >
            Ana Rotalar (Sürekli)
          </button>
        </div>
      </div>

      {activeTab === 'daily' && (
        <>
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarih Seçin</label>
                <input
                  type="date"
                  value={selectedDate}
                  min="2026-04-14"
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 w-full md:w-auto"
                />
              </div>
            </div>
            {!isDemo && (
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <button
                  onClick={handleAutoGenerateRoutesForSelectedDate}
                  className="flex-1 lg:flex-none bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center justify-center shadow-sm text-sm"
                >
                  <Plus size={20} className="mr-2" />
                  Tüm Şoförler İçin Rota Oluştur
                </button>
                <button
                  onClick={handleGenerateVakifPickupRoute}
                  className="flex-1 lg:flex-none bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center justify-center shadow-sm text-sm"
                >
                  <Plus size={20} className="mr-2" />
                  Vakıf Listesi
                </button>
                <button
                  onClick={() => openModal()}
                  className="flex-1 lg:flex-none bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center justify-center shadow-sm text-sm"
                >
                  <Plus size={20} className="mr-2" />
                  Yeni Rota
                </button>
              </div>
            )}
          </div>

          <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tarih</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Şoför</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hane / Kişi</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {routesOnDate.map((route) => {
                  const stops = stopsOnDate?.filter(s => s.routeId === route.id) || [];
                  const uniqueHouseholds = new Set(stops.map(s => s.householdId));
                  
                  let householdCount = 0;
                  let institutionCount = 0;
                  let householdPeople = 0;
                  let institutionPeople = 0;

                  Array.from(uniqueHouseholds).forEach(hId => {
                    const firstStop = stops.find(s => s.householdId === hId);
                    const memberCount = firstStop?.householdSnapshotMemberCount || 0;
                    const h = households?.find(hh => hh.id === hId);
                    const isInstitution = h?.type === 'institution';

                    if (memberCount > 0) {
                      if (isInstitution) {
                        institutionCount++;
                        institutionPeople += memberCount;
                      } else {
                        householdCount++;
                        householdPeople += memberCount;
                      }
                    }
                  });

                  return (
                    <tr key={route.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="bg-slate-100 p-2 rounded-xl text-slate-500">
                            <Clock size={16} />
                          </div>
                          <span className="text-sm font-black text-slate-900">{safeFormat(route.date, 'dd.MM.yyyy')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{route.driverSnapshotName || getDriverName(route.driverId)}</span>
                          <span className="text-[10px] text-slate-400 font-bold tracking-widest">{route.driverId === 'vakif_pickup' ? 'SİSTEM LİSTESİ' : (drivers?.find(d => d.id === route.driverId)?.vehiclePlate || 'OTOMATİK')}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Users className="text-indigo-500" size={14} />
                            <span className="text-sm font-black text-slate-900">{householdCount + institutionCount} <span className="text-slate-400 font-bold font-sans">HANEYE</span></span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShoppingBasket className="text-amber-500" size={14} />
                            <span className="text-sm font-black text-slate-900">{householdPeople + institutionPeople} <span className="text-slate-400 font-bold font-sans">PORSİYON</span></span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm ${
                          route.status === 'approved' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                          route.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                          route.status === 'in_progress' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-2 ${
                            route.status === 'approved' ? 'bg-purple-600' :
                            route.status === 'completed' ? 'bg-green-600' :
                            route.status === 'in_progress' ? 'bg-blue-600 animate-pulse' :
                            'bg-amber-600 animate-pulse'
                          }`} />
                          {route.status === 'approved' ? 'ONAYLANDI' :
                           route.status === 'completed' ? 'TAMAMLANDI' : 
                           route.status === 'in_progress' ? 'DAĞITIMDA' : 'BEKLİYOR'}
                        </span>
                      </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {route.status === 'pending' && (safeFormat(new Date(), 'yyyy-MM-dd') > route.date || (safeFormat(new Date(), 'yyyy-MM-dd') === route.date && new Date().getHours() >= 11)) && (
                          <button
                            onClick={async () => {
                              setRouteForLeftover(route);
                              setManualLeftoverBread(0);
                              const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
                              // Initialize all as delivered by default for manual completion
                              setLeftoverStops(stops.map((s: RouteStop) => ({ ...s, status: s.status === 'pending' ? 'delivered' : s.status })));
                              setIsManualCompletion(true);
                              setIsLeftoverModalOpen(true);
                            }}
                            className="text-orange-600 hover:text-orange-900 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-200"
                            title="Teslim Almayanları Gir ve Tamamla"
                          >
                            <CheckCircle size={16} />
                            <span className="text-xs">Tamamla</span>
                          </button>
                        )}
                        {route.status === 'completed' && (
                          <button
                            onClick={() => handleApproveRoute(route)}
                            className="text-purple-600 hover:text-purple-900 flex items-center gap-1 bg-purple-50 px-2 py-1 rounded border border-purple-200"
                            title="Listeyi Onayla ve Raporu İndir"
                          >
                            <CheckCircle size={16} />
                            <span className="text-xs">Onayla</span>
                          </button>
                        )}
                        {route.status === 'pending' && route.driverId !== 'vakif_pickup' && systemSettings?.isDistributionPanelActive === false && (safeFormat(new Date(), 'yyyy-MM-dd') > route.date || (safeFormat(new Date(), 'yyyy-MM-dd') === route.date && new Date().getHours() >= 11)) && (
                          <button
                            onClick={async () => {
                              setRouteForLeftover(route);
                              setManualLeftoverBread(0);
                              const stops = await db.routeStops.where('routeId').equals(route.id!).toArray();
                              // Initialize all as delivered by default for manual completion
                              setLeftoverStops(stops.map((s: RouteStop) => ({ ...s, status: s.status === 'pending' ? 'delivered' : s.status })));
                              setIsManualCompletion(true);
                              setIsLeftoverModalOpen(true);
                            }}
                            className="text-orange-600 hover:text-orange-900 flex items-center gap-1 bg-orange-50 px-2 py-1 rounded border border-orange-200"
                            title="Artan Ekmek Gir ve Tamamla"
                          >
                            <CheckCircle size={16} />
                            <span className="text-xs">Tamamla</span>
                          </button>
                        )}
                        {route.status === 'completed' && route.completedByPersonnel && (
                          <button
                            onClick={() => handleUndoPersonnelCompletion(route)}
                            className="text-red-600 hover:text-red-900 flex items-center gap-1 bg-red-50 px-2 py-1 rounded border border-red-200"
                            title="İşlemi Geri Al (17:30'a kadar)"
                          >
                            <History size={16} />
                            <span className="text-xs">Geri Al</span>
                          </button>
                        )}
                        <button onClick={() => exportDriverManifestPDF(route)} className="text-green-600 hover:text-green-900" title="Şoför Dağıtım Listesi (PDF)">
                          <FileText size={18} />
                        </button>
                        <button onClick={() => openRouteDetails(route)} className="text-blue-600 hover:text-blue-900" title="Detayları Gör">
                          <Eye size={18} />
                        </button>
                        {!isDemo && route.status !== 'completed' && route.status !== 'approved' && (
                          <button onClick={() => deleteRoute(route.id!)} className="text-red-600 hover:text-red-900" title="Sil">
                            <Trash2 size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  );
                })}
                {routesOnDate.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500">
                      Bu tarih için henüz rota oluşturulmamış.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <>
          {!isDemo && (
            <div className="flex justify-end mb-4">
              <button
                onClick={() => openTemplateModal()}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 flex items-center"
              >
                <Plus size={20} className="mr-2" />
                Yeni Şablon Rota
              </button>
            </div>
          )}

          <div className="bg-white shadow-sm rounded-lg overflow-x-auto border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Şoför</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hane / Kişi</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeDrivers?.map((driver) => {
                  const template = routeTemplates?.find(rt => rt.driverId === driver.id);
                  const tStops = template ? (routeTemplateStops?.filter(ts => String(ts.templateId) === String(template.id)) || []) : [];
                  
                  let householdCount = 0;
                  let institutionCount = 0;
                  let householdPeople = 0;
                  let institutionPeople = 0;

                  tStops.forEach(ts => {
                    const h = households?.find(hh => hh.id === ts.householdId);
                    const isInstitution = h?.type === 'institution';
                    const memberCount = h?.memberCount || 0;

                    if (isInstitution) {
                      institutionCount++;
                      institutionPeople += memberCount;
                    } else {
                      householdCount++;
                      householdPeople += memberCount;
                    }
                  });
                  
                  return (
                    <tr key={driver.id}>
                      <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm font-medium text-gray-900">
                        {driver.name} ({driver.vehiclePlate})
                      </td>
                      <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-sm text-gray-500">
                        {template ? (
                          <>
                            <div className="font-medium text-gray-900">
                              {householdCount} Hane {institutionCount > 0 && <span className="text-blue-600">/ {institutionCount} Kurum</span>}
                            </div>
                            <div className="text-xs text-gray-500">
                              {householdPeople} Kişi {institutionPeople > 0 && <span className="text-blue-600">/ {institutionPeople} Kurum Kişisi</span>}
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400 italic">Şablon Oluşturulmamış</span>
                        )}
                      </td>
                    <td className="px-6 py-4 whitespace-normal break-words min-w-[120px] text-right text-sm font-medium">
                      {template && (
                        <button 
                          onClick={() => exportWeeklyChecklistPDF(driver.id!, safeFormat(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd'))} 
                          className="text-indigo-600 hover:text-indigo-900 mr-3"
                          title="Haftalık Çizelge Al"
                        >
                          <FileText size={18} />
                        </button>
                      )}
                      {!isDemo && (
                        <>
                          <button onClick={() => openTemplateModal(template || { driverId: driver.id!, createdAt: new Date() } as RouteTemplate)} className="text-blue-600 hover:text-blue-900 mr-3">
                            {template ? <Edit2 size={18} /> : <Plus size={18} />}
                          </button>
                          {template && (
                            <button onClick={() => deleteTemplate(template.id!)} className="text-red-600 hover:text-red-900">
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </td>
                    </tr>
                  );
                })}
                {(!activeDrivers || activeDrivers.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-6 py-4 text-center text-sm text-gray-500">
                      Henüz aktif şoför bulunmuyor.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Route Completion Statistics Cards */}
      <div className="mt-12">
        <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2">
          <History className="text-blue-600" size={24} />
          Günlük Dağıtım İstatistikleri ({safeFormat(selectedDate, 'dd MMMM yyyy')})
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Driver Routes Completion Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Şoför Rotaları</p>
                <h4 className="text-2xl font-black text-gray-900">Genel Tamamlanma</h4>
              </div>
              <div className="p-3 bg-blue-50 rounded-2xl">
                <BarChart3 className="text-blue-600" size={24} />
              </div>
            </div>
            
            {(() => {
              const todaysRoutes = routes?.filter(r => r.date === selectedDate) || [];
              const totalRoutes = todaysRoutes.length;
              const completedRoutes = todaysRoutes.filter(r => r.status === 'completed' || r.status === 'approved').length;
              const ratio = totalRoutes > 0 ? Math.round((completedRoutes / totalRoutes) * 100) : 0;
              
              return (
                <div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black text-gray-900">%{ratio}</span>
                    <span className="text-sm font-bold text-gray-500 pb-1">{completedRoutes} / {totalRoutes} Rota</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-blue-600 h-3 rounded-full transition-all duration-1000" 
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <p className="mt-4 text-sm text-gray-500 font-medium">
                    {totalRoutes === 0 ? 'Bugün için tanımlı rota bulunmuyor.' : completedRoutes === totalRoutes ? 'Tüm şoför rotaları başarıyla tamamlandı.' : 'Bazı rotalar henüz tamamlanmadı.'}
                  </p>
                </div>
              );
            })()}
          </div>

          {/* Self-Service (Vakıf) Completion Card */}
          <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Vakıf (Elden Teslim)</p>
                <h4 className="text-2xl font-black text-gray-900">Günlük Teslimat Oranı</h4>
              </div>
              <div className="p-3 bg-green-50 rounded-2xl">
                <Info className="text-green-600" size={24} />
              </div>
            </div>

            {(() => {
              const selfServiceHouseholds = households?.filter(h => h.isSelfService && h.isActive) || [];
              const totalEntities = selfServiceHouseholds.length;
              
              const householdCount = selfServiceHouseholds.filter(h => !h.type || h.type === 'household').length;
              const institutionCount = selfServiceHouseholds.filter(h => h.type === 'institution').length;

              // Find deliveries for self-service households today
              const todaysStops = routeStops?.filter(s => {
                const route = routes?.find(r => r.id === s.routeId);
                return route?.date === selectedDate;
              }) || [];
              
              const selfServiceCompleted = selfServiceHouseholds.filter(h => 
                todaysStops.some(s => s.householdId === h.id && (s.status === 'delivered' || s.status === 'failed'))
              ).length;

              const ratio = totalEntities > 0 ? Math.round((selfServiceCompleted / totalEntities) * 100) : 0;

              return (
                <div>
                  <div className="flex items-end gap-2 mb-2">
                    <span className="text-4xl font-black text-gray-900">%{ratio}</span>
                    <span className="text-sm font-bold text-gray-500 pb-1">
                      {selfServiceCompleted} / {totalEntities} {institutionCount > 0 ? 'Kayıt' : 'Hane'}
                    </span>
                  </div>
                  {institutionCount > 0 && (
                    <div className="flex gap-2 mb-3 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                      <span>{householdCount} HANE</span>
                      <span>•</span>
                      <span className="text-blue-600">{institutionCount} KURUM</span>
                    </div>
                  )}
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div 
                      className="bg-green-600 h-3 rounded-full transition-all duration-1000" 
                      style={{ width: `${ratio}%` }}
                    />
                  </div>
                  <p className="mt-4 text-sm text-gray-500 font-medium">
                    {totalEntities === 0 ? 'Bugün için vakıf teslimatı bekleyen kayıt yok.' : selfServiceCompleted === totalEntities ? 'Tüm vakıf teslimatları tamamlandı.' : 'Bazı vakıf teslimatları henüz işlenmedi.'}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {isLeftoverModalOpen && routeForLeftover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Rota Tamamlama</h3>
              <button onClick={() => setIsLeftoverModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                <p className="text-sm text-blue-900 font-medium mb-1">Rota Bilgisi:</p>
                <p className="text-sm text-blue-700">
                  {getDriverName(routeForLeftover.driverId)} - {safeFormat(routeForLeftover.date, 'dd.MM.yyyy')}
                </p>
              </div>

              <div className="border rounded-xl overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Hane</th>
                      <th className="px-4 py-2 text-center text-xs font-bold text-gray-500 uppercase">Durum</th>
                      <th className="px-4 py-2 text-left text-xs font-bold text-gray-500 uppercase">Açıklama (Hata Varsa)</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leftoverStops.map((stop, idx) => (
                      <tr key={stop.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {stop.householdSnapshotName}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <select
                            value={stop.status}
                            onChange={(e) => {
                              const newStops = [...leftoverStops];
                              newStops[idx].status = e.target.value as any;
                              setLeftoverStops(newStops);
                            }}
                            className={`text-xs font-bold rounded-md border-gray-300 p-1 ${
                              stop.status === 'delivered' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
                            }`}
                          >
                            <option value="delivered">Teslim Edildi</option>
                            <option value="failed">Edilemedi</option>
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          {stop.status === 'failed' && (
                            <input
                              type="text"
                              value={stop.issueReport || ''}
                              onChange={(e) => {
                                const newStops = [...leftoverStops];
                                newStops[idx].issueReport = e.target.value;
                                setLeftoverStops(newStops);
                              }}
                              className="w-full text-xs border-gray-300 rounded-md p-1"
                              placeholder="Neden?"
                            />
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-2">Artan Ekmek Sayısı</label>
                <input
                  type="number"
                  value={manualLeftoverBread}
                  onChange={(e) => setManualLeftoverBread(parseInt(e.target.value) || 0)}
                  className="w-full text-xl font-bold text-center border-2 border-gray-300 rounded-xl p-2 focus:ring-blue-500 focus:border-blue-500"
                  min="0"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-6 border-t mt-6">
              <button
                onClick={() => setIsLeftoverModalOpen(false)}
                className="flex-1 bg-white py-3 px-4 border border-gray-300 rounded-xl text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Vazgeç
              </button>
              <button
                onClick={handleManualLeftoverEntry}
                className="flex-1 bg-blue-600 py-3 px-4 border border-transparent rounded-xl text-sm font-bold text-white hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                Tamamla
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Yeni Rota Oluştur</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={onSubmit} className="flex-1 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tarih</label>
                    <input
                      type="date"
                      value={selectedDate}
                      min="2026-04-14"
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şoför</label>
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white"
                      required
                    >
                      <option value="">Şoför Seçin</option>
                      {activeDrivers?.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.vehiclePlate})</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                  <div className="w-full sm:flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Hane Ara</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="İsim, adres, TC veya hane no..."
                        value={dailySearchTerm}
                        onChange={(e) => setDailySearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      />
                      <div className="absolute left-3 top-2.5 text-gray-400">
                        <Eye size={16} className="opacity-50" />
                      </div>
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Sıralama</label>
                    <select
                      value={`${dailySortField}-${dailySortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        setDailySortField(field as any);
                        setDailySortOrder(order as any);
                      }}
                      className="w-full text-sm border border-gray-300 rounded-md p-2 bg-white shadow-sm"
                    >
                      <option value="headName-asc">İsim (A-Z)</option>
                      <option value="headName-desc">İsim (Z-A)</option>
                      <option value="address-asc">Adres (A-Z)</option>
                      <option value="address-desc">Adres (Z-A)</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto bg-white">
                <div className="flex justify-between items-center mb-4">
                  <h4 className="text-sm font-bold text-gray-900">Seçilebilir Haneler ({filteredDailyHouseholds?.length || 0})</h4>
                  <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                    {selectedHouseholds.length} Hane Seçildi
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredDailyHouseholds?.map(h => (
                    <div 
                      key={h.id} 
                      onClick={() => toggleHousehold(h.id!)}
                      className={`p-4 border rounded-xl cursor-pointer transition-all duration-200 shadow-sm flex flex-col justify-between group ${
                        selectedHouseholds.some(sh => sh.householdId === h.id) 
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-500 ring-opacity-50' 
                          : 'border-gray-200 hover:border-blue-400 hover:shadow-md bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold truncate ${selectedHouseholds.some(sh => sh.householdId === h.id) ? 'text-blue-900' : 'text-gray-900'}`}>
                            {h.headName}
                          </p>
                          <p className="text-xs text-gray-500 truncate mt-1 flex items-center">
                            <ArrowRight size={12} className="mr-1 text-gray-300" />
                            {h.address}
                          </p>
                        </div>
                        <div className={`ml-3 p-1.5 rounded-full transition-colors ${
                          selectedHouseholds.some(sh => sh.householdId === h.id) 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200'
                        }`}>
                          <CheckCircle size={18} />
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-auto pt-3 border-t border-gray-100">
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-gray-100 text-gray-700 uppercase tracking-wider">
                          {h.memberCount} Kişi
                        </span>
                        {h.householdNo && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider">
                            No: {h.householdNo}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredDailyHouseholds?.length === 0 && (
                    <div className="col-span-2 text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                      <div className="bg-white p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <Eye className="text-gray-300" size={32} />
                      </div>
                      <p className="text-gray-500 font-medium">Aranan kriterlere uygun hane bulunamadı.</p>
                      <button 
                        type="button"
                        onClick={() => setDailySearchTerm('')}
                        className="mt-4 text-blue-600 text-sm font-bold hover:underline"
                      >
                        Aramayı Temizle
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
                >
                  Rotayı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {viewRouteDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">
                Rota Detayları - {viewRouteDetails.driverSnapshotName || getDriverName(viewRouteDetails.driverId)} ({safeFormat(viewRouteDetails.date, 'dd.MM.yyyy')})
              </h3>
              <button onClick={() => setViewRouteDetails(null)} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto">
              {viewRouteDetails.status === 'completed' && differenceInDays(new Date(), new Date(viewRouteDetails.date)) > 2 && (
                <div className="mb-4 p-4 bg-yellow-50 text-yellow-800 rounded-lg border border-yellow-200 flex items-center">
                  <AlertTriangle className="w-5 h-5 mr-2" />
                  <p className="font-medium text-sm">Bu rota tamamlanalı 2 günden fazla olduğu için üzerinde değişiklik yapılamaz.</p>
                </div>
              )}
              {viewRouteDetails.status === 'approved' && (
                <div className="mb-4 p-4 bg-green-50 text-green-800 rounded-lg border border-green-200 flex items-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <p className="font-medium text-sm">Bu rota yönetici tarafından onaylanmıştır. Onaylanmış rotalar üzerinde değişiklik yapılamaz.</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4 mb-6 bg-gray-50 p-4 rounded-lg">
                <div>
                  <p className="text-sm text-gray-500">Başlangıç KM</p>
                  <p className="font-medium">{viewRouteDetails.startKm || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Bitiş KM</p>
                  <p className="font-medium">{viewRouteDetails.endKm || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Kalan Yemek</p>
                  <p className="font-medium">{viewRouteDetails.remainingFood || 0}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Kalan Ekmek</p>
                  <p className="font-medium">{viewRouteDetails.remainingBread || 0}</p>
                </div>
              </div>

              {((isEditingRouteDetails ? editRouteStopsData : routeDetailsStops).some(s => s.lat && s.lng)) && (
                <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-600 p-2 rounded-lg text-white">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Konum Verileri Mevcut</p>
                      <p className="text-xs text-gray-600">Teslimat sırasında kaydedilen koordinatları haritada inceleyin.</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                        // For simplicity, we open the first coordinate found to show the map
                        const firstWithCoord = (isEditingRouteDetails ? editRouteStopsData : routeDetailsStops).find(s => s.lat && s.lng);
                        if (firstWithCoord) {
                          setMapModalData({ 
                            lat: firstWithCoord.lat!, 
                            lng: firstWithCoord.lng!, 
                            title: firstWithCoord.householdSnapshotName || 'Teslimat Noktası' 
                          });
                        }
                    }}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Haritayı Aç
                  </button>
                </div>
              )}
              
              <h4 className="font-medium text-gray-900 mb-4">Teslimat Noktaları</h4>
              <div className="overflow-x-auto mb-6">
                <table className="min-w-full divide-y divide-gray-200 border">
                  {/* ... Delivery points table ... */}
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Hane</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kişi</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Durum</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Saat</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                  {(isEditingRouteDetails ? editRouteStopsData : routeDetailsStops).map((stop, idx) => {
                    const household = households?.find(h => h.id === stop.householdId);
                    const isDeleted = household?.pausedUntil === '9999-12-31';
                    const isPaused = household?.pausedUntil && household.pausedUntil >= viewRouteDetails.date;

                    return (
                      <tr key={idx} className={isDeleted ? 'bg-red-50' : isPaused ? 'bg-orange-50' : ''}>
                        <td className="px-4 py-2 text-sm text-gray-900">
                          {stop.householdSnapshotName}
                          {isDeleted && <span className="ml-2 text-xs text-red-600 font-bold">[SİLİNDİ]</span>}
                          {isPaused && <span className="ml-2 text-xs text-orange-600 font-bold">[PASİF]</span>}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">{stop.householdSnapshotMemberCount}</td>
                        <td className="px-4 py-2 text-sm">
                          {isEditingRouteDetails ? (
                            <select
                              value={stop.status}
                              onChange={(e) => {
                                const newStops = [...editRouteStopsData];
                                newStops[idx].status = e.target.value as any;
                                setEditRouteStopsData(newStops);
                              }}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-1"
                            >
                              <option value="pending">Bekliyor</option>
                              <option value="delivered">Teslim Edildi</option>
                              <option value="failed">Edilemedi</option>
                            </select>
                          ) : (
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${stop.status === 'delivered' ? 'bg-green-100 text-green-800' : 
                                stop.status === 'failed' ? 'bg-red-100 text-red-800' : 
                                'bg-yellow-100 text-yellow-800'}`}>
                              {stop.status === 'delivered' ? 'Teslim Edildi' : stop.status === 'failed' ? 'Edilemedi' : 'Bekliyor'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          <div className="flex items-center gap-2">
                            {stop.deliveredAt ? safeFormatTRT(stop.deliveredAt, 'HH:mm') : '-'}
                            {stop.lat && stop.lng && (
                              <button
                                onClick={() => setMapModalData({ lat: stop.lat!, lng: stop.lng!, title: stop.householdSnapshotName || 'Teslimat Noktası' })}
                                className="text-blue-600 hover:text-blue-800 p-1 bg-blue-50 rounded"
                                title="Haritada Gör"
                              >
                                <MapPin size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {isEditingRouteDetails && stop.status === 'failed' ? (
                            <input
                              type="text"
                              value={stop.issueReport || ''}
                              onChange={(e) => {
                                const newStops = [...editRouteStopsData];
                                newStops[idx].issueReport = e.target.value;
                                setEditRouteStopsData(newStops);
                              }}
                              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-1"
                              placeholder="Açıklama"
                            />
                          ) : (
                            stop.issueReport || '-'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              </div>
              
              {viewRouteDetails.history && viewRouteDetails.history.length > 0 && (
                <div className="mt-8">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock className="text-orange-500" size={20} />
                    Mola ve Görev Geçmişi
                  </h4>
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:via-slate-300 before:to-slate-200">
                      {viewRouteDetails.history
                        .filter((record: any) => {
                          if (record.action === 'paused' || record.action === 'resumed') {
                            const recordDateStr = safeFormat(new Date(record.timestamp || record.date), 'yyyy-MM-dd');
                            return recordDateStr === viewRouteDetails.date;
                          }
                          return true;
                        })
                        .map((record: any, idx: number) => (
                        <div key={idx} className={`relative flex items-center justify-between md:justify-normal group is-active ${idx % 2 === 0 ? 'md:flex-row-reverse' : ''}`}>
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 shrink-0 md:order-1 shadow-sm z-10 ${
                            record.action === 'paused' ? 'bg-orange-500 text-white' : 
                            record.action === 'resumed' ? 'bg-blue-500 text-white' : 
                            'bg-slate-400 text-white'
                          } md:group-even:-translate-x-1/2 md:group-odd:translate-x-1/2`}>
                            {record.action === 'paused' ? <Clock size={16} /> : 
                             record.action === 'resumed' ? <Navigation size={16} /> : 
                             <CheckCircle size={16} />}
                          </div>
                          <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col">
                            <span className="font-black text-slate-800 text-sm">
                              {record.action === 'paused' ? 'Mola Verildi' : 
                               record.action === 'resumed' ? 'Göreve Devam Edildi' : 
                               record.action === 'manual_completion' ? 'Manuel Tamamlandı' : 
                               record.action === 'created' ? 'Oluşturuldu' : 
                               record.action === 'auto_completed' ? 'Otomatik Tamamlandı' : 'Tamamlandı'}
                            </span>
                            <span className="text-xs text-slate-500 mt-1.5 font-bold uppercase tracking-wider">
                              {safeFormatTRT(record.timestamp || record.date, 'HH:mm')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              {viewRouteDetails.status === 'completed' && differenceInDays(new Date(), new Date(viewRouteDetails.date)) <= 2 && (
                <>
                  {!isEditingRouteDetails ? (
                    <>
                      <button
                        onClick={() => setIsEditingRouteDetails(true)}
                        className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 flex items-center mr-2"
                      >
                        <Edit2 size={16} className="mr-2" />
                        Düzenle
                      </button>
                      <button
                        onClick={() => handleApproveRoute(viewRouteDetails)}
                        className="bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 flex items-center mr-auto"
                      >
                        Rotayı Onayla
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setIsEditingRouteDetails(false);
                          setEditRouteStopsData(JSON.parse(JSON.stringify(routeDetailsStops)));
                        }}
                        className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 mr-2"
                      >
                        İptal
                      </button>
                      <button
                        onClick={handleSaveRouteEdits}
                        className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 flex items-center mr-auto"
                      >
                        Kaydet
                      </button>
                    </>
                  )}
                </>
              )}
              {viewRouteDetails.status === 'approved' && (
                <div className="mr-auto flex items-center text-green-600 font-medium text-sm bg-green-50 px-4 py-2 rounded-md">
                  Onaylanmış Rota
                </div>
              )}
              <button
                onClick={() => {
                  setViewRouteDetails(null);
                  setIsEditingRouteDetails(false);
                }}
                className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Kapat
              </button>
              <button
                onClick={exportRouteDetailsPDF}
                className="bg-red-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-red-700 flex items-center"
              >
                <FileText size={16} className="mr-2" />
                PDF İndir
              </button>
            </div>
          </div>
        </div>
      )}

      {isTemplateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Yeni Ana Rota Oluştur</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={onTemplateSubmit} className="flex-1 overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şoför</label>
                    <select
                      value={selectedDriverId}
                      onChange={(e) => setSelectedDriverId(e.target.value)}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border p-2 bg-white"
                      required
                    >
                      <option value="">Şoför Seçin</option>
                      {activeDrivers?.map(d => (
                        <option key={d.id} value={d.id}>{d.name} ({d.vehiclePlate})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="bg-blue-50 p-2 rounded-md border border-blue-100 flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 uppercase">Seçili Hane Sayısı:</span>
                      <span className="text-lg font-black text-blue-800">{selectedHouseholds.length}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row justify-between items-end gap-4">
                  <div className="w-full sm:flex-1">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Eklenebilir Hane Ara</label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="İsim, adres, TC veya hane no..."
                        value={templateSearchTerm}
                        onChange={(e) => setTemplateSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                      />
                      <div className="absolute left-3 top-2.5 text-gray-400">
                        <Eye size={16} className="opacity-50" />
                      </div>
                    </div>
                  </div>
                  <div className="w-full sm:w-48">
                    <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Sıralama</label>
                    <select
                      value={`${templateSortField}-${templateSortOrder}`}
                      onChange={(e) => {
                        const [field, order] = e.target.value.split('-');
                        setTemplateSortField(field as any);
                        setTemplateSortOrder(order as any);
                      }}
                      className="w-full text-sm border border-gray-300 rounded-md p-2 bg-white shadow-sm"
                    >
                      <option value="headName-asc">İsim (A-Z)</option>
                      <option value="headName-desc">İsim (Z-A)</option>
                      <option value="address-asc">Adres (A-Z)</option>
                      <option value="address-desc">Adres (Z-A)</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="p-6 flex-1 overflow-y-auto bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Selected Households */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-widest border-b pb-2">
                      <ArrowRight size={18} className="text-blue-600" />
                      Rotadaki Haneler (Sıralı)
                    </h4>
                    <div className="space-y-3">
                      {selectedHouseholds.map(sh => {
                        const h = households?.find(hh => hh.id === sh.householdId);
                        if (!h) return null;
                        return (
                          <div key={sh.householdId} className="p-4 border-2 border-blue-100 bg-blue-50 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="flex flex-col items-center">
                                  <label className="text-[10px] font-bold text-blue-400 uppercase mb-1">Sıra</label>
                                  <input 
                                    type="number"
                                    value={sh.order}
                                    onChange={(e) => handleOrderChange(sh.householdId, parseInt(e.target.value) || 1)}
                                    className="w-12 text-center border-blue-200 rounded p-1 text-sm font-bold text-blue-800 focus:ring-blue-500 focus:border-blue-500"
                                    min="1"
                                    max={selectedHouseholds.length}
                                  />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-blue-900 text-sm truncate">{h.headName}</p>
                                  <p className="text-xs text-blue-600 truncate mt-1 flex items-center">
                                    <ArrowRight size={12} className="mr-1 opacity-50" />
                                    {h.address}
                                  </p>
                                </div>
                              </div>
                              <button 
                                type="button"
                                onClick={() => toggleHousehold(sh.householdId)}
                                className="bg-white text-red-500 hover:text-white hover:bg-red-500 p-1.5 rounded-full transition-colors shadow-sm border border-red-100"
                                title="Rotadan Çıkar"
                              >
                                <X size={16} />
                              </button>
                            </div>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200">
                              <span className="text-[10px] text-blue-700 font-black uppercase tracking-tighter">Başka Rotaya Taşı:</span>
                              <select 
                                className="text-[10px] border-blue-200 rounded p-1.5 bg-white flex-1 font-medium focus:ring-blue-500 focus:border-blue-500"
                                onChange={(e) => moveHouseholdToTemplate(sh.householdId, e.target.value)}
                                value=""
                              >
                                <option value="">Şoför Seçin...</option>
                                {drivers?.filter(d => d.id !== selectedDriverId).map(d => (
                                  <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        );
                      })}
                      {selectedHouseholds.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                          <p className="text-sm text-gray-400 italic">Henüz hane seçilmedi.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Available Households */}
                  <div className="flex flex-col">
                    <h4 className="text-sm font-black text-gray-900 mb-4 flex items-center gap-2 uppercase tracking-widest border-b pb-2">
                      <Plus size={18} className="text-green-600" />
                      Eklenebilir Haneler
                    </h4>
                    <div className="space-y-3">
                      {filteredAvailableHouseholds?.filter(h => !selectedHouseholds.some(sh => sh.householdId === h.id)).map(h => (
                        <div 
                          key={h.id} 
                          onClick={() => toggleHousehold(h.id!)}
                          className="p-4 border border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50 hover:shadow-md transition-all group bg-white"
                        >
                          <div className="flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-gray-900 text-sm truncate">{h.headName}</p>
                              <p className="text-xs text-gray-500 truncate mt-1">{h.address}</p>
                              <div className="flex gap-2 mt-2">
                                <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                  {h.memberCount} Kişi
                                </span>
                                {h.householdNo && (
                                  <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                    No: {h.householdNo}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="ml-4 bg-blue-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 shadow-lg">
                              <Plus size={18} />
                            </div>
                          </div>
                        </div>
                      ))}
                      {filteredAvailableHouseholds?.filter(h => !selectedHouseholds.some(sh => sh.householdId === h.id)).length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                          <p className="text-sm text-gray-400">Eklenebilir hane bulunamadı.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
                <button
                  type="button"
                  onClick={closeModal}
                  className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700"
                >
                  Ana Rotayı Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mapModalData && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-2xl max-w-2xl w-full h-[600px] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h3 className="font-black text-gray-900 tracking-tight">{mapModalData.title}</h3>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">Teslimat Koordinatları</p>
              </div>
              <button 
                onClick={() => setMapModalData(null)}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 bg-gray-100 relative">
              <iframe
                title="Google Maps"
                width="100%"
                height="100%"
                frameBorder="0"
                scrolling="no"
                marginHeight={0}
                marginWidth={0}
                src={`https://maps.google.com/maps?q=${mapModalData.lat},${mapModalData.lng}&z=15&output=embed&hl=tr`}
                referrerPolicy="no-referrer"
                className="w-full h-full bg-gray-200"
              />
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-lg flex items-center justify-between text-xs font-bold text-gray-700">
                <span>{mapModalData.lat.toFixed(6)}, {mapModalData.lng.toFixed(6)}</span>
                <a 
                  href={`https://www.google.com/maps/search/?api=1&query=${mapModalData.lat},${mapModalData.lng}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Tam Haritada Aç
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
