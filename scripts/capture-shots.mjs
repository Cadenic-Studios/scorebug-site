/**
 * capture-shots.mjs — real, authenticated screenshots of the live app, framed
 * into the marketing plates in public/shots/.
 *
 * ─── WHY THIS EXISTS ────────────────────────────────────────────────────────
 * The shipped artwork was AI-rendered with text baked into the pixels, which is
 * exactly where it went wrong: hero.png and chronicle.png read "Weshington
 * Commanders" and wire.png read "THIE WIRE". None of that is fixable in CSS —
 * app/page.tsx had to crop the hero to hide it. Screenshots of the real product
 * cannot misspell anything, because every word in them is rendered by the app.
 *
 * ─── HOW IT RUNS ────────────────────────────────────────────────────────────
 * headless: false, so a real Chrome window opens and YOU log in by hand. The
 * script never sees or handles a password: it polls for a signed-in DOM and
 * waits (up to 15 minutes) until it appears. The browser profile is persisted
 * under .cache/, so a second run usually needs no login at all.
 *
 * ─── COMPOSITING WITHOUT AN IMAGE LIBRARY ───────────────────────────────────
 * `sharp` is not installed here and is a heavy native dependency to add for
 * three files. Since a browser is already open, the frames are composed as HTML
 * — device bezel, glow and floor reflection are all CSS — and screenshotted at
 * the exact target dimensions. That also keeps the plate design editable here
 * rather than locked inside a binary.
 *
 *   node scripts/capture-shots.mjs            # capture + compose
 *   node scripts/capture-shots.mjs --compose  # recompose from cached raws
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const RAW = path.join(ROOT, '.cache', 'shots-raw')
const OUT = path.join(ROOT, 'public', 'shots')
const PROFILE = path.join(ROOT, '.cache', 'shots-profile')
const APP = 'https://app.getscorebug.app'

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
].find(p => fs.existsSync(p))
if (!CHROME) { console.error('Chrome not found'); process.exit(1) }

/* 390x844 is the iPhone 14/15 logical viewport and the size the app's mobile
   layout is tuned for. DPR 3 gives a 1170x2532 raw capture — enough that the
   framed plate is still above 1x at the 1440px target. */
const VW = 390, VH = 844, DPR = 3

/** route -> raw filename. The Wire lives at /the-news in the app. */
const SCREENS = [
  { name: 'home', route: '/', label: 'Home' },
  { name: 'slate', route: '/the-slate', label: 'The Slate' },
  { name: 'wire', route: '/the-news', label: 'The Wire' },
  /* For chronicle.png. The FeatureRow this fills is about the core loop —
     grade a finished game and say why — so Home was the wrong screen for it:
     the section's own copy describes a rating dial the picture did not show.
     /the-log is the front door to that loop. */
  {
    name: 'log', route: '/the-log', label: 'The Log',
    /* Every one of these routes fetches its data AFTER mount, so "the document
       loaded" is not "the screen is worth photographing". The Log is the one
       where that gap is visible: the first capture caught it on "Loading
       games..." with the Guard the Net filler showing, which is what the screen
       renders while it has nothing yet. Wait for the picker heading instead. */
    ready: 'Ready to Chronicle',
  },
]

/**
 * Target plates. Dimensions are copied from the files being replaced so the
 * swap needs no code change — see public/shots/README.md.
 */
const PLATES = [
  { file: 'hero.png', w: 1440, h: 1645, kind: 'duo', shots: ['home', 'slate'], accent: '#F85149' },
  /* chronicle.png is shown UNCROPPED in a FeatureRow, beside slate.png and
     vault.png — full-bleed AI posters whose artwork runs to every edge. At the
     default 0.68 the handset left ~220px of dead plate above and below it and
     read as visibly smaller than its neighbours. 0.78 fills the row without
     pushing the device past the frame. */
  { file: 'chronicle.png', w: 1440, h: 2559, kind: 'single', shots: ['log'], accent: '#F85149', scale: 0.78 },
  /* wire.png feeds a FeatureCard, which crops the plate to 4:5 — so only the
     middle 941x1176 of this 941x1672 file is ever seen on the page. At the
     default 0.68 scale the handset is 640x1385 and its bezels fall outside that
     window entirely, leaving a bare screenshot sitting between two AI product
     renders of angled phones. `scale` shrinks the device until the WHOLE of it,
     bezel included, survives the crop, and `rotate` gives it the same slight
     tilt its neighbours have. If FeatureCard's 4:5 ever changes, recheck this. */
  { file: 'wire.png', w: 941, h: 1672, kind: 'single', shots: ['wire'], accent: '#D29922', scale: 0.54, rotate: -3 },
]

