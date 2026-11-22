/* لایه‌ی داده: ذخیره در IndexedDB، تاریخچه‌ی تغییرات، پشتیبان‌گیری و بازیابی */
(function () {
  'use strict';
  const SCHEMA = 1;
  const APP = 'building-accounting';
  const DB_NAME = 'building-accounting-db';

  const MARKER = 'ba-marker';
  const S = { lost: null, state: null, fileHandle: null, fileNeedsPermission: false, lastFileSave: null, persisted: null };
  const listeners = [];
  S.onChange = (fn) => listeners.push(fn);
  const emit = () => listeners.forEach((f) => f());

  /* ---------- IndexedDB ---------- */
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('snapshots')) d.createObjectStore('snapshots');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
    return dbp;
  }
  async function idb(store, mode, fn) {
    const d = await db();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(store, mode);
      const st = tx.objectStore(store);
      const req = fn(st);
      tx.oncomplete = () => resolve(req && req.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }
  const kvGet = (k) => idb('kv', 'readonly', (s) => s.get(k));
  const kvPut = (k, v) => idb('kv', 'readwrite', (s) => s.put(v, k));
  S._kvGet = kvGet; S._kvPut = kvPut;

  /* ---------- وضعیت پیش‌فرض ---------- */
  S.defaultState = () => ({
    app: APP,
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastBackupAt: null,
    changesSinceBackup: 0,
    seq: 0,
    settings: {
      buildingName: '',
      address: '',
      manager: '',
      currency: 'IRR',
      startDate: U.todayJ().slice(0, 4) + '/01/01',
      fundOpening: 0,
      allocateDefault: true,
      rounding: { mode: 'exact', step: 10 },
      charge: { title: 'شارژ ماهانه', amount: 0, method: 'fixed' },
      backupRemindDays: 7,
      statementNote: ''
    },
    units: [],
    occupants: {},
    categories: [
      { id: U.uid(), name: 'آب', method: 'persons', allocate: true },
      { id: U.uid(), name: 'برق مشاعات', method: 'equal', allocate: true },
      { id: U.uid(), name: 'آسانسور', method: 'equal', allocate: true },
      { id: U.uid(), name: 'نظافت', method: 'equal', allocate: true },
      { id: U.uid(), name: 'تعمیرات', method: 'equal', allocate: true },
      { id: U.uid(), name: 'سایر', method: 'equal', allocate: true }
    ],
    expenses: [],
    charges: [],
    payments: [],
    incomes: [],
    log: []
  });

  /* ---------- اعتبارسنجی و مهاجرت ---------- */
  S.validate = (o) => {
    if (!o || typeof o !== 'object') return 'فایل معتبر نیست.';
    if (o.app !== APP) return 'این فایل پشتیبان این نرم‌افزار نیست.';
    if (typeof o.schema !== 'number' || o.schema > SCHEMA) return 'این فایل با نسخه‌ی جدیدتری ساخته شده است.';
    for (const k of ['units', 'categories', 'expenses', 'charges', 'payments', 'incomes', 'log']) {
      if (!Array.isArray(o[k])) return 'ساختار فایل ناقص است (' + k + ').';
    }
    if (!o.settings || typeof o.settings !== 'object') return 'تنظیمات در فایل نیست.';
    if (!o.occupants || typeof o.occupants !== 'object') return 'اطلاعات نفرات در فایل نیست.';
    return null;
  };
  function migrate(o) {
    const d = S.defaultState();
    o.settings = Object.assign({}, d.settings, o.settings);
    o.settings.rounding = Object.assign({}, d.settings.rounding, o.settings.rounding || {});
    o.settings.charge = Object.assign({}, d.settings.charge, o.settings.charge || {});
    o.seq = o.seq || 0;
    o.changesSinceBackup = o.changesSinceBackup || 0;
    return o;
  }

  /* ---------- بارگذاری و ذخیره ---------- */
  S.load = async () => {
    const st = await kvGet('state');
    if (st && !S.validate(st)) {
      S.state = migrate(st);
      U.setCurrency(S.state.settings.currency);
    }
    try { S.fileHandle = (await kvGet('fileHandle')) || null; } catch (e) { S.fileHandle = null; }
    if (S.fileHandle && S.fileHandle.queryPermission) {
      try { S.fileNeedsPermission = (await S.fileHandle.queryPermission({ mode: 'readwrite' })) !== 'granted'; } catch (e) { S.fileNeedsPermission = true; }
    }
    if (navigator.storage && navigator.storage.persist) {
      try { S.persisted = (await navigator.storage.persisted()) || (await navigator.storage.persist()); } catch (e) { S.persisted = null; }
    }
    if (S.state) await S.autoSnapshot();
    else {
      /* اگر قبلاً اطلاعاتی ثبت شده بود ولی الان نیست، یعنی مرورگر آن را پاک کرده */
      try { S.lost = JSON.parse(localStorage.getItem(MARKER) || 'null'); } catch (e) { S.lost = null; }
    }
    return S.state;
  };

  let saveTimer = null, fileTimer = null;
  S.save = (quiet) => {
    S.state.updatedAt = new Date().toISOString();
    if (!quiet) S.state.changesSinceBackup = (S.state.changesSinceBackup || 0) + 1;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(S.flush, 200);
    if (S.fileHandle && !S.fileNeedsPermission) {
      clearTimeout(fileTimer);
      fileTimer = setTimeout(S.writeFile, 1500);
    }
  };
  S.flush = async () => {
    clearTimeout(saveTimer);
    if (!S.state) return;
    await kvPut('state', JSON.parse(JSON.stringify(S.state)));
    try {
      const st = S.state;
      localStorage.setItem(MARKER, JSON.stringify({
        createdAt: st.createdAt, updatedAt: st.updatedAt, lastBackupAt: st.lastBackupAt,
        name: st.settings.buildingName, units: st.units.length, records: st.expenses.length + st.payments.length + st.charges.length
      }));
    } catch (e) { /* ممکن است مسدود باشد */ }
  };
  S.dismissLost = () => { try { localStorage.removeItem(MARKER); } catch (e) {} S.lost = null; emit(); };
  window.addEventListener('pagehide', () => { S.flush(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) S.flush(); });

  S.init = async (settings, unitCount) => {
    const st = S.defaultState();
    Object.assign(st.settings, settings);
    for (let i = 1; i <= unitCount; i++) {
      st.units.push(newUnit(st, 'واحد ' + U.toFa(i)));
    }
    S.state = st;
    S.lost = null;
    U.setCurrency(st.settings.currency);
    S.addLog('settings', 'init', 'create', null, null, 'ایجاد پرونده‌ی ساختمان');
    await S.flush();
    emit();
  };

  function newUnit(st, name) {
    return {
      id: U.uid(), n: ++st.seq, name, ownerName: '', ownerPhone: '', ownerLives: true,
      residentName: '', residentPhone: '', area: 0, coef: 1, persons: 1, opening: 0,
      chargeOverride: null, active: true, note: ''
    };
  }
  S.newUnit = (name) => newUnit(S.state, name);

  /* ---------- تاریخچه‌ی تغییرات ---------- */
  S.addLog = (entity, refId, action, before, after, reason, label) => {
    S.state.log.push({
      id: U.uid(), ts: new Date().toISOString(), entity, refId, action,
      label: label || '', before: before ? U.clone(before) : null, after: after ? U.clone(after) : null,
      reason: reason || ''
    });
  };

  const COLL = { expense: 'expenses', charge: 'charges', payment: 'payments', income: 'incomes', unit: 'units' };
  S.coll = (entity) => S.state[COLL[entity]];
  S.find = (entity, id) => S.coll(entity).find((x) => x.id === id);

  S.create = (entity, rec, label) => {
    rec.id = U.uid(); rec.n = ++S.state.seq; rec.void = false;
    rec.createdAt = new Date().toISOString();
    S.coll(entity).push(rec);
    S.addLog(entity, rec.id, 'create', null, rec, '', label);
    S.save(); emit();
    return rec;
  };
  S.update = (entity, id, patch, reason, label) => {
    const rec = S.find(entity, id);
    const before = U.clone(rec);
    Object.assign(rec, patch);
    rec.updatedAt = new Date().toISOString();
    S.addLog(entity, id, 'update', before, rec, reason, label);
    S.save(); emit();
  };
  S.setVoid = (entity, id, isVoid, reason, label) => {
    const rec = S.find(entity, id);
    const before = U.clone(rec);
    rec.void = isVoid;
    rec.voidReason = isVoid ? reason : '';
    rec.updatedAt = new Date().toISOString();
    S.addLog(entity, id, isVoid ? 'void' : 'restore', before, rec, reason, label);
    S.save(); emit();
  };

  /* نفرات ماهانه: value=null یعنی حذف مقدار صریح و ارث‌بری از ماه قبل */
  S.setPersons = (month, unitId, value, label) => {
    const occ = S.state.occupants;
    const beforeVal = occ[month] && occ[month][unitId] != null ? occ[month][unitId] : null;
    if (beforeVal === value) return;
    if (value == null) {
      if (occ[month]) { delete occ[month][unitId]; if (!Object.keys(occ[month]).length) delete occ[month]; }
    } else {
      if (!occ[month]) occ[month] = {};
      occ[month][unitId] = value;
    }
    S.addLog('occupants', unitId, 'update', { month, persons: beforeVal }, { month, persons: value }, '', label);
    S.save(); emit();
  };

  S.updateSettings = (patch, label) => {
    const before = U.clone(S.state.settings);
    Object.assign(S.state.settings, patch);
    U.setCurrency(S.state.settings.currency);
    S.addLog('settings', 'settings', 'update', before, S.state.settings, '', label);
    S.save(); emit();
  };

  S.createUnit = (name, patch) => {
    const u = S.newUnit(name);
    if (patch) Object.assign(u, patch);
    S.state.units.push(u);
    S.addLog('unit', u.id, 'create', null, u, '', name);
    S.save(); emit();
    return u;
  };
  S.deleteUnit = (id) => {
    const u = S.find('unit', id);
    S.state.units = S.state.units.filter((x) => x.id !== id);
    S.addLog('unit', id, 'delete', u, null, '', u.name);
    S.save(); emit();
  };

  S.createCategory = (name, method, allocate) => {
    const c = { id: U.uid(), name, method, allocate };
    S.state.categories.push(c);
    S.addLog('category', c.id, 'create', null, c, '', name);
    S.save(); emit();
    return c;
  };
  S.updateCategory = (id, patch) => {
    const c = S.state.categories.find((x) => x.id === id);
    const before = U.clone(c);
    Object.assign(c, patch);
    S.addLog('category', id, 'update', before, c, '', c.name);
    S.save(); emit();
  };
  S.deleteCategory = (id) => {
    const c = S.state.categories.find((x) => x.id === id);
    S.state.categories = S.state.categories.filter((x) => x.id !== id);
    S.addLog('category', id, 'delete', c, null, '', c.name);
    S.save(); emit();
  };

  /* ---------- پشتیبان‌گیری ---------- */
  S.exportJSON = () => JSON.stringify(S.state, null, 1);
  S.downloadBackup = () => {
    const blob = new Blob([S.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    const name = (S.state.settings.buildingName || 'building').replace(/[^\p{L}\p{N}]+/gu, '-');
    a.href = URL.createObjectURL(blob);
    a.download = 'backup-' + name + '-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    S.markBackedUp();
  };
  S.markBackedUp = () => {
    S.state.lastBackupAt = new Date().toISOString();
    S.state.changesSinceBackup = 0;
    S.save(true); emit();
  };
  S.parseBackup = (text) => {
    let o;
    try { o = JSON.parse(text); } catch (e) { return { error: 'فایل JSON معتبر نیست.' }; }
    const err = S.validate(o);
    return err ? { error: err } : { data: o };
  };
  S.restore = async (o) => {
    if (S.state) await S.snapshot('manual-' + Date.now());
    S.state = migrate(o);
    S.lost = null;
    S.state.changesSinceBackup = 0;
    S.addLog('settings', 'restore', 'update', null, null, 'بازیابی از فایل پشتیبان');
    U.setCurrency(S.state.settings.currency);
    await S.flush();
    emit();
  };
  S.wipe = async () => {
    if (S.state) await S.snapshot('manual-' + Date.now());
    S.state = null;
    S.lost = null;
    try { localStorage.removeItem(MARKER); } catch (e) {}
    await idb('kv', 'readwrite', (s) => s.delete('state'));
    emit();
  };

  /* ---------- نسخه‌های خودکار داخلی ---------- */
  S.snapshot = async (key) => {
    await idb('snapshots', 'readwrite', (s) => s.put({ ts: new Date().toISOString(), state: JSON.parse(JSON.stringify(S.state)) }, key));
    await pruneSnapshots();
  };
  S.autoSnapshot = async () => {
    const key = 'auto-' + new Date().toISOString().slice(0, 10);
    const ex = await idb('snapshots', 'readonly', (s) => s.get(key));
    if (!ex) await S.snapshot(key);
  };
  async function pruneSnapshots() {
    const keys = await idb('snapshots', 'readonly', (s) => s.getAllKeys());
    const prune = async (prefix, keep) => {
      const ks = keys.filter((k) => String(k).startsWith(prefix)).sort();
      for (const k of ks.slice(0, Math.max(0, ks.length - keep))) await idb('snapshots', 'readwrite', (s) => s.delete(k));
    };
    await prune('auto-', 7);
    await prune('manual-', 5);
  }
  S.listSnapshots = async () => {
    const keys = await idb('snapshots', 'readonly', (s) => s.getAllKeys());
    const out = [];
    for (const k of keys.sort().reverse()) {
      const v = await idb('snapshots', 'readonly', (s) => s.get(k));
      if (v) out.push({ key: k, ts: v.ts, units: v.state.units.length, tx: v.state.expenses.length + v.state.payments.length });
    }
    return out;
  };
  S.restoreSnapshot = async (key) => {
    const v = await idb('snapshots', 'readonly', (s) => s.get(key));
    if (!v) return false;
    await S.restore(v.state);
    return true;
  };

  /* ---------- ذخیره‌ی خودکار در فایل (Chrome / Edge دسکتاپ) ---------- */
  S.fileSupported = () => typeof window.showSaveFilePicker === 'function';
  S.pickFile = async () => {
    const h = await window.showSaveFilePicker({
      suggestedName: 'building-accounting-data.json',
      types: [{ description: 'فایل داده', accept: { 'application/json': ['.json'] } }]
    });
    S.fileHandle = h; S.fileNeedsPermission = false;
    await kvPut('fileHandle', h);
    await S.writeFile();
    emit();
  };
  S.regrantFile = async () => {
    const p = await S.fileHandle.requestPermission({ mode: 'readwrite' });
    S.fileNeedsPermission = p !== 'granted';
    if (!S.fileNeedsPermission) await S.writeFile();
    emit();
  };
  S.unlinkFile = async () => {
    S.fileHandle = null; S.fileNeedsPermission = false;
    await idb('kv', 'readwrite', (s) => s.delete('fileHandle'));
    emit();
  };
  S.writeFile = async () => {
    if (!S.fileHandle || !S.state) return;
    try {
      const w = await S.fileHandle.createWritable();
      await w.write(S.exportJSON());
      await w.close();
      S.lastFileSave = new Date().toISOString();
      S.state.lastBackupAt = S.lastFileSave;
      S.state.changesSinceBackup = 0;
      await S.flush();
      if (S.onFile) S.onFile();
    } catch (e) {
      S.fileNeedsPermission = true;
      if (S.onFile) S.onFile();
    }
  };

  window.S = S;
})();
