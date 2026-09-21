const DEFAULT_MESSAGE = `سلام وقت بخیر
پروژه‌ای که در دست اجرا دارید رو مشاهده کردیم. تیم ما آمادگی کامل برای اجرای این نوع پروژه با کیفیت بالا و قیمت منصفانه رو داره.
خوشحال می‌شیم بیشتر آشنا بشیم و در خدمت شما باشیم.`;

let allLeads = [];
let currentSettings = { website: '', instagram: '', linkedin: '', nationalId: '' };
let selectedOutreachLeadId = null;
let siteConfig = null;
let customCompanies = [];
let govEmployers = [];
// وضعیت چک‌باکس‌های منبع جستجو - پیش‌فرض همه سایت‌های داخلی فعال، لیست‌های شخصی غیرفعال
let sourceSelection = { builtin: {}, companies: {}, gov: {} };

// ---------------- قفل امنیتی ----------------
async function initLock() {
  const isPinSet = await window.api.security.isPinSet();
  const lockTitle = document.getElementById('lockTitle');
  lockTitle.textContent = isPinSet ? 'کد ایمنی را وارد کنید' : 'یک کد ایمنی برای برنامه تعیین کنید';

  document.getElementById('pinSubmit').addEventListener('click', async () => {
    const pin = document.getElementById('pinInput').value.trim();
    const errorEl = document.getElementById('lockError');
    if (!pin) { errorEl.textContent = 'کد را وارد کنید'; return; }

    if (!isPinSet) {
      await window.api.security.setPin(pin);
      unlockApp();
      return;
    }
    const ok = await window.api.security.verifyPin(pin);
    if (ok) unlockApp();
    else errorEl.textContent = 'کد ایمنی اشتباه است';
  });
}

async function unlockApp() {
  document.getElementById('lockScreen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  currentSettings = await window.api.settings.get();
  document.getElementById('settingWebsite').value = currentSettings.website || '';
  document.getElementById('settingInstagram').value = currentSettings.instagram || '';
  document.getElementById('settingLinkedin').value = currentSettings.linkedin || '';
  document.getElementById('settingNationalId').value = currentSettings.nationalId || '';

  document.getElementById('messageTemplate').value = localStorage.getItem('messageTemplate') || DEFAULT_MESSAGE;
  document.getElementById('outreachMessage').value = localStorage.getItem('messageTemplate') || DEFAULT_MESSAGE;

  // رفع باگ: بارگذاری اطلاعات ورود ذخیره‌شده داخل فیلدهای تنظیمات
  const sazejooCreds = await window.api.credentials.get('sazejoo');
  document.getElementById('sazejooUser').value = sazejooCreds.username || '';
  document.getElementById('sazejooPass').value = sazejooCreds.password || '';

  const setadiranCreds = await window.api.credentials.get('setadiran');
  document.getElementById('setadiranUser').value = setadiranCreds.username || '';
  document.getElementById('setadiranPass').value = setadiranCreds.password || '';

  const irantenderCreds = await window.api.credentials.get('irantender');
  document.getElementById('irantenderUser').value = irantenderCreds.username || '';
  document.getElementById('irantenderPass').value = irantenderCreds.password || '';

  const linkedinCreds = await window.api.credentials.get('linkedin');
  document.getElementById('linkedinUser').value = linkedinCreds.username || '';
  document.getElementById('linkedinPass').value = linkedinCreds.password || '';

  const instagramCreds = await window.api.credentials.get('instagram');
  document.getElementById('instagramUser').value = instagramCreds.username || '';
  document.getElementById('instagramPass').value = instagramCreds.password || '';

  // بازه تاریخ و کلیدواژه آزاد ذخیره‌شده
  populateDateSelects();
  const searchOptions = await window.api.searchOptions.get();
  document.getElementById('freeKeyword').value = searchOptions.keyword || '';
  if (searchOptions.dateFrom) {
    document.getElementById('dateFromDay').value = searchOptions.dateFrom.d || '';
    document.getElementById('dateFromMonth').value = searchOptions.dateFrom.m || '';
    document.getElementById('dateFromYear').value = to2DigitYear(searchOptions.dateFrom.y);
  }
  if (searchOptions.dateTo) {
    document.getElementById('dateToDay').value = searchOptions.dateTo.d || '';
    document.getElementById('dateToMonth').value = searchOptions.dateTo.m || '';
    document.getElementById('dateToYear').value = to2DigitYear(searchOptions.dateTo.y);
  }
  document.getElementById('sazejooZone').value = searchOptions.sazejooZone || '';
  document.getElementById('setadiranCity').value = searchOptions.setadiranCity || '';
  document.getElementById('setadiranTenderNumber').value = searchOptions.setadiranTenderNumber || '';
  document.getElementById('setadiranEmployer').value = searchOptions.setadiranEmployer || '';
  document.getElementById('irantenderEmployer').value = searchOptions.irantenderEmployer || '';

  siteConfig = await window.api.config.getSites();
  populateZoneDropdown();

  customCompanies = await window.api.companies.get();
  govEmployers = await window.api.govEmployers.get();

  siteConfig.sites.filter(s => s.scraperModule).forEach(s => { sourceSelection.builtin[s.id] = true; });
  renderSourcesList();
  renderCompaniesList();
  renderGovList();

  await loadLeads();
  loadSitesPreview();
  renderFooter();
}

function populateZoneDropdown() {
  const select = document.getElementById('sazejooZone');
  (siteConfig.tehranMunicipalZones || []).forEach(zone => {
    const opt = document.createElement('option');
    opt.value = zone;
    opt.textContent = `منطقه ${zone}`;
    select.appendChild(opt);
  });
}

// ---------------- تب‌ها ----------------
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'stats') renderStats();
    if (btn.dataset.tab === 'outreach') renderOutreachList();
  });
});

