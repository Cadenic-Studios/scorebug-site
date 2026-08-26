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
  //
  // ─── THE THREE EXCEPTIONS: /privacy, /terms, /account-deletion ────────────
  // These exist as real pages in THIS deployment and must never be added to
  // the list below, even though the app has routes by the same names.
  //
  // Google Play (and every other store console) takes a policy URL as a
  // typed-in field and fetches it themselves, out of band, with no browser and
  // no patience. A 307 to a different host is a fragile answer to that fetch:
  // it depends on a second deployment being up, it crosses an origin, and a
  // reviewer who follows it sees an address bar that no longer matches the URL
  // they submitted. Either failure reads as "policy URL unreachable", which
  // blocks the release. Play also requires the account-deletion URL to be
  // publicly reachable without signing in — a redirect into the app is exactly
  // the wrong shape for that.
  //
  // So the marketing domain owns the legal pages outright. Because `redirects`
  // runs BEFORE the filesystem, keeping them in APP_ROUTES would make the
  // local pages permanently unreachable — the pages would build and deploy and
  // still never be served.
  async redirects() {
    /**
     * www -> apex, permanent. www.getscorebug.app was serving the full site
     * with a 200 — two indexable hosts with identical content, competing with
     * each other for every query. The canonical tag pointed at the apex, which
     * mitigates, but a canonical is a hint and a 308 is an answer. `has` with
     * a host condition is the documented Next.js shape for this; `:path*`
     * carries the deep link across.
     */
    const WWW = [{
      source: '/:path*',
      has: [{ type: 'host', value: 'www.getscorebug.app' }],
      destination: 'https://getscorebug.app/:path*',
      permanent: true,
    }]
    const APP_ROUTES = [
      'activity', 'admin', 'auth', 'fan', 'go', 'linemates', 'player-card',
      'the-almanac', 'the-bleachers', 'the-docket',
      'the-franchise', 'the-front-office', 'the-log', 'the-news',
      'the-playbook', 'the-rafters', 'the-slate', 'the-vault', 'the-pro-shop'
    ]
    const APP = 'https://app.getscorebug.app'
    // Two rules per route: the bare path, and everything beneath it.
    // `/x/:rest*` does not match `/x` itself, so the pair is required.
    return [
      ...WWW,
      ...APP_ROUTES.flatMap(r => [
        { source: `/${r}`, destination: `${APP}/${r}/`, permanent: false },
        { source: `/${r}/:rest*`, destination: `${APP}/${r}/:rest*`, permanent: false },
      ]),
    ]
  },

  /**
   * Shopify product photography is served from cdn.shopify.com. Without this,
   * next/image refuses the host outright ("hostname is not configured") and the
   * whole /shop route 500s rather than degrading to a missing image.
   *
   * Narrowed to the exact CDN host and the image path prefix rather than a
   * bare wildcard: `remotePatterns` is an allowlist for a server-side fetcher
   * that will retrieve and re-encode whatever it is pointed at, so it should
   * name what it actually needs.
   */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.shopify.com', pathname: '/s/files/**' },
    ],
  },

  async headers() {
    return [
      {
        /**
         * The site shipped with NO security headers at all, and no CSP — the
         * brief assumed a vercel.json CSP existed here to be widened for
         * Shopify. There is no vercel.json on this project; headers come from
         * this file, and nothing was blocking anything.
         *
         * Adding one is worth doing on its own merits, but note what it must
         * permit: Next injects inline bootstrap scripts and inline styles, so
         * 'unsafe-inline' is unavoidable without a nonce middleware, and dev
         * builds need 'unsafe-eval'. connect-src covers Supabase (the waitlist
         * form posts an OTP request) and Shopify (the /shop catalogue fetch is
         * server-side today, but a future client cart would need it).
         */
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "connect-src 'self' https://*.myshopify.com https://*.supabase.co",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self' https://*.myshopify.com",
            ].join('; '),
          },
        ],
      },
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
