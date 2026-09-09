import { formatPhp } from '@/lib/vendors';
import {
  THREAD_STAGE_LABEL,
  resolveThreadStage,
  type ThreadStage,
} from '@/lib/vendor-thread-stage';

/**
 * WHERE THIS SUPPLIER STANDS — one sentence, derived once, drawn wherever the
 * couple is looking.
 *
 * ── WHAT THE BENCH COULD NOT SAY ────────────────────────────────────────────
 * A shortlist card offers **Add to build · Open conversation · Lock this**, and
 * says nothing at all about WHERE THINGS STAND. "Open conversation" looks
 * identical whether the supplier answered an hour ago, sent a quote that is
 * waiting on the couple, or went quiet three weeks back — so the only way to
 * find out was to open every one of them. Three caterers side by side in a
 * category row is a comparison the couple cannot actually make.
 *
 * With this line under the meta block, they can:
 *
 *     Garden Buffet   — Quoted ₱187,500 · waiting on you
 *     Lumen Kitchen   — Replied yesterday
 *     Verde Catering  — No reply · 12 days
 *
 * ── WHY A MODULE AND NOT A COMPONENT ────────────────────────────────────────
 * Owner, 2026-09-09: *"yes, it is fine to show it twice."* The same sentence may
 * sit on the bench card, shortened in the sticky Picks column, and again inside
 * the conversation's Decisions view. **What makes that safe is that it is
 * DERIVED ONCE and rendered several times — never three derivations.** The v3
 * prototype broke that rule inside a single file: its bench card read *"they
 * haven't confirmed it yet · price not answered"* while the same couple's
 * Decisions line read *"nothing needs you"*. Two hand-typed sentences, already
 * disagreeing before either shipped.
 *
 * So: no React, no I/O, no fetching. Facts in, segments out.
 *
 * ── ⛔ THE STAGE IS NOT DERIVED HERE, AND MUST NEVER BE ──────────────────────
 * `resolveThreadStage` is the ONE ladder and this module is a CONSUMER of it.
 * The rung arrives already decided, and the word printed for it comes from
 * `THREAD_STAGE_LABEL` — so a rung outside the five cannot reach a card even by
 * accident, and a rung renamed there is renamed here for free. A fourth private
 * ranking is the failure this repo keeps producing; see the note on
 * `STAGE_VOICE` for how the per-rung copy decisions stay honest.
 */

/**
 * A piece of the sentence. The renderer decides what each looks like; this
 * module decides what each SAYS and never spells a rung itself.
 */
export type StandingSegment =
  /** The rung's own word, from `THREAD_STAGE_LABEL`, with the quote beside it
   *  when the quote is the news. */
  | { kind: 'stage'; stage: ThreadStage; amountPhp: number | null }
  /** Quiet ink — context, not a call to act. "No reply · 12 days". */
  | { kind: 'quiet'; text: string }
  /** Full-strength ink — something happened. "Replied yesterday". */
  | { kind: 'said'; text: string }
  /** The one segment that asks the couple for something. "waiting on you". */
  | { kind: 'need'; text: string };

export type SupplierStanding = {
  segments: StandingSegment[];
  /**
   * The supplier spoke last and the couple has not answered — what the page's
   * roll-up counts. NOT the same as `needsYou`: a supplier can reply with a
   * question that carries no quote, and that is still a reply worth opening.
   */
  replied: boolean;
  /** A quote is out and the answer is the couple's to give. */
  needsYou: boolean;
};

/** Who said the last thing in the thread. */
export type StandingSpeaker = 'couple' | 'vendor';

