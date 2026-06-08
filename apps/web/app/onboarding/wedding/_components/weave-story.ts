/**
 * weave-story.ts — the love-stage "told-back page" weaver (S5 love_preview).
 *
 * PROTOTYPE-DIRECT PORT of weaveStory() + its prose helpers from
 * Onboarding_Wedding_Adaptive_Flow_2026-06-07.html (the locked love-stage design).
 * Pure, side-effect-free TS: it takes the couple's captured love-story blob, a tone,
 * and a small render context (names + wedding date + place), and returns the masthead,
 * pull-quote, braided prose, and chronological timeline rows that S5 paints.
 *
 * COVERT (load-bearing): every identifier here is story-shaped. The voice is the couple's
 * wedding-website "Our Love Story" — nothing names editorial / newspaper / song / lyric.
 *
 * Blank-field fallbacks are kept verbatim from the prototype so the reveal is NEVER empty,
 * even if the couple skipped most stems.
 */

import type { LoveStory, LoveMilestone } from '../types';

/** Tone of the told-back story (love_tone screen). */
export type StoryTone = 'warm' | 'playful' | 'formal';

/** The render context the weaver needs beyond the love-story blob itself. */
export interface WeaveContext {
  /** Bride first name (falls back to "Maria" in display, never persisted). */
  brideFirst: string;
  /** Groom first name (falls back to "Juan" in display, never persisted). */
  groomFirst: string;
  /** Bride last name (used for nothing here but kept for parity / future). */
  brideLast?: string;
  /** Groom last name. */
  groomLast?: string;
  /** The chosen wedding date (ISO yyyy-mm-dd) if set — love stage precedes the date screen. */
  weddingDateIso?: string | null;
  /** A human place label for the dateline (e.g. "Tagaytay"), or null. */
  placeLabel?: string | null;
}

/** One rendered timeline row (derived anchors + user moments, sorted together). */
export interface TimelineRow {
  year: string;
  month?: string;
  day?: string;
  title: string;
  /** Derived anchor (We met / proposal / We do / the almost) — not user-editable. */
  seed?: boolean;
  /** Render as a mulberry peak dot (the obstacle + "We do"). */
  peak?: boolean;
  /** Index back into milestones[] for user rows (edit affordance). */
  idx?: number;
}

const MON_SHORT = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const OBSTACLE_LABEL: Record<string, string> = {
  distance: 'The time apart',
  family: 'The hard questions',
  timing: 'The wrong timing',
  different_paths: 'Different dreams',
  doubt: 'The almost',
  other: 'The almost',
};