// ---------------- داشبورد / لیدها ----------------
async function loadLeads() {
  allLeads = await window.api.leads.getAll();
  renderLeads();
}

function renderLeads() {
  const filter = document.getElementById('filterPriority').value;
  const filtered = filter === 'all' ? allLeads : allLeads.filter(l => String(l.priority) === filter);
  const grid = document.getElementById('leadsGrid');
  grid.innerHTML = '';

  if (!filtered.length) {
    grid.innerHTML = '<p style="color:#9CA3AF;font-size:13px;">هنوز پروژه‌ای پیدا نشده. منابع رو انتخاب کن و «جستجوی همه منابع انتخاب‌شده» رو بزن.</p>';
    return;
  }

  const badgeClassOf = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4' };
  filtered.forEach(lead => {
    const badgeClass = badgeClassOf[lead.priority] || 'p3';
    const card = document.createElement('div');
    card.className = 'lead-card';
    card.innerHTML = `
      <div class="lead-card-top">
        <span class="priority-badge ${badgeClass}">${lead.priorityLabel || ''}</span>
        <span class="lead-meta">${lead.site || ''}</span>
      </div>
      <div class="lead-title">${lead.title || '-'}</div>
      ${lead.tenderNumber ? `<div class="lead-meta">شماره فراخوان: ${lead.tenderNumber}</div>` : ''}
      <div class="lead-meta">${lead.address || '-'}</div>
      <div class="lead-meta">${lead.employer || ''}</div>
      <div class="lead-card-actions"></div>
    `;
    const actions = card.querySelector('.lead-card-actions');
    if (lead.phone) {
      const waBtn = document.createElement('button');
      waBtn.className = 'wa-btn';
      waBtn.textContent = 'واتساپ';
      waBtn.onclick = () => window.api.outreach.openWhatsApp(lead.phone, buildOutreachMessage());
      const baleBtn = document.createElement('button');
      baleBtn.className = 'bale-btn';
      baleBtn.textContent = 'بله';
      baleBtn.onclick = () => window.api.outreach.openBale(lead.phone, buildOutreachMessage());
      actions.appendChild(waBtn);
      actions.appendChild(baleBtn);
    }
    grid.appendChild(card);
  });
}

document.getElementById('filterPriority').addEventListener('change', renderLeads);

