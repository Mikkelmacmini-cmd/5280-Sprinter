# 5280 Sprinter Hiring — Backend Setup

This site is a static landing page (`index.html`) plus **Netlify Functions** for the
backend, **Resend** for email, and **Netlify Blobs** for storage (no separate database).

## What's included
- `index.html` — landing page; the dropdown loads from the backend, the form POSTs the
  application (with resume) to a function.
- `admin/index.html` — password-protected admin at **/admin** (change destination email,
  manage positions).
- `netlify/functions/*` — `apply`, `get-positions`, `list-positions`, `add-position`,
  `toggle-position`, `delete-position`, `get-settings`, `update-settings`, `login`, `logout`.
- `netlify/lib/shared.js` — shared auth/blobs helpers.
- `netlify.toml`, `package.json`, `.env.example`, `.gitignore`.

---

## 1. Get a Resend API key
1. Sign up at https://resend.com and go to **API Keys → Create API Key**.
2. Copy the key (starts with `re_…`). This becomes `RESEND_API_KEY`.

## 2. Choose your "From" address
- **Before** verifying a domain, set `RESEND_FROM_EMAIL=onboarding@resend.dev` — Resend's
  shared test sender. Emails will send immediately so you can test end-to-end.
- **For production,** verify your own domain: Resend → **Domains → Add Domain**, add the
  DNS records it shows (SPF/DKIM) at your DNS host, wait for "Verified," then set
  `RESEND_FROM_EMAIL=hiring@yourdomain.com` (any address @ the verified domain).

## 3. Create the Netlify site
1. Push this folder to a Git repo (or drag‑drop deploy). In Netlify: **Add new site →
   Import an existing project**, pick the repo.
2. Build settings: **no build command needed**; publish directory `.`; functions directory
   `netlify/functions` (already set in `netlify.toml`). Netlify auto-installs dependencies.

## 4. Enable Netlify Blobs
Netlify Blobs works automatically on any site on a Netlify team that has it enabled (it's
on by default for most teams). No keys to copy — the functions read/write it via the
deploy context. Nothing to configure beyond deploying.

## 5. Set environment variables (Netlify dashboard)
**Site configuration → Environment variables → Add a variable** (see `.env.example`):

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | your `re_…` key |
| `RESEND_FROM_EMAIL` | `onboarding@resend.dev` (then your verified address) |
| `DEFAULT_TO_EMAIL` | fallback recipient until you set one in /admin |
| `ADMIN_EMAIL` | the email you'll log in with (optional but recommended) |
| `ADMIN_PASSWORD` | a strong password |
| `SESSION_SECRET` | long random string — generate with:<br>`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |

Then **redeploy** (env var changes require a new deploy).

## 6. (Optional) Run locally
```
npm install
npm i -g netlify-cli      # if you don't have it
cp .env.example .env       # fill in real values
netlify dev                # serves the site + functions + Blobs locally
```

---

## 7. Test checklist
1. **Form loads positions** — open the site, click *Apply Now*; the dropdown shows your
   active positions (seeded with "Sprinter Technician" and "Service Advisor" on first run).
2. **Submit an application** — fill it out, attach a small PDF/DOC, submit. You should see
   the success message and an email (with the resume attached) at `DEFAULT_TO_EMAIL`.
   - Try a >4MB file → friendly "under 4MB" error.
   - Try submitting with no resume / bad email → inline field errors.
3. **Admin login** — go to **/admin**, sign in with `ADMIN_EMAIL` + `ADMIN_PASSWORD`.
   A wrong password is rejected.
4. **Change destination email** — enter one or more addresses (comma-separated), Save.
   Submit a new test application → it now arrives at the new address(es).
5. **Add a position** — add e.g. "Diesel Technician"; reload the public form → it appears.
6. **Hide a position** — click *Hide*; it disappears from the public dropdown but stays in
   the admin list (status "Hidden"). *Unhide* brings it back.
7. **Delete a position** — click *Delete*, confirm; it's removed everywhere. Submitting a
   stale/removed position is rejected by the server.

---

## ⚠️ Important: this is built for Netlify
The form and admin call `/.netlify/functions/...`. Your live domain
(`5280.wrenchworksdigital.com`) currently points to **Vercel** — those function paths do
**not** exist on Vercel, so the form/admin will only work once the site is deployed to
**Netlify** and the domain is pointed there (Netlify → Domain management → add your custom
domain, then update DNS). Until then, keep this on a Netlify preview URL for testing so you
don't break the current live form.
