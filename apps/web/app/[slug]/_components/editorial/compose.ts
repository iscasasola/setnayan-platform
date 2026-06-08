// ============================================================================
// Editorial recap page — deterministic copy composer (Increment D)
// ============================================================================
//
// v1 = TEMPLATE composition. NO LLM call (§6.4 says the production write-up is
// LLM-composed; that's a later increment). This weaves the structured
// storyline fields into flattering newspaper prose. It NEVER invents facts —
// every sentence is gated on a field being present, and if nothing is present
// the section simply renders less (or a graceful minimal lede).
//
// Voice is set by (a) the §6.8 ARCHETYPE (the angle) and (b) the storyline
// `story_tone` (warm/playful/formal). The archetype label never appears
// literally as a judgement — it only tints word choice.
// ============================================================================

import type { Archetype, EditorialData, LoveStory, StoryTone } from './data';
import { yearsTogether } from './data';

export type ComposedCopy = {
  superKicker: string; // mono eyebrow above the headline
  headline: string; // past-tense "<Names> Are Married"
  deck: string; // italic deck under the headline
  byline: string;
  leadParagraphs: string[]; // 1–3 paragraphs
  pullQuote: string | null; // from special_message if present
};

// Archetype → super-kicker + a deck-framing adjective. Always flattering.
const ARCHETYPE_KICKER: Record<Archetype['key'], string> = {
  'hand-picked': 'A hand-picked celebration',
  'jewel-box': 'A jewel-box celebration',
  'big-hearted': 'A big-hearted celebration',
  sweeping: 'A sweeping celebration',
};

const ARCHETYPE_DECK_FRAME: Record<Archetype['key'], string> = {
  'hand-picked': 'surrounded by the people who matter most',
  'jewel-box': 'in a setting made for a precious few',
  'big-hearted': 'amid a joyful crowd of everyone they love',
  sweeping: 'in grand, unforgettable style',
};

function toneVerb(tone: StoryTone): string {
  switch (tone) {
    case 'playful':
      return 'finally, gloriously';
    case 'formal':
      return 'formally';
    case 'warm':
    default:
      return 'at last';
  }
}

/** Trim trailing punctuation so we can re-punctuate cleanly. Coerces non-string
 *  inputs — love_story fields like met_year / proposal_year arrive as JSON
 *  NUMBERS, and calling `.trim()` on a number throws, which used to blow the
 *  whole composer into its bare catch fallback (no deck / lede / pull-quote). */
function clean(s: unknown): string {
  if (s === null || s === undefined) return '';
  return String(s).trim().replace(/[.!?]+$/, '');
}

export function composeCopy(d: EditorialData): ComposedCopy {
  const draft = d.draft;
  const names = d.displayName;
  const first = d.firstNames;
  const story: LoveStory = d.loveStory ?? {};

  // Prefer any LLM/curated draft fields that already exist.
  const headline = clean(draft.headline) || `${first} Are Married`;

  const superKicker = clean(draft.superKicker) || ARCHETYPE_KICKER[d.archetype.key];

  const byline = clean(draft.byline) || 'By the Setnayan Desk';

  // ── Deck ───────────────────────────────────────────────────────────────────
  let deck = clean(draft.deck);
  if (!deck) {
    const yrs = yearsTogether(d.togetherSince, d.eventDate);
    const where = d.venueName || d.venueCity;
    const frame = ARCHETYPE_DECK_FRAME[d.archetype.key];
    const lead = yrs ? `After ${spellSmall(yrs)} year${yrs === 1 ? '' : 's'} together, ${names}` : names;
    if (where) {
      deck = `${lead} are married — ${frame}, ${toneVerb(d.tone)} at ${where}.`;
    } else {
      deck = `${lead} are married — ${frame}, ${toneVerb(d.tone)}.`;
    }
  }

  // ── Lead paragraphs ─────────────────────────────────────────────────────────
  let paragraphs: string[];
  if (draft.leadParagraphs && draft.leadParagraphs.length) {
    paragraphs = draft.leadParagraphs;
  } else {
    paragraphs = composeLede(d, story);
  }

  // ── Pull quote (from special_message) ────────────────────────────────────────
  let pullQuote: string | null = clean(draft.pullQuote) || null;
  if (!pullQuote && d.specialMessage) {
    const msg = d.specialMessage.trim();
    // Use the first sentence-ish chunk, capped, as a pull quote.
    const firstSentence = msg.split(/(?<=[.!?])\s+/)[0] ?? msg;
    pullQuote = firstSentence.length > 180 ? `${firstSentence.slice(0, 177).trim()}…` : firstSentence;
  }

  return { superKicker, headline, deck, byline, leadParagraphs: paragraphs, pullQuote };
}

