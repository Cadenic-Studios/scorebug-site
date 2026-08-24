import puppeteer from 'puppeteer-core'
const base = process.argv[2] ?? 'http://localhost:3040'
const b = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--no-first-run', '--disable-gpu'] })
const pg = await b.newPage()
const failed = []
const statuses = new Map()
pg.on('requestfailed', r => failed.push(r.url().replace(base, '') + ' :: ' + (r.failure()?.errorText ?? '')))
pg.on('response', r => { const s = r.status(); if (s >= 400) statuses.set(r.url().replace(base, ''), s) })

await pg.setViewport({ width: 412, height: 900, deviceScaleFactor: 1 })
const resp = await pg.goto(base + '/the-slate', { waitUntil: 'networkidle2', timeout: 60000 })
await new Promise(r => setTimeout(r, 4000))

const info = await pg.evaluate(() => ({
  url: location.href,
  title: document.title,
  bodyChars: document.body.innerText.trim().length,
  firstText: document.body.innerText.trim().slice(0, 160).replace(/\s+/g, ' '),
  hasNextRoot: !!document.querySelector('#__next, [data-nextjs-scroll-focus-boundary], main, nav'),
  scripts: [...document.querySelectorAll('script[src]')].length,
}))
console.log('status  :', resp.status())
console.log('final   :', info.url)
console.log('title   :', info.title)
console.log('text len:', info.bodyChars)
console.log('preview :', info.firstText)
console.log('scripts :', info.scripts)
if (statuses.size) console.log('4xx/5xx :', [...statuses.entries()].slice(0, 8))
if (failed.length) console.log('failed  :', failed.slice(0, 8))
if (!statuses.size && !failed.length) console.log('no failed requests')
await pg.screenshot({ path: 'proxy.png' })
await b.close()
