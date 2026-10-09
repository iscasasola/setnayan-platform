import { Children, Fragment } from 'react';
import { resolveHubMotion, sanitizeHubCanvas } from '@/lib/hub-canvas';
import {
  HUB_DEFAULT_AUTO_SPEED,
  groupSceneRuns,
  hasScrubRun,
  renderedTransition,
  resolveTransition,
  SCENE_PROGRESS_RANGE,
  sceneTimelineName,
} from '@/lib/hub-scenes';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';
import { SCRUB_OUT_OFFERED, offeredTransition } from '@/lib/scrub-out-offered';
import { STAGE_HOLD_ATTR, STAGE_SCENE_ATTR, stageSceneHoldMs, stageSceneKey } from '@/lib/stage-autoplay';
import { HubAutoRun } from './hub-auto-run';
import { HubScrub } from './hub-scrub';

/**
 * THE PAGE'S SCENES — Scroll, Scrub and Auto, per section, drawn with CSS
 * (owner 2026-09-24: "hybrid perfect"; contract in `lib/hub-scenes.ts`). Auto
 * runs add one small client island, `HubAutoRun`, that only says WHEN the
 * clock may run — see its docblock.
 *
 * `children` is the dispatcher's output, ONE NODE PER WIDGET, in the same order
 * as `widgets` — so the grouping below reads each scene's transition by
 * position and never has to look inside a node. A scene's stored transition is
 * the one INTO THE NEXT scene (owner: "from one scene to another there is a
 * transition"), so two scenes joined by Scrub share a run, and the last
 * scene's value is ignored.
 *
 * ── WHAT IT EMITS ──────────────────────────────────────────────────────────
 * Nothing new, unless a section on this page actually scrubs. With no scrub
 * section (every event today, every free event, every page in a browser that
 * cannot run it is handled by CSS below) it returns the children exactly as
 * given — the page is byte-identical to before this existed.
 *
 * With one, the approved prototype's structure:
 *
 *   div.hub-scenes            timeline-scope for every section's name
 *     div.hub-prog            the progress mark, one segment per section
 *     div.hub-scene.hub-scroll    a section — Scroll, or Scrub (then marked
 *                                 `data-hub-fx`; see `flow` for the cell a
 *                                 hand-over is wrapped in, and `hub-scrub*.ts`)
 *     …an Auto run (`HubAutoRun`): its scenes share one cell, on a clock
 *
 * (Until 2026-10-09 consecutive Scrub sections were a STACKED RUN — `div.hub-run`
 * holding `div.hub-scene.hub-scrub` frames, each driven by an `i.hub-sp` spacer.
 * Nothing emits those any more and their stylesheet is removed.)
 *
 * 🔑 WHICH SCRUB SECTION IS FIRST / LAST IN A RUN IS DECIDED IN CSS, NOT HERE.
 * A widget can render nothing (Countdown with no date) and this component
 * cannot see that from outside the node. Were first/last decided here, an empty
 * first section would leave the next one pulled up over the page above it, and
 * an empty last one would leave a blank pinned screen. So the stylesheet counts
 * only scrub sections that HAVE content, with sibling selectors — an empty one
 * simply drops out of its run.
 *
 * 🔒 NO FUNCTION crosses to the client: this is a server component that
 * writes classes and custom properties. The only script is `HubAutoRun`, and
 * only on a page that has an Auto run.
 *
 * 🎬 THE STAGE'S AUTO READS ITS SCENES FROM HERE (`stageMarks`, the Save the
 * Date for guests and the preview tab only — `lib/stage-autoplay.ts`). This is
 * the one place that holds the scene list the page renders, in the order it
 * renders it, so the walker's stops are stamped here and nowhere else — never
 * a second order. Each scene gets `data-stage-scene` (its navigator key) and
 * `data-stage-hold` (its own canvas clock): as ATTRIBUTES on the wrapper when
 * there is one — a hidden element inside a wrapper would make an empty scrub
 * scene non-`:empty` and pin a blank screen — and as a hidden marker in front
 * of the node when there is none (`sn-hub-cards`' `space-y` skips `[hidden]`).
 * Without `stageMarks` the output is exactly what it was.
 */
