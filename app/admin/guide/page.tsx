'use client';

import { 
  FileText, Users, Truck, Map, ShieldAlert, BarChart, 
  Calendar, Smartphone, CheckCircle, Database, Lock, ShieldCheck,
  Search, History, ClipboardList, AlertTriangle, Info, Zap, Download,
  ArrowRight, Menu, X, Plus, Clock
} from 'lucide-react';
import { useState } from 'react';

export default function GuidePage() {
  const [activeTab, setActiveTab] = useState('guvenlik');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: 'Güvenlik Protokolü', id: 'guvenlik', icon: Lock },
    { name: 'Hane & Kurum Yönetimi', id: 'hane', icon: Users },
    { name: 'Rota & Dağıtım', id: 'rota', icon: Map },
    { name: 'Vakıf Teslimatı', id: 'truck', icon: Truck },
    { name: 'Anket & Memnuniyet', id: 'anket', icon: Plus },
    { name: 'Raporlama & Veri', id: 'rapor', icon: ClipboardList },
    { name: 'KVKK & Şifreleme', id: 'sifreleme', icon: ShieldCheck },
    { name: 'Sistem Bakımı', id: 'bakim', icon: Database }
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
            <p className="text-lg font-black text-white">v3.5.0 (Nisan 2026)</p>
          </div>
        </div>
        <div className="absolute -right-20 -top-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* Navigation Sidebar */}
        <div className="lg:col-span-3">
          <div className="sticky top-6 space-y-4">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-6 px-2">
                <h3 className="font-bold text-gray-900 uppercase tracking-wider text-sm flex items-center gap-2">
                  <Menu size={18} className="text-blue-600" />
                  Kılavuz Menüsü
                </h3>
                <button 
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                  className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
                >
                  {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              </div>

              <nav className={`space-y-1 ${isMenuOpen ? 'block' : 'hidden lg:block'}`}>
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button 
                      key={item.id} 
                      onClick={() => handleTabChange(item.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all font-semibold text-sm ${
                        activeTab === item.id 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                          : 'text-gray-500 hover:bg-blue-50 hover:text-blue-600'
                      }`}
                    >
                      <Icon size={18} className={activeTab === item.id ? 'text-white' : 'text-gray-400'} />
                      {item.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="bg-slate-900 p-6 rounded-3xl text-white shadow-lg hidden lg:block">
              <div className="flex items-center gap-2 mb-3 text-amber-400">
                <ShieldCheck size={20} />
                <span className="font-bold text-sm">Zırhlı Altyapı</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                Sistemimiz askeri düzey AES-256 GCM şifreleme ve gelişmiş oturum koruması ile donatılmıştır.
              </p>
            </div>
          </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="lg:col-span-9 animate-in fade-in slide-in-from-right-4 duration-500">
          
          {activeTab === 'guvenlik' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-red-500/10 p-4 rounded-2xl">
                  <Lock className="text-red-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Güvenlik ve Erişim</h2>
                  <p className="text-gray-500 font-medium">Kurumsal erişim denetimi ve kimlik doğrulama</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                    <ShieldCheck className="text-blue-600" size={28} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-xl mb-3">İki Kademeli Onay</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    Yeni personel kayıtları sistemde varsayılan olarak &quot;Pasif&quot; başlar. Tam erişim için yönetici onayı şarttır. 
                    Şifreler sistem tarafında tek yönlü hashing (kırılmaz) yöntemiyle saklanır.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                    <History className="text-indigo-600" size={28} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-xl mb-3">Güvenli Oturumlar</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    Oturum bilgileri tarayıcıda düz metin yerine karmaşık obfuscation yöntemleriyle saklanır. 
                    TC Kimlik No gibi hassas alanlar hiçbir zaman localStorage üzerinde şifresiz olarak bulunmaz.
                  </p>
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
                      Gelişmiş Filtreleme
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Ekiplerimiz binlerce kayıt arasından TC No, isim, mahalle veya kurum tipiyle anlık filtreleme yapabilir. 
                      Arama sonuçları, veri gizliliği esasına göre maskelenerek sunulur.
                    </p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
                      <Smartphone className="text-blue-600" size={20} />
                      Toplu Veri Aktarımı
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Sisteme binlerce hane kaydı tek bir Excel dosyası üzerinden saniyeler içinde yüklenebilir. 
                      Yükleme sırasında numara formatları ve TC doğrulamaları otomatik yapılmaktadır.
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
                      Pasif duruma alınan haneler listede gösterilmeye devam eder ancak sistem tarafından otomatik olarak <strong>0 (sıfır)</strong> yemek/ekmek olarak işaretlenir. Bu sayede istatistiksel hata payı sıfıra indirilir.
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
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Merkezi Teslimat</h2>
                  <p className="text-gray-500 font-medium">Bina içi ve toplu kurum dağıtım yönetimi</p>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-200">
                <div className="flex items-start gap-6 mb-8">
                  <div className="w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center shrink-0 text-blue-600">
                    <Info size={32} />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 text-2xl mb-2">Vakıf Elden Teslimat (Pickup)</h4>
                    <p className="text-gray-600 leading-relaxed">
                      Kendi imkanlarıyla vakfa gelerek yemek/ekmek alan haneler, şoför rotalarından bağımsız bir &quot;Pickup&quot; listesi üzerinde toplanır. 
                      Bu listeler günlük ekmek sipariş miktarını doğrudan etkiler ve şeffaf bir takip sunar.
                    </p>
                  </div>
                </div>
                <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100 flex items-center gap-4 text-blue-900 text-sm font-medium">
                  <CheckCircle size={24} className="text-blue-600" />
                  Kurumsal yemek alan birimler de bu modül üzerinden tek tuşla toplu onay alabilir.
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

          {activeTab === 'anket' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-purple-500/10 p-4 rounded-2xl">
                  <Plus className="text-purple-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Anket ve Memnuniyet</h2>
                  <p className="text-gray-500 font-medium">Kalite ölçümü ve sosyal analiz</p>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[3rem] border border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h5 className="font-bold text-gray-900 text-lg">Hizmet Analizi</h5>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Saha ekipleri, haneleri ziyaret ettiğinde tabletler üzerinden anlık memnuniyet anketi uygulayabilir. 
                      Yemek lezzeti, hijyen and şoför davranışı gerçek verilerle ölçülür.
                    </p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                    <h5 className="font-bold text-purple-900 mb-3 text-xs uppercase tracking-widest">Soru Tipleri</h5>
                    <div className="flex flex-wrap gap-2">
                      {['Yıldız Puan', 'Çoktan Seçmeli', 'Video Onay', 'Açık Uçlu'].map(t => (
                        <span key={t} className="bg-white text-purple-700 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-purple-200">{t}</span>
                      ))}
                    </div>
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

        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-10 py-12 bg-white border-t border-gray-100 text-center">
        <div className="flex justify-center gap-3 mb-6">
          <div className="w-10 h-1 bg-red-600 rounded-full"></div>
          <div className="w-10 h-1 bg-blue-600 rounded-full"></div>
          <div className="w-10 h-1 bg-red-600 rounded-full"></div>
        </div>
        <p className="text-gray-900 font-black uppercase tracking-widest text-[10px] mb-2 px-4">
          T.C. EDİRNE MERKEZ SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKIF BAŞKANLIĞI
        </p>
        <p className="text-gray-400 text-[10px] font-medium tracking-tight">
          Aşevi Otomasyon Belgeleme v3.5 | © 2026 Tüm Hakları Saklıdır.
        </p>
      </div>

    </div>
  );
}
