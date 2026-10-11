/**
 * WHICH LOADING SCREEN THE EVENT HUB DRAWS — the page's own, or a quiet one.
 *
 * A guest's walk, 2026-10-11 (fault N07): on an event in its Save the Date
 * stage the loading screen drew the INVITATION's cover — the names stacked,
 * "invite you to celebrate their wedding", the cover's link down, two grey
 * scene cards — for about a second and a half, and then the full-screen film
 * replaced all of it. The owner's rule for this screen is that it is the page
 * itself, loading (2026-09-27: "before the actual website runs, i see another
 * website under"; `invitation-skeleton.tsx`). For a stage whose page is NOT
 * that cover, the cover is exactly "another website under".
 *
 * So the page asks, before its slow reads, whether this visitor is about to
 * be shown the full-screen film — or the story after the day (`stageIsTheStory`)
 * — and if they may be, draws the quiet screen:
 * the couple's mark on the page's own ground, nothing else. It never draws a
 * stage's page it is not sure of.
 *
 * 🔑 THE RULE IS THE PLAN'S, NOT A SECOND ONE. `resolveSiteBodyPlan`
 * (lib/site-body-plan.ts) decides the film: the lifecycle engine is on, the
 * stage is Save the Date, this event type may have a film, the couple's lead
 * is the film (`stdShows`), and the film is not switched off for the visit.
 * `stageOpensOnTheFilm` is those five facts and nothing more;
 * `the-loading-screen-is-this-stages.test.ts` runs both across every
 * combination and fails if they ever disagree.
 *
 * WHAT IS NOT KNOWN YET, AND WHAT IS DONE ABOUT IT. A `?phase=` in the address
 * is honoured only for a host or a demo event, and who is looking is one of
 * the slow reads. So when one is asked for, BOTH stages are possible — the
 * asked one and the one the clock (or the couple's pin) gives — and the quiet
 * screen is drawn if EITHER is the film.
 *
 * NOT TOUCHED: the Maker's canvas (`?editor=1`). The film is one slide of the
 * page there, never the full-screen takeover, and that canvas keeps the
 * loading screen it has.
 */
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { stdShows, type StdLead } from '@/lib/stage-scenes';
import { solemnAdjustedPhase } from './event-words';

export type LoadingScreen = 'page' | 'quiet';

export type StageFilmFacts = {
  /** The lifecycle engine runs for this event (`phasesEnabled` in page.tsx). */
  phasesEnabled: boolean;
  /** This event type may have a Save-the-Date film (`resolveWeddingOnlyParts`). */
  mayShowStdFilm: boolean;
  /** The couple's stored pick for what leads the Save the Date; null = never chosen. */
  storedLead: StdLead | null;
  /** The film is not switched off for this visit (`?film=0`). */
  stdFilm: boolean;
};

/** Is this stage's page the full-screen Save-the-Date film? (`resolveSiteBodyPlan`'s `fullBleed`.) */
export function stageOpensOnTheFilm(phase: LifecyclePhase, facts: StageFilmFacts): boolean {
  return (
    facts.phasesEnabled &&
    phase === 'save_the_date' &&
    facts.mayShowStdFilm &&
    stdShows(facts.storedLead, facts.mayShowStdFilm) === 'film' &&
    facts.stdFilm
  );
}

/**
 * Is this stage's page the story after the day (Post Event)?
 *
 * The same fault, one stage along (found while fixing N07, built 2026-10-11 on
 * the owner's word): after the day the body is the editorial story — no cover,
 * no "invite you to celebrate", no link down to the day — and the invitation's
 * cover standing in front of it while it loads is another stage's page too.
 * The plan's own fact (`resolveSiteBodyPlan`: `showEditorial`).
 */
export function stageIsTheStory(phase: LifecyclePhase, facts: Pick<StageFilmFacts, 'phasesEnabled'>): boolean {
  return facts.phasesEnabled && phase === 'editorial';
}

export function loadingScreenFor(
  input: StageFilmFacts & {
    /** The request asks for the Maker's canvas (`asksForHostCanvas`) — left as it is. */
    hostCanvas: boolean;
    /** The stage by the venue's clock (`getLifecyclePhase`). */
    clockPhase: LifecyclePhase;
    /** The couple's pin (`manualLaunchPhase`), or null. */
    pinnedPhase: LifecyclePhase | null;
    /** A valid `?phase=` in the address — honoured or not is not known yet. */
    askedPhase: LifecyclePhase | null;
    /** The solemn register (a wake never opens on the film). */
    solemn: boolean;
  },
): LoadingScreen {
  if (input.hostCanvas) return 'page';
  const possible = [input.pinnedPhase ?? input.clockPhase, ...(input.askedPhase ? [input.askedPhase] : [])];
  return possible
    .map((p) => solemnAdjustedPhase(p, input.solemn))
    .some((p) => stageOpensOnTheFilm(p, input) || stageIsTheStory(p, input))
    ? 'quiet'
    : 'page';
}
