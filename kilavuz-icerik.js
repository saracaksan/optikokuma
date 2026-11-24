/* kilavuz-icerik.js — KULLANIM KILAVUZU İÇERİĞİ, 1. bölüm (motor: kilavuz.js).
 * 2. bölüm (okutma, dış sınav, sonuçlar, analiz, iletişim, yönetim, yardım): kilavuz-icerik-2.js (Guide.add).
 *
 * BİÇİM
 *   Guide.define({ intro, cats:[{id,title,desc}], quick:[{t,d,go,aud}], roadmap:{veli|ogretmen|okul|yetkili|admin:[konuId…]}, topics:[…] })
 *   konu = { id, cat, title, aud, kw, sum, go, see, body }
 *     aud : herkes | veli | ogretmen | okul | yetkili | admin   (konu bu role ve üstüne gösterilir; "veli" yalnız veli/öğrenci içindir)
 *     kw  : arama için anahtar sözcükler (başlıkta geçmeyen eş anlamlılar)
 *     go  : { view, tab?, newExam?, label?, roles? } ya da { href:'#/kayit', label } (girişsiz sayfa) ya da dizisi — "ekranı aç" düğmesi
 *     see : ilgili konu kimlikleri
 *     body: ["p", metin] ["h", alt başlık] ["ul", [maddeler]] ["steps", [[başlık, ayrıntı], …]]
 *           ["tip"|"warn"|"info", metin] ["table", [başlıklar], [[satır], …]] ["flow", [[başlık, açıklama], …]]
 *   Satır içi işaretler:  **kalın**   [[Ekrandaki düğme/alan adı]]   `kod`   {{Menü → yol}}   ((konu-id|bağlantı metni))
 *   Kural: [[ ]] içindeki her ad kodda gerçekten bulunmalıdır (testler/test_guide_labels.js denetler). */
'use strict';

