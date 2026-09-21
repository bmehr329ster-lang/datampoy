const siteConfig = require('../config/sites.json');
const { classify, isTargetProvince } = require('../services/classifier');
const { searchGenericSite } = require('./genericSiteSearch');
const Store = require('electron-store');
const store = new Store({ name: 'project-finder-config' });

const SCRAPER_MAP = {
  'sazejoo.js': require('./sazejoo'),
  'setadiran.js': require('./setadiran'),
  'irantender.js': require('./irantender'),
  'artaparsian.js': require('./generic_placeholder')
};

// سایت‌های داخلی قابل اسکرپ خودکار (لینکدین/اینستاگرام جزو این‌ها نیستند - فقط جستجوی مرورگری دارند)
const BUILTIN_SCRAPEABLE = siteConfig.sites.filter(s => s.scraperModule);

/**
 * opts:
 *  - siteIds: آرایه id سایت‌های داخلی برای اجرا (خالی/نامشخص = همه)
 *  - includeCustomCompanies: true/false یا آرایه id شرکت‌های خاص برای اجرا
 *  - includeGovEmployers: true/false یا آرایه id کارفرمایان دولتی خاص برای اجرا
 *  - keyword: کلیدواژه آزاد کاربر (اختیاری)
 *  - dateFrom / dateTo: بازه تاریخ شمسی به‌صورت {y,m,d} (اختیاری - فقط جایی که لید فیلد تاریخ دارد اعمال می‌شود)
 */
async function runAllScrapers(opts = {}, onProgress) {
  const allLeads = [];
  const errors = [];

  const targetSiteIds = opts.siteIds && opts.siteIds.length ? opts.siteIds : BUILTIN_SCRAPEABLE.map(s => s.id);
  const sitesToRun = BUILTIN_SCRAPEABLE.filter(s => targetSiteIds.includes(s.id));

  for (const site of sitesToRun) {
    onProgress && onProgress({ site: site.name, status: 'در حال اجرا' });
    try {
      const ScraperClass = SCRAPER_MAP[site.scraperModule];
      if (!ScraperClass) throw new Error('ماژول اسکرپر یافت نشد');
      const scraper = new ScraperClass(site);
      const rawLeads = await scraper.run(opts);

      const classified = classifyAndFilter(rawLeads, opts.keyword);
      allLeads.push(...classified);
      onProgress && onProgress({ site: site.name, status: 'پایان یافت', found: classified.length });
    } catch (err) {
      errors.push({ site: site.name, message: err.message });
      onProgress && onProgress({ site: site.name, status: 'خطا', error: err.message });
    }
  }

  // لیست شخصی شرکت‌های پیمانکاری بزرگ تهران
  const customCompanies = store.get('customCompanies', []);
  const companiesToRun = resolveCustomList(customCompanies, opts.includeCustomCompanies);
  for (const company of companiesToRun) {
    onProgress && onProgress({ site: company.name, status: 'در حال اجرا' });
    try {
      const rawLeads = await searchGenericSite(company, opts.keyword);
      const classified = classifyAndFilter(rawLeads, opts.keyword, true);
      allLeads.push(...classified);
      onProgress && onProgress({ site: company.name, status: 'پایان یافت', found: classified.length });
    } catch (err) {
      errors.push({ site: company.name, message: err.message });
      onProgress && onProgress({ site: company.name, status: 'خطا', error: err.message });
    }
  }

  // لیست شخصی کارفرمایان دولتی خاص
  const govEmployers = store.get('customGovEmployers', []);
  const govToRun = resolveCustomList(govEmployers, opts.includeGovEmployers);
  for (const gov of govToRun) {
    onProgress && onProgress({ site: gov.name, status: 'در حال اجرا' });
    try {
      const rawLeads = await searchGenericSite(gov, opts.keyword);
      const classified = classifyAndFilter(rawLeads, opts.keyword, true);
      allLeads.push(...classified);
      onProgress && onProgress({ site: gov.name, status: 'پایان یافت', found: classified.length });
    } catch (err) {
      errors.push({ site: gov.name, message: err.message });
      onProgress && onProgress({ site: gov.name, status: 'خطا', error: err.message });
    }
  }

  // مرتب‌سازی: اولویت ۱ (وافل) بالاتر از ۲ (تاپ‌داون) بالاتر از ۳ (سایر) بالاتر از ۴ (جستجوی آزاد)
  allLeads.sort((a, b) => a.priority - b.priority);

  // ادغام با لیدهای قبلی ذخیره‌شده (بدون تکراری)
  const existing = store.get('leads', []);
  const existingIds = new Set(existing.map(l => l.id));
  const merged = [...existing, ...allLeads.filter(l => !existingIds.has(l.id))];
  store.set('leads', merged);

  return { leads: allLeads, totalStored: merged.length, errors };
}

function classifyAndFilter(rawLeads, keyword, alwaysKeepIfKeywordMatch = false) {
  const classified = rawLeads.map(lead => {
    const c = classify(lead.rawText || `${lead.title} ${lead.stage || ''}`, keyword);
    return { ...lead, priority: c.priority, priorityLabel: c.label, inTargetProvince: isTargetProvince(lead.address) };
  });
  // فقط سرنخ‌های مرتبط (اولویت ۱ تا ۴) نگه داشته می‌شوند؛ اولویت ۰ حذف می‌شود مگر کلیدواژه صریح داده نشده باشد
  return classified.filter(l => l.priority > 0);
}

// resolve a stored list against an opt that's either true (all), false/undefined (none), or an array of ids
function resolveCustomList(list, selector) {
  if (!selector) return [];
  if (selector === true) return list;
  if (Array.isArray(selector)) return list.filter(item => selector.includes(item.id));
  return [];
}

module.exports = { runAllScrapers };
