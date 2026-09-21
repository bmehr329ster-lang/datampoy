const BaseScraper = require('./base');

/**
 * برای سایت‌هایی مثل «ایران تندر» و «آرتا پارسیان مازندران» که آدرس دقیق و
 * ساختار صفحاتشان هنوز تایید نشده. وقتی آدرس/نمونه HTML را دادید،
 * این فایل به یک اسکرپر واقعی (مثل sazejoo.js) تبدیل می‌شود.
 */
class GenericPlaceholderScraper extends BaseScraper {
  async run() {
    console.warn(`[${this.siteMeta.name}] آدرس/ساختار سایت هنوز تنظیم نشده - این سایت نادیده گرفته شد.`);
    return [];
  }
}

module.exports = GenericPlaceholderScraper;
