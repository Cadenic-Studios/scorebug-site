/**
 * SCOREBUG // WATCHABILITY — "was this game worth watching?", from the box score
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT THE ENGINE'S RANKER ──────────────────
 *
 * The marketing engine already scores games, in engine/functions/dispatch/rank.js.
 * That function answers a different question — "which game earns tonight's post?"
 * — and it is right to weight audience size, Canadian clubs, primetime and the
 * weekend, because those change how many people a post reaches.
 *
 * None of that has anything to do with whether the game was any good. A 1-0
 * Bundesliga match at 6am is exactly as tense as a 1-0 game in prime time. So
 * this is a separate function on purpose, not a duplicate: it reads only what
 * happened on the ice, court, pitch or field, and it deliberately ignores who
 * was watching.
 *
 * ── WHY IT MATTERS MORE THAN IT LOOKS ───────────────────────────────────────
 *
 * The whole point of Scorebug is that fans grade games. But a page that waits
 * for a quorum of grades is empty for its first year, and an empty page is
 * worse than no page — thin pages drag a whole domain down in search.
 *
 * So the page has two layers, and this is the one that is ALWAYS there:
 *
 *   THE TAPE   — this file. Computed from the final box score the moment the
 *                game ends. Available for every game ever played, including the
 *                archive back to 2002. Never empty, never guessed.
 *   THE STANDS — the community grade out of 5.0, which appears only once enough
 *                fans have logged the game, and never before.
 *
 * The two are shown separately and labelled, always. Presenting a computed
 * number as if fans had voted would be exactly the kind of fabrication this
 * project refuses everywhere else.
 *
 * ── HONESTY ─────────────────────────────────────────────────────────────────
 *
 * This is a heuristic over a handful of facts, and the page says so. Every
 * reason it returns is a plain statement about the box score — "overtime",
 * "three-goal comeback", "one-run game" — so a reader can check the claim
 * against the scoreline sitting next to it. It never invents a narrative it
 * cannot point at.
 */

export type Sport = 'hockey' | 'soccer' | 'basketball' | 'football' | 'baseball' | 'cricket' | 'racing'

/** The same thresholds the engine uses, so the two never disagree about what "close" means. */
const SHAPE: Record<Sport, { tight: number; close: number; typical: number; high: number; comeback: number }> = {
  hockey:     { tight: 1, close: 2, typical: 6,   high: 9,   comeback: 2 },
  soccer:     { tight: 1, close: 2, typical: 3,   high: 5,   comeback: 2 },
  basketball: { tight: 3, close: 6, typical: 220, high: 240, comeback: 10 },
  football:   { tight: 3, close: 7, typical: 44,  high: 55,  comeback: 10 },
  baseball:   { tight: 1, close: 2, typical: 9,   high: 15,  comeback: 3 },
  cricket:    { tight: 0, close: 0, typical: 0,   high: 0,   comeback: 0 },
  racing:     { tight: 0, close: 0, typical: 0,   high: 0,   comeback: 0 },
}

export interface GameShape {
  sport: Sport
  homeScore: number | null
  awayScore: number | null
  /** ESPN's status detail: "Final/OT", "FT (AET)", "Final/SO". */
  detail?: string | null
  /** Per-period scores, home and away, if the record has them — this is what finds comebacks. */
  homeLine?: number[] | null
  awayLine?: number[] | null
  /** 1 preseason, 2 regular, 3 postseason (ESPN's own numbering). */
  seasonType?: number | null
  /** Win/loss records as ESPN gives them, e.g. "12-4-1" — used only to spot an upset. */
  homeRecord?: string | null
  awayRecord?: string | null
  /** True when the two clubs are on the site's curated rivalry list. Never inferred. */
  rivalry?: boolean
}

export interface Watchability {
  /** 0–100. Deliberately NOT out of 5, so it can never be mistaken for a fan grade. */
  score: number
  verdict: 'Must-watch' | 'Worth your time' | 'Decent watch' | 'For the diehards' | 'Skippable' | 'Not rated'
  /** Short, checkable statements about the box score. Ordered by how much they moved the score. */
  reasons: string[]
  /** One sentence for a meta description and the top of the page. */
  summary: string
  /** False for a game with no final score, or a sport this does not model. */
  rated: boolean
}

