'use client';

import { useEffect, useRef } from 'react';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { makerProMark, makerProUsable, paidMarkLabel } from '@/lib/paid-mark';
import {
  RSVP_CELEBRATE_EVENT,
  RSVP_CELEBRATION_LABEL,
  RSVP_CELEBRATION_NAME,
  RSVP_CELEBRATION_ORDER,
  celebrationIsPro,
  isRsvpCelebration,
  type RsvpCelebration,
} from '@/lib/rsvp-celebration';
import type { CelebrationPlayer } from '@/lib/celebration-engine';

/**
 * 🎉 CELEBRATION ▾ — the RSVP stage's When yes control (owner 2026-10-06,
 * DECISION_LOG '"WHEN YES" GETS A CELEBRATION (PRO)'; prototype
 * `when_yes_celebration_2026-10-06_fable.html`, "THE MAKER'S TOOLS").
 *
 * ONE PickMenu (any set of choices is a dropdown — never a pill row): label
 * left, value + chevron right; each row a tiny looping preview, ◆ Pro on the
 * four effects, Free on None, the pick ticked. Picking one DRAFTS it like every
 * Maker pick (`onPick` → the panel's one-object save) and replays it on the
 * page; "Play it again" replays the current pick. A free couple may try every
 * effect — Apply names it and asks for Event Hub Pro (`planHubDraftApply`).
 * In the app-store shell a couple without Pro is not shown the control at all
 * (`makerProUsable`).
 *
 * The previews' engine is fetched by `import()` only while the list is open
 * (the list's rows are mounted only then), never with the Maker.
 */
export function CelebrationPick({
  value,
  onPick,
  ownsPro,
  storeShell,
  colours,
}: {
  value: RsvpCelebration;
  onPick: (next: RsvpCelebration) => void;
  ownsPro: boolean;
  storeShell: boolean;
  /** The Mood Board's colours, for the previews (`celebrationColours`). */
  colours: readonly string[];
}) {
  if (!makerProUsable({ owns: ownsPro, storeShell })) return null;
  const mark = makerProMark({ owns: ownsPro, storeShell });
  const shown = `${RSVP_CELEBRATION_NAME[value]}${celebrationIsPro(value) && mark === 'try' ? ' ◆' : ''}`;
  const options: PickOption[] = RSVP_CELEBRATION_ORDER.map((kind) => ({
    key: kind,
    label: RSVP_CELEBRATION_NAME[kind],
    preview: <CelebrationMini kind={kind} colours={colours} />,
    trail: celebrationIsPro(kind)
      ? mark
        ? { text: mark === 'try' ? '◆ Pro' : '◆', tone: 'muted' as const, label: paidMarkLabel(mark, 'Event Hub Pro') }
        : undefined
      : { text: 'Free', tone: 'muted' as const },
  }));
  return (
    <div className="flex flex-col gap-2" data-rsvp-setting="celebration">
      {/* ONE full-width row, the prototype's: the label left, the pick and its
          chevron right — and the list it opens is as wide as the row, so a
          preview, a name and its ◆ always fit at 375 px. */}
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-[13px] font-medium text-ink/65">
          {RSVP_CELEBRATION_LABEL}
        </span>
        <PickMenu
          label={RSVP_CELEBRATION_LABEL}
          dataAttr="data-rsvp-celebration-pick"
          value={value}
          buttonText={shown}
          options={options}
          className="min-h-11 w-full justify-end pl-28 ring-1 ring-ink/10"
          onPick={(key) => {
            if (!isRsvpCelebration(key)) return;
            if (key !== value) onPick(key);
            announceCelebrate(key);
          }}
        />
      </div>
      {value !== 'none' ? (
        <button
          type="button"
          data-rsvp-celebration-again=""
          onClick={() => announceCelebrate(value)}
          className="sn-press inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-white px-3.5 text-[13px] font-semibold text-ink ring-1 ring-ink/15"
        >
          <span aria-hidden>▷</span> Play it again
        </button>
      ) : null}
    </div>
  );
}

/** Ask the RSVP stage to play `kind` on the When yes page (`maker-rsvp-stage.tsx`). */
export function announceCelebrate(kind: RsvpCelebration): void {
  window.dispatchEvent(new CustomEvent(RSVP_CELEBRATE_EVENT, { detail: { kind } }));
}

/** A row's tiny looping preview — alive only while the list is open (its row is mounted only then). */
function CelebrationMini({ kind, colours }: { kind: RsvpCelebration; colours: readonly string[] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (kind === 'none') return;
    let alive = true;
    let player: CelebrationPlayer | null = null;
    void import(/* webpackChunkName: "celebration-engine" */ '@/lib/celebration-engine').then(({ CelebrationPlayer }) => {
      if (!alive || !ref.current) return;
      player = new CelebrationPlayer(ref.current);
      const r = ref.current.getBoundingClientRect();
      const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      void player.play(kind, {
        colours,
        reduced,
        loop: true,
        scale: 0.42,
        rect: { x: r.width * 0.22, y: r.height * 0.3, w: r.width * 0.56, h: r.height * 0.4 },
      });
    });
    return () => {
      alive = false;
      player?.stop();
    };
  }, [kind, colours]);
  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-celebration-mini={kind}
      className="block h-8 w-11 rounded-md bg-cream ring-1 ring-ink/10"
    />
  );
}
