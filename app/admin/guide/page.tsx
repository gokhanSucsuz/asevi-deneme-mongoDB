'use client';

import { 
  FileText, Users, Truck, Map, ShieldAlert, BarChart, 
  Calendar, Smartphone, CheckCircle, Database, Lock, ShieldCheck,
  Search, History, ClipboardList, AlertTriangle, Info, Zap, Download,
  ArrowRight, Menu, X, Plus, Clock, CalendarOff, UserCheck
} from 'lucide-react';
import { useState } from 'react';

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState('guvenlik');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: 'Güvenlik Protokolü', id: 'guvenlik', icon: Lock },
    { name: 'Hane & Kurum Yönetimi', id: 'hane', icon: Users },
    { name: 'Rota & Dağıtım', id: 'rota', icon: Map },
    { name: 'Şoför & İzin Yönetimi', id: 'truck', icon: Truck },
    { name: 'Anket & Memnuniyet', id: 'anket', icon: Plus },
    { name: 'Görsel Göstergeler', id: 'gosterge', icon: Zap },
    { name: 'Raporlama & Veri', id: 'rapor', icon: ClipboardList },
    { name: 'KVKK & Şifreleme', id: 'sifreleme', icon: ShieldCheck },
    { name: 'Sistem Bakımı', id: 'bakim', icon: Database },
    { name: 'Sürüm Notları', id: 'notlar', icon: FileText }
  ];

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setIsMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-6 md:p-10 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-blue-500/20 p-2 rounded-xl backdrop-blur-md border border-blue-400/30">
                <ShieldAlert className="text-blue-400" size={24} />
              </div>
              <span className="text-blue-300 font-bold tracking-widest uppercase text-xs">T.C. EDİRNE VALİLİĞİ - SYDV</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black leading-tight tracking-tight">
              Aşevi Dağıtım <span className="text-blue-400">Kılavuzu</span>
            </h1>
            <p className="text-slate-400 text-sm md:text-base mt-2 max-w-2xl">
              Vakıf operasyonlarının dijitalleşme standartlarını, üst düzey güvenlik protokollerini ve kullanım detaylarını içeren resmi teknik dokümandır.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 hidden md:block">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Sistem Sürümü</p>
            <p className="text-lg font-black text-white">v4.0.0 (Mayıs 2026)</p>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3">
          <div className="sticky top-6 space-y-6">
            <div className="bg-white/80 backdrop-blur-xl p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-white/50 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:bg-blue-500/10 transition-colors"></div>
              
              <div className="flex items-center justify-between mb-8 px-2 relative z-10">
                <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-[10px] flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></div>
                  Navigasyon
                </h3>
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="lg:hidden p-2 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>

              <nav className={`space-y-1 relative z-10 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center gap-4 px-5 py-4 rounded-[1.25rem] transition-all duration-300 group/item ${
                        activeTab === item.id 
                          ? 'bg-slate-900 text-white shadow-lg shadow-slate-300' 
                          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className={`p-2 rounded-xl transition-colors ${
                        activeTab === item.id ? 'bg-white/10' : 'bg-slate-100 group-hover/item:bg-white shadow-sm'
                      }`}>
                        <Icon size={18} className={activeTab === item.id ? 'text-blue-400' : 'text-slate-500'} />
                      </div>
                      <span className="text-[13px] font-bold tracking-tight">{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-blue-200 relative overflow-hidden group hidden lg:block">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition-transform duration-700"></div>
              <div className="relative z-10">
                <div className="bg-white/20 w-12 h-12 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md">
                  <ShieldCheck size={24} className="text-white" />
                </div>
                <h4 className="text-lg font-black leading-tight mb-2 uppercase tracking-tighter">Hızlı Yardım <br/> & Destek</h4>
                <p className="text-blue-100 text-xs font-medium leading-relaxed opacity-80">
                  Operasyonel sorunlar için sistem yöneticisi ile iletişime geçin.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="lg:col-span-9 animate-in fade-in slide-in-from-right-4 duration-500">
          
          {activeTab === 'guvenlik' && (
            <div className="space-y-10">
              <div className="flex items-center gap-6 border-b border-slate-100 pb-10">
                <div className="bg-red-50 p-5 rounded-[2rem] shadow-inner">
                  <Lock className="text-red-600" size={40} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight uppercase">Güvenlik ve Erişim</h2>
                  <p className="text-slate-500 font-bold text-sm tracking-widest mt-1">KURUMSAL ERİŞİM DENETİMİ V4.0</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-50 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                      <ShieldCheck className="text-blue-600" size={32} />
                    </div>
                    <h4 className="font-black text-slate-900 text-2xl mb-4 tracking-tighter">İki Kademeli Onay</h4>
                    <p className="text-slate-600 leading-relaxed text-[15px] font-medium opacity-80">
                      Yeni personel kayıtları sistemde varsayılan olarak &quot;Pasif&quot; başlar. Tam erişim için yönetici onayı şarttır. 
                      Şifreler sistem tarafında tek yönlü hashing yöntemiyle saklanır.
                    </p>
                  </div>
                </div>

                <div className="bg-white p-10 rounded-[3rem] shadow-xl shadow-slate-200/50 border border-white relative overflow-hidden group">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-indigo-50 rounded-full group-hover:scale-150 transition-transform duration-700"></div>
                  <div className="relative z-10">
                    <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-8 shadow-sm">
                      <History className="text-indigo-600" size={32} />
                    </div>
                    <h4 className="font-black text-slate-900 text-2xl mb-4 tracking-tighter">Rol Bazlı Yetki</h4>
                    <p className="text-slate-600 leading-relaxed text-[15px] font-medium opacity-80">
                      <strong>Admin:</strong> Tam yetki, veri silme, yedekleme ve personel onaylama yetkileri. <br/>
                      <strong className="text-indigo-600">Personel:</strong> Hane yönetimi, rapor alma ve anket girişi yetkileri ile sınırlandırılmıştır.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 p-12 rounded-[3.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-blue-600/20 to-transparent"></div>
                <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                  <div className="bg-white/10 p-6 rounded-[2.5rem] backdrop-blur-xl border border-white/10 shrink-0">
                    <ShieldAlert size={48} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="bg-blue-500 text-[10px] font-black px-3 py-1 rounded-full tracking-widest uppercase">Zırhlı Altyapı</span>
                      <span className="text-blue-400 font-bold text-[10px] tracking-widest uppercase">Askeri Düzey</span>
                    </div>
                    <h3 className="text-3xl font-black mb-4 tracking-tight">AES-256 GCM Şifreleme</h3>
                    <p className="text-slate-400 leading-relaxed text-lg font-medium italic">
                      &quot;Sistemimiz askeri düzey AES-256 GCM şifreleme ve gelişmiş oturum koruması ile donatılmıştır. 
                      TC Kimlik No ve hassas hane verileri hiçbir zaman şifresiz olarak depolanmaz.&quot;
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hane' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-blue-500/10 p-4 rounded-2xl">
                  <Users className="text-blue-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Hane & Kurum Yönetimi</h2>
                  <p className="text-gray-500 font-medium">Bireysel ve toplu yemek dağıtım yönetimi</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200 space-y-8">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
                      <Search className="text-blue-600" size={20} />
                      Gelişmiş Filtreleme & Rozetler
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Hane listesinde kurum adının yanında, ilgili hanenin hangi şoförün rotasında olduğunu gösteren <strong>mavi rozetler</strong> yer alır. 
                      Bu rozetler hem ana şablonu hem de günlük aktif rotayı analiz ederek en güncel bilgiyi sunar.
                    </p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
                      <Smartphone className="text-blue-600" size={20} />
                      Pasif Kayıt Protokolü
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Yeni şoförler sisteme &quot;Pasif&quot; olarak eklenebilir. Pasif kayıtlarda TC Kimlik No zorunlu değildir; ancak kayıt &quot;Aktif&quot; hale getirilirken <strong>validasyonlu TC No</strong> girişi sistem tarafından zorunlu tutulur.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rota' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-orange-500/10 p-4 rounded-2xl">
                  <Map className="text-orange-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Rota & Lojistik</h2>
                  <p className="text-gray-500 font-medium">Saha operasyonlarının akıllı yönetimi</p>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-200">
                <div className="flex items-start gap-6 mb-10">
                  <div className="w-16 h-16 bg-orange-50 rounded-3xl flex items-center justify-center shrink-0">
                    <Zap className="text-orange-600" size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-2xl mb-2">Dinamik Rota Şablonları</h4>
                    <p className="text-gray-600 leading-relaxed italic">
                      Sistem, her şoför için &quot;Ana Rota&quot; mantığıyla çalışır. Bir kez tanımlanan ana rota, sistem tarafından her iş günü sonunda otomatik olarak bir sonraki güne kopyalanır. 
                      Bu sayede yöneticilerin her gün manuel rota oluşturmasına gerek kalmaz.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <Clock className="text-orange-600" size={20} />
                      <h5 className="font-bold text-gray-900 uppercase text-sm tracking-widest">Akıllı Durum Takibi</h5>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Saha ekiplerinin (şoförler) teslimatları gerçek zamanlı olarak merkeze duser. Bekleyen, teslim edilen ve hatalı (evde yok, vb.) durumlar anlık olarak izlenebilir.
                    </p>
                  </div>
                  <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4">
                      <ShieldAlert className="text-orange-600" size={20} />
                      <h5 className="font-bold text-gray-900 uppercase text-sm tracking-widest">Pasif Hane Denetimi</h5>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      Durdurulan veya pasif duruma alınan haneler şoför listesinde gösterilmeye devam eder ancak sistem tarafından otomatik olarak <strong>0 (sıfır)</strong> yemek ve ekmek olarak işaretlenir. Bu hanelerin kişi sayıları rota toplamlarından düşülür. Raporlarda &quot;Pasif&quot; etiketiyle yer alırlar.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'truck' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-blue-600/10 p-4 rounded-2xl">
                  <Truck className="text-blue-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Şoför & İzin Yönetimi</h2>
                  <p className="text-gray-500 font-medium">Personel devamlılığı ve yedekleme sistemi</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-900 text-xl mb-4 flex items-center gap-2">
                    <CalendarOff className="text-orange-500" /> İzin Tanımlama
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    Şoförler için başlangıç ve bitiş tarihli izinler tanımlanabilir. İzinli süresi boyunca şoför sistemde otomatik olarak pasif konuma geçer ve listede <strong>turuncu vurgu</strong> ile gösterilir.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-gray-200 shadow-sm">
                  <h4 className="font-bold text-gray-900 text-xl mb-4 flex items-center gap-2">
                    <UserCheck className="text-green-600" /> Vekil (Proxy) Sistemi
                  </h4>
                  <p className="text-gray-600 text-sm leading-relaxed">
                    İzinli şoförün yerine <strong>Pasif Şoförler</strong> veya <strong>Yetkili Personeller</strong> vekil olarak atanabilir. Pasif şoför vekil atandığında izin süresince geçici olarak aktif edilir ve izin bitiminde otomatik olarak tekrar pasife alınır.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'rapor' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-indigo-500/10 p-4 rounded-2xl">
                  <ClipboardList className="text-indigo-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Raporlama ve Analiz</h2>
                  <p className="text-gray-500 font-medium">Şeffaf ve denetlenebilir veri akışı</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-gray-200 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="bg-indigo-50 p-3 rounded-xl shrink-0">
                    <Users className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-xl mb-2">İşlem Yapan Personel Takibi</h4>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Sistemde üretilen tüm PDF ve Excel raporlarında, işlemi gerçekleştiren personelin Adı Soyadı otomatik olarak alt bilgiye işlenir. 
                      &quot;Bilinmeyen Personel&quot; hatasını önlemek için aktif oturum yönetimi aktiftir.
                    </p>
                  </div>
                </div>
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 mt-4">
                  <h5 className="font-bold text-gray-900 mb-2 underline underline-offset-4 decoration-indigo-500">Resmi Formlar</h5>
                  <p className="text-xs text-gray-500 leading-relaxed">Valilik standartlarına uygun antetli kağıt çıktıları saniyeler içinde hazırlanır.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'gosterge' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-amber-500/10 p-4 rounded-2xl">
                  <Zap className="text-amber-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Görsel Göstergeler</h2>
                  <p className="text-gray-500 font-medium">Sistem üzerindeki renk ve sembol dilleri</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <div className="w-full h-4 bg-orange-100 rounded-t-xl mb-4 border-b border-orange-200"></div>
                  <h5 className="font-bold text-gray-900 mb-2 italic">Turuncu Vurgu</h5>
                  <p className="text-xs text-gray-500 leading-relaxed">Şoförler listesinde personelin <strong>izinde</strong> olduğunu belirtir.</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <div className="px-3 py-1 bg-blue-50 text-blue-600 border border-blue-100 rounded-full text-[10px] font-bold mb-4 uppercase">ŞOFÖR İSMİ</div>
                  <h5 className="font-bold text-gray-900 mb-2 italic">Mavi Rozet</h5>
                  <p className="text-xs text-gray-500 leading-relaxed">Hane listesinde kaydın hangi <strong>rota şoförüne</strong> bağlı olduğunu gösterir.</p>
                </div>
                <div className="bg-white p-6 rounded-[2rem] border border-gray-200 shadow-sm flex flex-col items-center text-center">
                  <div className="px-3 py-1 bg-teal-100 text-teal-700 rounded-full text-[10px] font-bold mb-4 uppercase">Vakıftan Alıyor</div>
                  <h5 className="font-bold text-gray-900 mb-2 italic">Teal Rozet</h5>
                  <p className="text-xs text-gray-500 leading-relaxed">Hanenin <strong>self-servis</strong> olarak vakıftan yemek aldığını belirtir.</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'anket' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-teal-500/10 p-4 rounded-2xl">
                  <Plus className="text-teal-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Anket & Memnuniyet</h2>
                  <p className="text-gray-500 font-medium">Kalite ölçümü ve dinamik eşleştirme sistemi</p>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-gray-200 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h5 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                       <Zap className="text-teal-600" size={20} />
                       Akıllı Rota Eşleştirme
                    </h5>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Anket modülü, haneleri şoförlerle eşleştirirken hibrit bir algoritma kullanır:
                      <br/>1. Öncelikle <strong>günlük aktif rotadaki</strong> duraklar kontrol edilir.
                      <br/>2. Eğer aktif rota yoksa <strong>ana rota şablonundaki</strong> eşleşmeler esas alınır.
                      <br/>Bu sayede vekil şoförlerin veya rota değişikliklerinin anket istatistiklerine doğru yansıması sağlanır.
                    </p>
                  </div>
                  <div className="bg-teal-50 p-8 rounded-3xl border border-teal-100">
                    <h5 className="font-bold text-teal-900 mb-3 text-xs uppercase tracking-widest">Saha Analiz Kriterleri</h5>
                    <div className="space-y-3">
                       {['Yemek Lezzeti ve Sıcaklığı', 'Ekmek Dağıtım Düzeni', 'Şoför Nezaketi', 'Hijyen Standartları'].map(t => (
                         <div key={t} className="flex items-center gap-2 text-[11px] font-bold text-teal-800 uppercase">
                           <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                           {t}
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex items-start gap-4">
                  <div className="bg-white p-3 rounded-2xl shadow-sm text-teal-600">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900 uppercase mb-1">Doğrulama Protokolü</p>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Anketler sadece teslimat anında veya teslimat sonrası 24 saat içinde girilebilir. 
                      &quot;Vakıftan Alıyor&quot; (Self-Servis) işaretli haneler için anketler merkezi sistem üzerinden personel tarafından doldurulur.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sifreleme' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-amber-500/10 p-4 rounded-2xl">
                  <ShieldCheck className="text-amber-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">KVKK & Şifreleme</h2>
                  <p className="text-gray-500 font-medium">Askeri düzeyde veri güvenliği</p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-10 md:p-14 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-10">
                  <div className="inline-flex items-center gap-3 bg-blue-500 px-6 py-2 rounded-full text-white font-black uppercase tracking-widest text-xs">
                    AES-256 GCM Şifreleme
                  </div>
                  
                  <h3 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter">
                    Veritabanı Seviyesinde <br className="hidden md:block" />
                    <span className="text-blue-400">Tam Koruma</span>
                  </h3>
                  
                  <p className="text-slate-400 text-lg leading-relaxed max-w-3xl">
                    TC Kimlik Numarası, Telefon Hattı ve Hane Bilgileri; 
                    veritabanına kaydedilirken AES-256 GCM metodu ile rastgele karakterli bloklara dönüştürülür. 
                    Bu verilerin anahtarları sistem çekirdeğinde gizlidir.
                  </p>
                </div>
                <Database className="absolute -right-20 -bottom-20 text-white/5" size={450} />
              </div>
            </div>
          )}

          {activeTab === 'bakim' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-teal-500/10 p-4 rounded-2xl">
                  <Database className="text-teal-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Sistem Bakımı</h2>
                  <p className="text-gray-500 font-medium">Veri bütünlüğü ve yedekleme denetimi</p>
                </div>
              </div>

              <div className="bg-white p-8 rounded-[2rem] border border-gray-200">
                <div className="space-y-6">
                  <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                    <h4 className="font-bold text-gray-900 mb-2">10 Günlük Yedekleme Kuralı</h4>
                    <p className="text-sm text-gray-600 leading-relaxed italic">
                      Yasal mevzuat ve veri güvenliği gereği, sistem yapılan her büyük operasyondan sonra manuel yedekleme ister. 
                      Eğer 10 gün boyunca yedek alınmazsa sistem &quot;KRİTİK&quot; uyarı durumuna geçer.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notlar' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-indigo-600/10 p-4 rounded-2xl">
                  <FileText className="text-indigo-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Sürüm Notları</h2>
                  <p className="text-gray-500 font-medium">Sistem güncellemeleri ve iyileştirmeler</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-6 bg-blue-600 text-white font-black text-xs uppercase tracking-widest rounded-bl-3xl">v4.0.0 (GÜNCEL)</div>
                  <h4 className="font-bold text-gray-900 text-xl mb-4">Mayıs 2026 Güncellemesi</h4>
                  <ul className="space-y-3 text-sm text-gray-600">
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>Şoför İzin ve Vekil Personel modülü devreye alındı.</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>Hane listesine akıllı şoför/rota rozetleri eklendi.</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>Pasif kayıt şoför ekleme ve koşullu TC validasyonu sistemi güncellendi.</li>
                    <li className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>AES-256 GCM şifreleme altyapısı tüm hassas verilere uygulandı.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-20 py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-blue-900/10"></div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <div className="flex justify-center gap-4 mb-10">
            <div className="w-12 h-1.5 bg-red-600 rounded-full shadow-lg shadow-red-600/20"></div>
            <div className="w-12 h-1.5 bg-blue-600 rounded-full shadow-lg shadow-blue-600/20"></div>
            <div className="w-12 h-1.5 bg-red-600 rounded-full shadow-lg shadow-red-600/20"></div>
          </div>
          <p className="text-white font-black uppercase tracking-[0.4em] text-xs mb-4">
            T.C. EDİRNE MERKEZ SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKIF BAŞKANLIĞI
          </p>
          <div className="flex items-center justify-center gap-4 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
            <span>Aşevi Otomasyon Belgeleme</span>
            <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
            <span className="text-blue-400">v4.0.0</span>
            <div className="w-1 h-1 bg-slate-700 rounded-full"></div>
            <span>© 2026 Tüm Hakları Saklıdır.</span>
          </div>
        </div>
      </div>

    </div>
  );
}
