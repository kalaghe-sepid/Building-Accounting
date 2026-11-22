/* هسته‌ی رابط: مسیریابی، پنجره‌ها، فرم‌ها و ابزارهای مشترک */
(function () {
  'use strict';
  const { esc } = U;
  const UI = { pages: {}, h: {}, ed: {}, f: {} };
  window.UI = UI;

  UI.ROUTES = [
    ['dashboard', 'داشبورد'], ['units', 'واحدها'], ['persons', 'نفرات ماهانه'], ['expenses', 'هزینه‌ها'],
    ['charges', 'شارژ ماهانه'], ['payments', 'پرداخت‌ها'], ['incomes', 'درآمد متفرقه'],
    ['reports', 'گزارش‌ها'], ['history', 'تاریخچه'], ['settings', 'تنظیمات']
  ];

  const IC = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    units: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-4h4v4"/>',
    persons: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16.5 5.2a3 3 0 0 1 0 5.6M18 14.4c1.8.8 3 2.6 3 5.6"/>',
    expenses: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
    charges: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    payments: '<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 20h14"/>',
    incomes: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    reports: '<path d="M5 20v-7M12 20V5M19 20V10"/>',
    history: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>'
  };
  const icon = (k) => '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">' + (IC[k] || '') + '</svg>';
  const $ = (s, r) => (r || document).querySelector(s);
  UI.$ = $;

  /* ---------- قالب‌بندی مشترک ---------- */
  UI.M = (r) => U.fmtMoney(r);
  UI.bal = (n) => {
    if (!n) return '<span class="muted">تسویه</span>';
    return n > 0 ? '<span class="cr">' + UI.M(n) + ' بستانکار</span>' : '<span class="db">' + UI.M(-n) + ' بدهکار</span>';
  };
  UI.fld = (label, inner, hint) => '<label class="fld"><span>' + label + '</span>' + inner + (hint ? '<small>' + hint + '</small>' : '') + '</label>';
  UI.inp = (name, val, attrs) => '<input name="' + name + '" value="' + esc(val == null ? '' : val) + '" ' + (attrs || '') + '>';
  UI.sel = (name, opts, val, attrs) => '<select name="' + name + '" ' + (attrs || '') + '>' +
    opts.map(([v, t]) => '<option value="' + esc(v) + '"' + (String(v) === String(val) ? ' selected' : '') + '>' + esc(t) + '</option>').join('') + '</select>';
  UI.dateInp = (name, val) => '<div class="dateRow"><input name="' + name + '" value="' + esc(U.fmtDate(val)) +
    '" inputmode="numeric" dir="ltr" autocomplete="off" placeholder="' + U.fmtDate(U.todayJ()) + '"><button type="button" class="btn sm" data-act="today">امروز</button></div>';
  UI.moneyInp = (name, rial, attrs) => UI.inp(name, rial ? U.inputMoney(rial) : '', 'inputmode="numeric" autocomplete="off" ' + (attrs || ''));
  UI.chk = (name, checked, text, attrs) => '<label class="chk"><input type="checkbox" name="' + name + '"' + (checked ? ' checked' : '') + ' ' + (attrs || '') + '> ' + text + '</label>';

  /* لیست ماه‌ها برای انتخاب */
  UI.monthOptions = (selected) => {
    const s = S.state.settings;
    const today = U.todayJ().slice(0, 7);
    let lo = U.monthKey(s.startDate);
    if (selected && selected < lo) lo = selected;
    let hi = U.addMonths(today, 3);
    if (selected && selected > hi) hi = selected;
    const out = [];
    for (let m = lo, i = 0; m <= hi && i < 180; m = U.addMonths(m, 1), i++) out.push([m, U.fmtMonth(m)]);
    return out;
  };
  UI.yearOptions = (selected) => {
    const sy = +S.state.settings.startDate.slice(0, 4);
    const cy = +U.todayJ().slice(0, 4);
    const out = [];
    for (let y = Math.min(sy, selected || sy); y <= Math.max(cy + 1, selected || 0); y++) out.push([y, U.toFa(y)]);
    return out;
  };
  UI.unitOptions = (withAll, includeInactive) => {
    const us = includeInactive ? C.sortedUnits() : C.sortedUnits().filter((u) => u.active);
    const o = us.map((u) => [u.id, u.name + (u.active ? '' : ' (غیرفعال)')]);
    return withAll ? [['', 'همه‌ی واحدها']].concat(o) : o;
  };

  /* ---------- پیام کوتاه ---------- */
  let toastT;
  UI.toast = (msg) => {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  };

  /* ---------- پنجره‌ی گفتگو ---------- */
  let modalCfg = null;
  UI.modal = (cfg) => {
    modalCfg = cfg;
    const m = $('#modal');
    m.innerHTML = '<div class="mhead"><h3>' + esc(cfg.title) + '</h3><button type="button" class="btn sm" data-act="mclose" aria-label="بستن">✕</button></div>' +
      '<form id="mform" class="mbody" novalidate' + (cfg.live ? ' data-live="' + cfg.live + '"' : '') + '>' + cfg.body +
      '<div class="err" id="merr" role="alert"></div><button type="submit" hidden></button></form>' +
      '<div class="mfoot">' + (cfg.onSave ? '<button type="button" class="btn primary" data-act="msave">' + esc(cfg.save || 'ذخیره') + '</button>' : '') +
      '<button type="button" class="btn" data-act="mclose">' + (cfg.onSave ? 'انصراف' : 'بستن') + '</button></div>';
    if (!m.open) m.showModal();
    if (cfg.live) UI.h[cfg.live]($('#mform'));
    const first = $('#mform input:not([type=hidden]), #mform select');
    if (first && cfg.focus !== false) first.focus();
  };
  UI.closeModal = () => { const m = $('#modal'); if (m.open) m.close(); modalCfg = null; };
  UI.formData = () => {
    const f = $('#mform');
    const o = {};
    new FormData(f).forEach((v, k) => { o[k] = v; });
    f.querySelectorAll('input[type=checkbox]').forEach((c) => { o[c.name] = c.checked; });
    return o;
  };
  UI.modalErr = (msg) => { const e = $('#merr'); if (e) e.textContent = msg || ''; };
  async function runSave() {
    if (!modalCfg || !modalCfg.onSave) return;
    const err = await modalCfg.onSave(UI.formData());
    if (err) UI.modalErr(err); else UI.closeModal();
  }
  UI.confirm = (msg, ok) => new Promise((res) => {
    UI.modal({
      title: 'تأیید', focus: false,
      body: '<p style="white-space:pre-line">' + esc(msg) + '</p>',
      save: ok || 'بله، انجام شود',
      onSave: () => { res(true); }
    });
    const m = $('#modal');
    m.addEventListener('close', () => res(false), { once: true });
  });
  UI.askReason = (title, required, okLabel) => new Promise((res) => {
    let done = false;
    UI.modal({
      title,
      body: UI.fld('دلیل' + (required ? '' : ' (اختیاری)'), '<textarea name="reason" rows="2"></textarea>'),
      save: okLabel || 'تأیید',
      onSave: (d) => {
        const r = (d.reason || '').trim();
        if (required && !r) return 'نوشتن دلیل الزامی است.';
        done = true; res(r);
      }
    });
    $('#modal').addEventListener('close', () => { if (!done) res(null); }, { once: true });
  });

  /* ---------- رویدادها ---------- */
  document.addEventListener('click', (e) => {
    if (window.ARTIFACT_MODE) {
      const a = e.target.closest('a[href^="#/"]');
      if (a && !a.dataset.act) { e.preventDefault(); UI.go(a.getAttribute('href').slice(2)); return; }
    }
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    if (act === 'mclose') { UI.closeModal(); return; }
    if (act === 'msave') { runSave(); return; }
    if (act === 'today') {
      const i = el.parentElement.querySelector('input');
      i.value = U.fmtDate(U.todayJ());
      i.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (UI.h[act]) { e.preventDefault(); UI.h[act](el, e); }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id === 'mform') { e.preventDefault(); runSave(); }
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-change]');
    if (el && UI.h[el.dataset.change]) UI.h[el.dataset.change](el, e);
    const f = e.target.closest('form[data-live]');
    if (f) UI.h[f.dataset.live](f);
  });
  document.addEventListener('input', (e) => {
    const f = e.target.closest('form[data-live]');
    if (f) UI.h[f.dataset.live](f);
  });
  /* قالب‌بندی مبلغ هنگام ترک فیلد */
  document.addEventListener('focusout', (e) => {
    const el = e.target;
    if (el.matches && el.matches('input[inputmode=numeric]:not([dir=ltr])')) {
      const n = U.parseNum(el.value);
      if (n != null) el.value = U.fmtNum(n, 1);
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalCfg) UI.closeModal();
  });
  $('#modal').addEventListener('cancel', () => { modalCfg = null; });

  /* ---------- حذف / بازگردانی / ویرایش همگانی ---------- */
  const LABEL = { expense: 'هزینه', charge: 'شارژ', payment: 'پرداخت', income: 'درآمد' };
  UI.recLabel = (entity, r) => {
    if (entity === 'payment') return 'پرداخت ' + C.unitName(r.unitId);
    return r.title || LABEL[entity];
  };
  UI.h.edit = (el) => UI.ed[el.dataset.e](el.dataset.id);
  UI.h.void = async (el) => {
    const { e, id } = el.dataset;
    const r = S.find(e, id);
    const reason = await UI.askReason('حذف ' + LABEL[e] + ': ' + UI.recLabel(e, r), true, 'حذف کن');
    if (reason == null) return;
    S.setVoid(e, id, true, reason, UI.recLabel(e, r));
    UI.toast('حذف شد؛ در تاریخچه ثبت شد و می‌توانید بازگردانی کنید.');
  };
  UI.h.restore = (el) => {
    const { e, id } = el.dataset;
    S.setVoid(e, id, false, '', UI.recLabel(e, S.find(e, id)));
    UI.toast('بازگردانی شد.');
  };
  UI.rowActs = (entity, r) => r.void
    ? '<span class="tag void" title="' + esc(r.voidReason || '') + '">حذف‌شده</span> <button class="btn sm" data-act="restore" data-e="' + entity + '" data-id="' + r.id + '">بازگردانی</button>'
    : '<button class="btn sm" data-act="edit" data-e="' + entity + '" data-id="' + r.id + '">ویرایش</button> <button class="btn sm danger" data-act="void" data-e="' + entity + '" data-id="' + r.id + '">حذف</button>';
  UI.reasonField = (isEdit) => (isEdit ? UI.fld('دلیل ویرایش (اختیاری)', UI.inp('reason', '', 'maxlength="200"')) : '');

  /* ---------- چاپ ---------- */
  const NOPRINT = 'چاپ در این نمایش آزمایشی کار نمی‌کند؛ در نسخه‌ی اصلی (GitHub) کار می‌کند.';
  UI.printHTML = (html) => {
    if (window.ARTIFACT_MODE) { UI.toast(NOPRINT); return; }
    $('#printArea').innerHTML = html;
    document.body.classList.add('printing');
    const clean = () => { document.body.classList.remove('printing'); $('#printArea').innerHTML = ''; };
    window.addEventListener('afterprint', clean, { once: true });
    setTimeout(() => window.print(), 50);
  };
  UI.h.print = () => { if (window.ARTIFACT_MODE) UI.toast(NOPRINT); else window.print(); };

  /* ---------- نوار بالا و مسیریابی ---------- */
  function route() {
    const raw = window.ARTIFACT_MODE ? (UI.cur || '') : location.hash.replace(/^#\/?/, '');
    const parts = raw.split('/');
    const name = UI.ROUTES.some((r) => r[0] === parts[0]) ? parts[0] : 'dashboard';
    return { name, sub: parts[1] || '' };
  }
  UI.go = (path) => {
    if (window.ARTIFACT_MODE) { UI.cur = path; UI.closeModal(); UI.render(); return; }
    location.hash = '#/' + path;
  };

  UI.renderStatus = () => {
    const el = $('#status');
    const inst = UI.installEvt ? '<button class="chip" data-act="install" style="cursor:pointer">نصب برنامه</button>' : '';
    const demo = (window.ARTIFACT_MODE ? '<span class="chip warn" style="cursor:default" title="چاپ و دانلود فایل در این نمایش کار نمی‌کند">نسخه‌ی آزمایشی</span>' : '') + inst;
    if (!S.state) { el.innerHTML = demo; return; }
    const s = S.state;
    const chips = [];
    if (S.fileHandle) {
      chips.push(S.fileNeedsPermission
        ? '<button class="chip bad" data-act="regrant">ذخیره‌ی خودکار در فایل متوقف است – فعال‌سازی</button>'
        : '<span class="chip">ذخیره‌ی خودکار در فایل ✓</span>');
    }
    const last = s.lastBackupAt ? Math.floor((Date.now() - new Date(s.lastBackupAt).getTime()) / 864e5) : null;
    const remind = s.settings.backupRemindDays || 0;
    const hasData = s.expenses.length + s.payments.length + s.charges.length > 0;
    if (!S.fileHandle || S.fileNeedsPermission) {
      if (last == null && hasData) chips.push('<a class="chip warn" href="#/settings" style="text-decoration:none">هنوز پشتیبان نگرفته‌اید</a>');
      else if (last != null && remind && last >= remind) chips.push('<a class="chip warn" href="#/settings" style="text-decoration:none">آخرین پشتیبان: ' + U.toFa(last) + ' روز پیش</a>');
    }
    el.innerHTML = demo + chips.join('');
  };
  UI.h.regrant = () => S.regrantFile().catch(() => UI.toast('اجازه داده نشد.'));
  S.onFile = () => UI.renderStatus();

  /* هشدار پشتیبان: وقتی تغییرات زیادی بدون پشتیبان مانده */
  UI.bannerHTML = () => {
    const s = S.state;
    if (S.fileHandle && !S.fileNeedsPermission) return '';
    const n = s.changesSinceBackup || 0;
    if (!n) return '';
    const days = s.lastBackupAt ? Math.floor((Date.now() - new Date(s.lastBackupAt).getTime()) / 864e5) : null;
    const remind = s.settings.backupRemindDays || 0;
    const due = n >= 20 || (days == null && n >= 5) || (remind && days != null && days >= remind);
    if (!due) return '';
    return '<div class="callout noprint"><b>پشتیبان بگیرید.</b> ' + U.toFa(n) + ' تغییر بعد از آخرین پشتیبان' + (days == null ? ' (هنوز پشتیبان نگرفته‌اید)' : ' (' + U.toFa(days) + ' روز پیش)') +
      ' ثبت شده و اطلاعات فقط روی همین دستگاه است. ' +
      '<button class="btn sm primary" data-act="backupNow">دریافت فایل پشتیبان</button>' +
      (S.fileSupported() ? ' <a class="btn sm" href="#/settings">ذخیره‌ی خودکار در فایل</a>' : '') + '</div>';
  };
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); UI.installEvt = e; UI.renderStatus(); });
  window.addEventListener('appinstalled', () => { UI.installEvt = null; UI.renderStatus(); });
  UI.h.install = async () => { const e = UI.installEvt; if (!e) return; e.prompt(); try { await e.userChoice; } catch (x) {} UI.installEvt = null; UI.renderStatus(); };

  UI.render = () => {
    const y = window.scrollY;
    const view = $('#view');
    $('#brandName').textContent = (S.state && S.state.settings.buildingName) || 'ساختمان من';
    if (!S.state) {
      $('#nav').innerHTML = '';
      view.innerHTML = UI.pages.setup();
      UI.renderStatus();
      return;
    }
    const r = route();
    $('#nav').innerHTML = UI.ROUTES.map(([k, t]) => '<a href="#/' + k + '"' + (k === r.name ? ' aria-current="page"' : '') + '>' + icon(k) + '<span>' + t + '</span></a>').join('');
    try {
      view.innerHTML = UI.bannerHTML() + UI.pages[r.name](r.sub);
    } catch (err) {
      console.error(err);
      view.innerHTML = '<div class="card"><b>خطا در نمایش این صفحه.</b><p class="muted">' + esc(err.message) + '</p></div>';
    }
    UI.renderStatus();
    if (UI.lastRoute === r.name + '/' + r.sub) window.scrollTo(0, y);
    else { window.scrollTo(0, 0); view.classList.remove('enter'); void view.offsetWidth; view.classList.add('enter'); }
    UI.lastRoute = r.name + '/' + r.sub;
  };
  window.addEventListener('hashchange', () => { UI.closeModal(); UI.render(); });
  S.onChange(() => UI.render());
})();