// ---------------- منابع جستجو (چک‌باکس‌ها + دکمه تکی/کلی) ----------------
function renderSourcesList() {
  const container = document.getElementById('sourcesList');
  container.innerHTML = '';

  siteConfig.sites.filter(s => s.scraperModule).forEach(site => {
    const row = document.createElement('div');
    row.className = 'source-row';
    row.innerHTML = `
      <label><input type="checkbox" data-type="builtin" data-id="${site.id}" ${sourceSelection.builtin[site.id] ? 'checked' : ''}/> ${site.name}</label>
      <div class="source-row-actions"><button class="secondary-btn" data-run-single="builtin:${site.id}">فقط همین</button></div>
    `;
    container.appendChild(row);
  });

  customCompanies.forEach(c => {
    const row = document.createElement('div');
    row.className = 'source-row';
    row.innerHTML = `
      <label><input type="checkbox" data-type="companies" data-id="${c.id}" ${sourceSelection.companies[c.id] ? 'checked' : ''}/> ${c.name}</label>
      <div class="source-row-actions"><button class="secondary-btn" data-run-single="companies:${c.id}">فقط همین</button></div>
    `;
    container.appendChild(row);
  });

  govEmployers.forEach(g => {
    const row = document.createElement('div');
    row.className = 'source-row';
    row.innerHTML = `
      <label><input type="checkbox" data-type="gov" data-id="${g.id}" ${sourceSelection.gov[g.id] ? 'checked' : ''}/> ${g.name} (دولتی)</label>
      <div class="source-row-actions"><button class="secondary-btn" data-run-single="gov:${g.id}">فقط همین</button></div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      sourceSelection[cb.dataset.type][cb.dataset.id] = cb.checked;
    });
  });
  container.querySelectorAll('[data-run-single]').forEach(btn => {
    btn.addEventListener('click', () => {
      const [type, id] = btn.dataset.runSingle.split(':');
      runScan(buildSingleSourceOpts(type, id));
    });
  });
}

function buildSingleSourceOpts(type, id) {
  const base = getSearchOptsFromForm();
  if (type === 'builtin') return { ...base, siteIds: [id], includeCustomCompanies: false, includeGovEmployers: false };
  if (type === 'companies') return { ...base, siteIds: [], includeCustomCompanies: [id], includeGovEmployers: false };
  if (type === 'gov') return { ...base, siteIds: [], includeCustomCompanies: false, includeGovEmployers: [id] };
  return base;
}

function getSearchOptsFromForm() {
  const shamsiField = (dayId, monthId, yearId) => {
    const d = document.getElementById(dayId).value;
    const m = document.getElementById(monthId).value;
    const y2 = document.getElementById(yearId).value;
    if (!d && !m && !y2) return null;
    return { d: Number(d) || null, m: Number(m) || null, y: y2 ? 1400 + Number(y2) : null };
  };
  return {
    keyword: document.getElementById('freeKeyword').value.trim(),
    dateFrom: shamsiField('dateFromDay', 'dateFromMonth', 'dateFromYear'),
    dateTo: shamsiField('dateToDay', 'dateToMonth', 'dateToYear')
  };
}

// سال شمسی کامل (مثلاً 1405) را به دو رقم آخر (05) برای نمایش در dropdown تبدیل می‌کند
function to2DigitYear(fullYear) {
  if (!fullYear) return '';
  return String(fullYear % 100).padStart(2, '0');
}

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

// دراپ‌داون‌های روز/ماه/سال را می‌سازد - روز و سال به‌صورت اسکرول انتخاب می‌شوند (نه تایپی)
function populateDateSelects() {
  const daySelects = ['dateFromDay', 'dateToDay'];
  const monthSelects = ['dateFromMonth', 'dateToMonth'];
  const yearSelects = ['dateFromYear', 'dateToYear'];

  daySelects.forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">روز</option>' +
      Array.from({ length: 31 }, (_, i) => i + 1).map(d => `<option value="${d}">${d}</option>`).join('');
  });

  monthSelects.forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">ماه</option>' +
      PERSIAN_MONTHS.map((name, i) => `<option value="${i + 1}">${name}</option>`).join('');
  });

  // فقط دو رقم آخر سال شمسی (00 تا 20، یعنی 1400 تا 1420) - دیگه لازم نیست هربار «14» رو تایپ کنی
  yearSelects.forEach(id => {
    const sel = document.getElementById(id);
    sel.innerHTML = '<option value="">سال</option>' +
      Array.from({ length: 21 }, (_, i) => i).map(y => {
        const yy = String(y).padStart(2, '0');
        return `<option value="${yy}">${yy}</option>`;
      }).join('');
  });
}

// دکمه «امروز» - هر دو بازه (از/تا) رو با تاریخ شمسی امروز پر می‌کنه، با یک کلیک
document.getElementById('dateTodayBtn').addEventListener('click', () => {
  const todayParts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  }).formatToParts(new Date());
  const y = todayParts.find(p => p.type === 'year').value;
  const m = todayParts.find(p => p.type === 'month').value;
  const d = todayParts.find(p => p.type === 'day').value;
  const yy = String(Number(y) % 100).padStart(2, '0');

  document.getElementById('dateFromDay').value = d;
  document.getElementById('dateFromMonth').value = m;
  document.getElementById('dateFromYear').value = yy;
  document.getElementById('dateToDay').value = d;
  document.getElementById('dateToMonth').value = m;
  document.getElementById('dateToYear').value = yy;
});

document.getElementById('runScanBtn').addEventListener('click', () => {
  const selectedBuiltin = Object.entries(sourceSelection.builtin).filter(([, v]) => v).map(([k]) => k);
  const selectedCompanies = Object.entries(sourceSelection.companies).filter(([, v]) => v).map(([k]) => k);
  const selectedGov = Object.entries(sourceSelection.gov).filter(([, v]) => v).map(([k]) => k);
  runScan({
    ...getSearchOptsFromForm(),
    siteIds: selectedBuiltin,
    includeCustomCompanies: selectedCompanies.length ? selectedCompanies : false,
    includeGovEmployers: selectedGov.length ? selectedGov : false
  });
});

async function runScan(opts) {
  // ذخیره کلیدواژه/بازه تاریخ برای دفعه بعد
  await window.api.searchOptions.save({
    keyword: opts.keyword,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    sazejooZone: document.getElementById('sazejooZone').value,
    setadiranCity: document.getElementById('setadiranCity').value,
    setadiranTenderNumber: document.getElementById('setadiranTenderNumber').value,
    setadiranEmployer: document.getElementById('setadiranEmployer').value,
    irantenderEmployer: document.getElementById('irantenderEmployer').value
  });

  const log = document.getElementById('scanLog');
  log.classList.remove('hidden');
  log.innerHTML = '';
  window.api.scan.onProgress((data) => {
    const line = document.createElement('div');
    line.textContent = `[${data.site}] ${data.status}${data.found !== undefined ? ' - ' + data.found + ' مورد یافت شد' : ''}${data.error ? ' - خطا: ' + data.error : ''}`;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  });
  const result = await window.api.scan.run(opts);
  const summary = document.createElement('div');
  summary.textContent = `پایان جستجو - مجموع ذخیره‌شده: ${result.totalStored}`;
  log.appendChild(summary);
  await loadLeads();
}

// ---------------- جستجوی خارجی: لینکدین / اینستاگرام ----------------
document.getElementById('linkedinSearchBtn').addEventListener('click', () => {
  const keyword = document.getElementById('freeKeyword').value.trim() || 'پروژه ساختمانی';
  window.api.externalSearch.linkedin(keyword);
});
document.getElementById('instagramSearchBtn').addEventListener('click', () => {
  const keyword = document.getElementById('freeKeyword').value.trim() || 'پروژه_ساختمانی';
  window.api.externalSearch.instagram(keyword);
});

// ---------------- آمار ----------------
function renderStats() {
  const total = allLeads.length;
  const p1 = allLeads.filter(l => l.priority === 1).length;
  const p2 = allLeads.filter(l => l.priority === 2).length;
  const p3 = allLeads.filter(l => l.priority === 3).length;
  const p4 = allLeads.filter(l => l.priority === 4).length;

  const cards = [
    { icon: '📦', num: total, label: 'کل پروژه‌ها' },
    { icon: '🧱', num: p1, label: 'سازه وافل' },
    { icon: '🏗️', num: p2, label: 'تاپ‌داون' },
    { icon: '📋', num: p3, label: 'سایر' },
    { icon: '🔎', num: p4, label: 'جستجوی آزاد' }
  ];
  document.getElementById('statCards').innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="icon">${c.icon}</div>
      <div class="num">${c.num}</div>
      <div class="label">${c.label}</div>
    </div>
  `).join('');

  renderBarChart('chartBySite', groupCount(allLeads, l => l.site || 'نامشخص'));

  const provinceOf = (l) => {
    const addr = l.address || '';
    if (addr.includes('تهران')) return 'تهران';
    if (addr.includes('البرز')) return 'البرز';
    if (addr.includes('مازندران')) return 'مازندران';
    return 'سایر';
  };
  renderBarChart('chartByProvince', groupCount(allLeads, provinceOf));
}

function groupCount(items, keyFn) {
  const map = {};
  items.forEach(i => { const k = keyFn(i); map[k] = (map[k] || 0) + 1; });
  return map;
}

function renderBarChart(containerId, dataMap) {
  const container = document.getElementById(containerId);
  const entries = Object.entries(dataMap);
  if (!entries.length) { container.innerHTML = '<p style="color:#9CA3AF;font-size:12px;">داده‌ای موجود نیست</p>'; return; }
  const max = Math.max(...entries.map(e => e[1]), 1);
  container.innerHTML = entries.map(([label, value]) => `
    <div class="bar-row">
      <span class="bar-label">${label}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${(value / max) * 100}%"></span></span>
      <span class="bar-value">${value}</span>
    </div>
  `).join('');
}

// ---------------- ارتباط با کارفرما ----------------
function renderOutreachList() {
  const list = document.getElementById('outreachLeadsList');
  if (!allLeads.length) {
    list.innerHTML = '<p style="color:#9CA3AF;font-size:12px;">هنوز پروژه‌ای پیدا نشده.</p>';
    return;
  }
  list.innerHTML = '';
  allLeads.forEach(lead => {
    const item = document.createElement('div');
    item.className = 'outreach-lead-item' + (lead.id === selectedOutreachLeadId ? ' selected' : '');
    item.textContent = lead.title || lead.employer || 'بدون عنوان';
    item.onclick = () => selectOutreachLead(lead.id);
    list.appendChild(item);
  });
}

function selectOutreachLead(id) {
  selectedOutreachLeadId = id;
  renderOutreachList();
  const lead = allLeads.find(l => l.id === id);
  document.getElementById('outreachSelectedProject').textContent = lead ? (lead.title || lead.employer) : '';
  document.getElementById('outreachMessage').value = buildOutreachMessage();
  renderOutreachLinksPreview();
}

function buildOutreachMessage() {
  const base = document.getElementById('outreachMessage')?.value?.trim()
    || document.getElementById('messageTemplate').value
    || DEFAULT_MESSAGE;
  const parts = [base];
  if (currentSettings.website) parts.push(`وب‌سایت: ${currentSettings.website}`);
  if (currentSettings.instagram) parts.push(`اینستاگرام: ${currentSettings.instagram}`);
  if (currentSettings.linkedin) parts.push(`لینکدین: ${currentSettings.linkedin}`);
  return parts.join('\n');
}

function renderOutreachLinksPreview() {
  const el = document.getElementById('outreachLinksPreview');
  const lines = [];
  if (currentSettings.website) lines.push(`🌐 ${currentSettings.website}`);
  if (currentSettings.instagram) lines.push(`📷 ${currentSettings.instagram}`);
  if (currentSettings.linkedin) lines.push(`💼 ${currentSettings.linkedin}`);
  el.innerHTML = lines.join('<br>') || 'لینک‌ها را در تب تنظیمات وارد کنید.';
}

document.getElementById('outreachCopyBtn').addEventListener('click', async () => {
  const text = document.getElementById('outreachMessage').value;
  await navigator.clipboard.writeText(text);
  const btn = document.getElementById('outreachCopyBtn');
  const original = btn.textContent;
  btn.textContent = '✅ کپی شد';
  setTimeout(() => { btn.textContent = original; }, 1500);
});

document.getElementById('outreachWaBtn').addEventListener('click', () => {
  const lead = allLeads.find(l => l.id === selectedOutreachLeadId);
  if (!lead || !lead.phone) { alert('این پروژه شماره تلفن ثبت‌شده ندارد.'); return; }
  window.api.outreach.openWhatsApp(lead.phone, document.getElementById('outreachMessage').value);
});

document.getElementById('outreachBaleBtn').addEventListener('click', () => {
  const lead = allLeads.find(l => l.id === selectedOutreachLeadId);
  if (!lead || !lead.phone) { alert('این پروژه شماره تلفن ثبت‌شده ندارد.'); return; }
  window.api.outreach.openBale(lead.phone, document.getElementById('outreachMessage').value);
});

// ---------------- تنظیمات ----------------
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  currentSettings = {
    website: document.getElementById('settingWebsite').value.trim(),
    instagram: document.getElementById('settingInstagram').value.trim(),
    linkedin: document.getElementById('settingLinkedin').value.trim(),
    nationalId: document.getElementById('settingNationalId').value.trim()
  };
  await window.api.settings.save(currentSettings);
  renderFooter();
  renderOutreachLinksPreview();
  alert('تنظیمات ذخیره شد.');
});

