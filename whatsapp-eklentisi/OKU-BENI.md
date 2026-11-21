# OptiNet — Veli Sonuç Mesajı (WhatsApp) · Chrome eklentisi, v1.1.1

Uygulamanın **Yönetim → Veli WhatsApp** sekmesinde hazırlanan, her öğrenciye özel veli mesajlarını
WhatsApp Web'de **sırayla ve aralıklı** gönderir. Mesajın içeriği (sonuç özeti + velinin sisteme nasıl gireceği)
uygulamada şablondan hazırlanır; eklenti yalnızca göndermeyi yapar.

## Kurulum (bir kez)
1. `whatsapp-eklentisi.zip` dosyasını bir klasöre çıkarın (silmeyin, eklenti o klasörden çalışır).
2. Chrome'da `chrome://extensions` → sağ üstten **Geliştirici modu** → **Paketlenmemiş öğe yükle** → çıkardığınız `whatsapp-eklentisi` klasörünü seçin.

## Kullanım
1. `web.whatsapp.com` açın, telefonunuzla QR ile giriş yapın.
2. Uygulamada **Yönetim → Veli WhatsApp**: okul + sınav (+ sınıf) seçin → **Mesajları hazırla** → önizlemeyi kontrol edin → **Eklenti için kuyruğu kopyala**.
3. WhatsApp Web'in sağ altındaki yeşil panelde kutuya yapıştırın → **Yükle** → **Başlat**. Sekmeyi açık bırakın.
4. Eklenti her veliye sohbeti açar, mesajı gönderir, 12–25 sn (en az 8 sn) rastgele bekler, sıradakine geçer.
5. Bitince **Gönderilenleri kopyala** → uygulamada **Gönderilenleri işaretle** kutusuna yapıştırın (aynı veliye tekrar gitmesin).
6. **Sorunluları kopyala**: WhatsApp'ta kayıtlı olmayan ya da gönderildiği doğrulanamayan numaraların listesi (bu velileri telefonla arayın).

## Kuyruk biçimi (uygulama ↔ eklenti sözleşmesi)
`[{ "id": "E1a2b3|10001|101|anne", "n": "905321112233", "t": "mesaj metni", "ad": "Ali Yılmaz (Anne)" }, …]`
`id` = sınav|okul|numara|anne ya da baba · `n` = ülke kodlu numara (yalnız rakam) · `t` = mesaj · `ad` = panelde görünen ad.
Aynı numaranın anne ve baba olarak girilmesi durumunda uygulama tek mesaj hazırlar.

## Sınırlar ve riskler (lütfen okuyun)
- WhatsApp, otomatik/toplu gönderimi kullanım şartlarında yasaklar; hesap kısıtlanabilir veya kapatılabilir. Eklenti riski azaltır, sıfırlamaz. Mümkünse okulun ayrı bir hattını kullanın.
- En az 8 sn bekler; günlük varsayılan sınır 60 mesajdır. Sınıf başına ≤ 25–50 kişi için uygundur; daha fazlası için ertesi gün devam edin.
- 100+ kişilik toplu duyurular için kurumsal çözüm **WhatsApp Business Cloud API**'dir (onaylı şablon mesajlar).
- Veli telefonları ve sınav sonuçları kişisel veridir (KVKK). Velilerin bu amaçla bilgilendirilmesi/izni okulunuzca sağlanmalıdır.
- "Gönderildi" kararı, mesaj kutusunun boşalmasına bakar. "Gönderildiği doğrulanamadı" görürseniz telefonda sohbeti kontrol edin; bu kişi uygulamada işaretlenmez.
- WhatsApp Web arayüzü değişirse düğme bulunamayabilir (zaman aşımı olarak görünür). Test, WhatsApp Web'i taklit eden sahte bir sayfayla yapıldı; **gerçek WhatsApp Web'de ilk denemeyi 2–3 kişiyle yapın.**