type Block = { node: React.ReactElement; hold: boolean };

/**
 * 🎚 THE PAGE, WITH ITS HAND-OVERS. Every scene stays in page order, one under another. A scene that hands over by
 * Scrub is wrapped in a cell — with EVERYTHING AFTER IT, and with the ordinary scenes just BEFORE it: while the
 * hand-over plays, the cell's stage stands still (the browser's own `position: sticky`, switched on by the engine)
 * and so does everything in it, for exactly the extra length the cell is given. Nothing is stacked and nothing
 * leaves the flow: without the engine these wrappers are plain blocks and the page is the plain page.
 *
 * 🧍 DURING A HOLD THE PAGE STANDS STILL (owner, his first sentence about Scrub: *"the page will not scroll"*;
 * 2026-10-09, on the first build: *"as a guest nothing scrubbed"* — the held scene stood while the scene above it
 * went on scrolling at thumb speed, which reads as ordinary scrolling). So the scenes a guest can still see ABOVE
 * the one that leaves — the ordinary ones since the hand-over before — are inside its stage too, and the stage
 * sticks with a top that leaves the leaving scene where it is held (`hub-scrub-engine.ts`). What is outside this
 * block (the cover, a fixed bar) is the page's, not this renderer's.
 *
 *   div.hub-cell               the hand-over's extra length (its `::after`, sized by the engine)
 *     div.hub-stage            stands still while it plays
 *       [the scenes before]    ordinary scenes since the last hand-over, if any: the first, then
 *       [div.hub-below]        …a box with the rest of them AND the two lines below (what follows that first scene)
 *       div.hub-scene          the scene that leaves
 *       div.hub-after          the rest of the page — its first scene arrives in the leaving one's place
 *         <the arrival>        a scene, or the next hand-over's cell
 *         div.hub-below        what follows the pair (only beside a plain arrival; a cell carries its own)
 *
 * 🔑 TWO THINGS THE ENGINE FINDS BY SHAPE: the leaving scene is the `.hub-scene` right before its cell's
 * `.hub-after`; and whatever follows a scene that arrives is ONE box right after it (`.hub-below` or `.hub-after`),
 * which is what rises while the pair is held.
 */
function flow(blocks: readonly Block[]): React.ReactNode[] {
  const at = blocks.findIndex((b) => b.hold);
  if (at < 0) return blocks.map((b) => b.node);
  const held = blocks[at]!;
  const before = blocks.slice(0, at).map((b) => b.node);
  /* A hold is never the page's last scene (`hold` below), so there is always something to arrive. */
  const [arrival, ...below] = flow(blocks.slice(at + 1));
  const pair = [
    held.node,
    <div key="after" className="hub-after">
      {arrival}
      {below.length > 0 ? <div className="hub-below">{below}</div> : null}
    </div>,
  ];
  return [
    <div key={`cell-${held.node.key}`} className="hub-cell">
      <div className="hub-stage">
        {before.length === 0 ? (
          pair
        ) : (
          <>
            {before[0]}
            <div className="hub-below">{[...before.slice(1), ...pair]}</div>
          </>
        )}
      </div>
    </div>,
  ];
}

/**
 * A page's scenes, resolved ONCE: each scene's motion, the runs, and WHICH SCENES HAND OVER BY SCRUB — read by the
 * scenes block (`HubScenes`) and by the page's own hold (`hubScrubHolds` → `HubPageHold`), so the page can never
 * wrap itself for a number of hand-overs the block does not draw.
 */
