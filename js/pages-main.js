/* صفحه‌ها: شروع، داشبورد، واحدها، نفرات ماهانه، تنظیمات */
(function () {
  'use strict';
  const { esc } = U;
  const { fld, inp, sel, chk, M } = UI;
  const P = UI.pages, H = UI.h;
  const thisMonth = () => U.todayJ().slice(0, 7);

  /* ================= شروع (اولین اجرا) ================= */
  P.setup = () => lostHTML() + '<div class="card setup"><h2>خوش آمدید</h2>' +
    '<p class="muted">این برنامه حسابداری شارژ و هزینه‌های ساختمان است. همه‌ی اطلاعات فقط روی همین دستگاه ذخیره می‌شود و به هیچ سروری ارسال نمی‌شود.</p>' +
    '<form id="setupForm" data-submit="setupGo">' +
    fld('نام ساختمان', inp('name', '', 'placeholder="مثلاً: ساختمان گلستان" autocomplete="off"')) +
    '<div class="row2">' + fld('تعداد واحدها', inp('count', '۸', 'inputmode="numeric"'), 'بعداً هم می‌توانید تغییر دهید.') +
    fld('واحد پول', sel('currency', [['IRR', 'ریال'], ['IRT', 'تومان']], 'IRR')) + '</div>' +
    fld('تاریخ شروع حسابداری', UI.dateInp('start', U.todayJ().slice(0, 4) + '/01/01'), 'مانده‌های اول دوره به این تاریخ ثبت می‌شوند.') +
    '<div class="err" id="setupErr"></div>' +
    '<button class="btn primary" data-act="setupGo" type="button">شروع</button></form>' +
    '<hr style="border:0;border-top:1px solid var(--line);margin:18px 0"><p class="muted">قبلاً فایل پشتیبان گرفته‌اید؟</p>' +
    '<label class="btn">بازیابی از فایل پشتیبان<input type="file" accept=".json,application/json" data-change="restoreFile" hidden></label></div>';

  function lostHTML() {
    const l = S.lost;
    if (!l) return '';
    return '<div class="card setup" style="border-color:var(--debt)"><h2 class="db">اطلاعات قبلی پیدا نشد</h2>' +
      '<p>قبلاً روی این دستگاه اطلاعات ثبت شده بود' + (l.name ? ' (' + esc(l.name) + ')' : '') + ': ' + U.toFa(l.units || 0) + ' واحد و ' + U.toFa(l.records || 0) + ' تراکنش، آخرین تغییر ' + (l.updatedAt ? U.fmtStamp(l.updatedAt) : '') + '. ' +
      'احتمالاً مرورگر اطلاعات سایت را پاک کرده است. اگر پشتیبان دارید، همین حالا بازیابی کنید.</p>' +
      '<p class="muted">آخرین پشتیبانی که از این برنامه گرفته شده: ' + (l.lastBackupAt ? U.fmtStamp(l.lastBackupAt) : 'هرگز') + '</p>' +
      '<label class="btn primary">بازیابی از فایل پشتیبان<input type="file" accept=".json,application/json" data-change="restoreFile" hidden></label> ' +
      '<button class="btn" data-act="dismissLost">پشتیبان ندارم، از اول شروع می‌کنم</button></div>';
  }
  H.dismissLost = () => S.dismissLost();

  H.setupGo = async () => {
    const f = document.getElementById('setupForm');
    const v = Object.fromEntries(new FormData(f));
    const count = U.parseNum(v.count);
    const start = U.parseDate(v.start);
    const err = (m) => { document.getElementById('setupErr').textContent = m; };
    if (!count || count < 1 || count > 500 || count !== Math.floor(count)) return err('تعداد واحدها باید عددی بین ۱ تا ۵۰۰ باشد.');
    if (!start) return err('تاریخ شروع معتبر نیست (مثال: ۱۴۰۴/۰۱/۰۱).');
    await S.init({ buildingName: v.name.trim(), currency: v.currency, startDate: start }, count);
    UI.go('units');
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.closest && e.target.closest('#setupForm')) { e.preventDefault(); H.setupGo(); }
  });

  H.restoreFile = async (el) => {
    const file = el.files[0];
    el.value = '';
    if (!file) return;
    const r = S.parseBackup(await file.text());
    if (r.error) { UI.toast(r.error); return; }
    if (S.state && !(await UI.confirm('با بازیابی، اطلاعات فعلی با محتوای فایل جایگزین می‌شود. (یک نسخه‌ی بازگشت از وضعیت فعلی نگه داشته می‌شود.)\nادامه می‌دهید؟', 'بازیابی کن'))) return;
    await S.restore(r.data);
    UI.toast('بازیابی انجام شد.');
    UI.go('dashboard');
  };

  /* ================= داشبورد ================= */
  P.dashboard = () => {
    const s = S.state;
    const bal = C.balances();
    const units = C.sortedUnits();
    const debtors = units.filter((u) => bal[u.id] < 0).sort((a, b) => bal[a.id] - bal[b.id]);
    const totalDebt = U.sum(debtors, (u) => -bal[u.id]);
    const totalCredit = U.sum(units.filter((u) => bal[u.id] > 0), (u) => bal[u.id]);
    const cm = thisMonth();
    const cur = C.period(U.monthStart(cm), U.monthEnd(cm));
    const fund = C.fundBalance();

    /* ۶ ماه اخیر */
    const months = [];
    for (let i = 5; i >= 0; i--) months.push(U.addMonths(cm, -i));
    const data = months.map((m) => { const p = C.period(U.monthStart(m), U.monthEnd(m)); return { m, inn: p.payments + p.incomes, out: p.expenses }; });
    const max = Math.max(1, ...data.map((d) => Math.max(d.inn, d.out)));
    const bars = data.map((d) => '<div class="col" title="' + esc(U.fmtMonth(d.m)) + '"><div class="pair">' +
      '<div class="b in" style="height:' + (d.inn / max * 100).toFixed(1) + '%"></div>' +
      '<div class="b out" style="height:' + (d.out / max * 100).toFixed(1) + '%"></div></div>' +
      '<span class="lbl">' + U.MONTHS[+d.m.slice(5) - 1] + '</span></div>').join('');

    /* هزینه‌ی امسال به تفکیک دسته */
    const y = cm.slice(0, 4);
    const yr = C.period(y + '/01/01', y + '/12/30');
    const cats = Object.entries(yr.byCat).sort((a, b) => b[1] - a[1]);
    const cmax = cats.length ? cats[0][1] : 1;
    const catHtml = cats.length ? cats.map(([id, v]) => '<div class="hbar"><span>' + esc(C.catName(id)) + '</span><span class="track"><span class="fill" style="display:block;width:' + (v / cmax * 100).toFixed(1) + '%"></span></span><span class="num">' + M(v) + '</span></div>').join('')
      : '<div class="empty">هنوز هزینه‌ای در این سال ثبت نشده.</div>';

    const empty = !s.expenses.length && !s.payments.length && !s.charges.length;
    return '<div class="pagehead"><h2>داشبورد</h2><div class="tools">' +
      '<button class="btn primary" data-act="newE" data-e="payment">ثبت پرداخت</button>' +
      '<button class="btn" data-act="newE" data-e="expense">ثبت هزینه</button>' +
      '<button class="btn" data-act="newE" data-e="charge">ثبت شارژ ماه</button></div></div>' +
      (empty ? '<div class="callout info">برای شروع: ۱) مشخصات واحدها را در «واحدها» کامل کنید، ۲) در «تنظیمات» روش تقسیم هزینه و مبلغ شارژ را مشخص کنید، ۳) هزینه، شارژ و پرداخت‌ها را ثبت کنید.</div>' : '') +
      '<div class="grid c4" style="margin-bottom:16px">' +
      '<div class="stat hero"><div class="k">موجودی صندوق</div><div class="v num">' + M(fund) + ' <small>' + U.unitLabel() + '</small></div></div>' +
      '<div class="stat"><div class="k">مجموع بدهی واحدها (' + U.toFa(debtors.length) + ' واحد)</div><div class="v num db">' + M(totalDebt) + ' <small>' + U.unitLabel() + '</small></div></div>' +
      '<div class="stat"><div class="k">مجموع بستانکاری واحدها</div><div class="v num cr">' + M(totalCredit) + ' <small>' + U.unitLabel() + '</small></div></div>' +
      '<div class="stat"><div class="k">هزینه‌ی ' + U.fmtMonth(cm) + '</div><div class="v num">' + M(cur.expenses) + ' <small>' + U.unitLabel() + '</small></div>' +
      '<div class="k">دریافتی این ماه: ' + M(cur.payments + cur.incomes) + '</div></div></div>' +
      '<div class="grid c2"><div class="card"><h3>دریافتی و هزینه در ۶ ماه اخیر</h3><div class="bars">' + bars + '</div>' +
      '<div class="legend"><span><i style="background:var(--accent)"></i>دریافتی (پرداخت‌ها و درآمد)</span><span><i style="background:color-mix(in srgb, var(--debt) 70%, var(--card))"></i>هزینه</span></div></div>' +
      '<div class="card"><h3>هزینه‌ی سال ' + U.toFa(y) + ' به تفکیک دسته</h3>' + catHtml + '</div></div>' +
      '<div class="card"><div class="pagehead" style="margin:0 0 8px"><h3>بدهکاران اصلی</h3><a class="btn sm" href="#/reports/balances">همه</a></div>' +
      (debtors.length ? '<div class="tablewrap"><table><thead><tr><th>واحد</th><th>مالک / ساکن</th><th class="n">بدهی (' + U.unitLabel() + ')</th></tr></thead><tbody>' +
        debtors.slice(0, 5).map((u) => '<tr><td><a href="#/reports/ledger" data-act="openLedger" data-id="' + u.id + '">' + esc(u.name) + '</a></td><td>' + esc(u.ownerLives ? u.ownerName : (u.residentName || u.ownerName)) + '</td><td class="n db">' + M(-bal[u.id]) + '</td></tr>').join('') +
        '</tbody></table></div>' : '<div class="empty">بدهکاری وجود ندارد 🎉</div>') + '</div>';
  };
  H.openLedger = (el) => { UI.f.ledgerUnit = el.dataset.id; UI.go('reports/ledger'); };
  H.newE = (el) => UI.ed['new_' + el.dataset.e]();

  /* ================= واحدها ================= */
  const hasTx = (id) => S.state.payments.some((p) => p.unitId === id) ||
    S.state.charges.some((c) => c.items[id] != null) || S.state.expenses.some((e) => e.shares && e.shares[id] != null);

  P.units = () => {
    const bal = C.balances();
    const us = C.sortedUnits();
    const rows = us.map((u) => '<tr' + (u.active ? '' : ' class="voided"') + '><td>' + U.toFa(us.indexOf(u) + 1) + '</td><td><b>' + esc(u.name) + '</b></td>' +
      '<td>' + esc(u.ownerName) + (u.ownerPhone ? '<br><small class="muted ltr">' + esc(u.ownerPhone) + '</small>' : '') + '</td>' +
      '<td>' + (u.ownerLives ? '<span class="tag">مالک ساکن است</span>' : esc(u.residentName) + (u.residentPhone ? '<br><small class="muted ltr">' + esc(u.residentPhone) + '</small>' : '')) + '</td>' +
      '<td class="n">' + (u.area ? U.fmtNum(u.area, 2) : '–') + '</td><td class="n">' + U.fmtNum(u.coef, 2) + '</td><td class="n">' + U.fmtNum(u.persons) + '</td>' +
      '<td class="n">' + UI.bal(bal[u.id]) + '</td>' +
      '<td><div class="acts"><button class="btn sm" data-act="editUnit" data-id="' + u.id + '">ویرایش</button></div></td></tr>').join('');
    return '<div class="pagehead"><h2>واحدها (' + U.toFa(us.filter((u) => u.active).length) + ' فعال)</h2><div class="tools">' +
      '<button class="btn" data-act="unitCount">تغییر تعداد واحدها</button><button class="btn primary" data-act="addUnit">افزودن واحد</button></div></div>' +
      (us.length ? '<div class="tablewrap"><table><thead><tr><th>#</th><th>واحد</th><th>مالک</th><th>ساکن</th><th class="n">متراژ</th><th class="n">ضریب</th><th class="n">نفرات پیش‌فرض</th><th class="n">مانده</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="empty">واحدی تعریف نشده.</div>') +
      '<p class="muted" style="margin-top:10px">متراژ و ضریب فقط وقتی لازم است که هزینه یا شارژ را «به نسبت متراژ» یا «به نسبت ضریب» تقسیم کنید.</p>';
  };

  function unitForm(u) {
    const o = u.opening || 0;
    return fld('نام واحد', inp('name', u.name, 'required')) +
      '<div class="row2">' + fld('نام مالک', inp('ownerName', u.ownerName)) + fld('تلفن مالک', inp('ownerPhone', u.ownerPhone, 'dir="ltr" inputmode="tel"')) + '</div>' +
      chk('ownerLives', u.ownerLives, 'مالک خودش ساکن است', 'data-change="toggleResident"') +
      '<div id="residentBox" ' + (u.ownerLives ? 'hidden' : '') + '><div class="row2">' + fld('نام ساکن (مستأجر)', inp('residentName', u.residentName)) + fld('تلفن ساکن', inp('residentPhone', u.residentPhone, 'dir="ltr" inputmode="tel"')) + '</div></div>' +
      '<div class="row3">' + fld('متراژ (متر مربع)', inp('area', u.area || '', 'inputmode="decimal"')) + fld('ضریب', inp('coef', u.coef, 'inputmode="decimal"')) +
      fld('نفرات پیش‌فرض', inp('persons', u.persons, 'inputmode="numeric"'), 'تا وقتی برای یک ماه نفرات ثبت نکرده‌اید، این عدد حساب می‌شود.') + '</div>' +
      fld('شارژ ماهانه‌ی اختصاصی (' + U.unitLabel() + ') – اختیاری', UI.moneyInp('chargeOverride', u.chargeOverride), 'فقط وقتی شارژ «مبلغ ثابت برای هر واحد» باشد اثر دارد. خالی = مبلغ عمومی.') +
      '<div class="row2">' + fld('مانده‌ی اول دوره', sel('openType', [['debt', 'بدهکار'], ['credit', 'بستانکار']], o > 0 ? 'credit' : 'debt')) +
      fld('مبلغ (' + U.unitLabel() + ')', UI.moneyInp('openAmt', Math.abs(o))) + '</div>' +
      fld('یادداشت', inp('note', u.note)) +
      chk('active', u.active, 'واحد فعال است (در تقسیم هزینه‌ها و شارژ شرکت می‌کند)');
  }
  H.toggleResident = (el) => { document.getElementById('residentBox').hidden = el.checked; };

  function readUnit(d, id) {
    const name = (d.name || '').trim();
    if (!name) return { error: 'نام واحد را وارد کنید.' };
    if (S.state.units.some((x) => x.id !== id && x.name === name)) return { error: 'واحد دیگری با این نام وجود دارد.' };
    const area = d.area === '' ? 0 : U.parseNum(d.area);
    const coef = U.parseNum(d.coef);
    const persons = U.parseNum(d.persons);
    if (area == null || area < 0) return { error: 'متراژ معتبر نیست.' };
    if (coef == null || coef < 0) return { error: 'ضریب معتبر نیست.' };
    if (persons == null || persons < 0 || persons !== Math.floor(persons)) return { error: 'نفرات باید عدد صحیح (۰ یا بیشتر) باشد.' };
    let chargeOverride = null;
    if ((d.chargeOverride || '').trim() !== '') {
      chargeOverride = U.parseMoney(d.chargeOverride);
      if (chargeOverride == null || chargeOverride < 0) return { error: 'شارژ اختصاصی معتبر نیست.' };
    }
    let amt = (d.openAmt || '').trim() === '' ? 0 : U.parseMoney(d.openAmt);
    if (amt == null || amt < 0) return { error: 'مبلغ مانده‌ی اول دوره معتبر نیست.' };
    return {
      patch: {
        name, ownerName: d.ownerName.trim(), ownerPhone: d.ownerPhone.trim(), ownerLives: d.ownerLives,
        residentName: d.ownerLives ? '' : d.residentName.trim(), residentPhone: d.ownerLives ? '' : d.residentPhone.trim(),
        area, coef, persons, chargeOverride, opening: d.openType === 'credit' ? amt : -amt, note: d.note.trim(), active: d.active
      }
    };
  }

  H.addUnit = () => {
    const proto = S.newUnit('واحد ' + U.toFa(S.state.units.length + 1)); S.state.seq--;
    UI.modal({
      title: 'افزودن واحد', body: unitForm(proto),
      onSave: (d) => {
        const r = readUnit(d, null);
        if (r.error) return r.error;
        S.createUnit(r.patch.name, r.patch);
        UI.toast('واحد اضافه شد.');
      }
    });
  };
  H.editUnit = (el) => {
    const u = S.find('unit', el.dataset.id);
    UI.modal({
      title: 'ویرایش ' + u.name, body: unitForm(u) + UI.reasonField(true) +
        '<div style="margin-top:6px">' + (hasTx(u.id) ? '<small class="muted">برای این واحد تراکنش ثبت شده؛ به‌جای حذف، می‌توانید آن را غیرفعال کنید.</small>' : '<button type="button" class="btn danger sm" data-act="deleteUnit" data-id="' + u.id + '">حذف واحد</button>') + '</div>',
      onSave: (d) => {
        const r = readUnit(d, u.id);
        if (r.error) return r.error;
        S.update('unit', u.id, r.patch, (d.reason || '').trim(), r.patch.name);
        UI.toast('ذخیره شد.');
      }
    });
  };
  H.deleteUnit = async (el) => {
    const u = S.find('unit', el.dataset.id);
    UI.closeModal();
    if (await UI.confirm('واحد «' + u.name + '» حذف شود؟', 'حذف')) { S.deleteUnit(u.id); UI.toast('حذف شد.'); }
  };
  H.unitCount = () => {
    const n = S.state.units.length;
    UI.modal({
      title: 'تغییر تعداد واحدها',
      body: '<p class="muted">اکنون ' + U.toFa(n) + ' واحد تعریف شده است. اگر تعداد را بیشتر کنید، واحدهای جدید ساخته می‌شود. اگر کمتر کنید، فقط واحدهای آخرِ بدون تراکنش و بدون مانده حذف می‌شوند.</p>' +
        fld('تعداد کل واحدها', inp('count', n, 'inputmode="numeric"')),
      onSave: (d) => {
        const k = U.parseNum(d.count);
        if (!k || k < 1 || k > 500 || k !== Math.floor(k)) return 'تعداد معتبر نیست (۱ تا ۵۰۰).';
        if (k > n) { for (let i = n + 1; i <= k; i++) S.createUnit('واحد ' + U.toFa(i)); UI.toast(U.toFa(k - n) + ' واحد اضافه شد.'); return; }
        if (k < n) {
          const order = C.sortedUnits().reverse();
          const del = order.slice(0, n - k);
          const bad = del.filter((u) => hasTx(u.id) || u.opening);
          if (bad.length) return 'این واحدها تراکنش یا مانده دارند و حذف نمی‌شوند: ' + bad.map((u) => u.name).join('، ') + ' (غیرفعالشان کنید).';
          del.forEach((u) => S.deleteUnit(u.id));
          UI.toast(U.toFa(del.length) + ' واحد حذف شد.');
        }
      }
    });
  };

  /* ================= نفرات ماهانه ================= */
  P.persons = () => {
    const m = UI.f.pMonth || thisMonth();
    const us = C.activeUnits();
    let total = 0;
    const rows = us.map((u) => {
      const info = C.personsInfo(m, u);
      total += info.value;
      return '<tr><td>' + esc(u.name) + '</td><td>' + esc(u.ownerLives ? u.ownerName : u.residentName) + '</td>' +
        '<td><input data-change="setPersons" data-id="' + u.id + '" inputmode="numeric" value="' + (info.explicit ? U.toFa(info.value) : '') + '" placeholder="' + U.toFa(info.value) + '" style="max-width:100px"></td>' +
        '<td>' + (info.explicit ? '<span class="tag">ثبت‌شده برای این ماه</span>' : '<span class="muted">' + (info.from ? 'از ' + U.fmtMonth(info.from) : 'پیش‌فرض واحد') + '</span>') + '</td></tr>';
    }).join('');
    return '<div class="pagehead"><h2>نفرات هر واحد در هر ماه</h2><div class="tools">' +
      '<select data-change="pMonth" style="width:auto">' + UI.monthOptions(m).map(([v, t]) => '<option value="' + v + '"' + (v === m ? ' selected' : '') + '>' + t + '</option>').join('') + '</select></div></div>' +
      '<div class="callout info">فقط اگر نفرات یک واحد عوض شد، همان ماه را انتخاب و عدد جدید را وارد کنید؛ برای ماه‌های بعد هم ثابت می‌ماند تا دوباره تغییر دهید. برای برگشت به مقدار ماه قبل، خانه را خالی کنید.<br>' +
      'توجه: هزینه‌هایی که قبلاً ثبت شده‌اند با تغییر نفرات عوض نمی‌شوند؛ برای محاسبه‌ی دوباره، آن هزینه را باز و ذخیره کنید.</div>' +
      '<div class="tablewrap"><table><thead><tr><th>واحد</th><th>نام</th><th>نفرات در ' + U.fmtMonth(m) + '</th><th>وضعیت</th></tr></thead><tbody>' + rows +
      '</tbody><tfoot><tr><td colspan="2">جمع نفرات</td><td colspan="2" class="num">' + U.fmtNum(total) + '</td></tr></tfoot></table></div>';
  };
  H.pMonth = (el) => { UI.f.pMonth = el.value; UI.render(); };
  H.setPersons = (el) => {
    const m = UI.f.pMonth || thisMonth();
    const t = el.value.trim();
    const u = S.find('unit', el.dataset.id);
    if (t === '') { S.setPersons(m, u.id, null, u.name + ' – ' + U.fmtMonth(m)); return; }
    const n = U.parseNum(t);
    if (n == null || n < 0 || n !== Math.floor(n)) { UI.toast('تعداد نفرات باید عدد صحیح باشد.'); UI.render(); return; }
    S.setPersons(m, u.id, n, u.name + ' – ' + U.fmtMonth(m));
  };

  /* ================= تنظیمات ================= */
  P.settings = () => {
    const s = S.state.settings;
    const cats = S.state.categories.map((c) => {
      const used = S.state.expenses.some((e) => e.categoryId === c.id);
      return '<tr><td><input value="' + esc(c.name) + '" data-change="catName" data-id="' + c.id + '"></td>' +
        '<td>' + sel('m', Object.entries(C.METHODS), c.method, 'data-change="catMethod" data-id="' + c.id + '"') + '</td>' +
        '<td><label class="chk" style="margin:0"><input type="checkbox" data-change="catAlloc" data-id="' + c.id + '"' + (c.allocate ? ' checked' : '') + '> تقسیم بین واحدها</label></td>' +
        '<td>' + (used ? '<small class="muted">در حال استفاده</small>' : '<button class="btn sm danger" data-act="catDel" data-id="' + c.id + '">حذف</button>') + '</td></tr>';
    }).join('');
    const unitL = U.unitLabel();
    return '<div class="pagehead"><h2>تنظیمات</h2></div>' +

      '<div class="card"><h3>مشخصات ساختمان</h3><form data-form="general">' +
      '<div class="row2">' + fld('نام ساختمان', inp('buildingName', s.buildingName)) + fld('مدیر / مسئول', inp('manager', s.manager)) + '</div>' +
      fld('آدرس', inp('address', s.address)) +
      '<div class="row2">' + fld('تاریخ شروع حسابداری', UI.dateInp('startDate', s.startDate), 'مانده‌های اول دوره به این تاریخ ثبت می‌شوند.') +
      fld('موجودی اول دوره‌ی صندوق (' + unitL + ')', inp('fundOpening', U.inputMoney(s.fundOpening), 'inputmode="numeric"'), 'پولی که در ابتدای شروع حسابداری در صندوق بوده است.') + '</div>' +
      fld('متن پایین صورت‌حساب چاپی', '<textarea name="statementNote" rows="2">' + esc(s.statementNote) + '</textarea>', 'مثلاً شماره‌حساب برای واریز.') +
      fld('واحد پول', sel('currency', [['IRR', 'ریال'], ['IRT', 'تومان']], s.currency), 'فقط نحوه‌ی نمایش و ورود عوض می‌شود؛ داده‌ها همیشه با ریال ذخیره می‌شوند و با تغییر واحد خراب نمی‌شوند.') +
      '<button class="btn primary" type="button" data-act="saveGeneral">ذخیره</button></form></div>' +

      '<div class="card"><h3>شارژ ماهانه</h3><p class="muted">شارژ ماهانه برای هر واحد بدهی ایجاد می‌کند. هر ماه از بخش «شارژ ماهانه» ثبت می‌شود.</p><form data-form="charge">' +
      '<div class="row3">' + fld('عنوان', inp('chTitle', s.charge.title)) +
      fld('روش', sel('chMethod', Object.entries(C.CHARGE_METHODS), s.charge.method, 'data-change="chMethodHint"')) +
      fld('<span id="chAmtLbl">' + (s.charge.method === 'fixed' ? 'مبلغ شارژ هر واحد' : 'مبلغ کل شارژ ساختمان') + '</span> (' + unitL + ')', inp('chAmount', U.inputMoney(s.charge.amount), 'inputmode="numeric"')) + '</div>' +
      '<button class="btn primary" type="button" data-act="saveCharge">ذخیره</button></form></div>' +

      '<div class="card"><h3>روش محاسبه و تقسیم هزینه‌ها</h3><form data-form="calc">' +
      '<div class="row2">' + fld('گرد کردن سهم هر واحد', sel('rMode', [['exact', 'دقیق: جمع سهم‌ها دقیقاً برابر هزینه (پیشنهادی)'], ['up', 'گرد به بالا (مثل فایل اکسل قبلی؛ جمع سهم‌ها کمی بیشتر می‌شود)']], s.rounding.mode)) +
      fld('گرد کردن بر حسب (ریال)', sel('rStep', [[1, '۱ ریال'], [10, '۱۰ ریال'], [100, '۱۰۰ ریال'], [1000, '۱٬۰۰۰ ریال'], [10000, '۱۰٬۰۰۰ ریال']], s.rounding.step)) + '</div>' +
      chk('allocateDefault', s.allocateDefault, 'دسته‌های جدید به‌طور پیش‌فرض بین واحدها تقسیم شوند') +
      '<button class="btn primary" type="button" data-act="saveCalc">ذخیره</button></form>' +
      '<h3 style="margin-top:18px">دسته‌های هزینه و روش تقسیم هرکدام</h3>' +
      '<p class="muted">اگر «تقسیم بین واحدها» فعال باشد، هزینه‌ی این دسته به‌صورت بدهی بین واحدها پخش می‌شود (مثل فایل قبلی شما). اگر خاموش باشد، هزینه فقط از صندوق کم می‌شود؛ این حالت برای وقتی است که ماهانه شارژ ثابت می‌گیرید و هزینه‌ها از همان شارژ پرداخت می‌شود. دقت کنید هر هزینه را هم از طریق شارژ و هم از طریق تقسیم از واحدها نگیرید، وگرنه دو بار حساب می‌شود.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>نام دسته</th><th>روش تقسیم</th><th>تقسیم؟</th><th></th></tr></thead><tbody>' + cats + '</tbody></table></div>' +
      '<div class="filters" style="margin-top:10px"><div class="fld"><span>دسته‌ی جدید</span><input id="newCat" placeholder="نام دسته"></div><button class="btn" data-act="catAdd">افزودن دسته</button></div></div>' +

      '<div class="card" id="backupCard"><h3>پشتیبان‌گیری و بازیابی</h3>' + backupHTML() + '</div>' +

      '<div class="card"><h3>حذف همه‌ی اطلاعات</h3><p class="muted">همه‌ی اطلاعات این دستگاه پاک می‌شود. قبل از آن یک نسخه‌ی بازگشت داخلی نگه داشته می‌شود، ولی بهتر است حتماً فایل پشتیبان بگیرید.</p><button class="btn danger" data-act="wipe">حذف همه‌ی اطلاعات…</button></div>';
  };

  function backupHTML() {
    const s = S.state;
    const last = s.lastBackupAt ? U.fmtStamp(s.lastBackupAt) : 'هرگز';
    const persist = S.persisted === true ? '<span class="tag">ذخیره‌ی پایدار فعال است</span>' : S.persisted === false ? '<span class="tag warn">مرورگر ذخیره‌ی پایدار نداده؛ حتماً پشتیبان بگیرید</span>' : '';
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.navigator.standalone && !window.matchMedia('(display-mode: standalone)').matches;
    return (ios ? '<div class="callout">در iPhone و iPad، Safari اطلاعات سایت‌هایی را که چند روز باز نشده‌اند پاک می‌کند. برای جلوگیری، از منوی اشتراک‌گذاری «Add to Home Screen» را بزنید و برنامه را از روی صفحه‌ی اصلی باز کنید. در هر حال پشتیبان بگیرید.</div>' : '') +
      '<div class="callout info">اطلاعات شما فقط داخل مرورگر همین دستگاه نگه‌داری می‌شود. اگر داده‌های مرورگر پاک شود یا دستگاه عوض شود، فقط فایل پشتیبان نجاتتان می‌دهد. پیشنهاد: هفته‌ای یک بار پشتیبان بگیرید.</div>' +
      '<p>آخرین پشتیبان: <b>' + last + '</b> ' + persist + '</p>' +
      '<div class="tools" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"><button class="btn primary" data-act="backupNow">دریافت فایل پشتیبان</button>' +
      '<label class="btn">بازیابی از فایل پشتیبان…<input type="file" accept=".json,application/json" data-change="restoreFile" hidden></label></div>' +
      (S.fileSupported()
        ? '<h3 style="margin-top:14px">ذخیره‌ی خودکار در یک فایل</h3><p class="muted">یک فایل روی کامپیوتر انتخاب کنید (مثلاً داخل پوشه‌ی Dropbox یا Google Drive)؛ بعد از هر تغییر، برنامه آن را به‌روز می‌کند.</p>' +
          (S.fileHandle ? '<p>فایل فعال: <b class="ltr">' + esc(S.fileHandle.name) + '</b> ' + (S.fileNeedsPermission ? '<span class="tag void">نیاز به اجازه</span> <button class="btn sm" data-act="regrant">فعال‌سازی</button>' : '<span class="tag">فعال</span>') + ' <button class="btn sm danger" data-act="unlinkFile">قطع اتصال</button></p>'
            : '<button class="btn" data-act="pickFile">انتخاب فایل برای ذخیره‌ی خودکار</button>')
        : '<p class="muted">ذخیره‌ی خودکار در فایل فقط در Chrome و Edge رایانه کار می‌کند. در این مرورگر از «دریافت فایل پشتیبان» استفاده کنید.</p>') +
      '<div class="fld" style="margin-top:14px;max-width:320px"><span>یادآوری پشتیبان بعد از چند روز (۰ = بدون یادآوری)</span><input id="remindDays" inputmode="numeric" value="' + U.toFa(s.settings.backupRemindDays) + '" data-change="remindDays"></div>' +
      '<h3 style="margin-top:14px">نسخه‌های بازگشت داخلی</h3><div id="snapList" class="muted">در حال بارگذاری…</div>';
  }
  /* بعد از رندر، لیست نسخه‌ها را بارگذاری می‌کنیم */
  const origSettings = P.settings;
  P.settings = () => {
    setTimeout(async () => {
      const box = document.getElementById('snapList');
      if (!box) return;
      const list = await S.listSnapshots();
      box.innerHTML = list.length ? '<div class="tablewrap"><table><tbody>' + list.map((x) => '<tr><td>' + (String(x.key).startsWith('auto-') ? 'خودکار' : 'قبل از بازیابی') + '</td><td>' + U.fmtStamp(x.ts) + '</td><td class="n">' + U.toFa(x.units) + ' واحد، ' + U.toFa(x.tx) + ' تراکنش</td><td><button class="btn sm" data-act="snapRestore" data-key="' + esc(x.key) + '">بازگردانی</button></td></tr>').join('') + '</tbody></table></div>' : 'نسخه‌ای نیست.';
    }, 0);
    return origSettings();
  };

  const val = (name) => { const e = document.querySelector('#view [name="' + name + '"]'); return e ? e.value : ''; };
  H.saveGeneral = () => {
    const start = U.parseDate(val('startDate'));
    if (!start) return UI.toast('تاریخ شروع معتبر نیست.');
    const fo = val('fundOpening').trim() === '' ? 0 : U.parseMoney(val('fundOpening'));
    if (fo == null) return UI.toast('موجودی اول دوره معتبر نیست.');
    S.updateSettings({
      buildingName: val('buildingName').trim(), manager: val('manager').trim(), address: val('address').trim(),
      startDate: start, fundOpening: fo, statementNote: val('statementNote').trim(), currency: val('currency')
    }, 'مشخصات ساختمان');
    UI.toast('ذخیره شد.');
  };
  H.chMethodHint = (el) => { document.getElementById('chAmtLbl').textContent = el.value === 'fixed' ? 'مبلغ شارژ هر واحد' : 'مبلغ کل شارژ ساختمان'; };
  H.saveCharge = () => {
    const amt = val('chAmount').trim() === '' ? 0 : U.parseMoney(val('chAmount'));
    if (amt == null || amt < 0) return UI.toast('مبلغ شارژ معتبر نیست.');
    S.updateSettings({ charge: { title: val('chTitle').trim() || 'شارژ ماهانه', method: val('chMethod'), amount: amt } }, 'شارژ ماهانه');
    UI.toast('ذخیره شد.');
  };
  H.saveCalc = () => {
    const chk = document.querySelector('#view [name="allocateDefault"]').checked;
    S.updateSettings({ rounding: { mode: val('rMode'), step: Number(val('rStep')) }, allocateDefault: chk }, 'روش محاسبه');
    UI.toast('ذخیره شد.');
  };
  H.catName = (el) => {
    const n = el.value.trim();
    if (!n) { UI.render(); return; }
    S.updateCategory(el.dataset.id, { name: n });
  };
  H.catMethod = (el) => S.updateCategory(el.dataset.id, { method: el.value });
  H.catAlloc = (el) => S.updateCategory(el.dataset.id, { allocate: el.checked });
  H.catDel = async (el) => { if (await UI.confirm('این دسته حذف شود؟', 'حذف')) S.deleteCategory(el.dataset.id); };
  H.catAdd = () => {
    const n = document.getElementById('newCat').value.trim();
    if (!n) return UI.toast('نام دسته را بنویسید.');
    if (S.state.categories.some((c) => c.name === n)) return UI.toast('این دسته از قبل هست.');
    S.createCategory(n, 'equal', S.state.settings.allocateDefault);
  };
  H.backupNow = () => {
    if (window.ARTIFACT_MODE) {
      UI.modal({
        title: 'پشتیبان (متن)', focus: false,
        body: '<p class="muted">دانلود فایل در این نمایش آزمایشی کار نمی‌کند. متن را کپی کنید و در یک فایل با پسوند .json ذخیره کنید.</p><textarea id="bkText" class="ltr" rows="8" readonly style="direction:ltr;text-align:left"></textarea><p><button type="button" class="btn" data-act="copyBackup">کپی متن</button></p>'
      });
      document.getElementById('bkText').value = S.exportJSON();
      S.markBackedUp();
      return;
    }
    S.downloadBackup(); UI.toast('فایل پشتیبان دانلود شد. آن را جای امنی نگه دارید.'); };
  H.copyBackup = async () => { const t = document.getElementById('bkText'); t.select(); try { await navigator.clipboard.writeText(t.value); UI.toast('کپی شد.'); } catch (e) { UI.toast('متن انتخاب شد؛ با Ctrl+C کپی کنید.'); } };
  H.pickFile = async () => { try { await S.pickFile(); UI.toast('ذخیره‌ی خودکار فعال شد.'); } catch (e) { if (e.name !== 'AbortError') UI.toast('انتخاب فایل ممکن نشد.'); } };
  H.unlinkFile = () => S.unlinkFile();
  H.remindDays = (el) => {
    const n = U.parseNum(el.value);
    if (n == null || n < 0) return UI.toast('عدد معتبر وارد کنید.');
    S.updateSettings({ backupRemindDays: Math.floor(n) }, 'یادآوری پشتیبان');
  };
  H.snapRestore = async (el) => {
    if (!(await UI.confirm('این نسخه جایگزین اطلاعات فعلی می‌شود. (از وضعیت فعلی هم یک نسخه نگه داشته می‌شود.)', 'بازگردانی'))) return;
    await S.restoreSnapshot(el.dataset.key);
    UI.toast('بازگردانی شد.');
  };
  H.wipe = async () => {
    if (!(await UI.confirm('همه‌ی اطلاعات پاک می‌شود. مطمئن هستید؟', 'ادامه'))) return;
    if (!(await UI.confirm('آخرین تأیید: واقعاً همه‌چیز حذف شود؟', 'بله، حذف کن'))) return;
    await S.wipe();
    UI.go('');
  };
})();
