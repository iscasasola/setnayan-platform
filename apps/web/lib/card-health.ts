/**
 * CARD HEALTH — the deterministic quality score that regulates publishing on
 * the zero-step service card maker (owner-locked 2026-07-27, "THE MAKER IS ZERO
 * STEPS"; artifact 15007a4d).
 *
 * ── WHAT IT IS ─────────────────────────────────────────────────────────────
 * An ad platform's quality score, for a vendor's service card. The maker has no
 * steps and therefore no progress bar; this score IS the progress. It answers
 * one question on every keystroke — "is this card worth putting in front of a
 * couple?" — and it answers it in three lanes:
 *
 *   • BLOCKERS  the real publish gate. The card cannot go live.
 *   • WARNINGS  it can go live, but something about it will cost the vendor.
 *   • HINTS     it can go live and it is fine; this would make it better.
 *
 * ── RULE 1: NO LLM, EVER ───────────────────────────────────────────────────
 * Plain rules over a plain snapshot. Pure, synchronous, no I/O, no network, no
 * per-call cost — it runs on every keystroke of every vendor for ₱0. That is
 * not an implementation detail, it is the reason the score can be live at all.
 *
 * ── THE ONE RULE THAT SHAPES THE NUMBER ────────────────────────────────────
 * A BLOCKER CAPS THE SCORE AT 30 AND FORCES THE GRADE TO 'blocked'. An ad that
 * cannot run has no quality — a card with a beautiful gallery, six inclusions
 * and no cover photo is not an 88, it is unpublishable. Warnings cap at 60 and
 * hints cap at 80 on the same logic, one rung at a time: the ceiling says what
 * the card IS, the deductions say how far below its own ceiling it sits.
 * Break that cap and a NAMED test fails — see card-health.test.ts
 * § "NEUTRALISATION".
 *
 * ── WHERE THE RULES COME FROM (nothing here is invented) ───────────────────
 * • price + Setnayan Exclusive — `unmetPublishRequirements`
 *   (lib/service-publish-gate.ts), the SAME function the two server actions and
 *   the `enforce_service_publish_gate` database trigger ask. This module holds
 *   no copy of that rule.
 * • cover photo — the wizard's own client-side `canPublish`. Deliberately NOT
 *   in the shared gate: the server has never required one, so putting it there
 *   would be a new server rule smuggled in as a refactor. It stays a blocker
 *   HERE, which only ever makes the maker stricter than the save — the safe
 *   direction.
 * • card text — `findVendorTextViolation` (lib/service-text-integrity.ts),
 *   which runs the chat detector's 'card' profile. It is FLAG-GATED: with
 *   NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED off it returns null, so this
 *   module reports no text blockers either. That is deliberate — the score must
 *   mirror the REAL gate, never a stricter imaginary one.
 * • pick-N vs option count — `vendor_package_items_pick_range_ck` territory: a
 *   "pick 3 of 2" is a question the couple can never finish answering.
 * • blank names are NEVER a finding. They are auto-named at the save path
 *   (`autoName`, owner-locked 2026-07-27 "saving builds blank will make us
 *   autocreate a name") and this module names them the same way when it has to
 *   quote a line back to the vendor.
 */
import { autoName, findVendorTextViolation } from './service-text-integrity';
import {
  PUBLISH_COACH_MESSAGE,
  exclusiveIsSet,
  unmetPublishRequirements,
} from './service-publish-gate';
import { isFollowUp, lineStateOf, type LineState } from './service-customization-draft';
import type { DraftItem } from './package-authoring';

/**
 * Which region of the card a finding belongs to. Every one of these is a real
 * surface on the canvas — 'title' is the inline field on the card face, the
 * rest each open their own bottom sheet. The coach chip deep-links here, so a
 * finding without a reachable home is a bug, not a copy problem.
 */
export type CardHealthSheet =
  | 'media'
  | 'price'
  | 'excl'
  | 'custom'
  | 'audience'
  | 'title';

export type CardHealthGrade = 'blocked' | 'poor' | 'average' | 'good' | 'excellent';

/** One line of a customization draft, flattened to what the score cares about. */
export type CardHealthLine = {
  /** What the couple reads. Blank is legal — it is auto-named at save. */
  label: string;
  state: LineState;
  /** A follow-up only appears after one option is picked, so it is not a
   *  top-level question and does not count toward the question budget. */
  isFollowUp: boolean;
  optionLabels: string[];
  pickMin: number | null;
  pickMax: number | null;
};

