# OptiNet'i telefona / bilgisayara uygulama olarak yükleme

OptiNet bir PWA'dır: tarayıcıdan **doğrudan ekrandan** yüklenir, ana ekranda kendi simgesiyle tam ekran açılır, internet yokken de çalışır (okutulan kâğıtlar cihazda saklanır, bağlanınca gönderilir). Mağazadan indirmek gerekmez.

## Kullanıcı ne görür?
- **Giriş ekranında** ve **veli sorgulama sayfasında** "OptiNet'i telefonunuza yükleyin" kartı.
- **Uygulamada üst çubukta** küçük **Uygulamayı kur** düğmesi (yüklendikten sonra kaybolur).
- **Telefonlarda** uygulamaya girince altta kapatılabilir bir şerit (kapatılırsa 14 gün boyunca çıkmaz).
- Uygulama zaten ana ekrandan açılmışsa bu düğmelerin hiçbiri görünmez.

## Android (Chrome, Edge, Samsung Internet)
1. Siteyi açın, kartta **Uygulamayı kur**'a (şeritte **Kur**'a) dokunun.
2. Çıkan kutuda **Yükle**'yi onaylayın. OptiNet simgesi ana ekrana ve uygulama listesine eklenir.
- Kutu hemen açılmazsa (Chrome siteyi biraz kullandıktan sonra hazırlar) düğme adımları gösterir: **⋮ menü → Uygulamayı yükle** (ya da *Ana ekrana ekle*).

## iPhone / iPad
Apple, web uygulamalarının tek dokunuşla yüklenmesine izin vermez; bu yüzden düğme adımları ekranda gösterir:
1. **Safari**'de siteyi açın → **Paylaş** düğmesi (kare içinden çıkan ok).
2. **Ana Ekrana Ekle** → adı **OptiNet** bırakıp **Ekle**.
- iPhone'da Chrome/Edge ile açıldıysa aynı Paylaş menüsü kullanılır (iOS 16.4+); olmazsa Safari'de açın.
- WhatsApp/Instagram gibi bir uygulamanın **içinde** açılan bağlantılarda yükleme yapılamaz; ⋯ menüsünden **Safari'de aç** deyin.

## Bilgisayar (Windows, Mac, Chromebook)
Chrome ya da Edge'de adres çubuğunun sağındaki **Yükle** simgesine ya da üst çubuktaki **Uygulamayı kur** düğmesine tıklayın. OptiNet ayrı pencerede açılır. Firefox masaüstü uygulama yüklemeyi desteklemez; Safari'de *Dosya → Dock'a Ekle*.

## Yöneticiye notlar
- Yükleme için site **HTTPS** üzerinden yayınlanmalıdır (GitHub Pages zaten öyledir) ve servis çalışanı (`sw.js`) çalışmalıdır.
- Uygulama güncellenince (servis çalışanı sürümü `optik-v18`) açılışta yeni sürüm iner; kullanıcının yeniden yüklemesi gerekmez. Eski ad/simgeyle yüklenmiş cihazlarda simge ve adın değişmesi için uygulamayı kaldırıp yeniden eklemek gerekir.
- Ad ve simge: `manifest.webmanifest`, `index.html`, `icon*.png`, `icon.svg`.
- Düğmelerin kodu: `kur.js` (tek dosya); Android'in `beforeinstallprompt` olayı sayfa açılır açılmaz yakalansın diye en önce yüklenir.
