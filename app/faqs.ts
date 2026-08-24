/**
 * FAQ copy lives HERE, once — the visible accordion on the page and the
 * FAQPage JSON-LD in the layout are generated from this same array, so the
 * structured data can never drift from what a human actually reads. (Answer
 * engines cross-check; mismatched schema is worse than none.)
 *
 * Every answer below was fact-checked against the app source. Do not add a
 * claim here without confirming it in the product first — this file is the
 * single most quotable text on the site, because answer engines lift it
 * verbatim.
 */
export const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is Scorebug?',
    a: 'Scorebug is a social sports-logging app — the ultimate fan log, or the Letterboxd for sports. You track live scores, rate the games you watch out of 5.0, write your own takes, and build a permanent archive of your lifetime in sports.',
  },
  {
    q: 'How do I track and log the sports games I watch?',
    a: 'Open The Slate to see every game across your leagues, tap a game once it is final, and chronicle it: a rating from 1.0 to 5.0 in half-steps, how you watched (broadcast, at the venue, out watching, or a watch party), your notes, and your own photos. A one-tap "+" button lets you search any team and log straight from its recent finals.',
  },
  {
    q: 'Which sports and leagues does Scorebug support?',
    a: 'Fifteen leagues: the NHL, NFL, NBA, MLB, CFL, NCAA football and NCAA men’s Division I basketball, MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League, and Formula 1. Full standings, rosters and player stats are available for the NHL, NFL, NBA, MLB and NCAA; schedules, live scores and team pages for the CFL, MLS and the European leagues; and race schedules, status and podiums for Formula 1.',
  },
  {
    q: 'Can I log games I watched years ago?',
    a: 'Yes. The Time Machine lets you chronicle any finished game back to 2002 — pick the date, find the final, and it counts toward your archive just like a game you logged live.',
  },
  {
    q: 'Are my photos and notes private?',
    a: 'Photos and ticket stubs are always private — they live in your Vault only and are never shared to the public feed. Your rating and written review are a per-game choice: you decide whether each one is posted to The Bleachers or kept to yourself.',
  },
  {
    q: 'Is Scorebug free?',
    a: 'Scorebug is free to use, on the web and on Android. The Front Office is an optional in-app subscription that adds the full Analytics Desk, an extended lineup of up to 25 teams, an unlimited Docket and Clippings, Vault export, 20 accent themes and an app with no ads. In the United States it is $3.99 USD per month or $19.99 USD per year; in Canada it is $5 CAD per month or $20 CAD per year — about $1.67 a month either way. You can cancel any time, and the store confirms your local price at checkout.',
  },
  {
    q: 'What platforms is Scorebug available on?',
    a: 'Scorebug runs today in any browser at getscorebug.app — the full app, with no install. The Android build is in closed testing right now; join the waitlist on this page and we will send an invite as spots open. An iOS version is planned after Android.',
  },
]
