/*!
 * Install helper for web apps.
 *
 * Add it to any web app with one line, just before </body>:
 *   <script src="/install-helper.js" data-name="Your App Name" defer></script>
 *
 * When someone arrives from your showcase site (the address ends in ?install=1), this shows the right
 * install steps for their device: a one-tap Install button on Android and computers, and a short
 * "Add to Home Screen" guide on iPhone. Without ?install=1 it stays out of the way, apart from a
 * gentle Install bar on browsers that offer one (it can be dismissed and stays away for 7 days).
 *
 * The app also needs to be installable: HTTPS, a web app manifest with icons, and a service worker.
 * You can change the colours from your own CSS with --lx-bg, --lx-fg and --lx-accent.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var appName = (script && script.getAttribute('data-name')) || document.title || 'this app';
  var params = new URLSearchParams(location.search);
  var forced = params.get('install') === '1';

  // Tidy the address so a refresh does not show the prompt again.
  if (forced) {
    params.delete('install');
    var q = params.toString();
    history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
  }

  var standalone = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  if (standalone) return; // already installed and running as an app

  var KEY = 'lx-install-snooze';
  function snoozed() { try { return Date.now() < Number(localStorage.getItem(KEY) || 0); } catch (e) { return false; } }
  function snooze() { try { localStorage.setItem(KEY, String(Date.now() + 7 * 86400000)); } catch (e) {} }

  var ua = navigator.userAgent;
  var isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var deferred = null;
  var shown = null;

  var style = document.createElement('style');
  style.textContent =
    '.lx{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:2147483000;max-width:460px;margin:0 auto;' +
    'background:var(--lx-bg,#1b1752);color:var(--lx-fg,#efeaff);border:1px solid rgba(180,170,255,.3);border-radius:18px;padding:14px 16px;' +
    'box-shadow:0 18px 50px rgba(0,0,0,.55);font:500 15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
    '.lx b{display:block;font-size:16px;margin-bottom:2px}.lx span.lx-sub{color:rgba(239,234,255,.75)}' +
    '.lx ol{margin:8px 0 10px;padding-left:20px}.lx li{margin:4px 0}.lx svg{width:1.2em;height:1.2em;vertical-align:-.2em}' +
    '.lx-row{display:flex;align-items:center;gap:10px}.lx-row>div{flex:1;min-width:0}' +
    '.lx button{font:inherit;font-weight:700;border:0;border-radius:999px;padding:9px 18px;cursor:pointer}' +
    '.lx .lx-go{background:var(--lx-accent,#f6c453);color:#2a1f05}.lx .lx-x{background:transparent;color:inherit;padding:8px 10px;opacity:.8}' +
    '.lx button:focus-visible{outline:2px solid var(--lx-accent,#f6c453);outline-offset:2px}';
  document.head.appendChild(style);

  var SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function show(html, onReady) {
    close();
    var box = document.createElement('div');
    box.className = 'lx';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Install ' + appName);
    box.innerHTML = html;
    document.body.appendChild(box);
    shown = box;
    var x = box.querySelector('.lx-x');
    if (x) x.addEventListener('click', function () { snooze(); close(); });
    if (onReady) onReady(box);
    var first = box.querySelector('.lx-go, .lx-x');
    if (first) first.focus();
  }

  function close() { if (shown) { shown.remove(); shown = null; } }

  // The name goes into the page as text: tags are dropped and anything special is escaped.
  function safeName() {
    return appName.replace(/<[^>]*>/g, '').replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function showBar() {
    show('<div class="lx-row"><div><b>Install ' + safeName() + '</b><span class="lx-sub">Add it to your home screen. It opens like a normal app.</span></div>' +
      '<button class="lx-go" type="button">Install</button><button class="lx-x" type="button" aria-label="Not now">&times;</button></div>',
      function (box) {
        box.querySelector('.lx-go').addEventListener('click', function () {
          if (!deferred) return;
          deferred.prompt();
          deferred.userChoice.then(function () { deferred = null; close(); });
        });
      });
  }

  function showSteps(kind) {
    var steps = kind === 'ios'
      ? '<li>Tap the Share button ' + SHARE + ' in Safari.</li><li>Scroll down and tap <b style="display:inline">Add to Home Screen</b>.</li><li>Tap <b style="display:inline">Add</b>.</li>'
      : '<li>Open your browser menu.</li><li>Choose <b style="display:inline">Install app</b> or <b style="display:inline">Add to Home screen</b>.</li><li>Confirm.</li>';
    show('<b>Install ' + safeName() + (kind === 'ios' ? ' on your iPhone' : '') + '</b><ol>' + steps + '</ol>' +
      '<div class="lx-row" style="justify-content:flex-end"><button class="lx-x" type="button">Got it</button></div>');
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferred = e;
    if (forced || !snoozed()) showBar();
  });
  window.addEventListener('appinstalled', close);

  if (isIOS) {
    if (forced) showSteps('ios');
  } else if (forced) {
    // If the browser has not offered a one-tap install after a moment, fall back to written steps.
    setTimeout(function () { if (!deferred && !shown) showSteps('generic'); }, 2500);
  }

  // Lets an app add its own "Install app" button: InstallHelper.show()
  window.InstallHelper = { show: function () { if (deferred) showBar(); else showSteps(isIOS ? 'ios' : 'generic'); } };
})();