const sleep = ms => new Promise(r => setTimeout(r, ms))
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a)

/** Signed in, on a real screen, with content painted. */
async function isAuthed(page) {
  try {
    return await page.evaluate(() => {
      if (location.pathname.startsWith('/auth')) return false
      if (!document.querySelector('nav.mobile-nav')) return false
      return (document.body.innerText || '').trim().length > 400
    })
  } catch { return false }
}

/**
 * Settle a route: top of page, fonts done, lazy images decoded.
 *
 * EVERY WAIT IN HERE IS BOUNDED, and that is the whole point. The first version
 * awaited `Promise.all` over every incomplete <img> with no timeout, which is
 * fine until one image never resolves and never errors — a lazy thumbnail whose
 * request is still hanging. On The Wire that deadlocked the page's execution
 * context and Puppeteer eventually killed the run with
 * `Runtime.callFunctionOn timed out`, ten seconds after two screens had already
 * captured cleanly. A screenshot is worth having slightly early; it is never
 * worth hanging the whole capture for.
 */
/**
 * Poll until a screen has actually rendered its content.
 *
 * Returns false rather than throwing on timeout — a slightly-early screenshot
 * is a judgement call for whoever looks at it, not a reason to lose the run.
 */
async function waitForReady(page, needle, ms = 30000) {
  if (!needle) return true
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    const hit = await page.evaluate(
      t => (document.body.innerText || '').includes(t), needle,
    ).catch(() => false)
    if (hit) return true
    await sleep(750)
  }
  return false
}

async function settle(page) {
  const bounded = (fn, ms) => Promise.race([
    page.evaluate(fn).catch(() => null),
    sleep(ms),
  ])
  await bounded(() => window.scrollTo(0, 0), 3000)
  await bounded(() => document.fonts && document.fonts.ready, 6000)
  await bounded(async () => {
    // Bounded inside the page too, so a stalled image cannot pin the context
    // even if the outer race gives up on it.
    await Promise.race([
      Promise.all(Array.from(document.images)
        .filter(i => !i.complete)
        .map(i => new Promise(r => { i.onload = i.onerror = r }))),
      new Promise(r => setTimeout(r, 5000)),
    ])
  }, 7000)
  await sleep(1400)
}

