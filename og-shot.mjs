// TEMP: renders og.html -> public/og.png. Deleted after use.
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--no-first-run', '--disable-gpu'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await page.goto('file:///C:/Users/wyatt/Documents/scorebug-site/og.html', { waitUntil: 'networkidle0' })
await page.evaluate(() => document.fonts.ready)
await new Promise(r => setTimeout(r, 900))
await page.screenshot({ path: 'public/og.png' })
await browser.close()
console.log('og.png written')
