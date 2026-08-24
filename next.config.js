/** @type {import('next').NextConfig} */
const nextConfig = {
  // ─── Deep-link fallback proxy ─────────────────────────────────────────────
  //
  // getscorebug.app is BOTH the marketing site and the Universal/App-Link
  // domain. On a phone with Scorebug installed the OS intercepts app-route
  // links before any request is made; everywhere else (desktop, app not
  // installed) the link lands here — and must show the real page, not a 404.
  //
  // `fallback` rewrites run only after the marketing site's own filesystem
  // and routes fail to match, so "/", sitemap.xml, robots.txt, og.png and
  // /.well-known/* are all served locally, while every app route
  // (/the-vault, /the-slate, /the-docket/game?id=…, /privacy, /terms, …)
  // — including the app deployment's own /_next/static assets, whose hashed
  // filenames never collide with ours — proxies through to the web-app
  // deployment. The visitor's URL bar stays on getscorebug.app.
  //
  // ─── WHY THE DESTINATION GAINS A TRAILING SLASH ───────────────────────────
  // The upstream is a static export built with `trailingSlash: true`, so it
  // answers `/the-slate` with a 308 to `/the-slate/`. That Location header is
  // RELATIVE, so the browser resolves it against getscorebug.app and comes
  // straight back here — and this deployment, on Next's default
  // `trailingSlash: false`, strips the slash and rewrites again. Infinite
  // bounce, observed live: `/the-slate/` → 308 `/the-slate` → 308 `/the-slate/`.
  //
  // Asking the upstream for the slashed form up front means it answers 200 the
  // first time and no redirect is ever generated. Files must NOT get the extra
  // slash — `/_next/static/chunks/x.js/` is a 404 — so anything whose path
  // contains a dot is proxied verbatim by the first rule, and the second rule
  // only ever sees extension-less routes.
  async rewrites() {
    return {
      fallback: [
        {
          source: '/:path(.*\\..*)',
          destination: 'https://app.getscorebug.app/:path',
        },
        {
          source: '/:path*',
          destination: 'https://app.getscorebug.app/:path*/',
        },
      ],
    }
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
