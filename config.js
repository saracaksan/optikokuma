/* config.js — Varsayılan Sunucu (Google Apps Script /exec) Adresi
 * Sıraç Aksan Optik Okuma · Telif Hakkı © Sıraç AKSAN (İzinsiz kopyalamak, dağıtmak veya telif atmak ayıptır.)
 *
 * Nasıl çalışır?
 *  - Bu dosya GitHub deposuna yüklendiğinde öğretmenler, veliler, öğrenciler ve yöneticiler
 *    uygulamayı açtıklarında sunucu (/exec) adresi sorulmadan doğrudan bu veri tabanına bağlanır.
 *  - İsteyen bir okul veya kullanıcı Ayarlar ekranından kendi Apps Script /exec adresini yapıştırırsa
 *    öncelikle kendi yapıştırdığı adres kullanılır; boş bırakırsa veya sıfırlarsa otomatik olarak
 *    buradaki varsayılan adrese döner.
 *  - İleride varsayılan veri tabanını değiştirmek isterseniz yalnızca GitHub'daki bu dosyadaki
 *    apiUrl değerini güncellemeniz yeterlidir.
 */
window.OPTIK_CONFIG = {
  apiUrl: 'https://script.google.com/macros/s/AKfycbydGtPKELuY9fpEEVQMEtswLM7P6ScIeRj213tqvT-Gr_Gj5fS2oOAJxegzEtWr5wzF7A/exec'
};
