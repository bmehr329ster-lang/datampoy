const siteConfig = require('../config/sites.json');

/**
 * متن پروژه را می‌گیرد و بر اساس کلیدواژه‌ها اولویت آن را تعیین می‌کند.
 * خروجی: 1 (وافل) کمترین عدد = بالاترین اولویت، 2 (تاپ‌داون)، 3 (سایر)،
 * 4 (نتیجه جستجوی آزاد کاربر)، 0 (نامشخص/رد)
 */
function classify(text, customKeyword) {
  if (!text) return { priority: 0, label: 'نامشخص', matched: [] };
  const normalized = text.toLowerCase();

  const check = (keywords) => keywords.filter(k => normalized.includes(k.toLowerCase()));

  const waffleMatches = check(siteConfig.priorityKeywords.priority1_waffle);
  if (waffleMatches.length) {
    return { priority: 1, label: 'سازه وافل', matched: waffleMatches };
  }

  const topDownMatches = check(siteConfig.priorityKeywords.priority2_topdown);
  if (topDownMatches.length) {
    return { priority: 2, label: 'تاپ داون', matched: topDownMatches };
  }

  const otherMatches = check(siteConfig.priorityKeywords.other);
  if (otherMatches.length) {
    return { priority: 3, label: 'سایر (محوطه‌سازی/پارک‌سازی/جدول)', matched: otherMatches };
  }

  if (customKeyword && normalized.includes(customKeyword.toLowerCase())) {
    return { priority: 4, label: 'جستجوی آزاد', matched: [customKeyword] };
  }

  return { priority: 0, label: 'نامرتبط', matched: [] };
}

function isTargetProvince(text) {
  if (!text) return false;
  return siteConfig.provinces.some(p => text.includes(p));
}

module.exports = { classify, isTargetProvince };
