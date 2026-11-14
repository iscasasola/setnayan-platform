'use client';

/**
 * "Papic is ready" nudge — option B of Papic promotion PR-G
 * (owner picked A + B on 2026-07-30 from
 * `06_Prototypes/Papic_Home_Presence_2026-07-30.html`).
 *
 * 🔑 RE-WORDED 25 Oct — IT USED TO PROMISE A FREE CAMERA THAT DOES NOT EXIST. It
 * said "Your free camera is ready · every event comes with one free camera of its
 * own, and a shared pool of its own — nothing to buy". Owner, 25 Oct: *"unlimited
 * camera but papic credits is used"* and *"free 50 credits is only on their first
 * event"*; and the admin config gives a free camera no credits of its own
 * (`papic_event_pool_config.free_one_camera_points` / `camera_grant_points`, read
 * them — never quote them). So: cameras are unlimited, every photo spends the
 * event's credits, and the free credits are the ACCOUNT's, once
 * (`PAPIC_FREE_CREDIT_CONDITION`). This band does not know whether THIS event got
 * them, so it says nothing about free credits at all — never a promise it cannot
 * check.
 *
 * The premise that survives is the one-time telling: Papic is switched on for this
 * event and nothing has been shot yet. It is deliberately a SIBLING of `SetDateNudge` — same
 * band geometry, same terracotta hairline, same eyebrow / title / one-line body /
 * one link / dismiss shape, same per-event `localStorage` memory — because a
 * second nudge style on the same slot would read as a second kind of message.
 *
 * ── WHAT MAKES IT RETIRE ITSELF (three ways, all deliberate) ─────────────────
 *   1. The host dismisses it → remembered per event, forever. A one-time setup
 *      notice earns a permanent dismiss, exactly as the set-date nudge does.
 *   2. The first photo lands → the parent stops mounting it (`preCapture` goes
 *      false in lib/papic-home-tile.ts). Someone already shooting does not need
 *      to be told they own a camera.
 *   3. The Papic mini-tile takes over → the tile is the permanent "where it
 *      stands" readout; this band only ever answered "you already have this".
 *
 * ── IT WAITS ITS TURN (owner default, PR-G question 3) ──────────────────────
 * On a date-less event the set-date nudge is already in this slot, and two
 * stacked bands read as clutter. The parent renders THIS one only when the
 * set-date nudge is not showing, so the couple is asked for one thing at a time.
 * Set-date goes first because everything date-gated (the whole public-site
 * lifecycle) waits on it.
 *
 * NO NUMBER IN THE COPY. What the event holds is admin-editable
 * (`papic_event_pool_config`), and the tile beside it renders the live figures
 * derived from the same read. A literal here would be the one place that drifts.
 */

import { papicCardHref } from '@/lib/papic-home-href';
import { useEffect, useState } from 'react';
import { Camera, ChevronRight, X } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';

type Props = {
  eventId: string;
};

const DISMISS_KEY = (eventId: string) => `setnayan:papic-ready-nudge-dismissed:${eventId}`;

export function PapicReadyNudge({ eventId }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Hydrate dismiss state from localStorage on mount.
  useEffect(() => {
    try {
      if (window.localStorage.getItem(DISMISS_KEY(eventId))) {
        setDismissed(true);
      }
    } catch {
      // localStorage unavailable (private mode); just render the nudge.
    }
  }, [eventId]);

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY(eventId), '1');
    } catch {
      // swallow — UI still hides via state below
    }
    setDismissed(true);
  };

  // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 2 · 5 · 7 · 13): no bordered tinted card — the warm surface; "Already on" is
  // the soft chip (not a typewriter caption); the how-it-works lines sit behind the title's ⓘ; the close presses at 44.
  return (
    <div role="status" className="mt-4 flex items-start gap-3 rounded-card bg-[var(--m-paper-2)] px-4 py-3">
      <Camera aria-hidden className="mt-1 h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <InfoTip label="Papic is ready" labelAs="p" labelClassName="text-base font-semibold text-ink" align="start">
            Guests shoot from your event’s QR — no app, and no limit on cameras. Every photo uses your event’s credits,
            and each one lands in your Memories.
          </InfoTip>
          <Badge tone="ok">Already on</Badge>
        </div>
        <a
          href={papicCardHref(eventId)}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-terracotta-700 hover:underline"
        >
          Open Papic
          <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss the Papic reminder"
        className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink/75 hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
