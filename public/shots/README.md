# Marketing artwork

Every image the landing page shows lives here. `app/page.tsx` references them by
filename, so **replacing a file is the whole swap** — no code change needed.

## The slots

| File | Where it appears | Shipped artwork |
|---|---|---|
| `hero.png` | Hero, right of the H1 | **REAL SCREENSHOT**, 1440×1645 — Home + The Slate, two handsets |
| `chronicle.png` | "Rate & chronicle" row | **REAL SCREENSHOT**, 1440×2559 — The Log |
| `slate.png` | "The Slate" row | Poster, 1080×1920 |
| `vault.png` | "The Vault" row | Poster, 1080×1920 |
| `front-office.png` | Gold membership section | Poster, 1080×1920 (cropped past its lockup) |
| `wire.png` | Three-up card | **REAL SCREENSHOT**, 941×1672 — The Wire |
| `bleachers.png` | Three-up card | Poster, 1080×1920 |
| `franchise.png` | Three-up card | Poster, 1080×1920 |

## Dropping in the Play Store graphics

The Play Store set maps straight onto six of these — save each over the matching
filename, keep the `.png` extension, and rebuild:

- "CHRONICLE EVERY GAME." → `hero.png`
- "NEVER MISS A MATCHUP." → `slate.png`
- "YOUR SPORTS. YOUR RECORD." → `vault.png`
- "UNLOCK THE FRONT OFFICE." → `front-office.png`
- "JOIN THE CROWD." → `bleachers.png`
- "TRACK YOUR TEAMS." → `franchise.png`

`chronicle.png` and `wire.png` have no Play Store counterpart.

## Three of these are real screenshots now

`hero.png`, `chronicle.png` and `wire.png` are no longer AI artwork. They are
captures of the running app, framed by `scripts/capture-shots.mjs`:

```
node scripts/capture-shots.mjs            # capture + compose
node scripts/capture-shots.mjs --compose  # recompose from cached raws
```

**Why they were replaced.** The AI plates had text baked into the pixels, and
the text was wrong: `hero.png` and `chronicle.png` read "Weshington Commanders",
`wire.png` read "THIE WIRE". None of that is fixable in CSS — `app/page.tsx` had
to crop the hero to hide it, and that crop is now gone. A screenshot of the real
product cannot misspell anything, because every word in it is rendered by the
app. (`vault.png` was checked at 3x and reads "Washington" correctly; the five
remaining plates are still the shipped artwork.)

**The script opens a visible Chrome window and waits for you to log in.** It
never handles a password — it polls for a signed-in DOM. The profile persists
under `.cache/`, so only the first run asks. Two things in there are load-bearing
and commented at length: device emulation is applied only AFTER login (turning
it on first makes the login form silently ignore every click), and every wait
during capture is bounded (an unbounded image wait deadlocked The Wire).

**Composition is HTML, not an image library.** `sharp` is not installed and is a
heavy native dependency for three files; a browser is already open, so the bezel,
glow and floor reflection are CSS and the plate is screenshotted at the exact
target size. Per-plate `scale` and `rotate` exist because two slots are cropped
downstream — see the comments on `PLATES`.

**Re-shooting changes the content.** These captures show real fixtures, real
scores and real ESPN headlines from the day they were taken, plus the signed-in
account's own username and avatar. That is a feature for credibility and a
liability for dated screenshots; re-run the script when the artwork starts to
look stale.

## Two things the page does for you

**Aspect is handled.** `Showcase` frames every plate with `object-cover`, so a
replacement of a different height is *cropped*, never squashed. If a swap crops
something important, adjust that slot's `objectPosition` in `app/page.tsx`.

**Duplicate headlines are cropped out.** The hero and the Front Office section
set their headline in real HTML, and the Play Store versions of those two
graphics set the *same words* in the artwork. Both slots are therefore cropped
to the device area (`aspect` + `objectPosition` in `app/page.tsx`). The other
slots keep their full poster, because their campaign line differs from the
heading beside it and the two read as caption and title.

## Housekeeping that matters

**Keep sources at or under 1440px wide.** The originals arrived at 4322×7680
(~7 MB each). They are displayed at ~470 CSS px, so 1440 is already 3x DPR;
the oversized files only cost build time, first-request optimizer latency and
repo weight. Downsampling the four large ones took the folder from 36 MB to
9 MB with no visible difference. `prep-shots.mjs` in the project root did this
and can be re-run after any future drop.

**The Front Office artwork has USD pricing baked in** — `$3.99 / month` and
`$19.99/yr` are part of the image, so a Canadian visitor sees US figures inside
the phone while the HTML beside it states both currencies. If that bothers you,
re-export that graphic with the price panel cropped out or made currency-neutral;
nothing in the page depends on those numbers being visible.

**No trademarked marks.** The app renders Broadcast Shield generic crests rather
than league logos. Any replacement artwork should hold that line.