export type SupplierStandingFacts = {
  /**
   * ⛔ ALREADY DECIDED by `resolveThreadStage`. Passing a hand-computed rung
   * here is the second ranking this module exists to prevent.
   */
  stage: ThreadStage;
  /**
   * Is there a conversation at all?
   *
   * 🔑 THE MOST IMPORTANT FACT ON THIS TYPE. The bench is mostly strangers —
   * suppliers the couple shortlisted and has never written to. Every clause
   * below is a claim about a conversation, so without one there is no sentence:
   * "No reply · 12 days" under a supplier nobody ever contacted would be a
   * fabricated grievance, and it would be on most of the page.
   */
  hasThread: boolean;
  /** The live proposal total, in pesos. Same rows that decided the rung. */
  quotedAmountPhp: number | null;
  /** Null when the thread is open but empty — nobody has said anything yet. */
  lastSpeaker: StandingSpeaker | null;
  lastSaidAtMs: number | null;
  nowMs: number;
};

/**
 * THE LADDER'S FLOOR, asked of the resolver rather than typed.
 *
 * The floor rung is the one that adds nothing: "Inquiry · Replied yesterday"
 * says the same as "Replied yesterday" and costs the card a line it does not
 * have. Deriving it from `resolveThreadStage({ …all false })` means this rule
 * cannot drift from the ladder, and this module writes no rung name to express
 * it — exactly the sabotage `the-conversation-list-says-what-it-shows.test.ts`
 * was rewritten to catch on the builders.
 */
const LADDER_FLOOR: ThreadStage = resolveThreadStage({
  completed: false,
  booked: false,
  quoted: false,
  cancelled: false,
});

/** What a rung is allowed to say on a card. */
type StageVoice = {
  /** The quote total rides beside the rung's word — only where it is NEWS. */
  carriesAmount: boolean;
  /**
   * A reply clause belongs here. A finished or abandoned conversation gets
   * none: "Completed · No reply · 40 days" reads as a complaint about a job
   * that is done.
   */
  saysReplyClause: boolean;
  /** On this rung, a supplier who spoke last has left the ball with the couple. */
  answerIsOwedByCouple: boolean;
};

/**
 * ONE TABLE, EXHAUSTIVE BY TYPE — the only place a per-rung copy decision
 * lives.
 *
 * Written as a `Record<ThreadStage, …>` on purpose: a sixth rung added to the
 * ladder fails the BUILD here rather than silently falling through to a default
 * and rendering a card that says less than it should. And because the rung's
 * word itself always comes from `THREAD_STAGE_LABEL`, no entry in this table
 * can put a word on a card that the ladder does not have.
 */
const STAGE_VOICE: Record<ThreadStage, StageVoice> = {
  // A bare inquiry: the reply clause carries the whole sentence.
  inquiry: { carriesAmount: false, saysReplyClause: true, answerIsOwedByCouple: false },
  // The one rung where a number is the news, and the one where the couple owes
  // the answer — "Quoted ₱187,500 · waiting on you".
  quoted: { carriesAmount: true, saysReplyClause: true, answerIsOwedByCouple: true },
  // ⚖ BOOKED CARRIES NO AMOUNT. The card already prints the price two lines up;
  // repeating it under the booking is noise, and the news on a booked card is
  // whether anything is still waiting.
  booked: { carriesAmount: false, saysReplyClause: true, answerIsOwedByCouple: false },
  completed: { carriesAmount: false, saysReplyClause: false, answerIsOwedByCouple: false },
  cancelled: { carriesAmount: false, saysReplyClause: false, answerIsOwedByCouple: false },
};

const DAY_MS = 86_400_000;

/**
 * How long ago, in a couple's words. Whole days only — an hours-precise
 * "Replied 4 hours ago" invites refreshing the page, and the question this line
 * answers is "which of these three should I open", not "when exactly".
 */
function agoLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

/** Whole days between two instants, floored, never negative. */
function daysBetween(fromMs: number, toMs: number): number {
  return Math.max(0, Math.floor((toMs - fromMs) / DAY_MS));
}

/**
 * THE SENTENCE. Returns null when there is nothing true to say — which is most
 * of the bench, and is the correct answer there.
 */
