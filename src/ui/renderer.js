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
// فیلترهای پیشرفته سازه جو / آرتا پارسیان مازندران (چندگانه، قابل ذخیره)
let sazejooFilters = { zones: new Set(), structureTypes: new Set(), stages: new Set() };
let artaFilters = { cities: new Set(), structureTypes: new Set(), stages: new Set() };

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
  document.getElementById('settingCompanyName').value = currentSettings.companyName || '';
  document.getElementById('settingSenderName').value = currentSettings.senderName || '';
  document.getElementById('settingSenderPhone').value = currentSettings.senderPhone || '';
  document.getElementById('settingIntroText').value = currentSettings.introText || '';
  updateCatalogStatus();

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
    document.getElementById('dateFromMonth').value = searchOptions.dateFrom.m || '';
    document.getElementById('dateFromYear').value = to2DigitYear(searchOptions.dateFrom.y) || to2DigitYear(SUPPORTED_YEARS[0]);
    updateDayOptions('dateFromDay', 'dateFromMonth', 'dateFromYear');
    document.getElementById('dateFromDay').value = searchOptions.dateFrom.d || '';
  }
  if (searchOptions.dateTo) {
    document.getElementById('dateToMonth').value = searchOptions.dateTo.m || '';
    document.getElementById('dateToYear').value = to2DigitYear(searchOptions.dateTo.y) || to2DigitYear(SUPPORTED_YEARS[0]);
    updateDayOptions('dateToDay', 'dateToMonth', 'dateToYear');
    document.getElementById('dateToDay').value = searchOptions.dateTo.d || '';
  }
  document.getElementById('setadiranCity').value = searchOptions.setadiranCity || '';
  document.getElementById('setadiranTenderNumber').value = searchOptions.setadiranTenderNumber || '';
  document.getElementById('setadiranEmployer').value = searchOptions.setadiranEmployer || '';
  document.getElementById('irantenderEmployer').value = searchOptions.irantenderEmployer || '';

  siteConfig = await window.api.config.getSites();

  // بازیابی فیلترهای پیشرفته سازه جو/آرتا که قبلاً ذخیره شده
  if (searchOptions.sazejooFilters) {
    sazejooFilters.zones = new Set(searchOptions.sazejooFilters.zones || []);
    sazejooFilters.structureTypes = new Set(searchOptions.sazejooFilters.structureTypes || []);
    sazejooFilters.stages = new Set(searchOptions.sazejooFilters.stages || []);
    document.getElementById('sazejooFloorsBelow').value = searchOptions.sazejooFilters.floorsBelow || '';
    document.getElementById('sazejooFloorsTotal').value = searchOptions.sazejooFilters.floorsTotal || '';
  }
  if (searchOptions.artaFilters) {
    artaFilters.cities = new Set(searchOptions.artaFilters.cities || []);
    artaFilters.structureTypes = new Set(searchOptions.artaFilters.structureTypes || []);
    artaFilters.stages = new Set(searchOptions.artaFilters.stages || []);
    document.getElementById('artaFloorsBelow').value = searchOptions.artaFilters.floorsBelow || '';
    document.getElementById('artaFloorsTotal').value = searchOptions.artaFilters.floorsTotal || '';
  }
  renderSazejooFilters();
  renderArtaFilters();

  customCompanies = await window.api.companies.get();
  govEmployers = await window.api.govEmployers.get();

  siteConfig.sites.filter(s => s.scraperModule).forEach(s => { sourceSelection.builtin[s.id] = true; });
  renderSourceChips(); renderEmployerChips();
  renderCompaniesList();
  renderGovList();

  await loadLeads();
  loadSitesPreview();
  renderFooter();
  renderQuickOutreachPreview();
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
      ${lead.accessStatus ? `<div class="lead-access-status">${lead.accessStatus}</div>` : ''}
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

