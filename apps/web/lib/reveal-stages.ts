import type { LifecyclePhase } from '@/lib/invitation-widgets';

/**
 * WHERE THE REVEAL PLAYS — the couple's choice (owner 2026-09-25, verbatim, in
 * "OWNER ANSWERS — SIX CONTROLLER QUESTIONS"): *"they can pick where the want to
 * keep it. having it on the invitation and on the day will onlay be during the
 * hero scene (First page) after that, it will disappear."*
 *
 * ── WHAT THIS RELAXES ───────────────────────────────────────────────────────
 * The 2026-09-14 ruling (`cinematicRevealPlays`, lib/site-body-plan.ts) had the
 * opening play in the Save-the-Date window ONLY. That is now the DEFAULT — a
 * couple who never chose (`events.reveal_stages` NULL) keeps exactly it — and
 * the couple may add the Invitation and On the Day. After the day (the story's
 * cover) is never a choice.
 *
 * ── HOW IT PLAYS OFF THE SAVE THE DATE ──────────────────────────────────────
 * On the Invitation and On the Day it plays on the HERO SCENE — the first page a
 * guest lands on — and once opened it is gone for the visit. A guest who lands
 * part-way down (a `#section` link, a restored scroll) is not stopped by it:
 * `revealOnlyOnTheFirstPage` below, read by the overlay.
 *
 * 💾 Stored in `events.reveal_stages` (text[], NULL = never chosen) and written
 * only through the Maker's draft → Apply (`lib/hub-draft.ts`). Pro gating is
 * unchanged and lives where it always did (`revealAllowedFor`): "No reveal" is
 * free, every opening is Pro — WHERE it plays is free to choose.
 */

/** The stages a couple may pick, in the order guests meet them. */
export const REVEAL_STAGE_CHOICES = ['save_the_date', 'rsvp', 'event'] as const satisfies readonly LifecyclePhase[];
export type RevealStage = (typeof REVEAL_STAGE_CHOICES)[number];

/** A couple who never chose keeps the 2026-09-14 rule: the Save the Date only. */
export const DEFAULT_REVEAL_STAGES: readonly RevealStage[] = ['save_the_date'];

export function isRevealStage(v: unknown): v is RevealStage {
  return typeof v === 'string' && (REVEAL_STAGE_CHOICES as readonly string[]).includes(v);
}

/**
 * A stored or posted value → the canonical list (deduplicated, in guest order),
 * or `undefined` when it is not a list at all. An EMPTY list is a real answer:
 * the couple switched every stage off.
 */
export function sanitizeRevealStages(raw: unknown): RevealStage[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const picked = new Set(raw.filter(isRevealStage));
  return REVEAL_STAGE_CHOICES.filter((s) => picked.has(s));
}

/** What the page reads: the couple's stages, or the default when never chosen. */
export function resolveRevealStages(raw: unknown): readonly RevealStage[] {
  return sanitizeRevealStages(raw) ?? DEFAULT_REVEAL_STAGES;
}

/** Does the couple have the reveal play on this stage? */
export function revealStageChosen(raw: unknown, stage: LifecyclePhase): boolean {
  return (resolveRevealStages(raw) as readonly string[]).includes(stage);
}

/**
 * Off the Save the Date the opening belongs to the hero scene only: it plays for
 * a guest who lands at the top of the page, and not for one who arrives part-way
 * down it. The Save the Date's own opening leads its film, so it always plays.
 */
export function revealOnlyOnTheFirstPage(stage: LifecyclePhase): boolean {
  return stage !== 'save_the_date';
}

/** Is this landing the first page? No `#section` in the address, and the page
 *  not already scrolled past most of the first screen. Pure over its inputs. */
export function landedOnTheFirstPage(input: { hash: string; scrollY: number; viewportHeight: number }): boolean {
  if (input.hash && input.hash !== '#') return false;
  return input.scrollY < Math.max(1, input.viewportHeight) * 0.5;
}

/** The words for each choice — the one stage vocabulary's, never retyped. */
export function revealStagesSentence(stages: readonly RevealStage[], label: (s: RevealStage) => string): string {
  if (stages.length === 0) return 'nowhere yet';
  const words = stages.map(label);
  return words.length === 1 ? words[0]! : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}