/**
 * Everything the score reads. Deliberately PLAIN — no DraftItem, no FormData,
 * no React — so the rules can be tested without mounting anything. The canvas
 * builds this from its live FormData snapshot; `cardHealthLinesFromDraft`
 * converts the customization half.
 */
export type CardHealthSnapshot = {
  hasCover: boolean;
  /** Showcase gallery photos (the cover is separate and not counted here). */
  photoCount: number;
  hasClip: boolean;
  /**
   * Any of the three bases resolved to a real figure (a typed `0` is NOT one —
   * see `priceIsSet`). FALSE IS A BLOCKER since 2026-08-28: the card cannot
   * publish. This reverses the rule that stood here before, which argued a
   * missing price was a hint because "quote on request is a real answer" — the
   * owner has ruled the other way, because a card carrying no figure has
   * nothing a couple's budget can be matched against, so nobody finds it. The
   * quoted figure is still the real one; what must exist is a STARTING number.
   */
  hasPrice: boolean;
  title: string;
  exclusiveText: string;
  /**
   * Inclusion labels and discount conditions, in submitted order.
   *
   * THESE ARE NOT OPTIONAL EXTRAS — they are half the real gate. The save path
   * text-checks `Inclusion N` and `Discount N conditions` alongside the title,
   * the Exclusive and the customization lines. A snapshot without them scores a
   * card 100 / "Ready to publish" and then the server bounces the save, which
   * is the worst possible order for the vendor to find out.
   */
  inclusionLabels: string[];
  discountConditions: string[];
  lines: CardHealthLine[];
  /** vendor_coverages.event_types for the coverage this card sits in. */
  eventTypes: string[];
  /** vendor_coverages.faiths. EMPTY IS CORRECT — it means "all faiths
   *  welcomed" (the shipped couple-side filter treats empty as compatible with
   *  everyone), so an empty array is never a finding. */
  faiths: string[];
};

export type CardHealthFinding = {
  /** Stable machine name — tests and analytics key off this, never the copy. */
  code: string;
  message: string;
  sheet: CardHealthSheet;
};

export type CardHealthNextAction = {
  /** The whole coach line, ready to render. */
  label: string;
  /** null = nothing left to do; the card is ready to publish. */
  sheet: CardHealthSheet | null;
};

export type CardHealth = {
  score: number;
  grade: CardHealthGrade;
  /** One sentence under the meter that explains the grade in the vendor's terms. */
  band: string;
  blockers: CardHealthFinding[];
  warnings: CardHealthFinding[];
  hints: CardHealthFinding[];
  nextAction: CardHealthNextAction;
  /** Top-level questions a couple must answer before the price settles. */
  questionCount: number;
};

// ── Scoring constants ────────────────────────────────────────────────────────
// Named so the caps read as the rule they are, not as three magic numbers.

/** A card that cannot publish has no quality. Blockers pin the ceiling here. */
export const BLOCKED_SCORE_CAP = 30;
/** Something will cost the vendor — it can publish, but not as a good card. */
export const WARNING_SCORE_CAP = 60;
/** Fine, but leaving value on the table — cannot reach "excellent". */
export const HINT_SCORE_CAP = 80;
/** Floor. A card is never a zero; there is always something already on it. */
export const SCORE_FLOOR = 12;

const WARNING_DEDUCTION = 15;
const HINT_DEDUCTION = 12;

/** More top-level questions than this and the inquiry starts to feel like a form. */
const QUESTION_BUDGET = 6;
/** Below this many gallery photos, a clip is what saves the card. */
const THIN_GALLERY_PHOTOS = 3;

/** The coach line's own vocabulary. Kept here so the copy is testable. */
const NEXT_PREFIX = '▸ Next: ';
export const READY_LABEL = '✓ Ready — publish';

/**
 * Flatten a customization draft into the score's line shape.
 *
 * Lives here (not in the component) so the conversion is unit-tested with the
 * rules that consume it — a wrong `isFollowUp` would silently inflate the
 * question count and nothing would notice.
 */