async function capture() {
  fs.mkdirSync(RAW, { recursive: true })
  fs.mkdirSync(PROFILE, { recursive: true })

  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: false,
    userDataDir: PROFILE,
    /* The default is 30s. The Wire is the heaviest screen in the app and a
       cold render of it can outrun that on a busy machine; a longer ceiling
       costs nothing when nothing is stuck. */
    protocolTimeout: 180000,
    /* null = the viewport follows the real window, and NO CDP device emulation
       is installed. That matters for the login step below — see the comment
       there. --window-position is explicit because Chrome otherwise opened this
       window unmapped, off where nothing could raise it. */
    defaultViewport: null,
    args: [
      `--window-size=${VW + 130},${VH + 160}`,
      '--window-position=200,80',
      '--hide-scrollbars',
    ],
  })
  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()
  await page.goto(APP, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.bringToFront()

  console.log('')
  console.log('='.repeat(66))
  console.log('  A Chrome window is open at ' + APP)
  console.log('  LOG IN THERE NOW. Nothing is typed for you and no password is')
  console.log('  read by this script - it only watches for a signed-in page.')
  console.log('  Capture starts on its own the moment you are in.')
  console.log('='.repeat(66))
  console.log('')

  const deadline = Date.now() + 15 * 60 * 1000
  let authed = false
  while (Date.now() < deadline) {
    if (await isAuthed(page)) { authed = true; break }
    await sleep(2000)
  }
  if (!authed) { await browser.close(); throw new Error('Timed out waiting for login (15 min).') }

  log('signed in - switching to mobile emulation and capturing')

  /* ─── EMULATION GOES ON *AFTER* LOGIN, NEVER BEFORE ────────────────────────
     setViewport with isMobile/hasTouch installs CDP touch emulation, and from
     that moment Chrome routes pointer input as touch events. In a headed window
     that reads as a completely frozen page: the login form paints correctly,
     but clicks and typing land nowhere and there is no error to explain it.
     Doing this only once the fan is already signed in keeps the manual step on
     ordinary mouse input, and the capture still gets the real mobile layout. */
  await page.setViewport({
    width: VW, height: VH, deviceScaleFactor: DPR, isMobile: true, hasTouch: true,
  })
  await sleep(2500)

  const failed = []
  for (const s of SCREENS) {
    // Isolated per screen. Losing The Wire should not also throw away Home and
    // The Slate, which is exactly what happened on the first run.
    try {
      await page.goto(APP + s.route, { waitUntil: 'domcontentloaded', timeout: 60000 })
      if (s.ready && !(await waitForReady(page, s.ready))) {
        log(`  warning: ${s.label} never showed "${s.ready}" - shooting anyway`)
      }
      await settle(page)
      const file = path.join(RAW, `${s.name}.png`)
      await page.screenshot({ path: file, captureBeyondViewport: false })
      log(`captured ${s.label} -> ${path.basename(file)}`)
    } catch (e) {
      failed.push(s.label)
      log(`FAILED ${s.label}: ${String(e.message).split(/\r?\n/)[0]}`)
    }
  }
  if (failed.length) log(`incomplete: ${failed.join(', ')}`)

  await browser.close()
}

/* ─── The plate ───────────────────────────────────────────────────────────── */

const b64 = f => fs.readFileSync(path.join(RAW, `${f}.png`)).toString('base64')

/**
 * One phone. Bezel, screen, specular edge and a fading floor reflection — the
 * same cues the AI plates used, so the replacement drops into the existing
 * layout without the page looking re-skinned.
 */
function phone({ shot, w, rotate = 0, dx = 0, dy = 0, z = 1 }) {
  const h = Math.round(w * (VH / VW))
  const r = Math.round(w * 0.085)
  const pad = Math.round(w * 0.011)
  return `
  <div class="ph" style="width:${w}px;height:${h}px;z-index:${z};transform:translate(${dx}px,${dy}px) rotate(${rotate}deg);">
    <div class="bez" style="border-radius:${r}px;padding:${pad}px">
      <div class="scr" style="border-radius:${r - pad}px">
        <img src="data:image/png;base64,${b64(shot)}" alt="">
      </div>
    </div>
    <div class="refl" style="border-radius:${r}px;height:${Math.round(h * 0.16)}px">
      <img src="data:image/png;base64,${b64(shot)}" alt="">
    </div>
  </div>`
}

