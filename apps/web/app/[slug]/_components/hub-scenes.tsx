import { Children } from 'react';
import { sanitizeHubCanvas } from '@/lib/hub-canvas';
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
import { HubAutoRun } from './hub-auto-run';

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
 */
export function HubScenes({
  widgets,
  scrubAllowed,
  children,
}: {
  widgets: readonly InvitationWidgetRow[];
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

  const segments = groupSceneRuns(
    widgets,
    (w) => renderedTransition(resolveTransition(sanitizeHubCanvas(w.config_json)), scrubAllowed),
    (w) => sanitizeHubCanvas(w.config_json).autoSpeed ?? HUB_DEFAULT_AUTO_SPEED,
  );
  if (!hasScrubRun(segments)) return <>{children}</>;

  const names = widgets.map((_, i) => sceneTimelineName(i));
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
      {segments.map((seg) =>
        seg.kind === 'auto' ? (
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
              <div key={`s${e.index}`} className="hub-scene hub-auto">
                {nodes[e.index]}
              </div>
            ))}
          </HubAutoRun>
        ) : seg.kind === 'scroll' ? (
          <div key={seg.entry.index} className="hub-scene hub-scroll" style={tl(seg.entry.index)}>
            {nodes[seg.entry.index]}
          </div>
        ) : (
          <div
            key={`run-${seg.entries[0]?.index}`}
            className="hub-run"
            style={{ '--hub-n': seg.entries.length } as React.CSSProperties}
          >
            {seg.entries.flatMap((e) => [
              <div key={`s${e.index}`} className="hub-scene hub-scrub" style={tl(e.index)}>
                {nodes[e.index]}
              </div>,
              <i key={`p${e.index}`} className="hub-sp" aria-hidden="true" style={tl(e.index)} />,
            ])}
          </div>
        ),
      )}
    </div>
  );
}
