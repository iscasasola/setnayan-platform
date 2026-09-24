import { Children } from 'react';
import { sanitizeHubCanvas } from '@/lib/hub-canvas';
import {
  groupSceneRuns,
  hasScrubRun,
  renderedTransition,
  resolveTransition,
  sceneProgressRange,
  sceneTimelineName,
} from '@/lib/hub-scenes';
import type { InvitationWidgetRow } from '@/lib/invitation-widgets';

/**
 * THE PAGE'S SCENES — Scroll and Scrub, per section, drawn with CSS only
 * (owner 2026-09-24: "hybrid perfect"; contract in `lib/hub-scenes.ts`).
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
 *     div.hub-run             consecutive scrub sections, which un-pin together
 *       div.hub-scene.hub-scrub   pinned, one screen tall
 *       i.hub-sp                  its 170vh spacer, which drives it
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
 * 🔒 NO SCRIPT, and no function crosses to the client: this is a server
 * component that writes classes and custom properties.
 */
export function HubScenes({
  widgets,
  scrubAllowed,
  children,
}: {
  widgets: readonly InvitationWidgetRow[];
  /** Event Hub Pro, resolved once by the page. Without it every section scrolls. */
  scrubAllowed: boolean;
  children: React.ReactNode;
}) {
  const nodes = Children.toArray(children);
  /* ⛔ ONE NODE PER WIDGET, OR NOTHING CHANGES. If the two lists ever disagree
     (a caller filtered one and not the other), pairing by position would put a
     section's choice on its neighbour — so the page is left exactly as given. */
  if (nodes.length !== widgets.length) return <>{children}</>;

  const segments = groupSceneRuns(widgets, (w) =>
    renderedTransition(resolveTransition(sanitizeHubCanvas(w.config_json)), scrubAllowed),
  );
  if (!hasScrubRun(segments)) return <>{children}</>;

  const names = widgets.map((_, i) => sceneTimelineName(i));
  const tl = (i: number) => ({ '--hub-tl': names[i] }) as React.CSSProperties;

  return (
    <div className="hub-scenes" style={{ '--hub-scope': names.join(', ') } as React.CSSProperties}>
      <div className="hub-prog" aria-hidden="true">
        <span className="hub-prog-bar">
          {segments.flatMap((seg) =>
            seg.kind === 'scroll'
              ? [
                  <i
                    key={seg.entry.index}
                    style={{ ...tl(seg.entry.index), '--hub-pr': sceneProgressRange('scroll', false, false) } as React.CSSProperties}
                  />,
                ]
              : seg.entries.map((e, k) => (
                  <i
                    key={e.index}
                    style={
                      {
                        ...tl(e.index),
                        '--hub-pr': sceneProgressRange('scrub', k === 0, k === seg.entries.length - 1),
                      } as React.CSSProperties
                    }
                  />
                )),
          )}
        </span>
      </div>
      {segments.map((seg) =>
        seg.kind === 'scroll' ? (
          <div key={seg.entry.index} className="hub-scene hub-scroll" style={tl(seg.entry.index)}>
            {nodes[seg.entry.index]}
          </div>
        ) : (
          <div key={`run-${seg.entries[0]?.index}`} className="hub-run">
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
