const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const crypto = require('crypto');
const Store = require('electron-store');

const store = new Store({ name: 'project-finder-config' });

let mainWindow;
let tray;

// ---------- امنیت: کد ایمنی (PIN) ----------
function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

ipcMain.handle('security:isPinSet', () => {
  return !!store.get('security.pinHash');
});

ipcMain.handle('security:setPin', (event, pin) => {
  store.set('security.pinHash', hashPin(pin));
  return true;
});

ipcMain.handle('security:verifyPin', (event, pin) => {
  const saved = store.get('security.pinHash');
  return saved === hashPin(pin);
});

// ---------- پنجره اصلی ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#0f1115',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    title: 'داتام‌پوی',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, 'src', 'ui', 'index.html'));
}

function createTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'icon.ico'));
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  const menu = Menu.buildFromTemplate([
    { label: 'نمایش پنجره', click: () => mainWindow.show() },
    { label: 'خروج', click: () => app.quit() }
  ]);
  tray.setToolTip('داتام‌پوی — پایشگر پیدا کردن پروژه');
  tray.setContextMenu(menu);
  tray.on('click', () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------- باز کردن واتساپ / بله برای ارسال پیام به مسئول پروژه ----------
ipcMain.handle('outreach:openWhatsApp', (event, { phone, message }) => {
  const cleanPhone = String(phone).replace(/[^0-9]/g, '').replace(/^0/, '98');
  const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
  shell.openExternal(url);
});

ipcMain.handle('outreach:openBale', (event, { phone, message }) => {
  // بله لینک مستقیم ارسال پیام به شماره را از طریق API عمومی پشتیبانی نمی‌کند؛
  // این لینک اپ بله را باز می‌کند تا پیام به‌صورت دستی به مخاطب ارسال شود.
  const url = `https://ble.ir/`;
  shell.openExternal(url);
  return { note: 'بله لینک مستقیم شماره-به-شماره ندارد؛ باید شماره را داخل اپ جست‌وجو کنید یا از سایت پشتیبان bale.ai استفاده شود.' };
});

// ---------- اجرای اسکرپرها ----------
const { runAllScrapers } = require('./src/scrapers/runner');

ipcMain.handle('scan:run', async (event, opts) => {
  return await runAllScrapers(opts, (progress) => {
    if (mainWindow) mainWindow.webContents.send('scan:progress', progress);
  });
});

// ---------- باز کردن جستجوی لینکدین/اینستاگرام در مرورگر (این دو پلتفرم اسکرپ خودکار را عملاً مسدود می‌کنند) ----------
ipcMain.handle('search:openLinkedIn', (event, keyword) => {
  shell.openExternal(`https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}`);
});
ipcMain.handle('search:openInstagram', (event, keyword) => {
  shell.openExternal(`https://www.instagram.com/explore/tags/${encodeURIComponent(keyword.replace(/\s+/g, ''))}/`);
});

ipcMain.handle('config:getSites', () => {
  return require('./src/config/sites.json');
});

ipcMain.handle('config:saveSites', (event, sites) => {
  const fs = require('fs');
  fs.writeFileSync(path.join(__dirname, 'src', 'config', 'sites.json'), JSON.stringify(sites, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('leads:getAll', () => {
  return store.get('leads', []);
});

ipcMain.handle('leads:save', (event, leads) => {
  store.set('leads', leads);
  return true;
});

// ---------- ذخیره اطلاعات ورود سایت‌ها (فقط محلی، رمزنگاری‌نشده روی دیسک کاربر) ----------
ipcMain.handle('credentials:save', (event, { site, username, password }) => {
  store.set(`credentials.${site}`, { username, password });
  return true;
});

ipcMain.handle('credentials:get', (event, site) => {
  return store.get(`credentials.${site}`, { username: '', password: '' });
});

// ---------- لیست شخصی شرکت‌های پیمانکاری و کارفرمایان دولتی (محلی، قابل ویرایش) ----------
ipcMain.handle('companies:get', () => store.get('customCompanies', []));
ipcMain.handle('companies:save', (event, list) => { store.set('customCompanies', list); return true; });

ipcMain.handle('govEmployers:get', () => store.get('customGovEmployers', []));
ipcMain.handle('govEmployers:save', (event, list) => { store.set('customGovEmployers', list); return true; });

// ---------- بازه تاریخ و کلیدواژه آزاد جستجو ----------
ipcMain.handle('searchOptions:get', () => store.get('searchOptions', { keyword: '', dateFrom: null, dateTo: null }));
ipcMain.handle('searchOptions:save', (event, opts) => { store.set('searchOptions', opts); return true; });

// ---------- تنظیمات عمومی (لینک‌ها، کد ملی برای فوتر) ----------
ipcMain.handle('settings:get', () => {
  return store.get('appSettings', {
    website: '',
    instagram: '',
    linkedin: '',
    nationalId: ''
  });
});

ipcMain.handle('settings:save', (event, settings) => {
  store.set('appSettings', settings);
  return true;
});

// ---------- نسخه اپلیکیشن برای نمایش در فوتر ----------
ipcMain.handle('app:getVersion', () => app.getVersion());
