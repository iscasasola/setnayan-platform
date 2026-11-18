import type { HelpArticle, HelpRole, HelpTopic } from '@/lib/help';
import { HELP_NOT_IN_THE_APP, helpBodyFor } from '@/lib/help';
import { STOP_WORDS } from '@/lib/search-stop-words';

// ============================================================================
// HELP · ASK FIRST — the matching behind the ask box (owner 13 Nov 2026, "help approved" on prototype
// `Setnayan-specs/prototypes/approved_2026-11-13/help-page-fable.html` v5; DECISION_LOG 2026-11-13 "Help page
// approved", "Help coverage = active account", "Three helps", "User help includes guest questions", "Help — no AI
// answers yet").
// ============================================================================
//
// PLAIN MATCHING OVER THE ANSWERS ALREADY WRITTEN — no model call, no cost per question:
//   01 the app's own words   a typed word also searches the word the app uses for it (vendor → supplier);
//   02 Taglish and Tagalog   question words are read (magkano → fee · plan · rate; paano is dropped) and the
//                            mag- / nag- / pag- / i- prefixes come off (magreply → reply);
//   03 typos forgiven        a word of 5+ letters may be one letter off (two for 9+); an exact match always scores
//                            above a forgiven one, and a word under 5 letters must be exact (fee never becomes free);
//   04 not every word        scored by how many meaning-words match, title above body, exact phrase on top — with a
//                            floor: the best answer needs at least half the words and one of them in its title or
//                            topic. Below the floor an answer is "near", never "best".
//
// COVERAGE IS THE ACTIVE ACCOUNT (no picker): a user account reads couple AND guest answers, a shop reads supplier
// answers, an invite-link guest reads guest answers, signed out reads About Setnayan only. The team reads its own
// guides — passed in by the admin page, because `lib/help-admin.ts` may never be imported here (public module).
//
// ⚠ PURE. The unit suite imports it; the IO (who is asking, the log) is `lib/help-asks.server.ts`.

export type HelpCoverage = 'user' | 'guest' | 'supplier' | 'public';

/** Which public audiences each account reads. `public` (signed out, no invite) is About Setnayan only. */
export const COVERAGE_ROLES: Record<Exclude<HelpCoverage, 'public'>, ReadonlyArray<HelpRole>> = {
  user: ['couple', 'guest'],
  guest: ['guest'],
  supplier: ['vendor'],
};

/** The one topic a signed-out reader is shown. */
export const PUBLIC_COVERAGE_TOPIC = 'about-setnayan';

/** A topic as the ask reads it — public topics and the team's guides share this shape. */
export type AskTopic = { key: string; label: string; articles: ReadonlyArray<HelpArticle> };

/** The topics this account covers, in the help's own order. */
export function topicsForCoverage(topics: ReadonlyArray<HelpTopic>, coverage: HelpCoverage): HelpTopic[] {
  if (coverage === 'public') return topics.filter((t) => t.key === PUBLIC_COVERAGE_TOPIC);
  const roles = COVERAGE_ROLES[coverage];
  return topics.filter((t) => t.roles.some((r) => roles.includes(r)));
}

/**
 * The topics in this reader's words. Unlike `helpTopicsFor` (the /help LIST, which drops a question about a part the
 * iPhone app does not include), the ask KEEPS that question with the app's own line — so a couple asking about it in
 * the app is told plainly, then offered Message us, instead of being told nothing matched.
 */
export function askTopicsFor<T extends AskTopic>(topics: ReadonlyArray<T>, storeShell: boolean): T[] {
  if (!storeShell) return [...topics];
  return topics.map((t) => ({ ...t, articles: t.articles.map((a) => ({ ...a, body: helpBodyFor(a, true) })) }));
}

// ── 01 · THE APP'S OWN WORDS ─────────────────────────────────────────────────
// Hand-kept, beside the answers. The right side is what the app calls it; the guard
// (`lib/help-ask-finds-the-answer.test.ts`) fails when a right-side word no longer appears in any answer.

export const HELP_APP_WORDS: ReadonlyArray<{ typed: ReadonlyArray<string>; also: ReadonlyArray<string> }> = [
  { typed: ['vendor', 'vendors', 'provider', 'providers', 'merchant', 'merchants'], also: ['supplier'] },
  { typed: ['website', 'site', 'page', 'link'], also: ['event hub', 'invitation'] },
  { typed: ['photos', 'photo', 'pictures', 'picture', 'pics', 'upload', 'camera', 'cameras'], also: ['papic', 'memories', 'photo'] },
  { typed: ['pay', 'payment', 'cost', 'price', 'charge', 'charges'], also: ['booking fee', 'plan', 'order', 'fee'] },
  { typed: ['seat', 'table', 'seating'], also: ['seat plan', 'your seat', 'seat'] },
  { typed: ['attend', 'confirm', 'reply', 'going'], also: ['rsvp'] },
  { typed: ['livestream', 'stream', 'zoom', 'watch'], also: ['live watch'] },
  { typed: ['godparents', 'godparent', 'sponsors'], also: ['ninong', 'ninang', 'principal sponsors'] },
];

