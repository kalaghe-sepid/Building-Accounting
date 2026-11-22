/* راه‌اندازی برنامه */
(async function () {
  'use strict';
  try {
    await S.load();
  } catch (e) {
    console.error(e);
    document.getElementById('view').innerHTML = '<div class="card"><b>ذخیره‌سازی مرورگر در دسترس نیست.</b><p class="muted">اگر در حالت ناشناس (Private) هستید، برنامه را در پنجره‌ی عادی باز کنید.</p></div>';
    return;
  }
  if (window.ARTIFACT_MODE) UI.cur = 'dashboard'; else if (!location.hash) UI.go('dashboard');
  UI.render();
  if (!window.ARTIFACT_MODE && 'serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