function sceneRuns(widgets: readonly InvitationWidgetRow[], scrubAllowed: boolean, scrubOut: boolean) {
  const motionOf = new Map(
    widgets.map((w) => {
      const canvas = sanitizeHubCanvas(w.config_json);
      return [
        w,
        {
          /* 🌑 THE ONE PLACE a scene's transition is resolved for drawing: while "Scrub out" is not offered
             (`lib/scrub-out-offered.ts`) a stored Scrub is the plain scroll — the page below is then the plain page. */
          transition: offeredTransition(renderedTransition(resolveTransition(canvas), scrubAllowed), scrubOut),
          speed: canvas.autoSpeed ?? HUB_DEFAULT_AUTO_SPEED,
          /* 🎚 Scrub out hands over only where there is a Build out to play (owner: "if no build out, element stay
             permanent on the page"). */
          leaves: resolveHubMotion(canvas).out !== 'none',
        },
      ] as const;
    }),
  );
  const segments = groupSceneRuns(
    widgets,
    (w) => motionOf.get(w)!.transition,
    (w) => motionOf.get(w)!.speed,
  );
  /** Does scene `index` hand over? It Leaves by Scrub, has a Build out to play, and is not the block's last scene. */
  const holds = (index: number) => {
    const me = motionOf.get(widgets[index]!);
    return Boolean(me && me.transition === 'scrub' && me.leaves && index < widgets.length - 1);
  };
  return { motionOf, segments, holds };
}

/** How many hand-overs these scenes draw — what `HubPageHold` needs to know. (A scene inside an Auto run is not one.) */
export function hubScrubHolds(widgets: readonly InvitationWidgetRow[], scrubAllowed: boolean, scrubOut: boolean = SCRUB_OUT_OFFERED): number {
  const { segments, holds } = sceneRuns(widgets, scrubAllowed, scrubOut);
  if (!hasScrubRun(segments)) return 0;
  return segments.reduce((n, seg) => n + (seg.kind === 'auto' ? 0 : (seg.kind === 'scroll' ? [seg.entry] : seg.entries).filter((e) => holds(e.index)).length), 0);
}

/**
 * AT MOST how many hand-overs a page's scenes can draw, whatever lists the page splits them into (one scroll, a
 * page a tab, around the entourage): every scene that Leaves by Scrub with a Build out. A page asks THIS for its
 * own hold — a pair too many is a plain box that holds nothing; a pair too few would leave a hand-over to hold only
 * its own block. Zero on every page with no Scrub scene (every page today): nothing is wrapped at all.
 */
export function hubScrubHoldsAtMost(widgets: readonly InvitationWidgetRow[], scrubAllowed: boolean, scrubOut: boolean = SCRUB_OUT_OFFERED): number {
  const { motionOf } = sceneRuns(widgets, scrubAllowed, scrubOut);
  return widgets.filter((w) => motionOf.get(w)!.transition === 'scrub' && motionOf.get(w)!.leaves).length;
}

/**
 * 🧍 THE PAGE'S OWN HOLD (owner, his first sentence about Scrub: *"the page will not scroll"*). A hand-over's cell
 * inside a scenes block can only hold what is in the block; the cover, a greeting, whatever the page draws around
 * its scenes went on scrolling at thumb speed while a scene was "held" — which reads as ordinary scrolling
 * (2026-10-09: *"as a guest nothing scrubbed"*). So the PAGE wraps its whole content column in one plain cell ›
 * stage pair per hand-over, nested; the engine gives hand-over k the k-th pair from the outside
 * (`hub-scrub-engine.ts`), and that stage — the whole column — is what stands still, by the browser's own
 * `position: sticky`, for the hand-over's length.
 *
 * 🔒 Without the engine these are plain boxes with no rule of their own: the page is the plain page. With no
 * hand-over on the page (`holds` 0 — every page today) the children are returned as given: nothing is wrapped.
 */
export function HubPageHold({ holds, children }: { holds: number; children?: React.ReactNode }) {
  let node: React.ReactNode = children;
  for (let i = 0; i < holds; i++) {
    node = (
      <div className="hub-page-cell">
        <div className="hub-page-stage">{node}</div>
      </div>
    );
  }
  return <>{node}</>;
}

/**
 * 🎬 DOES THE COVER HAND OVER? (hand-over zero — owner: *"maria jose must build out and until we say i do should be
 * where maria jose build out"*.) The cover is the page's hero row (`widget_type` `hero`): it Leaves by Scrub
 * (`canvas.transition`, written by "Scene leaves ◆" on any of the cover's parts) and has a Build out to play — the
 * same two questions a scene is asked (`sceneRuns`), through the same door: while "Scrub out" is not offered
 * (`lib/scrub-out-offered.ts`) the answer is no, on every page.
 */
