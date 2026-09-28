/**
 * hero-design-of.ts — WHICH OF THE FOUR HERO DESIGNS THIS PAGE WEARS, answered
 * once for the page and its loading screen.
 *
 * The design lives on the hero row's canvas (`invitation_widgets.config_json
 * .canvas.design`, `lib/hero-design.ts`). The page body reads it in
 * `site-body.tsx`; the loading screen (`invitation-skeleton.tsx`, the Suspense
 * fallback in `page.tsx`) used to not read it at all, so it always drew
 * Design 1 · The Card — and an Event Hub on The Marquee, The Crest or The
 * Letter flashed the wrong design before its own arrived (owner: "loading
 * skeleton = the page").
 *
 * 🔒 ONE RESOLVER. Both sides call `heroCanvasOf` → `heroDesignOf`; neither
 * finds the hero row or reads `design` its own way. A second resolver is how
 * the skeleton and the page would come to disagree about the same row.
 *
 * `heroDesignForSkeleton` adds the one thing the page body does to the rows
 * first: in the Maker's canvas the couple's DRAFT is overlaid on the live rows
 * (`overlayHubDraftWidgets`) — which is exactly where a design is picked, so a
 * canvas reload after a pick must load in the picked design, not the live one.
 *
 * Pure. No I/O.
 */
import { sanitizeHubCanvas, type HubSectionCanvas } from '@/lib/hub-canvas';
import { heroDesignOf, type HeroDesignId } from '@/lib/hero-design';
import { overlayHubDraftWidgets, type HubDraft } from '@/lib/hub-draft';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';

/** The hero row's canvas — `{}` when there is no hero row or no canvas. */
export function heroCanvasOf(
  widgets: readonly Pick<InvitationWidgetRow, 'widget_type' | 'config_json'>[],
): HubSectionCanvas {
  return sanitizeHubCanvas(widgets.find((w) => w.widget_type === 'hero')?.config_json);
}

/**
 * The design the loading screen draws: the rows the page body will render
 * (live, with the host's draft over them in the Maker canvas — `draft` is null
 * for every guest), through the same two functions the body uses.
 */
export function heroDesignForSkeleton(
  widgets: readonly InvitationWidgetRow[],
  draft: HubDraft | null,
): HeroDesignId {
  return heroDesignOf(heroCanvasOf(overlayHubDraftWidgets(widgets, draft)));
}
