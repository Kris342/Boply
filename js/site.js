(() => {
  'use strict';

  const C = window.SHOWCASE_CONFIG || {};
  const U = window.Showcase;
  const esc = U.esc;
  const main = document.getElementById('main');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const SITE_NAME = C.SITE_NAME || 'My Apps';
  document.getElementById('siteName').textContent = SITE_NAME;
  document.getElementById('foot').innerHTML =
    `<div class="row row--between"><span>${esc(SITE_NAME)}</span>${C.CONTACT_EMAIL ? `<a href="mailto:${esc(C.CONTACT_EMAIL)}">${esc(C.CONTACT_EMAIL)}</a>` : ''}</div>`;

  let sb = null;
  if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--error' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  // Each app without an icon gets its own colour, picked from its name.
  const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);
  const icon = (app, size) =>
    `<span class="icon" style="--s:${size}px;--h:${hue(app.slug)}" aria-hidden="true">${
      U.safeHttps(app.icon_url) ? `<img src="${esc(U.safeHttps(app.icon_url))}" alt="" loading="lazy">` : esc(app.name.trim().charAt(0).toUpperCase())
    }</span>`;

  /* ---------- install steps for each kind of device ---------- */

  const SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L8 7m4-4l4 4M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const GUIDES = {
    ios: {
      label: 'iPhone and iPad',
      steps: [
        'Tap <b>Install app</b> above. The app opens in a new tab.',
        `In Safari, tap the Share button ${SHARE} at the bottom of the screen.`,
        'Scroll down and tap <b>Add to Home Screen</b>.',
        'Tap <b>Add</b>. The app now sits on your home screen like any other.',
      ],
      note: 'Use Safari. On iOS 16.4 or later, Chrome and Edge also have Add to Home Screen in their Share menu.',
    },
    android: {
      label: 'Android',
      steps: [
        'Tap <b>Install app</b> above. The app opens in a new tab.',
        'Tap the <b>Install</b> button that appears at the bottom of the app. If you do not see it, open the browser menu (three dots) and choose <b>Install app</b> or <b>Add to Home screen</b>.',
        'Confirm. The app is added to your home screen.',
      ],
      note: 'Works in Chrome, Edge, Samsung Internet and Firefox.',
    },
    desktop: {
      label: 'Computer',
      steps: [
        'Click <b>Install app</b> above. The app opens in a new tab.',
        'In Chrome or Edge, click the install icon at the right end of the address bar, or open the menu and choose <b>Install</b>.',
        'Confirm. The app gets its own window and appears with your other apps.',
      ],
      note: 'Firefox on a computer cannot install web apps.',
    },
  };

  /* ---------- the shelf ---------- */

  function setup(msg) {
    main.innerHTML = `<div class="empty"><p><b>This site is not connected yet.</b></p><p>${esc(msg)}</p></div>`;
  }

  async function viewHome() {
    document.title = SITE_NAME;
    if (!sb) return setup('Open js/config.js and fill in your Supabase address and public key.');
    main.innerHTML = '<p class="empty">Loading apps...</p>';
    const { data, error } = await sb.from('showcase_apps').select('*').eq('published', true).order('sort', { ascending: true }).order('created_at', { ascending: false });
    if (error) {
      main.innerHTML = '<div class="empty"><p>Could not load the apps right now.</p><button class="btn" id="retry">Try again</button></div>';
      $('#retry').addEventListener('click', viewHome);
      return;
    }
    main.innerHTML = `<section class="hero"><h1>${esc(SITE_NAME)}</h1>${C.SITE_TAGLINE ? `<p>${esc(C.SITE_TAGLINE)}</p>` : ''}</section>
      ${data.length
        ? `<nav class="shelf" aria-label="Apps">${data.map((a, i) => `<a class="app" href="#/app/${esc(a.slug)}" style="--i:${i}">${icon(a, 88)}<span class="app__name">${esc(a.name)}</span>${a.tagline ? `<span class="app__tag">${esc(a.tagline)}</span>` : ''}</a>`).join('')}</nav>`
        : '<p class="empty">No apps here yet. Check back soon.</p>'}
      <h2>How installing works</h2>
      <ol class="how">
        <li><b>Pick an app</b><span>Open its page to see what it does and what is new.</span></li>
        <li><b>Tap Install</b><span>The app opens in your browser, ready to install.</span></li>
        <li><b>Open it from your home screen</b><span>No app store, and it updates itself.</span></li>
      </ol>`;
  }

  /* ---------- one app ---------- */

  async function viewApp(slug) {
    if (!sb) return setup('Open js/config.js and fill in your Supabase address and public key.');
    main.innerHTML = '<p class="empty">Loading...</p>';
    const res = await sb.from('showcase_apps').select('*').eq('slug', slug).eq('published', true).maybeSingle();
    if (res.error || !res.data) {
      document.title = SITE_NAME;
      main.innerHTML = '<a class="back" href="#/">Back to all apps</a><div class="empty"><p>We could not find that app.</p></div>';
      return;
    }
    const app = res.data;
    const ups = await sb.from('showcase_updates').select('*').eq('app_id', app.id).order('released_at', { ascending: false }).order('created_at', { ascending: false }).limit(12);
    const updates = ups.data || [];
    const latest = updates[0] || null;
    const install = U.installUrl(app.app_url);
    const open = U.safeHttps(app.app_url);
    const device = U.detectDevice(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
    document.title = `${app.name} - ${SITE_NAME}`;

    const contact = app.contact
      ? (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(app.contact) ? `<a href="mailto:${esc(app.contact)}">${esc(app.contact)}</a>` : esc(app.contact))
      : '';
    const facts = [
      ['Cost', esc(app.pricing || 'Free')],
      ['Account', app.needs_account ? 'You need a free account to use it' : 'No account needed'],
      ['Works on', 'Android, iPhone and computers. No app store needed.'],
      contact ? ['Contact', contact] : null,
      app.privacy_note ? ['Privacy', esc(app.privacy_note)] : null,
    ].filter(Boolean);

    main.innerHTML = `<a class="back" href="#/">Back to all apps</a>
      <section class="apphead">${icon(app, 116)}
        <div class="apphead__text">
          <h1>${esc(app.name)}</h1>
          ${app.tagline ? `<p class="tag">${esc(app.tagline)}</p>` : ''}
          <div class="chips">${app.version ? `<span class="chip chip--gold">Version ${esc(app.version)}</span>` : ''}${app.released_at ? `<span class="chip">Updated ${esc(U.fmtDate(app.released_at))}</span>` : ''}<span class="chip">${esc(app.pricing || 'Free')}</span></div>
          <div class="actions">
            <a class="btn btn--gold" id="installBtn" ${install ? `href="${esc(install)}" target="_blank" rel="noopener noreferrer"` : 'aria-disabled="true"'}>Install app</a>
            ${open ? `<a class="btn" href="${esc(open)}" target="_blank" rel="noopener noreferrer">Open app</a>` : ''}
            <button class="btn btn--ghost btn--sm" id="shareBtn" type="button">Share</button>
          </div>
          <p class="actions__hint">It opens the app, then you tap Install. Steps for your device are below.</p>
        </div>
      </section>

      ${latest ? `<section class="whatsnew" aria-label="What is new">
        <h2>What's new</h2>
        <div><span class="ver">Version ${esc(latest.version)}</span> <small>${esc(U.fmtDate(latest.released_at))}</small></div>
        <p class="notes">${esc(latest.notes)}</p>
        ${updates.length > 1 ? `<details class="older"><summary>Earlier updates</summary><ul class="history">${updates.slice(1).map((u) => `<li><span class="ver">Version ${esc(u.version)}</span> <small>${esc(U.fmtDate(u.released_at))}</small><p class="notes">${esc(u.notes)}</p></li>`).join('')}</ul></details>` : ''}
      </section>` : ''}

      ${app.description ? `<h2>About ${esc(app.name)}</h2><p class="about">${esc(app.description)}</p>` : ''}

      ${(app.screenshots || []).filter((s) => U.safeHttps(s)).length ? `<h2>Screenshots</h2><div class="shots" tabindex="0" aria-label="Screenshots">${app.screenshots.filter((s) => U.safeHttps(s)).map((s, i) => `<img src="${esc(U.safeHttps(s))}" alt="${esc(app.name)} screenshot ${i + 1}" loading="lazy">`).join('')}</div>` : ''}

      <h2>Good to know</h2>
      <dl class="facts">${facts.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>

      <h2>How to install</h2>
      <div class="tabs" role="tablist" aria-label="Choose your device">${Object.entries(GUIDES).map(([k, g]) =>
        `<button class="tab${k === device ? ' is-active' : ''}" role="tab" aria-selected="${k === device}" data-guide="${k}">${esc(g.label)}</button>`).join('')}</div>
      <div id="guide"></div>`;

    const paintGuide = (k) => {
      const g = GUIDES[k];
      $('#guide').innerHTML = `<ol class="guide">${g.steps.map((s) => `<li>${s}</li>`).join('')}</ol><p><small>${esc(g.note)}</small></p>`;
      $$('[data-guide]').forEach((b) => { const on = b.dataset.guide === k; b.classList.toggle('is-active', on); b.setAttribute('aria-selected', String(on)); });
    };
    paintGuide(device);
    $$('[data-guide]').forEach((b) => b.addEventListener('click', () => paintGuide(b.dataset.guide)));

    $('#shareBtn').addEventListener('click', async () => {
      const url = location.href;
      try {
        if (navigator.share) await navigator.share({ title: app.name, text: app.tagline || app.name, url });
        else { await navigator.clipboard.writeText(url); toast('Link copied'); }
      } catch (e) { /* the person closed the share sheet */ }
    });
  }

  /* ---------- router ---------- */

  function route() {
    const [, page, arg] = (location.hash || '#/').slice(1).split('/');
    window.scrollTo(0, 0);
    // The home page already shows the site name in large type, so the small one steps aside there.
    document.getElementById('siteName').style.visibility = page === 'app' ? 'visible' : 'hidden';
    if (page === 'app' && arg) return viewApp(decodeURIComponent(arg));
    return viewHome();
  }
  window.addEventListener('hashchange', route);
  route();
})();
