import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE, WEB_APP } from '../config'
import { organizationSchema, applicationSchema, faqSchema, graph, type Faq, safeJsonLd } from '../lib/seo'
import { SiteHeader, SiteFooter, BreadcrumbNav, AppCta } from '../components/SiteChrome'
import { DISCORD_INVITE, DISCORD_BOT_INVITE, DISCORD_USER_INSTALL, DISCORD_CHANNELS, DISCORD_COMMANDS } from '../lib/discord/public'
import { signedCardUrl } from '../lib/gamepage'

/**
 * /discord — the page that catches people looking for the server.
 *
 * ─── WHY A PAGE AND NOT JUST AN INVITE LINK ─────────────────────────────────
 *
 * "<product> discord" is one of the highest-intent queries any small product
 * gets: the person already knows what you are and wants in. A bare invite URL
 * ranks for nothing — discord.gg pages are noindex and the link carries no text
 * a search engine can read. A page on our own domain ranks for the query,
 * survives an invite being regenerated, and can say what the server is FOR,
 * which is what decides whether somebody joins or bounces.
 *
 * It is also the only durable address for the server. Discord invites can
 * expire, be revoked, or be replaced; every place we print getscorebug.app/discord
 * keeps working when that happens, because only this file changes.
 *
 * ─── AND WHY IT LISTS THE COMMANDS ──────────────────────────────────────────
 *
 * Two audiences read this. A fan deciding whether to join wants to know what is
 * inside. An answer engine asked "is there a Discord bot that rates sports
 * games" wants something quotable — a named bot, a list of commands, and a
 * sentence about what each does. The commands table serves both, which is why
 * it is real content and not a screenshot.
 */

