# PLAN: Sistem Analizi ve Kılavuz Güncellemesi

Sisteme eklenen son özelliklerin (İzin Yönetimi, Vekil Sistemi, Pasif Kayıtlar, Rota Optimizasyonları) detaylı analiz edilerek kılavuz sayfasına (`app/admin/guide/page.tsx`) kurumsal bir dille işlenmesi.

## 📋 Proje Tipi: WEB
**Agent:** `frontend-specialist`
**Skill:** `frontend-design`

## 🎯 Başarı Kriterleri
- [ ] Yeni özelliklerin (İzin, Vekil, Pasif Kayıt) ilgili bölümlere entegre edilmesi.
- [ ] "Sürüm Notları" (Release Notes) bölümünün eklenmesi.
- [ ] Görsel göstergeler (Rozetler, renk kodları) için özel bir bölüm oluşturulması.
- [ ] Kılavuzun Admin ve Personel rollerine göre özelleştirilmesi.
- [ ] v4.0.0 sürüm etiketi ve güncel tarihlerin işlenmesi.

## 🛠️ Teknoloji Yığını
- **Next.js (React)**
- **Tailwind CSS**
- **Lucide Icons**

## 📂 Dosya Yapısı
- `app/admin/guide/page.tsx` (Ana güncelleme dosyası)

## 📝 Görev Dağılımı

### Faz 1: İçerik Hazırlığı ve Analiz (ANALYSIS)
- **Görev 1.1:** Son oturumlardaki değişikliklerin (Driver interface, Surveys mapping, Household badges) teknik özetinin çıkarılması.
- **Görev 1.2:** Admin ve Personel rolleri için yetki matrisinin kılavuza uygun hale getirilmesi.

### Faz 2: Kılavuz Sayfası Güncelleme (IMPLEMENTATION)
- **Görev 2.1:** `navItems` listesine "Sürüm Notları" ve "Görsel Göstergeler" sekmelerinin eklenmesi.
- **Görev 2.2:** "Şoför Yönetimi" bölümüne İzin ve Vekil Sistemi detaylarının eklenmesi.
- **Görev 2.3:** "Hane Yönetimi" bölümüne şoför rozetleri ve pasif kayıt kurallarının (TC zorunluluğu vb.) eklenmesi.
- **Görev 2.4:** "Sürüm Notları" sekmesinin v4.0.0 içeriğiyle oluşturulması.
- **Görev 2.5:** "Görsel Göstergeler" sekmesinin (turuncu vurgu, mavi rozetler vb.) tasarlanması.
- **Görev 2.6:** Rol bazlı (Admin/Personel) kullanım talimatlarının eklenmesi.

### Faz 3: Doğrulama ve Final (VERIFICATION)
- **Görev 3.1:** `npm run lint` ile kod kalitesinin kontrolü.
- **Görev 3.2:** `npm run build` ile derleme kontrolü.
- **Görev 3.3:** Kılavuzun responsive (mobil uyum) kontrolü.

## ✅ PHASE X: Final Doğrulama
- [ ] v4.0.0 sürüm notları mevcut mu?
- [ ] İzin yönetimi "Şoförler" altında açıklandı mı?
- [ ] Rol bazlı ayrım (Admin/Personel) net mi?
- [ ] Görsel göstergeler (Rozetler, Renkler) dökümante edildi mi?