// ── 02 · TAGLISH AND TAGALOG ─────────────────────────────────────────────────

/** Question words read for their meaning. An empty list = the word only asks "how" and is dropped. */
export const HELP_TAGLISH: ReadonlyArray<{ typed: ReadonlyArray<string>; reads: ReadonlyArray<string> }> = [
  { typed: ['paano', 'pano', 'papaano'], reads: [] },
  { typed: ['magkano', 'mgkano', 'presyo', 'bayad'], reads: ['fee', 'plan', 'rate', 'price', 'cost'] },
  { typed: ['saan', 'nasaan', 'san'], reads: ['venue', 'find', 'open'] },
  { typed: ['kailan'], reads: ['date', 'schedule'] },
  { typed: ['bisita'], reads: ['guest'] },
  { typed: ['litrato', 'larawan'], reads: ['photo'] },
  { typed: ['libre'], reads: ['free'] },
];

/** Filipino small words that never veto a match (the English ones are `STOP_WORDS`). */
const TAGLISH_SMALL = new Set(['ang', 'ng', 'mga', 'po', 'ba', 'na', 'sa', 'ko', 'ako', 'kami', 'namin', 'natin', 'yung', 'iyong', 'si', 'ni', 'kapag', 'pag', 'mag', 'nag', 'galing']);

/** A typed word → every form it searches for. Order: the word itself first (exact beats forgiven). */
function expand(word: string): { forms: string[]; forgivable: string | null } {
  for (const t of HELP_TAGLISH) if (t.typed.includes(word)) return { forms: [...t.reads], forgivable: null };
  const forms = new Set<string>([word]);
  // mag- / nag- / pag- / i- come off (magreply → reply, i-share → share is already split by the tokenizer).
  for (const prefix of ['mag', 'nag', 'pag']) {
    if (word.startsWith(prefix) && word.length - prefix.length >= 3) forms.add(word.slice(prefix.length));
  }
  for (const f of [...forms]) {
    for (const w of HELP_APP_WORDS) if (w.typed.includes(f)) for (const a of w.also) forms.add(a);
    for (const t of HELP_TAGLISH) if (t.typed.includes(f)) for (const r of t.reads) forms.add(r);
  }
  return { forms: [...forms], forgivable: word };
}

/** The meaning-words of a question, each with the forms it searches for. */
export function askWords(query: string): Array<{ word: string; forms: string[]; forgivable: string | null }> {
  const flat = query.toLowerCase().replace(/walang\s+bayad/g, 'libre');
  const raw = flat.split(/[^a-z0-9']+/i).filter((t) => t.length >= 2);
  const out: Array<{ word: string; forms: string[]; forgivable: string | null }> = [];
  for (const w of raw) {
    if (STOP_WORDS.has(w) || TAGLISH_SMALL.has(w)) continue;
    const e = expand(w);
    if (e.forms.length === 0) continue; // a "how" word: dropped
    if (out.some((o) => o.word === w)) continue;
    out.push({ word: w, ...e });
  }
  return out;
}

// ── 03 · TYPOS FORGIVEN ──────────────────────────────────────────────────────

/** Edit distance, stopped as soon as it passes `max`. */
export function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length]! <= max;
}

/** How many letters a typed word may be off: none under 5, one from 5, two from 9. */
export function typoAllowance(word: string): number {
  return word.length >= 9 ? 2 : word.length >= 5 ? 1 : 0;
}

