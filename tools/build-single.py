#!/usr/bin/env python3
"""ساخت نسخه‌ی تک‌فایلی (یک index واحد که با دوبل‌کلیک هم باز می‌شود).
اجرا:  python3 tools/build-single.py   ->  building-accounting-single.html
"""
import base64, os, sys
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def rd(p, m='r'):
    if m == 'rb':
        return open(os.path.join(R, p), 'rb').read()
    return open(os.path.join(R, p), encoding='utf-8').read()
css = rd('css/style.css').replace("url('../fonts/Vazirmatn.woff2')", "url(data:font/woff2;base64," + base64.b64encode(rd('fonts/Vazirmatn.woff2', 'rb')).decode() + ")")
order = ['jalali', 'util', 'store', 'calc', 'ui', 'pages-main', 'pages-money', 'pages-reports', 'boot']
js = ''.join('\n/* ---- %s ---- */\n%s' % (n, rd('js/%s.js' % n)) for n in order)
icon = rd('icons/icon.svg')
body = '''<div id="app" dir="rtl" lang="fa">
  <aside class="side noprint">
    <div class="top"><span class="brandmark"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h.01M15 8h.01M9 12h.01M15 12h.01M10 21v-4h4v4"/></svg></span><div class="brand"><b id="brandName">ساختمان من</b><small>حسابداری ساختمان</small></div></div>
    <nav id="nav" class="nav" aria-label="بخش‌ها"></nav>
    <div id="status" class="status"></div>
  </aside>
  <main id="view" tabindex="-1"></main>
</div>
<div id="printArea"></div><dialog id="modal"></dialog><div id="toast" class="toast noprint" role="status"></div>'''
demo = '<script>window.ARTIFACT_MODE = true;</script>\n' if '--demo' in sys.argv else ''
html = ('<title>حسابداری ساختمان</title>\n<style>\n' + css + '\nhtml{direction:rtl}\n</style>\n' + body + '\n' + demo + '<script>\n' + js + '\n</script>\n')
if '--demo' not in sys.argv:
    html = '<!doctype html>\n<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:image/svg+xml;base64,' + base64.b64encode(icon.encode()).decode() + '">\n' + html.replace('<title>', '<title>', 1) + '</html>\n'
    out = os.path.join(R, 'building-accounting-single.html')
else:
    out = sys.argv[sys.argv.index('--demo') + 1] if len(sys.argv) > sys.argv.index('--demo') + 1 else os.path.join(R, 'demo.html')
open(out, 'w', encoding='utf-8').write(html)
print(out, len(html))
