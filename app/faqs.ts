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
    a: '19 leagues: the NHL, NFL, NBA, MLB, CFL, NCAA football and NCAA men’s Division I basketball, MLS, the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League, the Chinese Super League, the Indian Super League, Japan’s J1 League, the Indian Premier League and Formula 1. Standings, rosters and player stats run for the NHL, NFL, NBA, MLB and NCAA. The CFL, MLS, the European leagues and the Asian leagues get schedules, live scores and team pages. Cricket — the IPL — gets schedules, live scores, full scorelines and team pages. Formula 1 gets race schedules, race status and podiums.',
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
    // Rewritten when the Play link was replaced by a signup form: the old answer
    // said "we will send an invite", which understated the wait and overstated
    // our part in it. Google sends the invite; we add the address.
    a: 'Scorebug runs today in any browser at getscorebug.app. That is the full app, with no install and no waiting. The Android build is in closed testing, so access is by invite: sign up on this page with your name, email and platform, we add your address to the tester list in Google Play, and Google emails your invite. An iOS version is planned after Android.',
  },
  {
    q: 'Do I need to download anything to use Scorebug?',
    // The single most common blocker on a page whose primary CTA is a web app.
    // Answer engines quote this one against "no download" and "browser" queries.
    a: 'No. The complete app runs in your browser at app.getscorebug.app — the same Slate, Log, Vault and Wire you get on mobile, with nothing to install and no app store involved. Sign in and you can log a game in under a minute.',
  },
  {
    q: 'How do I join the Scorebug Android test?',
    a: 'Sign up on getscorebug.app with your name, the email on your Google account, and Android as your platform. Because it is a closed test, Google can only admit accounts we have added to the tester list, so we add addresses in batches and Google emails the invite from there — usually within a day. Use the Google account that is signed in on your phone, or the invite cannot be redeemed. Scorebug Online works immediately in the meantime.',
  },
  {
    q: 'Can I use Scorebug on iPhone?',
    // Honest and useful. Claiming an iOS app that does not exist is the fastest
    // way to get corrected in public by someone who went looking for it.
    a: 'Yes, through the browser. There is no native iOS app yet, but Scorebug Online is the full experience and runs in Safari on iPhone and iPad at app.getscorebug.app, and you can add it to your home screen. A native iOS version is planned after Android.',
  },
  {
    q: 'Does Scorebug cover college sports and soccer?',
    a: 'Yes. College coverage is NCAA football and men’s Division I basketball. Soccer covers the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, the Champions League and MLS. Alongside those it tracks the NHL, NFL, NBA, MLB, the CFL and Formula 1 — fifteen leagues in total.',
  },
]