const winShare = (rec?: string | null): number | null => {
  if (!rec) return null
  const m = String(rec).match(/^(\d+)-(\d+)(?:-(\d+))?/)
  if (!m) return null
  const w = +m[1], l = +m[2], o = m[3] ? +m[3] : 0
  const games = w + l + o
  return games > 0 ? (w + o * 0.5) / games : null
}

/**
 * The largest deficit the eventual winner came back from, in the winner's favour.
 * Runs the period-by-period totals forward and tracks the worst point. Returns 0
 * when the record has no line scores, which is the honest answer — absence of a
 * linescore is not absence of a comeback, so it simply scores nothing.
 */
function comebackSize(g: GameShape): number {
  const h = g.homeLine, a = g.awayLine
  if (!h || !a || !h.length || h.length !== a.length) return 0
  if (g.homeScore == null || g.awayScore == null || g.homeScore === g.awayScore) return 0
  const homeWon = g.homeScore > g.awayScore
  let ht = 0, at = 0, worst = 0
  for (let i = 0; i < h.length; i += 1) {
    ht += Number(h[i]) || 0
    at += Number(a[i]) || 0
    const deficit = homeWon ? at - ht : ht - at
    if (deficit > worst) worst = deficit
  }
  return worst
}

/** How many times the lead changed hands. Ties are not lead changes; taking the lead back is. */
function leadChanges(g: GameShape): number {
  const h = g.homeLine, a = g.awayLine
  if (!h || !a || !h.length || h.length !== a.length) return 0
  let ht = 0, at = 0, leader = 0, changes = 0
  for (let i = 0; i < h.length; i += 1) {
    ht += Number(h[i]) || 0
    at += Number(a[i]) || 0
    const now = ht === at ? leader : (ht > at ? 1 : -1)
    if (leader !== 0 && now !== 0 && now !== leader) changes += 1
    if (now !== 0) leader = now
  }
  return changes
}

