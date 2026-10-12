(() => {
  'use strict';

  const C = window.SHOWCASE_CONFIG || {};
  const U = window.Showcase;
  const esc = U.esc;
  const main = document.getElementById('main');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const BUCKET = 'showcase';
  const today = () => new Date().toISOString().slice(0, 10);
  const hue = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

  let sb = null;
  if (C.SUPABASE_URL && C.SUPABASE_ANON_KEY && window.supabase) sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

  /* ---------- small helpers ---------- */

  function toast(msg, kind) {
    const el = document.createElement('div');
    el.className = 'toast' + (kind === 'error' ? ' toast--error' : '');
    el.textContent = msg;
    $('#toasts').appendChild(el);
    setTimeout(() => el.remove(), kind === 'error' ? 5200 : 3000);
  }

  function confirmModal(title, body, yes) {
    return new Promise((resolve) => {
      const root = $('#modal-root');
      root.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal__panel"><h2 style="margin-top:0">${esc(title)}</h2><p>${esc(body)}</p>
        <div class="modal__actions"><button class="btn btn--danger-solid" id="yes">${esc(yes)}</button><button class="btn btn--ghost" id="no">Cancel</button></div></div></div>`;
      const done = (v) => { root.innerHTML = ''; resolve(v); };
      $('#yes', root).addEventListener('click', () => done(true));
      $('#no', root).addEventListener('click', () => done(false));
      $('#yes', root).focus();
    });
  }

  const iconHtml = (app, size) =>
    `<span class="icon" style="--s:${size}px;--h:${hue(app.slug || app.name || 'x')}" aria-hidden="true">${
      U.safeHttps(app.icon_url) ? `<img src="${esc(U.safeHttps(app.icon_url))}" alt="">` : esc(String(app.name || '?').trim().charAt(0).toUpperCase())
    }</span>`;

  // Shrinks a picture before it is uploaded so it stays small. Icons are cropped to a square.
  async function resizeImage(file, { max, square, type, quality }) {
    const bmp = await createImageBitmap(file);
    let w = bmp.width;
    let h = bmp.height;
    let sx = 0;
    let sy = 0;
    let sw = w;
    let sh = h;
    if (square) {
      const side = Math.min(w, h);
      sx = Math.floor((w - side) / 2);
      sy = Math.floor((h - side) / 2);
      sw = sh = side;
      w = h = Math.min(max, side);
    } else if (w > max) {
      h = Math.round((h * max) / w);
      w = max;
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (type === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h); }
    ctx.drawImage(bmp, sx, sy, sw, sh, 0, 0, w, h);
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not read that picture.'))), type, quality));
  }

  async function uploadImage(path, blob) {
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (error) throw error;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  // Removing pictures is best effort: a leftover file is harmless.
  async function removeImages(urls) {
    const paths = urls.map((u) => U.pathFromUrl(u, BUCKET)).filter(Boolean);
    if (paths.length) await sb.storage.from(BUCKET).remove(paths).catch(() => {});
  }

  /* ---------- sign in ---------- */

  function viewLogin(message) {
    main.innerHTML = `<section class="card" style="max-width:440px;margin:40px auto">
      <h1 style="font-size:2rem">Admin</h1>
      <p class="msg" id="loginMsg" role="alert">${esc(message || '')}</p>
      <form id="loginForm" novalidate>
        <label>Email<input type="email" name="email" autocomplete="email" required></label>
        <label>Password<input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn btn--gold" type="submit" style="width:100%">Sign in</button>
      </form></section>`;
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const btn = $('button[type=submit]', e.target);
      btn.disabled = true;
      const { error } = await sb.auth.signInWithPassword({ email: String(f.get('email')).trim(), password: String(f.get('password')) });
      if (error) {
        $('#loginMsg').textContent = 'That email and password did not work.';
        btn.disabled = false;
        return;
      }
      start();
    });
  }

  function viewDenied(email) {
    main.innerHTML = `<section class="card" style="max-width:520px;margin:40px auto">
      <h1 style="font-size:1.8rem">Not an admin</h1>
      <p>${esc(email || 'This account')} is signed in, but it is not on the admin list. Add the email to the <code>showcase_admins</code> table in Supabase (the last line of showcase.sql does this), then sign in again.</p>
      <button class="btn" id="out">Sign out</button></section>`;
    $('#out').addEventListener('click', async () => { await sb.auth.signOut(); start(); });
  }

  /* ---------- the list of apps ---------- */

  async function viewList() {
    const { data, error } = await sb.from('showcase_apps').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false });
    if (error) { main.innerHTML = `<p class="msg">${esc(error.message)}</p>`; return; }
    main.innerHTML = `<div class="row row--between" style="margin:22px 0 14px"><h1 style="margin:0;font-size:2.2rem">Your apps</h1>
        <div class="row"><button class="btn btn--gold" id="newApp">Add an app</button><button class="btn btn--ghost btn--sm" id="signOut">Sign out</button></div></div>
      ${data.length ? `<ul class="applist">${data.map((a) => `<li class="appitem">${iconHtml(a, 52)}
        <div class="appitem__main"><b>${esc(a.name)}</b><small>${a.version ? 'Version ' + esc(a.version) : 'No version yet'}</small></div>
        <span class="badge ${a.published ? 'badge--ok' : 'badge--draft'}">${a.published ? 'Published' : 'Draft'}</span>
        <button class="btn btn--sm" data-edit="${esc(a.id)}">Edit</button></li>`).join('')}</ul>`
        : '<p class="empty">No apps yet. Add your first one.</p>'}`;
    $('#newApp').addEventListener('click', () => viewEditor(null));
    $('#signOut').addEventListener('click', async () => { await sb.auth.signOut(); start(); });
    $$('[data-edit]').forEach((b) => b.addEventListener('click', () => viewEditor(data.find((a) => a.id === b.dataset.edit))));
  }

  /* ---------- the editor ---------- */

  async function viewEditor(existing) {
    const isNew = !existing;
    const app = existing
      ? { ...existing, screenshots: [...(existing.screenshots || [])] }
      : { slug: '', name: '', tagline: '', description: '', app_url: '', icon_url: null, screenshots: [], needs_account: false, pricing: 'Free', contact: '', privacy_note: '', version: '', released_at: null, published: true, sort: 0 };
    const removedImages = [];
    let slugTouched = !isNew;

    main.innerHTML = `<p style="margin:22px 0 8px"><a href="#" id="backList">Back to your apps</a></p>
      <h1 style="font-size:2.2rem">${isNew ? 'Add an app' : esc(app.name)}</h1>
      <form id="appForm" class="card" novalidate>
        <div class="grid2">
          <label>Name<input type="text" name="name" maxlength="60" value="${esc(app.name)}"><span class="err" data-err="name"></span></label>
          <label>Page address name<input type="text" name="slug" maxlength="40" value="${esc(app.slug)}" ${isNew ? '' : 'readonly'}>
            <span class="hint">${isNew ? 'Part of the page web address. It cannot change later.' : 'Locked, so existing links keep working.'}</span><span class="err" data-err="slug"></span></label>
        </div>
        <label>One-line summary<input type="text" name="tagline" maxlength="100" value="${esc(app.tagline)}"><span class="hint">Shown under the name. Up to 100 characters.</span><span class="err" data-err="tagline"></span></label>
        <label>Web address of the app<input type="url" name="app_url" placeholder="https://your-app.example.com" value="${esc(app.app_url)}"><span class="err" data-err="app_url"></span></label>
        <label>Description<textarea name="description" maxlength="2000">${esc(app.description)}</textarea><span class="hint">What it does and who it is for. Line breaks are kept.</span><span class="err" data-err="description"></span></label>
        <div class="grid2">
          <label>Cost<input type="text" name="pricing" maxlength="60" value="${esc(app.pricing)}"><span class="hint">For example: Free, or Free with a premium plan.</span><span class="err" data-err="pricing"></span></label>
          <label>Version<input type="text" name="version" maxlength="20" value="${esc(app.version)}"><span class="hint">Filled in for you when you add an update.</span><span class="err" data-err="version"></span></label>
          <label>Contact<input type="text" name="contact" maxlength="120" value="${esc(app.contact)}"><span class="hint">An email or a short line people can reach you on.</span><span class="err" data-err="contact"></span></label>
          <label>Order on the shelf<input type="number" name="sort" min="0" max="999" value="${esc(app.sort)}"><span class="hint">Smaller numbers come first.</span><span class="err" data-err="sort"></span></label>
        </div>
        <label>Privacy note<input type="text" name="privacy_note" maxlength="300" value="${esc(app.privacy_note)}"><span class="hint">For example: what is stored, and whether files are kept.</span><span class="err" data-err="privacy_note"></span></label>
        <label><input type="checkbox" name="needs_account" ${app.needs_account ? 'checked' : ''}>People need an account to use it</label>
        <label><input type="checkbox" name="published" ${app.published ? 'checked' : ''}>Published (untick to keep it as a draft only you can see)</label>

        <label>Icon<span class="hint">A square picture works best. It is cropped and shrunk for you.</span>
          <div class="row" style="margin-top:8px"><span id="iconPreview"></span><input type="file" id="iconFile" accept="image/png,image/jpeg,image/webp" style="max-width:260px"><button class="btn btn--ghost btn--sm" type="button" id="iconClear">Remove icon</button></div></label>
        <label>Screenshots<span class="hint">Up to 5 pictures. Phone screenshots look best.</span>
          <input type="file" id="shotFile" accept="image/png,image/jpeg,image/webp" multiple style="margin-top:8px"><div class="thumbs" id="thumbs"></div></label>

        <p class="msg" id="formMsg" role="alert"></p>
        <div class="row"><button class="btn btn--gold" type="submit" id="saveBtn">${isNew ? 'Add app' : 'Save changes'}</button>
          ${isNew ? '' : '<button class="btn btn--danger btn--sm" type="button" id="deleteApp">Delete this app</button>'}</div>
      </form>
      <div id="updatesBox"></div>`;

    $('#backList').addEventListener('click', (e) => { e.preventDefault(); viewList(); });
    const form = $('#appForm');
    const field = (n) => form.elements[n];

    const paintIcon = () => { $('#iconPreview').innerHTML = iconHtml({ ...app, name: field('name').value || '?', slug: field('slug').value || 'x' }, 56); };
    const paintThumbs = () => {
      $('#thumbs').innerHTML = app.screenshots.map((u, i) => `<div class="thumb"><img src="${esc(u)}" alt="Screenshot ${i + 1}"><button type="button" data-rm="${i}" aria-label="Remove screenshot ${i + 1}">&times;</button></div>`).join('');
      $$('[data-rm]', form).forEach((b) => b.addEventListener('click', () => { removedImages.push(app.screenshots[Number(b.dataset.rm)]); app.screenshots.splice(Number(b.dataset.rm), 1); paintThumbs(); }));
    };
    paintIcon();
    paintThumbs();

    field('name').addEventListener('input', () => {
      if (isNew && !slugTouched) field('slug').value = U.slugify(field('name').value);
      paintIcon();
    });
    field('slug').addEventListener('input', () => { slugTouched = true; paintIcon(); });

    const slugNow = () => String(field('slug').value || U.slugify(field('name').value)).trim();

    $('#iconFile').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        if (!U.slugify(field('name').value) && !slugNow()) throw new Error('Type the app name first.');
        const blob = await resizeImage(file, { max: 256, square: true, type: 'image/png' });
        const url = await uploadImage(`icons/${slugNow() || 'app'}-${Date.now()}.png`, blob);
        if (app.icon_url) removedImages.push(app.icon_url);
        app.icon_url = url;
        paintIcon();
        toast('Icon added. Save to keep it.');
      } catch (ex) { toast(ex.message || 'Could not upload that picture.', 'error'); }
      e.target.value = '';
    });
    $('#iconClear').addEventListener('click', () => { if (app.icon_url) removedImages.push(app.icon_url); app.icon_url = null; paintIcon(); });
    $('#shotFile').addEventListener('change', async (e) => {
      const files = Array.from(e.target.files).slice(0, 5 - app.screenshots.length);
      if (e.target.files.length > files.length) toast('You can have up to 5 screenshots.', 'error');
      for (const [i, file] of files.entries()) {
        try {
          const blob = await resizeImage(file, { max: 1000, type: 'image/jpeg', quality: 0.85 });
          app.screenshots.push(await uploadImage(`shots/${slugNow() || 'app'}-${Date.now()}-${i}.jpg`, blob));
        } catch (ex) { toast(ex.message || 'Could not upload that picture.', 'error'); }
      }
      paintThumbs();
      e.target.value = '';
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const row = {
        slug: String(f.get('slug') || '').trim(),
        name: String(f.get('name') || '').trim(),
        tagline: String(f.get('tagline') || '').trim(),
        description: String(f.get('description') || '').trim(),
        app_url: String(f.get('app_url') || '').trim(),
        pricing: String(f.get('pricing') || '').trim() || 'Free',
        contact: String(f.get('contact') || '').trim(),
        privacy_note: String(f.get('privacy_note') || '').trim(),
        version: String(f.get('version') || '').trim(),
        sort: Number(f.get('sort') || 0),
        needs_account: !!f.get('needs_account'),
        published: !!f.get('published'),
        icon_url: app.icon_url,
        screenshots: app.screenshots,
      };
      const errs = U.validateApp(row);
      $$('[data-err]', form).forEach((el) => { el.textContent = errs[el.dataset.err] || ''; });
      $('#formMsg').textContent = '';
      if (Object.keys(errs).length) { $('#formMsg').textContent = 'Please fix the highlighted fields.'; return; }

      const btn = $('#saveBtn');
      btn.disabled = true;
      const res = isNew
        ? await sb.from('showcase_apps').insert(row).select().single()
        : await sb.from('showcase_apps').update(row).eq('id', existing.id).select().single();
      btn.disabled = false;
      if (res.error) {
        $('#formMsg').textContent = res.error.code === '23505' ? 'That page address name is already used by another app.' : (res.error.message || 'Could not save.');
        return;
      }
      await removeImages(removedImages);
      removedImages.length = 0;
      toast(isNew ? 'App added' : 'Saved');
      if (isNew) viewEditor(res.data); // stay here so you can add the first update
      else { Object.assign(existing, res.data); }
    });

    const del = $('#deleteApp');
    if (del) del.addEventListener('click', async () => {
      if (!(await confirmModal('Delete this app?', 'Its page, pictures and update history are removed for good.', 'Delete'))) return;
      const { error } = await sb.from('showcase_apps').delete().eq('id', existing.id);
      if (error) { toast(error.message, 'error'); return; }
      await removeImages([existing.icon_url, ...(existing.screenshots || [])].filter(Boolean));
      toast('Deleted');
      viewList();
    });

    if (!isNew) paintUpdates(existing);
  }

  /* ---------- what's new ---------- */

  async function paintUpdates(app) {
    const box = $('#updatesBox');
    const { data, error } = await sb.from('showcase_updates').select('*').eq('app_id', app.id).order('released_at', { ascending: false }).order('created_at', { ascending: false });
    if (error) { box.innerHTML = `<p class="msg">${esc(error.message)}</p>`; return; }
    let editing = null;

    const render = () => {
      box.innerHTML = `<section class="card"><h2 style="margin-top:0">What's new</h2>
        <p class="hint" style="margin-top:-6px">Adding an update sets the app's version and "Updated" date, and shows this note first on its page.</p>
        <form id="updForm" novalidate>
          <div class="grid2">
            <label>Version<input type="text" name="version" maxlength="20" value="${esc(editing ? editing.version : '')}" placeholder="1.2"><span class="err" data-uerr="version"></span></label>
            <label>Release date<input type="date" name="released_at" value="${esc(editing ? editing.released_at : today())}"><span class="err" data-uerr="released_at"></span></label>
          </div>
          <label>What changed<textarea name="notes" maxlength="600" style="min-height:90px">${esc(editing ? editing.notes : '')}</textarea><span class="err" data-uerr="notes"></span></label>
          <div class="row"><button class="btn btn--gold" type="submit">${editing ? 'Save this update' : 'Add update'}</button>${editing ? '<button class="btn btn--ghost btn--sm" type="button" id="cancelEdit">Cancel</button>' : ''}</div>
        </form>
        ${data.length ? `<ul class="updates">${data.map((u) => `<li><div class="row row--between"><b>Version ${esc(u.version)}</b><small>${esc(U.fmtDate(u.released_at))}</small></div><p>${esc(u.notes)}</p>
          <div class="row"><button class="btn btn--sm" data-uedit="${esc(u.id)}">Edit</button><button class="btn btn--danger btn--sm" data-udel="${esc(u.id)}">Delete</button></div></li>`).join('')}</ul>` : '<p class="hint">No updates yet.</p>'}
      </section>`;

      $('#updForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        const row = { version: String(f.get('version') || '').trim(), notes: String(f.get('notes') || '').trim(), released_at: String(f.get('released_at') || '') };
        const errs = U.validateUpdate(row);
        $$('[data-uerr]', box).forEach((el) => { el.textContent = errs[el.dataset.uerr] || ''; });
        if (Object.keys(errs).length) return;
        const res = editing
          ? await sb.from('showcase_updates').update(row).eq('id', editing.id)
          : await sb.from('showcase_updates').insert({ ...row, app_id: app.id });
        if (res.error) { toast(res.error.message, 'error'); return; }
        await syncLatest(app);
        toast(editing ? 'Update saved' : 'Update added');
        paintUpdates(app);
        const v = $('#appForm') && $('#appForm').elements.version;
        if (v) v.value = app.version || '';
      });
      const cancel = $('#cancelEdit');
      if (cancel) cancel.addEventListener('click', () => { editing = null; render(); });
      $$('[data-uedit]', box).forEach((b) => b.addEventListener('click', () => { editing = data.find((u) => u.id === b.dataset.uedit); render(); $('#updForm').scrollIntoView({ behavior: 'smooth', block: 'center' }); }));
      $$('[data-udel]', box).forEach((b) => b.addEventListener('click', async () => {
        if (!(await confirmModal('Delete this update?', 'It disappears from the app page.', 'Delete'))) return;
        const { error: err } = await sb.from('showcase_updates').delete().eq('id', b.dataset.udel);
        if (err) { toast(err.message, 'error'); return; }
        await syncLatest(app);
        toast('Update deleted');
        paintUpdates(app);
      }));
    };
    render();
  }

  // Keeps the app's own version and "Updated" date matching its newest update.
  async function syncLatest(app) {
    const { data } = await sb.from('showcase_updates').select('*').eq('app_id', app.id).order('released_at', { ascending: false }).order('created_at', { ascending: false }).limit(1);
    const newest = data && data[0];
    const patch = newest ? { version: newest.version, released_at: newest.released_at } : { version: '', released_at: null };
    const res = await sb.from('showcase_apps').update(patch).eq('id', app.id).select().single();
    if (!res.error) Object.assign(app, res.data);
  }

  /* ---------- start ---------- */

  async function start() {
    if (!sb) {
      main.innerHTML = '<section class="card" style="max-width:520px;margin:40px auto"><h1 style="font-size:1.8rem">Not connected yet</h1><p>Open <code>js/config.js</code> and fill in your Supabase address and public key.</p></section>';
      return;
    }
    const { data } = await sb.auth.getSession();
    if (!data.session) { $('#who').textContent = ''; return viewLogin(); }
    const email = data.session.user && data.session.user.email;
    $('#who').textContent = email || '';
    const admin = await sb.rpc('is_showcase_admin');
    if (admin.error || admin.data !== true) return viewDenied(email);
    viewList();
  }
  start();
})();
