import type { ReactNode } from 'react';
import { HUB_TAB_ATTR, activeHubTab } from '@/app/[slug]/_lib/hub-tabs';
import { MakerPageStandIn } from '@/app/[slug]/_components/maker-fixed-parts';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { makerStageIsPaged, makerStagesPageOf, makerStagesPages } from '@/lib/maker-stage-filing';

/**
 * 🧪 A STAGE OF THE MAKER LAB'S CANVAS, AS THE REAL CANVAS FILES IT (DEV-ONLY — `/dev/maker-lab/guest`).
 *
 * The lab drew ONE hand-written list of sections for every stage, in an order of its own, on one long page
 * (the walk of 2026-10-11): so Save the Date and Post Event carried the whole invitation (P12), a scene moved or
 * removed in the Maker stayed where it was (P02), and the Invitation's four tabs moved a highlight and nothing else
 * (P04). This draws a stage from what the REAL Maker lists for it and in that order:
 *
 *   · `tiles` — the stage's own list (`makerStageLists` through `buildMakerNavigatorData`, on the sample's rows WITH
 *     the lab's draft laid over them): a scene moved is drawn where it now stands, a scene taken off is not drawn,
 *     and a stage draws only its own parts;
 *   · on a stage the Stages canvas draws as tabs (`makerStageIsPaged`) and the Maker asked for them (`&tabs=1`):
 *     ONE group per page of the Maker's own list (`makerStagesPages`), marked `data-hub-tab`, one shown at a time —
 *     each part on the page the ONE filing puts it on (`makerStagesPageOf`), so the bridge's `hubTab` switches
 *     pages here exactly as it does on a couple's canvas. A page nothing is filed on is its stand-in.
 *
 * What a tile draws is the lab's own node for its canvas key (`given`); a key with no node here is not drawn (the
 * lab has no film, no announcements). `selfMarked` keys draw their own marker (the canvas's guest stand-ins).
 */
export function LabStagePages({
  stage,
  tiles,
  tab,
  paged,
  mark,
  given,
  selfMarked = [],
  skip = [],
}: {
  stage: LifecyclePhase;
  /** The stage's canvas keys, in the page's order. */
  tiles: readonly string[];
  /** The address's `?tab=` — the first page when absent. */
  tab: string | undefined;
  /** Draw the stage as tabs (the Maker's `&tabs=1`, on a stage that has them, and never for a miniature). */
  paged: boolean;
  mark: (key: string) => ReactNode;
  given: Readonly<Record<string, ReactNode>>;
  selfMarked?: readonly string[];
  /** Keys the caller draws itself (the cover, on the one-page stages). */
  skip?: readonly string[];
}) {
  const drawn = tiles.filter((k) => !skip.includes(k) && given[k]);
  const node = (key: string) => (
    <div key={key} className="contents">
      {selfMarked.includes(key) ? null : mark(key)}
      {given[key]}
    </div>
  );
  const tabbed = paged && makerStageIsPaged(stage);
  if (!tabbed) return <div className="sn-editorial" data-lab-stage={stage}>{drawn.map(node)}</div>;
  const pages = makerStagesPages(stage);
  const keys = pages.map((p) => p.key);
  const active = activeHubTab(tab, keys);
  const byPage = new Map<string, ReactNode[]>();
  for (const key of drawn) {
    const page = makerStagesPageOf(stage, key, keys);
    byPage.set(page, [...(byPage.get(page) ?? []), node(key)]);
  }
  return (
    <div className="sn-editorial" data-lab-stage={stage} data-lab-stage-pages="">
      {pages.map((p) =>
        byPage.has(p.key) ? (
          <div key={p.key} {...{ [HUB_TAB_ATTR]: p.key }} hidden={p.key !== active ? true : undefined}>
            {byPage.get(p.key)}
          </div>
        ) : (
          <div key={p.key} {...{ [HUB_TAB_ATTR]: p.key }} data-stages-page={p.key} hidden={p.key !== active ? true : undefined}>
            <MakerPageStandIn page={p.key} label={p.label} />
          </div>
        ),
      )}
    </div>
  );
}
