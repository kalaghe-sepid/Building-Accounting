/* صفحه‌ها: گزارش‌ها، صورت‌حساب چاپی، تاریخچه‌ی تغییرات */
(function () {
  'use strict';
  const { esc } = U;
  const { fld, sel, M } = UI;
  const P = UI.pages, H = UI.h;
  const thisMonth = () => U.todayJ().slice(0, 7);
  const L = () => U.unitLabel();

  const TABS = [['balances', 'بدهکاران و بستانکاران'], ['ledger', 'گردش حساب واحد'], ['monthly', 'گزارش ماهانه'], ['yearly', 'گزارش سالانه'], ['fund', 'گردش صندوق']];

  P.reports = (sub) => {
    sub = TABS.some((t) => t[0] === sub) ? sub : 'balances';
    const tabs = '<div class="tabs noprint">' + TABS.map(([k, t]) => '<a href="#/reports/' + k + '"' + (k === sub ? ' aria-current="page"' : '') + '>' + t + '</a>').join('') + '</div>';
    return '<div class="pagehead noprint"><h2>گزارش‌ها</h2><div class="tools"><button class="btn" data-act="print">چاپ این گزارش</button></div></div>' + tabs + R[sub]();
  };
  const R = {};
  const head = (t) => '<h3 style="margin-bottom:8px">' + esc(S.state.settings.buildingName || '') + ' – ' + t + '</h3>';

  H.setDateF = (el) => {
    const k = el.dataset.k;
    if (el.value.trim() === '') { UI.f[k] = ''; UI.render(); return; }
    const d = U.parseDate(el.value);
    if (!d) { UI.toast('تاریخ معتبر نیست.'); return; }
    UI.f[k] = d; UI.render();
  };
  const dateFilter = (k, label) => '<div class="fld"><span>' + label + '</span><input data-change="setDateF" data-k="' + k + '" dir="ltr" inputmode="numeric" placeholder="همه" value="' + esc(U.fmtDate(UI.f[k] || '')) + '" style="max-width:140px"></div>';

  /* ---------- بدهکاران و بستانکاران ---------- */
  R.balances = () => {
    const bal = C.balances();
    const us = C.sortedUnits();
    const deb = us.filter((u) => bal[u.id] < 0).sort((a, b) => bal[a.id] - bal[b.id]);
    const cre = us.filter((u) => bal[u.id] > 0).sort((a, b) => bal[b.id] - bal[a.id]);
    const zero = us.filter((u) => !bal[u.id]);
    const tbl = (list, cls, sign) => list.length ? '<div class="tablewrap"><table><thead><tr><th>واحد</th><th>مالک / ساکن</th><th class="n">مبلغ (' + L() + ')</th></tr></thead><tbody>' +
      list.map((u) => '<tr><td><a href="#/reports/ledger" data-act="openLedger" data-id="' + u.id + '">' + esc(u.name) + '</a></td><td>' + esc(u.ownerLives ? u.ownerName : (u.residentName || u.ownerName)) + '</td><td class="n ' + cls + '">' + M(sign * bal[u.id]) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td colspan="2">جمع</td><td class="n">' + M(U.sum(list, (u) => sign * bal[u.id])) + '</td></tr></tfoot></table></div>' : '<div class="empty">موردی نیست.</div>';
    return head('وضعیت بدهکاران و بستانکاران') + '<p class="muted">تا تاریخ ' + U.fmtDate(U.todayJ()) + '</p><div class="grid c2"><div><h3>بدهکاران (' + U.toFa(deb.length) + ')</h3>' + tbl(deb, 'db', -1) + '</div><div><h3>بستانکاران (' + U.toFa(cre.length) + ')</h3>' + tbl(cre, 'cr', 1) + '</div></div>' +
      '<p class="muted" style="margin-top:10px">واحدهای تسویه‌شده: ' + U.toFa(zero.length) + '</p>';
  };

  /* ---------- گردش حساب واحد + صورت‌حساب ---------- */
  function ledgerData(u, from, to) {
    const all = C.entriesByUnit()[u.id] || [];
    const rows = [];
    let pre = 0;
    if (from) {
      pre = C.balanceBefore(all, from);
      rows.push({ date: from, title: 'مانده از قبل', debit: pre < 0 ? -pre : 0, credit: pre > 0 ? pre : 0, balance: pre });
    }
    all.filter((e) => (!from || e.date >= from) && (!to || e.date <= to)).forEach((e) => rows.push(e));
    const final = rows.length ? rows[rows.length - 1].balance : 0;
    return { rows, final, totalDebit: U.sum(rows.filter((r) => r.kind), (r) => r.debit), totalCredit: U.sum(rows.filter((r) => r.kind), (r) => r.credit) };
  }
  function ledgerTable(d) {
    const body = d.rows.map((e) => '<tr><td>' + U.fmtDate(e.date) + '</td><td>' + esc(e.title) + (e.cat ? ' <small class="muted">(' + esc(C.catName(e.cat)) + ')</small>' : '') + '</td>' +
      '<td class="n">' + (e.debit ? M(e.debit) : '') + '</td><td class="n">' + (e.credit ? M(e.credit) : '') + '</td><td class="n">' + UI.bal(e.balance) + '</td></tr>').join('');
    return '<div class="tablewrap"><table><thead><tr><th>تاریخ</th><th>شرح</th><th class="n">بدهی (' + L() + ')</th><th class="n">پرداختی (' + L() + ')</th><th class="n">مانده</th></tr></thead><tbody>' + (body || '<tr><td colspan="5" class="empty">گردشی نیست.</td></tr>') +
      '</tbody><tfoot><tr><td colspan="2">جمع</td><td class="n">' + M(d.totalDebit) + '</td><td class="n">' + M(d.totalCredit) + '</td><td class="n">' + UI.bal(d.final) + '</td></tr></tfoot></table></div>';
  }
  R.ledger = () => {
    const us = C.sortedUnits();
    if (!us.length) return '<div class="empty">واحدی تعریف نشده.</div>';
    if (!us.some((u) => u.id === UI.f.ledgerUnit)) UI.f.ledgerUnit = us[0].id;
    const u = us.find((x) => x.id === UI.f.ledgerUnit);
    const d = ledgerData(u, UI.f.lFrom || '', UI.f.lTo || '');
    return '<div class="filters noprint"><div class="fld"><span>واحد</span>' + sel('', UI.unitOptions(false, true), u.id, 'data-change="setF" data-k="ledgerUnit"') + '</div>' +
      dateFilter('lFrom', 'از تاریخ') + dateFilter('lTo', 'تا تاریخ') +
      '<button class="btn primary" data-act="printOne">چاپ صورت‌حساب این واحد</button><button class="btn" data-act="printAll">چاپ صورت‌حساب همه‌ی واحدها</button></div>' +
      head('گردش حساب ' + esc(u.name)) + ledgerTable(d);
  };
  function stmtHTML(u, from, to) {
    const s = S.state.settings;
    const d = ledgerData(u, from, to);
    const per = from || to ? 'بازه: ' + (from ? 'از ' + U.fmtDate(from) : '') + ' ' + (to ? 'تا ' + U.fmtDate(to) : '') : 'بازه: از ابتدا تا امروز';
    return '<section class="stmt"><h1>صورت‌حساب ' + esc(u.name) + '</h1><div>' + esc(s.buildingName) + (s.address ? ' – ' + esc(s.address) : '') + '</div>' +
      '<div class="meta"><span>مالک: ' + esc(u.ownerName || '–') + '</span><span>ساکن: ' + esc(u.ownerLives ? (u.ownerName || '–') : (u.residentName || '–')) + '</span>' +
      '<span>' + per + '</span><span>تاریخ صدور: ' + U.fmtDate(U.todayJ()) + '</span></div>' + ledgerTable(d) +
      '<div class="final"><span>مانده‌ی نهایی</span><span>' + (d.final ? M(Math.abs(d.final)) + ' ' + L() + (d.final < 0 ? ' بدهکار' : ' بستانکار') : 'تسویه') + '</span></div>' +
      (s.statementNote ? '<div class="note">' + esc(s.statementNote) + '</div>' : '') + (s.manager ? '<div class="note">مدیر ساختمان: ' + esc(s.manager) + '</div>' : '') + '</section>';
  }
  H.printOne = () => UI.printHTML(stmtHTML(S.find('unit', UI.f.ledgerUnit), UI.f.lFrom || '', UI.f.lTo || ''));
  H.printAll = () => {
    const us = C.sortedUnits().filter((u) => u.active || (C.balances()[u.id] || 0) !== 0);
    UI.printHTML(us.map((u) => stmtHTML(u, UI.f.lFrom || '', UI.f.lTo || '')).join(''));
  };

  /* ---------- جمع‌های بازه برای هر واحد ---------- */
  function unitPeriod(entries, from, to) {
    let debit = 0, credit = 0, end = 0;
    for (const e of entries) {
      if (e.date <= to) end = e.balance;
      if (e.kind !== 'opening' && e.date >= from && e.date <= to) { debit += e.debit; credit += e.credit; }
    }
    return { debit, credit, end };
  }
  const catRows = (byCat) => {
    const ents = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
    return ents.length ? ents.map(([id, v]) => '<tr><td>' + esc(C.catName(id)) + '</td><td class="n">' + M(v) + '</td></tr>').join('') : '<tr><td colspan="2" class="empty">هزینه‌ای نیست.</td></tr>';
  };
  const unitTable = (from, to, dl, cl) => {
    const map = C.entriesByUnit();
    const us = C.sortedUnits();
    let td = 0, tc = 0;
    const rows = us.map((u) => {
      const p = unitPeriod(map[u.id] || [], from, to);
      td += p.debit; tc += p.credit;
      return '<tr><td>' + esc(u.name) + '</td><td class="n">' + M(p.debit) + '</td><td class="n">' + M(p.credit) + '</td><td class="n">' + UI.bal(p.end) + '</td></tr>';
    }).join('');
    return '<div class="tablewrap"><table><thead><tr><th>واحد</th><th class="n">' + dl + ' (' + L() + ')</th><th class="n">' + cl + ' (' + L() + ')</th><th class="n">مانده در پایان</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td>جمع</td><td class="n">' + M(td) + '</td><td class="n">' + M(tc) + '</td><td></td></tr></tfoot></table></div>';
  };

  /* ---------- گزارش ماهانه ---------- */
  R.monthly = () => {
    const m = UI.f.rMonth || thisMonth();
    const from = U.monthStart(m), to = U.monthEnd(m);
    const p = C.period(from, to);
    return '<div class="filters noprint"><div class="fld"><span>ماه</span>' + sel('', UI.monthOptions(m), m, 'data-change="setF" data-k="rMonth"') + '</div></div>' +
      head('گزارش مالی ' + U.fmtMonth(m)) +
      '<div class="grid c4" style="margin-bottom:14px">' +
      '<div class="stat"><div class="k">موجودی اول ماه</div><div class="v num">' + M(p.fundStart) + '</div></div>' +
      '<div class="stat"><div class="k">دریافتی از واحدها</div><div class="v num cr">' + M(p.payments) + '</div></div>' +
      '<div class="stat"><div class="k">درآمد متفرقه</div><div class="v num cr">' + M(p.incomes) + '</div></div>' +
      '<div class="stat"><div class="k">هزینه‌ها</div><div class="v num db">' + M(p.expenses) + '</div></div>' +
      '<div class="stat hero"><div class="k">موجودی پایان ماه</div><div class="v num">' + M(p.fundEnd) + ' <small>' + L() + '</small></div></div>' +
      '<div class="stat"><div class="k">شارژ ثبت‌شده در ماه</div><div class="v num">' + M(p.chargesTotal) + '</div></div>' +
      '<div class="stat"><div class="k">هزینه‌ی تقسیم‌شده بین واحدها</div><div class="v num">' + M(p.allocated) + '</div></div></div>' +
      '<div class="grid c2"><div><h3>هزینه به تفکیک دسته</h3><div class="tablewrap"><table><thead><tr><th>دسته</th><th class="n">مبلغ (' + L() + ')</th></tr></thead><tbody>' + catRows(p.byCat) + '</tbody><tfoot><tr><td>جمع</td><td class="n">' + M(p.expenses) + '</td></tr></tfoot></table></div></div>' +
      '<div><h3>وضعیت واحدها در این ماه</h3>' + unitTable(from, to, 'بدهی ماه', 'پرداختی ماه') + '</div></div>';
  };

  /* ---------- گزارش سالانه ---------- */
  R.yearly = () => {
    const y = UI.f.rYear || +thisMonth().slice(0, 4);
    const rows = [];
    let t = { payments: 0, incomes: 0, expenses: 0, chargesTotal: 0 };
    for (let mo = 1; mo <= 12; mo++) {
      const mk = y + '/' + String(mo).padStart(2, '0');
      const p = C.period(U.monthStart(mk), U.monthEnd(mk));
      for (const k in t) t[k] += p[k];
      rows.push('<tr><td>' + U.MONTHS[mo - 1] + '</td><td class="n">' + M(p.chargesTotal) + '</td><td class="n">' + M(p.payments) + '</td><td class="n">' + M(p.incomes) + '</td><td class="n">' + M(p.expenses) + '</td><td class="n">' + M(p.fundEnd) + '</td></tr>');
    }
    const yp = C.period(y + '/01/01', y + '/12/31');
    return '<div class="filters noprint"><div class="fld"><span>سال</span>' + sel('', UI.yearOptions(y), y, 'data-change="setF" data-k="rYear"') + '</div></div>' +
      head('گزارش مالی سال ' + U.toFa(y)) +
      '<div class="tablewrap"><table><thead><tr><th>ماه</th><th class="n">شارژ ثبت‌شده</th><th class="n">دریافتی از واحدها</th><th class="n">درآمد متفرقه</th><th class="n">هزینه‌ها</th><th class="n">موجودی پایان ماه</th></tr></thead><tbody>' + rows.join('') +
      '</tbody><tfoot><tr><td>جمع سال</td><td class="n">' + M(t.chargesTotal) + '</td><td class="n">' + M(t.payments) + '</td><td class="n">' + M(t.incomes) + '</td><td class="n">' + M(t.expenses) + '</td><td class="n">' + M(yp.fundEnd) + '</td></tr></tfoot></table></div>' +
      '<p class="muted">همه‌ی مبالغ به ' + L() + ' است.</p>' +
      '<div class="grid c2" style="margin-top:14px"><div><h3>هزینه‌ی سال به تفکیک دسته</h3><div class="tablewrap"><table><thead><tr><th>دسته</th><th class="n">مبلغ</th></tr></thead><tbody>' + catRows(yp.byCat) + '</tbody><tfoot><tr><td>جمع</td><td class="n">' + M(yp.expenses) + '</td></tr></tfoot></table></div></div>' +
      '<div><h3>وضعیت واحدها در سال</h3>' + unitTable(y + '/01/01', y + '/12/31', 'بدهی سال', 'پرداختی سال') + '</div></div>';
  };

  /* ---------- گردش صندوق ---------- */
  R.fund = () => {
    const from = UI.f.fFrom || '', to = UI.f.fTo || '';
    const all = C.fundEntries();
    const rows = [];
    if (from) { const b = C.fundBefore(from); rows.push('<tr><td>' + U.fmtDate(from) + '</td><td>مانده از قبل</td><td class="n"></td><td class="n"></td><td class="n">' + M(b) + '</td></tr>'); }
    const list = all.filter((r) => (!from || r.date >= from) && (!to || r.date <= to));
    list.forEach((r) => rows.push('<tr><td>' + U.fmtDate(r.date) + '</td><td>' + esc(r.title) + '</td><td class="n cr">' + (r.inn ? M(r.inn) : '') + '</td><td class="n db">' + (r.out ? M(r.out) : '') + '</td><td class="n">' + M(r.balance) + '</td></tr>'));
    return '<div class="filters noprint">' + dateFilter('fFrom', 'از تاریخ') + dateFilter('fTo', 'تا تاریخ') + '</div>' + head('گردش صندوق') +
      '<div class="tablewrap"><table><thead><tr><th>تاریخ</th><th>شرح</th><th class="n">دریافت (' + L() + ')</th><th class="n">پرداخت (' + L() + ')</th><th class="n">موجودی</th></tr></thead><tbody>' + rows.join('') +
      '</tbody><tfoot><tr><td colspan="2">جمع بازه</td><td class="n">' + M(U.sum(list, (r) => r.inn)) + '</td><td class="n">' + M(U.sum(list, (r) => r.out)) + '</td><td class="n">' + M(C.fundBalance()) + '</td></tr></tfoot></table></div>';
  };

  /* ================= تاریخچه‌ی تغییرات ================= */
  const ENT = { expense: 'هزینه', charge: 'شارژ', payment: 'پرداخت', income: 'درآمد', unit: 'واحد', category: 'دسته', settings: 'تنظیمات', occupants: 'نفرات' };
  const ACT = { create: 'ایجاد', update: 'ویرایش', void: 'حذف', restore: 'بازگردانی', delete: 'حذف قطعی' };
  const FIELD = { date: 'تاریخ', title: 'شرح', amount: 'مبلغ', total: 'جمع', categoryId: 'دسته', note: 'توضیحات', allocate: 'تقسیم', method: 'روش', unitId: 'واحد', kind: 'نحوه', ref: 'شماره پیگیری', name: 'نام', ownerName: 'مالک', residentName: 'ساکن', area: 'متراژ', coef: 'ضریب', persons: 'نفرات', opening: 'مانده اول دوره', active: 'فعال', month: 'ماه', void: 'حذف‌شده', voidReason: 'دلیل حذف', currency: 'واحد پول', buildingName: 'نام ساختمان' };
  const MONEY = ['amount', 'total', 'opening', 'fundOpening', 'chargeOverride'];
  function showVal(k, v) {
    if (v == null || v === '') return '∅';
    if (MONEY.includes(k) && typeof v === 'number') return M(v);
    if (k === 'unitId') return C.unitName(v);
    if (k === 'categoryId') return C.catName(v);
    if (k === 'method' && C.CHARGE_METHODS[v]) return C.CHARGE_METHODS[v];
    if (typeof v === 'boolean') return v ? 'بله' : 'خیر';
    if (typeof v === 'object') return '…';
    return String(v);
  }
  function diff(l) {
    if (l.entity === 'occupants') return esc(l.label) + ': ' + showVal('persons', l.before && l.before.persons) + ' ← ' + showVal('persons', l.after && l.after.persons) ;
    if (l.action !== 'update' || !l.before || !l.after) return '';
    const out = [];
    for (const k of Object.keys(l.after)) {
      if (['updatedAt', 'createdAt', 'n', 'id'].includes(k)) continue;
      if (JSON.stringify(l.before[k]) === JSON.stringify(l.after[k])) continue;
      if (k === 'shares' || k === 'items') { out.push('سهم/مبلغ واحدها دوباره محاسبه شد'); continue; }
      if (typeof l.after[k] === 'object' && l.after[k] !== null) { out.push((FIELD[k] || k) + ' تغییر کرد'); continue; }
      out.push('<b>' + esc(FIELD[k] || k) + '</b>: ' + esc(showVal(k, l.before[k])) + ' ← ' + esc(showVal(k, l.after[k])));
    }
    return out.join('<br>');
  }
  P.history = () => {
    const f = UI.f;
    const all = S.state.log.slice().reverse().filter((l) => !f.hEnt || l.entity === f.hEnt);
    const n = f.hN || 100;
    const rows = all.slice(0, n).map((l) => '<tr><td class="num" style="white-space:nowrap">' + U.fmtStamp(l.ts) + '</td><td><span class="tag' + (l.action === 'void' || l.action === 'delete' ? ' void' : '') + '">' + (ACT[l.action] || l.action) + '</span></td><td>' + (ENT[l.entity] || l.entity) + '</td>' +
      '<td>' + esc(l.label || '') + '</td><td>' + diff(l) + (l.reason ? '<div class="muted">دلیل: ' + esc(l.reason) + '</div>' : '') + '</td></tr>').join('');
    return '<div class="pagehead"><h2>تاریخچه‌ی تغییرات</h2></div><p class="muted">هر ثبت، ویرایش، حذف و بازگردانی اینجا نگه داشته می‌شود. «حذف» در این برنامه یعنی باطل‌کردن؛ ردیف‌ها هیچ‌وقت واقعاً پاک نمی‌شوند.</p>' +
      '<div class="filters"><div class="fld"><span>نوع</span>' + sel('', [['', 'همه']].concat(Object.entries(ENT)), f.hEnt, 'data-change="setF" data-k="hEnt"') + '</div></div>' +
      (all.length ? '<div class="tablewrap"><table><thead><tr><th>زمان</th><th>عملیات</th><th>نوع</th><th>مورد</th><th>جزئیات</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
        (all.length > n ? '<p style="margin-top:10px"><button class="btn" data-act="moreHist">نمایش بیشتر (' + U.toFa(all.length - n) + ' مورد دیگر)</button></p>' : '') : '<div class="empty">تاریخچه خالی است.</div>');
  };
  H.moreHist = () => { UI.f.hN = (UI.f.hN || 100) + 200; UI.render(); };
})();
