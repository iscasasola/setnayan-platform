'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel, paidMarkState } from '@/lib/paid-mark';
import { QR_PATTERNS, QR_SHAPES, type QrPattern, type QrShape, type StoredQrStyle } from '@/lib/qr-look';
import { PickMenu, type PickOption } from '../../website/editor/_components/pick-menu';
import type { UpdateQrStyleResult } from '../qr-look-actions';

/**
 * QrLookControls — the three QR choices on the Maker's Details page, beside
 * the Event Hub address whose code they dress: Shape · Pattern · Colour.
 *
 * ── THE RULES IT WEARS ─────────────────────────────────────────────────────
 *   · ONE dropdown per set of choices, on the shared PickMenu (owner
 *     2026-09-28: "if there are choices, again. us drop down menu") — never a
 *     pill row.
 *   · Paid-to-unlock wears a PADLOCK; unlocked wears the diamond (owner
 *     2026-09-25). A free couple sees the three dropdowns with the padlock
 *     beside each and, on a tap, is taken to the Event Hub Pro page instead of
 *     a save that would be refused — the server refuses too (qr-look-actions).
 *   · In the app-store shell a locked door is ABSENT, not locked (the same rule
 *     maker-made-once follows): nothing here renders for a free couple there.
 *   · Colour offers only the couple's Mood Board colours that clear the
 *     contrast floor (lib/qr-look.ts qrInkChoices) plus "Ink"; a pale swatch is
 *     never listed, because a QR that photographs well and scans to nothing is
 *     worse than a plain one.
 *
 * The preview beside these is the real `/api/website/qr/<slug>` PNG with a
 * version query; `router.refresh()` after a save re-renders the page with a
 * new stamp, so the couple sees their choice on the actual code.
 */
export function QrLookControls({
  eventId,
  ownsPro,
  storeShell,
  style,
  inks,
  action,
}: {
  eventId: string;
  /** Measured by the caller: `printOwnsPro` / `eventCoupleWebsiteProActive`. */
  ownsPro: boolean;
  storeShell: boolean;
  /** The couple's saved choices (`events.style_preferences.qr`, sanitised). */
  style: StoredQrStyle;
  /** Contrast-passing Mood Board hexes, in palette order. */
  inks: string[];
  /** `updateQrStyle` bound to this event. */
  action: (patch: StoredQrStyle) => Promise<UpdateQrStyleResult>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);
  const mark = paidMarkState({ owns: ownsPro, storeShell });

  // The store shell shows no paid door to a free couple (App Review 3.1.1).
  if (!ownsPro && storeShell) return null;

  const proPage = `/dashboard/${eventId}/studio/website-pro`;
  const save = (patch: StoredQrStyle) => {
    if (!ownsPro) {
      router.push(proPage);
      return;
    }
    setNote(null);
    startTransition(async () => {
      const r = await action(patch);
      if (!r.ok) {
        setNote(
          r.reason === 'not_pro'
            ? 'This is part of Event Hub Pro.'
            : r.reason === 'signed_out'
              ? 'Sign in again to change your QR.'
              : 'That did not save. Nothing changed — please try again.',
        );
        return;
      }
      router.refresh();
    });
  };

  const INK_KEY = 'ink';
  const inkOptions: PickOption[] = [
    { key: INK_KEY, label: 'Ink' },
    ...inks.map((hex, i) => ({ key: hex, label: `Mood Board colour ${i + 1} · ${hex}` })),
  ];
  const currentInk = style.ink && inks.includes(style.ink) ? style.ink : INK_KEY;

  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div className="flex min-h-11 items-center justify-between gap-3" data-qr-look-row={label.toLowerCase()}>
      <span className="flex items-center gap-1.5 text-sm text-ink">
        {label}
        {mark ? <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} size="xs" /> : null}
      </span>
      {children}
    </div>
  );

  return (
    <div data-qr-look-controls="" aria-busy={pending} className="flex flex-col gap-1">
      <Row label="Shape">
        <PickMenu
          label="QR shape"
          value={style.shape ?? 'square'}
          options={QR_SHAPES.map((s) => ({ key: s.key, label: s.label }))}
          onPick={(k) => save({ shape: k as QrShape })}
          dataAttr="data-qr-shape-pick"
          className="bg-ink/5 hover:bg-ink/10"
        />
      </Row>
      <Row label="Pattern">
        <PickMenu
          label="QR pattern"
          value={style.pattern ?? 'classic'}
          options={QR_PATTERNS.map((p) => ({ key: p.key, label: p.label }))}
          onPick={(k) => save({ pattern: k as QrPattern })}
          dataAttr="data-qr-pattern-pick"
          className="bg-ink/5 hover:bg-ink/10"
        />
      </Row>
      <Row label="Colour">
        <span className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className="h-4 w-4 shrink-0 rounded-full border border-ink/15"
            style={{ backgroundColor: currentInk === INK_KEY ? '#1A1A1A' : currentInk }}
          />
          <PickMenu
            label="QR colour"
            value={currentInk}
            options={inkOptions}
            onPick={(k) => save({ ink: k === INK_KEY ? undefined : k })}
            dataAttr="data-qr-ink-pick"
            className="bg-ink/5 hover:bg-ink/10"
          />
        </span>
      </Row>
      {inks.length === 0 && ownsPro ? (
        <p className="text-xs text-ink/55">Build your Mood Board to pick a colour — only colours dark enough to scan are offered.</p>
      ) : null}
      {note ? (
        <p role="alert" className="text-xs text-danger-800">
          {note}
        </p>
      ) : null}
    </div>
  );
}