// ---------------- منابع جستجو (چیپ‌های قابل‌کلیک + اجرای تکی/کلی) ----------------
function renderSourceChips() {
  const container = document.getElementById('sourceChips');
  container.innerHTML = '';

  siteConfig.sites.filter(s => s.scraperModule).forEach(site => {
    const chip = document.createElement('div');
    chip.className = 'source-chip' + (sourceSelection.builtin[site.id] ? ' active' : '');
    chip.innerHTML = `<span>${site.name}</span><button class="chip-run-btn" title="فقط همین" data-run-single="builtin:${site.id}">▶</button>`;
    chip.addEventListener('click', (e) => {
      if (e.target.closest('.chip-run-btn')) return;
      sourceSelection.builtin[site.id] = !sourceSelection.builtin[site.id];
      chip.classList.toggle('active');
    });
    container.appendChild(chip);
  });

  container.querySelectorAll('[data-run-single]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const [type, id] = btn.dataset.runSingle.split(':');
      runScan(buildSingleSourceOpts(type, id));
    });
  });
}

// ---------------- کارفرمای ویژه (انتخاب سریع در صفحه اول) ----------------
function renderEmployerChips() {
  const container = document.getElementById('employerChips');
  container.innerHTML = '';

  if (!customCompanies.length && !govEmployers.length) {
    container.innerHTML = '<p style="color:#9CA3AF;font-size:12px;">هنوز شرکت/کارفرمایی توی تنظیمات اضافه نکردی.</p>';
    return;
  }

  customCompanies.forEach(c => {
    const chip = document.createElement('div');
    chip.className = 'source-chip' + (sourceSelection.companies[c.id] ? ' active' : '');
    chip.innerHTML = `<span>${c.name}</span><button class="chip-run-btn" title="فقط همین" data-run-single="companies:${c.id}">▶</button>`;
    chip.addEventListener('click', (e) => {
      if (e.target.closest('.chip-run-btn')) return;
      sourceSelection.companies[c.id] = !sourceSelection.companies[c.id];
      chip.classList.toggle('active');
    });
    container.appendChild(chip);
  });

  govEmployers.forEach(g => {
    const chip = document.createElement('div');
    chip.className = 'source-chip gov' + (sourceSelection.gov[g.id] ? ' active' : '');
    chip.innerHTML = `<span>${g.name} (دولتی)</span><button class="chip-run-btn" title="فقط همین" data-run-single="gov:${g.id}">▶</button>`;
    chip.addEventListener('click', (e) => {
      if (e.target.closest('.chip-run-btn')) return;
      sourceSelection.gov[g.id] = !sourceSelection.gov[g.id];
      chip.classList.toggle('active');
    });
    container.appendChild(chip);
  });

  container.querySelectorAll('[data-run-single]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const [type, id] = btn.dataset.runSingle.split(':');
      runScan(buildSingleSourceOpts(type, id));
    });
  });
}

// ---------------- فیلترهای پیشرفته سازه جو ----------------
function renderSazejooFilters() {
  renderZoneChipList('sazejooZoneList', (siteConfig.tehranMunicipalZones || []).map(z => `منطقه ${z}`), sazejooFilters.zones, 'sazejooZoneSearch');
  renderCheckboxChipList('sazejooStructureType', siteConfig.structureTypes || [], sazejooFilters.structureTypes);
  renderCheckboxChipList('sazejooStage', siteConfig.constructionStages || [], sazejooFilters.stages);
}

// ---------------- فیلترهای پیشرفته آرتا پارسیان مازندران ----------------
function renderArtaFilters() {
  renderZoneChipList('artaCityList', siteConfig.mazandaranCities || [], artaFilters.cities, 'artaCitySearch');
  renderCheckboxChipList('artaStructureType', siteConfig.structureTypes || [], artaFilters.structureTypes);
  renderCheckboxChipList('artaStage', siteConfig.constructionStages || [], artaFilters.stages);
  renderSelectedChips('artaCityChipsSelected', artaFilters.cities);
}

