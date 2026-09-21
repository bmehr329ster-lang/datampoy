const axios = require('axios');

class BaseScraper {
  constructor(siteMeta) {
    this.siteMeta = siteMeta;
    this.client = axios.create({
      timeout: 20000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36'
      }
    });
  }

  async fetchHtml(url) {
    const res = await this.client.get(url);
    return res.data;
  }

  // هر اسکرپر باید این متد را پیاده‌سازی کند
  async run() {
    throw new Error(`run() باید در اسکرپر سایت ${this.siteMeta.name} پیاده‌سازی شود`);
  }

  // ساختار استاندارد هر لید (سرنخ پروژه)
  makeLead({ title, address, phone, employer, stage, url, rawText }) {
    return {
      id: `${this.siteMeta.id}-${Buffer.from(url || title).toString('base64').slice(0, 16)}`,
      site: this.siteMeta.name,
      title: title || '',
      address: address || '',
      phone: phone || '',
      employer: employer || '',
      stage: stage || '',
      url: url || '',
      rawText: rawText || '',
      foundAt: new Date().toISOString()
    };
  }
}

module.exports = BaseScraper;
