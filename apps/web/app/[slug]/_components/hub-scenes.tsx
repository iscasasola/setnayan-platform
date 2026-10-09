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

export function HubScenes({
  widgets,
  scrubAllowed,
  stageMarks = false,
  children,
}: {
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
  const motionOf = new Map(
    widgets.map((w) => {
      const canvas = sanitizeHubCanvas(w.config_json);
      return [
        w,
        {
          transition: renderedTransition(resolveTransition(canvas), scrubAllowed),
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
                  hold: me.transition === 'scrub' && me.leaves && e.index < widgets.length - 1,
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
