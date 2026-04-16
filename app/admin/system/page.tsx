'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Download, Database, Clock, AlertTriangle, ShieldCheck, Lock, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { encrypt, isEncrypted } from '@/lib/crypto';
import { useAuth } from '@/components/AuthProvider';

export default function SystemSettingsPage() {
  const { user, role } = useAuth();
  const isDemo = role === 'demo';
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [isDistributionPanelActive, setIsDistributionPanelActive] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await db.system_settings.get('global');
        if (settings) {
          if (settings.lastBackupDate) {
            setLastBackup(new Date(settings.lastBackupDate));
          }
          if (settings.isDistributionPanelActive !== undefined) {
            setIsDistributionPanelActive(settings.isDistributionPanelActive);
          }
        }
      } catch (error) {
        console.error('Settings fetch error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const toggleDistributionPanel = async () => {
    const newState = !isDistributionPanelActive;
    const loadingToast = toast.loading('Ayarlar güncelleniyor...');
    try {
      await db.system_settings.set('global', {
        id: 'global',
        isDistributionPanelActive: newState,
        backupIntervalDays: 10 // preserve existing
      });
      setIsDistributionPanelActive(newState);
      
      const session = localStorage.getItem('personnel-session');
      const sessionUser = session ? JSON.parse(session) : null;
      if (sessionUser) {
        await db.system_logs.add({
          action: 'Dağıtım Paneli Durumu Değiştirildi',
          details: `Dağıtım paneli ${newState ? 'AKTİF' : 'PASİF'} hale getirildi.`,
          category: 'system',
          personnelEmail: user?.email || 'Bilinmeyen Email',
          personnelName: sessionUser.name || 'Bilinmeyen Personel',
          timestamp: new Date()
        });
      }
      
      toast.success(`Dağıtım paneli ${newState ? 'aktifleştirildi' : 'pasifleştirildi'}.`, { id: loadingToast });
    } catch (error) {
      console.error('Toggle error:', error);
      toast.error('Ayarlar güncellenirken bir hata oluştu.', { id: loadingToast });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('Bu işlem mevcut verilerin üzerine yazabilir veya yeni veriler ekleyebilir. Devam etmek istiyor musunuz?')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    const loadingToast = toast.loading('Veriler içe aktarılıyor...');

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          await db.restore(json);
          
          const session = localStorage.getItem('personnel-session');
          const sessionUser = session ? JSON.parse(session) : null;
          if (sessionUser) {
            await db.system_logs.add({
              action: 'Veritabanı Geri Yüklendi',
              details: `JSON dosyasından toplu veri aktarımı yapıldı.`,
              category: 'system',
              personnelEmail: user?.email || 'Bilinmeyen Email',
              personnelName: sessionUser.name || 'Bilinmeyen Personel',
              timestamp: new Date()
            });
          }

          toast.success('Veriler başarıyla geri yüklendi.', { id: loadingToast });
          setTimeout(() => window.location.reload(), 1500);
        } catch (err) {
          console.error('JSON parse error:', err);
          toast.error('Geçersiz yedekleme dosyası.', { id: loadingToast });
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('İçe aktarma sırasında bir hata oluştu.', { id: loadingToast });
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleBackup = async (formatType: 'json' | 'excel') => {
    setIsExporting(true);
    const loadingToast = toast.loading('Veritabanı yedekleniyor...');

    try {
      // Fetch all data
      const households = await db.households.toArray();
      const drivers = await db.drivers.toArray();
      const routes = await db.routes.toArray();
      const routeStops = await db.routeStops.toArray();
      const personnel = await db.personnel.toArray();
      const logs = await db.system_logs.toArray();
      const routeTemplates = await db.routeTemplates.toArray();
      const routeTemplateStops = await db.routeTemplateStops.toArray();
      const surveys = await db.surveys.toArray();
      const surveyResponses = await db.surveyResponses.toArray();
      const workingDays = await db.working_days.toArray();
      const breadTracking = await db.breadTracking.toArray();
      const leftoverFood = await db.leftover_food.toArray();
      const systemSettings = await db.system_settings.get('global');
      const tenders = await db.tenders.toArray();

      const allData = {
        households,
        drivers,
        routes,
        routeStops,
        personnel,
        logs,
        routeTemplates,
        routeTemplateStops,
        surveys,
        surveyResponses,
        workingDays,
        breadTracking,
        leftoverFood,
        systemSettings,
        tenders,
        backupDate: new Date().toISOString()
      };

      if (formatType === 'json') {
        const dataStr = JSON.stringify(allData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        const exportFileDefaultName = `Asevi_Yedek_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;

        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
      } else {
        const wb = XLSX.utils.book_new();
        
        // Add sheets
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(households), 'Haneler');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(drivers), 'Şoförler');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(routes), 'Rotalar');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(personnel), 'Personel');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(logs), 'Sistem Günlüğü');

        XLSX.writeFile(wb, `Asevi_Yedek_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
      }

      // Update last backup date
      const now = new Date();
      await db.system_settings.set('global', { 
        id: 'global', 
        lastBackupDate: now,
        backupIntervalDays: 10
      });
      setLastBackup(now);

      // Log the backup action
      const session = localStorage.getItem('personnel-session');
      const sessionUser = session ? JSON.parse(session) : null;
      if (sessionUser) {
        await db.system_logs.add({
          action: 'Veritabanı Yedeklendi',
          details: `Tüm veritabanı ${formatType.toUpperCase()} formatında yedeklendi.`,
          category: 'system',
          personnelEmail: user?.email || 'Bilinmeyen Email',
          personnelName: sessionUser.name || 'Bilinmeyen Personel',
          timestamp: new Date()
        });
      }

      toast.success('Yedekleme başarıyla tamamlandı.', { id: loadingToast });
    } catch (error) {
      console.error('Backup error:', error);
      toast.error('Yedekleme sırasında bir hata oluştu.', { id: loadingToast });
    } finally {
      setIsExporting(false);
    }
  };

  const handleFixDataFormats = async () => {
    if (!confirm('Veritabanındaki tarih formatları (yyyy-MM-dd) kontrol edilecek ve gerekirse düzeltilecektir. Devam etmek istiyor musunuz?')) {
      return;
    }

    setIsFixing(true);
    const loadingToast = toast.loading('Veri formatları düzeltiliyor...');

    try {
      // 1. Routes
      const routes = await db.routes.toArray();
      let rCount = 0;
      for (const r of routes) {
        if (typeof r.date !== 'string' || r.date.includes('T')) {
          const dateStr = format(new Date(r.date), 'yyyy-MM-dd');
          await db.routes.update(r.id!, { date: dateStr });
          rCount++;
        }
      }

      // 2. Working Days
      const workingDays = await db.working_days.toArray();
      let wdCount = 0;
      for (const wd of workingDays) {
        let needsUpdate = false;
        const updates: any = {};
        if (typeof wd.date !== 'string' || wd.date.includes('T')) {
          updates.date = format(new Date(wd.date), 'yyyy-MM-dd');
          needsUpdate = true;
        }
        if (typeof wd.month !== 'string' || wd.month.includes('T')) {
          updates.month = format(new Date(wd.month), 'yyyy-MM');
          needsUpdate = true;
        }
        if (needsUpdate) {
          await db.working_days.put({ ...wd, ...updates });
          wdCount++;
        }
      }

      // 3. Bread Tracking
      const breadTracking = await db.breadTracking.toArray();
      let btCount = 0;
      for (const bt of breadTracking) {
        if (typeof bt.date !== 'string' || bt.date.includes('T')) {
          const dateStr = format(new Date(bt.date), 'yyyy-MM-dd');
          await db.breadTracking.update(bt.id!, { date: dateStr });
          btCount++;
        }
      }

      // 4. Households (pausedUntil)
      const households = await db.households.toArray();
      let hCount = 0;
      for (const h of households) {
        if (h.pausedUntil && (typeof h.pausedUntil !== 'string' || h.pausedUntil.includes('T'))) {
          const dateStr = format(new Date(h.pausedUntil), 'yyyy-MM-dd');
          await db.households.update(h.id!, { pausedUntil: dateStr });
          hCount++;
        }
      }

      // 5. Leftover Food
      const leftoverFood = await db.leftover_food.toArray();
      let lfCount = 0;
      for (const lf of leftoverFood) {
        if (typeof lf.date !== 'string' || lf.date.includes('T')) {
          const dateStr = format(new Date(lf.date), 'yyyy-MM-dd');
          await db.leftover_food.update(lf.id!, { date: dateStr });
          lfCount++;
        }
      }

      // 6. Tenders
      const tenders = await db.tenders.toArray();
      let tCount = 0;
      for (const t of tenders) {
        let needsUpdate = false;
        const updates: any = {};
        if (typeof t.date !== 'string' || t.date.includes('T')) {
          updates.date = format(new Date(t.date), 'yyyy-MM-dd');
          needsUpdate = true;
        }
        if (typeof t.endDate !== 'string' || t.endDate.includes('T')) {
          updates.endDate = format(new Date(t.endDate), 'yyyy-MM-dd');
          needsUpdate = true;
        }
        if (needsUpdate) {
          await db.tenders.update(t.id!, updates);
          tCount++;
        }
      }

      // Log the action
      const session = localStorage.getItem('personnel-session');
      const sessionUser = session ? JSON.parse(session) : null;
      if (sessionUser) {
        await db.system_logs.add({
          action: 'Veri Formatları Düzeltildi',
          details: `Toplam ${rCount + wdCount + btCount + hCount + lfCount + tCount} kayıt düzeltildi.`,
          category: 'system',
          personnelEmail: user?.email || 'Bilinmeyen Email',
          personnelName: sessionUser.name || 'Bilinmeyen Personel',
          timestamp: new Date()
        });
      }

      toast.success('Veri formatları başarıyla düzeltildi.', { id: loadingToast });
    } catch (error) {
      console.error('Fix error:', error);
      toast.error('Düzeltme sırasında bir hata oluştu.', { id: loadingToast });
    } finally {
      setIsFixing(false);
    }
  };

  const handleEncryptionMigration = async () => {
    if (!confirm('Tüm hassas veriler (TC No, Hane No ve Telefon) AES-256 ile şifrelenecektir. Bu işlem geri alınamaz. Devam etmek istiyor musunuz?')) {
      return;
    }

    setIsEncrypting(true);
    const loadingToast = toast.loading('Veriler şifreleniyor...');

    try {
      // 1. Households
      const households = await db.households.toArray();
      let hCount = 0;
      for (const h of households) {
        let needsUpdate = false;
        const updates: any = {};
        
        if (h.tcNo && !isEncrypted(h.tcNo)) {
          updates.tcNo = encrypt(h.tcNo);
          needsUpdate = true;
        }
        if (h.householdNo && !isEncrypted(h.householdNo)) {
          updates.householdNo = encrypt(h.householdNo);
          needsUpdate = true;
        }
        if (h.phone && !isEncrypted(h.phone)) {
          updates.phone = encrypt(h.phone);
          needsUpdate = true;
        }

        if (needsUpdate) {
          await db.households.update(h.id!, updates);
          hCount++;
        }
      }

      // 2. Drivers
      const drivers = await db.drivers.toArray();
      let dCount = 0;
      for (const d of drivers) {
        let dNeedsUpdate = false;
        const dUpdates: any = {};

        if (d.tcNo && !isEncrypted(d.tcNo)) {
          dUpdates.tcNo = encrypt(d.tcNo);
          dNeedsUpdate = true;
        }
        if (d.phone && !isEncrypted(d.phone)) {
          dUpdates.phone = encrypt(d.phone);
          dNeedsUpdate = true;
        }

        if (dNeedsUpdate) {
          await db.drivers.update(d.id!, dUpdates);
          dCount++;
        }
      }

      // 3. Personnel
      const personnel = await db.personnel.toArray();
      let pCount = 0;
      for (const p of personnel) {
        let pNeedsUpdate = false;
        const pUpdates: any = {};
        
        if (p.tcNo && !isEncrypted(p.tcNo)) {
          pUpdates.tcNo = encrypt(p.tcNo);
          pNeedsUpdate = true;
        }
        if (p.password && !isEncrypted(p.password)) {
          pUpdates.password = encrypt(p.password);
          pNeedsUpdate = true;
        }

        if (pNeedsUpdate) {
          await db.personnel.update(p.id!, pUpdates);
          pCount++;
        }
      }

      // Log the action
      const session = localStorage.getItem('personnel-session');
      const sessionUser = session ? JSON.parse(session) : null;
      if (sessionUser) {
        await db.system_logs.add({
          action: 'Veri Şifreleme Tamamlandı',
          details: `${hCount} hane, ${dCount} şoför ve ${pCount} personel verisi AES-256 ile şifrelendi.`,
          category: 'security',
          personnelEmail: user?.email || 'Bilinmeyen Email',
          personnelName: sessionUser.name || 'Bilinmeyen Personel',
          timestamp: new Date()
        });
      }

      toast.success('Şifreleme işlemi başarıyla tamamlandı.', { id: loadingToast });
    } catch (error) {
      console.error('Encryption migration error:', error);
      toast.error('Şifreleme sırasında bir hata oluştu.', { id: loadingToast });
    } finally {
      setIsEncrypting(false);
    }
  };

  const daysSinceLastBackup = lastBackup ? differenceInDays(new Date(), lastBackup) : 999;
  const isBackupCritical = daysSinceLastBackup >= 10;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-8 text-white shadow-lg border border-slate-700">
        <div className="flex items-center gap-4 mb-4">
          <div className="bg-blue-500/20 p-3 rounded-xl border border-blue-500/30">
            <Database className="text-blue-400" size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Sistem ve Yedekleme</h1>
            <p className="text-slate-400 text-lg">Veritabanı güvenliği ve yedekleme yönetimi.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Dağıtım Paneli Kontrolü */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isDistributionPanelActive ? 'bg-green-100' : 'bg-red-100'}`}>
                <ShieldCheck className={isDistributionPanelActive ? 'text-green-600' : 'text-red-600'} size={24} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Yemek Dağıtım Paneli Durumu</h2>
                <p className="text-sm text-gray-500">Şoförlerin teslimat yapabilme yetkisini kontrol eder.</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-bold ${isDistributionPanelActive ? 'text-green-600' : 'text-red-600'}`}>
                {isDistributionPanelActive ? 'AKTİF' : 'PASİF'}
              </span>
              {!isDemo && (
                <button
                  onClick={toggleDistributionPanel}
                  className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none ${
                    isDistributionPanelActive ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                      isDistributionPanelActive ? 'translate-x-7' : 'translate-x-1'
                    }`}
                  />
                </button>
              )}
            </div>
          </div>
          {!isDistributionPanelActive && (
            <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
              <AlertTriangle className="text-red-600 shrink-0" size={20} />
              <p className="text-sm text-red-800">
                Dağıtım paneli şu an <strong>PASİF</strong> durumdadır. Şoförler teslimat girişi yapamazlar. 
                Yönetim panelinden manuel artan ekmek girişi yapılabilir.
              </p>
            </div>
          )}
        </div>

        {/* Yedekleme Durumu */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-100 p-2 rounded-lg">
              <Clock className="text-green-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Yedekleme Durumu</h2>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg border border-gray-100">
              <span className="text-gray-600">Son Yedekleme:</span>
              <span className="font-medium text-gray-900">
                {lastBackup ? format(lastBackup, 'dd.MM.yyyy HH:mm') : 'Hiç yedekleme yapılmadı'}
              </span>
            </div>

            <div className={`flex justify-between items-center p-4 rounded-lg border ${
              isBackupCritical ? 'bg-red-50 border-red-100 text-red-700' : 'bg-blue-50 border-blue-100 text-blue-700'
            }`}>
              <div className="flex items-center gap-2">
                {isBackupCritical ? <AlertTriangle size={20} /> : <ShieldCheck size={20} />}
                <span className="font-medium">
                  {isBackupCritical ? 'Yedekleme Zamanı Geçti!' : 'Sistem Güvende'}
                </span>
              </div>
              <span className="text-sm">
                {lastBackup ? `${daysSinceLastBackup} gün önce` : 'Kritik'}
              </span>
            </div>

            {isBackupCritical && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                Dikkat: Son yedekleme üzerinden 10 günden fazla süre geçti. Veri güvenliği için lütfen yedek alınız.
              </p>
            )}
          </div>
        </div>

        {/* Yedekleme İşlemleri */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-100 p-2 rounded-lg">
              <Download className="text-blue-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Yedekleme İşlemleri</h2>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => handleBackup('excel')}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-3 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              <Download size={20} />
              Excel Olarak Yedekle (.xlsx)
            </button>

            <button
              onClick={() => handleBackup('json')}
              disabled={isExporting}
              className="w-full flex items-center justify-center gap-3 bg-slate-700 hover:bg-slate-800 text-white py-4 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50"
            >
              <Download size={20} />
              JSON Olarak Yedekle (.json)
            </button>

            {!isDemo && (
              <div className="pt-4 border-t border-gray-100">
                <label className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold transition-all shadow-sm hover:shadow-md cursor-pointer disabled:opacity-50">
                  <Upload size={20} />
                  {isImporting ? 'Yükleniyor...' : 'Yedekten Geri Yükle (.json)'}
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleRestore}
                    disabled={isImporting}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            <p className="text-xs text-gray-500 text-center mt-4">
              Yedekleme işlemi tüm haneleri, şoförleri, rotaları ve sistem günlüklerini kapsar.
            </p>
          </div>
        </div>

        {/* Veri Güvenliği ve Şifreleme */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 md:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-amber-100 p-2 rounded-lg">
              <Lock className="text-amber-600" size={24} />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Veri Güvenliği ve Şifreleme</h2>
          </div>

          <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div className="max-w-xl">
                <h3 className="text-lg font-bold text-slate-900 mb-2">AES-256 Simetrik Şifreleme</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  TC Kimlik No, Hane No ve Telefon gibi hassas veriler veritabanına kaydedilmeden önce AES-256 standardı ile şifrelenir. 
                  Bu sayede veritabanına doğrudan erişim sağlansa bile hassas bilgiler okunamaz. 
                  Şifreleme anahtarı güvenli bir şekilde sunucu tarafında saklanır.
                </p>
              </div>
              {!isDemo && (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleEncryptionMigration}
                    disabled={isEncrypting}
                    className="whitespace-nowrap flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    <ShieldCheck size={20} />
                    {isEncrypting ? 'İşleniyor...' : 'Tüm Verileri Şifrele'}
                  </button>
                  <button
                    onClick={handleFixDataFormats}
                    disabled={isFixing}
                    className="whitespace-nowrap flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm hover:shadow-md disabled:opacity-50"
                  >
                    <Clock size={20} />
                    {isFixing ? 'Düzeltiliyor...' : 'Veri Formatlarını Düzelt'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-6">
        <div className="flex gap-3">
          <AlertTriangle className="text-amber-600 shrink-0" size={24} />
          <div>
            <h3 className="font-semibold text-amber-900 mb-1">Önemli Bilgilendirme</h3>
            <p className="text-sm text-amber-800 leading-relaxed">
              Sistem güvenliği gereği, 10 gün boyunca manuel yedekleme yapılmazsa sistem otomatik olarak 
              <strong> edirneysdv@gmail.com</strong> adresine yedekleme bildirimi gönderecek ve durumu 
              kayıt altına alacaktır. Lütfen haftalık olarak yedeklerinizi alıp güvenli bir ortamda saklayınız.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
