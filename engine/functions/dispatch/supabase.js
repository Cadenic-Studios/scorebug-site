// Scorebug dispatch — what the engine reads from the product's own database.
//
// ── THE ONE RULE ────────────────────────────────────────────────────────────
//
// The engine never holds the service-role key. It calls three SECURITY DEFINER
// functions (scorebug-app/database-v54.sql) with the anon key, and each of
// them returns AGGREGATES — counts and averages over public logs by non-bot
// accounts — or, for the newsletter, only the addresses that ticked the box.
// The recipients function additionally checks a shared key stored in
// `private.app_secrets`, so the anon key alone cannot list anybody.
//
// Every reader here fails soft to null. A database that does not answer means
// "no community post today", never a post with a zero in it.
//
// ── WHY THE GATE ────────────────────────────────────────────────────────────
//
// A closed test has a few dozen accounts. "Community grade 4.5 from 2 logs" is
// a sentence that tells every reader exactly how small the product is. So a
// community figure is only ever posted when a single game has at least
// `minLogs` logs — ten by default, set in dispatch/settings — and until then
// the beat simply does not fire.

import { LEAGUE_BY_ID } from './leagues.js';

export function supabaseClient({ url, anonKey, fetchImpl = fetch, log = () => {} }) {
  if (!url || !anonKey) return null;
  const base = String(url).replace(/\/+$/, '');
  async function rpc(name, args = {}, { key = null } = {}) {
    const res = await fetchImpl(`${base}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, 'content-type': 'application/json', ...(key ? { 'x-engine-key': key } : {}) },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`supabase ${name} ${res.status}: ${(await res.text()).slice(0, 160)}`);
    return res.json();
  }

  /** Games with at least `minLogs` public logs in the window, with their community grade. */
  async function gameAggregates({ sinceDays = 7, minLogs = 10 } = {}) {
    try {
      const rows = await rpc('engine_game_aggregates', { p_since_days: sinceDays, p_min_logs: minLogs });
      return (rows || []).map((r) => ({
        gameId: String(r.game_id), league: r.league, logs: Number(r.logs) || 0,
        grade: r.avg_grade != null ? Number(Number(r.avg_grade).toFixed(1)) : null,
        home: r.home_team, away: r.away_team, homeAbbr: r.home_abbr, awayAbbr: r.away_abbr,
        homeScore: r.home_score, awayScore: r.away_score,
      }));
    } catch (e) { log('supabase aggregates', String(e.message)); return null; }
  }

  /** Totals for the digest and the north-star metric: logs, active loggers, signups by platform. */
  async function counts({ key } = {}) {
    try {
      /* Keyed as of database-v57. These are the business's own numbers —
         accounts, premium, active loggers — and they were readable by anyone
         holding the publishable key, which ships in the app bundle. */
      const rows = await rpc('engine_counts', { p_key: key });
      const r = Array.isArray(rows) ? rows[0] : rows;
      if (!r) return null;
      return {
        logs7d: Number(r.logs_7d) || 0, loggers7d: Number(r.loggers_7d) || 0, logsAll: Number(r.logs_all) || 0,
        fans: Number(r.fans) || 0, premium: Number(r.premium) || 0,
        signups: { android: Number(r.signups_android) || 0, ios: Number(r.signups_ios) || 0, web: Number(r.signups_web) || 0, newsletter: Number(r.signups_newsletter) || 0, invited: Number(r.signups_invited) || 0 },
        leagues7d: Number(r.leagues_7d) || 0,
      };
    } catch (e) { log('supabase counts', String(e.message)); return null; }
  }

  /**
   * Which tagged link each waitlist signup arrived on.
   *
   * The engine has always tagged its links; nothing ever read the tags back,
   * so it could report likes and could not report a single acquisition. This
   * is the readout: per network, per beat, per closing-line variant, how many
   * people reached the waitlist and how many of them have been invited.
   */
  async function signupSources({ key, sinceDays = 30 } = {}) {
    try {
      const rows = await rpc('engine_signup_sources', { p_key: key, p_since_days: sinceDays });
      if (!Array.isArray(rows)) return null;
      return rows.map((r) => ({
        source: String(r.source || ''),
        network: String(r.network || ''),
        campaign: String(r.campaign || ''),
        signups: Number(r.signups) || 0,
        invited: Number(r.invited) || 0,
        newsletter: Number(r.newsletter) || 0,
      }));
    } catch (e) { log('supabase signupSources', String(e.message)); return null; }
  }

  /**
   * Which campaign each real ACCOUNT came from — distinct from signupSources
   * above, which is about waitlist entries and tagged links. This one answers
   * the question the paid spend actually asks: of the people who now have an
   * account, how many arrived on an advert.
   *
   * Needs the engine key. The underlying table has no SELECT policy at all, so
   * this function is the only way to see it, and it returns counts rather than
   * rows: the digest can say "eleven from Vancouver" and nothing anywhere can
   * say which eleven.
   */
  async function accountSources({ key, days = 30 } = {}) {
    if (!key) return null;
    try {
      const rows = await rpc('engine_account_sources', { p_key: key, p_days: days });
      if (!Array.isArray(rows)) return null;
      return rows.map((r) => ({
        source: String(r.source || 'direct'),
        campaign: String(r.campaign || ''),
        signups: Number(r.signups) || 0,
        firstAt: r.first_at || null,
      }));
    } catch (e) { log('supabase accountSources', String(e.message)); return null; }
  }

  /** Addresses that opted into the weekly slate. Needs the engine key; never the anon key alone. */
  async function newsletterRecipients({ key }) {
    if (!key) return null;
    try {
      const rows = await rpc('engine_newsletter_recipients', { p_key: key });
      return (rows || []).map((r) => ({ email: String(r.email), name: r.name ? String(r.name) : null }));
    } catch (e) { log('supabase recipients', String(e.message)); return null; }
  }

  /**
   * Cards shared per week — the first step in the growth loop that is both
   * measurable and ours to influence.
   *
   * Logs measure whether the people who found us stayed. This measures whether
   * anything is going back out. With a signup count of zero against a healthy
   * log count, the second number is the only one that can move first, and this
   * engine had no way to see it.
   *
   * Aggregate only, from engine_share_counts. The table itself is unreadable
   * with the anon key by design — see database-v55.sql.
   */
  async function shareCounts({ weeks = 8 } = {}) {
    try {
      const rows = await rpc('engine_share_counts', { p_weeks: weeks });
      if (!Array.isArray(rows)) return null;
      return rows.map((r) => ({
        week: String(r.week || ''),
        surface: String(r.surface || ''),
        league: String(r.league || ''),
        shares: Number(r.shares) || 0,
        sharers: Number(r.sharers) || 0,
        unmarked: Number(r.unmarked) || 0,
      }));
    } catch (e) { log('supabase shareCounts', String(e.message)); return null; }
  }

  return { rpc, gameAggregates, counts, signupSources, accountSources, shareCounts, newsletterRecipients };
}

/**
 * The Sunday "week in numbers" record, or { ok: false } when the gate fails.
 * `top` is the game with the most logs among those over the floor, with its
 * scoreline written the way draft.js writes one.
 */
export async function weekInNumbers({ client, minLogs = 10, sinceDays = 7 }) {
  if (!client) return { ok: false, reason: 'no database' };
  const [agg, c] = await Promise.all([client.gameAggregates({ sinceDays, minLogs }), client.counts()]);
  if (!c || !c.logs7d) return { ok: false, reason: 'no counts' };
  const top = (agg || []).sort((a, b) => b.logs - a.logs || (b.grade || 0) - (a.grade || 0))[0] || null;
  if (!top || top.logs < minLogs) return { ok: false, reason: `no game has ${minLogs} logs`, logs: c.logs7d };
  const scoreline = top.homeScore != null && top.awayScore != null
    ? (top.homeScore >= top.awayScore ? `${top.home} ${top.homeScore}, ${top.away} ${top.awayScore}` : `${top.away} ${top.awayScore}, ${top.home} ${top.homeScore}`)
    : `${top.away} at ${top.home}`;
  return {
    ok: true,
    logs: c.logs7d, loggers: c.loggers7d, leagues: c.leagues7d,
    top: { gameId: top.gameId, league: top.league, leagueName: LEAGUE_BY_ID[top.league] ? LEAGUE_BY_ID[top.league].name : top.league, logs: top.logs, grade: top.grade, scoreline, homeAbbr: top.homeAbbr, awayAbbr: top.awayAbbr, homeScore: top.homeScore, awayScore: top.awayScore, home: top.home, away: top.away },
  };
}

/** The community grade for one game, when it clears the floor; null otherwise. */
export async function communityFor({ client, espnId, minLogs = 10 }) {
  if (!client || !espnId) return null;
  const agg = await client.gameAggregates({ sinceDays: 3, minLogs });
  const hit = (agg || []).find((r) => r.gameId === String(espnId));
  return hit && hit.logs >= minLogs ? { logs: hit.logs, grade: hit.grade } : null;
}
