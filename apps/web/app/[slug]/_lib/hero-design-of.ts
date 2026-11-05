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
import { HUB_HERO_ELEMENT_KEYS, sanitizeHubElementMotion, type HubHeroElementKey } from '@/lib/element-style';

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

/**
 * 👻 THE HERO PARTS THAT ARRIVE WITH A BUILD IN OF THEIR OWN — the loading screen leaves these undrawn for a moment
 * (`data-el-waits`, globals.css), through the same rows and draft as the design above.
 *
 * 🔴 WHY (the 2026-10-15 Animate walk, F4 · L2): the names were sent TWICE — drawn by the loading screen, then by
 * the real cover, whose own Build in starts from its first frame on the NEW node. Measured live: names shown at
 * 0.28 s, opacity 0 at 0.51 s, back at 1.24 s (WebKit 0.72 → 0 at 1.22 → 1.94 s) — a blink on every load.
 * ✅ CHOSEN (of the two ways the brief offered): the loading screen does not draw a part that will ARRIVE — it keeps
 * its place (nothing moves when the cover lands) and the cover's own Build in is the first time the guest sees it,
 * exactly as the couple chose. Not "skip the replay": that would mean the couple's Build in never plays for a guest
 * who saw the loading screen, which is every guest. A part with no Build in of its own is drawn at once, as before
 * (owner 2026-09-27: the loading screen is the page, and it shows the couple's names). The wait is capped
 * (`sn-el-waits`, 2.5 s): on a slow server the names still show, as the loading screen promised.
 */
export function heroArrivingForSkeleton(
  widgets: readonly InvitationWidgetRow[],
  draft: HubDraft | null,
): HubHeroElementKey[] {
  const elements = heroCanvasOf(overlayHubDraftWidgets(widgets, draft)).elements;
  if (!elements) return [];
  return HUB_HERO_ELEMENT_KEYS.filter((k) => Boolean(sanitizeHubElementMotion(elements[k]?.motion)?.in));
}
