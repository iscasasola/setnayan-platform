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

import { papicHomeHref } from '@/lib/papic-home-href';
import { useEffect, useState } from 'react';
import { Camera, ChevronRight, X } from 'lucide-react';

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

  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-terracotta/35 bg-terracotta/[0.07] px-4 py-3.5 sm:items-center sm:px-5"
    >
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-terracotta-700 text-cream sm:mt-0"
      >
        <Camera className="h-4 w-4" strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-terracotta-700">
          Already on
        </p>
        <p className="text-base font-semibold text-ink">Papic is ready</p>
        <p className="text-sm text-ink/65">
          Guests shoot from your event’s QR — no app, and no limit on cameras. Every
          photo uses your event’s credits, and each one lands in your Memories.
        </p>
        <a
          href={papicHomeHref(eventId)}
          className="group mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-terracotta hover:underline"
        >
          Open Papic
          <ChevronRight
            aria-hidden
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </a>
      </div>
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss the Papic reminder"
        className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-terracotta/15 hover:text-ink"
      >
        <X className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