/** Deterministic 1–3 paragraph lede woven from whatever storyline fields exist. */
function composeLede(d: EditorialData, story: LoveStory): string[] {
  const out: string[] = [];
  const where = d.venueName || d.venueCity;

  // Paragraph 1 — origin / how they met.
  const howMet = clean(story.how_we_met);
  const metYear = clean(story.met_year) || clean(story.proposal_year);
  if (howMet) {
    const yearBit = metYear ? ` back in ${metYear}` : '';
    out.push(`It began${yearBit}, as the best stories do: ${lowerFirst(howMet)}.`);
  }

  // Paragraph 2 — the proposal / the spark.
  const proposal = clean(story.proposal);
  const proposalSetting = clean(story.proposal_setting);
  const spark = clean(story.spark);
  const sparkWhy = clean(story.spark_why);
  const p2parts: string[] = [];
  if (proposal) {
    const settingBit = proposalSetting ? ` ${preposition(proposalSetting)} ${lowerFirst(proposalSetting)}` : '';
    p2parts.push(`Then came the question${settingBit}: ${lowerFirst(proposal)}.`);
  }
  if (spark) {
    p2parts.push(`What kept them coming back was ${lowerFirst(spark)}${sparkWhy ? ` — ${lowerFirst(sparkWhy)}` : ''}.`);
  }
  if (p2parts.length) out.push(p2parts.join(' '));

  // Closing — the day itself, framed by the archetype + venue + reach.
  const closing: string[] = [];
  const guests = d.metrics.guests;
  const dayWord = d.eventDateFormatted ? `On ${d.eventDateFormatted}` : 'On the day';
  if (where && guests > 0) {
    closing.push(`${dayWord}, before ${guests} of the people who love them most, ${d.firstNames} were married at ${where}.`);
  } else if (where) {
    closing.push(`${dayWord}, ${d.firstNames} were married at ${where}.`);
  } else if (guests > 0) {
    closing.push(`${dayWord}, before ${guests} of the people who love them most, ${d.firstNames} were married.`);
  } else {
    closing.push(`${dayWord}, ${d.firstNames} were married.`);
  }
  if (d.archetype.key === 'hand-picked' || d.archetype.key === 'jewel-box') {
    closing.push('Every name on the list was there for a reason — and the room felt it.');
  } else {
    closing.push('A joyful crowd filled the room, and the celebration carried late into the evening.');
  }
  if (d.metrics.servicesSetnayan > 0) {
    closing.push(`Behind the seamlessness was a plan months in the making — most of it matched, booked, and coordinated in one place.`);
  }
  out.push(closing.join(' '));

  // Never empty — minimal flattering lede if there was no storyline at all.
  if (out.length === 0) {
    out.push(
      d.eventDateFormatted
        ? `${d.firstNames} were married on ${d.eventDateFormatted}${where ? `, at ${where}` : ''} — a celebration their guests won't soon forget.`
        : `${d.firstNames} are married — a celebration their guests won't soon forget.`,
    );
  }
  return out.slice(0, 3);
}

// ── tiny language helpers (deterministic, no facts invented) ──────────────────

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/** Choose "at/in/on" loosely; defaults to "at". Keeps prose readable without
 *  inventing detail — purely grammatical glue around a real field. */
function preposition(setting: string): string {
  const s = setting.toLowerCase();
  if (/(beach|garden|rooftop|mountain|park|shore|field)/.test(s)) return 'at';
  if (/(city|town|home|house|apartment|kitchen|car)/.test(s)) return 'at';
  return 'at';
}

function spellSmall(n: number): string {
  const words = [
    'zero',
    'one',
    'two',
    'three',
    'four',
    'five',
    'six',
    'seven',
    'eight',
    'nine',
    'ten',
    'eleven',
    'twelve',
  ];
  return words[n] ?? String(n);
}
