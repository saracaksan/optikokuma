# Sınav analizi ve dış sınav aktarımı

**Analiz** menüsü, sistemde okuttuğunuz sınavlarla **dışarıdan aldığınız** sınavları (yayınevi LGS/TYT denemeleri, başka kurumların sonuç listeleri) tek ekranda birlikte gösterir: doğru–yanlış–net, puan, dereceler ve **net/puan artışı**. Her sınavın hangi kaynaktan olduğu rozetle yazar: **Sistem** ya da **Dış · DARGE Yayınları** gibi.

## 0) Okul seçimi (il → ilçe → düzey → okul)
Okul listesi uzunsa her okul seçiminin üstünde süzgeçler çıkar: **İl**, **İlçe**, **Okul düzeyi** (Okul öncesi / İlkokul / Ortaokul / Lise / Diğer) ve **arama** (okul adı ya da kodu; Türkçe harf farkı yok sayılır: `yildiz` → Yıldız Ortaokulu). Süzgeçler birbirine bağlıdır: il seçince ilçe listesi o ilin ilçelerine, düzey listesi o bölgede bulunan düzeylere iner; sağda kaç okul kaldığı yazar. Aşağıdaki okul kutusu yalnızca süzülen okulları gösterir. Seçili okul süzgeç dışında kalırsa listedeki ilk okula geçilir.
- Süzgeçler **dış sınav ekleme**, **Analiz**, **Formlar** (form tasarla/yazdır ve kodlu baskı), **Veli WhatsApp**, **Yönetim → Öğrenciler** ve **Yönetim → Okullar** (kayıtlı okullar tablosu) ekranlarındadır.
- Ayırt edici olmayan süzgeç görünmez: yalnızca bir okulu olan kullanıcıda (okul yöneticisi/öğretmen) hiç süzgeç çıkmaz; tek il varsa il kutusu çıkmaz; 8'den az okul varsa arama kutusu çıkmaz.
- Okul **eklemek** için: Yönetim → Okullar → "+ Okul ekle" (il, ilçe, düzey yazılır) ya da Excel'den toplu yapıştırma.

## 1) Dış sınav ekleme

**Analiz → + Dış sınav ekle.** Üç yol vardır; hepsi aynı ekranda:

| Yol | Nasıl |
|---|---|
| **Excel şablonu** | "Hazır Excel şablonunu indir" → dersleri ve soru sayılarını seçin (LGS hazır) → indirilen `.xlsx`'i doldurun → "Excel / CSV yükle" ile seçin. |
| **Kendi dosyanız** | Başlığında `Ö.No` ve ders başına D/Y/N sütunları olan herhangi bir Excel/CSV (örn. yayınevinden aldığınız liste) doğrudan okunur. Sütun adları esnektir: `Ö.No`, `İsim`, `Sınıf`, `Türkçe D / Y / N`, `Toplam`, `LGS Puanı`, `Dereceler (Snf, Okul, İlçe, İl, Genel)`. |
| **Satır satır** | "Satır satır gir" ya da yükleme sonrası ikinci sekme: Ö.No yazınca ad ve sınıf öğrenci listesinden gelir, D ve Y'yi girince net ve toplam otomatik hesaplanır, Enter alt satıra geçer. |

Yapıştırma da olur: Excel'de tabloyu (başlık dahil) kopyalayıp "Ya da tabloyu yapıştır" kutusuna koyun.

### Şablonun düzeni (PDF sonuç listesiyle aynı)
`Sıra · Ö.No · İsim · Sınıf · [her ders için D Y N] · Toplam D Y N · Puan · Dereceler (Snf Okul İlçe İl Genel) · Genel %` ve üstte **Genel Ortalama / Okul Ortalaması** satırları. Sayfalar:
- **Sınav Bilgisi** — sınav adı, tarih, kaynak/kurum, puan adı, yanlış kuralı ("3 yanlış 1 doğruyu götürür" → `3`).
- **Sonuçlar** — doldurulacak tablo (iki satırlı başlık, birleşik hücreler; 3–4. satırlar ortalamalar, 5. satırdan öğrenciler).
- **Dersler** — ders adları ve soru sayıları.
- **Örnek** — kurgusal iki öğrenciyle doldurulmuş örnek (yüklenmez) · **Açıklama** — kısa yönerge.

### Kurallar
- Zorunlu tek sütun **Ö.No**'dur. İsim/Sınıf boşsa okulun öğrenci listesinden tamamlanır; listede olmayan öğrenci dosyadaki adıyla eklenir ve özette uyarılır.
- **Net boşsa** `D − Y × katsayı` ile hesaplanır; **Toplam boşsa** derslerden toplanır. Ondalık virgül ya da nokta olabilir (`18,67`, `1.234,5`).
- **Dereceler** isteğe bağlıdır; dosyada yoksa Okul ve Sınıf sırası ekranda **hesaplanır** (eğik/soluk gösterilir). İlçe/İl/Genel hesaplanamaz.
- **Ders soru sayısı** dosyada yoksa en yüksek D+Y değerinden tahmin edilir (özette `?` ile işaretlenir; düzeltebilirsiniz).
- Aynı Ö.No iki kez varsa sonuncusu geçerlidir. CSV'de ayraç `;` `,` ya da sekme; Türkçe Windows (1254) kodlaması da okunur.
- Eski `.xls` açılmaz: Excel'de "Farklı kaydet → Excel Çalışma Kitabı (.xlsx)" ya da CSV seçin.

