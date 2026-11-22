/* ابزارهای عمومی: ارقام فارسی، قالب‌بندی پول، تاریخ شمسی */
(function () {
  'use strict';
  const FA = '۰۱۲۳۴۵۶۷۸۹';
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const U = { MONTHS, currency: 'IRR' };

  /* ---------- ارقام ---------- */
  U.toLatin = (s) => String(s == null ? '' : s)
    .replace(/[۰-۹]/g, (d) => FA.indexOf(d))
    .replace(/[٠-٩]/g, (d) => AR.indexOf(d));
  U.toFa = (s) => String(s == null ? '' : s).replace(/[0-9]/g, (d) => FA[d]);

  /* عدد از متن ورودی (ارقام فارسی/عربی/لاتین، جداکننده‌ها) */
  U.parseNum = (s) => {
    let t = U.toLatin(s).replace(/[٬,،\s‌‏‎]/g, '').replace(/٫/g, '.');
    if (t === '') return null;
    if (!/^-?\d*\.?\d+$/.test(t)) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };

  U.fmtNum = (n, maxFrac = 0) => {
    if (n == null || Number.isNaN(n)) return '';
    const neg = n < 0;
    const s = new Intl.NumberFormat('fa-IR', { maximumFractionDigits: maxFrac, useGrouping: true }).format(Math.abs(n));
    return neg ? '−' + s : s;
  };

  /* ---------- پول (همیشه به ریال ذخیره می‌شود) ---------- */
  U.setCurrency = (c) => { U.currency = c === 'IRT' ? 'IRT' : 'IRR'; };
  U.unitLabel = () => (U.currency === 'IRT' ? 'تومان' : 'ریال');
  U.toDisplay = (rial) => (U.currency === 'IRT' ? rial / 10 : rial);
  U.fmtMoney = (rial) => (rial == null ? '' : U.fmtNum(U.toDisplay(rial), 1));
  U.fmtMoneyU = (rial) => U.fmtMoney(rial) + ' ' + U.unitLabel();
  /* ورودی کاربر (به واحد انتخابی) → ریال صحیح */
  U.parseMoney = (s) => {
    const n = U.parseNum(s);
    if (n == null) return null;
    return Math.round(U.currency === 'IRT' ? n * 10 : n);
  };
  U.inputMoney = (rial) => (rial == null || rial === '' ? '' : U.fmtMoney(rial));

  /* ---------- تاریخ شمسی (رشته‌ی YYYY/MM/DD با ارقام لاتین) ---------- */
  const p2 = (n) => String(n).padStart(2, '0');
  U.todayJ = () => {
    const d = new Date();
    const j = Jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return j.jy + '/' + p2(j.jm) + '/' + p2(j.jd);
  };
  U.isoToJ = (iso) => {
    const d = new Date(iso);
    const j = Jalaali.toJalaali(d.getFullYear(), d.getMonth() + 1, d.getDate());
    return j.jy + '/' + p2(j.jm) + '/' + p2(j.jd);
  };
  /* متن ورودی → 'YYYY/MM/DD' معتبر یا null */
  U.parseDate = (s) => {
    const t = U.toLatin(s).trim().replace(/[-.\s]+/g, '/');
    const m = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(t);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 1300 || y > 1600) return null;
    if (!Jalaali.isValidJalaaliDate(y, mo, d)) return null;
    return y + '/' + p2(mo) + '/' + p2(d);
  };
  U.fmtDate = (d) => (d ? U.toFa(d) : '');
  U.monthKey = (d) => d.slice(0, 7);
  U.fmtMonth = (mk) => {
    const [y, m] = mk.split('/').map(Number);
    return MONTHS[m - 1] + ' ' + U.toFa(y);
  };
  U.addMonths = (mk, k) => {
    let [y, m] = mk.split('/').map(Number);
    m += k;
    while (m > 12) { m -= 12; y++; }
    while (m < 1) { m += 12; y--; }
    return y + '/' + p2(m);
  };
  U.monthStart = (mk) => mk + '/01';
  U.monthEnd = (mk) => {
    const [y, m] = mk.split('/').map(Number);
    return mk + '/' + p2(Jalaali.jalaaliMonthLength(y, m));
  };
  U.fmtStamp = (iso) => {
    const d = new Date(iso);
    return U.toFa(U.isoToJ(iso)) + ' – ' + U.toFa(p2(d.getHours()) + ':' + p2(d.getMinutes()));
  };

  /* ---------- متفرقه ---------- */
  U.esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  U.uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  U.clone = (o) => JSON.parse(JSON.stringify(o));
  U.sum = (arr, f) => arr.reduce((a, x) => a + (f ? f(x) : x), 0);

  window.U = U;
})();
