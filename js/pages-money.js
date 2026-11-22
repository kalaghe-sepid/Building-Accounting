/* صفحه‌ها: هزینه‌ها، شارژ ماهانه، پرداخت‌ها، درآمدهای متفرقه */
(function () {
  'use strict';
  const { esc } = U;
  const { fld, inp, sel, chk, M } = UI;
  const P = UI.pages, H = UI.h, ED = UI.ed;
  const thisMonth = () => U.todayJ().slice(0, 7);
  const byDateDesc = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.n - a.n);

  H.setF = (el) => { UI.f[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value; UI.render(); };
  const monthFilter = (k) => '<div class="fld"><span>ماه</span><select data-change="setF" data-k="' + k + '"><option value="">همه</option>' +
    UI.monthOptions(UI.f[k]).map(([v, t]) => '<option value="' + v + '"' + (UI.f[k] === v ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div>';
  const voidFilter = () => '<label class="chk" style="margin:0 0 6px"><input type="checkbox" data-change="setF" data-k="showVoid"' + (UI.f.showVoid ? ' checked' : '') + '> نمایش حذف‌شده‌ها</label>';
  const inMonth = (d, m) => !m || d.slice(0, 7) === m;

  function needUnits() {
    if (!C.activeUnits().length) { UI.toast('ابتدا در بخش «واحدها» حداقل یک واحد فعال تعریف کنید.'); return true; }
    return false;
  }
  const dateErr = 'تاریخ معتبر نیست (مثال: ۱۴۰۴/۰۵/۱۲).';

  /* ================= هزینه‌ها ================= */
  P.expenses = () => {
    const f = UI.f;
    let list = S.state.expenses.filter((e) => (f.showVoid || !e.void) && inMonth(e.date, f.eMonth) && (!f.eCat || e.categoryId === f.eCat)).sort(byDateDesc);
    const total = U.sum(list.filter((e) => !e.void), (e) => e.amount);
    const rows = list.map((e) => '<tr' + (e.void ? ' class="voided"' : '') + '><td>' + U.fmtDate(e.date) + '</td><td>' + esc(e.title) + (e.note ? '<br><small class="muted">' + esc(e.note) + '</small>' : '') + '</td>' +
      '<td>' + esc(C.catName(e.categoryId)) + '</td><td class="n">' + M(e.amount) + '</td>' +
      '<td>' + (e.allocate ? '<button class="btn sm" data-act="shares" data-e="expense" data-id="' + e.id + '">' + C.METHODS[e.method] + '</button>' : '<span class="muted">از صندوق (بدون تقسیم)</span>') + '</td>' +
      '<td><div class="acts">' + UI.rowActs('expense', e) + '</div></td></tr>').join('');
    return '<div class="pagehead"><h2>هزینه‌های ساختمان</h2><div class="tools"><button class="btn primary" data-act="newE" data-e="expense">ثبت هزینه</button></div></div>' +
      '<div class="filters">' + monthFilter('eMonth') + '<div class="fld"><span>دسته</span>' + sel('', [['', 'همه']].concat(S.state.categories.map((c) => [c.id, c.name])), f.eCat, 'data-change="setF" data-k="eCat"') + '</div>' + voidFilter() + '</div>' +
      (list.length ? '<div class="tablewrap"><table><thead><tr><th>تاریخ</th><th>شرح</th><th>دسته</th><th class="n">مبلغ (' + U.unitLabel() + ')</th><th>تقسیم</th><th></th></tr></thead><tbody>' + rows +
        '</tbody><tfoot><tr><td colspan="3">جمع</td><td class="n">' + M(total) + '</td><td colspan="2"></td></tr></tfoot></table></div>' : '<div class="empty">هزینه‌ای یافت نشد.</div>');
  };

  function expenseForm(e, isEdit) {
    const cats = S.state.categories.map((c) => [c.id, c.name]);
    return '<div class="row2">' + fld('تاریخ', UI.dateInp('date', e.date)) + fld('مبلغ کل (' + U.unitLabel() + ')', UI.moneyInp('amount', e.amount)) + '</div>' +
      fld('شرح هزینه', inp('title', e.title, 'maxlength="120"')) +
      '<div class="row2">' + fld('دسته', sel('categoryId', cats, e.categoryId, 'data-change="expCat"')) + fld('یا دسته‌ی جدید', inp('newCat', '', 'placeholder="اختیاری"')) + '</div>' +
      chk('allocate', e.allocate, 'بین واحدها تقسیم شود (برای هر واحد بدهی ثبت شود)') +
      '<div id="methodBox" ' + (e.allocate ? '' : 'hidden') + '>' + fld('روش تقسیم', sel('method', Object.entries(C.METHODS), e.method)) + '</div>' +
      fld('توضیحات', inp('note', e.note)) + UI.reasonField(isEdit) + '<div id="expPrev"></div>';
  }
  H.expCat = (el) => {
    const c = S.state.categories.find((x) => x.id === el.value);
    const f = el.form;
    if (!c) return;
    f.elements.allocate.checked = c.allocate;
    f.elements.method.value = c.method;
  };
  H.expLive = (f) => {
    const box = document.getElementById('expPrev');
    if (!box) return;
    document.getElementById('methodBox').hidden = !f.elements.allocate.checked;
    if (!f.elements.allocate.checked) { box.innerHTML = '<p class="muted">این هزینه فقط از صندوق کم می‌شود.</p>'; return; }
    const amt = U.parseMoney(f.elements.amount.value);
    const date = U.parseDate(f.elements.date.value);
    if (!amt || amt <= 0 || !date) { box.innerHTML = '<p class="muted">با وارد کردن تاریخ و مبلغ، سهم هر واحد اینجا نمایش داده می‌شود.</p>'; return; }
    const r = C.allocate(amt, f.elements.method.value, U.monthKey(date));
    box.innerHTML = r.error ? '<div class="callout">' + esc(r.error) + '</div>' : sharesTable(r.shares, f.elements.method.value, U.monthKey(date));
  };
  function sharesTable(shares, method, month) {
    const rows = C.sortedUnits().filter((u) => shares[u.id] != null).map((u) => {
      let w = '';
      if (method === 'persons') w = U.fmtNum(C.persons(month, u)) + ' نفر';
      else if (method === 'area') w = U.fmtNum(u.area, 2) + ' متر';
      else if (method === 'coef') w = 'ضریب ' + U.fmtNum(u.coef, 2);
      return '<tr><td>' + esc(u.name) + '</td><td class="muted">' + w + '</td><td class="n">' + M(shares[u.id]) + '</td></tr>';
    }).join('');
    const tot = U.sum(Object.values(shares));
    return '<div class="tablewrap" style="max-height:260px;overflow:auto"><table><thead><tr><th>واحد</th><th></th><th class="n">سهم (' + U.unitLabel() + ')</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="2">جمع</td><td class="n">' + M(tot) + '</td></tr></tfoot></table></div>';
  }
  H.shares = (el) => {
    const r = S.find(el.dataset.e, el.dataset.id);
    const items = r.shares || r.items;
    UI.modal({ title: 'سهم واحدها – ' + r.title, body: sharesTable(items, r.method, U.monthKey(r.date)) });
  };

  function saveExpense(d, id) {
    const date = U.parseDate(d.date);
    const amount = U.parseMoney(d.amount);
    const title = (d.title || '').trim();
    if (!date) return dateErr;
    if (!title) return 'شرح هزینه را بنویسید.';
    if (!amount || amount <= 0) return 'مبلغ باید بیشتر از صفر باشد.';
    let shares = {};
    if (d.allocate) {
      const r = C.allocate(amount, d.method, U.monthKey(date));
      if (r.error) return r.error;
      shares = r.shares;
    }
    let catId = d.categoryId;
    const nc = (d.newCat || '').trim();
    if (nc) {
      const ex = S.state.categories.find((c) => c.name === nc);
      catId = ex ? ex.id : S.createCategory(nc, d.method, d.allocate).id;
    }
    if (!catId) return 'یک دسته انتخاب کنید.';
    const rec = { date, title, amount, categoryId: catId, note: (d.note || '').trim(), allocate: d.allocate, method: d.method, shares };
    if (id) S.update('expense', id, rec, (d.reason || '').trim(), title); else S.create('expense', rec, title);
    UI.toast('ثبت شد.');
  }
  ED.new_expense = () => {
    if (needUnits()) return;
    const c = S.state.categories[0];
    UI.modal({
      title: 'ثبت هزینه', live: 'expLive', save: 'ثبت',
      body: expenseForm({ date: U.todayJ(), title: '', amount: 0, categoryId: c.id, note: '', allocate: c.allocate, method: c.method }, false),
      onSave: (d) => saveExpense(d, null)
    });
  };
  ED.expense = (id) => {
    const e = S.find('expense', id);
    UI.modal({
      title: 'ویرایش هزینه', live: 'expLive',
      body: expenseForm(e, true) + '<p class="muted" style="margin-top:8px">با ذخیره، سهم واحدها با نفرات/متراژ/ضریب فعلی دوباره محاسبه می‌شود.</p>',
      onSave: (d) => saveExpense(d, id)
    });
  };

  /* ================= شارژ ماهانه ================= */
  P.charges = () => {
    const s = S.state.settings.charge;
    const list = S.state.charges.filter((c) => UI.f.showVoid || !c.void).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.n - a.n));
    const rows = list.map((c) => '<tr' + (c.void ? ' class="voided"' : '') + '><td>' + U.fmtMonth(c.month) + '</td><td>' + esc(c.title) + '</td><td>' + U.fmtDate(c.date) + '</td>' +
      '<td class="n">' + M(U.sum(Object.values(c.items))) + '</td><td class="n">' + U.toFa(Object.keys(c.items).length) + '</td>' +
      '<td><button class="btn sm" data-act="shares" data-e="charge" data-id="' + c.id + '">مبلغ هر واحد</button></td>' +
      '<td><div class="acts">' + UI.rowActs('charge', c) + '</div></td></tr>').join('');
    return '<div class="pagehead"><h2>شارژ ماهانه</h2><div class="tools"><button class="btn primary" data-act="newE" data-e="charge">ثبت شارژ ماه</button></div></div>' +
      '<div class="callout info">تنظیم فعلی: <b>' + C.CHARGE_METHODS[s.method] + '</b> – ' + (s.method === 'fixed' ? 'هر واحد ' : 'کل ساختمان ') + '<b>' + M(s.amount) + ' ' + U.unitLabel() + '</b>. ' +
      '<a href="#/settings">تغییر در تنظیمات</a></div>' +
      '<div class="filters">' + voidFilter() + '</div>' +
      (list.length ? '<div class="tablewrap"><table><thead><tr><th>ماه</th><th>عنوان</th><th>تاریخ ثبت</th><th class="n">جمع (' + U.unitLabel() + ')</th><th class="n">تعداد واحد</th><th></th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">هنوز شارژی ثبت نشده.</div>');
  };

  function chargeTable(items, month) {
    const ids = new Set(Object.keys(items));
    const us = C.sortedUnits().filter((u) => u.active || ids.has(u.id));
    const rows = us.map((u) => '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.ownerLives ? u.ownerName : u.residentName) + '</td><td><input name="a_' + u.id + '" inputmode="numeric" value="' + (items[u.id] ? U.inputMoney(items[u.id]) : '') + '"></td></tr>').join('');
    return '<div class="tablewrap" style="max-height:340px;overflow:auto"><table><thead><tr><th>واحد</th><th>نام</th><th>مبلغ شارژ (' + U.unitLabel() + ')</th></tr></thead><tbody>' + rows + '</tbody><tfoot><tr><td colspan="2">جمع</td><td id="chTotal" class="n"></td></tr></tfoot></table></div>';
  }
  function chargeForm(c, isEdit) {
    return '<div class="row2">' + fld('ماه شارژ', sel('month', UI.monthOptions(c.month), c.month, 'data-change="chMonth"')) + fld('تاریخ ثبت بدهی', UI.dateInp('date', c.date)) + '</div>' +
      fld('عنوان', inp('title', c.title)) +
      '<div id="chDup"></div><div id="chTable">' + chargeTable(c.items, c.month) + '</div>' +
      '<div style="margin:8px 0"><button type="button" class="btn sm" data-act="chRecalc">محاسبه‌ی دوباره از تنظیمات شارژ</button></div>' + UI.reasonField(isEdit);
  }
  let editingCharge = null;
  H.chLive = (f) => {
    let t = 0;
    f.querySelectorAll('input[name^="a_"]').forEach((i) => { const v = U.parseMoney(i.value); if (v > 0) t += v; });
    const el = document.getElementById('chTotal');
    if (el) el.textContent = M(t);
    const m = f.elements.month.value;
    const dup = S.state.charges.some((c) => !c.void && c.month === m && c.id !== editingCharge);
    document.getElementById('chDup').innerHTML = dup ? '<div class="callout">برای ' + U.fmtMonth(m) + ' قبلاً شارژ ثبت شده است؛ ثبت دوباره باعث دو بار بدهکار شدن واحدها می‌شود.</div>' : '';
  };
  function fillCharge(f) {
    const m = f.elements.month.value;
    const r = C.chargeItems(m);
    document.getElementById('chTable').innerHTML = chargeTable(r.items, m);
    if (r.error) UI.modalErr(r.error); else UI.modalErr('');
    H.chLive(f);
  }
  H.chMonth = (el) => {
    const f = el.form, m = el.value;
    f.elements.date.value = U.fmtDate(U.monthStart(m));
    f.elements.title.value = S.state.settings.charge.title + ' ' + U.fmtMonth(m);
    fillCharge(f);
  };
  H.chRecalc = () => fillCharge(document.getElementById('mform'));

  function saveCharge(d, id) {
    const date = U.parseDate(d.date);
    if (!date) return dateErr;
    const title = (d.title || '').trim();
    if (!title) return 'عنوان را بنویسید.';
    const items = {};
    for (const k in d) {
      if (!k.startsWith('a_') || String(d[k]).trim() === '') continue;
      const v = U.parseMoney(d[k]);
      if (v == null || v < 0) return 'مبلغ یکی از واحدها معتبر نیست.';
      if (v > 0) items[k.slice(2)] = v;
    }
    if (!Object.keys(items).length) return 'مبلغ شارژ هیچ واحدی وارد نشده. (مبلغ را در «تنظیمات» مشخص کنید.)';
    const rec = { month: d.month, date, title, items, method: S.state.settings.charge.method, total: U.sum(Object.values(items)) };
    if (id) S.update('charge', id, rec, (d.reason || '').trim(), title); else S.create('charge', rec, title);
    UI.toast('شارژ ثبت شد.');
  }
  ED.new_charge = () => {
    if (needUnits()) return;
    const m = thisMonth();
    const r = C.chargeItems(m);
    editingCharge = null;
    UI.modal({
      title: 'ثبت شارژ ماهانه', live: 'chLive', save: 'ثبت شارژ',
      body: chargeForm({ month: m, date: U.monthStart(m), title: S.state.settings.charge.title + ' ' + U.fmtMonth(m), items: r.items }, false),
      onSave: (d) => saveCharge(d, null)
    });
    if (r.error) UI.modalErr(r.error);
    else if (!S.state.settings.charge.amount && !C.activeUnits().some((u) => u.chargeOverride)) UI.modalErr('مبلغ شارژ هنوز در «تنظیمات» وارد نشده؛ می‌توانید مبلغ‌ها را همین‌جا دستی بنویسید.');
  };
  ED.charge = (id) => {
    const c = S.find('charge', id);
    editingCharge = id;
    UI.modal({ title: 'ویرایش شارژ', live: 'chLive', body: chargeForm(c, true), onSave: (d) => saveCharge(d, id) });
  };

  /* ================= پرداخت‌ها ================= */
  P.payments = () => {
    const f = UI.f;
    const list = S.state.payments.filter((p) => (f.showVoid || !p.void) && inMonth(p.date, f.pMonthF) && (!f.pUnit || p.unitId === f.pUnit)).sort(byDateDesc);
    const total = U.sum(list.filter((p) => !p.void), (p) => p.amount);
    const rows = list.map((p) => '<tr' + (p.void ? ' class="voided"' : '') + '><td>' + U.fmtDate(p.date) + '</td><td>' + esc(C.unitName(p.unitId)) + '</td><td class="n">' + M(p.amount) + '</td>' +
      '<td>' + esc(C.PAY_KINDS[p.kind] || '') + '</td><td class="ltr">' + esc(p.ref || '') + '</td><td>' + esc(p.note || '') + '</td>' +
      '<td><div class="acts">' + UI.rowActs('payment', p) + '</div></td></tr>').join('');
    return '<div class="pagehead"><h2>پرداخت‌های واحدها</h2><div class="tools"><button class="btn primary" data-act="newE" data-e="payment">ثبت پرداخت</button></div></div>' +
      '<div class="filters">' + monthFilter('pMonthF') + '<div class="fld"><span>واحد</span>' + sel('', UI.unitOptions(true, true), f.pUnit, 'data-change="setF" data-k="pUnit"') + '</div>' + voidFilter() + '</div>' +
      (list.length ? '<div class="tablewrap"><table><thead><tr><th>تاریخ واریز</th><th>واحد</th><th class="n">مبلغ (' + U.unitLabel() + ')</th><th>نحوه</th><th>شماره پیگیری</th><th>توضیحات</th><th></th></tr></thead><tbody>' + rows +
        '</tbody><tfoot><tr><td colspan="2">جمع</td><td class="n">' + M(total) + '</td><td colspan="4"></td></tr></tfoot></table></div>' : '<div class="empty">پرداختی یافت نشد.</div>');
  };
  function paymentForm(p, isEdit) {
    return fld('واحد', sel('unitId', UI.unitOptions(false, false).concat(isEdit && !C.activeUnits().some((u) => u.id === p.unitId) ? [[p.unitId, C.unitName(p.unitId)]] : []), p.unitId)) +
      '<div id="payHint" class="muted" style="margin:-6px 0 10px"></div>' +
      '<div class="row2">' + fld('تاریخ واریز', UI.dateInp('date', p.date)) + fld('مبلغ (' + U.unitLabel() + ')', UI.moneyInp('amount', p.amount)) + '</div>' +
      '<div class="row2">' + fld('نحوه‌ی پرداخت', sel('kind', Object.entries(C.PAY_KINDS), p.kind)) + fld('شماره پیگیری / چک', inp('ref', p.ref, 'dir="ltr"')) + '</div>' +
      fld('توضیحات', inp('note', p.note)) + UI.reasonField(isEdit);
  }
  H.payLive = (f) => {
    const box = document.getElementById('payHint');
    if (!box) return;
    const b = C.balances()[f.elements.unitId.value];
    box.innerHTML = b == null ? '' : 'مانده‌ی فعلی این واحد: ' + UI.bal(b);
  };
  function savePayment(d, id) {
    const date = U.parseDate(d.date), amount = U.parseMoney(d.amount);
    if (!d.unitId) return 'واحد را انتخاب کنید.';
    if (!date) return dateErr;
    if (!amount || amount <= 0) return 'مبلغ باید بیشتر از صفر باشد.';
    const rec = { unitId: d.unitId, date, amount, kind: d.kind, ref: (d.ref || '').trim(), note: (d.note || '').trim() };
    const label = 'پرداخت ' + C.unitName(d.unitId);
    if (id) S.update('payment', id, rec, (d.reason || '').trim(), label); else S.create('payment', rec, label);
    UI.toast('پرداخت ثبت شد.');
  }
  ED.new_payment = () => {
    if (needUnits()) return;
    UI.modal({
      title: 'ثبت پرداخت', live: 'payLive', save: 'ثبت',
      body: paymentForm({ unitId: UI.f.pUnit || C.activeUnits()[0].id, date: U.todayJ(), amount: 0, kind: 'transfer', ref: '', note: '' }, false),
      onSave: (d) => savePayment(d, null)
    });
  };
  ED.payment = (id) => {
    UI.modal({ title: 'ویرایش پرداخت', live: 'payLive', body: paymentForm(S.find('payment', id), true), onSave: (d) => savePayment(d, id) });
  };

  /* ================= درآمدهای متفرقه ================= */
  P.incomes = () => {
    const f = UI.f;
    const list = S.state.incomes.filter((i) => (f.showVoid || !i.void) && inMonth(i.date, f.iMonth)).sort(byDateDesc);
    const total = U.sum(list.filter((i) => !i.void), (i) => i.amount);
    const rows = list.map((i) => '<tr' + (i.void ? ' class="voided"' : '') + '><td>' + U.fmtDate(i.date) + '</td><td>' + esc(i.title) + '</td><td class="n">' + M(i.amount) + '</td><td>' + esc(i.note || '') + '</td>' +
      '<td><div class="acts">' + UI.rowActs('income', i) + '</div></td></tr>').join('');
    return '<div class="pagehead"><h2>درآمدهای متفرقه</h2><div class="tools"><button class="btn primary" data-act="newE" data-e="income">ثبت درآمد</button></div></div>' +
      '<p class="muted">مثل اجاره‌ی فضای مشاع، جریمه‌ی دیرکرد یا فروش ضایعات. این مبالغ مستقیم به صندوق اضافه می‌شود و روی مانده‌ی واحدها اثر ندارد.</p>' +
      '<div class="filters">' + monthFilter('iMonth') + voidFilter() + '</div>' +
      (list.length ? '<div class="tablewrap"><table><thead><tr><th>تاریخ</th><th>شرح</th><th class="n">مبلغ (' + U.unitLabel() + ')</th><th>توضیحات</th><th></th></tr></thead><tbody>' + rows +
        '</tbody><tfoot><tr><td colspan="2">جمع</td><td class="n">' + M(total) + '</td><td colspan="2"></td></tr></tfoot></table></div>' : '<div class="empty">درآمدی ثبت نشده.</div>');
  };
  function incomeForm(i, isEdit) {
    return '<div class="row2">' + fld('تاریخ', UI.dateInp('date', i.date)) + fld('مبلغ (' + U.unitLabel() + ')', UI.moneyInp('amount', i.amount)) + '</div>' +
      fld('شرح', inp('title', i.title, 'maxlength="120"')) + fld('توضیحات', inp('note', i.note)) + UI.reasonField(isEdit);
  }
  function saveIncome(d, id) {
    const date = U.parseDate(d.date), amount = U.parseMoney(d.amount), title = (d.title || '').trim();
    if (!date) return dateErr;
    if (!title) return 'شرح را بنویسید.';
    if (!amount || amount <= 0) return 'مبلغ باید بیشتر از صفر باشد.';
    const rec = { date, title, amount, note: (d.note || '').trim() };
    if (id) S.update('income', id, rec, (d.reason || '').trim(), title); else S.create('income', rec, title);
    UI.toast('ثبت شد.');
  }
  ED.new_income = () => UI.modal({ title: 'ثبت درآمد متفرقه', save: 'ثبت', body: incomeForm({ date: U.todayJ(), title: '', amount: 0, note: '' }, false), onSave: (d) => saveIncome(d, null) });
  ED.income = (id) => UI.modal({ title: 'ویرایش درآمد', body: incomeForm(S.find('income', id), true), onSave: (d) => saveIncome(d, id) });
})();
