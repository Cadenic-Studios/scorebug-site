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
    /**
     * ─── THE VANITY DOMAINS: scorebug.hockey, scorebug.football ─────────────
     *
     * Same mechanism as the www rule above, and for a sharper version of the
     * same reason. Adding a domain to this Vercel project makes the project
     * ANSWER on it — without these rules the entire marketing site would serve
     * a 200 on all three hosts, which is the duplicate-content problem the www
     * rule exists to fix, tripled. These rules are not an enhancement; they are
     * the thing that makes it safe to attach the domains at all.
     *
     * Two rules per host, and the order between them is load-bearing:
     *   `/`        → the sport hub. Somebody who TYPES scorebug.hockey wants
     *                hockey, not a generic homepage.
     *   `/:path*`  → the same path on the apex, so a deep link that was printed
     *                or shared against a vanity domain still resolves.
     * `:path*` matches zero segments, so it also matches `/` — the bare-root
     * rule must therefore come first or the hub landing never fires.
     *
     * 308, not 307. The www rule's reasoning applies with nothing held back:
     * these hosts are never going to become their own sites, so a permanent
     * redirect is the honest answer, and permanence is what consolidates the
     * link equity onto the one host that can rank. See VANITY_DOMAINS in
     * app/config.ts for why they are not separate sites.
     *
     * ─── HAND-MIRRORED FROM app/config.ts ──────────────────────────────────
     * A .js config cannot import the TS module, the same constraint
     * app/leagues.ts documents for the app registry. Keep the two lists in
     * step: a host added there and forgotten here serves a duplicate of the
     * whole site, and a host added here whose `landing` page does not exist
     * bounces every visitor to a 404.
     */
    const VANITY = [
      ['scorebug.hockey', '/hockey'],
      ['scorebug.football', '/football'],
    ]
    const VANITY_RULES = VANITY.flatMap(([host, landing]) =>
      [host, `www.${host}`].flatMap(h => [
        {
          source: '/',
          has: [{ type: 'host', value: h }],
          destination: `https://getscorebug.app${landing}`,
          permanent: true,
        },
        {
          source: '/:path*',
          has: [{ type: 'host', value: h }],
          destination: 'https://getscorebug.app/:path*',
          permanent: true,
        },
      ]),
    )
    const APP_ROUTES = [
      'activity', 'admin', 'auth', 'fan', 'go', 'linemates', 'player-card',
      'the-almanac', 'the-bleachers', 'the-docket',
      // 'front-office' (no article) is the WEB CHECKOUT route the app's
      // webBilling.ts returns buyers to after a Paddle purchase
      // (`${origin}/front-office/?upgraded=1`). Without it that success
      // redirect 404s on this domain. 'the-front-office' is the separate
      // membership page; both are real folders in the app repo.
      'front-office',
      'the-franchise', 'the-front-office', 'the-log', 'the-news',
      'the-playbook', 'the-rafters', 'the-slate', 'the-vault', 'the-pro-shop'
    ]
    const APP = 'https://app.getscorebug.app'
    // Two rules per route: the bare path, and everything beneath it.
    // `/x/:rest*` does not match `/x` itself, so the pair is required.
    // VANITY first: its rules are host-scoped, and APP_ROUTES below is not.
    // Reversed, a vanity-host request for an app route would be handed
    // straight to app.getscorebug.app, skipping the consolidation hop.
    return [
      ...VANITY_RULES,
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

    /*
     * ─── WHY THIS TTL IS A YEAR AND NOT THE DEFAULT ─────────────────────────
     *
     * Next 14 defaults `minimumCacheTTL` to 60 SECONDS. That is the expiry on
     * the OPTIMISED copy, not on the source file — so an image the optimiser
     * has already built is thrown away a minute later and rebuilt on the next
     * request. On a site whose header carries a logo on every single page,
     * that turns one 36px PNG into a cache write per page view per width, for
     * every visitor and every crawler, forever.
     *
     * Measured consequence: Image Optimization cache writes went past the
     * whole monthly allowance while the site had almost no human traffic.
     *
     * A year is safe here because nothing this optimiser touches is mutable at
     * a stable URL: local files are fingerprinted by the build, and Shopify's
     * CDN puts a new path on a re-uploaded asset. If an image ever does need
     * to change in place, changing its filename is the correct fix — not
     * re-expiring every other image on the site every sixty seconds.
     */
    minimumCacheTTL: 31536000,

    /*
     * Every entry here is a separate transformation and a separate cache
     * entry, and the defaults carry eight device widths up to 3840px for a
     * layout whose widest image slot is a product card. Trimming to the four
     * breakpoints this site actually renders at cuts both metrics by half
     * without a visible difference on any screen we support.
     */
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [64, 128, 256],
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
        //
        // NAMED ONE BY ONE, NOT '/.well-known/:file*'. That wildcard was here,
        // and it stamped application/json onto EVERY well-known path — which
        // silently broke the Bluesky handle below, because atproto's spec
        // requires text/plain and a body that is the bare DID "with no prefix
        // or wrapper formatting". A DID served as JSON is not JSON. Add a file
        // here when you add a file there; do not restore the wildcard.
        source: '/.well-known/assetlinks.json',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/.well-known/apple-app-site-association',
        headers: [
          { key: 'Content-Type', value: 'application/json' },
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        /**
         * The Bluesky domain handle. `public/.well-known/atproto-did` holds the
         * DID as 32 bytes with no trailing newline.
         *
         * A STATIC FILE, NOT AN APP ROUTE. `app/.well-known/…/route.ts` was the
         * first attempt. Next's app scanner does walk dot-directories (only
         * '_' parts are skipped), so it very likely would have worked — but the
         * two files above have been served from public/.well-known on this
         * exact domain since August, and a handle that Bluesky re-checks
         * forever should sit on the path already proven in production rather
         * than on a routing behaviour that happens to hold today.
         *
         * Short max-age on purpose: if the DID ever has to change, the old one
         * is out of every cache within five minutes.
         */
        source: '/.well-known/atproto-did',
        headers: [
          { key: 'Content-Type', value: 'text/plain; charset=utf-8' },
          { key: 'Cache-Control', value: 'public, max-age=300' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