document.getElementById('saveMessageBtn').addEventListener('click', () => {
  localStorage.setItem('messageTemplate', document.getElementById('messageTemplate').value);
  alert('پیام پیش‌فرض ذخیره شد.');
});

document.getElementById('saveSazejooBtn').addEventListener('click', async () => {
  const username = document.getElementById('sazejooUser').value.trim();
  const password = document.getElementById('sazejooPass').value.trim();
  await window.api.credentials.save('sazejoo', username, password);
  alert('اطلاعات ورود سازه جو ذخیره شد.');
});

document.getElementById('saveSetadiranBtn').addEventListener('click', async () => {
  const username = document.getElementById('setadiranUser').value.trim();
  const password = document.getElementById('setadiranPass').value.trim();
  await window.api.credentials.save('setadiran', username, password);
  alert('اطلاعات ورود ستاد ایران ذخیره شد.');
});

document.getElementById('saveIrantenderBtn').addEventListener('click', async () => {
  const username = document.getElementById('irantenderUser').value.trim();
  const password = document.getElementById('irantenderPass').value.trim();
  await window.api.credentials.save('irantender', username, password);
  alert('اطلاعات ورود ایران تندر ذخیره شد.');
});

document.getElementById('saveLinkedinBtn').addEventListener('click', async () => {
  const username = document.getElementById('linkedinUser').value.trim();
  const password = document.getElementById('linkedinPass').value.trim();
  await window.api.credentials.save('linkedin', username, password);
  alert('اطلاعات لینکدین ذخیره شد.');
});