export const metadata: Metadata = {
  title: 'The Scorebug Discord — game ratings, slates and a bot that answers',
  description:
    'Join the Scorebug Discord: every night’s slate, the games fans graded highest, and a bot that '
    + 'tells you whether a game was worth watching. No gambling talk, ever.',
  alternates: { canonical: `${SITE}/discord` },
  openGraph: {
    title: 'The Scorebug Discord',
    description: 'Nightly slates, fan game ratings, and a bot that answers whether a game was worth watching.',
    url: `${SITE}/discord`,
    type: 'website',
    /* The card press renders this page's share image too, so a link to the
       Discord in a chat window unfurls as a Scorebug graphic rather than the
       site-wide og.png every other page falls back to. `t=promise` is the
       no-gambling card — the right one here, because that rule is the server's
       single most distinctive claim. */
    images: [{ url: signedCardUrl({ k: 'product', t: 'promise', size: 'wide' }), width: 1200, height: 675, alt: 'Scorebug — no odds, no spreads, no sportsbook ads' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'The Scorebug Discord',
    description: 'Nightly slates, fan game ratings, and a bot that answers whether a game was worth watching.',
    images: [signedCardUrl({ k: 'product', t: 'promise', size: 'wide' })],
  },
}

const faqs: Faq[] = [
  {
    q: 'Does Scorebug have a Discord server?',
    a: `Yes. It is open to anyone and the invite is at ${SITE}/discord. Inside you get every night's slate `
      + 'posted automatically, a channel for talking about the games, and a bot that will tell you how fans '
      + 'graded any game it knows about.',
  },
  {
    q: 'Is there a Discord bot that rates sports games?',
    a: 'Scorebug’s bot does. Run /rate with a team name and it replies with that game’s scoreline, the average '
      + 'grade out of 5.0 from fans who logged it, and how many people that is. It can also list the '
      + 'highest-graded games lately with /best, or the recent games in one league with /league.',
  },
  {
    q: 'Can I add the Scorebug bot to my own server?',
    a: `Yes, it is free and public. The add link is on ${SITE}/discord. It only ever posts in response to a `
      + 'slash command, it cannot read your messages, and it asks for one permission: to send messages.',
  },
  {
    q: 'Is there gambling talk in the Scorebug Discord?',
    a: 'No, and there will not be. No odds, no spreads, no picks, no tout links — it is the promise the whole '
      + 'product is built on and it is a rule in the server as much as it is a rule in the app.',
  },
  {
    q: 'Can I use the Scorebug bot without being a server admin?',
    a: `Yes. As well as the normal server install, Scorebug can be added to your own Discord account — the `
      + `link is on ${SITE}/discord. The commands then work in every server and DM you are in, whether or not `
      + 'the bot is in them, and the replies are visible only to you. Nobody has to approve anything.',
  },
  {
    q: 'What does the Scorebug bot do with my data?',
    a: 'Nothing, because it is not given any. It has no permission to read messages and receives only the '
      + 'command you typed. Grades come back as a total and an average — never a username, never anyone’s notes. '
      + 'There is no logging of who asked what.',
  },
]

export default function Page() {
  /* The BOT is a different application from the Scorebug app, so it gets its
     own @id rather than adding contradictory properties to the one the layout
     already publishes. Two values for one property on one node is worse than
     none — see lib/seo.ts, which exists because that mistake was made once.
     Every claim below is checkable on this page: it is free, it runs on
     Discord, and the commands listed are the commands that exist. No rating,
     no review count, no install figures. */
  const botSchema = {
    '@type': 'SoftwareApplication',
    '@id': `${SITE}/discord#bot`,
    name: 'Scorebug for Discord',
    applicationCategory: 'CommunicationApplication',
    applicationSubCategory: 'Discord bot',
    operatingSystem: 'Discord',
    url: `${SITE}/discord`,
    installUrl: DISCORD_BOT_INVITE,
    publisher: { '@id': `${SITE}/#org` },
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'CAD' },
    featureList: DISCORD_COMMANDS.map(c => `/${c.name} — ${c.what}`),
  }

  const jsonLd = graph([
    organizationSchema(['sports Discord server', 'sports game ratings', 'Discord bot for sports']),
    applicationSchema(),
    botSchema,
    faqSchema(faqs),
  ])

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <SiteHeader />

      <main id="main" className="lit-red floodlights relative overflow-hidden">
        <div className="relative z-10 mx-auto max-w-4xl px-5 pb-14 pt-14 sm:pb-20">
          <BreadcrumbNav trail={[{ name: 'Scorebug', href: '/' }, { name: 'Discord' }]} />

          <h1 className="headline mt-6 text-3xl text-ink sm:text-4xl">The Scorebug Discord</h1>

          <p className="mt-5 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            Every night’s slate, posted automatically. A room for arguing about what you just watched.
            And a bot that will tell you whether a game was worth two hours of your evening — because
            the people who watched it said so.
          </p>
          <p className="mt-3 max-w-[42rem] text-[17px] leading-relaxed text-ink-2">
            No odds, no spreads, no picks, no tout links. That is a rule in here exactly as much as it
            is a rule in the app.
          </p>

          {/* TWO calls to action, because there are two different visitors.
              One wants to join a community. The other runs a server of their own
              and wants the bot in it — and that second person is worth more,
              because every server that adds the bot is a room full of sports
              fans seeing Scorebug cards without us doing anything. The page
              previously only offered the first, and mentioned the second in an
              FAQ answer where nobody would click it. */}
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href={DISCORD_INVITE}
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-xl bg-sb-red px-5 py-3 text-[15px] font-bold text-white transition-transform hover:scale-[1.02]"
            >
              Join the server
            </a>
            <a
              href={DISCORD_BOT_INVITE}
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-5 py-3 text-[15px] font-bold text-ink transition-colors hover:bg-white/[0.08]"
            >
              Add the bot to your server
            </a>
          </div>
          <p className="mt-3 text-[13px] text-ink-3">
            Both are free. The bot needs one permission — to send messages — and it cannot read yours.
          </p>

          <section className="mt-14">
            {/* Headed as the query, not as a label. "What the bot answers" says
                nothing to a search engine; "a Discord bot that rates sports
                games" is what somebody types when they want exactly this. */}
            <h2 className="headline text-2xl text-ink">A Discord bot that rates sports games</h2>
            <div className="scroller mt-5 overflow-x-auto">
              <table className="w-full min-w-[30rem] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="border-b border-white/15">
                    <th className="pb-2 pr-4 text-[10px] font-black uppercase tracking-[0.2em] text-ink-3">Command</th>
                    <th className="pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-ink-3">What you get</th>
                  </tr>
                </thead>
                <tbody>
                  {DISCORD_COMMANDS.map(c => (
                    <tr key={c.name} className="border-b border-white/10 last:border-0">
                      <td className="py-3 pr-4 align-top font-mono text-[14px] text-ink">/{c.name}</td>
                      <td className="py-3 align-top text-ink-2">{c.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[14px] leading-relaxed text-ink-3">
              It answers only when asked. It cannot read messages, and the one permission it wants is to
              send them. Grades are shown as totals and averages — never a username, never somebody’s notes.
            </p>
          </section>

          <section className="mt-14">
            <h2 className="headline text-2xl text-ink">What is in the server</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {DISCORD_CHANNELS.map(c => (
                <li key={c.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                  <p className="font-mono text-[14px] text-ink">#{c.name}</p>
                  <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{c.what}</p>
                </li>
              ))}
            </ul>
          </section>

          {/* THE SERVER-OWNER PATH, WRITTEN OUT.
              The add link sat in a button and an FAQ answer, which is enough
              for somebody already sold and not enough for somebody deciding.
              Three steps, no screenshots, and the honest permission line — a
              moderator's first question is always what it can see. The link to
              /game at the end is the only internal link on this page that a
              crawler can follow into the per-game set, which is the largest
              thing on the site and otherwise reachable only from the nav. */}
          <section className="mt-14">
            <h2 className="headline text-2xl text-ink">Put it in your own server</h2>
            <ol className="mt-5 space-y-4 text-[15px] leading-relaxed text-ink-2">
              <li className="flex gap-3">
                <span className="mt-[2px] font-mono text-[13px] font-bold text-sb-red">01</span>
                <span>
                  Open the <a href={DISCORD_BOT_INVITE} rel="noopener" className="text-ink underline decoration-white/30 underline-offset-4 hover:decoration-white">add link</a>{' '}
                  and pick the server. You need Manage Server there.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-[2px] font-mono text-[13px] font-bold text-sb-red">02</span>
                <span>
                  Approve the one permission it asks for — Send Messages. It does not request message
                  history, members, or anything else, so there is nothing else to weigh up.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="mt-[2px] font-mono text-[13px] font-bold text-sb-red">03</span>
                <span>
                  Type <span className="font-mono text-[14px] text-ink">/rate</span> in any channel. The commands
                  appear the moment it joins; there is nothing to configure.
                </span>
              </li>
            </ol>
            {/* The install that needs nobody's permission. Worth its own
                paragraph rather than a footnote: most people who want this bot
                are not admins anywhere, and until now the page had nothing for
                them but "ask someone with Manage Server". */}
            <p className="mt-6 text-[15px] leading-relaxed text-ink-2">
              Not an admin anywhere?{' '}
              <a href={DISCORD_USER_INSTALL} rel="noopener" className="text-ink underline decoration-white/30 underline-offset-4 hover:decoration-white">Add it to your account instead</a>{' '}
              and the commands follow you into every server and DM you are in — no permission needed from
              anybody, and the answers are visible only to you.
            </p>
            <p className="mt-5 text-[14px] leading-relaxed text-ink-3">
              Everything the bot reports is public on the site too — every graded game has{' '}
              <Link href="/game" className="text-ink-2 underline decoration-white/25 underline-offset-4 hover:decoration-white">its own page</Link>{' '}
              with the same scoreline, rating and fan grade.
            </p>
          </section>

          <section className="mt-14">
            <h2 className="headline text-2xl text-ink">Questions</h2>
            <dl className="mt-5 space-y-6">
              {faqs.map(f => (
                <div key={f.q}>
                  <dt className="text-[16px] font-semibold text-ink">{f.q}</dt>
                  <dd className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{f.a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <div className="mt-14">
            <AppCta line="Start logging the games you watch" />
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  )
}
