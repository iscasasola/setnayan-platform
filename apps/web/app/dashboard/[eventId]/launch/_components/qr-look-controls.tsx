'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { makerSave } from '@/lib/maker-refresh';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
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
 *   · ◆ PRO, never a padlock (owner 2026-09-28: *"let us remove padlock and
 *     just show that these tools are for pro with the diamond icon"*); the
 *     diamond once owned. ⚠ The QR look still saves LIVE (it is not in the
 *     draft), so a free couple's pick is still taken to the Event Hub Pro page
 *     — the server refuses too (qr-look-actions). Drafting it is its own build.
 *   · In the app-store shell a locked door is ABSENT, not locked (the same rule
 *     maker-made-once follows): nothing here renders for a free couple there.
 *   · Colour offers only the couple's Mood Board colours that clear the
 *     contrast floor (lib/qr-look.ts qrInkChoices) plus "Ink"; a pale swatch is
 *     never listed, because a QR that photographs well and scans to nothing is
 *     worse than a plain one.
 *
 * The preview beside these is the real `/api/website/qr/<slug>` PNG with a
 * version query; the refresh after a save re-renders the page with a new
 * stamp, so the couple sees their choice on the actual code.
 *
 * ⚡ THE PICK SHOWS AT ONCE, AND IT IS ONE RENDER (owner 2026-09-29: *"make
 * sure 100% that there is no slow response on the maker"*). The dropdowns
 * read the couple's choice from local state the moment it is picked — not from
 * the server's props after the round trip — and it is put back, with the
 * reason, if the save is refused. The save goes through `makerSave` (one
 * refresh per burst, `lib/maker-refresh.ts`); the action no longer
 * `revalidatePath`s the Maker as well, which made every pick render the whole
 * Maker twice.
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
  const mark = makerProMark({ owns: ownsPro, storeShell });
  /* What the dropdowns show: the pick at once, the server's answer once it lands. */
  const [shown, setShown] = useState<StoredQrStyle>(style);
  const latest = useRef<StoredQrStyle>(style);
  const inflight = useRef(0);
  const styleJson = JSON.stringify(style);
  useEffect(() => {
    if (inflight.current > 0) return;
    latest.current = style;
    setShown(style);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed by value
  }, [styleJson]);

  // The store shell shows no paid door to a free couple (App Review 3.1.1).
  if (!ownsPro && storeShell) return null;

  const proPage = `/dashboard/${eventId}/studio/website-pro`;
  const save = (patch: StoredQrStyle) => {
    if (!ownsPro) {
      router.push(proPage);
      return;
    }
    setNote(null);
    const before = latest.current;
    const next: StoredQrStyle = { ...before, ...patch };
    for (const k of Object.keys(patch) as Array<keyof StoredQrStyle>) if (patch[k] === undefined) delete next[k];
    latest.current = next;
    setShown(next);
    inflight.current += 1;
    startTransition(async () => {
      const r = await makerSave(() => action(patch), () => router.refresh()).catch(
        () => ({ ok: false, reason: 'failed' }) as const,
      );
      inflight.current -= 1;
      if (!r.ok) {
        /* ↩ Refused: the dropdowns go back to what is saved, and say why. */
        if (latest.current === next) {
          latest.current = before;
          setShown(before);
        }
        setNote(
          r.reason === 'not_pro'
            ? 'This is part of Event Hub Pro.'
            : r.reason === 'signed_out'
              ? 'Sign in again to change your QR.'
              : 'That did not save. Nothing changed — please try again.',
        );
      }
    });
  };

  const INK_KEY = 'ink';
  const inkOptions: PickOption[] = [
    { key: INK_KEY, label: 'Ink' },
    ...inks.map((hex, i) => ({ key: hex, label: `Mood Board colour ${i + 1} · ${hex}` })),
  ];
  const currentInk = shown.ink && inks.includes(shown.ink) ? shown.ink : INK_KEY;

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
          value={shown.shape ?? 'square'}
          options={QR_SHAPES.map((s) => ({ key: s.key, label: s.label }))}
          onPick={(k) => save({ shape: k as QrShape })}
          dataAttr="data-qr-shape-pick"
          className="bg-ink/5 hover:bg-ink/10"
        />
      </Row>
      <Row label="Pattern">
        <PickMenu
          label="QR pattern"
          value={shown.pattern ?? 'classic'}
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