// لیست قابل‌جستجو + انتخاب چندگانه (برای مناطق تهران یا شهرهای مازندران)
function renderZoneChipList(containerId, allItems, selectedSet, searchInputId) {
  const container = document.getElementById(containerId);
  const searchInput = document.getElementById(searchInputId);
  const filterText = (searchInput.value || '').trim();

  const filtered = filterText ? allItems.filter(item => item.includes(filterText)) : allItems;
  container.innerHTML = filtered.map(item => `
    <button type="button" class="zone-chip ${selectedSet.has(item) ? 'active' : ''}" data-item="${item}">${item}</button>
  `).join('') || '<p style="color:#9CA3AF;font-size:12px;">موردی پیدا نشد - اگه شهر/منطقه دیگه‌ای می‌خوای، همینجا تایپ کن و Enter بزن</p>';

  container.querySelectorAll('.zone-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const item = chip.dataset.item;
      if (selectedSet.has(item)) selectedSet.delete(item); else selectedSet.add(item);
      chip.classList.toggle('active');
      if (containerId === 'artaCityList') renderSelectedChips('artaCityChipsSelected', artaFilters.cities);
    });
  });

  // اگه کاربر چیزی تایپ کرد که توی لیست نیست (مثلاً منطقه/شهر جدید)، با Enter اضافه می‌شه
  if (!searchInput.dataset.wired) {
    searchInput.dataset.wired = '1';
    searchInput.addEventListener('input', () => renderZoneChipList(containerId, allItems, selectedSet, searchInputId));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && searchInput.value.trim()) {
        selectedSet.add(searchInput.value.trim());
        searchInput.value = '';
        renderZoneChipList(containerId, allItems, selectedSet, searchInputId);
        if (containerId === 'artaCityList') renderSelectedChips('artaCityChipsSelected', artaFilters.cities);
      }
    });
  }
}

function renderSelectedChips(containerId, selectedSet) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = Array.from(selectedSet).map(item => `
    <span class="selected-chip">${item} <button type="button" data-remove="${item}">✕</button></span>
  `).join('');
  el.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedSet.delete(btn.dataset.remove);
      renderArtaFilters();
    });
  });
}

// چک‌باکس‌های چندگانه (نوع سازه / مرحله پروژه)
function renderCheckboxChipList(containerId, options, selectedSet) {
  const container = document.getElementById(containerId);
  container.innerHTML = options.map(opt => `
    <label class="checkbox-chip"><input type="checkbox" data-opt="${opt}" ${selectedSet.has(opt) ? 'checked' : ''}/> ${opt}</label>
  `).join('');
  container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) selectedSet.add(cb.dataset.opt); else selectedSet.delete(cb.dataset.opt);
    });
  });
}

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  document.getElementById('freeKeyword').value = '';
  ['dateFromMonth', 'dateFromYear', 'dateToMonth', 'dateToYear'].forEach(id => { document.getElementById(id).value = ''; });
  updateDayOptions('dateFromDay', 'dateFromMonth', 'dateFromYear');
  updateDayOptions('dateToDay', 'dateToMonth', 'dateToYear');
  sazejooFilters = { zones: new Set(), structureTypes: new Set(), stages: new Set() };
  artaFilters = { cities: new Set(), structureTypes: new Set(), stages: new Set() };
  document.getElementById('sazejooFloorsBelow').value = '';
  document.getElementById('sazejooFloorsTotal').value = '';
  document.getElementById('artaFloorsBelow').value = '';
  document.getElementById('artaFloorsTotal').value = '';
  renderSazejooFilters();
  renderArtaFilters();
});

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
    dateTo: shamsiField('dateToDay', 'dateToMonth', 'dateToYear'),
    sazejooFilters: {
      zones: Array.from(sazejooFilters.zones),
      structureTypes: Array.from(sazejooFilters.structureTypes),
      stages: Array.from(sazejooFilters.stages),
      floorsBelow: document.getElementById('sazejooFloorsBelow').value || null,
      floorsTotal: document.getElementById('sazejooFloorsTotal').value || null
    },
    artaFilters: {
      cities: Array.from(artaFilters.cities),
      structureTypes: Array.from(artaFilters.structureTypes),
      stages: Array.from(artaFilters.stages),
      floorsBelow: document.getElementById('artaFloorsBelow').value || null,
      floorsTotal: document.getElementById('artaFloorsTotal').value || null
    }
  };
}

// سال شمسی کامل (مثلاً 1405) را به دو رقم آخر (05) برای نمایش در dropdown تبدیل می‌کند
function to2DigitYear(fullYear) {
  if (!fullYear) return '';
  return String(fullYear % 100).padStart(2, '0');
}

const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

