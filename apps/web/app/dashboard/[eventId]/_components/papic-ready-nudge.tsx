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

import { Camera } from 'lucide-react';
import { papicCardHref } from '@/lib/papic-home-href';
import type { CloseRecord } from '@/lib/notices';
import { Notice, NOTICE_ACTION } from '@/app/_components/notices/notices';

/** A close kept by the older hand-written store on this browser — honoured, so an earlier dismissal holds. */
function legacyClosed(key: string): CloseRecord | null {
  try {
    return window.localStorage.getItem(key) ? { closedAt: Date.now(), count: 1 } : null;
  } catch {
    return null;
  }
}

type Props = {
  eventId: string;
};

/**
 * 🔔 Inventory #13 — News (one notice system, owner approved 14 Nov 2026; prototype §3 B): the terracotta card became a
 * line, "Papic is ready. Guests shoot from your event's QR ⓘ · Open Papic · Got it". Never returns for this event.
 */
export function PapicReadyNudge({ eventId }: Props) {
  return (
    <Notice
      kind="news"
      noticeKey={`papic-ready:${eventId}`}
      title="Papic is ready. Guests shoot from your event’s QR"
      detail="No app, and no limit on cameras. Every photo uses your event’s credits, and each one lands in your Memories."
      actions={
        <a href={papicCardHref(eventId)} className={NOTICE_ACTION}>
          <Camera aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Open Papic
        </a>
      }
      legacy={() => legacyClosed(`setnayan:papic-ready-nudge-dismissed:${eventId}`)}
    />
  );
}