### Mevcut sınava ekleme / düzenleme
- Kaydederken **"Mevcut sınava ekle"** seçilirse aynı numaralı öğrenciler güncellenir, diğerleri korunur (iki sınıfın dosyasını ayrı ayrı yüklemek için). Dersler sınavdakiyle **adına göre** eşleşir; uyuşmayanlar için uyarılırsınız.
- Sınav satırındaki **Düzenle** tüm öğrencileriyle birlikte tabloyu açar; **Sil** sınavı ve sonuçlarını kaldırır.

## 2) Analiz ekranı

Üstte okulu seçin (kendi okulunuz hazır gelir) ve analize girecek sınavları işaretleyin (sistem + dış). Ardından:

**Sınav listesi** — seçtiğiniz tek sınavın sonuç listesi, PDF'teki gibi: Genel/Okul Ortalaması satırları, her ders için D-Y-N, toplam, puan ve dereceler. Başlığa tıklayıp sıralayın; "⬇ Excel" şablonla **aynı düzende** indirir (tekrar yüklenebilir).

**Öğrenci** — öğrencinin **numarasını ya da adını** yazın (ya da sınıf seçip listeden tıklayın; ‹ Önceki / Sonraki › ile sınıfta gezin). Görürsünüz:
- Başlıkta ad, sınıf, **kaç sınava girdi** (girmediği sınavlar adıyla), ortalama net / başarı / puan, son sınav ve bir öncekine göre değişim, sınav başına değişim ve eğilim, en iyi okul sırası.
- **Değerlendirme**: veriden üretilen kısa cümleler (yükseliş/düşüş eğilimi, en yüksek/düşük sınav, sınıf ortalamasına göre en güçlü ve en zayıf ders, en çok gelişen/gerileyen ders, sıra değişimi). Yapay zekâ değil, kurala dayalıdır.
- **Gelişim grafiği** (Başarı % / Net / Puan seçilebilir): öğrenci + sınıf ortalaması + okul ortalaması; fareyle (ya da ←/→ tuşlarıyla) üzerine gelince ayrıntı çıkar. **Sıralama grafiği**: okul ve sınıf sırası (1 = en iyi).
- **Ders ders başarı**: Türkçe, Matematik… düğmeleriyle her dersin gelişimi, doğru/yanlış/boş dağılımı ve ders sırası; "Tüm dersler" ders profilini (öğrenci / sınıf / okul) gösterir.
- **Sınav sınav tablo**: D/Y/B, net, puan, başarı %, sınıf ortalaması, sınıf/okul/ilçe/il/genel sıra ve her ders (hücre rengi sınıf ortalamasına göre fark). Tablo altındaki "Tablo görünümü" her grafiğin sayılarını verir.
- Excel (Özet / Sınavlar / Dersler sayfaları) ve Yazdır (öğrenci raporu).

**Sınıf** — bir sınıfı ya da **tüm okulu** seçin: ortalama başarı, son sınav, eğilim, katılım, **sınıf sınıf gelişim grafiği**, katılım grafiği, ders ders başarı (sınıf / okul), ders × sınav ısı tablosu, **sınıf karşılaştırması** (her sınıfın her sınavdaki ve derslerdeki ortalaması; satıra tıklayınca o sınıf açılır), başarı dağılımı (%0–20 … %80–100), **öğrenci sıralaması** (başlığa tıklayıp sıralayın; her sınav ve ders sütunu, son değişim, küçük gidiş grafiği; satıra tıklayınca öğrencinin analizi) ve ders birincileri. Excel (3 sayfa) ve Yazdır.

**Ders** — dersi seçin (sınıf süzgeci isteğe bağlı): **ders × sınıf ısı haritası**, dersin sınav sınav gelişimi (sınıf çizgileri + okul), ortalama doğru/yanlış/boş, derslerin birbirine göre durumu (en güçlü → en zayıf), başarı dağılımı, sınav sınav tablo ve **en başarılı / en düşük 10 öğrenci**. Excel ve Yazdır.

