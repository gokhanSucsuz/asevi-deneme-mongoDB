# Edirne SYDV Aşevi Yönetim Sistemi - Teknik Kılavuz & Kurulum

Bu doküman, T.C. Edirne Merkez Sosyal Yardımlaşma ve Dayanışma Vakfı Başkanlığı için geliştirilen Aşevi Modülü'nün (v3.5) teknik mimarisini, güvenlik protokollerini ve lojistik işleyişini içermektedir.

## 🚀 Proje Hakkında
Sistem; Edirne genelindeki ihtiyaç sahibi hanelere ve resmi kurumlara günlük sıcak yemek dağıtım sürecini dijitalize etmek, rotaları akıllı algoritmalarla optimize etmek ve tam denetlenebilir bir raporlama ekosistemi oluşturmak amacıyla geliştirilmiştir.

## 🛠 Teknik Altyapı (Full-Stack)
- **Framework:** Next.js 15+ (App Router) & React 19
- **Veritabanı:** Firestore (Cloud) & Dexie.js (Client-side IndexedDB Cache)
- **Güvenlik Çekirdeği:** AES-256 GCM Veri Şifreleme, HMAC-SHA256 Integrity
- **Stil Yönetimi:** Tailwind CSS (Modern Utility-First)
- **İkon Seti:** Lucide React (Professional SVG)
- **Raporlama:** jsPDF (Custom UTF-8 Fonts), XLSX, Recharts (Data Viz)

## 🔒 Güvenlik Standartları

### 1. Askeri Düzey AES-256 Şifreleme (KVKK)
Kişisel Verilerin Korunması Kanunu çerçevesinde; TC Kimlik No, İsim ve Telefon numaraları gibi hassas veriler veritabanına asla düz metin olarak kaydedilmez. Tüm hassas kolonlar **AES-256 GCM** ile şifrelenir.

### 2. Akıllı Oturum Denetimi & Obfuscation
Oturum verileri (Personel bilgileri, Yetki seviyeleri) tarayıcı hafızasında düz metin yerine çok katmanlı karartma (obfuscation) yöntemleriyle saklanır. TC Kimlik No gibi alanlar bellek üzerinde şifresiz tutulmaz.

### 3. Global Sistem Kilidi
Acil durumlarda veya operasyonel molalarda, yöneticiler tüm saha teslimatlarını tek merkezden pasifize edebilir. Bu kilit aktif olduğunda şoför cihazları anlık olarak kilitlenir.

## 📦 Lojistik ve Dağıtım Modülleri
- **Akıllı Rota Planlama:** Mahalle bazlı hane dökümleri ve statik/dinamik rota şablonları.
- **Vakıf Elden Teslimat (Piyanos):** Bina içinden yapılan teslimatların bağımsız ve hızlı yönetimi.
- **Dijital Dağıtım Çetelesi:** Şoförlerin mobil cihazlarından anlık teslimat onayı ve ekmek sayımı.

## 📊 Raporlama ve Personel Takibi
- **Denetlenebilir Kayıtlar:** Her rapor ve işlem, işlemi yapan personelin kimlik bilgileriyle (Ad Soyad) mühürlenir.
- **Resmi PDF Çıktıları:** Valilik standartlarında, antetli ve yüksek çözünürlüklü grafiklerle desteklenen raporlar.

## 📂 Geliştirici Yol Haritası
- `/app/admin`: İdari yönetim ve denetim modülleri.
- `/app/driver`: Saha ekipleri için optimize edilmiş mobil arayüz.
- `/lib/crypto.ts`: End-to-end şifreleme motoru.
- `/lib/db.ts`: Çevrimdışı öncelikli veritabanı senkronizasyonu.

Tasarım ve Geliştirme => Gökhan SUÇSUZ
---
Edirne Sosyal Yardımlaşma ve Dayanışma Vakfı Başkanlığı
*Vakıf Standartlarında Güvenli ve Hızlı Dijital Dönüşüm.*