export function hubCoverLeaves(widgets: readonly Pick<InvitationWidgetRow, 'widget_type' | 'config_json'>[], scrubAllowed: boolean, scrubOut: boolean = SCRUB_OUT_OFFERED): boolean {
  const hero = widgets.find((w) => w.widget_type === 'hero');
  if (!hero) return false;
  const canvas = sanitizeHubCanvas(hero.config_json);
  return offeredTransition(renderedTransition(resolveTransition(canvas), scrubAllowed), scrubOut) === 'scrub' && resolveHubMotion(canvas).out !== 'none';
}

/**
 * 🎬 THE COVER AS HAND-OVER ZERO. The cover is not a scene of any scenes block — the page draws it — so the page
 * hands it over itself: the cover in one plain box, and EVERYTHING AFTER IT ON THE PAGE in another. What comes next
 * on the page — a scene, or any block: the door, a greeting, the ticket — arrives where the cover leaves (owner:
 * *"that element is gone and the next element takes its place"*); nothing is skipped and nothing is pulled above the
 * cover. The engine finds the three boxes by their classes (`hub-scrub-engine.ts`), holds the cover WHERE IT STANDS
 * when the page opens (`hub-scrub-math.ts`) and gives it the page's own first pair (`HubPageHold` — the page must
 * wrap itself for one hand-over more, which `hubScrubHoldsAtMost` already counts: the hero row is a row).
 *
 *   div.hub-cover-cell
 *     div.hub-cover[data-hub-fx]   the cover — fades out under the thumb (a Scrub scene's default Build out: Fade)
 *     div.hub-cover-after          the rest of the page; its first box with a size is what arrives
 *
 * 🔒 `leaves` false — every page today, every page with no Scrub on its cover — returns the cover and the rest AS
 * GIVEN: not a box, not a class, no island. With it, and without the engine (no script, "reduce motion"), the three
 * boxes are plain blocks with no rule of their own: the page is the plain page.
 * 🏝 The island is mounted HERE too: a page whose cover is its only Scrub has no scenes block to mount it.
 */
export function HubCoverHold({ leaves, cover, children }: { leaves: boolean; cover: React.ReactNode; children?: React.ReactNode }) {
  if (!leaves) {
    return (
      <>
        {cover}
        {children}
      </>
    );
  }
  return (
    <div className="hub-cover-cell">
      <HubScrub />
      <div className="hub-cover" data-hub-fx="">
        {cover}
      </div>
      <div className="hub-cover-after">{children}</div>
    </div>
  );
}

