# Marketing artwork

Every image the landing page shows lives here. `app/page.tsx` references them by
filename, so **replacing a file is the whole swap** — no code change needed.

## The slots

| File | Where it appears | Shipped artwork |
|---|---|---|
| `hero.png` | Hero, right of the H1 | **Device-only**, 1440×1645 — cut from `chronicle.png` below its lockup |
| `chronicle.png` | "Rate & chronicle" row | Poster, 1080×1920 |
| `slate.png` | "The Slate" row | Poster, 1080×1920 |
| `vault.png` | "The Vault" row | Poster, 1080×1920 |
| `front-office.png` | Gold membership section | Poster, 1080×1920 (cropped past its lockup) |
| `wire.png` | Three-up card | Poster, 1080×1920 |
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

`chronicle.png` and `wire.png` have no Play Store counterpart. Leave the shipped
artwork, or produce two more in the same style.

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
