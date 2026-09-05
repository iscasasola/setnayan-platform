'use client';

/**
 * "A Setnayan celebration" — MB22's half of MB20's promise.
 *
 * MB20 gave every event-linked gallery photo a discreet SEAL instead of the
 * ordinary URL stamp, deliberately smaller and quieter than the stamp so it
 * would not deface the material it distinguishes ("the standing-out is done
 * in the picker, not in the pixels" — MB20's own brief). This badge is that
 * standing-out: it renders where the couple is actually comparing photos,
 * one per card, ONLY on the rows that earned the seal.
 *
 * 🔑 WHY ITS OWN FILE. Same reasoning as `saved-photo-marker.tsx`: a real
 * render test (`event-linked-badge-reaches-the-render.test.ts`) against the
 * actual copy, plus a source-anchored guard proving `gallery-picker.tsx`
 * mounts it from `asset.isEventLinked` — the one thing per row that must
 * drive it — rather than a hard-coded `true` that would pass every pixel
 * guard while badging a back-catalogue photo. See this arc's own lesson,
 * `[[presence-of-ink-is-not-fit-of-ink]]`: MB20's sharpest finding was a
 * hard-coded watermark variant passing all 35 pixel guards while every
 * celebration silently lost its seal. A badge is the same shape of risk.
 */

export const EVENT_LINKED_BADGE_LABEL = 'A Setnayan celebration';

export function EventLinkedBadge({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span
      className="badge event-linked"
      title="This photo was delivered on a celebration booked through Setnayan"
    >
      {EVENT_LINKED_BADGE_LABEL}
    </span>
  );
}
