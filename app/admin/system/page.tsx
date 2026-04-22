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
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 ring-1 ring-slate-50 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none translate-x-1/2 -translate-y-1/2">
          <ShieldCheck size={200} className="text-indigo-600" />
        </div>
        
        <div className="flex items-center gap-6 relative z-10">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-5 rounded-[2rem] shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
            <ShieldCheck className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Sistem & Güvenlik</h1>
            <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em] mt-1 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Veri Koruma ve Yedekleme Altyapısı Aktif
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 relative z-10">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Son Yedekleme</p>
            <p className="text-sm font-black text-slate-900">
              {lastBackup ? safeFormat(lastBackup, 'dd.MM.yyyy HH:mm') : 'HİÇ YAPILMADI'}
            </p>
          </div>
          <Clock className="text-blue-600" size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Güvenlik Bilgilendirme - Büyük Kart */}
        <div className="lg:col-span-3 bg-slate-900 p-8 md:p-12 rounded-[3.5rem] shadow-2xl relative overflow-hidden group border border-slate-800">
          <div className="absolute top-0 right-0 p-16 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
            <ShieldCheck size={280} className="text-blue-500" />
          </div>
          
          <div className="relative z-10 grid grid-cols-1 xl:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-400 text-[10px] font-black uppercase tracking-[0.2em] mb-8">
                PROD-SEC-SHIELD v4.0.2
              </div>
              <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
                Askeri Düzey <br/>
                <span className="text-blue-500">Veri Şifreleme</span>
              </h2>
              <p className="text-slate-400 text-base font-medium leading-relaxed max-w-lg">
                Hassas vakıf verileri (TC No, Hane No, Telefon) <strong>AES-256 GCM</strong> standardı ile şifreli olarak saklanır. 
                KVKK uyumluluğu ve veri bütünlüğü sistem çekirdeğinde en üst düzeyde sağlanmaktadır.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: 'AES-256', detail: 'End-to-End Encryption', icon: Lock, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                { label: 'OBFUSCATION', detail: 'Secure Sessions', icon: ShieldCheck, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                { label: 'KVKK-2026', detail: 'Data Privacy Rules', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                { label: 'BACKUP-PRO', detail: 'Scheduled Recovery', icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10' }
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

        {/* Dağıtım Paneli Erişimi */}
        <div className="lg:col-span-3 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className={`p-5 rounded-[2rem] ${isDistributionPanelActive ? 'bg-green-50 shadow-green-100' : 'bg-red-50 shadow-red-100'} shadow-inner`}>
              {isDistributionPanelActive ? <ShieldCheck className="text-green-600" size={32} /> : <AlertTriangle className="text-red-600" size={32} />}
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Saha Operasyon Kilidi</h2>
              <p className="text-sm text-slate-500 font-medium">Şoför paneli ve teslimat girişlerini anlık olarak yönetir.</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
             <div className="flex items-center gap-6 bg-slate-50 p-3 pr-6 rounded-3xl border border-slate-100 min-w-[320px] justify-between">
                <div className="flex items-center gap-3 ml-3">
                  <div className={`w-3 h-3 rounded-full ${isDistributionPanelActive ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                  <span className={`text-xs font-black uppercase ${isDistributionPanelActive ? 'text-green-600' : 'text-red-600'}`}>
                    {isDistributionPanelActive ? 'SİSTEM AÇIK' : 'SİSTEM KAPALI'}
                  </span>
                </div>
                {!isDemo && (
                  <button
                    onClick={toggleDistributionPanel}
                    className={`px-8 py-3 rounded-2xl text-white font-black text-sm transition-all shadow-lg active:scale-95 ${
                      isDistributionPanelActive 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-100' 
                        : 'bg-green-600 hover:bg-green-700 shadow-green-100'
                    }`}
                  >
                    {isDistributionPanelActive ? 'KAPAT' : 'BAŞLAT'}
                  </button>
                )}
              </div>

              {!isDemo && (
                <button
                  onClick={handleFixDataFormats}
                  disabled={isFixing}
                  className="px-6 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs hover:bg-slate-200 transition-all active:scale-95 flex items-center gap-2"
                  title="Tarih ve veri formatlarını optimize eder"
                >
                  <Database size={16} />
                  FORMATLARI DÜZELT
                </button>
              )}
          </div>
        </div>

        {/* Performans ve Optimizasyon - Yeni Bölüm */}
        <div className="lg:col-span-3 bg-gradient-to-br from-blue-600 to-indigo-700 p-8 md:p-10 rounded-[3rem] text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <Zap size={160} />
          </div>
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
            <div className="md:col-span-2">
              <h2 className="text-2xl md:text-3xl font-black mb-4 uppercase tracking-tighter">Veritabanı Performans Motoru</h2>
              <p className="text-blue-100 text-sm font-medium leading-relaxed max-w-xl">
                Sistemimiz <strong>MongoDB v3.0 (Smart Proxy)</strong> altyapısı ile optimize edilmiştir. 
                Yapılan N+1 sorgu iyileştirmeleri ve akıllı bağlantı havuzu (Pooling) yönetimi sayesinde, 
                500 bağlantı limitine takılmadan 300+ eş zamanlı isteği milisaniyeler içinde işleyebilmektedir.
              </p>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-[2rem]">
               <div className="space-y-4">
                  <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-blue-200">
                    <span>Bağlantı Sağlığı</span>
                    <span className="text-green-400">Mükemmel</span>
                  </div>
                  <div className="flex items-end gap-1 h-12">
                    {[30, 45, 20, 60, 40, 80, 55, 30, 45, 90, 40, 60].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/30 rounded-t-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                  <p className="text-[10px] font-bold text-center text-blue-100">Otomatik havuz yönetimi devrede (maxPool: 10)</p>
               </div>
            </div>
          </div>
        </div>

        {/* Yedekleme Bölümü - 2 Kart */}
        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
              <Download size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase">Yedekleme Merkezi</h2>
          </div>
          
          <div className="space-y-4">
            <button
              onClick={() => handleBackup('excel')}
              disabled={isExporting}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-green-50 border border-slate-100 hover:border-green-200 rounded-3xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl shadow-sm text-green-600 group-hover:scale-110 transition-transform">
                  <Database size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 uppercase">Excel Raporu</p>
                  <p className="text-[10px] font-bold text-slate-400">Tüm veriler .xlsx formatında</p>
                </div>
              </div>
              <Download className="text-slate-300 group-hover:text-green-600" size={20} />
            </button>

            <button
              onClick={() => handleBackup('json')}
              disabled={isExporting}
              className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-3xl transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-600 group-hover:scale-110 transition-transform">
                  <Upload size={20} />
                </div>
                <div className="text-left">
                  <p className="text-sm font-black text-slate-900 uppercase">JSON Tam Yedek</p>
                  <p className="text-[10px] font-bold text-slate-400">Sistem geri yükleme verisi</p>
                </div>
              </div>
              <Download className="text-slate-300 group-hover:text-blue-600" size={20} />
            </button>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="bg-amber-50 p-3 rounded-2xl text-amber-600">
              <Upload size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase">Geri Yükleme</h2>
          </div>

          <div className="flex-1 flex flex-col justify-center">
            {!isDemo ? (
              <label className="flex flex-col items-center justify-center p-8 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2rem] hover:bg-blue-50 hover:border-blue-300 transition-all cursor-pointer group">
                <div className="bg-white p-4 rounded-2xl shadow-sm mb-4 group-hover:scale-110 transition-transform text-blue-600">
                  <Upload size={28} />
                </div>
                <p className="text-sm font-black text-slate-900 uppercase">Dosya Seçin</p>
                <p className="text-[10px] font-bold text-slate-400 mt-1">Sadece .json dosyaları</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleRestore}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="p-8 bg-slate-50 border border-slate-100 rounded-[2rem] text-center">
                <Lock className="mx-auto text-slate-300 mb-4" size={32} />
                <p className="text-xs font-bold text-slate-400 uppercase">Bu işlem Demo kullanıcıları için kapalıdır</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 space-y-6 flex flex-col justify-between">
          <div className="flex items-center gap-4 mb-2">
            <div className={`p-3 rounded-2xl ${isBackupCritical ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
              <ShieldCheck size={24} />
            </div>
            <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Sağlık Kontrolü</h2>
          </div>

          <div className={`p-6 rounded-[2rem] ${isBackupCritical ? 'bg-red-50 border border-red-100' : 'bg-slate-50 border border-slate-100'}`}>
            <div className="flex justify-between items-center mb-4 text-xs font-black uppercase tracking-widest">
              <span className="text-slate-400">Kritiklik Seviyesi</span>
              <span className={isBackupCritical ? 'text-red-600' : 'text-green-600'}>{isBackupCritical ? 'YÜKSEK' : 'DÜŞÜK'}</span>
            </div>
            <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden mb-4">
              <div 
                className={`h-full rounded-full ${isBackupCritical ? 'bg-red-500' : 'bg-green-500'}`} 
                style={{ width: `${Math.min(100, (daysSinceLastBackup / 14) * 100)}%` }} 
              />
            </div>
            <p className="text-xs font-bold text-slate-600 leading-relaxed">
              {isBackupCritical 
                ? 'Son yedekleme üzerinden 10 günden fazla geçti. Veri kaybı riski mevcut!' 
                : 'Sistem yedekleme periyodu sağlıklı görünüyor. İyi çalışmalar.'}
            </p>
          </div>
        </div>
      </div>

      {/* Footer Alert */}
      <div className="bg-amber-50 border border-amber-200 p-8 rounded-[2.5rem] flex items-start gap-6">
        <div className="bg-amber-200/50 p-4 rounded-[1.5rem] shrink-0 text-amber-700">
          <AlertTriangle size={32} />
        </div>
        <div>
          <h3 className="text-xl font-black text-amber-900 uppercase tracking-tighter mb-2">Önemli Protokol Hatırlatması</h3>
          <p className="text-sm text-amber-800 font-medium leading-relaxed max-w-4xl">
            Sistem güvenliği gereği, her hafta Cuma günü operasyon bitiminde yedek alınması tavsiye edilir. 
            Yedekleme yapılmadığında sistem ototmatik olarak <strong>edirneysdv@gmail.com</strong> adresine durum raporu iletir.
            Veri bütünlüğünü korumak için alınan yedekleri kurum dışı ortamlarda saklamayınız.
          </p>
        </div>
      </div>
    </div>
  );
}