function plateHtml(plate) {
  const { w, h, kind, shots, accent } = plate
  let inner
  if (kind === 'duo') {
    /* Two handsets, the back one raised and rotated — reads as a product shot
       rather than two flat screenshots side by side.

       SIZED SO NEITHER PHONE CLIPS THE PLATE, which the first pass got wrong:
       rotation grows a box well past its own width. A w x h element turned by
       t degrees occupies w*cos(t) + h*sin(t) horizontally, and these phones are
       ~2.2x taller than they are wide, so the height term dominates — at 6deg a
       523px phone needs 638px of room. The back handset ran off the right edge
       and lost its bottom bezel. Widths and offsets below keep both rotated
       bounding boxes inside 1440 x 1645 with room to spare; re-check that sum
       before changing any of them. */
    const pw = Math.round(w * 0.369)          // front handset, ~531px at 1440
    inner = `<div class="duo">
      ${phone({ shot: shots[1], w: Math.round(pw * 0.92), rotate: 4, dx: Math.round(pw * 0.55), dy: Math.round(h * 0.024), z: 1 })}
      ${phone({ shot: shots[0], w: pw, rotate: -4, dx: Math.round(-pw * 0.36), dy: 0, z: 2 })}
    </div>`
  } else {
    const scale = plate.scale ?? 0.68
    inner = `<div class="solo">${phone({ shot: shots[0], w: Math.round(w * scale), rotate: plate.rotate ?? 0, z: 2 })}</div>`
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{width:${w}px;height:${h}px;overflow:hidden}
    body{
      background:
        radial-gradient(58% 45% at 50% 34%, ${accent}2E 0%, transparent 68%),
        radial-gradient(90% 70% at 50% 108%, rgba(255,255,255,0.05) 0%, transparent 60%),
        linear-gradient(180deg,#0B0D10 0%,#07090C 55%,#050609 100%);
      display:flex;align-items:center;justify-content:center;
    }
    .duo,.solo{position:relative;display:flex;align-items:center;justify-content:center}
    .ph{position:relative;flex:0 0 auto}
    .duo .ph{position:absolute}
    .bez{
      width:100%;height:100%;
      background:linear-gradient(155deg,#3A4048 0%,#15181D 26%,#0A0C10 60%,#22262C 100%);
      box-shadow:
        0 2px 1px rgba(255,255,255,0.22) inset,
        0 -2px 1px rgba(0,0,0,0.6) inset,
        0 42px 90px -18px rgba(0,0,0,0.92),
        0 10px 26px -8px rgba(0,0,0,0.75);
    }
    .scr{width:100%;height:100%;overflow:hidden;background:#000;position:relative}
    .scr img{width:100%;height:100%;object-fit:cover;object-position:top center;display:block}
    /* Specular sweep across the glass - subtle, or it reads as a smudge. */
    .scr::after{
      content:'';position:absolute;inset:0;pointer-events:none;
      background:linear-gradient(122deg,rgba(255,255,255,0.09) 0%,rgba(255,255,255,0.02) 17%,transparent 42%);
    }
    /* A floor reflection has to stay BELOW legibility. At 0.16 the flipped
       screenshot was readable - you could make out the username upside down -
       and a reflection you can read stops looking like a reflection and starts
       looking like a second, broken image. 0.07 plus a faster falloff keeps
       only the suggestion of a surface under the phone. */
    .refl{
      position:absolute;left:0;right:0;top:100%;margin-top:6px;
      overflow:hidden;opacity:0.07;transform:scaleY(-1);
      -webkit-mask-image:linear-gradient(to top,transparent 12%,#000 100%);
              mask-image:linear-gradient(to top,transparent 12%,#000 100%);
    }
    .refl img{width:100%;object-fit:cover;object-position:top center;display:block}
  </style></head><body>${inner}</body></html>`
}

async function compose() {
  for (const p of PLATES) {
    for (const s of p.shots) {
      const f = path.join(RAW, `${s}.png`)
      if (!fs.existsSync(f)) throw new Error(`missing raw capture: ${f} - run without --compose first`)
    }
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox', '--hide-scrollbars'],
  })
  for (const plate of PLATES) {
    const page = await browser.newPage()
    await page.setViewport({ width: plate.w, height: plate.h, deviceScaleFactor: 1 })
    await page.setContent(plateHtml(plate), { waitUntil: 'load' })
    await sleep(400)
    const dest = path.join(OUT, plate.file)
    await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: plate.w, height: plate.h } })
    log(`wrote ${plate.file} (${plate.w}x${plate.h}, ${(fs.statSync(dest).size / 1024).toFixed(0)} KB)`)
    await page.close()
  }
  await browser.close()
}

const composeOnly = process.argv.includes('--compose')
if (!composeOnly) await capture()
await compose()
log('done')
