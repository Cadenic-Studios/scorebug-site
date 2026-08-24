/**
 * Asset prep for public/shots. Safe to re-run after dropping in new artwork.
 *
 *  1. Removes stray numbered duplicates left by a bulk copy.
 *  2. Downsamples anything wider than MAX_W. The plates render at ~470 CSS px,
 *     so 1440 is already >3x DPR; the 4322x7680 originals only cost build time,
 *     first-request optimizer latency and repo weight.
 *  3. Patches the baked-in USD price out of the Front Office artwork — the page
 *     states US and Canadian pricing in HTML beside it, and a hardcoded $3.99
 *     inside the phone contradicts that for a Canadian reader.
 *  4. Cuts the hero from the chronicle artwork's device pair, below its lockup,
 *     because the hero sits beside an <h1> that already says the same words.
 *
 * Steps 3 and 4 are idempotent only against the ORIGINAL artwork; re-running
 * after a fresh drop is correct, re-running twice on an already-processed file
 * is harmless but pointless.
 */
import sharp from 'sharp'
import { readdir, unlink, rename, stat } from 'node:fs/promises'
import { join } from 'node:path'

const DIR = 'public/shots'
const MAX_W = 1440
const kb = n => Math.round(n / 1024) + 'kb'
const swap = async (p, tmp) => { await unlink(p).catch(() => {}); await rename(tmp, p) }

// ── 1. stray duplicates ────────────────────────────────────────────────────
for (const f of await readdir(DIR)) {
  if (/^\d+\.png$/.test(f)) { await unlink(join(DIR, f)); console.log('removed stray', f) }
}

// ── 2. patch the price out of the Front Office artwork ─────────────────────
// Only meaningful at the original 1080x1919; the coordinates below are keyed
// to that export. A blank slice of the same panel is stretched over the price
// block, so the patch inherits the panel's own tint and the phone's tilt.
{
  const p = join(DIR, 'front-office.png')
  const m = await sharp(p).metadata()
  if (m.width === 1080 && m.height === 1919) {
    const X = 566, W = 436          // the panel's inner width on the right phone
    const CLEAN_Y = 1370, CLEAN_H = 26   // blank panel just above the divider
    const PRICE_Y = 1402, PRICE_H = 96   // "$3.99 / month" + the cancel line
    const fill = await sharp(p)
      .extract({ left: X, top: CLEAN_Y, width: W, height: CLEAN_H })
      .resize({ width: W, height: PRICE_H, fit: 'fill' })
      .blur(1.5)
      .toBuffer()
    await sharp(p)
      .composite([{ input: fill, left: X, top: PRICE_Y }])
      .png({ compressionLevel: 9 })
      .toFile(p + '.tmp')
    await swap(p, p + '.tmp')
    console.log('front-office.png — price block patched out')
  } else {
    console.log(`front-office.png — ${m.width}x${m.height}, not the original export; price patch skipped`)
  }
}

// ── 3. hero, cut from the chronicle artwork ────────────────────────────────
{
  const src = join(DIR, 'chronicle.png')
  const { width, height } = await sharp(src).metadata()
  const top = Math.round(height * 0.357)   // just below the lockup
  const out = join(DIR, 'hero.png')
  await sharp(src)
    .extract({ left: 0, top, width, height: height - top })
    .resize({ width: Math.min(width, MAX_W) })
    .png({ compressionLevel: 9 })
    .toFile(out + '.tmp')
  await swap(out, out + '.tmp')
  const m = await sharp(out).metadata()
  console.log(`hero.png — ${m.width}x${m.height} ${kb((await stat(out)).size)}`)
}

// ── 4. downsample anything oversized ───────────────────────────────────────
for (const f of await readdir(DIR)) {
  if (!f.endsWith('.png') || f === 'hero.png') continue
  const p = join(DIR, f)
  const m = await sharp(p).metadata()
  if (m.width <= MAX_W) { console.log(`${f} — ${m.width}x${m.height} left as-is`); continue }
  const before = (await stat(p)).size
  await sharp(p).resize({ width: MAX_W }).png({ compressionLevel: 9 }).toFile(p + '.tmp')
  await swap(p, p + '.tmp')
  const after = await sharp(p).metadata()
  console.log(`${f} — ${m.width}x${m.height} ${kb(before)} -> ${after.width}x${after.height} ${kb((await stat(p)).size)}`)
}
