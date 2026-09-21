const cheerio = require('cheerio');
const BaseScraper = require('./base');
const Store = require('electron-store');
const store = new Store({ name: 'project-finder-config' });

/**
 * سازه جو (sazejoo.com):
 * اطلاعات تماس مسئول پروژه پشت اشتراک کاربری است. کاربر باید یک‌بار در
 * تنظیمات برنامه، نام کاربری/رمز اشتراک خودش را وارد کند (ذخیره رمزنگاری‌شده محلی).
 *
 * نکته مهم: ساختار دقیق فرم لاگین و HTML صفحه‌ی لیست پروژه‌ها روی این سایت
 * باید بعد از ورود واقعی با حساب مشترک بررسی و سلکتورهای زیر اصلاح شود.
 * فعلاً این فایل یک اسکلت کامل و آماده اتصال است.
 */
class SazejooScraper extends BaseScraper {
  async login() {
    const creds = store.get('credentials.sazejoo');
    if (!creds || !creds.username || !creds.password) {
      throw new Error('برای سازه جو باید ابتدا نام کاربری/رمز اشتراک را در تنظیمات وارد کنید.');
    }
    // TODO: جایگزین با فرم لاگین واقعی سازه جو (endpoint دقیق را باید از سایت واقعی گرفت)
    // نمونه فرضی:
    // const res = await this.client.post(`${this.siteMeta.baseUrl}/wp-login.php`, qs.stringify({
    //   log: creds.username, pwd: creds.password
    // }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    // this.client.defaults.headers.Cookie = res.headers['set-cookie'].join('; ');
    throw new Error('اتصال ورود سازه جو هنوز پیاده‌سازی نشده - نیاز به بررسی فرم لاگین واقعی سایت.');
  }

  async run() {
    await this.login();
    const html = await this.fetchHtml(`${this.siteMeta.baseUrl}/projects`); // آدرس واقعی صفحه لیست باید تایید شود
    const $ = cheerio.load(html);
    const leads = [];

    // TODO: سلکتورهای زیر باید با بررسی HTML واقعی صفحه (بعد از ورود) جایگزین شوند
    $('.project-card').each((i, el) => {
      const title = $(el).find('.project-title').text().trim();
      const address = $(el).find('.project-address').text().trim();
      const phone = $(el).find('.project-phone').text().trim();
      const employer = $(el).find('.project-employer').text().trim();
      const stage = $(el).find('.project-stage').text().trim();
      const url = $(el).find('a').attr('href');
      leads.push(this.makeLead({ title, address, phone, employer, stage, url, rawText: `${title} ${address} ${stage}` }));
    });

    return leads;
  }
}

module.exports = SazejooScraper;
