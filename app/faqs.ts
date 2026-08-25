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
    // One positioning, not two. The Letterboxd line gets its own short sentence
    // because that is the sentence an answer engine will lift; hedged inside a
    // longer clause it comes out of the machine as a fragment.
    a: 'Scorebug is a social sports-logging app. It is Letterboxd for sports. You rate the games you watch out of 5.0 and write your own take on them. Every game you log stays in your Vault.',
  },
  {
    q: 'How do I track and log the sports games I watch?',
    a: 'Open The Slate to see every game across your leagues. Tap a game once it is final and chronicle it: a rating from 1.0 to 5.0 in half-steps, how you watched (broadcast, at the venue, out watching, or a watch party), your notes and your own photos. The "+" button searches any team and logs straight from its recent finals.',
  },
  {
    q: 'Which sports and leagues does Scorebug support?',
    a: '15 leagues: the NHL, NFL, NBA, MLB, CFL, NCAA football and NCAA men’s Division I basketball, MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League and Formula 1. Standings, rosters and player stats run for the NHL, NFL, NBA, MLB and NCAA. The CFL, MLS and the European leagues get schedules, live scores and team pages. Formula 1 gets race schedules, race status and podiums.',
  },
  {
    q: 'Can I log games I watched years ago?',
    a: 'Yes. The Time Machine reaches back to the 2002 season. Pick the date and find the final, and it counts toward your archive just like a game you logged live.',
  },
  {
    q: 'Are my photos and notes private?',
    // Two facts, said once each. The old version stated the privacy fact three
    // ways in one sentence, which reads as protesting rather than reporting.
    a: 'Photos and ticket stubs are always private. They stay in your Vault. Your rating and written review are a per-game choice: you decide whether each one is posted to The Bleachers or kept to yourself.',
  },
  {
    q: 'Is Scorebug free?',
    a: 'Scorebug is free to use, on the web and on Android. The Front Office is an optional subscription, bought inside the Android app, that raises the Starting Lineup from 5 teams to 25 and lifts the caps on the Docket and Clippings. It also adds the full Analytics Desk, Vault export, 20 accent themes and an app with no ads. In the United States it is $3.99 USD a month or $19.99 USD a year. In Canada it is $5 CAD a month or $20 CAD a year. You can cancel any time, and the store confirms your local price at checkout.',
  },
  {
    q: 'What platforms is Scorebug available on?',
    a: 'Scorebug runs today in any browser at getscorebug.app. That is the full app, with no install. The Android build is in closed testing right now; join the waitlist on this page and we will send an invite as spots open. An iOS version is planned after Android.',
  },
]
