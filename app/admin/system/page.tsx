'use client';

import { useState, useEffect } from 'react';
import { db } from '@/lib/db';
import { Download, Database, Clock, AlertTriangle, ShieldCheck, Lock, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import * as XLSX from 'xlsx';
import { encrypt, isEncrypted } from '@/lib/crypto';
import { useAuth } from '@/components/AuthProvider';
import { safeFormat } from '@/lib/date-utils';
import { addSystemLog } from '@/lib/logger';

export default function SystemSettingsPage() {
  const { user, role, personnel } = useAuth();
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
      
      await addSystemLog(
        user,
        personnel,
        'Dağıtım Paneli Durumu Değiştirildi',
        `Dağıtım paneli ${newState ? 'AKTİF' : 'PASİF'} hale getirildi.`,
        'system'
      );
      
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
          
          await addSystemLog(
            user,
            personnel,
            'Veritabanı Geri Yüklendi',
            `JSON dosyasından toplu veri aktarımı yapıldı.`,
            'system'
          );

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
        const exportFileDefaultName = `Asevi_Yedek_${safeFormat(new Date(), 'yyyy-MM-dd_HH-mm')}.json`;

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

        XLSX.writeFile(wb, `Asevi_Yedek_${safeFormat(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`);
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
      await addSystemLog(
        user,
        personnel,
        'Veritabanı Yedeklendi',
        `Tüm veritabanı ${formatType.toUpperCase()} formatında yedeklendi.`,
        'system'
      );

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
          const dateStr = safeFormat(new Date(r.date), 'yyyy-MM-dd');
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
          updates.date = safeFormat(new Date(wd.date), 'yyyy-MM-dd');
          needsUpdate = true;
        }
        if (typeof wd.month !== 'string' || wd.month.includes('T')) {
          updates.month = safeFormat(new Date(wd.month), 'yyyy-MM');
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
          const dateStr = safeFormat(new Date(bt.date), 'yyyy-MM-dd');
          await db.breadTracking.update(bt.id!, { date: dateStr });
          btCount++;
        }
      }

      // 4. Households (pausedUntil)
      const households = await db.households.toArray();
      let hCount = 0;
      for (const h of households) {
        if (h.pausedUntil && (typeof h.pausedUntil !== 'string' || h.pausedUntil.includes('T'))) {
          const dateStr = safeFormat(new Date(h.pausedUntil), 'yyyy-MM-dd');
          await db.households.update(h.id!, { pausedUntil: dateStr });
          hCount++;
        }
      }

      // 5. Leftover Food
      const leftoverFood = await db.leftover_food.toArray();
      let lfCount = 0;
      for (const lf of leftoverFood) {
        if (typeof lf.date !== 'string' || lf.date.includes('T')) {
          const dateStr = safeFormat(new Date(lf.date), 'yyyy-MM-dd');
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
          updates.date = safeFormat(new Date(t.date), 'yyyy-MM-dd');
          needsUpdate = true;
        }
        if (typeof t.endDate !== 'string' || t.endDate.includes('T')) {
          updates.endDate = safeFormat(new Date(t.endDate), 'yyyy-MM-dd');
          needsUpdate = true;
        }
        if (needsUpdate) {
          await db.tenders.update(t.id!, updates);
          tCount++;
        }
      }

      // Log the action
      await addSystemLog(
        user,
        personnel,
        'Veri Formatları Düzeltildi',
        `Toplam ${rCount + wdCount + btCount + hCount + lfCount + tCount} kayıt düzeltildi.`,
        'system'
      );

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
      await addSystemLog(
        user,
        personnel,
        'Veri Şifreleme Tamamlandı',
        `${hCount} hane, ${dCount} şoför ve ${pCount} personel verisi AES-256 ile şifrelendi.`,
        'security'
      );

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
    <div className="max-w-7xl mx-auto p-4 md:p-10">
      <div className="mb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex items-center gap-5">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-4 rounded-[2rem] shadow-2xl shadow-indigo-100 ring-8 ring-indigo-50/50">
              <ShieldCheck className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Güvenlik Kontrol Merkezi</h1>
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Edirne SYDV Siber Güvenlik Altyapısı Aktif
              </p>
            </div>
          </div>
          <div className="hidden lg:flex items-center gap-4 bg-white px-6 py-4 rounded-3xl border border-slate-100 shadow-sm">
            <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sistem Durumu</p>
              <p className="text-sm font-black text-slate-900">Korumalı Veri Akışı</p>
            </div>
            <Lock className="text-blue-600" size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Güvenlik Duvarı & AES-256 Bilgilendirme */}
        <div className="lg:col-span-3 bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden group border border-slate-800">
          <div className="absolute top-0 right-0 p-16 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <ShieldCheck size={280} className="text-blue-500" />
          </div>
          
          <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                PROD-SEC-SHIELD v4.0.2
              </div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
                Dünya Standartlarında <br/>
                <span className="text-blue-500 italic">Veri Koruması</span>
              </h2>
              <p className="text-slate-400 text-base font-medium leading-relaxed max-w-lg">
                Aşevi yönetim sistemimiz, hassas vakıf verilerini korumak için askeri düzeyde <strong>AES-256 GCM</strong> şifreleme ve gelişmiş oturum gizleme mimarisi kullanmaktadır. KVKK uyumluluğu her işlem adımında en üst düzeyde sağlanır.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'AES-256', detail: 'End-to-End Encryption', icon: ShieldCheck, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'OBFUSCATION', detail: 'Secure Local Session', icon: Lock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'RBAC 2.0', detail: 'Advanced Access Control', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'TLS 1.3', detail: 'Encrypted Data Stream', icon: ShieldCheck, color: 'text-blue-400', bg: 'bg-blue-500/10' }
              ].map((item, i) => (
                <div key={i} className="bg-white/5 backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-all group/card">
                  <div className={`w-12 h-12 ${item.bg} rounded-2xl flex items-center justify-center mb-4 group-hover/card:scale-110 transition-transform`}>
                    <item.icon className={item.color} size={24} />
                  </div>
                  <div className="text-white font-black text-sm mb-1 uppercase tracking-tighter">{item.label}</div>
                  <div className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Dağıtım Paneli Kontrolü */}
        <div className="lg:col-span-3 bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 ring-1 ring-slate-50">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="flex items-center gap-5">
              <div className={`p-5 rounded-[2rem] ${isDistributionPanelActive ? 'bg-green-50 shadow-green-100' : 'bg-red-50 shadow-red-100'} shadow-inner ring-4 ring-white`}>
                <ShieldCheck className={isDistributionPanelActive ? 'text-green-600' : 'text-red-600'} size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Global Sistem Erişimi</h2>
                <p className="text-sm text-slate-500 font-medium">Şoför mobil paneli ve saha operasyonları aktiflik durumunu yönetir.</p>
              </div>
            </div>
            
            <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-3xl w-full lg:w-auto justify-between border border-slate-100">
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Mevcut Durum</span>
                <span className={`text-xs font-black uppercase ${isDistributionPanelActive ? 'text-green-600' : 'text-red-600'}`}>
                  {isDistributionPanelActive ? 'OPERASYON AKTİF' : 'OPERASYON DURDURULDU'}
                </span>
              </div>
              {!isDemo && (
                <div className="flex items-center gap-4">
                  <button
                    onClick={toggleDistributionPanel}
                    className={`px-8 py-3 rounded-2xl text-white font-black text-sm transition-all active:scale-95 shadow-xl ${
                      isDistributionPanelActive 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-200' 
                        : 'bg-green-600 hover:bg-green-700 shadow-green-200'
                    }`}
                  >
                    {isDistributionPanelActive ? 'SİSTEMİ DURDUR' : 'SİSTEMİ BAŞLAT'}
                  </button>
                </div>
              )}
            </div>
          </div>
          {!isDistributionPanelActive && (
            <div className="mt-8 p-6 bg-red-50/50 border border-red-100 rounded-[2rem] flex items-start gap-4">
              <div className="bg-red-100 p-2 rounded-xl">
                <AlertTriangle className="text-red-600" size={20} />
              </div>
              <p className="text-sm text-red-900 font-medium leading-relaxed">
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
                {lastBackup ? safeFormat(lastBackup, 'dd.MM.yyyy HH:mm') : 'Hiç yedekleme yapılmadı'}
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
                  (Veritaraklarının arka planda dönüşümü tamamlanmıştır.)
                </p>
              </div>
              {/*
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
              */}
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