document.getElementById('saveInstagramBtn').addEventListener('click', async () => {
  const username = document.getElementById('instagramUser').value.trim();
  const password = document.getElementById('instagramPass').value.trim();
  await window.api.credentials.save('instagram', username, password);
  alert('اطلاعات اینستاگرام ذخیره شد.');
});

document.getElementById('saveAdvancedFiltersBtn').addEventListener('click', async () => {
  const current = await window.api.searchOptions.get();
  await window.api.searchOptions.save({
    ...current,
    sazejooZone: document.getElementById('sazejooZone').value,
    setadiranCity: document.getElementById('setadiranCity').value,
    setadiranTenderNumber: document.getElementById('setadiranTenderNumber').value,
    setadiranEmployer: document.getElementById('setadiranEmployer').value,
    irantenderEmployer: document.getElementById('irantenderEmployer').value
  });
  alert('فیلترهای پیشرفته ذخیره شد.');
});

document.getElementById('savePinBtn').addEventListener('click', async () => {
  const pin = document.getElementById('newPin').value.trim();
  if (!pin) return;
  await window.api.security.setPin(pin);
  alert('کد ایمنی جدید ذخیره شد.');
  document.getElementById('newPin').value = '';
});

async function loadSitesPreview() {
  document.getElementById('sitesPreview').textContent = JSON.stringify(siteConfig, null, 2);
}