Guide.define({
  intro: "OptiNet; optik formları telefonla ya da tarayıcıdan okutup puanlayan, sonuçları **okul, ilçe ve il** düzeyinde karşılaştıran ve velilerin çocuklarının sonucuna ulaşmasını sağlayan bir sınav uygulamasıdır. Bu kılavuz uygulamanın bütün bölümlerini **rol rol** anlatır: veli/öğrenci, öğretmen, okul yöneticisi (idareci), ilçe/il yetkilisi ve sistem yöneticisi. Üstteki **Kimin için** düğmeleriyle kendi rolünüzü seçin, ya da arama kutusuna yapmak istediğinizi yazın.",

  cats: [
    { id: 'basla', title: '1. Başlarken', desc: 'Uygulama ne yapar, kimler kullanır, nasıl girilir ve yüklenir.' },
    { id: 'uyelik', title: '2. Üyelik ve başvurular', desc: 'Okul yöneticisi ve öğretmen nasıl üye olur, başvurular kim tarafından onaylanır.' },
    { id: 'veli', title: '3. Veli / öğrenci arayüzü', desc: 'Giriş yapmadan sonuç sorgulama; velinin sonucu nasıl okuyacağı.' },
    { id: 'hazirlik', title: '4. Okul hazırlığı', desc: 'Okul, öğrenci ve kullanıcı listeleri: kendi öğrencilerinizi yükleme.' },
    { id: 'formlar', title: '5. Optik formlar', desc: 'Hazır form, kendi formunu tasarlama, dışarıdan hazır formu tanıtma.' },
    { id: 'sinav', title: '6. Sınav tanımlama', desc: 'Sınav oluşturma, cevap anahtarı, puanlama, kapsam.' },
    { id: 'okutma', title: '7. Optik okutma', desc: 'Dosya, PDF, kamera; inceleme, kuyruk, hatalı okutmayı düzeltme.' },
    { id: 'dis', title: '8. Dış sınav (Excel / satır satır)', desc: 'Başka kaynaktan gelen sonuçları analize katmak.' },
    { id: 'sonuc', title: '9. Sonuçlar', desc: 'Öğrenci, okul, ilçe/il, madde analizi ve karne.' },
    { id: 'analiz', title: '10. Sınav analizi', desc: 'Hangi analiz nerede, nasıl yapılır, nasıl çıktı alınır.' },
    { id: 'iletisim', title: '11. Velilere ulaşma', desc: 'Veli kodu ve kişiye özel WhatsApp mesajı.' },
    { id: 'yonetim', title: '12. Yönetim ve ayarlar', desc: 'Yapay zekâ, hesap ve bağlantı ayarları.' },
    { id: 'yardim', title: '13. Yardım', desc: 'Sık sorulan sorular, sözlük, sorun giderme.' }
  ],

  quick: [
    { t: 'Çocuğumun sonucunu görmek istiyorum', d: 'Giriş yapmadan: okul → sınıf → okul numarası', go: 'veli-sorgu', aud: 'veli' },
    { t: 'Okulumu sisteme kaydetmek istiyorum', d: 'Okul yöneticisi olarak üye olma', go: 'uye-okul', aud: 'okul' },
    { t: 'Öğretmen olarak üye olmak istiyorum', d: 'Okulunuzu seçip başvurun', go: 'uye-ogretmen', aud: 'ogretmen' },
    { t: 'Öğrencilerimizi yüklemek istiyorum', d: 'Excel’den yapıştırarak ya da tek tek', go: 'yon-ogrenciler', aud: 'okul' },
    { t: 'Hazır bir optik formu nasıl kullanırım?', d: 'Katalogdan seç, yazdır, sınava bağla', go: 'form-katalog', aud: 'ogretmen' },
    { t: 'Elimdeki (dışarıdan) optik formu okutmak istiyorum', d: 'Boş formu tanıtın, sonra toplu okutun', go: 'form-harici-otomatik', aud: 'ogretmen' },
    { t: 'Sınav tanımlamak istiyorum', d: 'Adım adım: ad, ders, anahtar, puan', go: 'sinav-yeni', aud: 'ogretmen' },
    { t: 'Optik formları okutmak istiyorum', d: 'Dosya, PDF ya da canlı kamera', go: 'okut-adimlar', aud: 'ogretmen' },
    { t: 'Yanlış okunan öğrenciyi düzeltmek / çıkarmak', d: 'Yeniden okutma, kuyruktan silme', go: 'okut-cikar', aud: 'ogretmen' },
    { t: 'Hangi analiz nereden çıkıyor?', d: 'Analiz sekmelerinin haritası', go: 'an-hangi', aud: 'ogretmen' },
    { t: 'Velilere WhatsApp ile sonuç göndermek', d: 'Veli telefonu, mesaj şablonu, gönderim', go: 'wa-mesaj', aud: 'okul' }
  ],

  roadmap: {
    veli: ['veli-sorgu', 'veli-sonuc', 'veli-kod', 'veli-sss'],
    ogretmen: ['genel', 'giris', 'uye-ogretmen', 'form-secenek', 'sinav-yeni', 'okut-adimlar', 'kuyruk', 'sonuc-ogr', 'an-baslangic'],
    okul: ['uye-okul', 'yon-basvurular', 'yon-ogrenciler', 'yon-kullanicilar', 'form-secenek', 'sinav-yeni', 'okut-adimlar', 'veli-kod-uret', 'wa-mesaj', 'an-baslangic'],
    yetkili: ['yon-basvurular', 'yon-okullar', 'sinav-yeni', 'sonuc-okul', 'sonuc-ilce', 'an-okul'],
    admin: ['yon-okullar', 'yon-kullanicilar', 'yon-ai', 'ayarlar', 'sinav-yeni', 'an-baslangic']
  },

  topics: [
    /* ================================================================ 1. BAŞLARKEN */
    {
      id: 'genel', cat: 'basla', title: 'OptiNet nedir, nasıl çalışır?', aud: 'herkes', kw: 'genel bakış özet akış ne işe yarar optik okuma deneme',
      sum: 'Uygulamanın bütün akışı tek bakışta.',
      go: { view: 'scan', label: 'Okut ekranını aç' },
      see: ['roller', 'form-secenek', 'sinav-yeni', 'okut-adimlar', 'an-baslangic'],
      body: [
        ['p', 'OptiNet’te bir deneme sınavı **altı adımda** yürür. Bazı adımları siz, bazılarını okulunuzdaki yönetici yapar:'],
        ['flow', [
          ['Okul ve öğrenci listesi', 'Okul yöneticisi öğrencilerini yükler (Yönetim → Öğrenciler).'],
          ['Optik form', 'Hazır form seçilir ya da kendi formunuz tanıtılır (Formlar).'],
          ['Sınav tanımı', 'Ad, dersler, cevap anahtarı, puanlama (Sınavlar → Yeni sınav).'],
          ['Okutma', 'Dolu formlar dosya/PDF ile ya da kamerayla okutulur (Okut).'],
          ['Gönderim', 'Okutmalar kuyruğa girer, sunucuya gönderilir (Kuyruk).'],
          ['Sonuç ve analiz', 'Sıralama, karne, analiz; veli sorgulaması ve WhatsApp (Sonuçlar, Analiz).']
        ]],
        ['h', 'Dört ana fikir'],
        ['ul', [
          '**İnternet olmasa da çalışır.** Okutulan kâğıtlar cihazda saklanır, bağlantı gelince gönderilir.',
          '**Her şey cihazda okunur.** Fotoğraf ya da PDF cihazda çözülür; sunucuya yalnızca cevaplar gider.',
          '**Her kullanıcı kendi yetki alanını görür:** öğretmen kendi sınavını, okul yöneticisi okulunu, ilçe/il yetkilisi bölgesini.',
          '**Veliler giriş yapmaz.** Okulun açtığı sınavların sonucunu okul → sınıf → numara (ve varsa veli kodu) ile görürler.'
        ]],
        ['info', 'Menü, ekranın solunda (telefonda altta) durur: Okut, Kuyruk, Sonuçlar, Analiz, Sınavlar, Formlar, Yönetim (yalnız yetkililer), Ayarlar ve Kılavuz. Her ekranın üstündeki **?** düğmesi bulunduğunuz ekran için bu kılavuzu açar.']
      ]
    },
    {
      id: 'roller', cat: 'basla', title: 'Roller ve yetkiler: kim ne yapar?', aud: 'herkes', kw: 'yetki rol idareci müdür öğretmen yönetici il ilçe kim görür',
      sum: 'Beş rol vardır; üst rol alt rolün yaptığı her şeyi yapabilir.',
      see: ['genel', 'yon-basvurular', 'uye-okul', 'uye-ogretmen'],
      body: [
        ['table', ['Rol', 'Nasıl olunur?', 'Ne yapabilir?'], [
          ['**Veli / öğrenci**', 'Üyelik gerekmez', 'Okulun açtığı sınavların sonucunu sorgular. Başka hiçbir şey göremez.'],
          ['**Öğretmen**', 'Üye olur, okul yöneticisi onaylar', 'Form seçer/yazdırır, **kendi** sınavını tanımlar, okutur, sonuç ve analizi görür. Sınavı yalnızca kendisi ve okul yöneticisi görür.'],
          ['**Okul yöneticisi** (idareci)', 'Okulunu kaydeder, ilçe/il yetkilisi onaylar', 'Okulun öğrenci listesini yükler, öğretmen başvurularını onaylar, öğretmenleri yönetir, veli kodu ve WhatsApp mesajlarını hazırlar, okulun bütün sınavlarını görür.'],
          ['**İlçe / il yetkilisi**', 'Sistem yöneticisi tanımlar', 'Bölgesindeki okulları, kullanıcıları ve başvuruları yönetir; ortak sınavlarda okulları ve ilçeleri karşılaştırır.'],
          ['**Sistem yöneticisi**', 'Kurulumu yapan kişi', 'Her şey; ayrıca yapay zekâ anahtarlarını tanımlar.']
        ]],
        ['tip', 'Giriş yaptığınızda kılavuz sizin rolünüze göre süzülür (★ işaretli düğme). “Tümü”nü seçerek bütün kılavuzu görebilirsiniz.']
      ]
    },
    {
      id: 'giris', cat: 'basla', title: 'Giriş yapma, parola ve çıkış', aud: 'ogretmen', kw: 'şifre parola unuttum kullanıcı adı oturum giriş',
      sum: 'Kullanıcı adı ve parolayla giriş; parolanızı Ayarlar’dan değiştirin.',
      go: { view: 'settings', label: 'Ayarlar’ı aç' }, see: ['uye-ogretmen', 'ayarlar'],
      body: [
        ['steps', [
          ['Adresi açın', 'Tarayıcıdan OptiNet adresini ya da telefonunuza yüklediğiniz simgeyi açın.'],
          ['Kullanıcı adı ve parolayı yazın', 'Üyelik başvurunuz onaylanmadan giriş yapılamaz: parolanız doğruysa “Başvurunuz henüz onaylanmadı” (bekliyorsa) ya da onaylanmama gerekçesi (reddedildiyse) görünür.'],
          ['İlk girişte parolanızı değiştirin', '{{Ayarlar → Parola değiştir}} bölümünde [[Eski parola]] ve yeni parolayı yazın.']
        ]],
        ['info', '**Güvenlik:** üst üste 8 hatalı denemeden sonra giriş 10 dakika kilitlenir. “Hesabınız pasif” iletisi, yöneticinizin hesabı pasif yaptığı anlamına gelir.'],
        ['warn', 'Parolanızı kimseyle paylaşmayın; ortak bilgisayarda işiniz bitince {{Ayarlar → Hesap}} bölümündeki çıkış düğmesini kullanın. Parolanızı unutursanız okul yöneticiniz (öğretmen için) ya da üst yetkili yeni parola verebilir: {{Yönetim → Kullanıcılar}}.'],
        ['info', 'Veli ve öğrenciler giriş yapmaz; giriş sayfasındaki “Öğrenci / veli: sonuç sorgulama” bağlantısını kullanırlar. ((veli-sorgu|Sonuç sorgulama))']
      ]
    },
    {
      id: 'kurulum', cat: 'basla', title: 'Telefona ya da bilgisayara uygulama olarak yükleme', aud: 'herkes', kw: 'pwa yükle kur ana ekran iphone android simge',
      sum: 'Mağazaya gerek yok: tarayıcıdan tek dokunuşla ana ekrana eklenir.',
      body: [
        ['p', 'OptiNet bir web uygulamasıdır; yüklenince ana ekranda kendi simgesiyle tam ekran açılır ve internet yokken de çalışır.'],
        ['h', 'Android (Chrome, Edge, Samsung Internet)'],
        ['steps', [['Giriş sayfasındaki karttan ya da üst çubuktan [[Uygulamayı kur]]’a dokunun'], ['Çıkan kutuda **Yükle**’yi onaylayın', 'Kutu hemen açılmazsa tarayıcı menüsünden (⋮) “Uygulamayı yükle” ya da “Ana ekrana ekle”yi seçin.']]],
        ['h', 'iPhone / iPad'],
        ['steps', [['Siteyi **Safari**’de açın'], ['**Paylaş** düğmesine (kareden çıkan ok) dokunun'], ['**Ana Ekrana Ekle** → **Ekle**', 'WhatsApp ya da Instagram içinde açılan bağlantılardan yükleme yapılamaz; ⋯ menüsünden “Safari’de aç” deyin.']]],
        ['h', 'Bilgisayar (Windows, Mac)'],
        ['p', 'Chrome ya da Edge’de adres çubuğunun sağındaki **Yükle** simgesine ya da üst çubuktaki [[Uygulamayı kur]] düğmesine tıklayın.'],
        ['tip', 'Uygulama zaten ana ekrandan açıldıysa yükleme düğmeleri görünmez. Yeni sürümler açılışta kendiliğinden iner; yeniden yüklemeniz gerekmez.']
      ]
    },

    /* ================================================================ 2. ÜYELİK */
    {
      id: 'uye-okul', cat: 'uyelik', title: 'Okul yöneticisi (idareci) olarak üye olma', aud: 'okul', kw: 'kayıt okul kaydı idareci müdür başvuru üye ol',
      sum: 'Okulunuzu kendiniz kaydedin; ilçe/il yetkilisi onaylayınca okul yöneticisi olarak girersiniz.',
      go: { href: '#/kayit', label: 'Üyelik sayfasını aç' }, see: ['yon-basvurular', 'yon-ogrenciler', 'yon-kullanicilar'],
      body: [
        ['p', 'Okulunuz sistemde henüz yoksa **okul yöneticisi (idareci)** olarak kendiniz üye olabilirsiniz. Giriş gerekmez.'],
        ['steps', [
          ['Üyelik sayfasını açın', 'Giriş sayfasında [[Üye ol: öğretmen veya okul kaydı]] bağlantısına tıklayın (adres: `#/kayit`).'],
          ['[[Okul kaydı (okul yöneticisi)]] sekmesini seçin'],
          ['Okul bilgilerini doldurun', '[[İl]], [[İlçe]] (listede yoksa yazın), [[Okul düzeyi]], [[Okul adı]], [[Kurum kodu]] (MEB kurum kodu, rakam), müdürün adı, telefon, e-posta ve adres.'],
          ['Yönetici hesabınızı belirleyin', 'Kullanıcı adı (3–40 karakter; küçük harf, rakam, . _ -) ve parola (en az 8 karakter); parolayı iki kez yazın. Yetkili adı boşsa müdür adı kullanılır.'],
          ['[[Okulu kaydet ve onaya gönder]]’e basın', 'Başvurunuz ilgili ilçe/il yetkilisine (ya da sistem yöneticisine) gider.'],
          ['Onayı bekleyin', 'Okul sisteme **onaylandığı anda** eklenir. Onaylanıp onaylanmadığını giriş sayfasında kullanıcı adı ve parolanızla denediğinizde görürsünüz; onaydan sonra **okul yöneticisi** olarak girersiniz.']
        ]],
        ['info', 'Okul yöneticisi olduktan sonra sırasıyla: öğrenci listesini yükleyin ((yon-ogrenciler|Öğrenci yükleme)), öğretmenlerinize okulunuzu seçerek üye olmalarını söyleyin ve başvurularını onaylayın ((yon-basvurular|Başvuruları onaylama)).'],
        ['warn', 'Bir kurum kodu yalnızca bir kez kaydedilir. “Bu kurum kodu sistemde zaten kayıtlı” uyarısı alırsanız okulunuz sistemdedir: öğretmen olarak üye olun ya da mevcut okul yöneticisiyle görüşün. “Onay bekleyen bir başvuru var” uyarısı, aynı kodla başka bir başvurunun beklediğini gösterir.']
      ]
    },
    {
      id: 'uye-ogretmen', cat: 'uyelik', title: 'Öğretmen olarak üye olma', aud: 'ogretmen', kw: 'kayıt öğretmen başvuru üye ol hesap açma',
      sum: 'Okulunuzu listeden seçip başvurun; okul yöneticiniz onaylar.',
      go: { href: '#/kayit', label: 'Üyelik sayfasını aç' }, see: ['yon-basvurular', 'giris', 'uye-okul'],
      body: [
        ['steps', [
          ['Üyelik sayfasını açın', 'Giriş sayfasında [[Üye ol: öğretmen veya okul kaydı]] bağlantısına tıklayın.'],
          ['[[Öğretmen üyeliği]] sekmesini seçin'],
          ['Okulunuzu bulun', '[[İl]] → [[İlçe]] → [[Okul düzeyi]] seçin; okul listesinden okulunuzu seçin. Okulunuz yoksa okul yöneticinizin önce okulu kaydetmesi gerekir ((uye-okul|Okul kaydı)).'],
          ['Bilgilerinizi yazın', '[[Ad Soyad]], branş, telefon, e-posta, kullanıcı adı (3–40 karakter) ve parola (en az 8 karakter, iki kez).'],
          ['[[Başvur]]’a basın', 'Başvurunuz okul yöneticinize (okulun yöneticisi yoksa ilçe/il yetkilisine) gider.'],
          ['Onaydan sonra giriş yapın', 'Onaylanmazsa giriş sayfasında gerekçe görünür; düzeltip yeniden başvurabilirsiniz.']
        ]],
        ['tip', 'Onay gelmediyse okul yöneticinize haber verin: bekleyen başvurular onun menüsünde {{Yönetim → Başvurular}} altında, kırmızı sayıyla görünür.']
      ]
    },
    {
      id: 'yon-basvurular', cat: 'uyelik', title: 'Başvuruları onaylama ve reddetme', aud: 'okul', kw: 'onay başvuru kabul red bekleyen üyelik öğretmen okul',
      sum: 'Kim kimi onaylar? Okul → ilçe/il yetkilisi; öğretmen → okul yöneticisi.',
      go: { view: 'admin', tab: 'apps', label: 'Başvurular sekmesini aç' }, see: ['uye-okul', 'uye-ogretmen', 'yon-kullanicilar'],
      body: [
        ['table', ['Başvuru', 'Kim onaylar?'], [
          ['Okul kaydı (okul yöneticisi)', 'İlçe/il yetkilisi ya da sistem yöneticisi (kendi bölgesindeki okullar için)'],
          ['Öğretmen üyeliği', 'O okulun yöneticisi; üst yetkililer de onaylayabilir']
        ]],
        ['steps', [
          ['{{Yönetim → Başvurular}} sekmesini açın', 'Menüde Yönetim’in yanındaki kırmızı sayı bekleyen başvuru adedidir.'],
          ['Başvuruyu inceleyin', 'Kullanıcı adı, okul ve kurum kodu, il/ilçe, telefon, e-posta ve başvuru tarihi görünür.'],
          ['**Onayla** ya da **Reddet**', 'Onaylanınca hesap (okul kaydında okul da) hemen açılır. Reddederken [[Gerekçe]] yazılır; başvuran giriş sayfasında “Başvurunuz onaylanmadı: …” iletisiyle bunu görür ve gerekirse yeniden başvurur.']
        ]],
        ['warn', 'Başvuranı tanımıyorsanız onaylamayın: onaylanan öğretmen okulunuzun öğrenci adlarını ve sonuçlarını görebilir.']
      ]
    },

    /* ================================================================ 3. VELİ */
    {
      id: 'veli-sorgu', cat: 'veli', title: 'Sonuç sorgulama: adım adım', aud: 'veli', kw: 'veli öğrenci sonuç sorgula okul numarası sınıf nasıl bakarım',
      sum: 'Giriş yapmadan; okul, sınıf ve okul numarasıyla (gerekirse veli koduyla).',
      go: { href: '#/ogrenci', label: 'Sorgulama sayfasını aç' }, see: ['veli-sonuc', 'veli-kod', 'veli-sss'],
      body: [
        ['p', 'Sonuçlarınıza **üyelik ve parola olmadan** ulaşırsınız. Telefonda ya da bilgisayarda aynıdır.'],
        ['steps', [
          ['Sorgulama sayfasını açın', 'Okulunuzun verdiği bağlantıyı açın ya da giriş sayfasındaki [[Öğrenci / veli: sonuç sorgulama]] bağlantısına dokunun (adres: `#/ogrenci`). Bağlantıda okulunuz hazır geliyorsa 1. adımı atlarsınız.'],
          ['**1. Okulunuzu seçin**', '[[İl]] → [[İlçe]] seçin. Listeyi kısaltmak için [[Okul düzeyi]] seçebilir ya da [[Okul ara]] kutusuna okul adının bir bölümünü yazabilirsiniz; ardından [[Okul]] listesinden okulunuzu seçin.'],
          ['**2. Sınıf ve okul numarası**', '[[Sınıfı seçin…]] listesinden sınıfınızı seçin, ardından okul numarasını yazın (örn. 125).'],
          ['Gerekirse [[Veli kodu]]’nu yazın', 'Okul kod vermişse bu kutu kendiliğinden açılır. Kod okul tarafından verilir ((veli-kod|Veli kodu nedir?)).'],
          ['[[Sonuçlarımı göster]]’e basın']
        ]],
        ['info', 'Yalnızca öğretmeninizin **“öğrenci/veli sorgulamasına açık”** yaptığı sınavlar görünür. Sonuç yoksa: “Öğretmeniniz sonuçları yayımladığında burada görünecek.”'],
        ['tip', 'Kendi güvenliğiniz için sonuç sayfası **10 dakika** sonra ekrandan kaldırılır; yeniden sorgulayabilirsiniz. Okul numaranız ve veli kodunuz cihazda saklanmaz.']
      ]
    },
    {
      id: 'veli-sonuc', cat: 'veli', title: 'Sonuç sayfasını okuma', aud: 'veli', kw: 'net puan doğru yanlış boş sıralama ortalama karne cevaplar anahtar yazdır',
      sum: 'Net, puan, sıra, ortalamalarla kıyas ve cevaplarınız.',
      see: ['veli-sorgu', 'veli-sss', 'sozluk'],
      body: [
        ['p', 'Sayfanın üstünde adınız (kısmen gizli), okul, sınıf ve numaranız; altında **her sınav için bir kart** vardır.'],
        ['table', ['Görünen', 'Anlamı'], [
          ['**Doğru / Yanlış / Boş**', 'Doğru, yanlış ve işaretlenmemiş soru sayısı.'],
          ['**Net**', 'Doğru sayısından, yanlışlar için düşülen kısmın çıkarılmasıyla bulunur (ör. 4 yanlış 1 doğruyu götürür).'],
          ['**Puan**', 'Sınavın puan yöntemine göre hesaplanan sonuç.'],
          ['**Sınıf / Okul / Sınav geneli ortalama**', 'Sizin netinizi sınıf, okul ve bütün katılımcıların ortalamasıyla kıyaslar. Sınıfta 3’ten az katılımcı varsa sınıf ortalaması gösterilmez.'],
          ['**Ders ders sonuçlar**', 'Her dersin doğru/yanlış/net değeri ve çubuk grafiği.'],
          ['**Cevaplarınız ve doğru cevaplar**', 'Sorular tek tek: işaretlediğiniz şık ve doğru şık. Sınavı yapan cevap anahtarını yayımlamadıysa yalnızca işaretlediğiniz şıklar görünür.']
        ]],
        ['p', 'Geçmiş bütün sınavlarınız aynı sayfada alt alta listelenir; gelişiminizi bu şekilde izleyebilirsiniz. [[🖨 Yazdır]] düğmesiyle sayfayı yazdırabilir ya da PDF kaydedebilirsiniz; [[Başka sorgu]] ile başka bir öğrenciye geçersiniz.']
      ]
    },
    {
      id: 'veli-kod', cat: 'veli', title: 'Veli kodu nedir, nereden alınır?', aud: 'veli', kw: 'veli kodu pin şifre kod istiyor',
      sum: 'Okulun öğrencinize özel verdiği kısa kod; başkasının sonucunu tahminle görmeyi önler.',
      see: ['veli-sorgu', 'veli-sss', 'veli-kod-uret'],
      body: [
        ['p', 'Bazı okullar her öğrenciye bir **veli kodu** verir. Kodu olan öğrencinin sonucu, okul numarasına ek olarak bu kodu da bilmeyen kişiye açılmaz.'],
        ['ul', [
          'Kod, okul tarafından size verilir (liste, mesaj ya da okul yönetiminin WhatsApp iletisi).',
          'Okul WhatsApp ile sonuç gönderdiyse kod mesajın içindedir; mesajdaki bağlantıya tıklayınca sınıf ve numara hazır gelir, yalnızca kodu yazarsınız.',
          'Kod hanesi sorgulama ekranında görünmüyorsa okulunuz kod kullanmıyordur; yalnızca sınıf ve numara yeter.'
        ]],
        ['warn', 'Kodunuzu başkalarıyla paylaşmayın. Kaybettiyseniz okulunuza başvurun; okul yeni kod üretebilir.']
      ]
    },
    {
      id: 'veli-sss', cat: 'veli', title: 'Veli için sık sorunlar', aud: 'veli', kw: 'sonuç görünmüyor okul bulunamıyor yanlış kod bekleyin sorun',
      sum: 'Okulum listede yok, sonuç görünmüyor, kod hatalı…',
      see: ['veli-sorgu', 'veli-kod'],
      body: [
        ['table', ['Sorun', 'Ne yapmalı?'], [
          ['Okulum listede çıkmıyor', 'Önce [[İl]] ve [[İlçe]] seçin; okul düzeyini “Tüm düzeyler” bırakın. Hâlâ yoksa okulunuz sisteme kayıtlı değildir; okul yönetimine sorun.'],
          ['“Bu okulda henüz öğrenci listesi yüklenmemiş”', 'Okul öğrenci listesini yüklememiştir; okulunuzla iletişime geçin.'],
          ['Sınıfım ya da numaram bulunamıyor', 'Sınıfı listeden seçip numarayı okul listesindeki gibi yazın; hâlâ olmazsa okulunuzda numaranızın doğru kaydedildiğini sorun.'],
          ['“Veli kodu” hatası', 'Kodu okul verir; harf/rakamı kontrol edin. Kodunuz yoksa ya da kaybolduysa okula başvurun.'],
          ['Sonuç görünmüyor', 'Sınavın sonuçları henüz yayımlanmamış ya da veli sorgulamasına açılmamış olabilir; öğretmeninize sorun.'],
          ['“Bilgiler eşleşmedi. Okulu, sınıfı ve okul numarasını kontrol edin.”', 'Okul, sınıf ve numaradan biri okulun kayıtlarıyla uyuşmuyor. Sınıfı ve numarayı okul listesindeki gibi seçin/yazın.'],
          ['“Çok fazla hatalı deneme yapıldı”', 'Aynı öğrenci numarası için art arda hatalı denemeden sonra güvenlik için sorgu **1 saat** kilitlenir. Bir saat bekleyin ya da okulunuza başvurun.'],
          ['Sayfa “Sunucuya ulaşılamadı” diyor', 'İnternet bağlantınızı kontrol edip yeniden deneyin.']
        ]]
      ]
    },

    /* ================================================================ 4. OKUL HAZIRLIĞI */
    {
      id: 'yon-okullar', cat: 'hazirlik', title: 'Okulları ekleme ve yönetme', aud: 'yetkili', kw: 'okul ekle düzenle sil kurum kodu il ilçe',
      sum: 'İlçe/il yetkilisi ve sistem yöneticisi için: bölgedeki okulların listesi.',
      go: { view: 'admin', tab: 'schools', label: 'Okullar sekmesini aç' }, see: ['yon-ogrenciler', 'yon-basvurular'],
      body: [
        ['p', 'Okullar, sınavlara katılan kurumlardır. Okul **kendisi kayıt olabilir** ((uye-okul|Okul kaydı)) ya da yetkili elle ekleyebilir.'],
        ['steps', [
          ['{{Yönetim → Okullar}} sekmesini açın'],
          ['[[+ Okul ekle]]’ye basın', 'İl, ilçe, düzey, okul adı ve kurum kodunu girin; müdür, telefon, adres isteğe bağlıdır.'],
          ['Satırdaki [[Düzenle]] ile bilgileri güncelleyin', 'Satırı silerseniz okulun öğrenci listesi de silinir; geçmiş sınav sonuçları kalır. Aktif kullanıcısı olan okul silinemez.']
        ]],
        ['info', 'İlçe yetkilisi yalnızca kendi ilçesindeki, il yetkilisi kendi ilindeki okulları görür ve yönetir; yetki alanı sunucuda denetlenir.']
      ]
    },
    {
      id: 'yon-ogrenciler', cat: 'hazirlik', title: 'Öğrenci listesi: kendi öğrencilerinizi yükleme', aud: 'okul', kw: 'öğrenci yükle excel toplu ekle numara sınıf ad soyad liste csv',
      sum: 'Okul yöneticisi kendi öğrencilerini Excel’den yapıştırarak ya da tek tek ekler.',
      go: { view: 'admin', tab: 'students', label: 'Öğrenciler sekmesini aç' }, see: ['veli-kod-uret', 'yon-kullanicilar', 'okut-kurum-kodu'],
      body: [
        ['p', 'Öğrenci listesi; okutulan formdaki numarayı **doğrulamak**, sonuçlarda **adı göstermek**, sınıf bazlı analiz ve veli sorgulaması için gereklidir. Okul yöneticisi yalnızca **kendi okulunun** listesini yönetir.'],
        ['h', 'Toplu yükleme (önerilen)'],
        ['steps', [
          ['{{Yönetim → Öğrenciler}} sekmesini açın', 'Okul yöneticisinde okulunuz kendiliğinden seçilidir; üst yetkililer [[Okul seçin…]] listesinden okulu seçer.'],
          ['Excel’de şu sütunlarla bir liste hazırlayın', '`ogrNo` · `ad` · `soyad` · `sinif` · `anneTel` · `babaTel` (telefonlar isteğe bağlı). “no, numara, öğrenci no” gibi başlık adları da tanınır.'],
          ['Satırları kopyalayıp [[Öğrenci ekle / güncelle]] kutusuna yapıştırın', 'Dosyadan yüklemek için [[CSV dosyası seç]]’i kullanın.'],
          ['[[Yükle]]’ye basın', '“X eklendi, Y güncellendi” iletisi gelir; atlanan satırlar nedeniyle birlikte yazılır.']
        ]],
        ['tip', 'Aynı numaralı öğrenci yeniden yüklenirse **güncellenir**, ikinci kez eklenmez. Listeyi sene başında bir kez yükleyin, değişiklikleri tek tek düzeltin.'],
        ['h', 'Tek tek ekleme ve düzenleme'],
        ['p', '[[+ Öğrenci ekle]] düğmesiyle tek öğrenci eklenir; listedeki satıra tıklayarak düzenlenir ya da silinir. Kutulardan çoklu seçip toplu silebilir, arama ve sınıf süzgeciyle listeyi daraltabilirsiniz.'],
        ['warn', 'Okul numarası **okulda tektir** (iki öğrenci aynı numarayı taşıyamaz). Sınav sonuçları numaraya göre eşleştirildiği için numarayı sonradan değiştirmek eski sonuçların bağını koparır.'],
        ['info', 'Formdan okunan öğrenci listede yoksa, okutma ekranındaki [[Formdaki öğrencileri listeye ekle]] düğmesi (yalnızca okul yöneticisi ve üstü) öğrenciyi forma yazılı ad-soyadla listeye ekler. ((okut-hazir-form|Dışarıdan hazır form okutma))']
      ]
    },
    {
      id: 'yon-kullanicilar', cat: 'hazirlik', title: 'Öğretmenler ve kullanıcılar', aud: 'okul', kw: 'kullanıcı öğretmen ekle parola sıfırla pasif rol yetki alanı',
      sum: 'Öğretmen hesabı açma, parola yenileme, hesabı pasif yapma.',
      go: { view: 'admin', tab: 'users', label: 'Kullanıcılar/Öğretmenler sekmesini aç', roles: ['admin', 'il', 'ilce', 'okul'] }, see: ['yon-basvurular', 'uye-ogretmen'],
      body: [
        ['p', 'Okul yöneticisinde sekme {{Yönetim → Öğretmenler}}, üst yetkililerde {{Yönetim → Kullanıcılar}} adını taşır. Tabloda kullanıcı adı, ad, rol, branş, yetki alanı ve durum görünür.'],
        ['steps', [
          ['Yeni hesap için ekle düğmesine basın', 'Öğretmenler genellikle kendileri üye olur ((uye-ogretmen|Öğretmen üyeliği)); elle eklemek yalnızca kolaylık içindir.'],
          ['Kullanıcıyı düzenlemek için satıra tıklayın', 'Ad, branş, telefon, e-posta değişir; **parola** alanına yeni parola yazarsanız parola sıfırlanır; “Aktif” işaretini kaldırırsanız hesap pasif olur (giriş yapamaz).'],
          ['[[Kaydet]]']
        ]],
        ['info', 'Okul yöneticisi yalnızca kendi okulunun **öğretmenlerini** yönetir. Yeni okul yöneticisi, ilçe/il yetkilisi ve sistem yöneticisi hesabını üst yetkili tanımlar.']
      ]
    },

    /* ================================================================ 5. FORMLAR */
    {
      id: 'form-secenek', cat: 'formlar', title: 'Hangi form yöntemini seçmeliyim?', aud: 'ogretmen', kw: 'optik form seçenek hazır kendi formum dışarıdan harici hangisi karşılaştır',
      sum: 'Üç yol: hazır şablon, kendi formunu tasarla, dışarıdan gelen hazır formu tanıt.',
      go: { view: 'forms', tab: 'catalog', label: 'Formlar ekranını aç' }, see: ['form-katalog', 'form-tasarla', 'form-harici-otomatik', 'form-elle'],
      body: [
        ['p', '{{Formlar}} ekranında dört sekme vardır. Hangisini seçeceğiniz elinizdeki forma bağlıdır:'],
        ['table', ['Durumunuz', 'Sekme', 'Ne yaparsınız?'], [
          ['Formu **bu uygulamadan yazdırmak** istiyorum (LGS, TYT, KPSS, tek ders…)', '[[Hazır şablonlar]]', 'Katalogdan seçip yazdırırsınız; okutma formu otomatik tanır.'],
          ['Soru sayısı/ders düzenini **kendim belirleyeceğim**, kişiye özel (adı yazılı) basacağım', '[[Form tasarla ve yazdır]]', 'Ders, soru, şık, hane sayısını seçip yazdırırsınız; kaydedip şablon yaparsınız.'],
          ['Elimde **yayınevi ya da kurum yapımı basılı optik form** var (dışarıdan hazır form)', '[[Harici formu otomatik tanıt]]', 'Boş bir örneğini yükleyin; sistem baloncukları kendisi bulur. İsterseniz yapay zekâ yardım eder.'],
          ['Form köşe karesi/yan çizgi taşımıyor ya da otomatik tanıma tutmuyor', '[[Elle tanımla]]', 'Yerleşimi ölçülerle kendiniz yazarsınız.']
        ]],
        ['tip', 'Emin değilseniz sırayla deneyin: önce [[Hazır şablonlar]], olmuyorsa [[Harici formu otomatik tanıt]]. Hepsinde son adım aynıdır: sınavı tanımlarken **Optik form** olarak şablonu seçersiniz. ((sinav-yeni|Sınav tanımlama))']
      ]
    },
    {
      id: 'form-katalog', cat: 'formlar', title: 'Hazır şablonlar: seç, önizle, yazdır', aud: 'ogretmen', kw: 'hazır şablon katalog lgs tyt kpss yazdır önizleme sınava dönüştür',
      sum: 'Hazır optik form ve sınav programları; seçilen form A4’e basılır.',
      go: { view: 'forms', tab: 'catalog', label: 'Hazır şablonları aç' }, see: ['form-tasarla', 'sinav-yeni', 'form-secenek'],
      body: [
        ['p', '[[Hazır şablonlar]] sekmesi, **Hazır optik formlar ve sınav programları** listesini gösterir (LGS, TYT, AYT, KPSS, tek ders denemeleri…). Arama kutusuna “LGS, TYT, KPSS, Türkçe, 20 soru…” gibi yazabilirsiniz.'],
        ['steps', [
          ['Listeden formu bulun', 'Her kartta soru sayısı, şık sayısı, net kuralı ve baloncuk aralığı yazar.'],
          ['Sayfa düzenini seçin', 'Bir sayfaya 1, 2, 4, 6 ya da 8 form sığdırabilirsiniz (2–8’de sayfa kesilerek kullanılır). Öğrenci no ve kurum kodu hane sayısını da seçersiniz.'],
          ['[[Önizle]] ile kontrol edin', 'Sığmayan seçimlerde kart uyarı verir.'],
          ['[[Yazdır]] ya da PDF kaydedin', 'Yazdırma penceresinde **ölçek %100 / Gerçek boyut**, **kenar boşluğu Yok**, “Sayfaya sığdır” **kapalı** olmalı; köşe işaretleri bozulmadan çıkmalıdır. PDF için yazıcı yerine “PDF olarak kaydet”i seçin.'],
          ['İsterseniz [[Sınav oluştur]] ile bu formla yeni sınav açın', 'Dersler ve soru sayıları sınava hazır gelir.']
        ]],
        ['tip', 'Hazır form basılıp doldurulduktan sonra **ayrıca bir şey tanıtmanız gerekmez**: okutma, formun alt kısmındaki kimlik kodundan hangi form olduğunu kendisi bulur.'],
        ['info', 'Kendi tek ders optiğinizi (örn. 20 soruluk Matematik) aynı sekmedeki **Kendi tek ders optiğinizi oluşturun** bölümünden ders ve soru sayısı seçerek hazırlayabilirsiniz.']
      ]
    },
    {
      id: 'form-tasarla', cat: 'formlar', title: 'Form tasarla ve yazdır (kendi formunu oluştur)', aud: 'ogretmen', kw: 'tasarla kendi form oluştur özel soru sayısı ders hane kitapçık kişiye özel ad soyad basılı şablon kaydet',
      sum: 'Ders sayısı, soru sayısı, şık, hane ve yerleşimi siz belirleyin; okul/öğrenci adlarıyla kişiye özel de basılır.',
      go: { view: 'forms', tab: 'design', label: 'Tasarla sekmesini aç' }, see: ['form-secenek', 'sinav-yeni', 'form-esle'],
      body: [
        ['steps', [
          ['{{Formlar → Form tasarla ve yazdır}} sekmesini açın'],
          ['Dersleri ve soru sayılarını ekleyin', 'Ders listesinden seçerek bölüm ekleyin; her bölüm için ad ve soru sayısı yazılır (1–200). Bölümleri yukarı/aşağı taşıyabilirsiniz.'],
          ['Şık sayısını, öğrenci no hanesini ve kurum kodu hanesini seçin', 'Kitapçık türü gerekiyorsa A,B gibi virgülle yazın.'],
          ['Yerleşimi seçin', '“Dersler yan yana (önerilen)”, “Dersler sıkı yerleşir” ya da “Tek liste (ders başlığı yok)”. Sığmazsa uygulama sıkı yerleşime geçtiğini söyler.'],
          ['Okul ve öğrencileri seçerek **kişiye özel** basabilirsiniz', 'Yalnızca işaretlenen öğrencilerin formu, adları ve numaralarıyla basılır. “Boş form sayfası sayısı” ile ayrıca boş form da eklenir.'],
          ['Yazdırın, **şablonu kaydedin**', 'Kayıtlı şablon, sınav tanımlarken “Kayıtlı şablonlarım” altında seçilir.']
        ]],
        ['warn', 'Yazdırırken ölçek **%100 / gerçek boyut** olmalıdır; küçülen form okunamayabilir.']
      ]
    },
    {
      id: 'form-harici-otomatik', cat: 'formlar', title: 'Dışarıdan hazır optik formu tanıtma (otomatik)', aud: 'ogretmen', kw: 'harici dış hazır optik form yayınevi baloncuk tanıt otomatik şablon kaydet taranmış boş form çerçeve',
      sum: 'Elinizdeki basılı optik formun boş örneğini yükleyin; baloncuklar otomatik bulunur.',
      go: { view: 'forms', tab: 'auto', label: 'Tanıtma ekranını aç' }, see: ['form-duzenleyici', 'form-ai', 'okut-hazir-form', 'form-esle', 'form-kodlu'],
      body: [
        ['p', 'Yayınevi, dershane ya da başka bir kurumdan gelen optik formu **kendi formunuz gibi** okutabilirsiniz. Bunun için formun **boş bir örneğini** bir kez sisteme tanıtırsınız; sistem soruları, öğrenci numarasını, kurum kodunu, kitapçığı ve ad-soyad harf ızgaralarını kendisi bulur.'],
        ['steps', [
          ['{{Formlar → Harici formu otomatik tanıt}} sekmesini açın'],
          ['**Boş** form örneğini yükleyin', 'Bilgisayarda dosya/PDF seçin; telefonda [[Fotoğraf çek]] kullanın. Form tamamen görünmeli, düz ve gölgesiz olmalı; taramada en az 200 dpi önerilir.'],
          ['Sonucu tuvalde kontrol edin', 'Bulunan bölümler renkli çerçevelerle gösterilir: sorular, öğrenci no, kurum kodu, kitapçık, ad, soyad. [[Çerçeve türü]] genellikle “Otomatik”te doğru bulunur.'],
          ['Gerekirse düzeltin', 'Eksik ya da yanlış bölüm varsa ((form-duzenleyici|düzenleyiciyle)) elle düzeltin ya da ((form-ai|yapay zekâdan)) yardım alın.'],
          ['[[Onayla ve kaydet]]’e basın', 'Form adlandırılıp **kayıtlı şablon** olur.'],
          ['**İşaretli bir formla deneyin**', '[[İşaretli bir formla dene]] ile aynı formun doldurulmuş bir kopyasını okutup cevapları kâğıtla karşılaştırın. İlk kullanımda bu adımı atlamayın.']
        ]],
        ['h', 'Desteklenen form türleri'],
        ['table', ['Tür', 'Formda ne var?', 'Not'], [
          ['Dört köşe karesi', 'Köşelerde dolu siyah kare', 'En kolay ve en dayanıklı tür; canlı kamera yalnızca bunda çalışır.'],
          ['İki yan çizgi', 'Sol ve sağ kenarda kısa siyah çizgiler', 'Dosya ve fotoğrafla okunur.'],
          ['Tek yan çizgi', 'Yalnızca bir kenarda çizgi sırası', 'En iyi sonuç tarayıcıdan; fotoğrafta form dik ve düz çekilmeli, aksi hâlde form yanlış okunmasın diye reddedilir.']
        ]],
        ['tip', 'Pembe, mor, mavi gibi açık renkli baskılar mürekkep rengine göre otomatik gri tona çevrilir; elle ayar gerekmez. Çok silik baskı ve ağır JPG sıkıştırması okunamayabilir; renkli ya da gri tonlamada tarayın.'],
        ['info', 'Köşe karesi de yan çizgi de olmayan formlar için ((form-elle|Elle tanımla)) yolunu kullanın.']
      ]
    },
    {
      id: 'form-duzenleyici', cat: 'formlar', title: 'Tanınan bölümleri elle düzeltme (düzenleyici)', aud: 'ogretmen', kw: 'düzenleyici elle düzelt blok sürükle böl birleştir bölüm ekle baloncuklara oturt geri al satır sütun',
      sum: 'Otomatik tanıma yanlış ya da eksik bulursa her bölümü kendiniz düzeltirsiniz.',
      go: { view: 'forms', tab: 'auto', label: 'Tanıtma ekranını aç' }, see: ['form-harici-otomatik', 'form-ai'],
      body: [
        ['p', 'Tuvalde bir çerçeveye (ya da sağdaki listeden bir bloğa) tıklayınca blok seçilir; baloncuk daireleri, okunacak harf/rakamlar ve soru numaraları görünür. Gerçek baloncuğa denk gelmeyen daireler kırmızıdır.'],
        ['table', ['Yapmak istediğiniz', 'Nasıl?'], [
          ['Çerçeveyi taşımak', 'İçinden sürükleyin, ok tuşları ya da ▲◀▶▼ düğmeleri. “Adım” (0,5–25 piksel) milim milim ayar verir; Shift ×5, Alt ×0,5.'],
          ['Büyütüp küçültmek', 'Kenar/köşe kutucuklarından çekin ya da kenar için “− daralt / + genişlet” kullanın.'],
          ['Soru/şık sayısını değiştirmek', '“Soru sayısı” ve “Şık sayısı” kutularına yazın ya da ± satır/sütun düğmelerini kullanın.'],
          ['Gerçek baloncuklara hizalamak', '[[Baloncuklara oturt]]; ya da [[Dikdörtgeni yeniden say]] ile sayıları yeniden bulun.'],
          ['Tek görünen iki bölümü ayırmak', '[[Böl…]] (önerilen nokta en geniş boşluktur) ya da araçla iki satır/sütun arasına tıklayın.'],
          ['İki parçayı birleştirmek', '[[Birleştir…]] (alt alta için sütunlar, yan yana için satırlar aynı hizada olmalı).'],
          ['Bulunamayan bölümü eklemek', '[[＋ Bölüm ekle]] → tuvalde bölümün çevresine dikdörtgen çizin.'],
          ['Bloğun türünü seçmek', 'Soru, öğrenci no, kurum kodu, kitapçık, ad, soyad ya da yok say. Okuma yönü: her satır bir soru / her sütun bir soru.'],
          ['Hatayı geri almak', '[[↶ Geri al]] / [[↷ Yinele]] (Ctrl+Z / Ctrl+Y); Del seçili bloğu siler (geri alınabilir).']
        ]],
        ['tip', 'Elle düzelttiğiniz bloklar “✎ elle” etiketi taşır ve sonradan yapay zekâ önerisi gelse bile **korunur**. Her düzenlemeden sonra [[İşaretli bir formla dene]] ile sınayın.']
      ]
    },
    {
      id: 'form-ai', cat: 'formlar', title: 'Yapay zekâ ile formun tamamını tanıma', aud: 'ogretmen', kw: 'yapay zeka ai tam tanıma yerleşim ders adı harf ad soyad ızgara sohbet claude chatgpt gemini api anahtar',
      sum: 'Yapay zekâ bölümlerin yerini, sayılarını ve ders adlarını önerir; kesin konumu görüntü belirler.',
      go: { view: 'forms', tab: 'auto', label: 'Tanıtma ekranını aç' }, see: ['form-harici-otomatik', 'form-duzenleyici', 'yon-ai'],
      body: [
        ['p', 'Zor ya da silik formlarda yapay zekâ yardımcı olur. **Konumu yapay zekâ değil görüntü işleme belirler**; yapay zekâ “şu kutuda 20 satır × 4 şık var, bu Türkçe” gibi **kutuyu ve sayıları** söyler, uygulama bunları gerçek baloncuklara oturtur.'],
        ['h', 'İki yol'],
        ['table', ['Yol', 'Gereken', 'Nasıl?'], [
          ['**Yapay zekâ ile tam tanıma**', 'Yöneticinin tanımladığı anahtar ({{Yönetim → Yapay zekâ}})', 'Tek düğme: aynı cetvelli görüntü ve blok listesi sunucuya gider, yanıt otomatik uygulanır.'],
          ['**API’siz yapay zekâ (sohbet uygulamasıyla)**', 'Anahtar gerekmez; ücretsiz bir sohbet uygulaması yeter', 'Uygulama cetvelli görüntü ve hazır istem üretir; siz sohbet uygulamasına yükleyip yanıtı yapıştırır ya da dosya olarak yüklersiniz.']
        ]],
        ['steps', [
          ['Önce formu normal şekilde yükleyin', '((form-harici-otomatik|Dışarıdan hazır form))’daki ilk iki adım.'],
          ['[[Yapay zekâ ile tam tanıma]] (ya da [[API’siz yapay zekâ (sohbet uygulamasıyla)]]) düğmesine basın', 'Pencerede “Tam tanıma” seçili gelir.'],
          ['Sohbet yolunda: görüntüyü ve istemi sohbet uygulamasına gönderin', 'Gelen JSON yanıtı yapıştırın ya da .json/.txt olarak yükleyin. Küçük bozukluklar (kod çiti, akıllı tırnak, sondaki virgül) kendiliğinden düzeltilir.'],
          ['Sonucu tuvalde inceleyin', 'Yapay zekânın kutuları **mor kesikli**, otomatik tanıma renkli çerçevelerle görünür.'],
          ['Gerekirse [[Önerileri geri al]] ya da elle düzeltin', 'Yapay zekâ tek geri alma adımıdır.']
        ]],
        ['info', 'Yapay zekâ **elle yaptığınız ayarları ezmez**; yanlış gördüğü bölümleri silmez, uyarı notuyla işaretler. Sayılar görüntüyle uyuşmazsa görüntü esas alınır, öneri bloğun üstünde düğme olarak bekler.'],
        ['warn', 'Gizlilik: sağlayıcıya yalnızca **boş** form görüntüsü ve blok listesi gönderilir; öğrenci verisi gönderilmez. Gerçek yayınevi formlarında ilk denemede sonucu mutlaka gözle kontrol edip işaretli bir formla sınayın.']
      ]
    },
    {
      id: 'form-elle', cat: 'formlar', title: 'Elle tanımla (özel yerleşim)', aud: 'ogretmen', kw: 'elle tanımla özel yerleşim ölçü mm köşe işareti tanıma tutmuyor',
      sum: 'Otomatik tanımanın tutmadığı formlarda yerleşimi ölçülerle yazarsınız.',
      go: { view: 'forms', tab: 'custom', label: 'Elle tanımla sekmesini aç' }, see: ['form-harici-otomatik', 'form-secenek'],
      body: [
        ['p', '[[Elle tanımla]] sekmesi, köşe karesi ve yan çizgi taşımayan ya da otomatik tanımanın uymadığı formlar içindir. Formun baloncuk bloklarını (soru, öğrenci no, kitapçık) ve aralıklarını milimetre ya da piksel olarak yazarsınız.'],
        ['steps', [
          ['Formun boş örneğini yükleyin ya da ölçülerini elinize alın'],
          ['Her blok için başlangıç noktasını, satır ve sütun sayısını, baloncuk aralığını girin'],
          ['Kaydedin ve işaretli bir formla deneyin']
        ]],
        ['tip', 'Çoğu form için ((form-harici-otomatik|otomatik tanıtma)) daha hızlı ve hatasızdır; önce onu deneyin.']
      ]
    },
    {
      id: 'form-kodlu', cat: 'formlar', title: 'Dışarıdan formu kişiye özel (kodlu) basma', aud: 'ogretmen', kw: 'kodlu baskı kişiye özel öğrenci no kurum kodu ad soyad dolu baloncuk basılı hizalama sayfası',
      sum: 'Tanıttığınız harici formun üzerine öğrenci no, kurum kodu ve adı dolu baloncuk olarak bastırın.',
      go: { view: 'forms', tab: 'auto', label: 'Tanıtma ekranını aç' }, see: ['form-harici-otomatik', 'okut-kurum-kodu'],
      body: [
        ['p', 'Her öğrencinin numarasını elle kodlamak zaman alır. **Kodlu baskı**, tanıtılmış harici formun üzerine bilgileri **dolu baloncuk** olarak bastırır; öğrenci yalnızca cevaplarını işaretler.'],
        ['steps', [
          ['Kayıtlı formun yanındaki [[Kodlu baskı]]’ya basın'],
          ['Öğrencileri seçin', 'Okul/sınıf süzgeci, arama ve “Görünenleri seç” ile. Doldurulacak alanları seçin: öğrenci no, kurum kodu, ad-soyad, kitapçık.'],
          ['Kâğıdı ve tarama çözünürlüğünü seçin', 'A4/A3/Letter ya da özel; boş formun tamamı taranmışsa dpi “0” bırakılır.'],
          ['**Hizalama sayfasıyla** deneyin', 'Düz kâğıda %100 ölçekle basıp gerçek formun üstüne koyun, ışığa tutun: kırmızı halkalar form baloncuklarının üstüne gelmeli. Kayma varsa mm kaydırma ve % ölçek girin; tutunca [[Ayarı şablona kaydet]].'],
          ['[[Seçilenler için yazdır]]', 'Her öğrenci ayrı sayfa; yalnızca seçili alanların baloncukları basılır.']
        ]],
        ['warn', 'Yazdırırken ölçek **%100 / Gerçek boyut**, kenar boşluğu **yok** olsun.'],
        ['info', 'Yalnızca otomatik tanıtılan (harici) formlarda vardır. Hazır katalog formlarında kişiye özel baskı {{Formlar → Form tasarla ve yazdır}} içindedir.']
      ]
    },
    {
      id: 'form-esle', cat: 'formlar', title: 'Formla eşleme: formdaki satır ≠ sınavdaki soru', aud: 'ogretmen', kw: 'formla eşleme ders blok başlangıç satırı soru sayısı farklı kullanılmayan satır',
      sum: 'Formda 20 satır varken sınavda 10 soru varsa dersleri bloklara siz yerleştirirsiniz.',
      go: { view: 'exams', newExam: true, label: 'Yeni sınav penceresini aç' }, see: ['sinav-yeni', 'sinav-anahtar', 'form-harici-otomatik'],
      body: [
        ['p', 'Yayınevi formlarında her ders genelde aynı satır sayısını taşır; sınavınız ise farklı olabilir (Türkçe 10, Din 5, Matematik 21…). Sistem bunu birebir tutmasa da okur.'],
        ['ul', [
          'Cevap anahtarını **ders ders** girin (örn. `ABCDABCDAB`); iptal soru için `*`, tanımsız için `.`.',
          'Form şablonu seçilince **Formla eşleme** tablosu çıkar: her sınav dersi formdaki bir bloğa ve o bloğun bir başlangıç satırına yerleşir. Varsayılan otomatiktir; gerekirse elle seçin, “Hepsini otomatiğe çevir” ile sıfırlayın.',
          'Bloktaki **kullanılmayan satırlar okunmaz**. Sınav derslerinin sığmadığı eşleme kaydedilemez; nedeni yazılır.',
          'Okutmada cevaplar dersine göre ayrılır; ders D/Y/B/net, sıralama ve karne buna göre çıkar.'
        ]]
      ]
    },

    /* ================================================================ 6. SINAV */
    {
      id: 'sinav-yeni', cat: 'sinav', title: 'Yeni sınav tanımlama: adım adım', aud: 'ogretmen', kw: 'sınav tanımla oluştur yeni sınav deneme ad tarih kapsam ders katsayı puan optik form durum',
      sum: 'Sınav adı, kapsam, puanlama, dersler, cevap anahtarı ve optik form tek pencerede.',
      go: { view: 'exams', newExam: true, label: 'Yeni sınav penceresini aç' }, see: ['sinav-anahtar', 'sinav-puan', 'sinav-durum', 'sinav-kisisel', 'form-esle'],
      body: [
        ['steps', [
          ['{{Sınavlar}} ekranında [[+ Yeni sınav]]’a basın'],
          ['**Sınav adı**, **Tarih** ve **Kapsam**', 'Kapsam listesi rolünüze göre dolar: **öğretmen ve okul yöneticisi** yalnızca kendi okulu için sınav açar; **ilçe yetkilisi** okul ya da ilçe; **il yetkilisi** okul, ilçe ya da il; **sistem yöneticisi** ayrıca tüm okullar için. Aynı sınavı kapsamdaki okulların hepsi okutur, sonuçlar tek havuzda toplanır. Öğretmenin açtığı sınav **kişiseldir** ((sinav-kisisel|ayrıntı)).'],
          ['**Puanlama**: [[Hazır ayar]], [[Şık sayısı]], [[Net kuralı]], [[Puan yöntemi]]', '[[Hazır ayar]] listesinden LGS, TYT gibi bir program seçerseniz dersler, katsayılar ve puan ayarı kendiliğinden dolar. ((sinav-puan|Puan yöntemleri))'],
          ['**Ders / bölümler ve katsayılar**', 'Ders adı, soru sayısı ve katsayı. Soru sayıları form düzenindeki sayılarla tutarlı olmalıdır.'],
          ['**Kitapçıklar ve cevap anahtarı**', '[[Kitapçık türleri (virgülle)]] alanına A,B gibi yazın (kitapçık yoksa boş); her ders için doğru şıkları girin. ((sinav-anahtar|Cevap anahtarı))'],
          ['**Optik form**: [[Optik form (okuma şablonu)]] ve [[Durum]]', 'Hazır form ya da kayıtlı şablonlarınızdan birini seçin; [[Dersleri bu formdan al]] dersleri şablondan getirir.'],
          ['İsteğe bağlı iki kutuyu düşünün', 'Okul kullanıcıları cevap anahtarını görsün (okutmada D/Y/B gösterilir) ve sonuçlar öğrenci/veli sorgulamasına açık olsun.'],
          ['[[Kaydet]]']
        ]],
        ['warn', 'Sınav adı boşsa ya da kapsam seçilmediyse kayıt yapılmaz (“Kapsam seçin”: önce {{Yönetim → Okullar}} altında okul bulunmalı). Bölüm adları boş olamaz.'],
        ['tip', 'Sınavı listeden [[Düzenle]] ile değiştirebilir, [[Sil]] ile silebilirsiniz; **silinen sınavın tüm sonuçları da silinir** (geri alınamaz). Düzenleme ve silme yalnızca sınavı açan kişiye (ve sistem yöneticisine) açıktır. Okutma başladıktan sonra cevap anahtarını değiştirirseniz sonuçlar yeni anahtara göre yeniden hesaplanır.']
      ]
    },
    {
      id: 'sinav-anahtar', cat: 'sinav', title: 'Cevap anahtarı girme', aud: 'ogretmen', kw: 'cevap anahtarı doğru şık kitapçık iptal soru tanımsız ders ders yapıştır toplu',
      sum: 'Her dersin doğru şıkları kendi kutusuna, kitapçık başına yazılır.',
      go: { view: 'exams', newExam: true, label: 'Yeni sınav penceresini aç' }, see: ['sinav-yeni', 'form-esle'],
      body: [
        ['ul', [
          'Anahtar **ders ders** girilir: her dersin adıyla bir kutusu vardır; örn. 10 soruluk ders için `ABCDABCDAB`. Kutunun yanında `10/10 ✓` gibi bir sayaç harf sayısını denetler (eksikse “eksik”, fazlaysa “fazla” yazar).',
          'Geçerli harfler, seçtiğiniz **Şık sayısı**na göredir (5 şıkta A–E). Boşluk, virgül, satır sonu gibi karakterler **kendiliğinden temizlenir**; küçük harf yazabilirsiniz.',
          '**İptal edilen soru** için `*` yazın: o soru **herkese doğru** sayılır (net ve puana doğru olarak eklenir); karne ve veli ekranında “Hesaba katılmadı / iptal” görünür.',
          'Cevabı tanımsız soru için `.` (nokta) yazın.',
          'Kitapçık türleri varsa ([[Kitapçık türleri (virgülle)]], en çok 6) her kitapçığın anahtarı ayrı kartta girilir; okutmada formdan okunan kitapçığa göre puanlanır.'
        ]],
        ['tip', 'Anahtarı **tek seferde** yapıştırmak için kartın altındaki [[Hepsini tek seferde yapıştır]] bölümünü açın: art arda yazılmış harfler derslerin soru sayısına göre sırayla bölünür; ya da her dersi ayrı satıra yazıp yapıştırın.'],
        ['warn', 'Harf sayısı dersin soru sayısına eşit olmazsa sınav kaydedilirken uyarı alırsınız. Okutma başladıktan sonra anahtarı değiştirirseniz sonuçlar yeni anahtara göre yeniden hesaplanır.']
      ]
    },
    {
      id: 'sinav-puan', cat: 'sinav', title: 'Puan yöntemleri ve net kuralı', aud: 'ogretmen', kw: 'puan net yanlış katsayı standart puan lgs tyt yöntem a b çarpan 100 500 ağırlıklı',
      sum: 'Net kuralı ve üç puan yöntemi: hangisi ne işe yarar?',
      go: { view: 'exams', newExam: true, label: 'Yeni sınav penceresini aç' }, see: ['sinav-yeni', 'sozluk'],
      body: [
        ['h', 'Net kuralı'],
        ['p', '[[Net kuralı]] yanlışların doğruyu ne kadar götürdüğünü belirler: “Yanlış doğruyu götürmez”, “4 yanlış 1 doğruyu götürür (¼)”, “3 yanlış 1 doğruyu götürür (⅓)”, “2 yanlış 1 doğruyu götürür (½)”. **Net = doğru − yanlış × katsayı.** Boş bırakılan ceza almaz.'],
        ['h', 'Puan yöntemi'],
        ['table', ['[[Puan yöntemi]] seçeneği', 'Nasıl hesaplanır?', 'Ne zaman?'], [
          ['**Ağırlıklı net → 100 üzerinden puan**', 'Her dersin neti katsayısıyla çarpılıp toplanır, olası en yüksek değere bölünüp 100 ile çarpılır.', 'Konu testi, kısa yazılı, okul içi deneme.'],
          ['**Standart puan → 100–500 (LGS/YKS tarzı)**', 'Her ders için sınav geneline göre standart puan (ortalama 50, sapma 10) bulunur, katsayıyla toplanır; en düşük sonuç [[En düşük puan]], en yüksek sonuç [[En yüksek puan]] olacak biçimde ölçeklenir.', 'LGS, TYT, AYT gibi sıralama sınavları. Katılımcı sayısı arttıkça anlamlılaşır; ilçe/il havuzunda en doğrusudur.'],
          ['**Ortalama standart puan (a + b·ort.)**', 'Katsayılı ortalama standart puan **b** ile çarpılıp [[a (sabit)]] eklenir.', 'Kendi puan ölçeğinizi kurmak isterseniz.']
        ]],
        ['tip', '[[Hazır ayar]] listesinden (LGS, TYT, AYT Sayısal/Eşit Ağırlık/Sözel, genel deneme, kısa yazılı…) bir program seçerseniz dersler, katsayılar, şık sayısı, net kuralı ve puan yöntemi **tek seferde** dolar. AYT için katsayıları yine de kontrol edin.'],
        ['info', 'Ders katsayılarını {{Yeni sınav → Ders / bölümler ve katsayılar}} tablosundan değiştirebilirsiniz.']
      ]
    },
    {
      id: 'sinav-durum', cat: 'sinav', title: 'Sınav durumu ve kapsam: kim görür, kim okutur?', aud: 'ogretmen', kw: 'durum taslak açık kapalı okutmaya açık kapsam okul ilçe il kimler okutur yetki',
      sum: 'Okutmaya açık, taslak (okutulamaz), kapalı; kapsam kimlerin sınava katıldığını belirler.',
      go: { view: 'exams', label: 'Sınavlar ekranını aç' }, see: ['sinav-yeni', 'sinav-kisisel'],
      body: [
        ['table', ['[[Durum]]', 'Anlamı'], [
          ['**Okutmaya açık**', 'Okut ekranında seçilebilir; sonuçlar toplanır.'],
          ['**Taslak (okutulamaz)**', 'Hazırlık aşaması: Okut ekranında çıkmaz, veli sorgulamasında görünmez.'],
          ['**Kapalı**', 'Sınav bitti; yeni okutma yapılamaz, sonuçlar ve analiz görülür.']
        ]],
        ['h', 'Kapsam'],
        ['ul', [
          '**Tek okul sınavı** (okul yöneticisinin açtığı): o okulun okul yöneticisi okutur; okulun öğretmenleri sonuçları **yalnızca görüntüler**, okutamaz.',
          '**İlçe / il sınavı** (yetkilinin açtığı): kapsamdaki okulların yöneticileri aynı sınavı okutur; sonuçlar tek havuzda toplanır, okul ve ilçe sıralaması çıkar ((sonuc-okul|Okul karşılaştırma)).',
          '**Kişisel sınav** ((sinav-kisisel|öğretmenin kendi sınavı)): yalnızca sahibi ve okulun yöneticisi görür; **okutmayı yalnızca sahibi yapar**.'
        ]]
      ]
    },
    {
      id: 'sinav-kisisel', cat: 'sinav', title: 'Öğretmenin kişisel sınavı', aud: 'ogretmen', kw: 'kişisel sınav öğretmen kendi sınavı gizli kimler görür',
      sum: 'Öğretmenin oluşturduğu sınavı yalnızca kendisi ve okul yöneticisi görür.',
      see: ['sinav-yeni', 'sinav-durum'],
      body: [
        ['table', ['', 'Kişisel sınav (öğretmenin açtığı)', 'Okul / ilçe / il sınavı (yöneticinin açtığı)'], [
          ['**Kim görür?**', 'Sahibi ve okulun yöneticisi (aynı okuldaki diğer öğretmenler, ilçe/il yetkilileri göremez)', 'Kapsamdaki okulların kullanıcıları'],
          ['**Kim okutur?**', 'Yalnızca sahibi (okul yöneticisi de okutamaz)', 'Okul yöneticisi ve üst yetkililer; **öğretmen okutamaz**, yalnızca görüntüler'],
          ['**Kim düzenler/siler?**', 'Yalnızca sahibi (ve sistem yöneticisi)', 'Yalnızca sınavı açan kişi (ve sistem yöneticisi)']
        ]],
        ['tip', 'Okul çapında ortak bir deneme yapacaksanız sınavı okul yöneticisi tanımlar ve okutur; öğretmenler sonuçları ve analizi izler. Kendi sınıfınıza yönelik sınavlar için ise kendi kişisel sınavınızı açın.']
      ]
    }
  ]
});
