'use client';

import React, { useState } from 'react';
import { useAppQuery, notifyDbChange } from '@/lib/hooks';
import { db, Household } from '@/lib/db';
import { Search, UserX, CheckCircle, Clock, Trash2, ShieldAlert, AlertCircle, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/components/AuthProvider';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';
import { normalizeTurkish } from '@/lib/utils';

export default function PassiveHouseholdsPage() {
  const { user, personnel } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [householdToPause, setHouseholdToPause] = useState<Household | null>(null);
  const [pauseDate, setPauseDate] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);

  const allHouseholds = useAppQuery(() => db.households.toArray(), [], 'households');

  const addLog = async (action: string, details?: string) => {
    await addSystemLog(user, personnel, action, details, 'household');
  };

  // Filter passive and active records based on search
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

    // Sort descending by created date
    passive.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    active.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

    return { passive, active };
  }, [allHouseholds, searchTerm]);

  const handleReactivate = async (household: Household) => {
    if (confirm(`${household.headName} hanesini tekrar aktifleştirmek istediğinize emin misiniz?`)) {
      const loadingToast = toast.loading('Aktifleştiriliyor...');
      try {
        const history = household.history || [];
        history.push({
          action: 'activated',
          timestamp: new Date(),
          note: 'Pasif hane tekrar aktifleştirildi.'
        });

        await db.households.update(household.id!, {
          isActive: true,
          pausedUntil: '',
          history
        });
        notifyDbChange('households');
        await addLog('Hane Aktifleştirildi', `${household.headName} hanesi tekrar aktifleştirildi.`);
        toast.success('Hane başarıyla aktifleştirildi', { id: loadingToast });
      } catch (error) {
        console.error(error);
        toast.error('İşlem sırasında bir hata oluştu', { id: loadingToast });
      }
    }
  };

  const handleOpenPauseModal = (household: Household) => {
    setHouseholdToPause(household);
    setPauseDate('');
    setActionReason('');
    setIsIndefinite(false);
    setPauseModalOpen(true);
  };

  const handlePauseSubmit = async () => {
    if (!isIndefinite && !pauseDate) {
      toast.error('Lütfen bir tarih seçin veya süresiz seçeneğini işaretleyin.');
      return;
    }
    if (!actionReason.trim()) {
      toast.error('Lütfen pasife alma sebebini giriniz.');
      return;
    }

    const finalPauseDate = isIndefinite ? '2099-12-31' : pauseDate;
    const msg = isIndefinite 
      ? 'Haneyi süresiz olarak pasife almak istediğinize emin misiniz?' 
      : `Haneyi ${pauseDate} tarihine kadar pasife almak istediğinize emin misiniz?`;

    if (confirm(msg)) {
      const loadingToast = toast.loading('Pasife alınıyor...');
      try {
        const existing = await db.households.get(householdToPause!.id!);
        const history = existing?.history || [];
        history.push({
          action: 'paused',
          timestamp: new Date(),
          note: `${isIndefinite ? 'Süresiz' : pauseDate + ' tarihine kadar'} pasife alındı. Sebep: ${actionReason}`
        });

        const { getNextWorkingDay } = await import('@/lib/route-utils');
        const nextDay = await getNextWorkingDay(new Date());
        const nextDayStr = safeFormat(nextDay, 'yyyy-MM-dd');

        await db.households.update(householdToPause!.id!, {
          isActive: false,
          pausedUntil: finalPauseDate,
          effectiveDate: nextDayStr,
          history
        });
        notifyDbChange('households');
        await addLog(
          'Hane Pasife Alındı',
          `${householdToPause!.headName} hanesi ${isIndefinite ? 'süresiz' : pauseDate + ' tarihine kadar'} pasife alındı.`
        );

        toast.success(`Hane pasife alındı.`, { id: loadingToast });
        setPauseModalOpen(false);
      } catch (error) {
        console.error(error);
        toast.error('Pasife alma işlemi sırasında bir hata oluştu', { id: loadingToast });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <UserX className="w-8 h-8 text-red-500" />
              Pasif Kayıt Yönetimi
            </h1>
            <p className="text-gray-500 mt-1">
              Pasife alınmış haneleri yönetin veya aktif haneleri pasife alın (Süreli / Süresiz).
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
                    <button
                      onClick={() => handleReactivate(h)}
                      className="p-2 text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors"
                      title="Tekrar Aktifleştir"
                    >
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Active Records to Pause */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[600px]">
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Aktif Haneler (Pasife Al)
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
                    <button
                      onClick={() => handleOpenPauseModal(h)}
                      className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                    >
                      Pasife Al
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Pause Modal */}
      {pauseModalOpen && householdToPause && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <UserX className="w-6 h-6 text-red-500" />
                Haneyi Pasife Al
              </h2>
            </div>
            
            <div className="p-6 space-y-4 bg-gray-50/50">
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-sm">
                <strong>{householdToPause.headName}</strong> isimli haneyi pasife almak üzeresiniz.
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pasife Alma Süresi</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                    <input 
                      type="radio" 
                      checked={!isIndefinite} 
                      onChange={() => setIsIndefinite(false)}
                      className="text-blue-600 w-4 h-4"
                    />
                    <span className="text-sm font-medium text-gray-700">Tarihe Kadar (Süreli)</span>
                  </label>
                  
                  {!isIndefinite && (
                    <div className="pl-6">
                      <input
                        type="date"
                        min={safeFormat(new Date(), 'yyyy-MM-dd')}
                        value={pauseDate}
                        onChange={(e) => setPauseDate(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                      />
                    </div>
                  )}

                  <label className="flex items-center gap-2 p-3 bg-white border border-gray-200 rounded-xl cursor-pointer hover:border-blue-500 transition-colors">
                    <input 
                      type="radio" 
                      checked={isIndefinite} 
                      onChange={() => setIsIndefinite(true)}
                      className="text-blue-600 w-4 h-4"
                    />
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
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 text-sm"
                  required
                />
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white">
              <button
                onClick={() => setPauseModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handlePauseSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors flex items-center gap-2"
              >
                <UserX className="w-4 h-4" />
                Pasife Al
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