const wordsOf = (text: string): string[] => text.toLowerCase().split(/[^a-z0-9']+/i).filter((w) => w.length >= 3);

// ── 04 · SCORE, WITH A FLOOR ─────────────────────────────────────────────────

export type AskHit = {
  slug: string;
  title: string;
  /** The whole answer, in this reader's words. */
  body: string;
  /** Its first 1–3 sentences, cut from the answer itself — no new writing. */
  lead: string;
  topicKey: string;
  topicLabel: string;
  /** Meaning-words found / asked. */
  matched: number;
  asked: number;
  score: number;
  /** True when the answer is the app's "not included" line (the iPhone app). */
  notInApp: boolean;
};

export type AskOutcome =
  /** A best answer that holds every meaning-word. */
  | 'best'
  /** A best answer that misses at least one word — shown, and logged so the team can check it. */
  | 'closest'
  /** Nothing over the floor: only near answers, labelled "not an answer". */
  | 'near'
  /** Nothing at all. */
  | 'none';

export type AskResult = { outcome: AskOutcome; best: AskHit | null; more: AskHit[]; near: AskHit[] };

/** How many other answers sit under the best one, and how many "near" ones a miss shows. */
export const ASK_MORE_LIMIT = 4;
export const ASK_NEAR_LIMIT = 3;

/** The first 1–3 sentences of an answer, never cut mid-sentence unless the first sentence is itself very long. */
export function leadOf(body: string, max = 240): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  // A sentence ends at . ! ? FOLLOWED BY A SPACE — never inside “setnayan.com/pricing”.
  const sentences = flat.split(/(?<=[.!?])\s+/);
  let out = '';
  for (const s of sentences.slice(0, 3)) {
    const next = `${out}${out ? ' ' : ''}${s.trim()}`;
    if (out && next.length > max) break;
    out = next;
    if (out.length >= max * 0.6) break;
  }
  if (out.length <= max + 60) return out;
  const cut = out.slice(0, max);
  return `${cut.slice(0, Math.max(40, cut.lastIndexOf(' ')))}…`;
}

function scoreArticle(
  article: HelpArticle,
  topicLabel: string,
  words: ReturnType<typeof askWords>,
  phrase: string,
): { score: number; matched: number; titleOrTopic: boolean } {
  const title = article.title.toLowerCase();
  const topic = topicLabel.toLowerCase();
  const body = article.body.toLowerCase();
  let titleWords: string[] | null = null;
  let bodyWords: string[] | null = null;
  let score = 0;
  let matched = 0;
  let titleOrTopic = false;
  for (const w of words) {
    let best = 0;
    let headHit = false;
    for (const f of w.forms) {
      if (title.includes(f)) { best = Math.max(best, 4); headHit = true; }
      else if (topic.includes(f)) { best = Math.max(best, 2); headHit = true; }
      else if (body.includes(f)) best = Math.max(best, 1);
    }
    if (best === 0 && w.forgivable) {
      const allow = typoAllowance(w.forgivable);
      if (allow > 0) {
        titleWords ??= [...wordsOf(article.title), ...wordsOf(topicLabel)];
        bodyWords ??= wordsOf(article.body);
        if (titleWords.some((x) => withinEdits(w.forgivable!, x, allow))) { best = 2; headHit = true; }
        else if (bodyWords.some((x) => withinEdits(w.forgivable!, x, allow))) best = 0.5;
      }
    }
    if (best > 0) {
      matched += 1;
      score += best;
      if (headHit) titleOrTopic = true;
    }
  }
  if (phrase.length > 0 && matched > 0) {
    // The question IS the title ("what is setnayan" → "What is Setnayan?", above "What is Setnayan AI?").
    if (title.replace(/[^a-z0-9' ]+/g, ' ').trim().replace(/\s+/g, ' ') === phrase) score += 10;
    else if (title.includes(phrase)) score += 6;
    else if (body.includes(phrase)) score += 2;
  }
  return { score, matched, titleOrTopic };
}

/** Ask the help a question. `topics` are already this reader's (coverage, store shell). */
export function askHelp(query: string, topics: ReadonlyArray<AskTopic>): AskResult {
  const words = askWords(query);
  if (words.length === 0) return { outcome: 'none', best: null, more: [], near: [] };
  const phrase = query.toLowerCase().split(/[^a-z0-9']+/i).filter(Boolean).join(' ');
  const floor = Math.ceil(words.length / 2);
  const over: AskHit[] = [];
  const under: AskHit[] = [];
  const seen = new Set<string>();
  for (const topic of topics) {
    for (const a of topic.articles) {
      if (seen.has(a.slug)) continue;
      const s = scoreArticle(a, topic.label, words, phrase);
      if (s.matched === 0) continue;
      seen.add(a.slug);
      const hit: AskHit = {
        slug: a.slug,
        title: a.title,
        body: a.body,
        lead: leadOf(a.body),
        topicKey: topic.key,
        topicLabel: topic.label,
        matched: s.matched,
        asked: words.length,
        score: s.score,
        notInApp: a.body === HELP_NOT_IN_THE_APP,
      };
      (s.matched >= floor && s.titleOrTopic ? over : under).push(hit);
    }
  }
  const order = (x: AskHit, y: AskHit) => y.matched - x.matched || y.score - x.score || x.title.localeCompare(y.title);
  over.sort(order);
  under.sort(order);
  const [best, ...rest] = over;
  if (!best) return { outcome: under.length > 0 ? 'near' : 'none', best: null, more: [], near: under.slice(0, ASK_NEAR_LIMIT) };
  return {
    outcome: best.matched === best.asked ? 'best' : 'closest',
    best,
    more: rest.slice(0, ASK_MORE_LIMIT),
    near: [],
  };
}

/** Whether a question should land in the team's "No answer yet" list. */
export function askNeedsAnAnswer(outcome: AskOutcome): boolean {
  return outcome !== 'best';
}
