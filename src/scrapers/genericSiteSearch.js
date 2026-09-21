const axios = require('axios');
const cheerio = require('cheerio');

const DEFAULT_KEYWORDS = ['مناقصه', 'مزایده', 'پروژه', 'استعلام', 'پیمانکار', 'همکاری', 'فراخوان'];
const SUBPAGE_LINK_HINTS = ['مناقصه', 'مزایده', 'پروژه', 'اخبار', 'فراخوان', 'اطلاعیه', 'tender', 'project', 'news'];
const MAX_SUBPAGES = 3;

/**
 * اسکرپر عمومی برای «لیست شرکت‌های پیمانکاری بزرگ تهران» و «کارفرمایان دولتی خاص»
 * که کاربر خودش نام + آدرس وب‌سایت را در تنظیمات وارد می‌کند.
 *
 * چون ساختار هر سایت متفاوت است، این ماژول یک اسکرپر «حداکثر تلاش» (best-effort) است:
 * ابتدا صفحه اصلی را می‌خواند و در آن دنبال کلیدواژه می‌گردد؛ سپس از همان صفحه اصلی
 * تا ۳ لینک داخلی که به نظر می‌رسد به مناقصات/پروژه‌ها/اخبار مربوط باشند (بر اساس متن
 * لینک) را هم باز کرده و همان‌جا هم جستجو می‌کند - نه فقط صفحه اصلی.
 * برای سایت‌های خیلی پیچیده (SPA/AJAX) ممکن است باز هم نتیجه‌ای پیدا نکند - در آن صورت
 * باید مثل سازه جو/ستاد ایران یک اسکرپر اختصاصی نوشت.
 */
async function searchGenericSite({ name, url }, keyword) {
  const client = axios.create({
    timeout: 15000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36' }
  });

  const keywords = keyword ? [keyword, ...DEFAULT_KEYWORDS] : DEFAULT_KEYWORDS;
  const allLeads = [];
  const visitedUrls = new Set();

  try {
    const homeHtml = await fetchPage(client, url);
    const $home = cheerio.load(homeHtml);
    allLeads.push(...extractLeads($home, url, name, keywords));
    visitedUrls.add(url);

    // پیدا کردن لینک‌های داخلی مرتبط با مناقصه/پروژه/اخبار برای بررسی عمیق‌تر
    const subpageLinks = findRelevantSubpages($home, url);
    for (const subUrl of subpageLinks.slice(0, MAX_SUBPAGES)) {
      if (visitedUrls.has(subUrl)) continue;
      visitedUrls.add(subUrl);
      try {
        const subHtml = await fetchPage(client, subUrl);
        const $sub = cheerio.load(subHtml);
        allLeads.push(...extractLeads($sub, subUrl, name, keywords));
      } catch (e) {
        // اگر یک زیرصفحه خطا داد، از بقیه صرف‌نظر نمی‌کنیم
      }
    }
  } catch (err) {
    throw new Error(`خطا در خواندن سایت ${name}: ${err.message}`);
  }

  // حذف موارد تکراری (بر اساس متن)
  const seenText = new Set();
  return allLeads.filter(lead => {
    if (seenText.has(lead.rawText)) return false;
    seenText.add(lead.rawText);
    return true;
  });
}

async function fetchPage(client, url) {
  const res = await client.get(url);
  return res.data;
}

function findRelevantSubpages($, baseUrl) {
  const links = [];
  $('a').each((i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (!href || !text) return;
    const isRelevant = SUBPAGE_LINK_HINTS.some(hint => text.toLowerCase().includes(hint.toLowerCase()));
    if (isRelevant) {
      try {
        const abs = new URL(href, baseUrl).toString();
        if (abs.startsWith('http') && !links.includes(abs)) links.push(abs);
      } catch (e) { /* لینک نامعتبر - رد شود */ }
    }
  });
  return links;
}

function extractLeads($, pageUrl, siteName, keywords) {
  const candidates = [];
  $('a').each((i, el) => {
    const text = $(el).text().trim();
    const href = $(el).attr('href');
    if (text && text.length > 3) candidates.push({ text, href });
  });
  $('p, li, h1, h2, h3').each((i, el) => {
    const text = $(el).text().trim();
    if (text && text.length > 5) candidates.push({ text, href: null });
  });

  const leads = [];
  const seen = new Set();
  candidates.forEach(({ text, href }) => {
    const matched = keywords.some(k => text.includes(k));
    if (!matched || seen.has(text)) return;
    seen.add(text);
    let absoluteUrl = '';
    if (href) {
      try { absoluteUrl = new URL(href, pageUrl).toString(); } catch (e) { absoluteUrl = href; }
    }
    leads.push({
      title: text.slice(0, 200),
      address: '',
      phone: '',
      employer: siteName,
      stage: '',
      url: absoluteUrl || pageUrl,
      rawText: text,
      site: siteName,
      foundAt: new Date().toISOString(),
      id: `custom-${Buffer.from(siteName + text).toString('base64').slice(0, 16)}`
    });
  });
  return leads;
}

module.exports = { searchGenericSite };

