'use client';

/**
 * 🔘 LOOK › BUTTONS — Shape ▾, and the Reply button as it will look.
 *
 * ✂ SHAPE ONLY (owner 2026-10-08, on the local copy: *"Pick Button Shape (color is on the palette already so no
 * need to add)"*). The Fill ▾ and Colour ▾ rows left Look. NOTHING STORED IS TOUCHED BY THAT: a button fill and
 * colour already chosen (`site_button_style`'s fill half, `site_button_color`) are read here, worn by the sample
 * and by the guest page exactly as stored, and carried UNCHANGED by every Shape pick.
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
  HUB_BUTTON_SHAPES,
  HUB_BUTTON_SHAPE_LABEL,
  encodeHubButtonStyle,
  parseHubButtonStyle,
  resolveHubButtons,
  type HubButtonFill,
  type HubButtonPage,
  type HubButtonShape,
} from '@/lib/hub-buttons';
import type { InviteTheme } from '@/lib/invite-themes';
import { HUB_DRAFT_BAR_FIELD, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { hubDraftAction } from '../../hub-draft-actions';
import { IRow } from './inspector-kit';
import { PickMenu } from './pick-menu';

/** The guest page's own words on its one main action (`LANDING_WORDS.reply`). */
const REPLY = 'Reply to the invitation';
/** The Reply button's own corner when the shape is the theme's (`rounded-lg`). */
const OWN_RADIUS = '8px';

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
  /** The event's palette colours (the Mood Board's, else the theme's) — no longer read here: the Colour ▾ row left Look. */
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

  const sample = sampleStyle(look(choice), page);
  return (
    <div data-buttons-look="" className="flex flex-col">
      <div className="flex justify-center rounded-md px-3 py-4" style={{ backgroundColor: page.grounds[0] }} data-buttons-sample-ground="">
        <span data-buttons-sample="" aria-hidden className="inline-flex min-h-[48px] items-center justify-center px-7 text-sm font-semibold tracking-wide" style={sample}>
          {REPLY}
        </span>
      </div>
      <IRow label="Shape" data="buttons-shape">
        <PickMenu
          label="Button shape"
          value={choice.shape}
          dataAttr="data-buttons-shape"
          className="min-w-0 flex-1"
          options={HUB_BUTTON_SHAPES.map((s) => ({ key: s, label: HUB_BUTTON_SHAPE_LABEL[s] }))}
          onPick={(k) => commit({ ...choice, shape: k as HubButtonShape })}
        />
      </IRow>
      {error ? (
        <p role="alert" className="pt-2 text-sm text-terracotta-700" data-buttons-error="">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The sample's paint — the SAME values the guest scope wears; with nothing
 * chosen, today's Reply button: the page's own fill with the page's paper as
 * its label (`bg-mulberry text-cream`).
 */
function sampleStyle(l: ReturnType<typeof resolveHubButtons>, page: HubButtonPage): CSSProperties {
  const v = l?.vars ?? {};
  const radius = v['--hub-btn-radius'] ?? OWN_RADIUS;
  if (!l?.paint) return { borderRadius: radius, backgroundColor: page.fill, color: page.grounds[0] };
  return {
    borderRadius: radius,
    backgroundColor: v['--hub-btn-fill'],
    color: v['--hub-btn-label'],
    border: `1.5px solid ${v['--hub-btn-border']}`,
  };
}
