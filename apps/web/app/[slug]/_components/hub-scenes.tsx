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
 *     div.hub-scene.hub-scroll    an ordinary section (names its own timeline)
 *     div.hub-run             consecutive scrub sections, stacked in one cell
 *                             (`--hub-n` = how many, so the stylesheet can lay
 *                             one spacer row per section)
 *       div.hub-scene.hub-scrub   its frame pinned, AS TALL AS ITS CONTENT
 *       i.hub-sp                  its one-step spacer, which drives it
 *       …
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
 * Scrub is wrapped — with EVERYTHING AFTER IT — in a cell: while the hand-over plays, the cell's stage stands still
 * (the browser's own `position: sticky`, switched on by the engine) and so does the whole rest of the page inside
 * it, for exactly the extra length the cell is given. Nothing is stacked and nothing leaves the flow: without the
 * engine these wrappers are plain blocks and the page is the plain page.
 *
 *   div.hub-cell               the hand-over's extra length (padding, set by the engine)
 *     div.hub-stage            stands still while it plays
 *       div.hub-scene          the scene that leaves
 *       div.hub-after          the rest of the page — its first scene arrives in the leaving one's place
 *         <the arrival>        a scene, or the next hand-over's cell
 *         div.hub-below        what follows the pair (only beside a plain arrival; a cell carries its own)
 */
function flow(blocks: readonly Block[]): React.ReactNode[] {
  let rest: React.ReactNode[] = [];
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i]!;
    if (!b.hold) {
      rest = [b.node, ...rest];
      continue;
    }
    const [arrival, ...below] = rest;
    rest = [
      <div key={`cell-${b.node.key}`} className="hub-cell">
        <div className="hub-stage">
          {b.node}
          <div className="hub-after">
            {arrival}
            {below.length > 0 ? <div className="hub-below">{below}</div> : null}
          </div>
        </div>
      </div>,
    ];
  }
  return rest;
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
