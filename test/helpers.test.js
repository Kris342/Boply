'use strict';
// Run with: node test/helpers.test.js   (no install needed)
const assert = require('node:assert/strict');
const U = require('../js/common.js');

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

test('slugify makes clean page addresses', () => {
  assert.equal(U.slugify('My Great App!'), 'my-great-app');
  assert.equal(U.slugify('  Café   Quiz  '), 'cafe-quiz');
  assert.equal(U.slugify('---'), '');
  assert.ok(U.slugify('x'.repeat(80)).length <= 40);
  assert.equal(U.slugify('a'.repeat(39) + '-b'), 'a'.repeat(39)); // no trailing dash after trimming
});

test('only https addresses are ever linked', () => {
  assert.equal(U.safeHttps('https://luminara.onrender.com'), 'https://luminara.onrender.com/');
  assert.equal(U.safeHttps('http://insecure.example.com'), '');
  assert.equal(U.safeHttps('javascript:alert(1)'), '');
  assert.equal(U.safeHttps('data:text/html,hi'), '');
  assert.equal(U.safeHttps('not a url'), '');
  assert.equal(U.safeHttps(''), '');
});

test('the install address carries ?install=1 and keeps the rest', () => {
  assert.equal(U.installUrl('https://app.example.com'), 'https://app.example.com/?install=1');
  assert.equal(U.installUrl('https://app.example.com/play?x=2#/home'), 'https://app.example.com/play?x=2&install=1#/home');
  assert.equal(U.installUrl('http://nope.example.com'), '');
});

test('device detection', () => {
  assert.equal(U.detectDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', 'iPhone', 5), 'ios');
  assert.equal(U.detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 5), 'ios'); // iPad pretending to be a Mac
  assert.equal(U.detectDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel', 0), 'desktop');
  assert.equal(U.detectDevice('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l', 5), 'android');
  assert.equal(U.detectDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32', 0), 'desktop');
});

test('dates read the same everywhere', () => {
  assert.equal(U.fmtDate('2026-10-03'), '3 Oct 2026');
  assert.equal(U.fmtDate('2026-12-31T23:59:59Z'), '31 Dec 2026');
  assert.equal(U.fmtDate(''), '');
  assert.equal(U.fmtDate('garbage'), '');
});

test('escaping stops injected markup', () => {
  assert.equal(U.esc('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
  assert.equal(U.esc('a "quoted" \'word\' & more'), 'a &quot;quoted&quot; &#39;word&#39; &amp; more');
  assert.equal(U.esc(null), '');
});

test('storage paths come back out of public addresses', () => {
  const url = 'https://abc.supabase.co/storage/v1/object/public/showcase/icons/my%20app-1.png?x=1';
  assert.equal(U.pathFromUrl(url, 'showcase'), 'icons/my app-1.png');
  assert.equal(U.pathFromUrl('https://elsewhere.example.com/pic.png', 'showcase'), null);
});

test('app validation catches the mistakes people make', () => {
  const good = { name: 'Luminara', slug: 'luminara', tagline: 'Study smarter', description: 'x', app_url: 'https://luminara.onrender.com', pricing: 'Free', contact: 'me@x.com', privacy_note: '', version: '1.0', sort: 0 };
  assert.deepEqual(U.validateApp(good), {});
  assert.ok(U.validateApp({ ...good, name: 'A' }).name);
  assert.ok(U.validateApp({ ...good, slug: 'Bad Slug' }).slug);
  assert.ok(U.validateApp({ ...good, slug: '-bad' }).slug);
  assert.ok(U.validateApp({ ...good, app_url: 'http://insecure.com' }).app_url);
  assert.ok(U.validateApp({ ...good, app_url: '' }).app_url);
  assert.ok(U.validateApp({ ...good, tagline: 'x'.repeat(101) }).tagline);
  assert.ok(U.validateApp({ ...good, description: 'x'.repeat(2001) }).description);
  assert.ok(U.validateApp({ ...good, sort: 1.5 }).sort);
  assert.ok(U.validateApp({ ...good, sort: 1000 }).sort);
});

test('update validation needs a version, a note and a real date', () => {
  const good = { version: '1.2', notes: 'Added dark mode.', released_at: '2026-10-10' };
  assert.deepEqual(U.validateUpdate(good), {});
  assert.ok(U.validateUpdate({ ...good, version: '' }).version);
  assert.ok(U.validateUpdate({ ...good, notes: '   ' }).notes);
  assert.ok(U.validateUpdate({ ...good, notes: 'x'.repeat(601) }).notes);
  assert.ok(U.validateUpdate({ ...good, released_at: '10/10/2026' }).released_at);
  assert.ok(U.validateUpdate({ ...good, released_at: '2026-13-45' }).released_at);
});

let failed = 0;
for (const [name, fn] of tests) {
  try { fn(); console.log('  ok   ' + name); } catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + String(e.message).split('\n').slice(0, 4).join('\n       ')); }
}
console.log(failed ? `\n${failed} test(s) failed` : `\nAll ${tests.length} tests passed`);
process.exit(failed ? 1 : 0);