export function watchability(g: GameShape): Watchability {
  const shape = SHAPE[g.sport]
  const hs = g.homeScore, as = g.awayScore
  if (!shape || shape.close === 0 || hs == null || as == null) {
    return {
      score: 0, verdict: 'Not rated', reasons: [], rated: false,
      summary: 'Not enough of the record to rate this one.',
    }
  }

  const detail = String(g.detail || '')
  const margin = Math.abs(hs - as)
  const total = hs + as
  /* "Final/OT" for hockey and gridiron, "AET" for soccer — and for baseball
     ESPN writes the inning it ended in, "Final/10". Missing that last form rated
     a one-run extra-innings game as an ordinary one-run game, which is the
     opposite of the truth: extras are the best baseball there is. */
  const ot = /\bOT\b|\d+OT|AET|extra[- ]time|\bET\b/i.test(detail) ||
    (g.sport === 'baseball' && /\/\s*(\d{2,})\b/.test(detail))
  const so = /\bSO\b|shootout|\bpens?\b|penalt/i.test(detail)
  const playoff = g.seasonType === 3
  const preseason = g.seasonType === 1
  const draw = hs === as

  const reasons: { text: string; weight: number }[] = []

  /* ── Closeness, 0–34. The single best predictor of a game worth watching. */
  let closeness = 0
  if (draw) {
    closeness = 22
    reasons.push({ text: 'Ended level', weight: 22 })
  } else if (margin <= shape.tight) {
    closeness = 34
    reasons.push({ text: oneScoreLabel(g.sport, margin), weight: 34 })
  } else if (margin <= shape.close) {
    closeness = 24
    reasons.push({ text: `${margin}-${unit(g.sport)} game`, weight: 24 })
  } else if (margin <= shape.close * 2) {
    closeness = 12
  } else {
    /* Past twice the "close" threshold a game stops being a contest, and the
       score should say so rather than bottoming out at zero: a 7-1 was rating
       42/100 — "for the diehards" — because a floor of zero plus the baseline
       plus credit for eight goals added up to a respectable number for a game
       nobody enjoyed. Blowouts now subtract. */
    closeness = Math.max(-16, -2 * (margin - shape.close * 2))
    if (margin >= shape.close * 3) reasons.push({ text: 'Never in doubt', weight: -8 })
  }

  /* ── Drama, 0–34. Extra time and comebacks are what people remember. */
  let drama = 0
  if (ot) { drama += 18; reasons.push({ text: g.sport === 'baseball' ? 'Extra innings' : 'Overtime', weight: 16 }) }
  if (so) { drama += 6; reasons.push({ text: g.sport === 'soccer' ? 'Decided on penalties' : 'Decided in a shootout', weight: 6 }) }

  const cb = comebackSize(g)
  if (shape.comeback > 0 && cb >= shape.comeback) {
    const pts = Math.min(16, 8 + Math.round((cb / shape.comeback) * 4))
    drama += pts
    reasons.push({ text: `${cb}-${unit(g.sport)} comeback`, weight: pts })
  }
  const lc = leadChanges(g)
  if (lc >= 2) {
    const pts = Math.min(10, lc * 3)
    drama += pts
    reasons.push({ text: `${lc} lead changes`, weight: pts })
  }
  drama = Math.min(26, drama)

  /* ── Stakes, 0–22. Why the result mattered beyond the two hours. */
  let stakes = 0
  if (playoff) { stakes += 12; reasons.push({ text: 'Playoff game', weight: 12 }) }
  if (g.rivalry) { stakes += 8; reasons.push({ text: 'Rivalry', weight: 8 }) }
  if (preseason) { stakes -= 20; reasons.push({ text: 'Preseason', weight: -20 }) }

  const wh = winShare(g.homeRecord), wa = winShare(g.awayRecord)
  if (!draw && wh != null && wa != null) {
    const homeWon = hs > as
    const gap = homeWon ? wa - wh : wh - wa
    if (gap >= 0.25) { stakes += 8; reasons.push({ text: 'Upset', weight: 8 }) }
  }
  stakes = Math.max(-20, Math.min(18, stakes))

  /* ── Scoring, 0–10. A goal-fest is fun; a 0-0 is an acquired taste. */
  let scoring = 0
  /* Goals only count as entertainment when the game was still a game. Seven
     goals in a 7-1 are not a goal-fest, they are a formality. */
  const competitive = margin <= shape.close * 2
  if (shape.high > 0 && competitive) {
    if (total >= shape.high) { scoring = 8; reasons.push({ text: 'Goals everywhere', weight: 8 }) }
    else if (total >= shape.typical) scoring = 6
    else if (total <= Math.max(1, Math.round(shape.typical * 0.34))) {
      scoring = 1
      if (total === 0) { scoring = -8; reasons.push({ text: 'Goalless', weight: -8 }) }
    } else scoring = 3
  }


  /* ── The baseline, 30 ──────────────────────────────────────────────────
     Without it the arithmetic said an ordinary one-score regular-season game
     was 40/100 — "for the diehards" — which is plainly wrong: a one-score game
     is the most watchable thing in ordinary sport. The floor says a competitive
     professional fixture starts out mildly worth watching and the evidence moves
     it from there, rather than every game starting at "skippable" and having to
     earn its way out. */
  const raw = 30 + closeness + drama + stakes + scoring
  const score = Math.max(0, Math.min(100, Math.round(raw)))

  reasons.sort((x, y) => Math.abs(y.weight) - Math.abs(x.weight))
  const top = reasons.filter(r => r.weight > 0).slice(0, 4).map(r => r.text)
  /* When nothing good happened, say what did. A page that goes silent on a 7-1
     is less useful than one that tells you not to bother. */
  const against = reasons.filter(r => r.weight < 0).slice(0, 2).map(r => r.text)

  return {
    score,
    verdict: verdictFor(score),
    reasons: top,
    rated: true,
    summary: summarise(score, top, against),
  }
}

function verdictFor(score: number): Watchability['verdict'] {
  if (score >= 82) return 'Must-watch'
  if (score >= 66) return 'Worth your time'
  if (score >= 50) return 'Decent watch'
  if (score >= 34) return 'For the diehards'
  return 'Skippable'
}

function unit(sport: Sport): string {
  if (sport === 'hockey' || sport === 'soccer') return 'goal'
  if (sport === 'baseball') return 'run'
  return 'point'
}

function oneScoreLabel(sport: Sport, margin: number): string {
  if (sport === 'basketball' || sport === 'football') return `${margin}-point game`
  return margin === 1 ? `One-${unit(sport)} game` : `${margin}-${unit(sport)} game`
}

function summarise(score: number, top: string[], against: string[] = []): string {
  const v = verdictFor(score).toLowerCase()
  if (!top.length) {
    const why = against.length ? `${against.join(', ')}. ` : ''
    return `${why}Rated ${score} out of 100 — ${v}.`
  }
  const list = top.length === 1 ? top[0] : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`.toLowerCase()
  return `${list.charAt(0).toUpperCase()}${list.slice(1)}. Rated ${score} out of 100 — ${v}.`
}
