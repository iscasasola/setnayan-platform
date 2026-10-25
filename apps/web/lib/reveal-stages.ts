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
 * `revealOnlyOnTheFirstPage` below, read by the overlay. (⚠ 2026-10-17: the
 * LIFTED veil is no longer gone — it stays as the drape on the cover and
 * returns with it; see `drapeShows`. The opening still never closes again.)
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
 * 🎭 HIDDEN ON THIS STAGE (the new Maker's Reveal part, owner 2026-10-06:
 * *"Reveal must be placed as the first scenes for the Save the Date, Inviting
 * and The Day. So we can say if it will show or be hidden"*) — the ONE stage
 * named turned on or off; every other stage exactly as it was. The shipped
 * "Where it plays" switches write through this too (`maker-reveal.tsx`).
 * Held by `lib/the-reveal-hides-one-stage.test.ts`.
 */
export function revealStagesWith(stages: readonly RevealStage[], stage: RevealStage, shown: boolean): RevealStage[] {
  return REVEAL_STAGE_CHOICES.filter((s) => (s === stage ? shown : stages.includes(s)));
}

/**
 * Off the Save the Date the opening belongs to the hero scene only: scrolling
 * past the first page before it is opened retires it, and once opened its
 * lifted drape lives and leaves with the cover (`drapeShows`, 2026-10-17 —
 * it used to be gone ~2 s after the lift). The Save the Date's
 * own opening leads its film and keeps its valance while the film plays.
 *
 * (Who is met at all is `landedOnTheFirstPage`, on EVERY stage: a guest who
 * lands part-way down gets no opening — and on the Save the Date no film either,
 * which `StdFilmHandoff` lifts for that landing. 2026-09-29.)
 */
export function revealOnlyOnTheFirstPage(stage: LifecyclePhase): boolean {
  return stage !== 'save_the_date';
}

/**
 * 🎭 THE LIFTED VEIL STAYS WITH THE COVER (owner 2026-10-17, verbatim, looking at live `/cale-ice` after an unveil:
 * *"the veil disappears. it shouldn't. it should stay until cover is gone. and return when cover scene returns"*).
 * This SUPERSEDES, for the drape only, the 2026-09-25 "once opened it is gone for the visit" above: off the Save the
 * Date, once the guest has unveiled, the lifted veil — the drape at the top — stays on the Cover Scene for as long as
 * any of the cover is on screen, leaves WITH it as the guest scrolls into the event, and comes back with it when they
 * scroll up again. It never closes again: one unveil per visit (`keepsOpen`, `veil-reveal.tsx`).
 *
 * "The cover is gone" is the SAME edge the bars use (`cover-scene-menu.tsx`, owner 2026-10-16: the bars arrive only
 * once the cover is fully gone) — so the drape and the bars are never on screen together.
 *
 * The cover is `header[data-cover-scene]` (`COVER_SCENE_ATTR`, `lib/cover-scene.ts` — kept as text here so the guest
 * overlay does not import the cover's theme tables; `the-veil-stays-with-the-cover.test.ts` holds the two equal). A
 * page with no Cover Scene keeps the first screen as its cover; a cover that is not drawn (another tab) is gone.
 */
export const COVER_SCENE_SELECTOR = 'header[data-cover-scene]';

/** Is any of the cover on screen? Its box against the screen — the bars' own edge (bottom past the top = gone). */
export function coverOnScreen(cover: { top: number; bottom: number } | null, viewportHeight: number): boolean {
  if (!cover) return false;
  return cover.bottom > 0 && cover.top < Math.max(1, viewportHeight);
}

/** The drape rides the cover's top edge as it scrolls away (never pushed DOWN by a cover that starts lower). */
export function drapeShift(coverTop: number): number {
  return Number.isFinite(coverTop) ? Math.min(0, coverTop) : 0;
}

/** Is the drape drawn? Only after the unveil, and exactly while the cover is on screen. */
export function drapeShows(input: { unveiled: boolean; coverInView: boolean }): boolean {
  return input.unveiled && input.coverInView;
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
