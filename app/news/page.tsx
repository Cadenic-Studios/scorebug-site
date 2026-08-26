import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE, WEB_APP, SUPABASE_URL, SUPABASE_ANON_KEY } from '../config'
import { SiteHeader, SiteFooter, Breadcrumbs, BreadcrumbNav } from '../components/SiteChrome'
import WireFeed from './WireFeed'

const TITLE = 'The Wire · Sports headlines'
const DESCRIPTION =
  'Headlines from around the NHL, NFL, NBA, MLB, CFL and the major football leagues, with a link straight to the source. Then log the game you just watched.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE}/news` },
  openGraph: { type: 'website', url: `${SITE}/news`, title: TITLE, description: DESCRIPTION, images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Scorebug' }], },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export const revalidate = 900

/**
 * /news — the public headline hub.
 *
 * ─── READ THIS BEFORE TREATING IT AS AN SEO ASSET ────────────────────────────
 * This page lists headlines aggregated from other publishers (ESPN, BBC Sport,
 * CFL.ca and others) and links out to them. Two things follow from that, and
 * neither is a reason not to ship it — but both are reasons not to build a
 * traffic strategy on it:
 *
 *   1. Google's spam policies name "scraped content" — material copied from
 *      other sites and republished without adding value — as a violation. A page
 *      of other outlets' headlines is close to that line no matter how it is
 *      styled, so it is unlikely to rank, and at worst it is a quality signal
 *      attached to a domain that also hosts /shop and the landing page.
 *   2. Publisher terms of service generally prohibit redistribution.
 *
 * The build here is the defensible end of that range, on purpose:
 *   • HEADLINE AND SOURCE ONLY. The `description` and `summary_tldr` columns
 *     exist in news_cache and are deliberately NOT rendered. A headline plus
 *     attribution plus a link out is what a link aggregator does; reprinting the
 *     publisher's own summary is what a scraper does, and it is the part that
 *     draws complaints.
 *   • Every item links to the ORIGINAL article, credited by name.
 *   • The page's own value is the grouping and the Scorebug hook, not the text.
 *
 * If this is ever meant to carry real organic traffic, the thing that earns it
 * is original writing — your own take on the game — not more of someone else's.
 */

type Article = {
  id: string
  title: string
  source: string | null
  url: string | null
  league: string | null
  team_acronym: string | null
  published_at: string | null
}

/**
 * Read the shared cache with the anon key.
 *
 * This works because `news_cache` is anonymously readable — verified against the
 * live project, not assumed. If RLS is ever tightened, this returns an empty
 * array and the page renders its empty state rather than throwing.
 *
 * Column selection is explicit and EXCLUDES description/summary_tldr, so the
 * excerpt text cannot reach this page even by accident later.
 */
async function getHeadlines(): Promise<Article[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return []
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/news_cache` +
        `?select=id,title,source,url,league,team_acronym,published_at` +
        `&order=published_at.desc&limit=60`,
      {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
        next: { revalidate: 900 },
      },
    )
    if (!res.ok) return []
    const rows = (await res.json()) as Article[]
    return Array.isArray(rows) ? rows.filter(r => r.title && r.url) : []
  } catch {
    return []
  }
}


export default async function NewsPage() {
  const articles = await getHeadlines()

  return (
    <>
      <Breadcrumbs trail={[{ name: 'Scorebug', url: SITE }, { name: 'News' }]} />
      <SiteHeader />
      <main className="lit-gold floodlights relative overflow-hidden">
      <div className="relative z-10 mx-auto max-w-4xl px-5 pb-24 pt-14">
        <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'News' }]} />
        <p className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[11px] font-black uppercase" style={{ color: '#E5B53C' }}>
          <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#E5B53C', boxShadow: '0 0 8px #E5B53C' }} />
          The news desk
        </p>

        <h1 className="headline headline-display mt-7 text-[3.2rem] text-white sm:text-[4rem]">
          The Wire
        </h1>
        <p className="mt-6 max-w-[36rem] text-lg leading-relaxed text-ink-2">
          Headlines from around the leagues, each one linking straight to the outlet
          that wrote it. In the app, The Wire follows the teams in your Starting Lineup.
        </p>

        {articles.length === 0 ? (
          <div className="glass-card mt-12 rounded-2xl px-7 py-12 text-center">
            <h2 className="headline text-3xl text-white">Nothing on the wire</h2>
            <p className="mx-auto mt-3 max-w-sm text-[14.5px] leading-relaxed text-ink-2">
              The desk is quiet right now. Try again shortly.
            </p>
          </div>
        ) : (
          /* The interactive feed (league chips + Latest/By-league sort). Articles
             are fetched here on the server, so every headline and credit link is
             in the initial HTML; WireFeed only filters and reorders them. The
             ticket units and the app CTA live inside it. */
          <WireFeed articles={articles} />
        )}

        <div className="glass-card mt-14 rounded-2xl p-7 text-center">
          <h2 className="headline text-2xl text-ink sm:text-3xl">Read it, then log it</h2>
          <p className="mx-auto mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-2">
            Scorebug keeps the news for the teams you follow next to the games you
            rated, so the story and the scoreline sit in the same place.
          </p>
          <a href={WEB_APP} className="enamel-red mt-6 inline-block rounded-2xl px-7 py-3.5 text-[15px] font-black text-white transition active:scale-[0.98]">
            Open the web app
          </a>
        </div>

        <p className="mt-10 text-center text-[12px] leading-relaxed text-ink-3">
          Headlines are aggregated and link to the original publisher. All rights belong
          to the outlets that wrote them. <Link href="/terms" className="underline hover:text-ink-2">Terms</Link>
        </p>
      </div>
      </main>
      <SiteFooter />
    </>
  )
}

