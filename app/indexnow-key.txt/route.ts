/**
 * The IndexNow ownership key, served from an environment variable so rotating
 * it is a variable change rather than a file rename. Bing, Yandex and Naver
 * read it when the engine pings a new slate page. Empty when unset: a 404 is
 * an honest answer, a placeholder key is a false one.
 */
export const dynamic = 'force-dynamic'

export function GET() {
  const key = (process.env.INDEXNOW_KEY ?? '').trim()
  if (!/^[a-f0-9]{32}$/i.test(key)) return new Response('not configured', { status: 404 })
  return new Response(key, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } })
}
