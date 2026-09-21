const puppeteer = require('puppeteer');
const Store = require('electron-store');
const store = new Store({ name: 'project-finder-config' });

/**
 * ستاد ایران (setadiran.ir):
 * این سایت یک اپلیکیشن Java/Struts2 است که نتایج جستجو را با AJAX داخل یک
 * div خالی لود می‌کند (نه HTML ساده)، پس به‌جای axios+cheerio از Puppeteer
 * (مرورگر واقعی خودکار) استفاده می‌کنیم.
 *
 * بر اساس اسکرین‌شات فرم «جستجوی پیشرفته» که کاربر فرستاد، فیلدهای فرم و
 * ستون‌های جدول نتایج شناسایی شدند، اما چون به DOM واقعی (id/class دقیق
 * المان‌ها) دسترسی نداشتیم، انتخاب فیلدها بر اساس **متن لیبل مجاور** انجام
 * می‌شود که نسبتاً پایدار ولی نه ۱۰۰٪ تضمین‌شده است. بعد از اولین اجرای
 * واقعی (با حساب کاربری خودتان)، اگر جایی نشکند، این فایل نهایی می‌شود.
 */
class SetadIranScraper {
  constructor(siteMeta) {
    this.siteMeta = siteMeta;
  }

  async run(opts = {}) {
    const creds = store.get('credentials.setadiran');
    if (!creds || !creds.username || !creds.password) {
      throw new Error('برای ستاد ایران باید ابتدا نام کاربری/رمز را در تنظیمات وارد کنید.');
    }
    const searchOptions = store.get('searchOptions', {});

    // به‌جای دانلود/باندل کردن یک نسخه جدا از Chrome (که باعث خطای قبلی می‌شد)،
    // از همون Chrome نصب‌شده روی سیستم کاربر استفاده می‌کنیم.
    let browser;
    try {
      browser = await puppeteer.launch({ headless: 'new', channel: 'chrome' });
    } catch (err) {
      throw new Error('برای ستاد ایران نیاز به Google Chrome نصب‌شده روی سیستم دارید. لطفاً Chrome را از google.com/chrome نصب کنید و دوباره امتحان کنید.');
    }
    const page = await browser.newPage();
    const leads = [];

    try {
      // TODO: آدرس دقیق صفحه ورود ستاد ایران باید تایید شود (معمولاً از طریق setadiran.ir)
      await page.goto('https://setadiran.ir/', { waitUntil: 'networkidle2', timeout: 30000 });

      // TODO: فرم ورود واقعی (نام کاربری/رمز/کد امنیتی تصویری) باید بعد از
      // بررسی صفحه لاگین واقعی تکمیل شود - این سایت معمولاً کپچا هم دارد
      // که نیاز به راه‌حل جداگانه (مثلاً ورود نیمه‌دستی یک‌بار در هفته) دارد.

      // جستجوی پیشرفته - اگر شماره فراخوان مشخص شده، فقط با همون جستجو کن
      // (چون این شماره یکتا و دقیق‌تر از هر فیلتر دیگری است - نکته‌ای که کاربر گفت)
      if (searchOptions.setadiranTenderNumber) {
        await this.typeIntoFieldByLabel(page, 'شماره فراخوان', searchOptions.setadiranTenderNumber);
        await this.clickButtonByText(page, 'جستجو');
        await page.waitForTimeout(3000);
        const rows = await this.extractResultRows(page);
        rows.forEach(r => {
          r.site = this.siteMeta.name;
          r.id = `setadiran-${r.tenderNumber || Buffer.from(r.title).toString('base64').slice(0, 16)}`;
          r.foundAt = new Date().toISOString();
        });
        leads.push(...rows);
        await browser.close();
        return leads;
      }

      // در غیر این صورت - انتخاب استان + اعمال شهر/کارفرما/بازه تاریخ ذخیره‌شده در تنظیمات
      const provincesToSearch = searchOptions.setadiranCity
        ? [searchOptions.setadiranCity] // اگر شهر مشخص شده، فقط همون رو جستجو کن
        : ['تهران', 'البرز', 'مازندران'];

      for (const province of provincesToSearch) {
        await this.selectByLabel(page, 'استان محل اجرا', province);

        if (searchOptions.setadiranEmployer) {
          await this.typeIntoFieldByLabel(page, 'دستگاه اجرایی مناقصه‌گزار', searchOptions.setadiranEmployer);
        }
        if (opts && opts.keyword) {
          await this.typeIntoFieldByLabel(page, 'عنوان فراخوان', opts.keyword);
        }
        if (searchOptions.dateFrom) {
          await this.typeIntoFieldByLabel(page, 'تاریخ ارسال به صفحه اعلان عمومی از', shamsiToString(searchOptions.dateFrom));
        }
        if (searchOptions.dateTo) {
          await this.typeIntoFieldByLabel(page, 'تا', shamsiToString(searchOptions.dateTo));
        }

        await this.clickButtonByText(page, 'جستجو');
        await page.waitForTimeout(3000); // صبر برای لود AJAX نتایج

        const rows = await this.extractResultRows(page);
        rows.forEach(r => {
          r.site = this.siteMeta.name;
          r.id = `setadiran-${r.tenderNumber || Buffer.from(r.title + r.employer).toString('base64').slice(0, 16)}`;
          r.foundAt = new Date().toISOString();
        });
        leads.push(...rows);
      }
    } finally {
      await browser.close();
    }

    return leads;
  }