export function cardHealthLinesFromDraft(
  items: ReadonlyArray<DraftItem>,
): CardHealthLine[] {
  return items.map((item) => ({
    label: item.service_description,
    state: lineStateOf(item),
    isFollowUp: isFollowUp(item),
    optionLabels: item.options.map((o) => o.label),
    pickMin: item.pickMin ?? null,
    pickMax: item.pickMax ?? null,
  }));
}

/** The name to quote back for a line — its own, or the one the save will give it. */
function displayName(line: CardHealthLine, index: number): string {
  const own = line.label.trim();
  return own.length > 0 ? own : autoName('item', index);
}

/**
 * Score a card.
 *
 * Pure and total: every branch returns, nothing throws, and the same snapshot
 * always produces the same CardHealth.
 */
export function scoreCardHealth(snapshot: CardHealthSnapshot): CardHealth {
  const blockers: CardHealthFinding[] = [];
  const warnings: CardHealthFinding[] = [];
  const hints: CardHealthFinding[] = [];

  // ── BLOCKERS — the real publish gate ──────────────────────────────────────
  if (!snapshot.hasCover) {
    blockers.push({
      code: 'no_cover',
      sheet: 'media',
      message: 'Add a cover photo — required to publish.',
    });
  }
  // The price and the Setnayan Exclusive are not this module's opinion — they
  // are THE publish gate, asked of the one function the server actions and the
  // database trigger also ask (lib/service-publish-gate.ts). Adding a
  // requirement there lights it up here with no edit; that is the point.
  const REQUIREMENT_SHEET: Record<'price' | 'exclusive', CardHealthSheet> = {
    price: 'price',
    exclusive: 'excl',
  };
  const REQUIREMENT_CODE: Record<'price' | 'exclusive', string> = {
    price: 'no_price',
    exclusive: 'no_exclusive',
  };
  for (const requirement of unmetPublishRequirements({
    hasPrice: snapshot.hasPrice,
    hasExclusive: exclusiveIsSet(snapshot.exclusiveText),
  })) {
    blockers.push({
      code: REQUIREMENT_CODE[requirement],
      sheet: REQUIREMENT_SHEET[requirement],
      message: PUBLISH_COACH_MESSAGE[requirement],
    });
  }

  // ── Card text, judged by the SHIPPED detector's 'card' profile ────────────
  //
  // THIS MUST MIRROR `commitVendorService`'s check EXACTLY — every field it
  // checks, under the same label, in the same reading order. It previously
  // covered the title, the Exclusive and the customization lines but NOT
  // inclusion labels or discount conditions, so "Free album — text 0917 555
  // 1234" typed into an inclusion scored 100 / "✓ Ready — publish" and was then
  // bounced by the server. The same string one field over (a customization
  // option) was caught. A gate the preview only half-knows is worse than no
  // preview: it teaches the vendor to distrust the score.
  //
  // Checked in GROUPS rather than one batch because `findVendorTextViolation`
  // returns only the first violation as a sentence — the grouping is how the
  // coach chip knows which region to open. Blank values are skipped by the
  // detector itself (they are auto-named at save, never refused).
  const textGroups: {
    code: string;
    sheet: CardHealthSheet;
    fields: { field: string; value: string | null | undefined }[];
  }[] = [
    // Labels are the server's, verbatim: 'Title' (not "Listing title"),
    // 'Inclusion N', 'Discount N conditions', 'Customization line N option M'.
    // The vendor reads the same sentence here and in a server bounce.
    { code: 'text_title', sheet: 'title', fields: [{ field: 'Title', value: snapshot.title }] },
    {
      code: 'text_exclusive',
      sheet: 'excl',
      fields: [{ field: 'Setnayan Exclusive', value: snapshot.exclusiveText }],
    },
    {
      code: 'text_inclusions',
      sheet: 'custom', // the InclusionsEditor lives in "What couples get"
      fields: snapshot.inclusionLabels.map((label, i) => ({
        field: `Inclusion ${i + 1}`,
        value: label,
      })),
    },
    {
      code: 'text_discounts',
      sheet: 'price', // the DiscountsEditor lives in the Price sheet
      fields: snapshot.discountConditions.map((conditions, i) => ({
        field: `Discount ${i + 1} conditions`,
        value: conditions,
      })),
    },
    {
      code: 'text_lines',
      sheet: 'custom',
      fields: snapshot.lines.flatMap((line, i) => [
        { field: `Customization line ${i + 1}`, value: line.label },
        ...line.optionLabels.map((label, o) => ({
          field: `Customization line ${i + 1} option ${o + 1}`,
          value: label,
        })),
      ]),
    },
  ];
  for (const group of textGroups) {
    const violation = findVendorTextViolation(group.fields);
    if (violation) {
      blockers.push({ code: group.code, sheet: group.sheet, message: violation });
    }
  }

  // A "pick 3 of 2" is a question the couple can never finish answering.
  snapshot.lines.forEach((line, i) => {
    if (line.state !== 'choice') return;
    const want = line.pickMax;
    if (want == null) return;
    const have = line.optionLabels.length;
    if (want <= have) return;
    blockers.push({
      code: 'pick_overflow',
      sheet: 'custom',
      message: `“${displayName(line, i)}” asks to pick ${want} of ${have} — impossible to finish.`,
    });
  });

  // ── WARNINGS — publishable, but it will cost the vendor ───────────────────
  const questionCount = snapshot.lines.filter(
    (l) =>
      !l.isFollowUp &&
      (l.state === 'choice' || l.state === 'quantity' || l.state === 'optional'),
  ).length;
  if (questionCount > QUESTION_BUDGET) {
    warnings.push({
      code: 'too_many_questions',
      sheet: 'custom',
      message:
        `Couples answer ${questionCount} questions before the price settles — ` +
        'fold the rare ones into follow-ups; they only appear when picked.',
    });
  }

  // ── HINTS — fine as it is; this would lift it ─────────────────────────────
  if (snapshot.photoCount < THIN_GALLERY_PHOTOS && !snapshot.hasClip) {
    hints.push({
      code: 'thin_media',
      sheet: 'media',
      message:
        'Show the real thing — a short clip and your best shots sell this card ' +
        'better than any description.',
    });
  }
  snapshot.lines.forEach((line, i) => {
    if (line.state !== 'choice') return;
    if (line.optionLabels.length >= 2) return;
    hints.push({
      code: 'choice_of_one',
      sheet: 'custom',
      message: `“${displayName(line, i)}” is a choice of one — add options, or make it Included.`,
    });
  });
  if (snapshot.eventTypes.length === 0) {
    hints.push({
      code: 'no_event_types',
      sheet: 'audience',
      message:
        'Nobody is searching for this yet — pick the events you serve so couples ' +
        'planning them can find this card.',
    });
  }

  // ── The number ────────────────────────────────────────────────────────────
  // Deductions say how far below its own ceiling the card sits; the caps say
  // which ceiling it is under. Blockers are applied LAST so they always win.
  let score = 100 - warnings.length * WARNING_DEDUCTION - hints.length * HINT_DEDUCTION;
  if (hints.length > 0) score = Math.min(score, HINT_SCORE_CAP);
  if (warnings.length > 0) score = Math.min(score, WARNING_SCORE_CAP);
  if (blockers.length > 0) score = Math.min(score, BLOCKED_SCORE_CAP);
  score = Math.max(SCORE_FLOOR, Math.min(100, score));

  const grade: CardHealthGrade =
    blockers.length > 0
      ? 'blocked'
      : score >= 85
        ? 'excellent'
        : score >= 65
          ? 'good'
          : score >= 40
            ? 'average'
            : 'poor';

  const band =
    grade === 'blocked'
      ? 'Fix the items below — this card can’t publish yet.'
      : grade === 'excellent'
        ? 'This card sells itself.'
        : grade === 'good'
          ? 'Solid card — the hints below would lift it.'
          : grade === 'average'
            ? 'Publishable, but thin. Couples skim past thin cards.'
            : 'Needs work before it earns inquiries.';

  // ── The coach: always exactly ONE line ────────────────────────────────────
  // Blocker → warning → hint, in that order, because the maker has no
  // navigation and this line IS the navigation. When nothing is left it turns
  // green and says so, rather than disappearing (a control that vanishes reads
  // as a bug, not as success).
  const next = blockers[0] ?? warnings[0] ?? hints[0] ?? null;
  const nextAction: CardHealthNextAction = next
    ? { label: `${NEXT_PREFIX}${next.message}`, sheet: next.sheet }
    : { label: READY_LABEL, sheet: null };

  return {
    score,
    grade,
    band,
    blockers,
    warnings,
    hints,
    nextAction,
    questionCount,
  };
}
