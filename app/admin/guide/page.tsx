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
    { name: 'Rota & Dağıtım', id: 'rota', icon: Map, color: 'text-orange-500', bg: 'bg-orange-50' },
    { name: 'İzin & Vekil', id: 'truck', icon: Truck, color: 'text-indigo-500', bg: 'bg-indigo-50' },
    { name: 'Anket & Analiz', id: 'anket', icon: Plus, color: 'text-teal-500', bg: 'bg-teal-50' },
    { name: 'Görsel Sözlük', id: 'gosterge', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50' },
    { name: 'Raporlama', id: 'rapor', icon: ClipboardList, color: 'text-purple-500', bg: 'bg-purple-50' },
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
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Kurumsal Erişim Denetimi & Zırhlı Altyapı</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
                    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <ShieldCheck className="text-blue-600" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tighter">İki Kademeli Onay</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">Yeni personel kayıtları varsayılan olarak &quot;Pasif&quot; başlar. Yönetici onayı olmadan sistem özelliklerine erişim sağlanamaz.</p>
                  </div>
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 group">
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                      <History className="text-indigo-600" size={28} />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tighter">Rol Yetkilendirme</h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                      <strong className="text-slate-900">Admin:</strong> Tam yetki ve veritabanı yönetimi. <br/>
                      <strong className="text-indigo-600">Personel:</strong> Dağıtım, hane ve anket operasyonları.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white relative overflow-hidden shadow-2xl">
                  <div className="absolute right-0 top-0 w-1/3 h-full bg-blue-600/10 blur-3xl"></div>
                  <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                    <div className="bg-white/10 p-5 rounded-[2rem] backdrop-blur-xl border border-white/10">
                      <ShieldAlert size={40} className="text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black mb-3 tracking-tight">Zırhlı AES-256 Altyapısı</h3>
                      <p className="text-slate-400 text-base leading-relaxed font-medium italic opacity-80">
                        &quot;Tüm hassas veriler (TC No, Telefon, Adres) veritabanına kaydedilirken askeri düzey şifreleme bloklarına dönüştürülür.&quot;
                      </p>
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
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Hane Yönetimi</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Bireysel ve Kurumsal Dağıtım Verisi</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-10">
                  <div className="flex gap-8 items-start border-b border-slate-50 pb-10">
                    <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 shrink-0"><Search size={28} /></div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 mb-2">Akıllı Rozet Sistemi</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">Hane listesinde isimlerin yanında yer alan mavi rozetler, o hanenin o günkü aktif rota şoförünü veya ana şablon şoförünü anlık olarak gösterir.</p>
                    </div>
                  </div>
                  <div className="flex gap-8 items-start">
                    <div className="p-4 bg-blue-50 rounded-2xl text-blue-600 shrink-0"><Smartphone size={28} /></div>
                    <div>
                      <h4 className="text-lg font-black text-slate-900 mb-2">Pasif Kayıt & TC Protokolü</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">Yeni şoförler pasif eklendiğinde TC No zorunlu değildir. Ancak kaydı aktifleştirmek için geçerli bir TC No girişi sistem tarafından zorunlu tutulur.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'rota' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-orange-500 p-4 rounded-3xl shadow-xl shadow-orange-100 shrink-0">
                    <Map className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">Rota & Lojistik</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Saha Operasyonları ve Akıllı Planlama</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm">
                   <div className="flex flex-col md:flex-row gap-10 items-center mb-10">
                      <div className="w-20 h-20 bg-orange-50 rounded-[2rem] flex items-center justify-center shrink-0 text-orange-600 shadow-inner">
                        <Zap size={40} />
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-slate-900 mb-2 tracking-tight">Dinamik Rota Şablonları</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium italic">Şoförler için bir kez tanımlanan &quot;Ana Rota&quot;, her iş günü sonunda sistem tarafından otomatik olarak bir sonraki güne kopyalanır.</p>
                      </div>
                   </div>
                   <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100 flex items-center gap-4 text-slate-900 text-xs font-bold leading-relaxed">
                      <Info size={24} className="text-orange-500 shrink-0" />
                      Pasif duruma alınan haneler rota toplamlarından otomatik olarak düşülür ve raporlarda &quot;Pasif&quot; etiketiyle belirtilir.
                   </div>
                </div>
              </div>
            )}

            {activeTab === 'truck' && (
              <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-start gap-6">
                  <div className="bg-indigo-600 p-4 rounded-3xl shadow-xl shadow-indigo-100 shrink-0">
                    <Truck className="text-white" size={32} />
                  </div>
                  <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase leading-none mb-2">İzin & Vekil Yönetimi</h2>
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Personel Devamlılığı ve Yedekleme Sistemi</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center mb-6">
                        <CalendarOff className="text-orange-500" size={24} />
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-3 tracking-tighter">İzin Tanımlama</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">İzinli şoförler listede turuncu vurgu ile gösterilir ve operasyonlardan otomatik olarak muaf tutulur.</p>
                    </div>
                  </div>
                  <div className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center mb-6">
                        <UserCheck className="text-green-600" size={24} />
                      </div>
                      <h4 className="text-lg font-black text-slate-900 mb-3 tracking-tighter">Vekil Atama</h4>
                      <p className="text-sm text-slate-500 leading-relaxed font-medium">İzinli şoförün yerine yetkili bir personel veya pasif bir şoför vekil (proxy) olarak atanabilir.</p>
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
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div>
                        <h4 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
                           <Activity className="text-teal-600" size={18} />
                           Dinamik Eşleştirme
                        </h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Anketler, hanenin o günkü aktif şoförüyle (vekil dahil) veya ana şablondaki şoförüyle otomatik olarak eşleştirilir.</p>
                      </div>
                      <div className="bg-teal-50/50 p-6 rounded-[2rem] border border-teal-100">
                        <h5 className="text-[10px] font-black uppercase tracking-widest text-teal-800 mb-4">Saha Kriterleri</h5>
                        <ul className="space-y-2">
                          {['Yemek Sıcaklığı', 'Ekmek Düzeni', 'Nezaket', 'Hijyen'].map(i => (
                            <li key={i} className="flex items-center gap-2 text-[10px] font-bold text-teal-700 uppercase">
                              <CheckCircle size={12} /> {i}
                            </li>
                          ))}
                        </ul>
                      </div>
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
                    { title: 'Turuncu Vurgu', desc: 'Şoförün İzinli Olduğunu Gösterir', color: 'bg-orange-100' },
                    { title: 'Mavi Rozet', desc: 'Rota Şoförü Bilgisini Verir', color: 'bg-blue-100' },
                    { title: 'Teal Rozet', desc: 'Vakıf Self-Servis Teslimatı', color: 'bg-teal-100' }
                  ].map((g, i) => (
                    <div key={i} className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm text-center">
                      <div className={`w-12 h-12 ${g.color} rounded-2xl mx-auto mb-6 flex items-center justify-center`}>
                        <Zap size={20} className="text-white" />
                      </div>
                      <h4 className="text-sm font-black text-slate-900 mb-2">{g.title}</h4>
                      <p className="text-[11px] text-slate-400 font-medium leading-relaxed">{g.desc}</p>
                    </div>
                  ))}
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

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm">
                   <div className="flex gap-8 items-start">
                      <div className="p-4 bg-purple-50 rounded-2xl text-purple-600 shrink-0"><Database size={28} /></div>
                      <div>
                        <h4 className="text-lg font-black text-slate-900 mb-2">Personel İmza Takibi</h4>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Sistemde üretilen tüm raporların alt bilgisinde işlemi yapan personelin adı soyadı otomatik olarak işlenir.</p>
                      </div>
                   </div>
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
                   <div className="relative z-10 space-y-6">
                      <div className="inline-block bg-blue-600 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest">AES-256 GCM</div>
                      <h3 className="text-5xl font-black tracking-tighter leading-tight">Veritabanı Seviyesinde <br/> <span className="text-blue-400">Tam Koruma</span></h3>
                      <p className="max-w-2xl mx-auto text-slate-400 font-medium leading-relaxed italic opacity-80 underline decoration-blue-500/30 underline-offset-8">
                        TC Kimlik Numarası ve adres bilgileri kaydedilirken rastgele karakterli bloklara dönüştürülür. Anahtarlar sistem çekirdeğinde saklanır.
                      </p>
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

                <div className="bg-white p-12 rounded-[3.5rem] border border-slate-100 shadow-sm">
                   <div className="bg-amber-50 p-10 rounded-[3rem] border border-amber-100 relative overflow-hidden group">
                      <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-200/20 rounded-full blur-xl group-hover:scale-150 transition-transform"></div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-6">
                           <AlertTriangle className="text-amber-600" size={24} />
                           <h4 className="text-xl font-black text-slate-900 tracking-tighter">10 Günlük Yedekleme Kuralı</h4>
                        </div>
                        <p className="text-sm text-slate-500 leading-relaxed font-medium">Yasal mevzuat gereği 10 gün yedek alınmadığında sistem &quot;KRİTİK&quot; uyarı durumuna geçerek yöneticiyi uyarır.</p>
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
                    <p className="text-slate-400 font-bold text-xs tracking-[0.2em] uppercase">Mayıs 2026 Teknik İyileştirmeler</p>
                  </div>
                </div>

                <div className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-xl relative overflow-hidden group">
                   <div className="absolute top-0 right-0 p-8 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-bl-[3rem] shadow-lg">v4.0.0 (AKTİF)</div>
                   <h4 className="text-2xl font-black text-slate-900 mb-8 tracking-tighter">Sistem v4.0.0 Güncellemesi</h4>
                   <ul className="space-y-4">
                     {[
                       'Şoför İzin ve Vekil Personel modülü devreye alındı.',
                       'Hane listesine dinamik şoför/rota rozetleri entegre edildi.',
                       'Pasif kayıt şoför ekleme ve validasyonlu TC sistemi güncellendi.',
                       'AES-256 GCM askeri düzey şifreleme altyapısı optimize edildi.',
                       'Kritik Rota Müdahale paneli kaldırıldı, süreçler otomatikleşti.'
                     ].map((note, i) => (
                       <li key={i} className="flex items-center gap-4 text-sm text-slate-500 font-bold group-hover:translate-x-2 transition-transform">
                         <div className="w-2 h-2 rounded-full bg-blue-600"></div> {note}
                       </li>
                     ))}
                   </ul>
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