export function buildSupplierStanding(facts: SupplierStandingFacts): SupplierStanding | null {
  // No conversation ⇒ no standing. See `hasThread` above: this is the branch
  // that keeps an invented grievance off every stranger's card.
  if (!facts.hasThread) return null;

  const voice = STAGE_VOICE[facts.stage];
  const segments: StandingSegment[] = [];

  if (facts.stage !== LADDER_FLOOR) {
    segments.push({
      kind: 'stage',
      stage: facts.stage,
      amountPhp: voice.carriesAmount ? facts.quotedAmountPhp : null,
    });
  }

  let replied = false;
  let needsYou = false;

  if (voice.saysReplyClause) {
    const days =
      facts.lastSaidAtMs == null ? null : daysBetween(facts.lastSaidAtMs, facts.nowMs);

    if (facts.lastSpeaker === 'vendor') {
      // They answered. Whether that answer is the couple's to act on depends on
      // the rung, not on the words in it — a quote out with the couple is the
      // one case where the page can honestly say the wait is theirs.
      if (voice.answerIsOwedByCouple) {
        needsYou = true;
        segments.push({ kind: 'need', text: 'waiting on you' });
      } else {
        segments.push({ kind: 'said', text: `Replied ${agoLabel(days ?? 0)}` });
      }
      replied = true;
    } else if (days != null) {
      // The couple spoke last (or the thread was opened and nobody has written
      // in it yet) — so the wait is the supplier's.
      //
      // ⚖ QUIET, NOT ALARMED. A supplier who has not answered in twelve days
      // may be at a wedding. This line exists so the couple knows which card to
      // open, not to accuse anyone, and it is never the colour reserved for
      // things they must do.
      segments.push({
        kind: 'quiet',
        text: days === 0 ? 'Sent today' : `No reply · ${days} ${days === 1 ? 'day' : 'days'}`,
      });
    }
  }

  // ⚠ A STANDING IS NEVER AN EMPTY LINE. A card that renders the label "Where
  // you stand" over nothing reads as a sentence that failed to load — the same
  // disease as a refused read drawing an empty state. If nothing was true
  // enough to say, say nothing at all and let the card close up.
  if (segments.length === 0) return null;

  return { segments, replied, needsYou };
}

/**
 * The sentence as plain text — for the card's `aria-label`, for the shortened
 * copy in the Picks column, and for tests to assert on without a renderer.
 *
 * 🔑 THE RUNG'S WORD COMES FROM `THREAD_STAGE_LABEL`, HERE AND IN THE
 * COMPONENT. That is what makes "only those five words may wear a stage word"
 * true by construction rather than by vigilance.
 */
export function standingSentence(standing: SupplierStanding): string {
  return standing.segments
    .map((s) => {
      if (s.kind !== 'stage') return s.text;
      const word = THREAD_STAGE_LABEL[s.stage];
      return s.amountPhp == null ? word : `${word} ${formatPhp(s.amountPhp)}`;
    })
    .join(' · ');
}

/** The micro-label above the sentence on a card. */
export const STANDING_LABEL = 'Where you stand';

export type StandingRollUp = {
  /** How many suppliers have answered and are waiting on the couple. */
  count: number;
  /** "2 suppliers replied" */
  headline: string;
  /** The names, in bench order, for the quiet half of the line. */
  names: string[];
};

/**
 * THE ROLL-UP — the same derivation, counted.
 *
 * One line at the top of the bench, above every folder, so the couple learns
 * there is something to read before they open a single category. It is not a
 * second opinion about anything: it counts the standings the cards below it are
 * already showing.
 *
 * Returns null when nobody has replied — an empty roll-up is a banner that
 * teaches the couple to ignore banners.
 */
export function standingRollUp(
  entries: ReadonlyArray<{ name: string; standing: SupplierStanding | null }>,
): StandingRollUp | null {
  const names = entries.filter((e) => e.standing?.replied).map((e) => e.name);
  if (names.length === 0) return null;
  return {
    count: names.length,
    headline: `${names.length} supplier${names.length === 1 ? '' : 's'} replied`,
    names,
  };
}
