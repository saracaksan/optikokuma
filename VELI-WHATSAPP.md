# Veli telefonları, WhatsApp sonuç mesajı ve veli girişi

## Ne yapar?
Her öğrenci için **anne** ve **baba** telefonu kaydedilir. Sınav sonuçlandıktan sonra **Yönetim → Veli WhatsApp** sekmesinden her öğrencinin sonucu, anne ve/veya babasına **kişiye özel** bir WhatsApp mesajı olarak hazırlanır:

- çocuğun kısa sonuç özeti (puan, net, doğru/yanlış/boş, ders ders netler, sınıf ve okul sırası),
- velinin sisteme nasıl gireceği: **okul, sınıf, okul numarası, veli kodu** ve tek dokunuşla açılan giriş bağlantısı.

Veli bağlantıyı açınca sınıf ve numara hazır gelir, yalnızca **veli kodunu** yazar; bu sınavı ve **geçmiş bütün sınavlarının** analizini görür (uygulamadaki mevcut veli ekranı, "Öğrenci / veli sorgulaması"). Veli kodu bağlantıda değil, mesajın metnindedir.

## Telefon girişi
- **Yönetim → Öğrenciler**: öğrenciyi ekleyin/düzenleyin → *Anne telefonu*, *Baba telefonu*. Tabloda "Veli tel." sütununda Anne/Baba işaretleri görünür.
- **Toplu**: Excel'den yapıştırın; sütun başlıkları `no, ad, soyad, sınıf, anne telefonu, baba telefonu` (başlıksız ise bu sırada). Aynı numaralı öğrenci güncellenir, telefon boşsa mevcut numara korunur.
- Biçim: `0532 111 22 33`, `532-111-22-33`, `+90 532 111 22 33` hepsi kabul edilir ve `905321112233` biçiminde saklanır. Yurt dışı numara için `+ülke kodu` yazın. Yalnızca **cep telefonu** kabul edilir (WhatsApp sabit hatta ulaşmaz). Geçersiz numara toplu yüklemede satırı bozmaz, uyarı verir.
- Telefonlar **yalnızca okul yöneticisi ve üst yetkililere** gösterilir; öğretmen hesabı göremez ve çevrim dışı önbelleğe yazılmaz.

## Mesaj hazırlama
1. **Yönetim → Veli WhatsApp** → okul, sınav, (isteğe bağlı) sınıf ve alıcı (anne ve baba / yalnız anne / yalnız baba) → **Mesajları hazırla**.
2. Sunucu telefonu olan ve bu sınavda sonucu olan öğrencileri listeler; telefonu olmayanlar ve sonucu olmayanlar "Atlananlar"da nedeniyle yazar. Anne ve baba aynı numarayı yazdıysa tek mesaj gider.
3. **Veli kodu olmayan öğrencilere kod üretilir** (kutu işaretliyse) ve mesaja yazılır. Kodu olan öğrencinin sonucuna artık yalnızca kodu bilen veli ulaşır (kodsuz öğrenciler sınıf + numara ile sorgulanabildiği için bu daha güvenlidir).
4. **Mesaj şablonu** düzenlenebilir: yer tutucuya tıklayınca eklenir (`{adsoyad}`, `{net}`, `{siraSinif}`, `{dersler}`, `{link}`, `{kod}` …). Değeri boş olan yer tutucunun satırı mesajdan çıkar (ör. veli kodu yoksa "Veli kodu:" satırı yazılmaz). Şablon bu cihazda saklanır, canlı önizleme vardır.
5. Sınav "öğrenci/veli sorgulamasına açık" değilse uyarı çıkar: veli giriş yapsa da sonucu göremez; sınavı düzenleyip bu seçeneği açın.

## Gönderme yolları
- **Elle**: satırdaki **WhatsApp'ta aç** (`wa.me` bağlantısı; mesaj hazır gelir, siz gönderirsiniz) → **Gönderdim**.
- **Chrome eklentisi** (`whatsapp-eklentisi.zip`, kurulum için eklentinin `OKU-BENI.md` dosyasına bakın): **Eklenti için kuyruğu kopyala** → WhatsApp Web'deki panele yapıştır → Yükle → Başlat. Eklenti her mesaj arasında 12–25 sn (en az 8 sn) bekler, günde en çok 60 mesaj gönderir, WhatsApp'ta kayıtlı olmayan numarayı atlar.
- Eklentide **Gönderilenleri kopyala** → uygulamada **Gönderilenleri işaretle** kutusuna yapıştırın. İşaretlenenler *Gonderim* sayfasına yazılır ve bir sonraki hazırlıkta tekrar gelmez (yeniden göndermek için "Daha önce gönderilenlere de yeniden hazırla"yı işaretleyin).

Kuyruk biçimi (uygulama ↔ eklenti sözleşmesi): `[{ id, n, t, ad }]` — `id` = `sınav|okul|numara|anne|baba`, `n` = ülke kodlu numara, `t` = metin, `ad` = panelde görünen ad.

## Dikkat
- **WhatsApp kullanım şartları** otomatik/toplu gönderimi yasaklar; hesap kısıtlanabilir veya kapatılabilir. Eklenti hızı sınırlayarak riski azaltır, sıfırlamaz. İlk denemeyi 2–3 kişiyle yapın; mümkünse okulun ayrı bir hattını kullanın. Kalıcı ve yüksek hacimli kullanım için resmî **WhatsApp Business Cloud API** gerekir.
- **KVKK**: veli telefonları ve sınav sonuçları kişisel veridir. Velilerin bu amaçla bilgilendirilmesi/izni okulunuzca sağlanmalıdır. Telefonlar E-Tablonuzda (Öğrenciler sayfası) durur; tabloya erişimi sınırlı tutun.
- Eklenti, WhatsApp Web'i taklit eden sahte bir sayfayla uçtan uca denendi; **gerçek WhatsApp Web arayüzü değişirse** düğmeler bulunamayabilir (zaman aşımı görünür). İlk gerçek kullanımda sonucu telefonda kontrol edin.
- Mesaj uzunluğunu ~1000 karakterin altında tutun (önizlemede sayı yazar).

## Güncelleme
Depodaki dosyaları yükleyin (`veli-wa.js` yeni, `whatsapp-eklentisi.zip` ve `whatsapp-eklentisi/` yeni), `Code.gs`'i Apps Script'e yapıştırıp **yeni sürüm dağıtın**. E-Tabloya *anneTel*, *babaTel* sütunları ve *Gonderim* sayfası ilk istekte kendiliğinden eklenir. Tarayıcıda bir kez yenileyin (servis çalışanı sürümü `optik-v11`).
