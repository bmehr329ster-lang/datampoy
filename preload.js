const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  security: {
    isPinSet: () => ipcRenderer.invoke('security:isPinSet'),
    setPin: (pin) => ipcRenderer.invoke('security:setPin', pin),
    verifyPin: (pin) => ipcRenderer.invoke('security:verifyPin', pin)
  },
  outreach: {
    openWhatsApp: (phone, message) => ipcRenderer.invoke('outreach:openWhatsApp', { phone, message }),
    openBale: (phone, message) => ipcRenderer.invoke('outreach:openBale', { phone, message })
  },
  scan: {
    run: (opts) => ipcRenderer.invoke('scan:run', opts),
    onProgress: (cb) => ipcRenderer.on('scan:progress', (event, data) => cb(data))
  },
  config: {
    getSites: () => ipcRenderer.invoke('config:getSites'),
    saveSites: (sites) => ipcRenderer.invoke('config:saveSites', sites)
  },
  leads: {
    getAll: () => ipcRenderer.invoke('leads:getAll'),
    save: (leads) => ipcRenderer.invoke('leads:save', leads)
  },
  credentials: {
    save: (site, username, password) => ipcRenderer.invoke('credentials:save', { site, username, password }),
    get: (site) => ipcRenderer.invoke('credentials:get', site)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: (settings) => ipcRenderer.invoke('settings:save', settings)
  },
  companies: {
    get: () => ipcRenderer.invoke('companies:get'),
    save: (list) => ipcRenderer.invoke('companies:save', list)
  },
  govEmployers: {
    get: () => ipcRenderer.invoke('govEmployers:get'),
    save: (list) => ipcRenderer.invoke('govEmployers:save', list)
  },
  searchOptions: {
    get: () => ipcRenderer.invoke('searchOptions:get'),
    save: (opts) => ipcRenderer.invoke('searchOptions:save', opts)
  },
  externalSearch: {
    linkedin: (keyword) => ipcRenderer.invoke('search:openLinkedIn', keyword),
    instagram: (keyword) => ipcRenderer.invoke('search:openInstagram', keyword)
  },
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion')
  }
});