export function HubScenes({
  widgets,
  scrubAllowed,
  scrubOut = SCRUB_OUT_OFFERED,
  stageMarks = false,
  children,
}: {
  /** 🧪 The lab's door (`lib/scrub-out-offered.ts`): draw a stored Scrub although it is not offered. Never set by a real page. */
  scrubOut?: boolean;
  widgets: readonly InvitationWidgetRow[];
  /** Stamp the stage Auto's stops (see the docblock). Off everywhere but the
   *  Save the Date for guests and the preview tab. */
  stageMarks?: boolean;
  /** Event Hub Pro, resolved once by the page. Without it every section
   *  scrolls — Scrub AND Auto (the name predates Auto). */
  scrubAllowed: boolean;
  children: React.ReactNode;
}) {
  const nodes = Children.toArray(children);
  /* ⛔ ONE NODE PER WIDGET, OR NOTHING CHANGES. If the two lists ever disagree
     (a caller filtered one and not the other), pairing by position would put a
     section's choice on its neighbour — so the page is left exactly as given. */
  if (nodes.length !== widgets.length) return <>{children}</>;

  /* Each scene's motion, read ONCE — the runs below and the stage marks both
     read this, so the walker's clock is the clock the page plays. */
  const { motionOf, segments, holds } = sceneRuns(widgets, scrubAllowed, scrubOut);
  /** The stage mark for scene `i`, as attributes — or nothing. */
  const mark = (i: number): Record<string, string> => {
    const w = widgets[i];
    if (!stageMarks || !w) return {};
    return {
      [STAGE_SCENE_ATTR]: stageSceneKey(w.widget_type),
      [STAGE_HOLD_ATTR]: String(stageSceneHoldMs(motionOf.get(w)!)),
    };
  };
  if (!hasScrubRun(segments)) {
    if (!stageMarks) return <>{children}</>;
    return (
      <>
        {nodes.map((node, i) => (
          <Fragment key={widgets[i]?.widget_id ?? i}>
            <span hidden {...mark(i)} />
            {node}
          </Fragment>
        ))}
      </>
    );
  }

  const names = widgets.map((_, i) => sceneTimelineName(i));
  /** 🎚 The page has a scene that Leaves by Scrub: the engine is mounted — here, and on no other page. */
  const scrubbed = widgets.some((w) => motionOf.get(w)!.transition === 'scrub');
  const tl = (i: number) => ({ '--hub-tl': names[i] }) as React.CSSProperties;
  /* Every segment fills on the same line — see `SCENE_PROGRESS_RANGE`. */
  const segStyle = (i: number) => ({ ...tl(i), '--hub-pr': SCENE_PROGRESS_RANGE }) as React.CSSProperties;

  return (
    <div className="hub-scenes" style={{ '--hub-scope': names.join(', ') } as React.CSSProperties}>
      <div className="hub-prog" aria-hidden="true">
        <span className="hub-prog-bar">
          {segments.flatMap((sg) =>
            /* An auto run is ONE screen, so it is one segment, filled as the
               run passes — its scenes change on a clock, not under the thumb. */
            sg.kind === 'auto'
              ? [<i key={`a${sg.entries[0]?.index}`} style={segStyle(sg.entries[0]?.index ?? 0)} />]
              : sg.kind === 'scroll'
              ? [<i key={sg.entry.index} style={segStyle(sg.entry.index)} />]
              : sg.entries.map((e) => <i key={e.index} style={segStyle(e.index)} />),
          )}
        </span>
      </div>
      {scrubbed ? <HubScrub /> : null}
      {flow(
        segments.flatMap((seg): Block[] =>
          seg.kind === 'auto'
            ? [
                {
                  hold: false,
                  node: (
                    /* 🎬 AUTO — the scenes share one cell and hand over on the clock.
                       `HubAutoRun` times the scenes that actually drew something (a
                       scene can render nothing, and a clock slot for it would be a
                       blank screen), and the stylesheet binds the fades only once the
                       run is armed — without script every scene simply stacks. */
                    <HubAutoRun
                      key={`auto-${seg.entries[0]?.index}`}
                      timeline={names[seg.entries[0]?.index ?? 0] ?? ''}
                      speed={seg.speed}
                    >
                      {seg.entries.map((e) => (
                        <div key={`s${e.index}`} className="hub-scene hub-auto" {...mark(e.index)}>
                          {nodes[e.index]}
                        </div>
                      ))}
                    </HubAutoRun>
                  ),
                },
              ]
            : (seg.kind === 'scroll' ? [seg.entry] : seg.entries).map((e) => {
                /* 🎚 SCRUB — the scene stays an ordinary scene of the page (`hub-scroll`, in page order). What it
                   takes part in is said in marks the engine and the stylesheet read (`hub-scrub-engine.ts`):
                   `data-hub-fx` — its effects are played under the thumb (it Leaves by Scrub, or the scene before
                   it does); a HOLD — it has a Build out to hand over with — is the cell `flow` wraps it in. */
                const me = motionOf.get(e.item)!;
                const before = e.index > 0 ? motionOf.get(widgets[e.index - 1]!) : null;
                const fx = me.transition === 'scrub' || before?.transition === 'scrub';
                return {
                  hold: holds(e.index),
                  node: (
                    <div key={e.index} className="hub-scene hub-scroll" style={tl(e.index)} {...(fx ? { 'data-hub-fx': '' } : {})} {...mark(e.index)}>
                      {nodes[e.index]}
                    </div>
                  ),
                };
              }),
        ),
      )}
    </div>
  );
}
