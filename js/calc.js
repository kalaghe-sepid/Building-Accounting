/* محاسبات: تقسیم هزینه، دفتر هر واحد، دفتر صندوق، گزارش دوره‌ای */
(function () {
  'use strict';
  const C = {};
  const st = () => S.state;

  C.METHODS = {
    equal: 'مساوی بین همه‌ی واحدها',
    persons: 'به نسبت تعداد نفرات',
    area: 'به نسبت متراژ',
    coef: 'به نسبت ضریب واحد'
  };
  C.CHARGE_METHODS = Object.assign({ fixed: 'مبلغ ثابت برای هر واحد' }, C.METHODS);
  C.PAY_KINDS = { cash: 'نقدی', card: 'کارت‌به‌کارت', transfer: 'حواله / پایا', cheque: 'چک', other: 'سایر' };

  C.activeUnits = () => st().units.filter((u) => u.active).sort((a, b) => a.n - b.n);
  C.sortedUnits = () => st().units.slice().sort((a, b) => a.n - b.n);
  C.unitName = (id) => { const u = st().units.find((x) => x.id === id); return u ? u.name : '(حذف‌شده)'; };
  C.catName = (id) => { const c = st().categories.find((x) => x.id === id); return c ? c.name : '(بدون دسته)'; };

  /* نفرات یک واحد در یک ماه: آخرین مقدار صریح تا آن ماه، وگرنه مقدار پیش‌فرض واحد */
  C.personsInfo = (month, unit) => {
    const occ = st().occupants;
    const months = Object.keys(occ).filter((m) => m <= month).sort().reverse();
    for (const m of months) {
      if (occ[m][unit.id] != null) return { value: occ[m][unit.id], explicit: m === month, from: m };
    }
    return { value: unit.persons != null ? unit.persons : 1, explicit: false, from: null };
  };
  C.persons = (month, unit) => C.personsInfo(month, unit).value;

  C.weight = (method, month, unit) => {
    if (method === 'equal') return 1;
    if (method === 'persons') return C.persons(month, unit);
    if (method === 'area') return Number(unit.area) || 0;
    if (method === 'coef') return Number(unit.coef) || 0;
    return 0;
  };

  /* تقسیم مبلغ به نسبت وزن‌ها. حالت exact: جمع سهم‌ها دقیقاً برابر مبلغ؛ حالت up: گرد به بالا (مثل فایل اکسل) */
  C.distribute = (total, weights, mode, step) => {
    step = step > 0 ? step : 1;
    const W = weights.reduce((a, x) => a + x.w, 0);
    if (!(W > 0)) return null;
    const out = {};
    if (mode === 'up') {
      weights.forEach((x) => { out[x.id] = x.w > 0 ? Math.ceil((total * x.w) / W / step - 1e-9) * step : 0; });
      return out;
    }
    const steps = Math.floor(total / step);
    const rest = total - steps * step;
    const rows = weights.map((x) => {
      const raw = (steps * x.w) / W;
      const fl = Math.floor(raw + 1e-12);
      return { id: x.id, w: x.w, fl, frac: raw - fl };
    });
    let left = steps - rows.reduce((a, r) => a + r.fl, 0);
    const order = rows.filter((r) => r.w > 0).sort((a, b) => b.frac - a.frac);
    for (let i = 0; left > 0 && order.length; i = (i + 1) % order.length, left--) order[i].fl++;
    rows.forEach((r) => { out[r.id] = r.fl * step; });
    if (rest) {
      const big = rows.filter((r) => r.w > 0).sort((a, b) => b.w - a.w)[0];
      out[big.id] += rest;
    }
    return out;
  };

  /* سهم هر واحد از یک مبلغ. خروجی: { shares } یا { error } */
  C.allocate = (total, method, month) => {
    const units = C.activeUnits();
    if (!units.length) return { error: 'هیچ واحد فعالی تعریف نشده است.' };
    const r = st().settings.rounding;
    const weights = units.map((u) => ({ id: u.id, w: C.weight(method, month, u) }));
    const shares = C.distribute(total, weights, r.mode, r.step);
    if (!shares) {
      const why = { persons: 'تعداد نفرات همه‌ی واحدها صفر است.', area: 'متراژ هیچ واحدی ثبت نشده است.', coef: 'ضریب هیچ واحدی ثبت نشده است.' }[method] || 'مجموع وزن‌ها صفر است.';
      return { error: why };
    }
    return { shares };
  };

  /* مبلغ پیشنهادی شارژ ماهانه برای ماه مشخص */
  C.chargeItems = (month) => {
    const cfg = st().settings.charge;
    const units = C.activeUnits();
    if (cfg.method === 'fixed') {
      const items = {};
      units.forEach((u) => { items[u.id] = u.chargeOverride != null ? u.chargeOverride : cfg.amount; });
      return { items };
    }
    const a = C.allocate(cfg.amount, cfg.method, month);
    return a.error ? { error: a.error, items: {} } : { items: a.shares };
  };

  /* ---------- دفتر هر واحد ---------- */
  /* بدهکار شدن = debit ، پرداخت = credit ، مانده = بستانکار − بدهکار (مثبت = بستانکار) */
  C.entriesByUnit = () => {
    const s = st();
    const map = {};
    s.units.forEach((u) => {
      map[u.id] = [];
      if (u.opening) {
        map[u.id].push({
          date: s.settings.startDate, n: -1, kind: 'opening', title: 'مانده‌ی اول دوره',
          debit: u.opening < 0 ? -u.opening : 0, credit: u.opening > 0 ? u.opening : 0
        });
      }
    });
    s.expenses.forEach((e) => {
      if (e.void || !e.allocate) return;
      for (const uid in e.shares) {
        if (map[uid] && e.shares[uid]) map[uid].push({ date: e.date, n: e.n, kind: 'expense', title: e.title, cat: e.categoryId, debit: e.shares[uid], credit: 0, ref: e.id });
      }
    });
    s.charges.forEach((c) => {
      if (c.void) return;
      for (const uid in c.items) {
        if (map[uid] && c.items[uid]) map[uid].push({ date: c.date, n: c.n, kind: 'charge', title: c.title, debit: c.items[uid], credit: 0, ref: c.id });
      }
    });
    s.payments.forEach((p) => {
      if (p.void || !map[p.unitId]) return;
      map[p.unitId].push({ date: p.date, n: p.n, kind: 'payment', title: 'پرداخت' + (p.kind ? ' (' + C.PAY_KINDS[p.kind] + ')' : '') + (p.note ? ' – ' + p.note : ''), debit: 0, credit: p.amount, ref: p.id });
    });
    for (const uid in map) {
      map[uid].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n));
      let bal = 0;
      map[uid].forEach((e) => { bal += e.credit - e.debit; e.balance = bal; });
    }
    return map;
  };
  C.balances = () => {
    const m = C.entriesByUnit();
    const out = {};
    for (const uid in m) out[uid] = m[uid].length ? m[uid][m[uid].length - 1].balance : 0;
    return out;
  };
  /* مانده‌ی واحد تا پیش از یک تاریخ (برای ردیف «مانده از قبل») */
  C.balanceBefore = (entries, date) => {
    let b = 0;
    for (const e of entries) { if (e.date < date) b = e.balance; else break; }
    return b;
  };

  /* ---------- دفتر صندوق ---------- */
  C.fundEntries = () => {
    const s = st();
    const rows = [{ date: s.settings.startDate, n: -1, kind: 'opening', title: 'موجودی اول دوره', inn: Math.max(0, s.settings.fundOpening), out: Math.max(0, -s.settings.fundOpening) }];
    s.payments.forEach((p) => { if (!p.void) rows.push({ date: p.date, n: p.n, kind: 'payment', title: 'پرداخت ' + C.unitName(p.unitId), inn: p.amount, out: 0 }); });
    s.incomes.forEach((i) => { if (!i.void) rows.push({ date: i.date, n: i.n, kind: 'income', title: 'درآمد: ' + i.title, inn: i.amount, out: 0 }); });
    s.expenses.forEach((e) => { if (!e.void) rows.push({ date: e.date, n: e.n, kind: 'expense', title: 'هزینه: ' + e.title + ' (' + C.catName(e.categoryId) + ')', inn: 0, out: e.amount }); });
    rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.n - b.n));
    let bal = 0;
    rows.forEach((r) => { bal += r.inn - r.out; r.balance = bal; });
    return rows;
  };
  C.fundBalance = () => { const r = C.fundEntries(); return r.length ? r[r.length - 1].balance : 0; };
  C.fundBefore = (date) => { let b = 0; for (const r of C.fundEntries()) { if (r.date < date) b = r.balance; else break; } return b; };

  /* ---------- گزارش یک بازه (از..تا شامل دو سر) ---------- */
  C.period = (from, to) => {
    const s = st();
    const inr = (d) => d >= from && d <= to;
    const payments = s.payments.filter((p) => !p.void && inr(p.date));
    const incomes = s.incomes.filter((i) => !i.void && inr(i.date));
    const expenses = s.expenses.filter((e) => !e.void && inr(e.date));
    const charges = s.charges.filter((c) => !c.void && inr(c.date));
    const byCat = {};
    expenses.forEach((e) => { byCat[e.categoryId] = (byCat[e.categoryId] || 0) + e.amount; });
    const chargesTotal = U.sum(charges, (c) => U.sum(Object.values(c.items)));
    const allocated = U.sum(expenses.filter((e) => e.allocate), (e) => e.amount);
    return {
      payments: U.sum(payments, (p) => p.amount),
      incomes: U.sum(incomes, (i) => i.amount),
      expenses: U.sum(expenses, (e) => e.amount),
      byCat, chargesTotal, allocated,
      fundStart: C.fundBefore(from),
      fundEnd: C.fundBefore(to + '~')
    };
  };

  window.C = C;
})();