// سال‌های کبیسه شمسی (اسفند ۳۰ روزه) - فعلاً فقط بازه پشتیبانی‌شده (۱۴۰۵/۱۴۰۶)،
// هر دو عادی‌اند (اسفند ۲۹ روزه). وقتی سال جدید به SUPPORTED_YEARS اضافه شد،
// اگه کبیسه بود همینجا به این آرایه اضافه کن.
const PERSIAN_LEAP_YEARS = []; // مثلاً [1403, 1407, ...]
const SUPPORTED_YEARS = [1405, 1406]; // طبق درخواست - فعلاً فقط این دو سال

function daysInPersianMonth(month, fullYear) {
  if (!month) return 31;
  const m = Number(month);
  if (m <= 6) return 31;
  if (m <= 11) return 30;
  return PERSIAN_LEAP_YEARS.includes(fullYear) ? 30 : 29; // اسفند
}

// دراپ‌داون‌های روز/ماه/سال را می‌سازد. سال فقط دو رقم آخر (۰۵/۰۶) با پیش‌فرض ۰۵ -
// پیشوند «۱۴» به‌صورت ثابت در HTML کنارش نوشته شده، نه بخشی از انتخاب.
// روز به تعداد واقعی روزهای همون ماه/سال محدود می‌شه (با منطق اسفند/کبیسه).
function populateDateSelects() {
  const pairs = [['dateFromDay', 'dateFromMonth', 'dateFromYear'], ['dateToDay', 'dateToMonth', 'dateToYear']];

  pairs.forEach(([dayId, monthId, yearId]) => {
    const monthSel = document.getElementById(monthId);
    monthSel.innerHTML = '<option value="">ماه</option>' +
      PERSIAN_MONTHS.map((name, i) => `<option value="${i + 1}">${name}</option>`).join('');

    const yearSel = document.getElementById(yearId);
    yearSel.innerHTML = SUPPORTED_YEARS.map(y => {
      const yy = to2DigitYear(y);
      return `<option value="${yy}">${yy}</option>`;
    }).join('');
    yearSel.value = to2DigitYear(SUPPORTED_YEARS[0]); // پیش‌فرض ۰۵

    updateDayOptions(dayId, monthId, yearId);
    monthSel.addEventListener('change', () => updateDayOptions(dayId, monthId, yearId));
    yearSel.addEventListener('change', () => updateDayOptions(dayId, monthId, yearId));
  });
}

