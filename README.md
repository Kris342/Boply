# Showcase: a shelf of web apps people can install

A free, simple website that lists your web apps. Each app gets a page with a description, screenshots,
a "What's new" note, and an **Install app** button with steps for iPhone, Android and computers.
You edit everything from a private admin page. There is no server to keep awake, and it costs nothing to host.

## How it fits together

- The website is plain files (`index.html`, `admin.html`, `css/`, `js/`). Host it anywhere that serves static files.
- Your app details, "what's new" notes and pictures live in your Supabase project (new tables, so Luminara is untouched).
- Only emails listed in the `showcase_admins` table can edit. Everyone else can only read published apps.

## Set up (about 15 minutes)

### 1. Supabase
1. Open your Supabase project, then **SQL Editor > New query**.
2. Paste all of `supabase/showcase.sql` and press **Run**. The last lines of that file make `noiradevale@gmail.com` the admin;
   to use a different email, change it in that last statement before you run it (it must be the email you sign in with).

### 2. Connect the site
Open `js/config.js` and fill in:
- `SUPABASE_URL`: Project Settings > API (or Data API) > Project URL
- `SUPABASE_ANON_KEY`: the **anon / publishable** key. This one is meant to be public.
  **Never** paste the service_role or secret key here.
- `SITE_NAME`, `SITE_TAGLINE` and `CONTACT_EMAIL`: what visitors see.

### 3. Put it online (free)
**GitHub Pages:** create a new public repository, upload all these files, then open
**Settings > Pages**, choose **Deploy from a branch**, pick `main` and `/ (root)`, and save.
Your site appears at `https://YOUR-NAME.github.io/REPO-NAME/` after a minute or two.

**Cloudflare Pages or Netlify** also work: connect the repository, leave the build command empty, and publish the
top folder. A custom domain (about $10 a year) is optional and makes the address look more professional.

### 4. Add your apps
Go to `/admin.html` on your site and sign in. For each app you can set the name, summary, web address,
description, icon, up to 5 screenshots, cost, contact, privacy note and whether it needs an account.
Untick **Published** to keep an app as a draft only you can see.

**To show what's new:** open the app and use **What's new**. Add the version, date and a short note.
The newest note appears first on the app's page, and the app's version and "Updated" date follow automatically.
You can edit or delete earlier notes at any time.

### 5. Make each app installable from here
The **Install app** button opens your app with `?install=1` on the end. For that to show a proper install prompt,
each app needs two things:
1. To be an installable web app: HTTPS, a web app manifest with icons, and a service worker (Luminara already is).
2. The install helper. Copy `snippets/install-helper.js` into the app and add this just before `</body>`:
   `<script src="/install-helper.js" data-name="Your App Name" defer></script>`

On Android and computers the helper shows a one-tap **Install** button. iPhones do not allow that, so it shows a short
Share, Add to Home Screen guide instead.

## Good to know
- Browsers only let an app install itself from its own address, so installing always takes that one extra step
  from the app's own page. The site explains it to visitors.
- Changing an app's "page address name" is not allowed after it is created, so shared links keep working.
- Supabase's free plan can pause a project that has seen no activity for a while. Visits to this site count as activity.
- Run the checks any time with `node test/helpers.test.js` (no install needed).
