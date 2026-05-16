'use client';

import { 
  FileText, Users, Truck, Map, ShieldAlert, BarChart, 
  Calendar, Smartphone, CheckCircle, Database, Lock, ShieldCheck,
  Search, History, ClipboardList, AlertTriangle, Info, Zap, Download,
  ArrowRight, Menu, X, Plus, Clock, CalendarOff, UserCheck, Activity,
  ChevronRight, ExternalLink
} from 'lucide-react';
import { useState, useEffect } from 'react';

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState('guvenlik');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: 'Güvenlik Protokolü', id: 'guvenlik', icon: Lock, color: 'text-red-500', bg: 'bg-red-50' },
    { name: 'Hane & Kurum', id: 'hane', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { name: 'Şoför Yönetimi', id: 'truck_mgmt', icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { name: 'Rota Algoritması', id: 'rota_algo', icon: Map, color: 'text-orange-500', bg: 'bg-orange-50' },
    { name: 'Ekmek & Lojistik', id: 'ekmek', icon: Info, color: 'text-amber-600', bg: 'bg-amber-50' },
    { name: 'Çalışma Takvimi', id: 'takvim', icon: Calendar, color: 'text-teal-600', bg: 'bg-teal-50' },
    { name: 'Şoför Saha Paneli', id: 'saha_paneli', icon: Smartphone, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Anket & Analiz', id: 'anket', icon: Plus, color: 'text-teal-500', bg: 'bg-teal-50' },
    { name: 'Raporlama & Veri', id: 'rapor', icon: ClipboardList, color: 'text-purple-500', bg: 'bg-purple-50' },
    { name: 'KVKK & Şifre', id: 'sifreleme', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
    { name: 'Sistem Bakımı', id: 'bakim', icon: Database, color: 'text-slate-600', bg: 'bg-slate-50' },
    { name: 'Sürüm Notları', id: 'notlar', icon: FileText, color: 'text-blue-700', bg: 'bg-blue-50' }
  ];

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden font-sans selection:bg-blue-100 selection:text-blue-900">
      
      {/* Top Professional Bar */}
      <header className="h-16 border-b border-slate-100 bg-white flex items-center justify-between px-8 shrink-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-slate-900 p-2 rounded-xl">
            <ShieldAlert className="text-white" size={18} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900 uppercase tracking-tighter">Aşevi Dağıtım Kılavuzu</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">T.C. EDİRNE VALİLİĞİ - SYDV v4.0.0</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full border border-blue-100">
            <Activity className="text-blue-600" size={14} />
            <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Sistem Aktif</span>
          </div>
          <button className="p-2 hover:bg-slate-50 rounded-xl transition-colors md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Navigation Sidebar */}
        <aside className={`
          fixed inset-0 z-40 bg-white/80 backdrop-blur-xl md:relative md:bg-white md:backdrop-blur-none
          w-72 border-r border-slate-100 flex flex-col shrink-0 transition-transform duration-300 ease-in-out
          ${isMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMenuOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group
                    ${isActive 
                      ? 'bg-slate-900 text-white shadow-lg shadow-slate-200' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}
                  `}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-colors ${isActive ? 'bg-white/10' : 'bg-white shadow-sm border border-slate-100'}`}>
                      <Icon size={16} className={isActive ? 'text-blue-400' : item.color} />
                    </div>
                    <span className="text-xs font-bold tracking-tight">{item.name}</span>
                  </div>
                  {isActive && <ChevronRight size={14} className="text-slate-500" />}
                </button>
              );
            })}
          </div>

          <div className="p-6 border-t border-slate-100 bg-slate-50/50">
            <div className="bg-slate-900 p-5 rounded-[2rem] text-white relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-16 h-16 bg-blue-500/20 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
              <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-2 text-blue-400">Güvenlik Notu</h4>
              <p className="text-[11px] font-medium leading-relaxed opacity-70">Veriler AES-256 GCM ile şifrelenmektedir.</p>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50/30 custom-scrollbar relative">
          <div className="max-w-5xl mx-auto p-8 md:p-12 pb-32">
            
            {activeTab === 'guvenlik' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-red-500 p-4 rounded-3xl shadow-xl shadow-red-100 shrink-0">
                    <Lock className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Güvenlik Protokolü</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Kurumsal Kimlik Doğrulama & Yetkilendirme</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="text-blue-600" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tighter uppercase">Kimlik Doğrulama</h3>
                    <ul className="text-sm text-slate-500 space-y-3 font-medium">
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> <strong>Firebase Auth:</strong> Google tabanlı ve kurumsal email/şifre altyapısı.</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> <strong>Onay Sistemi:</strong> Yeni kayıtlar yönetici onaylayana kadar &quot;Pasif&quot; kalır.</li>
                      <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div> <strong>Hashing:</strong> Şifreler sunucuda tek yönlü hashing ile korunur.</li>
                    </ul>
                  </div>
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <History className="text-indigo-600" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tighter uppercase">Yetki Seviyeleri</h3>
                    <div className="space-y-4">
                      <div>
                        <span className="bg-slate-900 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest mb-1 inline-block">ADMIN</span>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Tam sistem erişimi, yedekleme/geri yükleme, personel yönetimi ve veri silme yetkisi.</p>
                      </div>
                      <div>
                        <span className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest mb-1 inline-block">PERSONEL</span>
                        <p className="text-xs text-slate-500 font-medium leading-relaxed italic">Hane yönetimi, rota oluşturma, anket takibi ve rapor alma yetkileri.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute right-0 top-0 w-1/3 h-full bg-blue-600/10 blur-3xl"></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                    <div className="bg-white/10 p-5 rounded-[2rem] backdrop-blur-xl border border-white/10">
                      <ShieldAlert size={40} className="text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-2xl font-black mb-3 tracking-tight">Oturum Güvenliği (Session Security)</h3>
                      <p className="text-slate-400 text-sm leading-relaxed font-medium mb-4">
                        Oturum bilgileri tarayıcıda &quot;Obfuscation&quot; yöntemiyle gizlenir. Herhangi bir XSS saldırısına karşı hassas veriler asla yerel depolamada şifresiz tutulmaz. Sistem her 1 saatte bir oturum yenileme doğrulaması yapar.
                      </p>
                      <div className="flex gap-4">
                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-blue-300">XSS Koruması</div>
                        <div className="bg-white/5 px-4 py-2 rounded-xl border border-white/5 text-[10px] font-black uppercase tracking-widest text-blue-300">CSRF Kalkanı</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'hane' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100 shrink-0">
                    <Users className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Hane & Kurum Yönetimi</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Bireysel ve Kurumsal Dağıtım Verisi</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-12">
                  <div className="flex gap-10 items-start border-b border-slate-50 pb-12">
                    <div className="p-5 bg-blue-50 rounded-2xl text-blue-600 shrink-0 shadow-inner"><Search size={32} /></div>
                    <div className="flex-1">
                      <h4 className="text-xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Akıllı Filtreleme & Rozetler</h4>
                      <p className="text-[15px] text-slate-500 leading-relaxed font-medium mb-6">Sistem, binlerce kayıt arasından anlık arama (TC No, Ad, Mahalle) yapabilir. Hane listesinde yer alan <strong>mavi rozetler</strong>, hanenin bağlı olduğu rota şoförünü gerçek zamanlı gösterir.</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {['TC No ile Sorgu', 'Mahalle Filtresi', 'Şoför Rozeti', 'Kurum/Hane Ayrımı'].map(f => (
                           <div key={f} className="bg-slate-50 px-4 py-2 rounded-xl text-[10px] font-black text-slate-600 uppercase tracking-widest border border-slate-100">{f}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-4">
                      <h5 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                        <Smartphone className="text-blue-600" size={16} /> Veri Giriş Standartları
                      </h5>
                      <ul className="text-sm text-slate-500 space-y-3 font-medium">
                        <li><strong className="text-slate-900">Pasif Kayıt:</strong> Şoförler ilk aşamada TC No olmadan eklenebilir.</li>
                        <li><strong className="text-slate-900">Zorunlu Aktivasyon:</strong> Şoförü aktif yapabilmek için 11 haneli geçerli TC No girişi zorunludur.</li>
                        <li><strong className="text-slate-900">Ekmek Hesabı:</strong> Kişi sayısına göre otomatik ekmek/yemek miktarı hesaplanır.</li>
                      </ul>
                    </div>
                    <div className="space-y-4">
                      <h5 className="font-black text-slate-900 uppercase text-xs tracking-[0.2em] flex items-center gap-2">
                        <Smartphone className="text-blue-600" size={16} /> Operasyonel Durumlar
                      </h5>
                      <ul className="text-sm text-slate-500 space-y-3 font-medium">
                        <li><strong className="text-slate-900">Self-Servis:</strong> Vakıftan elden alan haneler &quot;Self-Servis&quot; olarak işaretlenir.</li>
                        <li><strong className="text-slate-900">Durdurma:</strong> Haneler geçici süreliğine (örneğin tatil) duraklatılabilir.</li>
                        <li><strong className="text-slate-900">Hane Geçmişi:</strong> Her hanenin tüm işlem tarihçesi (kayıt, güncelleme) saklanır.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'truck_mgmt' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-100 shrink-0">
                    <Truck className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Şoför Yönetimi</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Personel Kaydı, İzin ve Vekil Protokolü</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 group">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                      <UserCheck className="text-indigo-600" size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Kayıt ve Aktivasyon</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      Yeni şoförler &quot;Pasif&quot; olarak eklenebilir (TC No zorunlu değildir). Ancak bir şoförün rotaya atanabilmesi ve &quot;Aktif&quot; yapılması için <strong>geçerli 11 haneli TC Kimlik No</strong> girişi sistem tarafından zorunlu tutulur.
                    </p>
                  </div>
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6 group">
                    <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center shadow-inner group-hover:rotate-12 transition-transform">
                      <CalendarOff className="text-orange-500" size={32} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 tracking-tighter uppercase">İzin ve Vekalet</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      İzin tanımlanan şoförler sistemde <strong>turuncu</strong> ile işaretlenir. İzin süresince yerine &quot;Vekil&quot; (başka bir personel veya şoför) atanmalıdır. İzin bitiminde şoför otomatik aktif olmaz; yöneticinin manuel onayı gerekir.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rota_algo' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-orange-500 p-4 rounded-3xl shadow-xl shadow-orange-100 shrink-0">
                    <Map className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Rota Algoritması</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Sistem İşleyiş Mantığı ve Kurallar</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-8">
                  <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white">
                    <h4 className="text-sm font-black uppercase tracking-[0.3em] mb-6 text-orange-400">Günlük Rota Oluşturma Algoritması</h4>
                    <div className="space-y-4 text-xs font-medium text-slate-400 leading-relaxed">
                      <p>1. <strong>Tetikleme:</strong> Her iş günü sonunda (veya manuel) sistem &quot;Ana Rota Şablonlarını&quot; tarar.</p>
                      <p>2. <strong>Kopyalama:</strong> Aktif şablonlardaki haneler, belirlenen &quot;Sıralama (Order)&quot; değerine göre yeni güne kopyalanır.</p>
                      <p>3. <strong>Durum Analizi:</strong> Eğer bir hane &quot;Pasif&quot; veya &quot;Durdurulmuş&quot; ise, rota listesinde görünür ancak yemek/ekmek miktarı <strong>otomatik olarak 0</strong> set edilir.</p>
                      <p>4. <strong>Kişi Sayısı Senkronizasyonu:</strong> Hane kartındaki güncel üye sayısı ve ekmek sayısı, kopyalama anında &quot;Snapshot&quot; (anlık görüntü) olarak rotaya işlenir.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="p-8 bg-orange-50 rounded-[2.5rem] border border-orange-100">
                      <h5 className="font-black text-orange-900 text-[10px] uppercase tracking-widest mb-4">Transfer Kuralları</h5>
                      <p className="text-xs text-orange-700 leading-relaxed font-bold">
                        Bir şoförün rotası başka bir şoföre aktarıldığında, o güne ait tüm &quot;Teslimat Durumları&quot; ve &quot;Km Bilgileri&quot; yeni şoförün üzerine loglanarak devam eder. Veri bütünlüğü bozulmaz.
                      </p>
                    </div>
                    <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100">
                      <h5 className="font-black text-slate-900 text-[10px] uppercase tracking-widest mb-4">Km ve Yakıt Doğrulaması</h5>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        Rotalar kapatılmadan önce (Finish) başlangıç Km ile bitiş Km farkı kontrol edilir. Negatif değerler sistem tarafından engellenir.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ekmek' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-amber-600 p-4 rounded-3xl shadow-xl shadow-amber-100 shrink-0">
                    <Info className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Ekmek Takip Sistemi</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Lojistik Planlama ve İhale Yönetimi</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Hesaplama Mantığı</h4>
                       <p className="text-sm text-slate-500 leading-relaxed font-medium">Sistem, aktif tüm rotalardaki hanelerin &quot;Günlük Ekmek Sayısı&quot; toplamını alır. Bu toplam, fırına verilecek &quot;Kesin Sipariş&quot; miktarını oluşturur.</p>
                       <div className="p-6 bg-amber-50 rounded-[2rem] border border-amber-100">
                         <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest mb-2 block">İhale Kontrolü</span>
                         <p className="text-[11px] text-amber-700 font-bold">Mevcut ihale limitleri (Max Ekmek Sayısı) her siparişte kontrol edilir. Limit aşımı durumunda sistem uyarı verir.</p>
                       </div>
                    </div>
                    <div className="space-y-6">
                       <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Artan (Zayi) Yönetimi</h4>
                       <p className="text-sm text-slate-500 leading-relaxed font-medium">Gün sonunda dağıtılamayan veya fırına iade edilen ekmekler sisteme &quot;Artan Ekmek&quot; olarak girilir. Bu veri, bir sonraki günün sipariş miktarından otomatik düşülür.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'takvim' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-teal-600 p-4 rounded-3xl shadow-xl shadow-teal-100 shrink-0">
                    <Calendar className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Çalışma Takvimi</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Dağıtım Günleri ve Tatil Yönetimi</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm">
                  <div className="flex flex-col md:flex-row gap-10 items-center">
                    <div className="p-8 bg-teal-50 rounded-[2.5rem] border border-teal-100 shrink-0">
                      <Clock size={48} className="text-teal-600" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 mb-4 tracking-tighter uppercase">Haftalık Dağıtım Planı</h4>
                      <p className="text-[15px] text-slate-500 leading-relaxed font-medium">Sistemde hangi günlerin &quot;Dağıtım Günü&quot; (Çalışma Günü) olduğu belirlenir. Tatil veya pazar günü olarak işaretlenen tarihlerde <strong>Otomatik Rota Oluşturma</strong> algoritması çalışmaz ve fırın siparişi üretilmez.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'saha_paneli' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100 shrink-0">
                    <Smartphone className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Şoför Saha Paneli</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Mobil Yemek Dağıtım Arayüzü</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-slate-50 pb-10">
                    <div className="space-y-6">
                      <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Dağıtım Akışı</h4>
                      <ul className="text-sm text-slate-500 space-y-4 font-medium">
                        <li className="flex gap-4"><div className="w-6 h-6 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full font-black shrink-0">1</div> Şoför sabah Km bilgisini girerek rotayı başlatır.</li>
                        <li className="flex gap-4"><div className="w-6 h-6 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full font-black shrink-0">2</div> Durak listesinden haneyi seçer ve &quot;Teslim Et&quot; butonuna basar.</li>
                        <li className="flex gap-4"><div className="w-6 h-6 bg-blue-600 text-white text-[10px] flex items-center justify-center rounded-full font-black shrink-0">3</div> Evde kimse yoksa &quot;Evde Yok&quot; butonuna basarak not ekler.</li>
                      </ul>
                    </div>
                    <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white">
                      <h5 className="text-[10px] font-black uppercase tracking-[0.3em] mb-4 text-blue-400">Görsel Bildirimler</h5>
                      <div className="space-y-3">
                         <div className="flex items-center gap-3"><div className="w-3 h-3 bg-orange-500 rounded-full"></div> <span className="text-[11px] font-bold uppercase">Turuncu: İzinli Şoför</span></div>
                         <div className="flex items-center gap-3"><div className="w-3 h-3 bg-blue-500 rounded-full"></div> <span className="text-[11px] font-bold uppercase">Mavi Rozet: Rota Bağlantısı</span></div>
                         <div className="flex items-center gap-3"><div className="w-3 h-3 bg-teal-500 rounded-full"></div> <span className="text-[11px] font-bold uppercase">Teal: Vakıftan Alıyor</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-10 items-center">
                    <div className="p-6 bg-blue-50 rounded-2xl text-blue-600 shrink-0 shadow-inner"><Map size={32} /></div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900 mb-2 tracking-tighter uppercase">Navigasyon Entegrasyonu</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium italic">Şoförler, hane adresinin yanındaki ikona tıklayarak Google Haritalar üzerinden doğrudan yol tarifi alabilirler.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'anket' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-teal-600 p-4 rounded-3xl shadow-xl shadow-teal-100 shrink-0">
                    <Plus className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Anket & Analiz</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Kalite Ölçümü ve Sosyal Memnuniyet</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10 border-b border-slate-50 pb-10">
                      <div>
                        <h4 className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-tighter">
                           <Activity className="text-teal-600" size={24} />
                           Dinamik Rota Eşleşmesi
                        </h4>
                        <p className="text-[15px] text-slate-500 leading-relaxed font-medium italic">Sistem, anket girişlerini hanenin o günkü aktif teslimatını yapan kişiyle otomatik eşleştirir. Eğer o gün aktif rota yoksa, şablondaki ana şoför esas alınır. Bu sayede performans raporları %100 doğrulukla üretilir.</p>
                      </div>
                      <div className="bg-teal-50/50 p-10 rounded-[3rem] border border-teal-100">
                        <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-teal-800 mb-6">Soru Tipleri & Veri</h5>
                        <ul className="grid grid-cols-2 gap-4">
                          {[
                            { name: 'Puanlama (1-5 Yıldız)', icon: CheckCircle },
                            { name: 'Çoktan Seçmeli', icon: CheckCircle },
                            { name: 'Açık Uçlu Yorum', icon: CheckCircle },
                            { name: 'Video/Foto Onay', icon: Smartphone }
                          ].map(i => (
                            <li key={i.name} className="flex items-center gap-2 text-[9px] font-bold text-teal-700 uppercase tracking-wider">
                              <i.icon size={12} /> {i.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                   </div>
                   
                   <div className="bg-slate-900 p-10 rounded-[3rem] text-white">
                      <h4 className="text-sm font-black uppercase tracking-[0.3em] mb-4 text-teal-400">Analiz Raporları</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">Anket sonuçları şoför bazlı, mahalle bazlı ve tarih aralıklı olarak grafiklere dökülebilir. Hijyen, sıcaklık ve nezaket skorları günlük olarak merkez tarafından takip edilmektedir.</p>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'gosterge' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-amber-500 p-4 rounded-3xl shadow-xl shadow-amber-100 shrink-0">
                    <Zap className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Görsel Sözlük</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Sistem İçi Renk ve Sembol Dili</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { title: 'Turuncu Vurgu', desc: 'Şoför listesinde ismin turuncu olması personelin İZİNLİ olduğunu belirtir.', color: 'bg-orange-50', iconColor: 'text-orange-500' },
                    { title: 'Mavi Rozet', desc: 'Hane listesinde isim yanında yer alan mavi etiket aktif rotadaki şoförü gösterir.', color: 'bg-blue-50', iconColor: 'text-blue-500' },
                    { title: 'Teal Rozet', desc: '&quot;Vakıftan Alıyor&quot; olarak işaretli haneler için kullanılan self-servis belirtecidir.', color: 'bg-teal-50', iconColor: 'text-teal-600' }
                  ].map((g, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center group hover:border-blue-200 transition-colors">
                      <div className={`w-14 h-14 ${g.color} rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform`}>
                        <Zap size={24} className={g.iconColor} />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-3 uppercase tracking-tighter">{g.title}</h4>
                      <p className="text-[12px] text-slate-500 font-medium leading-relaxed italic">{g.desc}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-white p-10 rounded-[3rem] border border-slate-100">
                   <h4 className="text-xs font-black uppercase tracking-[0.2em] mb-6 text-slate-400">Durum İkonları (Teslimat)</h4>
                   <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center text-green-600"><CheckCircle size={16} /></div>
                        <span className="text-[10px] font-black uppercase text-slate-700">Teslim Edildi</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center text-red-600"><X size={16} /></div>
                        <span className="text-[10px] font-black uppercase text-slate-700">Evde Yok</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600"><AlertTriangle size={16} /></div>
                        <span className="text-[10px] font-black uppercase text-slate-700">Hatalı Adres</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400"><Clock size={16} /></div>
                        <span className="text-[10px] font-black uppercase text-slate-700">Beklemede</span>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'rapor' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-purple-600 p-4 rounded-3xl shadow-xl shadow-purple-100 shrink-0">
                    <ClipboardList className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Raporlama</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Denetlenebilir ve Şeffaf Veri Akışı</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-6">
                    <div className="p-4 bg-purple-50 rounded-2xl text-purple-600 w-fit shadow-inner"><Database size={28} /></div>
                    <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Veri Güvenliği & İmza</h4>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">Sistemde üretilen tüm raporların (PDF/Excel) alt bilgisinde işlemi yapan personelin <strong>Adı Soyadı, Kullanıcı Adı ve İşlem Saati</strong> milisaniye hassasiyetinde otomatik olarak işlenir.</p>
                  </div>
                  <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-6 text-center">
                    <h5 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-4">Desteklenen Çıktılar</h5>
                    <div className="flex flex-wrap justify-center gap-3">
                       {['Günlük Dağıtım Listesi', 'Hane Durum Raporu', 'Şoför Performans Çizelgesi', 'Anket Analiz Formu', 'İhale Takip Çizelgesi'].map(r => (
                         <div key={r} className="px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black text-slate-600 uppercase tracking-widest">{r}</div>
                       ))}
                    </div>
                  </div>
                </div>

                <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white">
                   <h4 className="text-lg font-black uppercase tracking-widest mb-6 text-purple-400">Kurumsal Form Standartları</h4>
                   <p className="text-sm text-slate-400 leading-relaxed font-medium">Raporlar T.C. Edirne Valiliği ve SYDV antetli kağıt standartlarına uygun marjinlerle (A4) optimize edilmiştir. Otomatik sayfa numaralandırma ve tablo bölme mantığı aktiftir.</p>
                </div>
              </div>
            )}

            {activeTab === 'sifreleme' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-blue-600 p-4 rounded-3xl shadow-xl shadow-blue-100 shrink-0">
                    <ShieldCheck className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">KVKK & Şifreleme</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Askeri Düzey Veri Güvenliği Protokolü</p>
                  </div>
                </div>

                <div className="bg-slate-900 p-16 rounded-[4rem] text-white shadow-2xl relative overflow-hidden text-center">
                   <div className="relative z-10 space-y-8">
                      <div className="inline-block bg-blue-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/20">AES-256-GCM</div>
                      <h3 className="text-5xl font-black tracking-tighter leading-tight">Veritabanı Seviyesinde <br/> <span className="text-blue-400">Kırılmaz Koruma</span></h3>
                      <p className="max-w-3xl mx-auto text-slate-400 font-medium leading-relaxed italic opacity-80 border-t border-white/5 pt-8">
                        TC Kimlik Numarası, Telefon Hattı ve Hane Bilgileri; veritabanına kaydedilirken AES-256 GCM metodu ile rastgele karakterli bloklara dönüştürülür. 
                        Bu verilerin anahtarları sistem çekirdeğinde (Env) gizlidir ve hiçbir yönetici veya personel tarafından düz metin olarak görülemez.
                      </p>
                      <div className="flex justify-center gap-10">
                        <div className="text-center">
                          <h6 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Algoritma</h6>
                          <p className="text-xs font-bold uppercase">GCM Modu</p>
                        </div>
                        <div className="text-center">
                          <h6 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Key Length</h6>
                          <p className="text-xs font-bold uppercase">256 Bit</p>
                        </div>
                        <div className="text-center">
                          <h6 className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Kapsam</h6>
                          <p className="text-xs font-bold uppercase">End-to-End</p>
                        </div>
                      </div>
                   </div>
                   <Database className="absolute -right-20 -bottom-20 text-white/5" size={400} />
                </div>
              </div>
            )}

            {activeTab === 'bakim' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-slate-600 p-4 rounded-3xl shadow-xl shadow-slate-100 shrink-0">
                    <Database className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Sistem Bakımı</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Bütünlük ve Yedekleme Denetimi</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                   <div className="bg-amber-50 p-10 rounded-[3rem] border border-amber-100 relative overflow-hidden group shadow-xl shadow-amber-200/20 flex flex-col justify-between">
                      <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-200/20 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                           <AlertTriangle className="text-amber-600" size={24} />
                           <h4 className="text-xl font-black text-slate-900 tracking-tighter uppercase">10 Günlük Yedekleme Kuralı</h4>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium mb-6">Yasal mevzuat ve veri bütünlüğü gereği, son yedeklemenin üzerinden 10 gün geçtiğinde sistem &quot;KRİTİK&quot; uyarı durumuna geçer.</p>
                      </div>
                      <div className="relative z-10 bg-white/50 p-4 rounded-2xl text-[10px] font-black text-amber-800 uppercase tracking-widest border border-amber-100">Bu kural tüm hane ve şoför verileri için geçerlidir.</div>
                   </div>
                   
                   <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-6">
                      <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Veri Temizliği</h4>
                      <p className="text-xs text-slate-500 font-medium leading-relaxed italic border-l-4 border-slate-200 pl-4">Tamamlanmış rotalar, silinmiş hane geçmişleri ve geçici önbellek verileri sistem tarafından periyodik olarak temizlenir. Bu işlem IndexedDB performansını %40 oranında artırmaktadır.</p>
                      <div className="flex gap-3">
                         <div className="px-3 py-1 bg-slate-50 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500">Auto-Cleanup</div>
                         <div className="px-3 py-1 bg-slate-50 rounded-lg text-[9px] font-black uppercase tracking-widest text-slate-500">Cache Flush</div>
                      </div>
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'notlar' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-blue-700 p-4 rounded-3xl shadow-xl shadow-blue-100 shrink-0">
                    <FileText className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Sürüm Notları</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Sistem v4.0.0 Teknik Gelişmeler</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-bl-[3rem] shadow-lg">v4.0.0 (AKTİF)</div>
                   <div className="space-y-10 relative z-10">
                      <div>
                        <h4 className="text-2xl font-black text-slate-900 mb-6 tracking-tighter uppercase">Mayıs 2026 Büyük Güncelleme</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-4">
                           {[
                             'Şoför İzin ve Vekil Personel modülü tam entegrasyonu.',
                             'Hane listesinde dinamik şoför/rota rozetleri (useMemo optimizasyonu).',
                             'Koşullu TC validasyonu (Aktif/Pasif statü ayrımı).',
                             'AES-256 GCM askeri düzey şifreleme altyapısı.',
                             'Kritik Rota Müdahale panelinin güvenlik nedeniyle kaldırılması.',
                             'Anketlerin vekil şoförlerle otomatik eşleşme algoritması.',
                             'Dashboard tabanlı tam ekran kılavuz arayüzü.'
                           ].map((note, i) => (
                             <div key={i} className="flex items-center gap-4 text-[13px] text-slate-500 font-bold group-hover:translate-x-1 transition-transform">
                               <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0 shadow-lg shadow-blue-600/50"></div> {note}
                             </div>
                           ))}
                        </div>
                      </div>
                      
                      <div className="pt-10 border-t border-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
                         <div className="text-center md:text-left">
                            <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Build ID</h6>
                            <p className="text-xs font-bold text-slate-900">ASEVI-PRO-V4-20260516</p>
                         </div>
                         <div className="flex gap-4">
                            <div className="bg-blue-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-100 italic">NEXT.JS 15.x</div>
                            <div className="bg-blue-50 px-4 py-2 rounded-xl text-[10px] font-black text-blue-600 uppercase tracking-widest border border-blue-100 italic">MONGODB EJSON</div>
                         </div>
                      </div>
                   </div>
                </div>
              </div>
            )}

          </div>
        </main>
      </div>

      {/* Footer Branding - Fixed at bottom */}
      <footer className="h-16 border-t border-slate-100 bg-white flex items-center justify-between px-8 shrink-0 z-50">
        <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">
          T.C. EDİRNE MERKEZ SYDV VAKIF BAŞKANLIĞI
        </p>
        <div className="flex items-center gap-4 text-[9px] font-bold text-slate-300 uppercase tracking-widest">
          <span>Aşevi Otomasyon Belgeleme</span>
          <div className="w-1 h-1 bg-slate-200 rounded-full"></div>
          <span className="text-blue-600">© 2026 Tüm Hakları Saklıdır.</span>
        </div>
      </footer>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f1f5f9;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #e2e8f0;
        }
      `}</style>
    </div>
  );
}
