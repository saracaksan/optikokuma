/* kilavuz-icerik-2.js — KULLANIM KILAVUZU İÇERİĞİ, 2. bölüm (biçim için kilavuz-icerik.js başlığına bakın).
 * Kategoriler: okutma, dis, sonuc, analiz, iletisim, yonetim, yardim. [[ ]] içindeki her ad kodda bulunmalıdır
 * (testler/test_guide_labels.js denetler). */
'use strict';

Guide.add([
  /* ================================================================ 7. OKUTMA */
  {
    id: 'okut-adimlar', cat: 'okutma', title: 'Optik okutma: baştan sona adımlar', aud: 'ogretmen', kw: 'okut tara oku form sınav seç okul seç kuyruk gönder dosya kamera nasıl okutulur',
    sum: 'Sınavı seçin, formları verin, uyarıları gözden geçirin, kuyruğa ekleyin, gönderin.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['okut-dosya', 'okut-kamera', 'okut-inceleme', 'kuyruk', 'okut-cikar', 'okut-sorun'],
    body: [
      ['flow', [
        ['Sınav ve okul', 'Okut ekranında sınavı ve okulu seçin.'],
        ['Form okutma', 'Dosya/PDF ya da fotoğraf ya da canlı kamera.'],
        ['Kontrol', 'Her form ✓ (hatasız) ya da ⚠ (kontrol gerekli) olur; ⚠ olanları inceleyin.'],
        ['Kuyruğa ekleme', 'Hatasız formlar tek dokunuşla kuyruğa eklenir.'],
        ['Gönderme', 'Kuyruk internet varken sunucuya gönderilir.']
      ]],
      ['steps', [
        ['{{Okut}} ekranını açın', 'Menünün ilk sekmesidir.'],
        ['[[Sınav]] listesinden sınavı seçin', 'Listede yalnızca **okutmaya açık** ve sizin **okutma yetkiniz olan** sınavlar çıkar. Öğretmenseniz kendi kişisel sınavınız; okul yöneticisi ve üst yetkililer okul/ilçe/il sınavları. Sınavı göremiyorsanız durumunu ((sinav-durum|Sınav durumu)) ve yetkinizi kontrol edin.'],
        ['[[Okul]]’u seçin', 'Okul yöneticisi ve öğretmende kendi okulunuz hazır gelir. İlçe/il yetkilisi okulu seçer ya da **⚡ Formdaki kurum kodundan otomatik** seçeneğini kullanır ((okut-kurum-kodu|Kurum koduyla eşleme))'],
        ['Formları verin', 'Kutuya dosya bırakın, [[Dosya seç]] ya da [[Fotoğraf çek]] kullanın; köşe karesi olan formlarda [[📷 Canlı kamera (otomatik okuma)]] daha hızlıdır. ((okut-dosya|Dosya ve PDF)), ((okut-kamera|Canlı kamera))'],
        ['Sonuçları kontrol edin', 'Üstteki sayaçlar okunan, hatasız, kontrol gerekli, okunamayan ve kuyruğa eklenen form sayısını gösterir. ⚠ satırlarda uyarı nedeni yazar; [[İncele]] ile açıp düzeltin ((okut-inceleme|İnceleme))'],
        ['[[Hatasız olanları kuyruğa ekle]]’ye basın', 'Satır satır eklemek için incelemedeki [[Onayla ve kuyruğa ekle]] kullanılır.'],
        ['Kuyruktan gönderin', '{{Kuyruk}} ekranı bekleyenleri sunucuya yollar; internet varsa kendiliğinden de gider. ((kuyruk|Kuyruk))']
      ]],
      ['tip', 'İnternet olmasa da okutabilirsiniz: okunan kâğıtlar cihazda saklanır, bağlantı gelince gönderilir. Okuma işlemi cihazda yapılır; görüntü dışarı çıkmaz, sunucuya yalnızca işaretlenen cevaplar gider.'],
      ['info', 'Sınav seçilince panelde formun adı, soru/şık sayısı, anahtarın tanımlı olup olmadığı, “Sayfada N form” ve ad-soyadın formdan okunup okunmadığı yazar. Bilgi sınavınızla uyuşmuyorsa okutmadan önce sınavı düzeltin.']
    ]
  },
  {
    id: 'okut-dosya', cat: 'okutma', title: 'Dosya, PDF ve fotoğraf ile okutma', aud: 'ogretmen', kw: 'pdf jpg png tarama tarayıcı dosya yükle çok sayfalı toplu fotoğraf çek dpi',
    sum: 'Tarayıcıdan (PDF) ya da telefon fotoğrafıyla; çok sayfalı PDF sayfa sayfa okunur.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['okut-adimlar', 'okut-kamera', 'okut-sorun'],
    body: [
      ['p', 'Formları sınıf tarayıcısıyla toplu taratabilir, ya da telefonla çekebilirsiniz. Desteklenen biçimler **PDF, JPG ve PNG**. Birden çok dosya ya da çok sayfalı PDF seçebilirsiniz; her sayfa ayrı form olarak okunur. Bir sayfada birden çok form varsa (2’li/4’lü baskı) panelde “Sayfada N form” yazar ve hepsi ayrı ayrı okunur.'],
      ['table', ['Yol', 'Ne zaman?', 'İpucu'], [
        ['**Tarayıcı + PDF** [[Dosya seç]]', 'Çok sayıda form; en güvenilir yol', '200–300 dpi, renkli ya da gri tonlama; formlar düz yerleşsin, sayfa kaymasın. Çok silik baskıda 300 dpi deneyin.'],
        ['**Fotoğraf** [[Fotoğraf çek]]', 'Birkaç form; tarayıcı yok', 'Form dik, düz ve gölgesiz; 4 köşe ve üstteki siyah çubuk görünsün. Flaşı kapatın, parlama olmasın.'],
        ['**Canlı kamera**', 'Çok sayıda form, telefon kamerası', 'Yalnızca köşe karesi olan formlarda; form kameraya tutulunca kendiliğinden okur. ((okut-kamera|Ayrıntı))']
      ]],
      ['warn', 'Yan çizgili formlarda (köşe karesi yok) fotoğraf **dik ve düz** çekilmelidir; kenar kesik ya da eğikse sistem formu “yan çizgi sayısı şablondan farklı” diye işaretler. Mümkünse tarayıcıdan okutun.'],
      ['tip', 'Tarayıcıdan gelen sayfalar ters ya da yan ise [[↻ Yönü değiştir]] (incelemede) ya da satırdaki [[↻ Yön]] düğmesiyle çevirin; köşe karesi olan formların yönü kendiliğinden bulunur.']
    ]
  },
  {
    id: 'okut-kamera', cat: 'okutma', title: 'Canlı kamera ile okutma', aud: 'ogretmen', kw: 'kamera canlı otomatik okuma telefon fener izin otomatik kuyruğa ekle',
    sum: 'Formu kameraya tutun; 4 köşeyi görünce kendiliğinden okur, doğru/yanlışı hemen gösterir.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['okut-dosya', 'okut-inceleme', 'okut-sorun'],
    body: [
      ['steps', [
        ['Okut ekranında sınavı ve okulu seçin, [[📷 Canlı kamera (otomatik okuma)]] düğmesine basın', 'İlk seferde tarayıcı kamera izni ister; **İzin ver** deyin.'],
        ['Formu düz bir zemine koyup kameraya tutun', 'Dört köşe karesi ve üstteki siyah çubuk görünsün, gölge düşmesin. Karanlıkta fener düğmesi vardır; ön/arka kamera değiştirilebilir.'],
        ['Okunan formun sonucunu görün', 'Doğru/yanlış/boş ve net hemen kartta çıkar. Sorunsuz formlar, [[Sorunsuz formları otomatik kuyruğa ekle]] işaretliyse kendiliğinden kuyruğa girer.'],
        ['Sorunlu formlar için kartta seçin', '[[Kuyruğa ekle]] (olduğu gibi kabul), [[Düzelt / incele]] (inceleme penceresini açar) ya da [[At]] (formu hiç eklemeden bırak).'],
        ['Bitince [[Kapat]]’a basın', 'Okutulanlar kuyruktadır; {{Kuyruk}} ekranından gönderilir.']
      ]],
      ['warn', 'Canlı kamera **yalnızca köşe karesi olan** formlarda çalışır. Yan çizgili formlar için “Köşe karesi içermiyor” uyarısı çıkar; [[Fotoğraf çek]] ya da [[Dosya seç]] kullanın.'],
      ['info', 'Kamera açılmazsa: tarayıcının adres çubuğundan bu site için kamera iznini açın ve yeniden deneyin; kamerayı başka bir uygulama kullanıyor olabilir. “Okunamadı” kartında [[Tekrar dene]] seçilir.']
    ]
  },
  {
    id: 'okut-inceleme', cat: 'okutma', title: 'Okunan formu inceleme ve düzeltme', aud: 'ogretmen', kw: 'inceleme düzelt öğrenci no elle işaretle kitapçık çift işaret zayıf işaret baloncuk soru cevap değiştir',
    sum: 'Uyarılı formda öğrenci no, kitapçık ve cevapları kendiniz düzeltirsiniz.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['okut-sorun', 'okut-cikar', 'okut-adimlar'],
    body: [
      ['p', 'Okuma listesinde ⚠ işaretli formun satırındaki [[İncele]] düğmesi **Form incelemesi** penceresini açar: form görüntüsü, okunan öğrenci no ve kitapçık, her sorunun işareti ve hesaplanan D/Y/B/net birlikte görünür. Düzeltmeyi bu pencerede yaparsınız.'],
      ['steps', [
        ['Uyarının nedenini okuyun', 'Pencerenin üstünde sorun yazar (ör. “3 soruda birden fazla işaret”, “Öğrenci listede yok”, “Kitapçık türü işaretlenmemiş”). Tüm uyarılar için ((okut-sorun|Uyarılar ve çözümleri))'],
        ['Öğrenci numarasını ve kitapçığı kontrol edin', 'Yanlış okunduysa kutuya doğrusunu yazın; numara listede bulunursa ad kendiliğinden gelir.'],
        ['Soruları kâğıtla karşılaştırın', 'Görüntüde işaretlenen baloncuklar renklidir. Bir sorunun ızgarasında doğru şıka dokunarak cevabı değiştirin; klavyede harf tuşları (A, B, C…) seçili soruya yazar ve sonrakine geçer.'],
        ['[[Onayla ve kuyruğa ekle]]’ye basın', 'Form düzeltmenizle kuyruğa girer. Vazgeçerseniz [[Kapat]]; formu tamamen çıkarmak için [[Bu formu at]].']
      ]],
      ['tip', 'Köşe/yan çizgi doğru bulunamadıysa formda [[Köşeleri elle işaretle]] ile köşeleri kendiniz gösterin; ters taranmışsa [[↻ Yönü değiştir]] kullanın. Düzeltmeden sonra form yeniden okunur.'],
      ['warn', 'İncelemede cevabı **kâğıda bakarak** düzeltin; “doğru şık” yerine “öğrencinin işaretlediği şık” esastır. Sistem cevap anahtarına göre yön vermez, yalnızca işareti okur.']
    ]
  },
  {
    id: 'okut-hazir-form', cat: 'okutma', title: 'Dışarıdan hazır optik formu okutma', aud: 'ogretmen', kw: 'harici dış hazır form okutma yayınevi basılı optik şablon tanıtılmış kayıtlı ad soyad numara kurum kodu',
    sum: 'Önce boş formu bir kez tanıtın, sonra sınavda şablon olarak seçip toplu okutun.',
    go: { view: 'forms', tab: 'auto', label: 'Tanıtma ekranını aç' }, see: ['form-harici-otomatik', 'form-esle', 'okut-kurum-kodu', 'yon-ogrenciler', 'okut-sorun'],
    body: [
      ['p', 'Elinizdeki basılı optik form başka bir kurumdan geliyorsa (yayınevi, dershane, daha önce kullandığınız form) üç aşamada okutulur:'],
      ['flow', [
        ['Bir kez tanıtın', '{{Formlar → Harici formu otomatik tanıt}}: boş formu yükleyin, onaylayın, kaydedin.'],
        ['Sınavı tanımlayın', 'Sınav penceresinde **Optik form** olarak kayıtlı şablonu seçin; dersleri forma eşleyin; anahtarı girin.'],
        ['Okutun', 'Doldurulmuş formları dosya/fotoğrafla okutun; uyarıları inceleyin, kuyruğa ekleyip gönderin.']
      ]],
      ['steps', [
        ['Formu tanıtın ve işaretli bir formla deneyin', '((form-harici-otomatik|Dışarıdan hazır formu tanıtma)) bölümünün bütün adımları; özellikle [[İşaretli bir formla dene]].'],
        ['{{Sınavlar → Yeni sınav}} penceresinde [[Optik form (okuma şablonu)]] listesinden şablonunuzu seçin', 'Soru sayısı formdan farklıysa [[Dersleri bu formdan al]] ve **Formla eşleme** tablosuyla dersleri bloklara yerleştirin. ((form-esle|Formla eşleme))'],
        ['Okut ekranında sınavı seçin ve formları okutun', 'Panelde şablonun adı ve “Ad-soyad formdan okunur” gibi bilgiler görünür.'],
        ['**Öğrenci numarası**', 'Formdaki numara hanesinden okunur. Okulun listesinde varsa ad kendiliğinden gelir; yoksa uyarı verir. Numara hiç işaretlenmemişse incelemede elle yazın.'],
        ['**Ad ve soyad**', 'Formda harf ızgarası varsa ad-soyad okunur ve listedeki öğrenciyle karşılaştırılır; uyuşmazlıkta “numara yanlış işaretlenmiş olabilir” uyarısı çıkar. Okul listesinde olmayan öğrenciler formdaki adla görünür; [[Formdaki öğrencileri listeye ekle]] düğmesi (okul yöneticisi ve üstü) onları öğrenci listesine ekler.'],
        ['**Okul**', 'Formda kurum kodu hanesi varsa okul kendiliğinden belirlenir ((okut-kurum-kodu|Kurum koduyla eşleme)); yoksa okulu listeden seçersiniz.'],
        ['Hatasız olanları kuyruğa ekleyip gönderin']
      ]],
      ['tip', 'İlk okutmada formu 3–5 öğrenciyle deneyin; kâğıttaki işaretlerle ekrandaki cevapları karşılaştırın. Sorun yoksa kalanını toplu okutun. Kayma varsa şablonu ((form-duzenleyici|düzenleyiciyle)) düzeltin.'],
      ['info', 'Köşe karesi ve yan çizgi olmayan formlar için ((form-elle|Elle tanımla)) yolu vardır. Her öğrenci için numarayı elle kodlamak istemiyorsanız ((form-kodlu|Kodlu baskı)) ile numarayı forma bastırabilirsiniz.']
    ]
  },
  {
    id: 'okut-kendi-form', cat: 'okutma', title: 'Kendi formlarınızı (uygulamadan bastığınız) okutma', aud: 'ogretmen', kw: 'kendi form tasarla yazdır okutma kimlik kodu yanlış form hazır şablon kişiye özel',
    sum: 'Uygulamadan yazdırdığınız formlar kendini tanıtır: yanlış formu da yakalar.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['form-katalog', 'form-tasarla', 'okut-adimlar'],
    body: [
      ['p', 'Hazır şablonlardan ya da {{Formlar → Form tasarla ve yazdır}} ile bastığınız formların sağ altında bir **form kimlik kodu** (siyah kareler) bulunur. Okutma bu koddan formun hangi form olduğunu bilir; ayrıca bir şey tanıtmanız gerekmez.'],
      ['steps', [
        ['Formu yazdırın', 'Ölçek **%100 / gerçek boyut**, kenar boşluğu yok. ((form-katalog|Hazır şablonlar)) ya da ((form-tasarla|Form tasarla))'],
        ['Sınavı tanımlarken aynı formu seçin', '[[Optik form (okuma şablonu)]] listesinde hazır formu ya da kayıtlı şablonunuzu seçin.'],
        ['Doldurulan formları okutun', '((okut-adimlar|Okutma adımlarını)) izleyin.']
      ]],
      ['info', 'Yanlış formu karıştırırsanız sistem uyarır: “Bu form seçili sınavın form türüyle uyuşmuyor” ya da “şu açık sınavda kullanılıyor: …”. O formu başka sınav seçerek okutun.'],
      ['tip', 'Kişiye özel basılan formlarda öğrencinin adı ve numarası baskıda dolu gelir; öğrenci yalnızca cevaplarını işaretler, numara hatası olmaz.']
    ]
  },
  {
    id: 'okut-kurum-kodu', cat: 'okutma', title: 'Okul seçimi ve kurum koduyla otomatik eşleme', aud: 'yetkili', kw: 'kurum kodu okul otomatik ilçe il birden çok okul eşleşme',
    sum: 'İlçe/il sınavlarında her formun okulunu formdaki kurum kodu belirler.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['okut-adimlar', 'sinav-durum', 'yon-okullar'],
    body: [
      ['p', 'Okul yöneticisi ve öğretmen kendi okulunun formlarını okutur; okul sabittir. İlçe/il yetkilisi ise farklı okulların formlarını aynı yığında okutabilir: bunun için [[Okul]] listesinden **⚡ Formdaki kurum kodundan otomatik** seçeneğini seçin.'],
      ['ul', [
        'Her formdaki **kurum kodu hanesi** okunur ve okulun kayıtlı kurum koduyla eşleştirilir; yetkili olduğunuz okulların öğrenci listeleri gerektikçe yüklenir.',
        'Kurum kodu işaretlenmemişse “okul belirlenemedi” uyarısı çıkar; incelemede okulu elle seçin.',
        'Kodu yetkili olduğunuz okullar arasında yoksa ya da birden çok okul eşleşiyorsa uyarı verir; formu ilgili okul seçili hâlde okutun.',
        'Formda kurum kodu alanı yoksa (bazı harici formlar) okulu listeden seçmeniz gerekir.'
      ]],
      ['warn', 'Okulların **Kurum kodu** alanı doğru girilmiş olmalıdır; yanlış ya da tekrar eden kod yanlış eşleşmeye yol açar. {{Yönetim → Okullar}} ekranında kontrol edin.']
    ]
  },
  {
    id: 'kuyruk', cat: 'okutma', title: 'Kuyruk: okutmaları sunucuya gönderme', aud: 'ogretmen', kw: 'kuyruk gönder çevrimdışı bekliyor hata gönderildi şimdi gönder sunucu senkron internet',
    sum: 'Okutmalar önce cihazda bekler; bağlantı varken sunucuya gönderilir.',
    go: { view: 'queue', label: 'Kuyruk ekranını aç' }, see: ['okut-cikar', 'ayarlar', 'okut-adimlar'],
    body: [
      ['p', '**Gönderim kuyruğu** ekranı, okutup kuyruğa eklediğiniz formları sınav sınav gruplar ve her biri için durumu gösterir. Üstteki sayaçlar “gönderilmeyi bekliyor”, “hatalı” ve “gönderildi” adedini verir.'],
      ['table', ['Durum', 'Anlamı', 'Ne yapmalı?'], [
        ['**Bekliyor**', 'Cihazda, henüz gönderilmedi.', '[[Şimdi gönder]] ile gönderin ya da bağlantı gelince kendiliğinden gider.'],
        ['**Hata**', 'Sunucu bu kaydı reddetti; neden satırda yazar (ör. yetkiniz yok, sınav kapalı).', 'Nedeni giderin (sınavın durumu, yetki, öğrenci no), formu yeniden okutun; ardından [[Şimdi gönder]].'],
        ['**Gönderildi**', 'Sunucuya yazıldı.', 'Listeyi sadeleştirmek için [[Gönderilenleri listeden temizle]].']
      ]],
      ['ul', [
        '**İnternet yokken** okutma yapabilirsiniz; kayıtlar cihazda güvenle bekler. Çevrimdışıyken ekranda uyarı görünür.',
        '[[Çevrimiçi olunca kuyruğu otomatik gönder]] seçeneği {{Ayarlar → Bağlantı ve senkronizasyon}} bölümündedir; kapatırsanız yalnızca [[Şimdi gönder]] ile gider.',
        'Aynı sınavda **aynı okul ve numaralı** öğrenci iki kez okutulursa kuyrukta ve sunucuda sonuncusu önceki kaydın **yerine geçer**; tekrar sayılmaz.',
        'Çıkış yapmadan önce kuyruğun boş olduğundan emin olun: bekleyen kayıt cihazda kalır ama gönderilmesi için yeniden giriş gerekir.'
      ]]
    ]
  },
  {
    id: 'okut-cikar', cat: 'okutma', title: 'Hatalı okutmayı düzeltme, çıkarma, sınavdan atma', aud: 'ogretmen', kw: 'sil çıkar at hatalı yanlış okutma geri al kaldır yanlış öğrenci düzelt sınavdan çıkar yeniden okut',
    sum: 'Hangi aşamada olduğunuza göre: at, kuyruktan sil, yeniden okut.',
    go: { view: 'queue', label: 'Kuyruk ekranını aç' }, see: ['okut-inceleme', 'kuyruk', 'sinav-yeni'],
    body: [
      ['table', ['Form şu an…', 'Ne yaparsınız?'], [
        ['**Okuma listesinde** (kuyruğa eklenmedi)', 'Satırdaki **✕** ile ya da [[İncele]] → [[Bu formu at]] ile çıkarın. Tüm listeyi boşaltmak için [[Listeyi temizle]].'],
        ['**Canlı kamera kartında**', '[[At]] düğmesi formu hiç eklemeden bırakır; sonra yeniden okutabilirsiniz.'],
        ['**Kuyrukta**, gönderilmedi', 'Satırın sonundaki **✕** ([[Kuyruktan sil]]) kaydı siler. “Gönderilmemiş veri kaybolur” uyarısını onaylayın.'],
        ['**Gönderildi** ve yanlış çıktı', 'Aynı öğrencinin **doğru formunu yeniden okutup gönderin**: aynı sınav + okul + numaralı kayıt **güncellenir**, çift kayıt olmaz. Sonuçlar, sıralamalar ve analiz yeni değere göre hesaplanır.'],
        ['**Yanlış numarayla** gönderilmiş', 'Yeniden okutmak doğru numaraya yeni bir kayıt açar; yanlış numaralı kayıt kalır. Arayüzde tek tek sonuç silme düğmesi **yoktur**; kaydı silmek için sistem yöneticisine başvurun (sonuç E-Tablodaki sınavın sayfasından silinir).'],
        ['**Sınavın tamamı** hatalı', '{{Sınavlar}} ekranında sınavı [[Sil]]: sınav ve **bütün sonuçları** silinir (geri alınamaz). Sonra sınavı yeniden tanımlayın.']
      ]],
      ['tip', 'Gönderimden önce incelemede düzeltmek en kolay yoldur. Şüpheli formları (⚠) hemen gözden geçirip yalnızca hatasızları ve düzeltilenleri gönderin.'],
      ['warn', 'Cevap anahtarı yanlış girildiyse okutmayı silmenize gerek yok: anahtarı sınavdan düzeltin, sonuçlar yeni anahtara göre yeniden hesaplanır.']
    ]
  },
  {
    id: 'okut-sorun', cat: 'okutma', title: 'Okutma uyarıları ve çözümleri', aud: 'ogretmen', kw: 'uyarı hata okunamadı kontrol gerekli kayık silik çift işaret kitapçık öğrenci listede yok sorun giderme',
    sum: 'Listede çıkan her uyarının anlamı ve ne yapılacağı.',
    go: { view: 'scan', label: 'Okut ekranını aç' }, see: ['okut-inceleme', 'okut-dosya', 'okut-kamera'],
    body: [
      ['table', ['Uyarı', 'Anlamı / çözüm'], [
        ['Öğrenci listede yok', 'Okunan numara okulun listesinde bulunmuyor. Numarayı incelemede düzeltin ya da öğrenciyi ((yon-ogrenciler|listeye ekleyin)). Formdaki adla da kabul edebilirsiniz.'],
        ['Formdaki ad-soyad … listedeki öğrenciyle uyuşmuyor', 'Numara yanlış işaretlenmiş olabilir: incelemede numarayı doğru şekilde yazın.'],
        ['Kitapçık türü işaretlenmemiş / Kitapçık çift işaretli', 'İncelemede kitapçığı seçin. Kitapçık yanlışsa puan yanlış anahtarla hesaplanır.'],
        ['N soruda birden fazla işaret', 'Öğrenci iki şık doldurmuş; sistem o soruyu boş sayar. Kâğıtta silinti varsa incelemede doğru şıkkı kendiniz seçin.'],
        ['N soruda zayıf işaret / silinti ya da soluk ikinci işaret', 'Soluk dolgu ya da silinmiş işaret var; ilgili soruları kâğıtla karşılaştırın.'],
        ['Yan çizgi sayısı şablondakinden farklı', 'Formun kenarı kesik ya da eksik görünüyor; taramayı tekrarlayın ya da köşeleri elle işaretleyin.'],
        ['Şablonla örtüşme düşük', 'Form kaymış ya da yanlış şablon seçilmiş olabilir; incelemede baloncuk dairelerinin yerini kontrol edin, gerekirse şablonu düzeltin.'],
        ['Bu form seçili sınavın form türüyle uyuşmuyor', 'Başka bir forma ait kâğıt; doğru sınavı seçerek okutun.'],
        ['Kurum kodu … (işaretlenmemiş / okullar arasında yok / birden fazla okul)', '((okut-kurum-kodu|Kurum koduyla eşleme)) konusuna bakın.'],
        ['Okunamadı / form bulunamadı', 'Köşeler ya da siyah çubuk görünmüyor; daha net, düz ve aydınlık taratın. Telefon fotoğrafında formu masaya düz koyup dik çekin.'],
        ['Aynı numara bu oturumda birden fazla formda', 'İki formda aynı numara işaretlenmiş; birini doğru numarayla düzeltin.']
      ]],
      ['info', 'Uyarılı formu **olduğu gibi** kabul edebilirsiniz; ancak sonuçlar işaretlenen cevaba göre hesaplanır. Önemli sınavlarda ⚠ formların hepsini incelemenizi öneririz.']
    ]
  },

  /* ================================================================ 8. DIŞ SINAV */
  {
    id: 'dis-nedir', cat: 'dis', title: 'Dış sınav nedir, ne işe yarar?', aud: 'ogretmen', kw: 'dış sınav harici sonuç excel yayınevi lgs tyt deneme dışarıdan sonuç aktar analiz',
    sum: 'Başka kurumda yapılan sınavın sonucunu analize katmak için.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['dis-excel', 'dis-satir', 'dis-ekle', 'an-baslangic'],
    body: [
      ['p', 'Okulunuz bir yayınevinin ya da başka bir kurumun deneme sınavına girdiyse sonucu yine de **aynı analizlerde** kullanabilirsiniz. Bu sınavlar “dış sınav”dır: optik okutma gerekmez, hazır sonuç listesi aktarılır. Analizde sistem sınavlarıyla birlikte gelişim, sıralama ve karne üretir; sınavın yanında **Dış · kurum adı** rozeti görünür.'],
      ['table', ['', 'Sistem sınavı', 'Dış sınav'], [
        ['Veri nereden?', 'Optik formdan okutulur', 'Excel/CSV’den, yapıştırarak ya da elle'],
        ['Nerede açılır?', '{{Sınavlar}}', '{{Analiz → + Dış sınav ekle}}'],
        ['Veli sonuç sorgulaması?', 'Evet (sınav açıksa)', 'Hayır; yalnızca analiz ve karnelerde'],
        ['Puan türü', 'Sınavın puan yöntemi', 'Dosyadaki puan (ör. LGS Puanı); sistem puanıyla karıştırılmaz']
      ]],
      ['info', 'Öğretmen yalnızca kendi okulu için ve **kişisel** dış sınav ekler; okul yöneticisi kendi okulu, ilçe/il yetkilisi bölgesindeki okullar için ekler. Okulun genel dış sınavlarını öğretmen yalnızca görüntüler.']
    ]
  },
  {
    id: 'dis-excel', cat: 'dis', title: 'Dış sınavı Excel ya da CSV ile aktarma', aud: 'ogretmen', kw: 'excel şablon csv yükle yapıştır ö.no ders d y n sütun xlsx xls kaynak dosya',
    sum: 'Hazır şablonu doldurun ya da yayınevinden aldığınız listeyi doğrudan yükleyin.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['dis-nedir', 'dis-satir', 'dis-ekle'],
    body: [
      ['steps', [
        ['{{Analiz}} ekranında [[+ Dış sınav ekle]]’ye basın', 'Okulunuzu seçin (okul yöneticisi ve öğretmende kendi okulunuz hazır).'],
        ['Sınav bilgilerini yazın', 'Sınav adı (ör. “DARGE 1. LGS Denemesi”), tarih, [[Yayınevi / kurum]], puan adı ve yanlış kuralı.'],
        ['Dosyayı hazırlayın', 'Hazır şablon için [[Hazır Excel şablonunu indir]]: dersleri ve soru sayılarını seçin (LGS hazırdır), indirilen `.xlsx`’i doldurun. Ya da yayınevinin listesi başlığında **Ö.No** ve ders başına D/Y/N sütunları taşıyorsa doğrudan kullanın.'],
        ['[[Excel / CSV yükle]] ile dosyayı seçin', 'Excel’den kopyaladığınız tabloyu (başlık satırıyla) [[Ya da tabloyu yapıştır]] kutusuna da koyabilirsiniz; ardından [[Çözümle]].'],
        ['Özeti kontrol edin', 'Kaç öğrenci ve ders bulunduğu, öğrenci listesiyle eşleşme ve eksikler yazar. Listede olmayan öğrenci dosyadaki adıyla eklenir ve uyarılır.'],
        ['[[Kaydet ve aktar]]']
      ]],
      ['h', 'Kurallar'],
      ['ul', [
        'Zorunlu tek sütun **Ö.No**’dur. Ad ve sınıf boşsa okulun öğrenci listesinden gelir.',
        '**Net** boşsa D − Y × katsayı ile, **Toplam** boşsa derslerden hesaplanır. Ondalıkta virgül ya da nokta olabilir.',
        '**Dereceler** (sınıf, okul, ilçe, il, genel) isteğe bağlıdır; yoksa okul ve sınıf sırası hesaplanır, ilçe/il/genel hesaplanamaz.',
        'Ders soru sayısı yoksa en yüksek D+Y değerinden tahmin edilir (özette `?` ile işaretlenir; düzeltebilirsiniz).',
        'Aynı Ö.No iki kez varsa sonuncusu geçerlidir. CSV’de ayraç `;`, `,` ya da sekme olabilir.',
        'Eski `.xls` açılmaz: Excel’de “Farklı kaydet → Excel Çalışma Kitabı (.xlsx)” ya da CSV seçin.'
      ]],
      ['tip', 'Bir sınavın iki sınıfı ayrı dosyalardaysa ilkini kaydedin, ikincisini ((dis-ekle|mevcut sınava ekleyin)).']
    ]
  },
  {
    id: 'dis-satir', cat: 'dis', title: 'Dış sınavı satır satır girme ve düzenleme', aud: 'ogretmen', kw: 'satır satır elle gir düzenle öğrenci no net hesaplama dış sınav düzenle sil',
    sum: 'Dosyanız yoksa sonuçları tek tek girin; kayıtlı dış sınavı da buradan düzeltirsiniz.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['dis-excel', 'dis-ekle'],
    body: [
      ['steps', [
        ['[[+ Dış sınav ekle]]’yi açın, sınav bilgilerini ve dersleri tanımlayın'],
        ['[[Satır satır / düzenle]] sekmesine geçin'],
        ['Öğrenci numarasını yazın', 'Ad ve sınıf öğrenci listesinden gelir; D ve Y’yi girince net ve toplam otomatik hesaplanır; **Enter** alt satıra geçer.'],
        ['[[Kaydet ve aktar]]']
      ]],
      ['info', 'Kayıtlı bir dış sınavı değiştirmek için sınav satırındaki [[Düzenle]]’yi (tüm öğrencileriyle tablo açılır), silmek için [[Sil]]’i kullanın; silme sınavı ve sonuçlarını kaldırır.']
    ]
  },
  {
    id: 'dis-ekle', cat: 'dis', title: 'Dış sınav sonucunu mevcut sınava ekleme', aud: 'ogretmen', kw: 'mevcut sınava ekle güncelle değiştir birden çok dosya sınıf sınıf aynı numaralı',
    sum: 'İki sınıfın dosyasını ayrı ayrı yüklemek ya da bir sınavı güncellemek için.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['dis-excel', 'dis-satir'],
    body: [
      ['p', 'Kaydederken **Nereye kaydedilsin?** bölümünde yeni sınav yerine [[Mevcut sınava ekle]] seçeneğini seçin. Dersler mevcut sınavdakiyle **adına göre** eşleşir; uyuşmayanlar için uyarı alırsınız.'],
      ['ul', [
        '**Aynı numaralıları güncelle, diğerlerini koru**: iki sınıfın dosyasını sırayla yüklemek için.',
        '**Önceki tüm sonuçları sil, yenileriyle değiştir**: yanlış yüklenen sınavı baştan yüklemek için.'
      ]],
      ['warn', 'İkinci seçenek eski sonuçların tamamını siler. Emin değilseniz önce ilk seçeneği kullanın.']
    ]
  },

  /* ================================================================ 9. SONUÇLAR */
  {
    id: 'sonuc-ogr', cat: 'sonuc', title: 'Sonuçlar: Öğrenciler sekmesi', aud: 'ogretmen', kw: 'sonuç öğrenci sıralama net puan ara csv indir karne okul sınıf süzgeç',
    sum: 'Seçili sınavın öğrenci listesi: D/Y/B, net, puan ve sıralar.',
    go: { view: 'results', tab: 'students', label: 'Sonuçlar’ı aç' }, see: ['sonuc-karne', 'sonuc-okul', 'an-list'],
    body: [
      ['p', '{{Sonuçlar}} ekranının üstünden sınavı seçin; [[↻ Yenile]] sunucudan son durumu çeker. Sekmeler: [[Öğrenciler]], [[Okul karşılaştırma]], [[İlçe / İl]], [[Madde analizi]] ve [[Öğrenci karneleri]].'],
      ['ul', [
        '**Öğrenciler** tablosunda genel sıra, il/ilçe/okul/sınıf, no, ad-soyad, kitapçık, doğru/yanlış/boş, net ve puan bulunur; başlığa tıklayarak sıralarsınız.',
        '[[Ad, no ara…]] kutusu, [[Tüm okullar]] ve [[Tüm sınıflar]] süzgeçleriyle listeyi daraltırsınız.',
        '**Satıra tıklayınca** öğrencinin karnesi açılır: ders ders sonuçlar, standart puan, sıralar ve cevap tablosu; [[Yazdır / PDF]] ile çıktı alınır.',
        '[[CSV indir]] listeyi Excel’de açılabilir bir dosya olarak indirir.'
      ]],
      ['info', 'Öğretmen yalnızca kendi sınavının (ve okulun ortak sınavlarının) sonuçlarını, okul yöneticisi okulunun bütün sınavlarını görür. Öğrencilerin adları okulun öğrenci listesinden gelir.']
    ]
  },
  {
    id: 'sonuc-okul', cat: 'sonuc', title: 'Okul karşılaştırma', aud: 'yetkili', kw: 'okul karşılaştır ortalama ders bazlı ortak sınav ilçe il sıralama okulların karşılaştırması',
    sum: 'Ortak sınavda okulların ortalama puanı ve ders bazlı net ortalamaları.',
    go: { view: 'results', tab: 'schools', label: 'Okul karşılaştırma sekmesini aç' }, see: ['sonuc-ilce', 'sinav-durum'],
    body: [
      ['p', 'İlçe/il kapsamlı sınavlarda [[Okul karşılaştırma]] sekmesi, [[Ortalama puana göre okullar]] sıralamasını ve ders bazlı ortalama neti verir. Hücreler **genel ortalamaya göre fark** gösterir (yeşil: üstünde, kırmızı: altında); başlığa tıklayarak sıralarsınız. Kendi okulunuz vurgulanır.'],
      ['info', 'Okul yöneticisi diğer okulların adını **görmez**: yalnızca kendi okulunun genel ortalamaya göre konumunu görür. Tek okullu sınavda karşılaştırma yoktur (“Okul karşılaştırması yok”).']
    ]
  },
  {
    id: 'sonuc-ilce', cat: 'sonuc', title: 'İlçe / İl sıralaması', aud: 'yetkili', kw: 'ilçe il sıralama genel ortalama katılım standart sapma ilçe ortalaması',
    sum: 'İlçe ve il bazında katılım ve ortalamalar.',
    go: { view: 'results', tab: 'ilce', label: 'İlçe / İl sekmesini aç' }, see: ['sonuc-okul', 'sinav-durum'],
    body: [
      ['p', '[[İlçe / İl]] sekmesinde her ilçenin (ve ilin) katılımcı sayısı, okul sayısı, ortalama net, standart sapma ve en yüksek net görünür. Ders bazlı ortalamalar ve okulların ilçe içindeki konumu da burada okunur.'],
      ['tip', 'Bu sekme yalnızca **ilçe/il kapsamlı** sınavlarda anlamlıdır; tek okullu sınavda ilçe/il sıralaması hesaplanmaz.']
    ]
  },
  {
    id: 'sonuc-madde', cat: 'sonuc', title: 'Madde analizi: hangi soru ne kadar zor?', aud: 'ogretmen', kw: 'madde analizi soru zorluk doğru yapma yüzdesi şık dağılımı çeldirici zor kolay',
    sum: 'Soru soru doğru yapma yüzdesi ve şık dağılımı.',
    go: { view: 'results', tab: 'items', label: 'Madde analizi sekmesini aç' }, see: ['sonuc-ogr', 'an-ders'],
    body: [
      ['p', '[[Madde analizi]] her sorunun **doğru yapılma yüzdesini** (genel ve seçili okul) ve öğrencilerin hangi şıkkı işaretlediğini gösterir. Düşük yüzdeli sorular zor ya da yanlış anahtarlı olabilir; bir çeldiricinin doğru şıktan çok işaretlenmesi sorunun yanlış anlaşıldığına işaret eder.'],
      ['ul', [
        'Ders bazında toplamları görmek için üstteki ders etiketlerine bakın (ders başına ortalama doğru %).',
        'Okul seçerek o okulun **genele göre** farkını inceleyebilirsiniz.',
        'Sınavı yeniden değerlendirmek (ör. soruyu iptal etmek) için sınavın cevap anahtarında `*` kullanın: ((sinav-anahtar|Cevap anahtarı))'
      ]]
    ]
  },
  {
    id: 'sonuc-karne', cat: 'sonuc', title: 'Öğrenci karneleri (toplu yazdırma)', aud: 'ogretmen', kw: 'karne yazdır pdf toplu sınıf öğrenci karnesi a4 imza',
    sum: 'Seçtiğiniz okul ve sınıf için her öğrenciye ayrı A4 karne.',
    go: { view: 'results', tab: 'karne', label: 'Öğrenci karneleri sekmesini aç' }, see: ['an-karne', 'sonuc-ogr'],
    body: [
      ['steps', [
        ['{{Sonuçlar → Öğrenci karneleri}} sekmesini açın'],
        ['[[Tüm okullar]] ve [[Tüm sınıflar]] listelerinden kapsamı seçin'],
        ['Karne düğmesine basın', 'Her öğrenci için ayrı A4 sayfa hazırlanır: ders bazlı D/Y/B/net, standart puan, sıralamalar, ortalamalarla karşılaştırma ve cevap tablosu. 300’den fazla karnede onay istenir.'],
        ['Yazdırma penceresinde hedef olarak **PDF olarak kaydet**’i seçin', 'Kâğıt A4 dikey, “arka plan grafikleri” açık olsun.']
      ]],
      ['info', 'Gelişim grafikli, birden çok sınavı kapsayan karne için ((an-karne|Analiz → Karneler)) bölümünü kullanın.']
    ]
  },

  /* ================================================================ 10. ANALİZ */
  {
    id: 'an-baslangic', cat: 'analiz', title: 'Analiz: nereden başlanır?', aud: 'ogretmen', kw: 'analiz başlangıç okul seç sınav işaretle sekmeler gruplar gelişim nasıl yapılır',
    sum: 'Okulu seçin, sınavları işaretleyin, bir sekmeye geçin.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['an-hangi', 'an-cikti', 'dis-nedir'],
    body: [
      ['p', '{{Analiz}} ekranı, sistemde okuttuğunuz sınavlarla dışarıdan aktardığınız sınavları **birlikte** analiz eder. Rozet sınavın kaynağını gösterir: **Sistem** ya da **Dış · kurum**.'],
      ['steps', [
        ['Okulu seçin', 'Okul yöneticisi ve öğretmende kendi okulunuz hazır gelir. İlçe/il yetkilisi önce [[İl]] / [[İlçe]] / okul düzeyi süzgeçleriyle okulu bulur; okul listesi uzunsa arama kutusunu kullanın.'],
        ['Analize girecek sınavları işaretleyin', 'Öğrenci, Sınıf, Ders, Okul, Karşılaştır, Başarı listeleri ve Karneler sekmelerine ilk girişte okuldaki tüm sınavlar işaretli gelir; istemediğinizi kaldırın.'],
        ['Bir sekme seçin', 'Sekmeler dört grupta: **Sınav** (Sınav listesi, Sınav özeti) · **Kim / hangi grup** (Öğrenci, Sınıf, Ders, Okul) · **Kıyas ve liste** (Karşılaştır, Gelişim, Başarı listeleri) · **Çıktı** (Karneler).'],
        ['Gerekirse sınıf süzgecini kullanın', 'Sınıf süzgeci bütün sekmelerde çalışır.'],
        ['Çıktı alın', 'Her sekmede **Excel** ve **Yazdır / PDF** vardır. ((an-cikti|Çıktı alma))']
      ]],
      ['warn', 'Farklı puan türleri (sistem puanı ile dış sınavın “LGS Puanı” gibi) birbirine karıştırılmaz; soru sayıları farklı sınavlarda net doğrudan kıyaslanmaz. Ekran bunu yazar ve ortak ölçüt olan **Başarı %** (net ÷ soru sayısı) önerir.'],
      ['info', 'Öğrenciler sınavlar arasında **okul numarası** ile eşleşir (aynı okul içinde). Numarası farklı yazılmış öğrenci iki ayrı satır olur; numaraları tutarlı tutun.']
    ]
  },
  {
    id: 'an-hangi', cat: 'analiz', title: 'Hangi analiz nereden çıkar?', aud: 'ogretmen', kw: 'hangi analiz nerede nereden çıkar harita soru cevap sekme rehber net artışı gelişim zayıf ders dikkat edilecek öğrenci birinci',
    sum: 'Merak ettiğiniz soruyu bulun, hangi sekmeye gideceğinizi öğrenin.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['an-baslangic', 'an-ogr', 'an-sinif', 'an-listeler', 'an-kars'],
    body: [
      ['table', ['Merak ettiğiniz…', 'Sekme', 'Orada ne görürsünüz?'], [
        ['Tek sınavın tam sonuç listesi', '[[Sınav listesi]]', 'Ders ders D-Y-N, toplam, puan, dereceler; Excel şablonla aynı düzende.'],
        ['Sınavlar arası ortalama değişimi', '[[Sınav özeti]]', 'Sınav sınav ortalama D/Y/net/puan/başarı %, değişim, ders ve sınıf tabloları.'],
        ['Bir öğrencinin gelişimi', '[[Öğrenci]]', 'Gelişim ve sıralama grafiği, ders ders başarı, sınav sınav tablo, otomatik değerlendirme.'],
        ['Bir sınıfın durumu', '[[Sınıf]]', 'Sınıf ortalaması, katılım, başarı dağılımı, ders × sınav ısı tablosu, öğrenci sıralaması.'],
        ['Bir dersin durumu', '[[Ders]]', 'Ders × sınıf ısı haritası, gelişim, en başarılı ve en düşük 10 öğrenci.'],
        ['Okulun bütünü', '[[Okul]]', 'Okul ortalaması ve eğilimi, sınıfların karşılaştırması, sınıf × ders ısı tablosu, derslerin güçlü ve zayıf yönleri.'],
        ['İki sınavı birbiriyle kıyaslamak', '[[Karşılaştır]]', 'Herhangi iki sınav (A ↔ B): okul, sınıf ve öğrenci düzeyinde; yükselen/düşen öğrenciler.'],
        ['Kim arttı, kim düştü? (net artışı)', '[[Gelişim]]', 'Öğrenci × sınav tablosu, her hücrede ▲/▼ değişim.'],
        ['Hazır listeler (sıralama, gelişen/gerileyen, birinciler, dikkat edilecek)', '[[Başarı listeleri]]', 'Tek tıkla listeler, Excel ve yazdırma.'],
        ['Karne, rapor', '[[Karneler]]', 'Öğrenci karnesi, sınıf karneleri, sınıf/okul raporu (A4, PDF).']
      ]],
      ['tip', 'Sorunun cevabı hangi sekmede olduğunu bilmiyorsanız arama kutusuna “zayıf ders”, “birinci”, “katılım” gibi sözcükleri yazın: kılavuz ilgili konuya götürür.']
    ]
  },
  {
    id: 'an-list', cat: 'analiz', title: 'Sınav listesi', aud: 'ogretmen', kw: 'sınav listesi sonuç listesi ortalama excel şablon sırala pdf liste',
    sum: 'Seçtiğiniz tek sınavın sonuç listesi, PDF’teki gibi.',
    go: { view: 'analiz', tab: 'list', label: 'Sınav listesi sekmesini aç' }, see: ['an-ozet', 'dis-excel'],
    body: [
      ['p', 'Sınavı seçin; liste Genel ve Okul Ortalaması satırlarıyla, her ders için doğru-yanlış-net, toplam, puan ve derecelerle gelir. Başlığa tıklayıp sıralarsınız. [[+ Dış sınav ekle]] da bu ekrandadır.'],
      ['ul', ['“⬇ Excel” listeyi şablonla **aynı düzende** indirir (tekrar yüklenebilir).', 'Dış sınavlar için satırda [[Düzenle]] ve [[Sil]] vardır.']]
    ]
  },
  {
    id: 'an-ozet', cat: 'analiz', title: 'Sınav özeti (sınavlar arası karşılaştırma)', aud: 'ogretmen', kw: 'sınav özeti karşılaştırma özet ortalama değişim sınıflara göre ders bazlı net',
    sum: 'Her sınavın ortalamaları ve sınavdan sınava değişim.',
    go: { view: 'analiz', tab: 'cmp', label: 'Sınav özeti sekmesini aç' }, see: ['an-kars', 'an-okul'],
    body: [
      ['p', '[[Sınav özeti]] işaretli sınavların sınav sınav **ortalama D/Y/net/puan/başarı %** değerlerini, değişimleri, grafiği, ders bazlı ortalama neti ve sınıflara göre tabloyu verir. Okulun genel gidişatına hızlı bakmak için en uygun sekmedir.']
    ]
  },
  {
    id: 'an-ogr', cat: 'analiz', title: 'Öğrenci analizi', aud: 'ogretmen', kw: 'öğrenci analizi bireysel gelişim grafik sıra ders ders başarı değerlendirme yazdır tek öğrenci',
    sum: 'Bir öğrencinin bütün sınavlardaki gelişimi.',
    go: { view: 'analiz', tab: 'ogr', label: 'Öğrenci sekmesini aç' }, see: ['an-karne', 'an-dev', 'an-kars'],
    body: [
      ['steps', [
        ['[[Öğrenci]] sekmesini açın'],
        ['Öğrencinin **numarasını ya da adını** yazın', 'Ya da sınıfı seçip listeden tıklayın; ‹ Önceki / Sonraki › ile sınıfta gezin.'],
        ['Sonuçları okuyun']
      ]],
      ['ul', [
        '**Başlık**: ad, sınıf, kaç sınava girdiği (girmediği sınavlar adıyla), ortalama net/başarı/puan, son sınav ve bir öncekine göre değişim.',
        '**Değerlendirme**: veriden üretilen kısa cümleler (yükseliş/düşüş, en güçlü ve en zayıf ders, sıra değişimi). Yapay zekâ değil, kurala dayalıdır.',
        '**Gelişim grafiği**: Başarı % / Net / Puan seçilebilir; öğrenci, sınıf ve okul ortalaması birlikte. **Sıralama grafiği**: okul ve sınıf sırası (1 = en iyi).',
        '**Ders ders başarı**: her dersin gelişimi, doğru/yanlış/boş dağılımı ve ders sırası.',
        '**Sınav sınav tablo**: D/Y/B, net, puan, başarı %, sınıf ortalaması, sıralar ve her ders (renk sınıf ortalamasına göre fark).',
        'Excel ve Yazdır (öğrenci raporu) düğmeleri.'
      ]]
    ]
  },
  {
    id: 'an-sinif', cat: 'analiz', title: 'Sınıf analizi', aud: 'ogretmen', kw: 'sınıf analizi sınıf ortalaması katılım başarı dağılımı ısı tablosu öğrenci sıralaması sınıf karşılaştırma tüm okul',
    sum: 'Bir sınıfın (ya da tüm okulun) sınav sınav durumu.',
    go: { view: 'analiz', tab: 'sinif', label: 'Sınıf sekmesini aç' }, see: ['an-ders', 'an-okul', 'an-listeler'],
    body: [
      ['p', '[[Sınıf]] sekmesinde bir sınıfı ya da **tüm okulu** seçersiniz. Göreceğiniz başlıca bölümler:'],
      ['ul', [
        'Ortalama başarı, son sınav, eğilim ve katılım.',
        'Sınıf sınıf gelişim grafiği ve katılım grafiği.',
        'Ders ders başarı (sınıf / okul) ve **ders × sınav ısı tablosu**.',
        '**Sınıf karşılaştırması**: her sınıfın her sınavdaki ve derslerdeki ortalaması; satıra tıklayınca o sınıf açılır.',
        'Başarı dağılımı (%0–20 … %80–100) ve **öğrenci sıralaması** (başlığa tıklayıp sıralanır).'
      ]]
    ]
  },
  {
    id: 'an-ders', cat: 'analiz', title: 'Ders analizi', aud: 'ogretmen', kw: 'ders analizi ders sınıf ısı haritası en başarılı en düşük öğrenci zayıf ders güçlü',
    sum: 'Bir dersin sınıflara ve zamana göre durumu.',
    go: { view: 'analiz', tab: 'ders', label: 'Ders sekmesini aç' }, see: ['an-sinif', 'an-okul', 'sonuc-madde'],
    body: [
      ['p', '[[Ders]] sekmesinde dersi seçin (sınıf süzgeci isteğe bağlı). **Ders × sınıf ısı haritası**, dersin sınav sınav gelişimi, ortalama doğru/yanlış/boş, derslerin birbirine göre durumu (en güçlü → en zayıf), başarı dağılımı, sınav sınav tablo ve **en başarılı / en düşük 10 öğrenci** görünür. Excel ve Yazdır vardır.']
    ]
  },
  {
    id: 'an-okul', cat: 'analiz', title: 'Okul analizi', aud: 'okul', kw: 'okul analizi okul ortalaması eğilim sınıf karşılaştırma ısı tablosu çeyrek medyan standart sapma güçlü zayıf ders',
    sum: 'Tek okulun bütünü: ortalamalar, sınıf kıyası, derslerin güçlü ve zayıf yönleri.',
    go: { view: 'analiz', tab: 'okul', label: 'Okul sekmesini aç' }, see: ['an-sinif', 'an-ders', 'sonuc-okul'],
    body: [
      ['p', '[[Okul]] sekmesi okulun bütününe bakar: okul ortalaması, son sınav ve eğilim, ortalama katılım, **%60 üstü / %40 altı** oranı; sınav sınav gelişim (ortalama, medyan, üst/alt çeyrek), sınav özet tablosu (katılım, ortalama, en yüksek/en düşük, standart sapma), **sınıfların karşılaştırması** (sınıfa tıklayınca Sınıf sekmesi açılır), **sınıf × ders ısı tablosu** ve derslerin güçlü/zayıf yönleri.'],
      ['tip', 'Yönetici raporu için {{Karneler → Sınıf / okul raporu}} bu verileri A4 sayfalarda toplar. ((an-karne|Karneler))']
    ]
  },
  {
    id: 'an-kars', cat: 'analiz', title: 'İki sınavı karşılaştırma (A ↔ B)', aud: 'ogretmen', kw: 'karşılaştır iki sınav a b önceki son ilk saçılım yükselen düşen net artışı kıyas',
    sum: 'İşaretli sınavlardan herhangi ikisini okul, sınıf ve öğrenci düzeyinde kıyaslayın.',
    go: { view: 'analiz', tab: 'kars', label: 'Karşılaştır sekmesini aç' }, see: ['an-dev', 'an-ogr'],
    body: [
      ['steps', [
        ['[[Karşılaştır]] sekmesini açın'],
        ['A ve B sınavlarını seçin', 'Hızlı düğmeler: [[Önceki ↔ son]], [[İlk ↔ son]]; ⇄ ile yer değiştirirsiniz.'],
        ['Düzeyi seçin', '**Okul** (ortalama, değişim, ders ve sınıf kıyası, yükselen/düşen 10 öğrenci), **Sınıf** (aynısı seçilen sınıf için) ya da **Öğrenci** (tek öğrencinin A ve B sonucu).'],
        ['Ölçütü seçin', 'Başarı % / Net / Puan ve isteğe bağlı tek ders.']
      ]],
      ['ul', [
        'Öğrenci öğrenci **saçılım grafiği**: x = A, y = B; köşegenin üstündekiler B’de yükselenlerdir, noktanın üstüne gelince ad ve değerler görünür.',
        'Öğrenciler **Ö.No** ile eşleşir.',
        'Soru sayıları ya da puan türleri farklıysa net/puan kıyaslanmaz; ekran nedenini yazıp başarı yüzdesine geçer.'
      ]]
    ]
  },
  {
    id: 'an-dev', cat: 'analiz', title: 'Gelişim: kim arttı, kim düştü?', aud: 'ogretmen', kw: 'gelişim net artışı artan azalan değişim ▲ ▼ öğrenci sınav tablosu son değişim ilk son',
    sum: 'Öğrenci × sınav tablosu; her hücrede bir önceki sınava göre değişim.',
    go: { view: 'analiz', tab: 'dev', label: 'Gelişim sekmesini aç' }, see: ['an-kars', 'an-listeler'],
    body: [
      ['p', '[[Gelişim]] sekmesi öğrenci × sınav tablosudur. Her hücrede seçtiğiniz ölçüt (Net, Puan, Başarı %, Doğru, Yanlış; isterseniz tek ders) ve bir önceki sınava göre **▲/▼ değişim** görünür; yanında *Son değişim*, *İlk → son* ve küçük bir gidiş grafiği vardır. Üstte kaç öğrencinin arttığı/düştüğü ve ortalama değişim yazar; öğrenciye tıklayınca Öğrenci sekmesi açılır.'],
      ['info', 'Net ▲/▼ değişimi yalnızca **aynı soru sayılı** ardışık sınavlar arasında gösterilir; aksi hâlde Başarı % ya da Puan ölçütünü kullanın.']
    ]
  },
  {
    id: 'an-listeler', cat: 'analiz', title: 'Başarı listeleri (hazır listeler)', aud: 'ogretmen', kw: 'başarı listeleri genel sıralama ders sıralaması gelişenler gerileyenler dikkat edilecek katılım sınav birincileri risk',
    sum: 'Tek tıkla hazır sıralama ve takip listeleri.',
    go: { view: 'analiz', tab: 'listeler', label: 'Başarı listeleri sekmesini aç' }, see: ['an-dev', 'an-sinif'],
    body: [
      ['table', ['Liste', 'Ne gösterir?'], [
        ['Genel sıralama', 'Ölçüt Başarı % / Net / Puan; “en az N sınav” süzgeci; okul ve sınıf sırası.'],
        ['Ders sıralaması', 'Seçilen dersin öğrenci sıralaması.'],
        ['Gelişenler / gerileyenler', 'İlk sınavdan sonuncuya fark ve eğilim.'],
        ['Dikkat edilecekler', 'Ortalaması ya da son sınavı sizin belirlediğiniz % sınırının altında olanlar, art arda düşenler, son sınavda 10+ puan düşenler, sınava girmeyenler; nedeni satırda yazar.'],
        ['Katılım', 'Öğrenci × sınav matrisi; eksik girenler başta.'],
        ['Sınav birincileri', 'Her sınavda ilk 3 ve sınıf birincileri.']
      ]],
      ['info', 'Sıralama listeleri öğrencinin **girdiği** sınavların ortalamasına göredir; girmediği sınav ortalamaya katılmaz (bu yüzden “en az N sınav” süzgeci vardır). Hepsi sınıf süzgeciyle, Excel’e ve yazdırmaya hazırdır.']
    ]
  },
  {
    id: 'an-karne', cat: 'analiz', title: 'Karneler ve raporlar (A4, PDF)', aud: 'ogretmen', kw: 'karne rapor öğrenci karnesi sınıf karneleri okul raporu pdf yazdır imza a4 dikey sıralama göster gizle',
    sum: 'Gelişim grafikli öğrenci karnesi, toplu sınıf karneleri ve sınıf/okul raporu.',
    go: { view: 'analiz', tab: 'karne', label: 'Karneler sekmesini aç' }, see: ['sonuc-karne', 'an-cikti'],
    body: [
      ['table', ['Biçim', 'İçeriği'], [
        ['**Öğrenci karnesi**', 'Okul adı, ad/no/sınıf, 6 özet kutusu, başarı gelişimi grafiği (öğrenci + sınıf + okul), sınav sonuçları tablosu, ders ders başarı, değerlendirme yazıları, imza alanları.'],
        ['**Sınıf karneleri**', 'Seçilen sınıfın (ya da tüm okulun) her öğrencisi için ayrı sayfa; toplu yazdırılır. Hiçbir sınava girmeyen öğrencinin karnesi çıkmaz.'],
        ['**Sınıf / okul raporu**', '1. sayfa özet (kutular, grafik, tablolar, değerlendirme); 2. sayfa sınıf için öğrenci listesi, okul için sınıf listesi.']
      ]],
      ['steps', [
        ['[[Karneler]] sekmesini açın, kapsamı (sınıf/öğrenci) ve işaretli sınavları seçin'],
        ['[[Sıralamalar]], [[Grafik]] ve [[Değerlendirme yazıları]] kutularıyla karneye girecekleri belirleyin', 'Ör. sıralamayı veliye göstermek istemiyorsanız kapatın.'],
        ['[[Yazdır / PDF olarak kaydet]]’e basın', 'Hedef olarak **PDF olarak kaydet**’i seçin; kâğıt A4 dikey, “arka plan grafikleri” açık. Karneler koyu temada da beyaz kâğıt görünümündedir.']
      ]],
      ['tip', 'Karneye **işaretli sınavlar** girer; hangi sınavların karnede görüneceğini üstteki işaretlerden belirleyin. Sonuçlar ekranındaki ((sonuc-karne|tek sınavlık karne)) bundan farklıdır.']
    ]
  },
  {
    id: 'an-cikti', cat: 'analiz', title: 'Excel, yazdırma ve PDF çıktısı', aud: 'ogretmen', kw: 'excel yazdır pdf çıktı indir a4 yatay dikey grafik arka plan yazıcı',
    sum: 'Her analiz sekmesinden Excel ve yazdırılabilir çıktı alınır.',
    go: { view: 'analiz', tab: 'list', label: 'Analiz ekranını aç' }, see: ['an-karne', 'an-baslangic'],
    body: [
      ['ul', [
        'Her sekmede **Excel** düğmesi tabloyu `.xlsx` olarak indirir; metinler formül olarak yazılmaz (güvenli).',
        '**Yazdır / PDF** tarayıcının yazdırma penceresini açar; yazdırmada menü ve düğmeler gizlenir. Karneler A4 **dikey**, diğer sekmeler A4 **yatay** çıkar; grafikler sayfa sonunda bölünmez.',
        'PDF için hedef olarak **PDF olarak kaydet**’i seçin; renkli çıktı için “arka plan grafikleri”ni açın.',
        'Koyu temada bile çıktı beyaz kâğıt görünümündedir.'
      ]],
      ['tip', 'Telefonda PDF için tarayıcının paylaşım/yazdır menüsünden “PDF olarak kaydet”i seçin; geniş tablolar için bilgisayar kullanmak daha rahattır.']
    ]
  },

  /* ================================================================ 11. İLETİŞİM */
  {
    id: 'veli-kod-uret', cat: 'iletisim', title: 'Veli kodu üretme ve veli telefonları', aud: 'okul', kw: 'veli kodu üret yenile csv anne telefonu baba telefonu cep telefon numara biçim',
    sum: 'Okul yöneticisi öğrencilere veli kodu üretir ve anne/baba telefonlarını kaydeder.',
    go: { view: 'admin', tab: 'students', label: 'Öğrenciler sekmesini aç' }, see: ['veli-kod', 'wa-mesaj', 'yon-ogrenciler'],
    body: [
      ['h', 'Veli kodu'],
      ['steps', [
        ['{{Yönetim → Öğrenciler}} sekmesinde okulunuzu seçin'],
        ['[[Veli kodlarını üret / CSV indir]]’e basın', 'Kodu olmayan öğrencilere kod üretilir ve liste CSV olarak iner; velilere dağıtmak için kullanın.'],
        ['Kodu yenilemek isterseniz', 'Aynı düğme okuldaki **bütün** öğrencilerin kodlarını yeniler ve eski kodlar geçersiz olur; onay sorulur.']
      ]],
      ['h', 'Anne ve baba telefonu'],
      ['ul', [
        'Öğrenci kaydında **Anne telefonu** ve **Baba telefonu** alanları vardır; toplu yüklemede `anneTel`, `babaTel` sütunlarıdır.',
        '`0532 111 22 33`, `532-111-22-33`, `+90 532 111 22 33` biçimleri kabul edilir. Yalnızca **cep telefonu** geçerlidir (WhatsApp sabit hatta ulaşmaz); yurt dışı için `+ülke kodu` yazın.',
        'Telefonları yalnızca okul yöneticisi ve üst yetkililer görür; öğretmen göremez.'
      ]],
      ['info', 'Kodu olan öğrencinin sonucuna yalnızca kodu bilen veli ulaşır; kodsuz öğrencilere sınıf + numara ile ulaşılabildiği için kod kullanmak **daha güvenlidir**.']
    ]
  },
  {
    id: 'wa-mesaj', cat: 'iletisim', title: 'Velilere WhatsApp ile sonuç mesajı ve arka plan eklentisi', aud: 'okul', kw: 'whatsapp business normal veli mesaj şablon gönder toplu kişiye özel yer tutucu eklenti chrome edge firefox arka plan gönderildi atlananlar',
    sum: 'Chrome, Edge ve Firefox eklentisiyle WhatsApp Normal ve Business üzerinden arka planda toplu veya tekil mesaj gönderin.',
    go: { view: 'admin', tab: 'wa', label: 'Veli WhatsApp sekmesini aç' }, see: ['veli-kod-uret', 'veli-gmail', 'hata-kodlari', 'sinav-yeni'],
    body: [
      ['p', '{{Yönetim → Veli WhatsApp}} sekmesi, her öğrencinin sonucunu ve **kişiye özel eylem planı bağlantısını** anne ve/veya babasının telefonuna hazırlar. Sistem tarayıcınızı (Chrome, Edge, Brave, Opera, Firefox) otomatik algılar ve kurulum adımlarını üst kartta gösterir.'],
      ['h', '1. Tarayıcı eklentisini kurma (bir kez)'],
      ['table', ['Tarayıcı', 'Kurulum adımları'], [
        ['**Google Chrome / Edge / Brave / Opera**', '`wa-eklenti.zip` dosyasını klasöre çıkarın → adres çubuğuna `chrome://extensions` (Edge: `edge://extensions`) yazın → **Geliştirici modu**nu açın → **Paketlenmemiş öğe yükle** diyerek `wa-eklenti` klasörünü seçin.'],
        ['**Mozilla Firefox**', '`wa-eklenti.zip` dosyasını klasöre çıkarın → adres çubuğuna `about:debugging#/runtime/this-firefox` yazın → **Geçici Eklenti Yükle** diyerek `wa-eklenti/manifest.json` dosyasını seçin.']
      ]],
      ['h', '2. Mesaj hazırlama ve arka planda gönderme'],
      ['steps', [
        ['WhatsApp Web oturumunu açın', 'Bilgisayarınızda `web.whatsapp.com` adresine girip telefonunuzdaki **WhatsApp (Normal)** veya **WhatsApp Business** uygulamasından QR kodu okutun.'],
        ['Okul, sınav, sınıf, alıcı ve bekleme süresini seçin', 'İsterseniz tek öğrenci, birkaç öğrenci, seçili sınıf ya da tüm okulu (100–500+ öğrenci) seçebilirsiniz. Mesaj arası bekleme süresi olarak **10–15 saniye** önerilir.'],
        ['[[Mesajları Hazırla]] düğmesine basın', 'Gönderime hazır öğrenciler listelenir; telefonu eksik veya sonucu olmayanlar **Atlanan / Gönderilemeyen Öğrenciler** tablosunda nedeniyle birlikte görünür (CSV indirilebilir).'],
        ['Şablonu kontrol edip gönderimi başlatın', 'Tek tek göndermek için satırdaki [[WhatsApp’ta Aç]] düğmesini; arka planda otomatik göndermek için [[🚀 Eklentiyle Arka Planda Gönder / Kuyruğu Kopyala]] düğmesini kullanın.'],
        ['Diğer işlerinize devam edin', 'Eklenti arka planda yeni bir WhatsApp Web sekmesi açar ve siz başka sekmelerde çalışırken mesajları sırayla gönderir. Gönderilen ve hata alan her kayıt canlı olarak **Eklenti Gönderim Raporu** tablosuna düşer ve sunucuya kaydedilir.']
      ]],
      ['tip', 'Eklenti simgesine tıklayarak açılan pencereden ilerlemeyi (`gönderilen / toplam`) izleyebilir, **Duraklat / Devam Et / Durdur** yapabilir ve gönderim raporunu CSV olarak indirebilirsiniz.'],
      ['warn', 'WhatsApp hesabınızın kısıtlanmaması için çok kısa aralıklarla gönderim yapmayın. Oturum kapalıysa (`WA_LOGIN`) eklenti kuyruğu kendiliğinden duraklatır; QR kodu okuttuktan sonra **Devam Et**’e basın.']
    ]
  },
  {
    id: 'veli-gmail', cat: 'iletisim', title: 'Veli Portalı: Gmail / e-posta üyeliği ve Eylem Planı', aud: 'herkes', kw: 'veli gmail eposta üyelik giriş hızlı sorgu eylem planı kazanım telefon şifre',
    sum: 'Veliler girişsiz sorgulama yapabilir veya Gmail/e-posta hesabıyla kalıcı üyelik oluşturup eylem planına ulaşabilir.',
    see: ['veli-kod-uret', 'wa-mesaj', 'hata-kodlari'],
    body: [
      ['p', 'Veli & Öğrenci Portalı (`#/ogrenci`) üç farklı kullanım sunar:'],
      ['ul', [
        '**Hızlı Sonuç Sorgula (girişsiz):** İl → İlçe → Okul → Sınıf → Okul No (+ varsa Veli Kodu) ile anında sorgulama.',
        '**Veli Üyeliği Oluştur (Gmail + Telefon):** Veli; çocuğunun okul, sınıf, okul numarası (ve varsa veli kodu) ile doğrulama yaptıktan sonra kendi **Gmail / e-posta adresi**, **cep telefonu** ve belirlediği parolayla kalıcı hesap açar.',
        '**Veli Girişi (Gmail / E-posta):** Üye olan veli sonraki sınavlarda okul/sınıf seçmeden yalnızca e-posta ve parolasıyla tek tıkla giriş yapar.'
      ]],
      ['info', 'Sonuç ekranında her sınav için D/Y/B, net, puan, sınıf/okul/genel sıralama, ders ortalamaları ve öğrencinin yanlış/boş bıraktığı sorulara göre otomatik oluşturulmuş **Kişiye Özel Konu / Kazanım Eylem Planı** görüntülenir ve PDF olarak yazdırılabilir.']
    ]
  },

  /* ================================================================ 12. YÖNETİM */
  {
    id: 'yon-ai', cat: 'yonetim', title: 'Yapay zekâ ayarları (sistem yöneticisi)', aud: 'admin', kw: 'yapay zeka ai api anahtar claude gemini openai groq mistral sağlayıcı model öncelik hız dene',
    sum: 'Sağlayıcı anahtarlarını girin; yapay zekâlı form tanıma tüm kullanıcılara açılır.',
    go: { view: 'admin', tab: 'ai', label: 'Yapay zekâ sekmesini aç', roles: ['admin'] }, see: ['form-ai', 'form-harici-otomatik'],
    body: [
      ['p', '{{Yönetim → Yapay zekâ}} sekmesi yalnızca **sistem yöneticisinde** görünür. Yapay zekâ, harici formlarda bölümleri ve ders adlarını önermek için kullanılır ((form-ai|Yapay zekâ ile tam tanıma)); sınav puanlama ya da veli ekranında kullanılmaz.'],
      ['steps', [
        ['Bir sağlayıcı kartında [[API anahtarı]]nı yapıştırın', 'Anahtar sunucuda (Apps Script) saklanır, tarayıcıya geri gönderilmez; kayıtlıysa “Kayıtlı anahtarı değiştirmek için yenisini yapıştırın” yazar.'],
        ['İsterseniz [[Model (isteğe bağlı)]] alanına model adı yazın', 'Boş bırakılırsa en yeni model kendiliğinden seçilir.'],
        ['Anahtarı sınayın', 'Kartın [[Dene]] düğmesi “Çalışıyor: sağlayıcı · model · ms” sonucunu verir.'],
        ['[[Öncelikli sağlayıcı]] ve **Hız ↔ yetenek** ayarını seçin', 'Kullanıcılar ekranda kendi seçimlerini de yapabilir; yapmazlarsa bu ayar kullanılır.'],
        ['Kaydedin']
      ]],
      ['info', 'Bir sağlayıcı yanıt vermezse yedek sağlayıcılar denenir. Anahtar tanımlanmamışsa kullanıcılar **API’siz** yolu kullanır: ücretsiz bir sohbet uygulamasına görüntü ve istem yapıştırılır ((form-ai|ayrıntı)). OpenAI uyumlu başka bir hizmet için adres/model alanları da vardır.'],
      ['warn', 'Anahtarlar ücretlidir: yalnızca güvendiğiniz kişilerin sistem yöneticisi olmasını sağlayın. Sağlayıcıya yalnızca **boş form** görüntüsü ve blok listesi gider; öğrenci verisi gitmez.']
    ]
  },
  {
    id: 'ayarlar', cat: 'yonetim', title: 'Ayarlar: hesap, bağlantı, parola', aud: 'herkes', kw: 'ayarlar hesap çıkış parola değiştir sunucu adresi bağlantı senkron otomatik gönder form alt yazısı veli bağlantısı kopyala',
    sum: 'Hesabınız, sunucu bağlantısı, veli bağlantısı ve parola tek ekranda.',
    go: { view: 'settings', label: 'Ayarlar’ı aç' }, see: ['giris', 'kuyruk', 'kurulum'],
    body: [
      ['table', ['Bölüm', 'Ne işe yarar?'], [
        ['**Hesap**', 'Kim olarak girdiğinizi gösterir. [[Verileri yenile]] okul/sınav/öğrenci listelerini sunucudan yeniler; [[Çıkış yap]] oturumu kapatır (gönderilmemiş okutma varsa uyarır).'],
        ['**Bağlantı ve senkronizasyon**', 'Sunucu adresi (Apps Script `/exec`) [[Adresi kaydet]] ile kaydedilir, [[Bağlantıyı dene]] ile sınanır; [[Çevrimiçi olunca kuyruğu otomatik gönder]] kuyruğun kendiliğinden gitmesini açar/kapar.'],
        ['**Öğrenci / veli sorgulama bağlantısı**', 'Velilerle paylaşacağınız sonuç sorgulama adresi; [[Kopyala]] ile kopyalayıp WhatsApp grubuna ya da okul sitesine koyun.'],
        ['**Öğretmen hesabı**', 'Öğretmen hesaplarında kişisel/kurumsal sınav görünürlüğü kuralını hatırlatır.'],
        ['**Form görünümü**', 'Yazdırılan formların altına basılacak okul/kurum yazısını belirler (boş bırakırsanız yazı basılmaz). Form kimlik kodu her zaman basılır.'],
        ['**Parola değiştir**', 'Eski parolayı ve yeni parolayı yazıp [[Değiştir]]’e basın.'],
        ['**Uygulama**', 'Telefona/bilgisayara kurma bilgisi; kurulunca internet olmadan da açılır. ((kurulum|Kurulum))']
      ]],
      ['warn', 'Sunucu adresini yalnızca sistem yöneticinizin verdiği adresle değiştirin; yanlış adres giriş ve gönderimi bozar.']
    ]
  },

  /* ================================================================ 13. YARDIM */
  {
    id: 'hata-kodlari', cat: 'yardim', title: 'Hata kodları, nedenleri ve çözümleri', aud: 'herkes', kw: 'hata kodu wa_login wa_not_on_wa wa_invalid_phone wa_timeout wa_send_btn wa_rate_limit wa_tab_closed auth velikodu throttle noai aikey aimodel aiscope inuse çözüm',
    sum: 'WhatsApp eklentisi ve sistem genelinde karşılaşabileceğiniz tüm hata kodlarının anlamı ve çözümü.',
    see: ['wa-mesaj', 'sss', 'okut-sorun'],
    body: [
      ['h', 'WhatsApp Eklentisi Hata Kodları'],
      ['table', ['Hata Kodu', 'Nedeni', 'Nasıl Çözülür?'], [
        ['`WA_LOGIN`', 'WhatsApp Web oturumu açık değil veya QR kod ekranı çıktı.', '`web.whatsapp.com` sekmesini açın, telefonunuzdaki WhatsApp / WhatsApp Business ile QR kodu okutun ve eklentide **Devam Et**’e basın.'],
        ['`WA_NOT_ON_WA`', 'Telefon numarası WhatsApp’ta kayıtlı değil veya numara yanlış yazılmış.', '{{Yönetim → Öğrenciler}} ekranından veli telefonunu kontrol edip düzeltin; sabit hat yerine cep telefonu (`05xx…`) girin.'],
        ['`WA_INVALID_PHONE`', 'Telefon numarası biçimi geçersiz (eksik hane veya harf içeriyor).', 'Numarayı `0532 111 22 33` veya yurt dışı ise `+ülke kodu` biçiminde kaydedin.'],
        ['`WA_TIMEOUT`', 'WhatsApp Web sohbet ekranı 25 saniye içinde yüklenmedi.', 'İnternet bağlantınızı kontrol edin; WhatsApp Web sekmesini bir kez yenileyip yalnızca hatalı kalanları tekrar gönderin.'],
        ['`WA_SEND_BTN`', 'Mesaj kutusu açıldı ancak gönder düğmesi bulunamadı.', 'WhatsApp Web arayüzü geç yüklendiğinde olur; bekleme süresini 12–15 saniyeye çıkarıp hatalı satırı yeniden deneyin.'],
        ['`WA_RATE_LIMIT`', 'Kısa sürede çok fazla mesaj gönderilmeye çalışıldı.', 'Mesaj arası bekleme süresini artırın (15+ sn) ve 10–15 dakika ara verdikten sonra devam edin.'],
        ['`WA_TAB_CLOSED`', 'Arka plandaki WhatsApp Web sekmesi kapatıldı.', 'Gönderim bitmeden arka plandaki WhatsApp sekmesini kapatmayın; eklentiden kuyruğu yeniden başlatın.']
      ]],
      ['h', 'Sistem ve Sunucu Hata Kodları'],
      ['table', ['Hata Kodu', 'Nedeni', 'Nasıl Çözülür?'], [
        ['`AUTH`', 'Oturum süresi dolmuş veya geçersiz.', 'Çıkış yapıp kullanıcı adı ve parolanızla yeniden giriş yapın.'],
        ['`VELIKODU`', 'Öğrenci için veli kodu tanımlı ancak girilmemiş veya hatalı.', 'Okulun verdiği 6 haneli veli kodunu doğru girin; bilmiyorsanız okul yöneticisinden isteyin.'],
        ['`THROTTLE`', 'Kısa sürede çok fazla sorgu veya hatalı deneme yapıldı.', 'Güvenlik kilidi nedeniyle bir süre bekleyip doğru bilgilerle tekrar deneyin.'],
        ['`NOAI` / `AIKEY` / `AIMODEL`', 'Yapay zekâ API anahtarı eksik, reddedildi veya model adı geçersiz.', '{{Yönetim → Yapay zekâ}} sekmesinden anahtarı kontrol edip **Dene** düğmesiyle doğrulayın.'],
        ['`AISCOPE`', 'Apps Script dış bağlantı (`UrlFetchApp`) izni verilmemiş.', 'Apps Script düzenleyicisinde `izinleriVer` işlevini bir kez çalıştırıp izin verin ve yeni dağıtım sürümü alın.'],
        ['`INUSE`', 'Silinmek istenen okula bağlı aktif kullanıcı hesapları var.', 'Önce {{Yönetim → Kullanıcılar}} sekmesinden o okula bağlı hesapları pasifleştirin, ardından okulu silin.']
      ]]
    ]
  },
  {
    id: 'sss', cat: 'yardim', title: 'Sık sorulan sorular', aud: 'herkes', kw: 'sss sorun nasıl yapılır hata çözüm internet yok sıfırla unuttum görünmüyor menü yok',
    sum: 'En sık karşılaşılan durumlar ve kısa çözümleri.',
    see: ['giris', 'okut-sorun', 'veli-sss', 'kuyruk', 'sinav-durum'],
    body: [
      ['table', ['Durum', 'Çözüm'], [
        ['Menüde **Yönetim** ya da **Sınavlar** yok', 'Menü rolünüze göredir. Öğretmende Yönetim yoktur; yetkiniz için okul yöneticinize sorun. ((roller|Roller))'],
        ['Okut ekranında **sınavım yok**', 'Sınav “okutmaya açık” olmalı ve okutma yetkiniz bulunmalı. Öğretmen yalnızca kendi kişisel sınavını okutur; okul sınavlarını okul yöneticisi okutur. ((sinav-durum|Sınav durumu))'],
        ['Okutma **gönderilmiyor**', '{{Kuyruk}} ekranında durumu görün: Hata ise nedeni satırdadır; internet yoksa bağlantı gelince gider. ((kuyruk|Kuyruk))'],
        ['Form **okunamıyor**', 'Daha net, düz ve gölgesiz taratın; yazdırmada ölçek %100 olsun. ((okut-sorun|Uyarılar))'],
        ['Öğrencim **listede yok**', 'Okul yöneticisi öğrenci listesini yüklemeli. ((yon-ogrenciler|Öğrenci yükleme))'],
        ['**Parolamı** unuttum', 'Okul yöneticinize (öğretmense) ya da üst yetkiliye başvurun; yeni parola {{Yönetim → Kullanıcılar}}’dan verilir.'],
        ['Veli sonucu **göremiyor**', 'Sınav “öğrenci/veli sorgulamasına açık” olmalı; okul ve öğrenci listesi yüklü olmalı. ((veli-sss|Veli için sık sorunlar))'],
        ['Yeni sürüm **görünmüyor**', 'Sayfayı bir kez yenileyin; uygulama olarak yüklüyse kapatıp yeniden açın.'],
        ['Yazdırmada **grafik/renk yok**', 'Yazdırma penceresinde “arka plan grafikleri”ni açın.']
      ]]
    ]
  },
  {
    id: 'sozluk', cat: 'yardim', title: 'Sözlük: terimler', aud: 'herkes', kw: 'sözlük terim net doğru yanlış boş standart puan kitapçık şablon kapsam kuyruk dpi baloncuk',
    sum: 'Kılavuzda geçen terimlerin kısa anlamları.',
    see: ['sinav-puan', 'form-secenek'],
    body: [
      ['table', ['Terim', 'Anlamı'], [
        ['**Net**', 'Doğru sayısından yanlışların katsayılı karşılığının çıkarılmasıyla bulunur.'],
        ['**Başarı %**', 'Net ÷ soru sayısı; farklı uzunluktaki sınavları kıyaslamak için ortak ölçüt.'],
        ['**Standart puan**', 'Sonucun sınav geneline göre konumunu gösteren puan (ortalama 50, sapma 10 temelli).'],
        ['**Kitapçık**', 'Aynı sınavın A, B gibi soru sıralı farklı basımları; her birinin ayrı anahtarı vardır.'],
        ['**Şablon**', 'Optik formun yerleşim tanımı: soru, öğrenci no ve kitapçık baloncukları nerede.'],
        ['**Baloncuk**', 'Formda işaretlenen daire/oval.'],
        ['**Kapsam**', 'Sınava katılan okulların aralığı: tek okul, ilçe, il.'],
        ['**Kuyruk**', 'Okutulup henüz sunucuya gönderilmemiş kayıtlar.'],
        ['**Kurum kodu**', 'Okulun MEB kurum kodu; formdaki hanelerden okulun otomatik bulunmasını sağlar.'],
        ['**Veli kodu**', 'Okulun öğrenciye verdiği, sonucu sorgulamayı güvenceye alan kod.'],
        ['**dpi**', 'Tarama çözünürlüğü; 200–300 dpi yeterlidir.'],
        ['**Dış sınav**', 'Başka kurumda yapılan, sonucu Excel/CSV ile aktarılan sınav.']
      ]]
    ]
  },
  {
    id: 'kisayol', cat: 'yardim', title: 'İpuçları ve kısayollar', aud: 'herkes', kw: 'kısayol klavye ipucu ctrl z ok tuşları enter yardım düğmesi',
    sum: 'Zaman kazandıran küçük ayrıntılar.',
    see: ['form-duzenleyici', 'okut-inceleme'],
    body: [
      ['ul', [
        'Ekranın üstündeki **?** düğmesi bulunduğunuz ekran için ilgili kılavuz konusunu açar.',
        'Kılavuzda arama kutusu Türkçe harf farkını yok sayar (`yildiz` → Yıldız).',
        'Her konuda **Ekranı aç** düğmesi sizi doğrudan ilgili ekrana ve sekmeye götürür.',
        'Kılavuzu **yazdır / PDF** yapabilir, tek bir konunun bağlantısını kopyalayıp paylaşabilirsiniz.',
        'Form düzenleyicide: Ctrl+Z / Ctrl+Y geri al-yinele, ok tuşları seçili bloğu kaydırır (Shift ×5, Alt ×0,5), Del bloğu siler.',
        'Form incelemede klavyede harf tuşları (A, B, C…) seçili sorunun cevabını yazıp sonraki soruya geçer.',
        'Satır satır dış sınav girişinde Enter alt satıra geçer.'
      ]]
    ]
  }
]);
