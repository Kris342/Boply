/*
 * Small helpers shared by the public site and the admin page.
 * Written so they also run in Node, which is how the tests check them.
 */
(function (root) {
  'use strict';

  const esc = (s) =>
    String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // "My Great App!" becomes "my-great-app" (used in the app's page address).
  const slugify = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .replace(/-+$/g, '');

  // Only secure web addresses are ever linked. Anything else becomes an empty string.
  const safeHttps = (u) => {
    try {
      const x = new URL(String(u).trim());
      return x.protocol === 'https:' ? x.href : '';
    } catch (e) {
      return '';
    }
  };

  // The address the Install button opens. The app's install helper looks for ?install=1.
  const installUrl = (u) => {
    const s = safeHttps(u);
    if (!s) return '';
    const x = new URL(s);
    x.searchParams.set('install', '1');
    return x.href;
  };

  const detectDevice = (ua, platform, touchPoints) => {
    ua = String(ua || '');
    if (/iPhone|iPad|iPod/.test(ua) || (platform === 'MacIntel' && touchPoints > 1)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  };

  // Dates are stored as plain days ("2026-10-10"), so read them without any time zone shift.
  const fmtDate = (d) => {
    if (!d) return '';
    const dt = new Date(String(d).slice(0, 10) + 'T00:00:00Z');
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  };

  // Turns a stored image address back into its path inside the storage bucket.
  const pathFromUrl = (url, bucket) => {
    const parts = String(url || '').split('/object/public/' + bucket + '/');
    return parts.length === 2 ? decodeURIComponent(parts[1].split('?')[0]) : null;
  };

  const SLUG = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

  // Returns an object of problems keyed by field name. Empty means the app is fine to save.
  const validateApp = (a) => {
    const e = {};
    const name = String(a.name || '').trim();
    if (name.length < 2 || name.length > 60) e.name = 'Give the app a name of 2 to 60 characters.';
    if (!SLUG.test(String(a.slug || ''))) e.slug = 'Use lowercase letters, numbers and dashes, up to 40 characters.';
    if (String(a.tagline || '').length > 100) e.tagline = 'Keep the summary under 100 characters.';
    if (String(a.description || '').length > 2000) e.description = 'Keep the description under 2000 characters.';
    if (!safeHttps(a.app_url)) e.app_url = 'Enter the full web address, starting with https://';
    if (String(a.pricing || '').length > 60) e.pricing = 'Keep the cost under 60 characters.';
    if (String(a.contact || '').length > 120) e.contact = 'Keep the contact under 120 characters.';
    if (String(a.privacy_note || '').length > 300) e.privacy_note = 'Keep the privacy note under 300 characters.';
    if (String(a.version || '').length > 20) e.version = 'Keep the version under 20 characters.';
    const sort = Number(a.sort);
    if (!Number.isInteger(sort) || sort < 0 || sort > 999) e.sort = 'Use a whole number from 0 to 999.';
    return e;
  };

  const validateUpdate = (u) => {
    const e = {};
    const version = String(u.version || '').trim();
    if (!version || version.length > 20) e.version = 'Enter a version, up to 20 characters.';
    const notes = String(u.notes || '').trim();
    if (!notes) e.notes = 'Say what changed.';
    else if (notes.length > 600) e.notes = 'Keep it under 600 characters.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(u.released_at || '')) || isNaN(new Date(u.released_at + 'T00:00:00Z'))) e.released_at = 'Choose the release date.';
    return e;
  };

  root.Showcase = { esc, slugify, safeHttps, installUrl, detectDevice, fmtDate, pathFromUrl, validateApp, validateUpdate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.Showcase;
})(typeof window !== 'undefined' ? window : globalThis);
