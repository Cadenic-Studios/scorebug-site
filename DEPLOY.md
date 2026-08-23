# Deploying getscorebug.app

The marketing site, the web app, and the two store deep-link files all hang off
one domain. This is the exact order to wire it, start to finish.

## 0. The shape of the system

| Surface | Deployment | URL |
|---|---|---|
| Marketing site (this repo) | Vercel project `scorebug-site` | `getscorebug.app` |
| Web app (scorebug-app repo) | Vercel project `scorebug-app` | `app.getscorebug.app` |
| Canadian vanity domain | alias on `scorebug-site` | `scorebug.ca` → 301 → `getscorebug.app` |

The marketing site owns the root domain. Any path it doesn't serve itself
(`/the-slate`, `/the-vault`, `/privacy`, …) is **proxied** to
`app.getscorebug.app` by the `fallback` rewrite in `next.config.js`, so deep
links opened on desktop land on the real page while the URL bar stays on
`getscorebug.app`.

## 1. Push and import

```bash
cd scorebug-site
git init && git add -A && git commit -m "Scorebug marketing site"
gh repo create wyattmcph/scorebug-site --private --source . --push
```

In Vercel: **Add New → Project → import `scorebug-site`**. Framework preset
"Next.js", no env vars needed. Deploy once so the project exists.

## 2. DNS for getscorebug.app

In Vercel → the `scorebug-site` project → **Settings → Domains** → add
`getscorebug.app` and `www.getscorebug.app`. Vercel will show you the records
it wants; at your DNS registrar create:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Set `getscorebug.app` (apex) as the **primary** domain in Vercel and let
`www` redirect to it (Vercel offers this as a one-click option on the domain
row). Certificates are automatic; propagation is minutes to a few hours.

> Cleaner alternative: move the domain's nameservers to Vercel DNS
> (`ns1.vercel-dns.com` / `ns2.vercel-dns.com`) and skip manual records —
> Vercel then manages everything, including the `app` subdomain below.

## 3. The web-app subdomain

In the **`scorebug-app`** Vercel project (the existing one) → Settings →
Domains → add `app.getscorebug.app`.

If the DNS lives at your registrar, add: `CNAME app → cname.vercel-dns.com`.
If you moved nameservers to Vercel, it's automatic.

This is the deployment the marketing site's fallback rewrite targets — the
rewrite does nothing useful until this domain resolves.

## 4. scorebug.ca → 301

Add `scorebug.ca` (and `www.scorebug.ca`) to the **same `scorebug-site`
project** in Settings → Domains. At the `.ca` registrar create the same
records as step 2 (A `@` → `76.76.21.21`, CNAME `www` → `cname.vercel-dns.com`).

On the `scorebug.ca` domain row in Vercel, choose **Redirect to
`getscorebug.app`** with status **308 (Permanent)** — Vercel's UI performs the
permanent redirect at the edge; no code needed. (308 is the modern 301: same
permanence, method-preserving. Search engines treat it identically.)

## 5. App Links / Universal Links

The two files are already in `public/.well-known/` and are served with
`Content-Type: application/json` by the headers rule in `next.config.js`.
They ship with placeholders that MUST be replaced before they verify:

### Android (`assetlinks.json`)
1. Finish Play App Signing (the release-signing step from the app handover).
2. Play Console → your app → **Setup → App signing** → copy the
   **App signing key certificate → SHA-256 fingerprint** (colon-separated hex).
3. Replace `YOUR_ANDROID_SHA256_CERT_FINGERPRINT` with it. If you also want
   debug builds to deep-link, add the debug keystore's SHA-256 as a second
   array entry:
   `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android | grep SHA256`
4. The matching `<intent-filter android:autoVerify="true">` for
   `getscorebug.app` has been added to the app's `AndroidManifest.xml` —
   ship an app update after the file above is live, then verify with:
   `adb shell pm get-app-links ca.scorebug.sports`

### iOS (`apple-app-site-association`)
Nothing to do until the iOS app exists. When it does: replace
`YOUR_APPLE_TEAM_ID` with the 10-character Team ID from the Apple Developer
portal, add the Associated Domains capability
(`applinks:getscorebug.app`) to the app target, and re-deploy the site.
Apple fetches the file through its CDN; allow up to 24h after deploy.

### Verify the files are live
```bash
curl -i https://getscorebug.app/.well-known/assetlinks.json
```

```bash
curl -i https://getscorebug.app/.well-known/apple-app-site-association
```

Both must return `200` with `Content-Type: application/json`.

## 6. Before you publish — two content decisions

**The Front Office price is shown on the page.** `$3.99/month · $19.99/year`
appears in the gold section and in the FAQ. In the app source those numbers
live in a **fallback catalogue explicitly marked `placeholder: true`**
(`lib/services/billing.ts`), because the real prices come from RevenueCat /
Play Billing at runtime. The page therefore carries the qualifier *"Planned
rates shown; Google Play confirms the live price in your currency at
checkout."*

Before launch, either:
- confirm those are the prices you configure in Play Console, or
- change them in **two** places — `app/page.tsx` (gold section fine print) and
  `app/faqs.ts` (the "Is Scorebug free?" answer, which also feeds the FAQPage
  schema).

**The claims on this page were fact-checked against the app source.** Several
lines from the original brief were corrected because the code did not support
them — photos are private, The Wire is not "completely tailored", there is no
"draft" mechanic, Discord finds fellow fans by shared server rather than
syncing your friend list, and per-team alerts are free rather than a Front
Office perk. If you edit the copy, re-check it the same way; this page is the
text answer engines will quote.

## 7. Post-launch SEO checklist

- Google Search Console: add the `getscorebug.app` **domain property** (DNS
  TXT verification), submit `https://getscorebug.app/sitemap.xml`.
- Bing Webmaster Tools: import from Search Console (one click).
- Validate the structured data at https://search.google.com/test/rich-results —
  expect `MobileApplication` and `FAQPage` to be detected.
- Once real Play Store ratings exist, add `aggregateRating` to the
  `MobileApplication` schema in `app/layout.tsx` (it is deliberately absent —
  invented ratings are a policy violation that gets rich results revoked).
- Update the Play Store listing's website field to `https://getscorebug.app`.
