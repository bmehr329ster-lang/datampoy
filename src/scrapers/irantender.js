const axios = require('axios');
const cheerio = require('cheerio');
const Store = require('electron-store');
const store = new Store({ name: 'project-finder-config' });

/**
 * ایران تندر (etender.ir):
 * فرم GET ساده (نه AJAX) - با axios+cheerio مستقیم قابل خواندن است.
 *
 * ساختار واقعی تایید‌شده از نمونه HTML صفحه نتایج که کاربر فرستاد:
 * جدول با class="tb-hasel"، هر ردیف داده ۶ <td> دارد:
 *   0) کد ایران‌تندر (لینک به جزئیات)
 *   1) عنوان (class="title"، لینک به جزئیات با href مثل "?section=tender&category=details&id=...")
 *   2) برگزارکننده/کارفرما (class="sml-fon"، گاهی لینک، گاهی فقط متن)
 *   3) استان/کشور (class="sml-fon"، لینک یا چند استان به‌صورت "..." با title)
 *   4) تاریخ انتشار (شمسی، مثل 1405-06-26)
 *   5) مهلت دریافت اسناد (شمسی)
 * ردیف هدر با <tr class="toptd" ...> مشخص می‌شود و باید رد شود.
 *
 * نکته مهم: پارامتر استان در URL واقعی به‌صورت آرایه province[] است، نه province=.
 * فیلد تاریخ (date, date2) فرمت شمسی yyyy-mm-dd می‌گیرد.
 */
class IranTenderScraper {
  constructor(siteMeta) {
    this.siteMeta = siteMeta;
  }

  async run(opts = {}) {
    const searchOptions = store.get('searchOptions', {});
    const client = axios.create({
      timeout: 20000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124 Safari/537.36' },
      maxRedirects: 5
    });

    // اگر یوزر/پسورد ذخیره شده، اول لاگین می‌کنیم تا نتایج «قابل نمایش برای مشترکان»
    // هم به‌جای پیام قفل‌شده، اطلاعات واقعی نشان بدهند.
    const cookieHeader = await this.login(client);
    const isLoggedIn = !!cookieHeader;
    if (cookieHeader) {
      client.defaults.headers.Cookie = cookieHeader;
    }

    const leads = [];
    // یک درخواست واحد با هر سه استان هدف با هم (چون سایت از province[] چندگانه پشتیبانی می‌کند)
    const params = [
      'section=tender', 'category=list', 'catid=35',
      'province[]=5', 'province[]=8', 'province[]=27' // البرز، تهران، مازندران
    ];
    if (opts.keyword) params.push(`keyword=${encodeURIComponent(opts.keyword)}`);
    if (searchOptions.irantenderEmployer) params.push(`orgname=${encodeURIComponent(searchOptions.irantenderEmployer)}`);
    if (searchOptions.dateFrom) params.push(`date=${shamsiToString(searchOptions.dateFrom)}`);
    if (searchOptions.dateTo) params.push(`date2=${shamsiToString(searchOptions.dateTo)}`);
    params.push('rows=100');

    const url = `${this.siteMeta.baseUrl}${this.siteMeta.searchPath}?${params.join('&')}`;

    try {
      const res = await client.get(url);
      const $ = cheerio.load(res.data);
      const rows = extractResultRows($, url);
      rows.forEach(r => {
        r.site = this.siteMeta.name;
        r.foundAt = new Date().toISOString();
        r.id = `irantender-${r.tenderCode || Buffer.from(r.title).toString('base64').slice(0, 16)}`;

        // به‌جای نمایش گمراه‌کننده متن خام سایت («قابل نمایش برای مشترکان»)،
        // وضعیت واقعی دسترسی رو شفاف مشخص می‌کنیم.
        const gated = /مشترک/.test(r.employer || '') || /مشترک/.test(r.rawText || '');
        if (gated) {
          r.accessStatus = isLoggedIn
            ? 'حساب ایران تندر متصل است، اما دسترسی به این مورد توسط سایت منبع محدود شده است.'
            : 'برای مشاهده جزئیات این مورد، اتصال حساب ایران تندر (یوزر/پسورد در تنظیمات) لازم است.';
        } else if (isLoggedIn) {
          r.accessStatus = 'حساب ایران تندر متصل است.';
        }
      });
      leads.push(...rows);
    } catch (err) {
      throw new Error(`خطا در خواندن ایران تندر: ${err.message}`);
    }

    return leads;
  }

  /**
   * لاگین به ایران‌تندر با فرم واقعی صفحه ورود (نمونه HTML که کاربر فرستاد):
   * POST به همون آدرس صفحه ورود، فیلدهای username/pass، بدون action صریح
   * (یعنی به همون صفحه پست می‌شود). آدرس دقیق صفحه ورود حدس زده شده بر اساس
   * الگوی لینک‌های مشابه سایت (user.php?section=login)؛ اگر عوض بود، این
   * تابع باید با آدرس واقعی اصلاح شود.
   */
  async login(client) {
    const creds = store.get('credentials.irantender');
    if (!creds || !creds.username || !creds.password) return null; // بدون لاگین هم جستجوی عمومی کار می‌کند

    const loginUrl = `${this.siteMeta.baseUrl}/user.php?section=login`;
    try {
      const body = new URLSearchParams({
        username: creds.username,
        pass: creds.password,
        submit: 'ورود'
      });
      const res = await client.post(loginUrl, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        validateStatus: () => true // حتی اگر ریدایرکت/خطا بده، خودمون کوکی رو بررسی می‌کنیم
      });
      const setCookie = res.headers['set-cookie'];
      if (!setCookie || !setCookie.length) return null; // لاگین ناموفق یا آدرس اشتباه - بی‌صدا ادامه بده
      return setCookie.map(c => c.split(';')[0]).join('; ');
    } catch (err) {
      return null; // اگر لاگین شکست خورد، جستجوی بدون لاگین (عمومی) همچنان انجام می‌شود
    }
  }
}

function extractResultRows($, pageUrl) {
  const results = [];

  $('table.tb-hasel tr').each((i, tr) => {
    const $tr = $(tr);
    if ($tr.hasClass('toptd')) return; // ردیف هدر جدول

    const tds = $tr.find('td');
    if (tds.length < 6) return;

    const tenderCode = $(tds[0]).text().trim();
    const titleLink = $(tds[1]).find('a').first();
    const title = titleLink.text().trim() || $(tds[1]).text().trim();
    if (!title) return;
    const detailHref = titleLink.attr('href');
    const employer = $(tds[2]).text().trim();
    const address = $(tds[3]).text().trim();
    const datePublished = $(tds[4]).text().trim();
    const deadline = $(tds[5]).text().trim();

    let absoluteUrl = pageUrl;
    if (detailHref) {
      try { absoluteUrl = new URL(detailHref, pageUrl).toString(); } catch (e) { /* keep pageUrl */ }
    }

    results.push({
      tenderCode,
      title,
      employer,
      address,
      stage: `انتشار: ${datePublished} - مهلت: ${deadline}`,
      phone: '',
      url: absoluteUrl,
      rawText: `${title} ${employer} ${address}`
    });
  });

  return results;
}

function shamsiToString(dateObj) {
  if (!dateObj) return '';
  const { y, m, d } = dateObj;
  if (!y && !m && !d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${y || ''}-${m ? pad(m) : ''}-${d ? pad(d) : ''}`.replace(/^-+|-+$/g, '');
}

module.exports = IranTenderScraper;
