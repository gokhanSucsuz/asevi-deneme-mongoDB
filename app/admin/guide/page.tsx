'use client';

import { 
  FileText, Users, Truck, Map, ShieldAlert, BarChart, 
  Calendar, Smartphone, CheckCircle, Database, Lock, ShieldCheck,
  Search, History, ClipboardList, AlertTriangle, Info, Zap, Download,
  ArrowRight, Menu, X, Plus
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
    { name: 'Hız & Altyapı', id: 'cache', icon: Zap },
    { name: 'Raporlama & Veri', id: 'rapor', icon: ClipboardList },
    { name: 'Anket & Memnuniyet', id: 'anket', icon: Plus },
    { name: 'KVKK & Şifreleme', id: 'sifreleme', icon: ShieldCheck }
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
              Vakıf operasyonlarının dijitalleşme standartlarını ve kullanım detaylarını içeren resmi yardım dokümanıdır.
            </p>
          </div>
          <div className="bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10 hidden md:block">
            <p className="text-xs font-bold text-slate-400 uppercase mb-1">Sistem Sürümü</p>
            <p className="text-lg font-black text-white">v3.1.0 (Nisan 2026)</p>
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
                <span className="font-bold text-sm">Kesintisiz Hizmet</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed italic">
                Sistemimiz 256-bit AES şifreleme ve IndexedDB altyapısıyla hem güvenli hem de saha koşullarına uygun çalışmaktadır.
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
                  <p className="text-gray-500 font-medium">Yetkilendirme ve denetim standartları</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200">
                  <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                    <ShieldCheck className="text-blue-600" size={28} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-xl mb-3">Hiyerarşik Rol Yönetimi</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    Personeller, Şoförler ve Yöneticiler için ayrı ayrı erişim katmanları tanımlanmıştır. 
                    Yeni personeller sisteme kaydolduğunda, bir yönetici onaylayana kadar pasif modda bekletilir. 
                    Bu sayede sisteme sızmaların önüne geçilir.
                  </p>
                </div>
                <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-gray-200">
                  <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                    <History className="text-indigo-600" size={28} />
                  </div>
                  <h4 className="font-bold text-gray-900 text-xl mb-3">Gelişmiş Denetim İzleri</h4>
                  <p className="text-gray-600 leading-relaxed text-sm">
                    Sistem üzerinde gerçekleştirilen her türlü veri değişikliği (Ekleme, Silme, Güncelleme, Rapor Alma) 
                    &quot;İşlem Geçmişi&quot; modülüne kriptolu olarak kaydedilir. Bu kayıtlar yasal mevzuat gereği KVKK uyumludur.
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
                      Akıllı Kayıt Arama
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Ekiplerimiz binlerce kayıt arasından TC No, isim, mahalle veya sokak bilgisiyle anlık filtreleme yapabilir. 
                      Adreslerdeki hatalı veri girişlerini önlemek için mahalle/sokak bazlı asistanlar devrededir.
                    </p>
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-lg text-gray-900">
                      <Smartphone className="text-blue-600" size={20} />
                      Kurum Entegrasyonu
                    </div>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      Yatılı okullar, vakıf yurtları ve sosyal tesisler sisteme &quot;Kurum&quot; olarak tanımlanır. 
                      Bu sayede toplu yemek çıkışları tek bir kayıt üzerinden profesyonelce yönetilir.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <h5 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Info size={18} className="text-blue-600" />
                    Kritik Bilgi: Durum Yönetimi
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm font-semibold">
                    <div className="bg-green-100/50 p-3 rounded-xl border border-green-200 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-green-800">Aktif: Rotalarda her gün görünür</span>
                    </div>
                    <div className="bg-red-100/50 p-3 rounded-xl border border-red-200 flex items-center gap-3">
                      <div className="w-2.5 h-2.5 bg-red-500 rounded-full"></div>
                      <span className="text-red-800">Pasif: Yardımı durdurulan hane</span>
                    </div>
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
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Rota & Dağıtım</h2>
                  <p className="text-gray-500 font-medium">Lojistik planlama ve saha yönetim süreçleri</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  { num: '01', title: 'Rota Şablonları', desc: 'Her şoför için önceden planlanmış, mahalle ve sokak sıralı dağıtım listeleridir.' },
                  { num: '02', title: 'Canlı Atama', desc: 'Her sabah şablonlardan o güne ait taze listeler oluşturulur ve şoför paneline düşer.' },
                  { num: '03', title: 'Saha Geri Bildirim', desc: 'Şoförler teslimat anında fotoğraf veya açıklama ekleyerek durumu anlık günceller.' }
                ].map((item, i) => (
                  <div key={i} className="bg-white p-6 rounded-3xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-4xl font-black text-gray-100 block mb-3">{item.num}</span>
                    <h5 className="font-bold text-gray-900 mb-2">{item.title}</h5>
                    <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-slate-900 p-8 rounded-[2.5rem] text-white relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                  <div className="flex-1 space-y-4 text-center md:text-left">
                    <h3 className="text-2xl font-bold flex items-center gap-3 justify-center md:justify-start">
                      <Zap className="text-amber-400" />
                      Akıllı Tahsis Altyapısı
                    </h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Sistem, rotadaki hane sayılarını ve yemek porsiyonlarını otomatik toplayarak şoförün araca alması gereken &quot;Toplam Yemek&quot; ve &quot;Toplam Ekmek&quot; miktarını tek tıkla hesaplar. Bu sayede aşevinde hazırlık hataları sıfıra indirilmiştir.
                    </p>
                  </div>
                  <div className="bg-white/10 p-6 rounded-2xl border border-white/20 backdrop-blur-md">
                    <div className="text-center font-bold text-3xl text-amber-400">%100</div>
                    <div className="text-xs uppercase tracking-widest text-slate-300 font-bold mt-1">Hata Payı Engelleme</div>
                  </div>
                </div>
                <Database className="absolute -right-20 -bottom-20 text-white/5" size={250} />
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
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Vakıf Elden Teslimat</h2>
                  <p className="text-gray-500 font-medium">Bina içinden yapılan toplu teslimatlar</p>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-8">
                <p className="text-gray-600 leading-relaxed font-medium text-lg">
                  Bazı haneler ve tüm resmi kurumlar, yemeklerini vakıf binasına gelerek kendileri teslim almaktadır. Bu sürecin yönetimi şu adımları izler:
                </p>
                
                <div className="space-y-4">
                  {[
                    "Kategorizasyon: Bu kayıtlar 'Vakıf'tan Yemek Alanlar' olarak işaretlenir.",
                    "Bağımsız Liste: Bu kayıtlar şoför rotalarında görünmez, operasyonu karıştırmaz.",
                    "Toplu Onay: Rotalar sayfasındaki 'Piyanos (Pickup) Listesi' butonuyla tüm liste saniyeler içinde onaylanır.",
                    "Ekmek Faktörü: Elden teslimat onayı verildiği an, o gün merkezden çıkacak ekmek sayısı da otomatik güncellenir."
                  ].map((text, i) => (
                    <div key={i} className="flex gap-4 p-5 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-black shrink-0 text-sm">{i+1}</div>
                      <span className="text-gray-800 font-semibold">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'cache' && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-teal-500/10 p-4 rounded-2xl">
                  <Zap className="text-teal-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Hız ve Altyapı</h2>
                  <p className="text-gray-500 font-medium">IndexedDB ve Çevrimdışı Çalışma Mimarisi</p>
                </div>
              </div>

              <div className="bg-gradient-to-br from-teal-600 to-indigo-800 p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-6">
                  <h3 className="text-2xl font-bold italic">Neden Bu Sistem Beklemez?</h3>
                  <p className="text-teal-50 text-lg leading-relaxed font-light">
                    Sistemimizde her bir hane kaydı, personelin tarayıcısına (IndexedDB) bir kez indirilir ve orada saklanır. 
                    İnternet kopsa dahi arama yapabilir ve teslimat onaylayabilirsiniz. İnternet geldiği anda tüm işlemler 
                    arka planda sunucuya senkronize edilir.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
                    <div className="bg-white/10 p-6 rounded-2xl border border-white/20">
                      <div className="text-4xl font-black text-white">0 ms</div>
                      <p className="text-xs font-bold text-teal-200 mt-2 uppercase tracking-tighter">Gecikme Süresi</p>
                    </div>
                    <div className="bg-white/10 p-6 rounded-2xl border border-white/20">
                      <div className="text-4xl font-black text-white">100%</div>
                      <p className="text-xs font-bold text-teal-200 mt-2 uppercase tracking-tighter">Çevrimdışı Destek</p>
                    </div>
                    <div className="bg-white/10 p-6 rounded-2xl border border-white/20">
                      <div className="text-4xl font-black text-white">Anlık</div>
                      <p className="text-xs font-bold text-teal-200 mt-2 uppercase tracking-tighter">Sync Yeteneği</p>
                    </div>
                  </div>
                </div>
                <Smartphone className="absolute -right-16 -bottom-16 text-white/5" size={300} />
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
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">Raporlama ve Veri Analizi</h2>
                  <p className="text-gray-500 font-medium">Profesyonel çıktı ve istatistik araçları</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2rem] border border-gray-200 space-y-6">
                  <h4 className="text-xl font-bold flex items-center gap-3">
                    <Download className="text-blue-600" />
                    Resmi PDF Çıktıları
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Valilik ve SYDV standartlarına uygun, antetli ve mühür alanlı PDF raporları üretilir. 
                    PDF&apos;lerdeki Türkçe karakter sorunları özel font kütüphanelerimizle tamamen çözülmüştür.
                  </p>
                  <ul className="text-xs space-y-2 text-gray-500 font-medium">
                    <li className="flex items-center gap-2 decoration-blue-500 underline underline-offset-4">Hane döküm listeleri</li>
                    <li className="flex items-center gap-2 decoration-blue-500 underline underline-offset-4">Personel işlem günlükleri</li>
                    <li className="flex items-center gap-2 decoration-blue-500 underline underline-offset-4">Yemek dağıtım sayıları</li>
                  </ul>
                </div>
                <div className="bg-white p-8 rounded-[2rem] border border-gray-200 space-y-6">
                  <h4 className="text-xl font-bold flex items-center gap-3">
                    <BarChart className="text-indigo-600" />
                    Grafiksel Gösterim
                  </h4>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Sayısal veriler sıkıcı olmaktan çıkarılarak pasta, sütun ve çizgi grafiklerine dönüştürülür. 
                    Bu grafikler PDF raporlarına &quot;yüksek çözünürlüklü görsel&quot; olarak otomatik eklenir.
                  </p>
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

              <div className="bg-white p-10 rounded-[3rem] border border-gray-200 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <h5 className="font-bold text-gray-900 text-lg">Hizmet Analizi</h5>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      Saha ekipleri, haneleri ziyaret ettiğinde tabletler üzerinden anlık memnuniyet anketi uygulayabilir. 
                      Yemek lezzeti, hijyen ve şoför davranışı gibi krallar gerçek verilerle ölçülür.
                    </p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-3xl border border-purple-100">
                    <h5 className="font-bold text-purple-900 mb-3">Soru Tipleri</h5>
                    <div className="flex flex-wrap gap-2">
                      {['Yıldız Puan', 'Çoktan Seçmeli', 'Video Onay', 'Açık Uçlu Metin'].map(t => (
                        <span key={t} className="bg-white text-purple-700 text-[10px] font-black uppercase px-3 py-1 rounded-full border border-purple-200">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sifreleme' && (activeTab === 'sifreleme') && (
            <div className="space-y-8">
              <div className="flex items-center gap-4 border-b border-gray-100 pb-6">
                <div className="bg-amber-500/10 p-4 rounded-2xl">
                  <ShieldCheck className="text-amber-600" size={36} />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-gray-900 tracking-tight">KVKK & Şifreleme</h2>
                  <p className="text-gray-500 font-medium">Gelişmiş veri güvenliği protokolü</p>
                </div>
              </div>

              <div className="bg-slate-900 text-white p-10 md:p-14 rounded-[3.5rem] shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-10">
                  <div className="inline-flex items-center gap-3 bg-amber-400 px-6 py-2 rounded-full text-slate-900 font-black uppercase tracking-widest text-xs">
                    Askeri Standart (AES-256)
                  </div>
                  
                  <h3 className="text-3xl md:text-5xl font-black leading-tight tracking-tighter">
                    Kişisel Verileriniz, Bizde <br className="hidden md:block" />
                    <span className="text-amber-400">Okunamaz</span> Şekilde Saklanır.
                  </h3>
                  
                  <p className="text-slate-400 text-lg leading-relaxed max-w-3xl">
                    TC Kimlik Numarası, Telefon Hattı ve Özel Notlar gibi hassas bilgiler; 
                    veritabanına kaydedilirken rastgele karakterli şifreli bloklara dönüştürülür. 
                    Bu verilerin anahtarı fiziksel olarak ayrı yerlerde saklanan sistem değişkenleridir.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                      <h5 className="font-bold text-white mb-2 uppercase text-xs tracking-widest text-amber-500">Tam Erişilemezlik</h5>
                      <p className="text-xs text-slate-400 leading-normal">Bir veri tabanı yöneticisi dahi sizin bilginiz olmadan şifreli kolonlardaki TC dökümlerini göremez.</p>
                    </div>
                    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 hover:bg-white/10 transition-colors">
                      <h5 className="font-bold text-white mb-2 uppercase text-xs tracking-widest text-amber-500">Loglanmış Erişim</h5>
                      <p className="text-xs text-slate-400 leading-normal">Dataların decrypted (çözülmüş) haline sadece yetkili arayüzden ulaşılabilir ve bu her ulaşım loglanır.</p>
                    </div>
                  </div>
                </div>
                <Database className="absolute -right-20 -bottom-20 text-white/5" size={450} />
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-10 py-12 bg-white border-t border-gray-100 text-center">
        <div className="flex justify-center gap-3 mb-6">
          <div className="w-10 h-1 bg-blue-600 rounded-full"></div>
          <div className="w-10 h-1 bg-red-600 rounded-full"></div>
          <div className="w-10 h-1 bg-blue-600 rounded-full"></div>
        </div>
        <p className="text-gray-900 font-black uppercase tracking-widest text-[10px] mb-2">
          T.C. EDİRNE SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI
        </p>
        <p className="text-gray-400 text-[10px] font-medium tracking-tight">
          Aşevi Otomasyon Belgeleme v3.1 | © 2026 Tüm Hakları Saklıdır.
        </p>
      </div>

    </div>
  );
}