  async typeIntoFieldByLabel(page, labelText, value) {
    // مشابه selectByLabel ولی برای input متنی - TODO: با id واقعی دقیق‌تر شود
    await page.evaluate((labelText, value) => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type])'));
      for (const inp of inputs) {
        const context = (inp.closest('tr, td, div') || inp.parentElement).innerText || '';
        if (context.includes(labelText)) {
          inp.value = value;
          inp.dispatchEvent(new Event('input', { bubbles: true }));
          break;
        }
      }
    }, labelText, value);
  }

  async selectByLabel(page, labelText, optionText) {
    // به دنبال یک <select> که نزدیک‌ترین متن قبل از آن شامل labelText باشد می‌گردد
    // TODO: بعد از بررسی DOM واقعی، این تابع را با یک سلکتور دقیق (id واقعی) جایگزین کنید
    await page.evaluate((labelText, optionText) => {
      const selects = Array.from(document.querySelectorAll('select'));
      for (const sel of selects) {
        const context = (sel.closest('tr, td, div') || sel.parentElement).innerText || '';
        if (context.includes(labelText)) {
          const opt = Array.from(sel.options).find(o => o.textContent.includes(optionText));
          if (opt) {
            sel.value = opt.value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
          }
          break;
        }
      }
    }, labelText, optionText);
  }

  async clickButtonByText(page, text) {
    await page.evaluate((text) => {
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"], a'));
      const btn = buttons.find(b => (b.innerText || b.value || '').includes(text));
      if (btn) btn.click();
    }, text);
  }

  async extractResultRows(page) {
    // ستون‌های واقعی جدول (تایید‌شده از اسکرین‌شات کاربر - ۱۰ ستون به ترتیب DOM):
    // ردیف، شماره فراخوان، عنوان فراخوان، نوع فراخوان، استان، شهر،
    // دستگاه اجرایی مناقصه‌گزار، طبقه‌بندی موضوعی، شرح کلی حوزه فعالیت، برآورد مالی
    return await page.evaluate(() => {
      const results = [];
      const tables = Array.from(document.querySelectorAll('table'));
      const table = tables.find(t => t.innerText.includes('عنوان فراخوان') && t.innerText.includes('شماره فراخوان'));
      if (!table) return results;

      const rows = Array.from(table.querySelectorAll('tbody tr')).length
        ? Array.from(table.querySelectorAll('tbody tr'))
        : Array.from(table.querySelectorAll('tr')).slice(1);

      rows.forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
        if (cells.length < 9) return;
        // اگر ستون ردیف وجود نداشت (۹ ستون)، جابجایی یک واحد انجام می‌شود
        const offset = cells.length >= 10 ? 1 : 0;
        const tenderNumber = cells[offset];
        const title = cells[offset + 1];
        const type = cells[offset + 2];
        const province = cells[offset + 3];
        const city = cells[offset + 4];
        const org = cells[offset + 5];
        const category = cells[offset + 6];
        const description = cells[offset + 7];
        const budget = cells[offset + 8];
        if (!title) return;
        results.push({
          tenderNumber, title, type,
          address: `${province || ''} ${city || ''}`.trim(),
          employer: org,
          stage: `${category || ''} - برآورد: ${budget || 'نامشخص'}`,
          url: '',
          rawText: `${title} ${description || ''} ${category || ''}`
        });
      });
      return results;
    });
  }
}

module.exports = SetadIranScraper;

function shamsiToString(dateObj) {
  if (!dateObj) return '';
  const { y, m, d } = dateObj;
  if (!y && !m && !d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${y || ''}-${m ? pad(m) : ''}-${d ? pad(d) : ''}`.replace(/^-+|-+$/g, '');
}