// ---------------- لیست شخصی شرکت‌ها ----------------
function renderCompaniesList() {
  const el = document.getElementById('companiesList');
  if (!customCompanies.length) { el.innerHTML = '<p style="color:#9CA3AF;font-size:12px;">هنوز شرکتی اضافه نشده.</p>'; return; }
  el.innerHTML = customCompanies.map(c => `
    <div class="editable-list-item">
      <div class="item-info"><span>${c.name}</span><span class="item-url">${c.url}</span></div>
      <button data-remove-company="${c.id}">حذف</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-remove-company]').forEach(btn => {
    btn.addEventListener('click', async () => {
      customCompanies = customCompanies.filter(c => c.id !== btn.dataset.removeCompany);
      await window.api.companies.save(customCompanies);
      renderCompaniesList();
      renderSourcesList();
    });
  });
}

document.getElementById('addCompanyBtn').addEventListener('click', async () => {
  const name = document.getElementById('newCompanyName').value.trim();
  const url = document.getElementById('newCompanyUrl').value.trim();
  if (!name || !url) { alert('نام و آدرس وب‌سایت را وارد کن.'); return; }
  customCompanies.push({ id: 'company-' + Date.now(), name, url });
  await window.api.companies.save(customCompanies);
  document.getElementById('newCompanyName').value = '';
  document.getElementById('newCompanyUrl').value = '';
  renderCompaniesList();
  renderSourcesList();
});

// ---------------- لیست شخصی کارفرمایان دولتی ----------------
function renderGovList() {
  const el = document.getElementById('govList');
  if (!govEmployers.length) { el.innerHTML = '<p style="color:#9CA3AF;font-size:12px;">هنوز کارفرمایی اضافه نشده.</p>'; return; }
  el.innerHTML = govEmployers.map(g => `
    <div class="editable-list-item">
      <div class="item-info"><span>${g.name}</span><span class="item-url">${g.url}</span></div>
      <button data-remove-gov="${g.id}">حذف</button>
    </div>
  `).join('');
  el.querySelectorAll('[data-remove-gov]').forEach(btn => {
    btn.addEventListener('click', async () => {
      govEmployers = govEmployers.filter(g => g.id !== btn.dataset.removeGov);
      await window.api.govEmployers.save(govEmployers);
      renderGovList();
      renderSourcesList();
    });
  });
}

document.getElementById('addGovBtn').addEventListener('click', async () => {
  const name = document.getElementById('newGovName').value.trim();
  const url = document.getElementById('newGovUrl').value.trim();
  if (!name || !url) { alert('نام و آدرس وب‌سایت را وارد کن.'); return; }
  govEmployers.push({ id: 'gov-' + Date.now(), name, url });
  await window.api.govEmployers.save(govEmployers);
  document.getElementById('newGovName').value = '';
  document.getElementById('newGovUrl').value = '';
  renderGovList();
  renderSourcesList();
});

// ---------------- درباره: کپی‌رایت، کد ملی جزئی، نسخه، تاریخ شمسی ----------------
function maskNationalId(id) {
  if (!id || id.length < 6) return '';
  return `کد ملی: ${id.slice(0, 4)}......${id.slice(-2)}`;
}

document.getElementById('aboutBadge').addEventListener('click', () => {
  document.getElementById('aboutPopover').classList.toggle('hidden');
});

async function renderFooter() {
  document.getElementById('aboutText').textContent =
    'این نرم‌افزار توسط آقای برهان مهرگان ایده‌پردازی، تولید و خلق شده است، جهت پایش و شکار هوشمند پروژه‌های ساختمانی. تمامی حقوق این نرم‌افزار متعلق به ایشان می‌باشد.';

  document.getElementById('footerNationalId').textContent = maskNationalId(currentSettings.nationalId);

  const version = await window.api.app.getVersion();
  document.getElementById('footerVersion').textContent = version;

  const shamsiDate = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  }).format(new Date());
  document.getElementById('footerDate').textContent = shamsiDate;
}

initLock();
