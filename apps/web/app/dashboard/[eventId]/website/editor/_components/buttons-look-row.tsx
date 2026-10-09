'use client';

/**
 * 🔘 LOOK › ELEMENTS › BUTTONS — the Reply button itself, in each of the three shapes.
 *
 * THREE SHAPES, NO "DEFAULT" (owner 2026-10-08, round 5: *"do not need to show default button just show the 3
 * button styles"*; approved prototype frame B05): Square · Rounded · Pill, each drawn AS the button (the note's one
 * exception to picture cards — "a choice of a thing is shown as the thing itself"). The picked one wears the
 * accent ring and its name; while the event still wears its theme's own corner, the card that corner READS as is
 * ringed (`lib/hub-button-shapes.ts`) — a reading, never a write.
 *
 * THE COLOUR IS THE PALETTE'S (round 3: *"button color will be taken from their 5 palette"* · round 2: *"Pick Button
 * Shape (color is on the palette already so no need to add)"*): the three are drawn in the page's own button fill —
 * the couple's Accent, deepened until its label reads — with no colour of the row's own. A colour stored before
 * this (`site_button_color`) is handed back to the palette by the next Shape pick; the stored FILL half of
 * `site_button_style` is carried unchanged.
 *
 * control → kind (`INTERACTION_RULES.md` § 9): the three → a Style-card strip whose "picture" is the real button
 * (accent ring · accent name · centred on a pick).
 *
 * Owner, 2026-10-04 (DECISION_LOG "LOOK › BUTTONS — THE HOST STYLES THE EVENT
 * HUB'S BUTTONS"): *"yes we have buttons because the buttons for reply your
 * answer, or other buttons that may be part of the event hub."* → *"create
 * them."* And for the panel: *"1. prevent to crowded presentation on mobile.
 * 2. always maximize full width for body for easier editing. 3. Realtime
 * effects for seeing what will change but always need to press apply to
 * publish to the actual event hub"*.
 *
 *   · ONE DROPDOWN (any set of choices is a dropdown — never a pill row),
 *     defaulting to "Theme’s". No explainer captions.
 *   · REALTIME: a pick is laid on the canvas AT ONCE through the bridge
 *     (`app/[slug]/_components/buttons-preview.ts`) with the guest page's own
 *     resolver (`resolveHubButtons`), then saved into the DRAFT with the one
 *     draft action — `held`, so no whole-Maker render follows, and the save
 *     answers with the Apply count. Guests see it only at Apply.
 *   · OPENING WRITES NOTHING: the only write is inside `commit`, reached only
 *     from a pick that changed something (`the-buttons-look-is-legible.test.ts`).
 *   · LEGIBILITY is the guest render's own (`resolveHubButtons`): the sample
 *     is painted with the very values the page wears.
 *
 * ⚡ Loaded lazily with the Look panel's other rows (`details-lazy.tsx`,
 * "maker-details") — never in the Maker's first load.
 */

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  encodeHubButtonStyle,
  parseHubButtonStyle,
  resolveHubButtons,
  type HubButtonFill,
  type HubButtonPage,
  type HubButtonShape,
} from '@/lib/hub-buttons';
import { HUB_BUTTON_SHAPES_OFFERED, hubButtonCardRadius, hubButtonShapeName, hubButtonShapeRead } from '@/lib/hub-button-shapes';
import { centreInRow } from '@/lib/centre-in-row';
import type { InviteTheme } from '@/lib/invite-themes';
import { tellLookSample } from '@/lib/look-sample-store';
import { HUB_DRAFT_BAR_FIELD, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../hub-draft-actions';

/** The guest page's main action, short — three of the real button fit one phone row ("Reply to the invitation" does not). */
const REPLY = 'Reply';

type Choice = { shape: HubButtonShape; fill: HubButtonFill; colour: string | null };

export function ButtonsLookRow({
  eventId,
  theme,
  page,
  style,
  colour,
}: {
  eventId: string;
  /** The theme the canvas wears (drafted over live). */
  theme: InviteTheme;
  /** The page as it paints, without a host button colour: its own fill and grounds. */
  page: HubButtonPage;
  /** `site_button_style`, drafted over live. */
  style: string | null;
  /** `site_button_color`, drafted over live. */
  colour: string | null;
  /** The event's palette colours — not read here: the buttons take the page's own fill (the palette's Accent, as the page resolves it). */
  palette?: readonly string[];
}) {
  const fromProps = (): Choice => ({ ...parseHubButtonStyle(style), colour: colour ? colour.toLowerCase() : null });
  const [choice, setChoice] = useState<Choice>(fromProps);
  const [error, setError] = useState<string | null>(null);
  const saved = useRef<Choice>(choice);
  /* A Maker refresh (Undo, Restore, another save) hands in what the draft now
     holds — follow it. Reading props writes nothing. */
  useEffect(() => {
    const next = fromProps();
    saved.current = next;
    setChoice(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, colour]);

  const look = (c: Choice) => resolveHubButtons({ style: encodeHubButtonStyle(c), colour: c.colour, theme, page });

  const preview = (c: Choice) => {
    /* 🪟 Studio › Look's sample screen wears it too — drawn in the browser, no request (`look-sample.tsx`). */
    tellLookSample(eventId, { buttonStyle: encodeHubButtonStyle(c), buttonColour: c.colour });
    const l = look(c);
    const message = {
      source: 'setnayan-editor',
      t: 'buttons',
      shape: l?.shape ?? null,
      paint: l?.paint ?? null,
      vars: l?.vars ?? {},
    };
    for (const f of document.querySelectorAll<HTMLIFrameElement>('iframe[data-maker-page-frame], iframe[data-maker-canvas-frame]')) {
      f.contentWindow?.postMessage(message, window.location.origin);
    }
  };

  const lastTap = useRef(0);
  const commit = (next: Choice) => {
    const before = choice;
    if (before.shape === next.shape && before.fill === next.fill && before.colour === next.colour) return;
    const tap = ++lastTap.current;
    setChoice(next);
    setError(null);
    preview(next);
    void (async () => {
      let ok = false;
      try {
        const fd = new FormData();
        fd.set('intent', 'save');
        fd.set(
          'patch',
          JSON.stringify({ events: { site_button_style: encodeHubButtonStyle(next), site_button_color: next.colour } }),
        );
        fd.set(HUB_DRAFT_BAR_FIELD, '1');
        const r = await makerSave(() => hubDraftAction(eventId, fd), requestMakerRefresh, { held: true });
        ok = r.ok === true;
      } catch {
        ok = false;
      }
      if (ok) {
        saved.current = next;
        return;
      }
      if (tap !== lastTap.current) return; // a newer pick took over
      setChoice(saved.current);
      preview(saved.current);
      setError('That did not save. Please try again.');
    })();
  };

  /* The ringed card: what is stored — or, on the theme's own corner, the one of the three it reads as. */
  const ringed = hubButtonShapeRead(choice.shape, theme);
  /* 🎯 The picked card centres itself in its row (owner 2026-10-08) — at once on opening, travelling on a pick. */
  const row = useRef<HTMLDivElement>(null);
  const centred = useRef<string | null>(null);
  useEffect(() => {
    const el = row.current;
    const on = el?.querySelector<HTMLElement>('[data-buttons-shape][aria-pressed="true"]');
    if (!el || !on || centred.current === ringed) return;
    centreInRow(el, on, centred.current !== null);
    centred.current = ringed;
  });
  return (
    <div data-buttons-look="" className="flex flex-col">
      {/* Where the colour comes from, said once and quietly: the palette's Accent, as the page deepens it to read. */}
      <p data-buttons-colour-from="" className="flex items-center justify-end gap-1.5 text-[11.5px] text-ink/55">
        <i aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: page.fill }} />
        Accent
      </p>
      <div ref={row} role="group" aria-label="Button shape" data-buttons-shapes="" className="-mx-4 flex items-start gap-4 overflow-x-auto overscroll-x-contain px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {HUB_BUTTON_SHAPES_OFFERED.map((shape) => {
          const on = shape === ringed;
          return (
            <button
              key={shape}
              type="button"
              aria-pressed={on}
              data-buttons-shape={shape}
              /* A tap on the ringed card changes nothing — the theme's own corner is never turned into a stored one. */
              onClick={() => (on ? undefined : commit({ ...choice, shape, colour: null }))}
              className="sn-press flex flex-none flex-col items-center gap-2"
            >
              {/* THE BUTTON ITSELF — the guest page's own paint (`resolveHubButtons`, the palette's fill), in this shape. */}
              <span
                data-buttons-sample={shape}
                aria-hidden
                className={`sn-press-ring inline-flex min-h-[48px] items-center justify-center px-7 text-sm font-semibold tracking-wide ${on ? 'ring-[3px] ring-sn-accent ring-offset-[3px] ring-offset-cream' : ''}`.trim()}
                style={sampleStyle(look({ ...choice, shape, colour: null }), page, hubButtonCardRadius(shape, choice.shape, theme))}
              >
                {REPLY}
              </span>
              <span data-buttons-shape-name="" className={`text-[12px] ${on ? 'font-semibold text-sn-accent' : 'font-medium text-ink'}`}>
                {hubButtonShapeName(shape)}
              </span>
            </button>
          );
        })}
      </div>
      {error ? (
        <p role="alert" className="pt-2 text-sm text-terracotta-700" data-buttons-error="">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * One card's paint — the SAME values the guest scope wears for that shape, in the PALETTE's colour (no colour of
 * the row's own is passed in). With no fill chosen: today's Reply button — the page's own fill with the page's
 * paper as its label (`bg-mulberry text-cream`).
 */
function sampleStyle(l: ReturnType<typeof resolveHubButtons>, page: HubButtonPage, radius: string): CSSProperties {
  const v = l?.vars ?? {};
  if (!l?.paint) return { borderRadius: radius, backgroundColor: page.fill, color: page.grounds[0] };
  return {
    borderRadius: radius,
    backgroundColor: v['--hub-btn-fill'],
    color: v['--hub-btn-label'],
    border: `1.5px solid ${v['--hub-btn-border']}`,
  };
}
