import { LEAGUES, LEAGUE_COUNT } from '../leagues'

/**
 * The league badge bar, directly under the hero call to action.
 *
 * ─── WHY IT IS HERE AND NOT IN A FEATURE SECTION ────────────────────────────
 * "Which sports does this actually cover" is the first question a visitor has
 * and the one the page previously answered a full screen too late: the hero
 * said only "15 leagues", and the names appeared as prose bullets beside the
 * Slate artwork, roughly 2,000px down. A fan who came for the CFL or Ligue 1
 * had to take it on faith or leave.
 *
 * ─── WHY IT IS TEXT, NOT LOGOS ──────────────────────────────────────────────
 * Two reasons, and the second is the important one.
 *
 * 1. League marks are trademarks. Scorebug does not license the NFL shield or
 *    the Premier League lion, and the app itself goes to real lengths to avoid
 *    exactly this — the whole Broadcast Shield crest system exists so the
 *    product never ships a club's registered mark. A marketing page that plasters
 *    fifteen of them would undo that in one scroll.
 * 2. Fifteen league names in crawlable text above the fold is the single best
 *    thing this page can do for "does X support the CFL" style queries, from
 *    both search engines and answer engines. An image carries none of that, and
 *    the `title`/`aria-label` here carry the spelled-out league name so the
 *    short badge label and the full name are both indexable.
 *
 * ─── WHY IT DOES NOT ANIMATE ────────────────────────────────────────────────
 * A marquee was the obvious read of "ticker", and it is the wrong build: an
 * auto-scrolling strip means a visitor must WAIT to find out whether their
 * league is covered, which is the opposite of the two-second brief. Every badge
 * is on screen at once at desktop width, and the row scrolls under the thumb on
 * a phone. No animation also means nothing to suppress for reduced-motion and
 * no compositor layer for a decorative loop.
 */
export default function LeagueBar({ className = '' }: { className?: string }) {
  return (
    <section
      aria-labelledby="league-bar-heading"
      className={`league-bar relative rounded-2xl px-4 py-4 sm:px-5 ${className}`}
    >
      <h2 id="league-bar-heading" className="sr-only">
        Leagues you can track and log in Scorebug
      </h2>

      <p className="mb-3 text-[10px] font-black uppercase tracking-[0.22em] text-ink-3">
        {LEAGUE_COUNT} leagues, one logbook
      </p>

      {/* Scrolls horizontally on a phone rather than wrapping to four rows and
          pushing the fold down. `-mx-4 px-4` lets the row bleed to the panel
          edge so a half-visible badge signals there is more to the right, which
          is what makes a scroll region discoverable without a scrollbar. */}
      <ul className="league-bar__row -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:pb-0">
        {LEAGUES.map(l => (
          <li key={l.id} className="flex-shrink-0">
            <span
              className="league-chip inline-flex items-center gap-1.5 rounded-lg py-1.5 pl-2 pr-2.5 text-[12px] font-bold text-ink-2"
              title={l.full}
              /* The full name is what a screen reader announces and what an
                 answer engine is most likely to match. The visible label stays
                 short so fifteen of them fit. */
              aria-label={`${l.full}, ${l.sport}`}
              style={{ ['--league' as string]: l.color }}
            >
              <span aria-hidden className="league-chip__dot" />
              {l.label}
            </span>
          </li>
        ))}
      </ul>

      {/* ── THE LIST IS NOT FINISHED, AND SAYING SO IS THE POINT ─────────
          A bare list of leagues answers "is my sport in here" with yes or no,
          and a no reads as a closed door. It is not one — the Chinese Super
          League, the Indian Super League, J.League and the IPL are all in the
          row above precisely because the app is not built for one country's
          fans. One line turns a miss into a "not yet".

          NO DATES AND NO NAMED LEAGUES. A roadmap on a marketing page becomes a
          promise the moment somebody screenshots it, and a league that then
          slips looks like a broken one. "As fast as we can do them properly" is
          the honest shape of the commitment, and the mail link is a real
          inbox — the same one the footer and the support pages use. */}
      <p className="mt-3.5 max-w-[46rem] text-[12.5px] leading-relaxed text-ink-2">
        <span className="font-bold text-ink">And we are not done.</span>{' '}
        New leagues get added as fast as we can do them properly — crests,
        colours and history included. Wherever you watch from, your game belongs
        in here too; if yours is missing,{' '}
        <a
          href="mailto:hello@getscorebug.app?subject=League%20request"
          className="font-semibold text-ink underline decoration-white/25 underline-offset-2 transition-colors hover:decoration-white/60"
        >
          tell us
        </a>{' '}
        and it goes on the list.
      </p>
    </section>
  )
}