**Başarı listeleri** — tek tıkla hazır listeler (hepsi sınıf süzgeciyle, Excel'e ve yazdırmaya hazır):
- *Genel sıralama* (ölçüt Başarı % / Net / Puan, "en az N sınav" süzgeci, okul ve sınıf sırası),
- *Ders sıralaması*,
- *Gelişenler / gerileyenler* (ilk sınavdan sonuncuya fark ve eğilim),
- *Dikkat edilecekler* (ortalaması ya da son sınavı sizin belirlediğiniz % sınırının altında, art arda düşenler, son sınavda 10+ puan düşenler, sınava girmeyenler; nedeni satırda yazar),
- *Katılım* (öğrenci × sınav matrisi; eksik girenler başta),
- *Sınav birincileri* (her sınavda ilk 3, ayrıca sınıf birincileri).

**Gelişim (net artışı)** — öğrenci × sınav tablosu. Her hücrede seçtiğiniz ölçüt (Net, Puan, Başarı %, Doğru, Yanlış; isterseniz tek bir ders) ve bir önceki sınava göre **▲/▼ değişim**; yanında *Son değişim*, *İlk → son* ve küçük bir gidiş grafiği. Üstte kaç öğrencinin arttığı/düştüğü ve ortalama değişim yazar. Öğrenciye tıklayınca **Öğrenci** sekmesi açılır.

**Karşılaştırma ve özet** — sınav sınav ortalama D/Y/net/puan/başarı %, değişimler, grafik, ders bazlı ortalama net ve sınıflara göre tablo. Sınıf süzgeci tüm sekmelerde çalışır.

Her sekmede **Excel** ve **Yazdır** vardır (yazdırmada menü ve düğmeler gizlenir, A4 yatay; grafikler sayfa sonunda bölünmez). Öğrenci, Sınıf ve Başarı listeleri sekmelerine **ilk girişte okuldaki tüm sınavlar otomatik işaretlenir** (yukarıdan istediğinizi kaldırabilirsiniz).

### Dikkat edilecekler
- **Farklı puan türleri karıştırılmaz.** Sistem sınavlarının "Puan"ı ile dış sınavın "LGS Puanı" aynı ölçekte olmadığından, puan grafiği ve ortalamaları yalnızca en çok kullanılan puan türünün sınavlarını kapsar; ekran bunu yazar. Karşılaştırma için tüm sınavlarda ortak olan **Başarı %** (net ÷ soru sayısı) kullanılır. Net ▲/▼ değişimi de yalnızca aynı soru sayılı ardışık sınavlar arasında gösterilir.
- **Sıralar**: dosyada / sunucuda sıra varsa o kullanılır (Sınıf, Okul, İlçe, İl, Genel); yoksa okul ve sınıf içinde puana (yoksa nete) göre hesaplanır, eşit değere aynı sıra verilir. İlçe / il / genel sıraları yalnızca dosyada varsa görünür.
- Sıralama listeleri öğrencinin **girdiği** sınavların ortalamasına göredir; girmediği sınav ortalamaya katılmaz (bu yüzden "en az N sınav" süzgeci vardır).
- Sınavların **soru sayıları farklıysa** net doğrudan kıyaslanamaz; ekran uyarır, **Başarı %** ya da **Puan** ölçütünü kullanın. Net artışı için en sağlıklısı aynı soru sayılı sınavları karşılaştırmaktır.
- Öğrenciler sınavlar arasında **Ö.No** ile eşleşir (aynı okul içinde). Numarası farklı yazılmış öğrenci iki ayrı satır olur.
- Sistem sınavlarında "Genel ortalama" yetki alanınızdaki katılımcılardan hesaplanır; dış sınavda dosyadaki Genel Ortalama satırı kullanılır (yoksa dosyadaki öğrencilerden).

## 3) Yetkiler ve gizlilik
- Dış sınavı **okul yöneticisi** (kendi okulu), **ilçe/il yetkilisi** (yetki alanındaki okullar) ve **yönetici** ekler/düzenler/siler; ilçe/il yetkilisi okul adına kaydedebilir.
- **Öğretmen** yalnızca kendi okulu için ve **kişisel** dış sınav ekler; bu sınavı yalnızca kendisi ve okul yöneticisi görür (sistemdeki kişisel sınavlarla aynı kural). Okulun genel dış sınavlarını öğretmen salt okunur görür.
- Sınırlar: tek çağrıda 700 satır (arayüz 300'erli gönderir), sınav başına 5000 öğrenci, okul başına 300 dış sınav, sınav başına 12 ders. Ad/kaynak metinlerindeki `=`, `+`, `-`, `@` ile başlayan formül işaretleri temizlenir; Excel çıktılarında metinler formül olarak yazılmaz.
- Veriler E-Tablodaki **DisSinav** ve **DisSonuc** sayfalarında tutulur (kod ilk istekte kendiliğinden oluşturur; veri silmez).

## 4) Kurulum / güncelleme
`Code.gs`'yi Apps Script'e yapıştırıp **yeni sürüm dağıtın** (şema `6-dis`: iki yeni sayfa eklenir). Siteyi güncelledikten sonra tarayıcıyı bir kez yenileyin (servis çalışanı `optik-v16`). Menüde **Analiz** düğmesi görünür.
