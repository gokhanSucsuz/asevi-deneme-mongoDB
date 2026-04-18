'use client';

import { 
  FileText, Users, Truck, Map, ShieldAlert, BarChart, 
  Calendar, Smartphone, CheckCircle, Database, Lock, ShieldCheck,
  Search, History, ClipboardList, AlertTriangle, Info, Zap, Download,
  ArrowRight, Menu, X, Plus
} from 'lucide-react';
import { useState } from 'react';

export default function GuidePage() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navItems = [
    { name: 'Güvenlik Protokolü', id: 'guvenlik' },
    { name: 'Hane & Kurum Yönetimi', id: 'hane' },
    { name: 'Rota & Dağıtım', id: 'rota' },
    { name: 'Vakıf Teslimatı', id: 'pickup' },
    { name: 'Raporlama & İstatis.', id: 'rapor' },
    { name: 'Güvenlik & Yedekleme', id: 'sifreleme' }
  ];

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
      setIsMenuOpen(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-8 pb-20">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 rounded-3xl p-6 md:p-12 text-white shadow-2xl border border-slate-700 relative overflow-hidden">
        <div className="relative z-10">
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="bg-blue-500/20 p-2 rounded-xl backdrop-blur-md border border-blue-400/30">
              <ShieldAlert className="text-blue-400" size={28} />
            </div>
            <span className="text-blue-300 font-bold tracking-widest uppercase text-xs md:text-sm">T.C. EDİRNE VALİLİĞİ - SYDV</span>
            <div className="hidden md:block w-1 h-1 bg-slate-500 rounded-full"></div>
            <span className="text-slate-400 text-xs font-medium">Güncelleme: Nisan 2026</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black mb-6 leading-tight tracking-tight">
            Aşevi Dağıtım <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">
              Otomasyon Sistemi
            </span>
          </h1>
          <p className="text-slate-300 text-base md:text-xl max-w-3xl leading-relaxed font-light">
            Bu kılavuz, vakıf bünyesindeki yemek dağıtım operasyonlarının dijitalleşme standartlarını, 
            kullanıcı rollerini ve sistem modüllerinin teknik detaylarını içeren resmi kullanım belgesidir.
          </p>
        </div>
        <div className="absolute -right-20 -top-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -left-20 -bottom-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
      </div>

      {/* Mobile Navigation Toggle */}
      <div className="lg:hidden sticky top-4 z-50">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className="w-full bg-white/80 backdrop-blur-md border border-gray-200 p-4 rounded-2xl shadow-lg flex items-center justify-between font-bold text-gray-900"
        >
          <div className="flex items-center gap-2">
            <Menu size={20} />
            Kılavuz Menüsü
          </div>
          {isMenuOpen ? <X size={20} /> : <ArrowRight size={20} />}
        </button>
        
        {isMenuOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 space-y-2 animate-in fade-in slide-in-from-top-4">
            {navItems.map((item) => (
              <button 
                key={item.id} 
                onClick={() => scrollToSection(item.id)}
                className="w-full text-left p-3 hover:bg-blue-50 rounded-xl text-gray-700 font-medium transition-colors flex items-center justify-between"
              >
                {item.name}
                <ArrowRight size={16} className="text-gray-300" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Desktop Sidebar Navigation */}
        <div className="hidden lg:block lg:col-span-1">
          <div className="sticky top-6 space-y-6">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
              <h3 className="font-black text-gray-900 mb-6 flex items-center gap-2 text-lg uppercase tracking-wider">
                <Info size={20} className="text-blue-600" />
                İçindekiler
              </h3>
              <nav className="space-y-1">
                {navItems.map((item) => (
                  <button 
                    key={item.id} 
                    onClick={() => scrollToSection(item.id)}
                    className="group text-sm text-gray-500 hover:text-blue-700 flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-blue-50/50 transition-all w-full text-left"
                  >
                    <div className="w-1.5 h-1.5 bg-gray-300 group-hover:bg-blue-600 rounded-full transition-colors"></div>
                    <span className="font-medium">{item.name}</span>
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-3xl text-white shadow-lg shadow-blue-200/50">
              <h4 className="font-bold mb-3 flex items-center gap-2">
                <AlertTriangle size={20} className="text-blue-200" />
                Yasal Uyarı
              </h4>
              <p className="text-xs text-blue-100 leading-relaxed opacity-90">
                Sitemiz, modern bulut veritabanı altyapısıyla çalışmaktadır. Tüm şifreler hashing yöntemleriyle, kişi tanımlayıcı bilgiler (TC, telefon) kriptografik olarak 256-bit AES ile saklanmaktadır. KVKK uyumlu loglama süreçleri devrededir.
              </p>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-12">
          
          {/* Bölüm 1: Güvenlik */}
          <section id="guvenlik" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-red-500/10 p-3 rounded-2xl">
                <Lock className="text-red-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">1. Güvenlik ve Erişim</h2>
                <p className="text-gray-500 font-medium">Sistem giriş ve yetkilendirme standartları</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-blue-200 transition-colors">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-6">
                  <ShieldCheck className="text-blue-600" size={24} />
                </div>
                <h4 className="font-bold text-gray-900 text-xl mb-3">Rol Yönetimi</h4>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Personel, Şoför ve Sistem Yetkilisi (Admin) arasında kapalı devre kimlik doğrulama yapılmaktadır. Kullanıcıların erişim yetkileri modüller arası izolasyon sağlar. Demolarda dahi veritabanı ayrı bir MongoDB Cluster düzeyinde güvendedir. Kendi kendine kaydolan personeller ancak "Sistem Onayı" aldıktan sonra sisteme giriş yapabilir.
                </p>
              </div>
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 hover:border-blue-200 transition-colors">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center mb-6">
                  <History className="text-indigo-600" size={24} />
                </div>
                <h4 className="font-bold text-gray-900 text-xl mb-3">İşlem Günlükleri (Audit)</h4>
                <p className="text-gray-600 leading-relaxed text-sm">
                  Yapılan her ekleme, silme ve güncelleme işlemi; işlemi yapan personel, tarih, saat ve IP bilgisi ile 
                  &quot;Sistem Günlükleri&quot; bölümünde kalıcı olarak saklanır.
                </p>
              </div>
            </div>
          </section>

          {/* Bölüm 2: Hane ve Kurum */}
          <section id="hane" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500/10 p-3 rounded-2xl">
                <Users className="text-blue-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">2. Hane ve Kurum Yönetimi</h2>
                <p className="text-gray-500 font-medium">Veri girişi ve kategori yönetimi</p>
              </div>
            </div>

            <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-8 space-y-8">
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="bg-slate-50 p-6 rounded-2xl flex-1 border border-slate-100">
                    <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Search size={18} className="text-blue-600" />
                      Akıllı Arama ve Filtreleme
                    </h4>
                    <p className="text-sm text-gray-600">
                      Binlerce kayıt arasından TC No, İsim veya Adres ile anlık arama yapılabilir. 
                      Kayıtlar mahalle ve sokak bazlı alfabetik olarak sıralanabilir.
                    </p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-2xl flex-1 border border-slate-100">
                    <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                      <Smartphone size={18} className="text-blue-600" />
                      Kurum Kayıtları
                    </h4>
                    <p className="text-sm text-gray-600">
                      Okul, yurt veya vakıf gibi toplu yemek alan yerler &quot;Kurum&quot; olarak kaydedilir. 
                      Bu kayıtlarda bireysel üye listesi yerine toplam kontenjan bilgisi tutulur.
                    </p>
                  </div>
                </div>
                
                <div className="border-t border-gray-100 pt-8">
                  <h4 className="font-bold text-gray-900 mb-4">Kayıt Durumları</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl border border-green-100">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-bold text-green-800">Aktif - Rotalara Dahil</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl border border-red-100">
                      <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                      <span className="text-sm font-bold text-red-800">Pasif / Durduruldu</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bölüm 3: Rota ve Pickup */}
          <section id="rota" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-orange-500/10 p-3 rounded-2xl">
                <Map className="text-orange-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">3. Rota ve Dağıtım</h2>
                <p className="text-gray-500 font-medium">Lojistik planlama ve saha operasyonu</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="text-4xl font-black text-orange-100">01</div>
                  <h5 className="font-bold text-gray-900">Rota Şablonları</h5>
                  <p className="text-sm text-gray-500">Şoförlerin her gün izlediği ana güzergahlar şablon olarak kaydedilir.</p>
                </div>
                <div className="space-y-3">
                  <div className="text-4xl font-black text-orange-100">02</div>
                  <h5 className="font-bold text-gray-900">Günlük Atama</h5>
                  <p className="text-sm text-gray-500">Şablonlar her sabah otomatik olarak o güne kopyalanır ve canlı takip başlar.</p>
                </div>
                <div className="space-y-3">
                  <div className="text-4xl font-black text-orange-100">03</div>
                  <h5 className="font-bold text-gray-900">Saha Onayı</h5>
                  <p className="text-sm text-gray-500">Şoförler teslimat anında mobil cihazlarından durumu günceller.</p>
                </div>
              </div>

              <div id="pickup" className="bg-blue-900 text-white p-8 rounded-3xl relative overflow-hidden scroll-mt-24">
                <div className="relative z-10">
                  <h4 className="text-2xl font-bold mb-4 flex items-center gap-3">
                    <Truck size={28} className="text-blue-400" />
                    Vakıf Pickup (Elden Teslim) Sistemi
                  </h4>
                  <p className="text-blue-100 leading-relaxed mb-6">
                    Kendi imkanlarıyla vakıf binasından yemek alan kurum ve haneler için özel bir takip modülü geliştirilmiştir. 
                    Bu kayıtlar şoför rotalarına dahil edilmez, ancak &quot;Vakıf&apos;tan Yemek Alanlar&quot; listesinde toplu olarak yönetilir.
                  </p>
                  <div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl border border-white/20">
                    <h5 className="font-bold mb-3 text-blue-300 uppercase text-xs tracking-widest">Yönetici Onay Süreci</h5>
                    <ul className="space-y-3 text-sm">
                      <li className="flex items-center gap-3">
                        <CheckCircle size={18} className="text-blue-400 shrink-0" />
                        Rotalar sayfasındaki &quot;Vakıf&apos;tan Yemek Alanları Listele&quot; butonu ile tüm liste görüntülenir.
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle size={18} className="text-blue-400 shrink-0" />
                        Yönetici &quot;Onayla&quot; butonuna bastığında tüm listedeki teslimatlar yapıldı olarak işaretlenir.
                      </li>
                      <li className="flex items-center gap-3">
                        <CheckCircle size={18} className="text-blue-400 shrink-0" />
                        Bu işlem ekmek takip sistemine otomatik olarak veri gönderir.
                      </li>
                    </ul>
                  </div>
                </div>
                <Database className="absolute -right-10 -bottom-10 text-white/5" size={200} />
              </div>
            </div>
          </section>

          {/* Bölüm: Performans ve Önbellek */}
          <section id="cache" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-teal-500/10 p-3 rounded-2xl">
                <Zap className="text-teal-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">3. Performans ve Önbellekleme</h2>
                <p className="text-gray-500 font-medium">Yüksek hız ve çevrimdışı destek mimarisi</p>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 space-y-6">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1 space-y-4">
                  <h4 className="text-xl font-bold text-slate-900">Tarayıcı İçi Veritabanı ve Senkronizasyon</h4>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    Sistemimiz, ağ bağlantısı olmadığında dahi çalışabilen IndexedDB teknolojisi üzerine kuruludur.
                    Kullanıcı sahada (internet olmayan bölgelerde) teslimat onayı yaptığında, veriler öncelikle tarayıcıya (IndexedDB) yazılır, ardından internet geldiğinde merkezi veritabanı (MongoDB) ile anlık senkronize edilir. Bu sayede saha operasyonu asla sekteye uğramaz.
                  </p>
                  <div className="flex gap-4">
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 block uppercase">Hız Artışı</span>
                      <span className="text-lg font-black text-teal-600">10x</span>
                    </div>
                    <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
                      <span className="text-xs font-bold text-slate-400 block uppercase">İnternetsiz</span>
                      <span className="text-lg font-black text-blue-600">Saha Onayı</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Bölüm: Raporlama */}
          <section id="rapor" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-500/10 p-3 rounded-2xl">
                <ClipboardList className="text-indigo-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">4. Raporlama ve İstatistikler</h2>
                <p className="text-gray-500 font-medium">Resmi evrak ve detaylı analiz araçları</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Download size={18} className="text-blue-600" />
                    Detaylı PDF Çıktıları
                  </h5>
                  <p className="text-sm text-gray-600">
                    Sistem "jspdf-autotable" altyapısıyla Türkçe karakter sorunsuz, tabloların ve istatistik grafiklerinin yansıtıldığı (html2canvas) resmi makamlar uyumlu PDF'ler üretir.
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <BarChart size={18} className="text-indigo-600" />
                    Grafiksel Takip
                  </h5>
                  <p className="text-sm text-gray-600">
                    Şoför ve genel istatistik sayfalarında başarılı teslimat, ulaşılan kişi sayısı, yapılan KM gibi detaylar zaman aralığı (Günlük, Haftalık, Aylık vs.) seçilerek grafiklere dökülür ve PDF raporuna eklenir.
                  </p>
                </div>
              </div>
              
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <h5 className="font-bold text-indigo-900 mb-3">Resmi Rapor Standartları</h5>
                <ul className="text-sm text-indigo-800 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-indigo-600" />
                    T.C. Edirne Valiliği Logosu ve Resmi Başlık
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-indigo-600" />
                    Raporlayan Personel Bilgisi ve Doğrulama Tarih / Saati
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-indigo-600" />
                    İstatistik Grafiklerinin otomatik entegrasyonu
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bölüm 7: Anket ve Memnuniyet */}
          <section id="anket" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-500/10 p-3 rounded-2xl">
                <ClipboardList className="text-indigo-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">7. Anket ve Memnuniyet Yönetimi</h2>
                <p className="text-gray-500 font-medium">Hizmet kalitesi ölçüm ve analiz araçları</p>
              </div>
            </div>

            <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-200 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Plus size={18} className="text-indigo-600" />
                    Dinamik Anket Oluşturma
                  </h5>
                  <p className="text-sm text-gray-600">
                    Derecelendirme (Yıldız), Metin, Çoktan Seçmeli ve Tekli Seçim soru tipleriyle ihtiyaca özel anketler tasarlanabilir.
                  </p>
                </div>
                <div className="p-6 bg-gray-50 rounded-2xl border border-gray-100">
                  <h5 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <BarChart size={18} className="text-indigo-600" />
                    Gerçek Zamanlı Analiz
                  </h5>
                  <p className="text-sm text-gray-600">
                    Toplanan cevaplar anlık olarak grafiklere (Sütun ve Pasta grafik) dönüştürülür ve memnuniyet ortalamaları hesaplanır.
                  </p>
                </div>
              </div>
              
              <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                <h5 className="font-bold text-indigo-900 mb-3">Hane Bazlı Uygulama</h5>
                <p className="text-sm text-indigo-800 mb-4">
                  Anketler, &quot;Haneler&quot; sayfasındaki her kaydın yanında bulunan anket butonu aracılığıyla doğrudan hanelere uygulanabilir.
                </p>
                <ul className="text-sm text-indigo-800 space-y-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-indigo-600" />
                    Hane bazlı cevap geçmişi takibi
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-indigo-600" />
                    Personel bazlı anket giriş kaydı
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-indigo-600" />
                    Aktif/Pasif anket yönetimi
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Bölüm 8: Şifreleme */}
          <section id="sifreleme" className="space-y-6 scroll-mt-24">
            <div className="flex items-center gap-4">
              <div className="bg-amber-500/10 p-3 rounded-2xl">
                <ShieldCheck className="text-amber-600" size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">8. Veri Şifreleme ve KVKK</h2>
                <p className="text-gray-500 font-medium">Askeri seviye veri güvenliği</p>
              </div>
            </div>

            <div className="bg-slate-900 text-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
              <div className="relative z-10 space-y-8">
                <div className="flex items-center gap-4">
                  <div className="bg-amber-400 p-3 rounded-2xl">
                    <Lock className="text-slate-900" size={24} />
                  </div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter">AES-256 Encryption</h3>
                </div>
                
                <p className="text-slate-300 text-lg leading-relaxed font-light">
                  Sistemdeki tüm <strong>TC Kimlik Numaraları</strong>, <strong>Hane Numaraları</strong> ve <strong>Personel Şifreleri</strong>, 
                  veritabanına yazılmadan önce AES-256 standardı ile şifrelenir.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h5 className="font-bold text-amber-400 mb-2">Okunamaz Veri</h5>
                    <p className="text-xs text-slate-400">Veritabanına sızılsa dahi veriler anlamsız karakter dizileri olarak görünür.</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h5 className="font-bold text-amber-400 mb-2">İzole Anahtar</h5>
                    <p className="text-xs text-slate-400">Şifreleme anahtarı kodun içinde değil, güvenli sunucu değişkenlerinde saklanır.</p>
                  </div>
                  <div className="bg-white/5 p-6 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <h5 className="font-bold text-amber-400 mb-2">KVKK Uyumu</h5>
                    <p className="text-xs text-slate-400">Kişisel verilerin korunması kanununa tam uyumlu veri saklama mimarisi.</p>
                  </div>
                </div>
              </div>
              <ShieldAlert className="absolute -right-20 -bottom-20 text-white/5" size={400} />
            </div>
          </section>

        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-20 pt-12 border-t border-gray-200 text-center space-y-4">
        <div className="flex justify-center gap-4 mb-4">
          <div className="w-12 h-1 bg-blue-600 rounded-full"></div>
          <div className="w-12 h-1 bg-red-600 rounded-full"></div>
          <div className="w-12 h-1 bg-blue-600 rounded-full"></div>
        </div>
        <p className="text-gray-900 font-black uppercase tracking-widest text-xs">
          T.C. EDİRNE SOSYAL YARDIMLAŞMA VE DAYANIŞMA VAKFI
        </p>
        <p className="text-gray-400 text-xs font-medium">
          Aşevi Dağıtım Otomasyon Sistemi v2.6.0 | © 2026 Tüm Hakları Saklıdır.
        </p>
      </div>
    </div>
  );
}
