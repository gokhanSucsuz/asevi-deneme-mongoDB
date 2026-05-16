'use client';

import React, { useState } from 'react';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Household } from '@/lib/db';
import { Search, UserX, CheckCircle, Clock, ShieldAlert, AlertCircle, Trash2, X, Undo2, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';
import { normalizeTurkish } from '@/lib/utils';

export default function PassiveHouseholdsPage() {
  const { user, personnel } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [reactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  
  const [householdToAction, setHouseholdToAction] = useState<Household | null>(null);
  
  const [pauseDate, setPauseDate] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [applyToToday, setApplyToToday] = useState(false);

  const allHouseholds = useAppQuery(() => db.households.toArray(), [], 'households');

  const addLog = async (action: string, details?: string) => {
    await addSystemLog(user, personnel, action, details, 'household');
  };

  const filteredHouseholds = React.useMemo(() => {
    if (!allHouseholds) return { passive: [], active: [] };

    const search = normalizeTurkish(searchTerm);
    let allFiltered = allHouseholds.filter((h: Household) => {
      if (h.headName?.toLowerCase().includes('deneme')) return false;
      const matchesSearch = normalizeTurkish(h.headName).includes(search) || 
                            (h.tcNo && h.tcNo.includes(searchTerm)) ||
                            (h.householdNo && normalizeTurkish(h.householdNo).includes(search));
      return matchesSearch;
    });

    const passive = allFiltered.filter(h => !h.isActive && h.pausedUntil !== '9999-12-31');
    const active = allFiltered.filter(h => h.isActive);

    passive.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    active.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return { passive, active };
  }, [allHouseholds, searchTerm]);

  const canUndo = (h: any) => {
    if (!h.lastOperation) return false;
    const opTime = new Date(h.lastOperation.timestamp);
    const diffHours = (new Date().getTime() - opTime.getTime()) / (1000 * 60 * 60);
    return diffHours <= 4;
  };

  const handleUndo = async (household: any) => {
    if (!household.lastOperation) return;
    const { type, previousState, affectedRouteStops, addedRouteStopId } = household.lastOperation;
    
    const loadingToast = toast.loading('İşlem geri alınıyor...');
    try {
      await db.households.update(household.id!, {
        isActive: previousState.isActive,
        pausedUntil: previousState.pausedUntil,
        effectiveDate: previousState.effectiveDate,
        lastOperation: null
      });

      if (type === 'reactivate' && addedRouteStopId) {
        await db.routeStops.delete(addedRouteStopId);
      } else if ((type === 'pause' || type === 'delete') && affectedRouteStops && affectedRouteStops.length > 0) {
        for (const stop of affectedRouteStops) {
          const { id, ...stopData } = stop;
          await db.routeStops.add(stopData as any);
        }
      }
      
      const history = household.history || [];
      history.push({
        action: 'undo',
        timestamp: new Date(),
        note: `Kullanıcı hatası nedeniyle yapılan son '${type === 'delete' ? 'Silme' : type === 'pause' ? 'Pasife Alma' : 'Aktifleştirme'}' işlemi geri alındı.`
      });
      await db.households.update(household.id!, { history });

      notifyDbChange('households');
      notifyDbChange('route_stops');
      
      await addLog('İşlem Geri Alındı', `${household.headName} hanesi için yapılan son işlem (Kullanıcı Hatası Kurtarma) geri alındı.`);
      toast.success('İşlem başarıyla geri alındı', { id: loadingToast });
    } catch (error) {
      console.error(error);
      toast.error('Geri alma sırasında hata oluştu', { id: loadingToast });
    }
  };

  const removeFromTodaysRoute = async (householdId: string) => {
    const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
    const todayRoutes = await db.routes.where('date').equals(todayStr).toArray();
    const deletedStops = [];
    for (const r of todayRoutes) {
      const stops = await db.routeStops.where('routeId').equals(r.id!).toArray();
      const hStops = stops.filter(s => s.householdId === householdId && s.status === 'pending');
      for (const hs of hStops) {
        deletedStops.push(hs);
        await db.routeStops.delete(hs.id!);
      }
    }
    return deletedStops;
  };

  const addToTodaysRoute = async (householdId: string) => {
    const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');
    const templateStops = await db.routeTemplateStops.where('householdId').equals(householdId).toArray();
    if (templateStops.length > 0) {
      const templateId = templateStops[0].templateId;
      const template = await db.routeTemplates.get(templateId);
      if (template) {
         const todayRoutes = await db.routes.where('date').equals(todayStr).toArray();
         const routeForDriver = todayRoutes.find(r => r.driverId === template.driverId);
         if (routeForDriver) {
           const household = await db.households.get(householdId);
           if (household) {
             const newId = await db.routeStops.add({
               routeId: routeForDriver.id!,
               householdId: household.id!,
               status: 'pending',
               order: templateStops[0].order,
               householdSnapshotName: household.headName,
               householdSnapshotAddress: household.address,
               householdSnapshotPhone: household.phone,
               householdSnapshotMemberCount: household.memberCount,
               householdSnapshotBreadCount: household.breadCount
             } as any);
             return newId;
           }
         }
      }
    }
    return null;
  };

  const handleOpenReactivateModal = (household: Household) => {
    setHouseholdToAction(household);
    setApplyToToday(false);
    setReactivateModalOpen(true);
  };

  const handleReactivateSubmit = async () => {
    if (!householdToAction) return;
    const loadingToast = toast.loading('Aktifleştiriliyor...');
    try {
      const existing = await db.households.get(householdToAction.id!);
      if (!existing) return;
      
      const previousState = {
        isActive: existing.isActive,
        pausedUntil: existing.pausedUntil,
        effectiveDate: existing.effectiveDate
      };

      const history = existing.history || [];
      history.push({
        action: 'activated',
        timestamp: new Date(),
        note: `Pasif hane tekrar aktifleştirildi. ${applyToToday ? '(Bugünkü rotaya eklendi)' : '(Bir sonraki iş gününde eklenecek)'}`
      });

      const { getNextWorkingDay } = await import('@/lib/route-utils');
      const nextDay = await getNextWorkingDay(new Date());
      const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');
      const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');

      let addedRouteStopId = null;
      if (applyToToday) {
        addedRouteStopId = await addToTodaysRoute(existing.id!);
      }

      await db.households.update(existing.id!, {
        isActive: true,
        pausedUntil: '',
        effectiveDate: applyToToday ? todayStr : nextDayStr,
        history,
        lastOperation: {
          type: 'reactivate',
          timestamp: new Date().toISOString(),
          previousState,
          addedRouteStopId
        }
      } as any);

      notifyDbChange('households');
      notifyDbChange('route_stops');
      
      await addLog('Hane Aktifleştirildi', `${existing.headName} hanesi tekrar aktifleştirildi.`);
      toast.success('Hane başarıyla aktifleştirildi', { id: loadingToast });
      setReactivateModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('İşlem sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const handleOpenPauseModal = (household: Household) => {
    setHouseholdToAction(household);
    setPauseDate('');
    setActionReason('');
    setIsIndefinite(false);
    setApplyToToday(false);
    setPauseModalOpen(true);
  };

  const handleOpenEditPauseModal = (household: Household) => {
    setHouseholdToAction(household);
    if (household.pausedUntil === '9999-12-31' || household.pausedUntil === '2099-12-31') {
      setIsIndefinite(true);
      setPauseDate('');
    } else {
      setIsIndefinite(false);
      setPauseDate(household.pausedUntil || '');
    }
    setActionReason('Süre güncellemesi');
    setApplyToToday(false);
    setPauseModalOpen(true);
  };

  const handlePauseSubmit = async () => {
    if (!householdToAction) return;
    if (!isIndefinite && !pauseDate) {
      toast.error('Lütfen bir tarih seçin veya süresiz seçeneğini işaretleyin.');
      return;
    }
    if (!actionReason.trim()) {
      toast.error('Lütfen pasife alma sebebini giriniz.');
      return;
    }

    const finalPauseDate = isIndefinite ? '2099-12-31' : pauseDate;
    const loadingToast = toast.loading('Pasife alınıyor...');
    try {
      const existing = await db.households.get(householdToAction.id!);
      if (!existing) return;
      
      const previousState = {
        isActive: existing.isActive,
        pausedUntil: existing.pausedUntil,
        effectiveDate: existing.effectiveDate
      };

      const history = existing.history || [];
      history.push({
        action: 'paused',
        timestamp: new Date(),
        note: `${isIndefinite ? 'Süresiz' : pauseDate + ' tarihine kadar'} pasife ${existing.isActive ? 'alındı' : 'alma süresi güncellendi'}. Sebep: ${actionReason} ${applyToToday ? '(Bugünkü rotadan çıkarıldı)' : existing.isActive ? '(Bir sonraki iş gününde uygulanacak)' : ''}`
      });

      const { getNextWorkingDay } = await import('@/lib/route-utils');
      const nextDay = await getNextWorkingDay(new Date());
      const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');
      const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');

      let affectedRouteStops: any[] = [];
      if (applyToToday) {
        affectedRouteStops = await removeFromTodaysRoute(existing.id!);
      }

      await db.households.update(existing.id!, {
        isActive: false,
        pausedUntil: finalPauseDate,
        effectiveDate: applyToToday ? todayStr : nextDayStr,
        history,
        lastOperation: {
          type: 'pause',
          timestamp: new Date().toISOString(),
          previousState,
          affectedRouteStops
        }
      } as any);

      notifyDbChange('households');
      notifyDbChange('route_stops');
      
      await addLog(
        existing.isActive ? 'Hane Pasife Alındı' : 'Hane Pasiflik Süresi Güncellendi',
        `${existing.headName} hanesi ${isIndefinite ? 'süresiz' : pauseDate + ' tarihine kadar'} pasife ${existing.isActive ? 'alındı' : 'alma süresi güncellendi'}.`
      );

      toast.success(existing.isActive ? `Hane başarıyla pasife alındı.` : `Hane pasiflik süresi güncellendi.`, { id: loadingToast });
      setPauseModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Pasife alma işlemi sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  const handleOpenDeleteModal = (household: Household) => {
    setHouseholdToAction(household);
    setActionReason('');
    setApplyToToday(false);
    setDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!householdToAction) return;
    if (!actionReason.trim()) {
      toast.error('Lütfen silme sebebini giriniz.');
      return;
    }
    
    const loadingToast = toast.loading('Siliniyor...');
    try {
      const existing = await db.households.get(householdToAction.id!);
      if (existing) {
        const previousState = {
          isActive: existing.isActive,
          pausedUntil: existing.pausedUntil,
          effectiveDate: existing.effectiveDate
        };

        const history = existing.history || [];
        history.push({
          action: 'deleted',
          timestamp: new Date(),
          note: `Hane tamamen silindi. Sebep: ${actionReason} ${applyToToday && existing.isActive ? '(Bugünkü rotadan çıkarıldı)' : ''}`
        });

        const { getNextWorkingDay } = await import('@/lib/route-utils');
        const nextDay = await getNextWorkingDay(new Date());
        const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');
        const todayStr = safeFormat(new Date(), 'yyyy-MM-dd');

        let affectedRouteStops: any[] = [];
        if (applyToToday && existing.isActive) {
          affectedRouteStops = await removeFromTodaysRoute(existing.id!);
        }

        await db.households.update(existing.id!, {
          isActive: false,
          pausedUntil: '9999-12-31',
          effectiveDate: applyToToday ? todayStr : nextDayStr,
          history,
          lastOperation: {
            type: 'delete',
            timestamp: new Date().toISOString(),
            previousState,
            affectedRouteStops
          }
        } as any);

        notifyDbChange('households');
        notifyDbChange('route_stops');

        await addLog('Hane Silindi', `${existing.headName} hanesi silindi. Sebep: ${actionReason}`);
        toast.success(`Hane başarıyla silindi.`, { id: loadingToast });
      }
      setDeleteModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Silme işlemi sırasında bir hata oluştu', { id: loadingToast });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserX className="w-8 h-8 text-red-500" />
              Kayıt Durumu Yönetimi
            </h1>
            <p className="text-gray-500 mt-1">
              Pasife alma, aktifleştirme ve silme işlemlerini buradan yönetin. İşlemlerin anında bugünkü rotaya yansımasını seçebilirsiniz.
            </p>
          </div>
          <div className="w-full md:w-72">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="TC, Hane No veya İsim ile ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Passive Records */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              Şu An Pasif Olanlar
            </h2>
            <span className="bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {filteredHouseholds.passive.length} Kayıt
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredHouseholds.passive.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <ShieldAlert className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Pasif kayıt bulunamadı.</p>
              </div>
            ) : (
              filteredHouseholds.passive.map(h => (
                <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-amber-300 transition-colors shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-medium text-gray-900">{h.headName}</h3>
                      <p className="text-xs text-gray-500 mt-1">TC: {h.tcNo || '-'} | Hane No: {h.householdNo || '-'}</p>
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                          <Clock className="w-3 h-3" />
                          {h.pausedUntil === '2099-12-31' ? 'Süresiz Pasif' : `${safeFormat(new Date(h.pausedUntil!), 'dd.MM.yyyy')} tarihine kadar`}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        {canUndo(h) && (
                          <button
                            onClick={() => handleUndo(h)}
                            className="px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                            title="Son işlemi geri al (4 Saat İçinde)"
                          >
                            <Undo2 className="w-4 h-4" />
                            Geri Al
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenEditPauseModal(h)}
                          className="p-1.5 text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          title="Süreyi Güncelle"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenReactivateModal(h)}
                          className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1"
                          title="Tekrar Aktifleştir"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Aktifleştir
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(h)}
                          className="p-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          title="Tamamen Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Records to Pause/Delete */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Aktif Haneler
            </h2>
            <span className="bg-green-100 text-green-700 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {filteredHouseholds.active.length} Kayıt
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredHouseholds.active.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p>Aktif kayıt bulunamadı. Aramanızı değiştirin.</p>
              </div>
            ) : (
              filteredHouseholds.active.map(h => (
                <div key={h.id} className="bg-white border border-gray-200 rounded-xl p-4 hover:border-red-300 transition-colors shadow-sm">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="font-medium text-gray-900">{h.headName}</h3>
                      <p className="text-xs text-gray-500 mt-1">TC: {h.tcNo || '-'} | Hane No: {h.householdNo || '-'}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <div className="flex gap-2">
                        {canUndo(h) && (
                          <button
                            onClick={() => handleUndo(h)}
                            className="px-2 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                            title="Son işlemi geri al (4 Saat İçinde)"
                          >
                            <Undo2 className="w-4 h-4" />
                            Geri Al
                          </button>
                        )}
                        <button
                          onClick={() => handleOpenPauseModal(h)}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
                        >
                          Pasife Al
                        </button>
                        <button
                          onClick={() => handleOpenDeleteModal(h)}
                          className="p-1.5 text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          title="Tamamen Sil"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Reactivate Modal */}
      {reactivateModalOpen && householdToAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-green-50/30">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Haneyi Aktifleştir
              </h2>
              <button onClick={() => setReactivateModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <p className="text-sm text-gray-700">
                <strong>{householdToAction.headName}</strong> isimli haneyi tekrar aktif hale getirmek üzeresiniz.
              </p>
              <label className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                <input 
                  type="checkbox" 
                  checked={applyToToday} 
                  onChange={(e) => setApplyToToday(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                />
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-blue-900">Hemen bugünkü rotaya eklensin mi?</span>
                  <span className="text-xs text-blue-700 mt-1">İşaretlenmezse, sistemin varsayılan işleyişi gereği bir sonraki iş günü itibarıyla rotalara dahil edilir.</span>
                </div>
              </label>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setReactivateModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">
                İptal
              </button>
              <button onClick={handleReactivateSubmit} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700">
                Aktifleştir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pause Modal */}
      {pauseModalOpen && householdToAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-amber-50/30">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <UserX className="w-5 h-5 text-amber-600" />
                {householdToAction.isActive ? 'Haneyi Pasife Al' : 'Pasiflik Süresini Güncelle'}
              </h2>
              <button onClick={() => setPauseModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-sm">
                <strong>{householdToAction.headName}</strong> isimli hanenin {householdToAction.isActive ? 'pasife alınma işlemini yapıyorsunuz.' : 'pasiflik süresini güncelliyorsunuz.'}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Pasife Alma Süresi</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" checked={!isIndefinite} onChange={() => setIsIndefinite(false)} className="text-blue-600 w-4 h-4"/>
                    <span className="text-sm font-medium text-gray-700">Tarihe Kadar (Süreli)</span>
                  </label>
                  {!isIndefinite && (
                    <div className="pl-6 pb-2">
                      <input
                        type="date"
                        min={safeFormat(new Date(), 'yyyy-MM-dd')}
                        value={pauseDate}
                        onChange={(e) => setPauseDate(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                    <input type="radio" checked={isIndefinite} onChange={() => setIsIndefinite(true)} className="text-blue-600 w-4 h-4"/>
                    <span className="text-sm font-medium text-gray-700">Süresiz (İptal edilene kadar)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sebep (Zorunlu)</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Pasife alma sebebini detaylıca yazınız..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20 text-sm"
                  required
                />
              </div>

              {householdToAction.isActive && (
                <label className="flex items-start gap-3 p-3 mt-4 bg-blue-50 border border-blue-100 rounded-xl cursor-pointer hover:bg-blue-100/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={applyToToday} 
                    onChange={(e) => setApplyToToday(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-blue-600 rounded"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-blue-900">Hemen bugünkü rotadan çıkarılsın mı?</span>
                    <span className="text-xs text-blue-700 mt-1">İşaretlenmezse yarına kadar yemek almaya devam eder.</span>
                  </div>
                </label>
              )}

            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setPauseModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">
                İptal
              </button>
              <button onClick={handlePauseSubmit} className="px-4 py-2 text-sm font-medium text-white bg-amber-600 rounded-xl hover:bg-amber-700">
                {householdToAction.isActive ? 'Pasife Al' : 'Süreyi Güncelle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {deleteModalOpen && householdToAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-red-50/30">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-red-600" />
                Haneyi Tamamen Sil
              </h2>
              <button onClick={() => setDeleteModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-800 text-sm">
                <strong>{householdToAction.headName}</strong> isimli haneyi tamamen silmek üzeresiniz. Bu işlem geri alınamaz (Sadece geçmiş raporlarda ismi görünür).
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Silme Sebebi (Zorunlu)</label>
                <textarea
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Lütfen neden sildiğinizi açıklayın..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20 text-sm"
                  required
                />
              </div>

              {householdToAction.isActive && (
                <label className="flex items-start gap-3 p-3 mt-4 bg-red-50 border border-red-100 rounded-xl cursor-pointer hover:bg-red-100/50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={applyToToday} 
                    onChange={(e) => setApplyToToday(e.target.checked)}
                    className="mt-0.5 w-4 h-4 text-red-600 rounded border-gray-300"
                  />
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-red-900">Hemen bugünkü rotadan da silinsin mi?</span>
                    <span className="text-xs text-red-700 mt-1">İşaretlenmezse, silme işlemi yarından itibaren geçerli olur.</span>
                  </div>
                </label>
              )}
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
              <button onClick={() => setDeleteModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-xl hover:bg-gray-50">
                İptal
              </button>
              <button onClick={handleDeleteSubmit} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700">
                Haneyi Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