// وقتی ماه یا سال عوض بشه، تعداد روزهای قابل‌انتخاب رو دوباره می‌سازه (نه بیشتر از تعداد واقعی روزهای اون ماه)
function updateDayOptions(dayId, monthId, yearId) {
  const daySel = document.getElementById(dayId);
  const currentValue = daySel.value;
  const month = document.getElementById(monthId).value;
  const yy = document.getElementById(yearId).value;
  const fullYear = yy ? 1400 + Number(yy) : SUPPORTED_YEARS[0];
  const maxDay = daysInPersianMonth(month, fullYear);

  daySel.innerHTML = '<option value="">روز</option>' +
    Array.from({ length: maxDay }, (_, i) => i + 1).map(d => `<option value="${d}">${d}</option>`).join('');
  if (currentValue && Number(currentValue) <= maxDay) daySel.value = currentValue;
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

  [['dateFromDay', 'dateFromMonth', 'dateFromYear'], ['dateToDay', 'dateToMonth', 'dateToYear']].forEach(([dayId, monthId, yearId]) => {
    // اول ماه و سال، بعد بازسازی لیست روزها، بعد مقدار روز - وگرنه روز ممکنه هنوز توی لیست قدیمی نباشه
    document.getElementById(monthId).value = m;
    document.getElementById(yearId).value = yy;
    updateDayOptions(dayId, monthId, yearId);
    document.getElementById(dayId).value = d;
  });
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
  // ذخیره کلیدواژه/بازه تاریخ/فیلترهای پیشرفته برای دفعه بعد
  await window.api.searchOptions.save({
    keyword: opts.keyword,
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    sazejooFilters: opts.sazejooFilters,
    artaFilters: opts.artaFilters,
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

// ---------------- ارتباط سریع با کارفرما (پنل واتساپ/بله در داشبورد) ----------------
function buildQuickOutreachMessage() {
  const includeText = document.getElementById('includeText').checked;
  const includeWebsite = document.getElementById('includeWebsite').checked;
  const includeInstagram = document.getElementById('includeInstagram').checked;
  const includeCatalog = document.getElementById('includeCatalog').checked;

  const lines = ['سلام وقت بخیر'];
  if (includeText && currentSettings.introText) lines.push(currentSettings.introText);
  lines.push('');
  if (includeWebsite && currentSettings.website) lines.push(`وب‌سایت: ${currentSettings.website}`);
  if (includeInstagram && currentSettings.instagram) lines.push(`اینستاگرام: ${currentSettings.instagram}`);
  // توجه: چون کاتالوگ یک فایل محلی روی سیستم شماست (نه لینک اینترنتی)، اینجا فقط
  // به کاربر یادآوری می‌کنیم که قبل از ارسال، فایل رو دستی توی واتساپ/بله ضمیمه کنه.
  if (includeCatalog && currentSettings.catalogPath) lines.push('(کاتالوگ رو دستی به همین پیام ضمیمه کنید - لینک اینترنتی برای فایل محلی وجود نداره)');
  lines.push('');
  lines.push('با احترام');
  const signOff = [currentSettings.companyName, currentSettings.senderName].filter(Boolean).join(' - ');
  if (signOff) lines.push(signOff);

  return lines.join('\n');
}

function renderQuickOutreachPreview() {
  document.getElementById('quickOutreachPreview').textContent = buildQuickOutreachMessage();
}

['includeText', 'includeWebsite', 'includeInstagram', 'includeCatalog'].forEach(id => {
  document.getElementById(id).addEventListener('change', renderQuickOutreachPreview);
});

document.getElementById('quickWaBtn').addEventListener('click', () => {
  const phone = document.getElementById('quickOutreachPhone').value.trim();
  if (!phone) { alert('اول شماره تماس کارفرما رو وارد کن.'); return; }
  window.api.outreach.openWhatsApp(phone, buildQuickOutreachMessage());
});

document.getElementById('quickBaleBtn').addEventListener('click', () => {
  const phone = document.getElementById('quickOutreachPhone').value.trim();
  if (!phone) { alert('اول شماره تماس کارفرما رو وارد کن.'); return; }
  window.api.outreach.openBale(phone, buildQuickOutreachMessage());
});

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
    ...currentSettings,
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

let selectedCatalogPath = '';
document.getElementById('settingCatalogFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file && file.path) {
    selectedCatalogPath = file.path;
    document.getElementById('catalogStatus').textContent = `فایل انتخاب‌شده: ${file.name}`;
  }
});

document.getElementById('saveBusinessInfoBtn').addEventListener('click', async () => {
  currentSettings = {
    ...currentSettings,
    companyName: document.getElementById('settingCompanyName').value.trim(),
    senderName: document.getElementById('settingSenderName').value.trim(),
    senderPhone: document.getElementById('settingSenderPhone').value.trim(),
    introText: document.getElementById('settingIntroText').value.trim(),
    catalogPath: selectedCatalogPath || currentSettings.catalogPath || ''
  };
  await window.api.settings.save(currentSettings);
  updateCatalogStatus();
  alert('اطلاعات کسب‌وکار ذخیره شد.');
});

function updateCatalogStatus() {
  const statusEl = document.getElementById('catalogStatus');
  const openBtn = document.getElementById('openCatalogFolderBtn');
  if (currentSettings.catalogPath) {
    statusEl.textContent = `کاتالوگ ذخیره‌شده: ${currentSettings.catalogPath}`;
    openBtn.classList.remove('hidden');
  } else {
    statusEl.textContent = 'هنوز کاتالوگی آپلود نشده.';
    openBtn.classList.add('hidden');
  }
}

document.getElementById('openCatalogFolderBtn').addEventListener('click', () => {
  if (currentSettings.catalogPath) window.api.catalog.openFolder(currentSettings.catalogPath);
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
      renderSourceChips(); renderEmployerChips();
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
  renderSourceChips(); renderEmployerChips();
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
      renderSourceChips(); renderEmployerChips();
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
  renderSourceChips(); renderEmployerChips();
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