/* ── HTML escaping (the weaver emits HTML strings that S5 sets via dangerouslySetInnerHTML) ── */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ── small prose helpers (verbatim port) ── */
export function cap(s: string): string {
  s = (s || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** Strip a leading stem opener so the line reads as a clean clause in prose. */
export function stripLead(s: string): string {
  s = (s || '').trim();
  s = s.replace(/^(the first thing i noticed was|i knew the moment|i first noticed)\b[\s,…:-]*/i, '');
  s = s.replace(/^[☂🎵📍😅😂🍜]\s*/, ''); // a dropped emoji chip
  s = s.replace(/^(the weather|the song that was playing|the place|the awkward part)\s*[—\-:,]*\s*/i, '');
  return s.trim();
}

export function endPunct(s: string): string {
  s = (s || '').trim();
  return /[.!?…]$/.test(s) ? s : s + '.';
}

/**
 * Lowercase the first letter ONLY when the opening word is a common function/pronoun/
 * temporal word — so a proper-noun opener (Manila, Carlo, Baguio) stays capitalized
 * mid-sentence. Anything not in the set is left as the couple typed it.
 */
const LF_COMMON: Record<string, 1> = {
  we: 1, i: 1, it: 1, they: 1, she: 1, he: 1, her: 1, his: 1, him: 1, them: 1, their: 1, our: 1, ours: 1, my: 1, mine: 1, us: 1, you: 1, your: 1,
  the: 1, a: 1, an: 1, and: 1, but: 1, so: 1, then: 1, for: 1, of: 1, on: 1, in: 1, at: 1, with: 1, to: 1, from: 1, by: 1,
  there: 1, here: 1, when: 1, where: 1, while: 1, after: 1, before: 1, because: 1, since: 1, though: 1, although: 1, even: 1,
  just: 1, maybe: 1, somehow: 1, eventually: 1, finally: 1, suddenly: 1, still: 1, always: 1, never: 1, almost: 1,
  one: 1, two: 1, three: 1, both: 1, every: 1, all: 1, each: 1, some: 1, most: 1, no: 1, not: 1,
  that: 1, this: 1, these: 1, those: 1, everything: 1, nothing: 1, something: 1, someone: 1, anyone: 1,
  life: 1, love: 1, work: 1, time: 1, family: 1, distance: 1, years: 1, year: 1, months: 1, month: 1, weeks: 1, week: 1, days: 1, day: 1,
};
export function lowerFirst(s: string): string {
  s = (s || '').trim();
  if (!s) return s;
  const m = s.match(/^([A-Za-z']+)/);
  const w = m ? (m[1] ?? '').toLowerCase().replace(/[^a-z']/g, '') : '';
  return LF_COMMON[w] ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** First A-Z initial of a name, uppercased. */
export function firstInitial(s: string): string {
  const w = (s || '').replace(/[^A-Za-z]/g, '');
  return w ? w[0]!.toUpperCase() : '';
}

/* ── names + wedding-year helpers ── */
function names(ctx: WeaveContext): { b: string; g: string } {
  const b = (ctx.brideFirst || 'Maria').trim();
  const g = (ctx.groomFirst || 'Juan').trim();
  return { b: b || 'Maria', g: g || 'Juan' };
}

/** The wedding year, from the chosen date if set — falls back to next calendar year. */
export function weddingYear(ctx: WeaveContext): number {
  const iso = ctx.weddingDateIso || '';
  if (iso) {
    const y = parseInt(String(iso).slice(0, 4), 10);
    if (y) return y;
  }
  return new Date().getFullYear() + 1;
}

function momentKey(m: { year?: string; month?: string; day?: string }): number {
  const y = parseInt(m.year || '', 10) || 0;
  const mo = parseInt(m.month || '', 10) || 0;
  const d = parseInt(m.day || '', 10) || 0;
  return y * 10000 + mo * 100 + d;
}

export function obstacleLabel(loveStory: LoveStory): string {
  return OBSTACLE_LABEL[loveStory.obstacle_kind] || 'The almost';
}

export function fmtMomentYear(m: { year?: string; month?: string; day?: string }): string {
  const parts: string[] = [];
  if (m.month) {
    parts.push(MON_SHORT[parseInt(m.month, 10)] || '');
    if (m.day) parts.push(m.day);
  }
  const md = parts.filter(Boolean).join(' ');
  return md ? md + ' ' + (m.year || '') : m.year || '—';
}

/**
 * The full timeline = derived anchors (those with a known year) + user moments, all
 * sorted together. The Almost becomes a mulberry PEAK at the midpoint of met→proposal.
 */
export function milestoneRows(loveStory: LoveStory, ctx: WeaveContext): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const my = loveStory.met_year;
  const py = loveStory.proposal_year;
  if (my) rows.push({ year: my, title: 'We met', seed: true });
  if (loveStory.obstacle && String(loveStory.obstacle).trim()) {
    let oy = my;
    const mi = parseInt(my, 10);
    const pi = parseInt(py, 10);
    if (mi && pi && pi > mi) oy = String(Math.round((mi + pi) / 2));
    else if (mi) oy = String(mi);
    rows.push({ year: oy, title: obstacleLabel(loveStory), seed: true, peak: true });
  }
  if (py) rows.push({ year: py, title: 'The proposal', seed: true });
  rows.push({ year: String(weddingYear(ctx)), title: 'We do', seed: true, peak: true });
  (loveStory.milestones || []).forEach((m: LoveMilestone, i: number) => {
    rows.push({ year: m.year, month: m.month, day: m.day, title: m.title, idx: i });
  });
  rows.sort((a, b) => momentKey(a) - momentKey(b));
  return rows;
}

/* ── S5 masthead dateline — NAMES · MONTH YEAR · PLACE ── */
export function dateline(loveStory: LoveStory, ctx: WeaveContext): string {
  const nm = names(ctx);
  const parts: string[] = [esc(nm.b.toUpperCase()) + ' &amp; ' + esc(nm.g.toUpperCase())];
  const iso = ctx.weddingDateIso || '';
  if (iso) {
    const d = new Date(iso + (iso.length <= 10 ? 'T00:00:00' : ''));
    if (!isNaN(d.getTime())) parts.push((MON_LONG[d.getMonth()] || '').toUpperCase() + ' ' + d.getFullYear());
  } else {
    parts.push(String(weddingYear(ctx)));
  }
  if (ctx.placeLabel) parts.push(esc(ctx.placeLabel.toUpperCase()));
  return parts.join(' · ');
}

/**
 * THE PULL-QUOTE — the couple's single most irreplaceable line, lifted VERBATIM.
 * Favors spark_why, then spark, then proposal, then a graceful sample.
 */
export function pullQuote(loveStory: LoveStory): string {
  const why = stripLead((loveStory.spark_why || '').trim());
  const spark = stripLead((loveStory.spark || '').trim());
  const prop = stripLead((loveStory.proposal || '').trim());
  const line = why || spark || prop || 'She was holding the cup with both hands, like it was the only warm thing in Baguio';
  return '&ldquo;' + esc(cap(endPunct(line))).replace(/\.$/, '') + '.&rdquo;';
}

/**
 * The masthead block — monogram initials lockup + dateline. Renders INSTANTLY (no
 * fake "weaving…" delay), exactly like the prototype.
 */
export function masthead(loveStory: LoveStory, ctx: WeaveContext): string {
  const a = firstInitial(ctx.brideFirst) || 'M';
  const b = firstInitial(ctx.groomFirst) || 'J';
  return (
    '<div class="sc-monorow"><span class="ini">' + esc(a) + '</span><span class="amp">&amp;</span><span class="ini">' + esc(b) + '</span></div>' +
    '<div class="sc-dateline">' + dateline(loveStory, ctx) + '</div>'
  );
}

/**
 * BRAIDED PROSE — written on because-links, not and-then. Each beat is its own
 * <span class="ln"> so the reveal CSS fades them in one after another. Voices
 * alternate (her/his) where known via proposal_voice + proposal_feel. Blank fields
 * fall back so the page is never empty.
 */
export function weaveStory(tone: StoryTone, loveStory: LoveStory, ctx: WeaveContext): string {
  const nm = names(ctx);
  const her = esc(nm.b);
  const him = esc(nm.g);
  const couple = '<em>' + her + ' &amp; ' + him + '</em>';
  const spark = stripLead((loveStory.spark || '').trim());
  const why = stripLead((loveStory.spark_why || '').trim());
  const obstacle = (loveStory.obstacle || '').trim();
  const kept = (loveStory.obstacle_kept || '').trim();
  const prop = stripLead((loveStory.proposal || '').trim());
  const feel = (loveStory.proposal_feel || '').trim();
  const an = loveStory.anchors || { song: '', place: '', injoke: '', food: '' };
  const wy = weddingYear(ctx);
  const lines: string[] = [];

  // BEFORE → SPARK (causal: the spark causes the noticing)
  const openWord = tone === 'formal' ? 'Their story began' : tone === 'playful' ? "So here's how it started:" : 'It started';
  if (spark || why) {
    const sk = why || spark;
    lines.push(esc(openWord) + ' &mdash; ' + esc(endPunct(lowerFirst(sk))));
    if (why && spark && why !== spark) lines.push("What stuck wasn't the obvious thing. " + esc(cap(endPunct(spark))) + '');
  } else {
    lines.push(esc(openWord) + " &mdash; the kind of thing you only notice when it's already too late to look away.");
  }

  // OBSTACLE PIVOT (the almost makes the yes mean something) — omit gracefully if skipped
  if (obstacle) {
    let pivot = 'Then came the hard part: ' + esc(endPunct(lowerFirst(obstacle))).replace(/\.$/, '') + ' &mdash; the part that almost won.';
    if (kept) pivot += ' But ' + esc(lowerFirst(stripLead(kept))).replace(/\.$/, '') + ", and they didn't quit.";
    else pivot += " They didn't quit.";
    lines.push(pivot);
  }

  // THE YES (because the almost, the yes had to mean everything) — braid the two feelings
  const askLead = obstacle ? 'So when the question finally came' : 'And then, the question';
  if (prop) {
    let yes = askLead + ' &mdash; ' + esc(endPunct(lowerFirst(prop))).replace(/\.$/, '');
    if (feel) {
      const who = loveStory.proposal_voice;
      const asker = who === 'me' ? him : who === 'them' ? her : 'they';
      const feeler = who === 'me' ? her : who === 'them' ? him : 'the other';
      yes += '. ' + esc(asker) + ' barely got the words out; ' + esc(feeler) + ' ' + esc(lowerFirst(endPunct(feel))).replace(/\.$/, '') + '.';
    } else {
      yes += '.';
    }
    lines.push(yes);
  } else if (feel) {
    lines.push('When it finally happened, ' + esc(lowerFirst(endPunct(feel))));
  }

  // THRESHOLD + anchors as skeleton (place + the yes woven together; song/food close it)
  const still: string[] = [];
  if (an.place) still.push('Still ' + esc(an.place));
  if (an.food) still.push('still ' + esc(an.food));
  if (an.song) still.push('still <em>' + esc(an.song) + '</em>');
  const closeWord =
    tone === 'formal'
      ? 'In ' + wy + ', surrounded by family and friends, ' + couple + ' exchange their vows.'
      : tone === 'playful'
        ? 'This ' + wy + ', ' + couple + ' are finally making it official &mdash; about time.'
        : 'This ' + wy + ', surrounded by everyone they love, ' + couple + ' make it official.';
  let close = closeWord;
  if (still.length) close += ' ' + cap(still.join(', ')) + '.';
  lines.push(close);

  return lines.map((l) => '<span class="ln">' + l + '</span>').join('');
}

/**
 * The S5 timeline HTML — same auto-sorted rows; mulberry peak on the obstacle + "We do".
 */
export function timelineHtml(loveStory: LoveStory, ctx: WeaveContext): string {
  const rows = milestoneRows(loveStory, ctx);
  return (
    '<div class="sc-tlhd">How it happened</div>' +
    rows
      .map((r) => {
        const peak = r.peak ? ' peak' : '';
        return (
          '<div class="tl"><span class="d' + peak + '"></span><div>' +
          '<div class="yr">' + esc(fmtMomentYear(r)) + '</div>' +
          '<div class="mm">' + esc(r.title || 'A moment') + '</div></div></div>'
        );
      })
      .join('')
  );
}

/** The live one-line tone preview shown on love_tone (favors spark_why → spark → sample). */
export function toneLine(tone: StoryTone, loveStory: LoveStory): string {
  const why = (loveStory.spark_why || '').trim();
  const spark = (loveStory.spark || '').trim();
  let core = why || spark;
  if (!core) core = 'his hands were shaking when he handed her the coffee he ordered by mistake';
  core = stripLead(core);
  if (tone === 'playful') return 'Honestly? ' + esc(cap(core)) + '. And somehow that worked.';
  if (tone === 'formal') return 'What she remembers first: ' + esc(core) + '.';
  return esc(cap(core)) + '.'; // warm
}
