'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Play } from 'lucide-react';
import { ChosenRow } from '@/app/_components/form-row';
import { ActionButton } from '@/components/action-button';
import type { PickOption } from '../../website/editor/_components/pick-menu-types';
import { makerProMark, makerProUsable, paidMarkLabel } from '@/lib/paid-mark';
import { PaidMark } from '@/app/_components/paid-mark';
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
 * ONE dropdown (any set of choices is a dropdown — never a pill row), in the
 * app's Form row (owner 2026-10-08, the templates: `INTERACTION_RULES.md` § 9
 * kinds 2 · 6 · 20; the approved gallery § 20 "Pro mark" — *"◆ marks something
 * that is part of Pro. It is shown, not hidden"*): the name left with the Pro
 * mark beside it, the pick in the row's own pill; in the list each choice has a
 * tiny looping preview, ◆ Pro on the four effects, Free on None, the pick
 * ticked. Picking one DRAFTS it like every Maker pick (`onPick` → the panel's
 * one-object save) and replays it on the page; "Play it again" — the house
 * action under the row — replays the current pick. A free couple may try every
 * effect — Apply names it and asks for Event Hub Pro (`planHubDraftApply`).
 * In the app-store shell a couple without Pro is not shown the control at all
 * (`makerProUsable`). WHAT IS PRO, WHO MAY TRY IT AND WHAT APPLY DOES ARE
 * UNCHANGED — only the drawing moved onto the row. (It was a full-width
 * dropdown with its label laid over the button, and a hand-made white pill.)
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
  wrap,
}: {
  /** The screen's own band around the row — drawn only where the row is (never an empty band in the store shell). */
  wrap?: (row: ReactNode) => ReactNode;
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
  const row = (
    <ChosenRow
      data="celebration"
      attrs={{ 'data-rsvp-setting': 'celebration' }}
      name={RSVP_CELEBRATION_LABEL}
      /* ◆ PRO while tried, the diamond once owned — information, never a lock. */
      mark={mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null}
      dataAttr="data-rsvp-celebration-pick"
      value={value}
      buttonText={shown}
      options={options}
      onPick={(key) => {
        if (!isRsvpCelebration(key)) return;
        if (key !== value) onPick(key);
        announceCelebrate(key);
      }}
      below={
        value !== 'none' ? (
          <div className="flex justify-end pb-2" data-rsvp-celebration-again="">
            <ActionButton tone="neutral" icon={Play} label="Play it again" onClick={() => announceCelebrate(value)} />
          </div>
        ) : null
      }
    />
  );
  return wrap ? <>{wrap(row)}</> : row;
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
    void import('@/lib/celebration-engine')
      .then(({ CelebrationPlayer }) => {
        if (!alive || !ref.current) return;
        player = new CelebrationPlayer(ref.current);
        const r = ref.current.getBoundingClientRect();
        const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        void player.play(kind, {
          colours,
          /* Reduced motion: one still picture of the pick, never a loop. */
          ...(reduced ? { freezeAt: 0.9 } : { loop: true }),
          scale: 0.42,
          rect: { x: r.width * 0.22, y: r.height * 0.3, w: r.width * 0.56, h: r.height * 0.4 },
        });
      })
      .catch(() => {
        /* no preview — the row still names the pick */
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
