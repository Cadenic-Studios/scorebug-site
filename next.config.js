/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Deep-link fallback proxy ─────────────────────────────────────────────
  //
  // getscorebug.app is BOTH the marketing site and the Universal/App-Link
  // domain. On a phone with Scorebug installed the OS intercepts app-route
  // links before any request is made; everywhere else (desktop, app not
  // installed) the link lands here — and must show the real page, not a 404.
  //
  // `fallback` rules run only after this site's own filesystem and routes fail
  // to match, so "/", sitemap.xml, robots.txt, og.png, /shots/* and
  // /.well-known/* are all served locally. Everything else is an app route and
  // is handed to the web-app deployment.
  //
  // ─── WHY A REDIRECT AND NOT A REWRITE ─────────────────────────────────────
  // Proxying was the original design — keep the visitor's URL on
  // getscorebug.app — and it works locally. It CANNOT work on Vercel, and the
  // reason is worth writing down so nobody restores it.
  //
  // A proxied Next app still asks for its own bundles at `/_next/static/...`,
  // i.e. from THIS origin. Vercel answers `/_next/static/*` from its immutable
  // asset layer, which is consulted BEFORE fallback rewrites — so those
  // requests 404 here instead of falling through to the upstream. Measured on
  // the live deployment: the app's HTML arrived 200, then every stylesheet and
  // chunk 404'd (`webpack-*.js`, `main-app-*.js`, both CSS files). The page
  // rendered unstyled and never booted. The hashes cannot be made to collide
  // with ours either, because the two deployments build independently.
  //
  // The only way to keep the rewrite would be an absolute `assetPrefix` on the
  // app — and that app is ALSO a Capacitor static export whose assets must
  // resolve locally inside the APK, so an absolute prefix risks breaking the
  // native build for a cosmetic URL win.
  //
  // So: redirect. The hero's primary CTA already points at
  // app.getscorebug.app, so this is the destination the site advertises
  // anyway. 307 rather than 308 — nothing here is worth caching permanently
  // in every visitor's browser if the hosting story changes later.
  //
  // Android App Links are unaffected: with the app installed the OS intercepts
  // the tapped getscorebug.app URL before any request is made, and
  // /.well-known/assetlinks.json is still served by THIS deployment.
  // Listed explicitly rather than as a catch-all: `redirects()` has no
  // `fallback` tier — every rule runs BEFORE the filesystem — so a blanket
  // `/:path*` would swallow this site's own pages. An allowlist also means an
  // unknown URL gets this site's 404 instead of being bounced to the app.
  //
  // Mirrors the top-level route folders in the app (`ls app/*/` there). Keep
  // the two in step: a folder added there and forgotten here is a link that
  // 404s on the marketing domain.
  async redirects() {
    const APP_ROUTES = [
      'activity', 'admin', 'auth', 'fan', 'go', 'linemates', 'player-card',
      'privacy', 'terms', 'the-almanac', 'the-bleachers', 'the-docket',
      'the-franchise', 'the-front-office', 'the-log', 'the-news',
      'the-playbook', 'the-rafters', 'the-slate', 'the-vault',
    ]
    const APP = 'https://app.getscorebug.app'
    // Two rules per route: the bare path, and everything beneath it.
    // `/x/:rest*` does not match `/x` itself, so the pair is required.
    return APP_ROUTES.flatMap(r => [
      { source: `/${r}`, destination: `${APP}/${r}/`, permanent: false },
      { source: `/${r}/:rest*`, destination: `${APP}/${r}/:rest*`, permanent: false },
    ])
  },

  async headers() {
    return [
      {
        // Both stores fetch these with strict content-type expectations, and
        // Apple's CDN caches aggressively — say exactly what they are.
        source: '/.well-known/:file*',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
