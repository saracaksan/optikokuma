# Canlı arayüz ve ortak okul seçimi (OptiNet)

Bu sürümde üç şey değişti: **seçimler her ekranda ortak**, **dosya seçimi artık görünür**, **düğmeler ve seçimler canlı**.

## 1. İl / ilçe / düzey / okul seçimi her yerde aynı

Bir ekranda seçtiğiniz il, ilçe, okul düzeyi ve okul, diğer tüm ekranlarda da **etkin** gelir. Cihazda saklanır; sayfayı yenileseniz, uygulamayı kapatıp açsanız da korunur.

| Ekran | Ne olur |
|---|---|
| Okut | Okul kutusu il/ilçe süzgeçlidir; ortak okul seçili gelir. ("Formdaki kurum kodundan otomatik" seçeneği, siz seçtiyseniz korunur.) |
| Sınavlar → Yeni sınav | Kapsam listesi aynı il/ilçe/düzey süzgeciyle daralır. Yeni sınavın kapsamı **seçili okul → ilçe → il** sırasıyla başlar (altında ipucu yazısı çıkar; yeniden "Genel" seçebilirsiniz). |
| Sonuçlar | "Öğrenciler" sekmesi, ortak okulun öğrencileriyle açılır ("Tüm okullar"ı seçerek genişletebilirsiniz). |
| Analiz | Ortak okul/süzgeçle açılır; Dış sınav penceresinde okul değiştirirseniz arkadaki Analiz de aynı okula geçer. |
| Formlar (kişiye özel / kodlu baskı) | Aynı seçici, aynı seçim. |
| Yönetim → Okullar / Öğrenciler / Veli WhatsApp | Aynı süzgeç ve aynı okul. |

Kurallar:
- Süzgeç seçili okulu dışarıda bırakırsa (örn. okul İstanbul'da, siz il = Ankara dediniz) okul seçimi temizlenir; il ile okul çelişmez.
- Arama kutusuna yazdığınız metin ortak **değildir** (ekranlar arası taşınmaz).
- Öğrenci/veli sorgulama sayfası (`#/ogrenci`) ve üyelik sayfası (`#/kayit`) herkese açık, ayrı sayfalardır; ortak seçimi kullanmaz.
- Seçimi sıfırlamak için süzgeçlerde "Tüm iller / Tüm ilçeler / Tüm düzeyler"i seçin.

## 2. Dosya seçici

- "Dosya seçilmedi" yazısı kalktı. Seçtiğiniz dosyanın **adı ve boyutu** pembe bir çipte görünür ("✓ sonuclar.xlsx · 84 KB · seçildi"). Çok dosyada "12 dosya · 3,4 MB".
- Dosya işlenirken çipte **dönen simge + "okunuyor…"** ve sayfanın üstünde ilerleme çubuğu çalışır.
- Dış sınav penceresinde büyük "Excel / CSV dosyası seç" düğmesi vardır; dosyayı düğmeye/kutuya **sürükleyip bırakabilirsiniz**.
- Yönetim ("CSV dosyası seç"), Okut ("Dosya seç", "Fotoğraf çek") ve Formlar dosya girişlerinde de aynı çip, düğmenin yanında çıkar.

## 3. Canlı etkileşim

- **Pembe = mutlu**: düğmenin, sekmenin, kutunun üzerine gelince pembe çerçeve/parıltı; basınca dalga ve pembe halka; seçilen satır/sınav/öğrenci pembe zeminli; onay kutuları ve işaret kutuları pembe.
- Bir seçim kutusundan (sınav, okul, sınıf…) seçim yapınca kutu kısa süre parlar ve üstteki **ilerleme çubuğu** çalıştığını gösterir.
- Sunucuya giden her istekte (0,12 sn'den uzun sürerse) üstte ince pembe ilerleme çubuğu akar; çok kısa işlerde yanıp sönmez.
- Ekran geçişleri ve bildirimler yumuşakça gelir.
- Cihazınızda **"hareketi azalt"** (erişilebilirlik) açıksa tüm animasyonlar kapanır; çubuk sabit görünür.

## Geliştirici notları
- `canli.js` (yeni): `FilePick`, düğme dalgası, seçim "pop", ekran geçişi. `app.js`: `Sel` (ortak seçim deposu), `Busy` (ilerleme çubuğu), `schoolFilterBar` / `schoolPicker` (artık `Sel`'e bağlı).
- Yeni bir okul seçicisi eklerken `schoolPicker(select, okullar)` kullanmanız yeterlidir; ortak seçim kendiliğinden çalışır. Bağımsız olmasını isterseniz `{ shared: false }`.
- Her `<input type=file>` `h()` ile oluşturulduğunda onchange'i otomatik sarılır; ek iş gerekmez. Görünür düğme isterseniz `FilePick.field(input, { label })`.
- Renkler `style.css` sonundaki `--pink*` değişkenlerindedir (tek yerden değişir).
- Test: `testler/test_ui13.js`.
