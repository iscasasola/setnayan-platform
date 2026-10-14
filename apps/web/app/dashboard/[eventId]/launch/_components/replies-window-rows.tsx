'use client';

import { ChosenRow } from '@/app/_components/form-row';
import { DateRow } from '@/app/_components/form-row-date';
import type { KeepAnswer } from '@/lib/form-row';
import { REPLIES_CLOSE, REPLIES_OPEN, type RepliesClose, type RepliesOpen, type RsvpAskConfig } from '@/lib/rsvp-ask';

/**
 * 📬 DETAILS › RSVP — WHEN REPLIES OPEN AND CLOSE (owner 2026-10-14, DECISION_LOG 📬 "RSVP GETS ITS OWN
 * OPEN AND CLOSE"). Two dropdowns — each ONE PickMenu in a Form row (`ChosenRow`, control templates
 * § 6) — and, under an "On a date…" pick, the one calendar (`DateRow`, § 8, `lib/calendar-grid.ts`):
 *
 *   Replies open  ▾  With the invitation · On a date… · Now · Closed
 *   Replies close ▾  On the event day · On the reply-by date · On a date…
 *
 * "Now" and "Closed" override the dates until switched back (item 4), so under them "Replies close"
 * has nothing to decide and is not drawn. The values are keys of the ONE `rsvp_ask_config` object the
 * panel already saves to the DRAFT (`save`), so guests see a change only at ✓ Apply — and the window
 * itself is read by every reply door and writer through `replyWindow` (lib/reply-window.ts).
 * The defaults are stored as NO key (sparse, like every other key here), so picking one back is no change.
 */
export const REPLIES_OPEN_LABEL: Record<RepliesOpen, string> = {
  with_invitation: 'With the invitation',
  on_date: 'On a date…',
  now: 'Now',
  closed: 'Closed',
};
export const REPLIES_CLOSE_LABEL: Record<RepliesClose, string> = {
  // Owner 2026-10-14: "it is the actual day of the event" — never the stage's old name.
  on_the_day: 'On the event day',
  reply_by: 'On the reply-by date',
  on_date: 'On a date…',
};
export const REPLIES_OPEN_NAME = 'Replies open';
export const REPLIES_CLOSE_NAME = 'Replies close';

export function RepliesWindowRows({
  config,
  onSave,
}: {
  config: RsvpAskConfig;
  /** The panel's own draft save — the WHOLE object travels; a refusal comes back in words. */
  onSave: (patch: RsvpAskConfig, what: string) => Promise<KeepAnswer>;
}) {
  const open = config.repliesOpen ?? 'with_invitation';
  const close = config.repliesClose ?? 'on_the_day';
  const openOn = config.repliesOpenOn ?? null;
  const closeOn = config.repliesCloseOn ?? null;
  return (
    <>
      <ChosenRow
        data="replies-open"
        name={REPLIES_OPEN_NAME}
        value={open}
        options={REPLIES_OPEN.map((key) => ({ key, label: REPLIES_OPEN_LABEL[key] }))}
        onPick={(key) => {
          if (key === open) return;
          void onSave({ repliesOpen: key === 'with_invitation' ? undefined : (key as RepliesOpen) }, `“${REPLIES_OPEN_NAME}”`);
        }}
        attrs={{ 'data-rsvp-setting': 'replies-open' }}
      />
      {open === 'on_date' ? (
        <DateRow
          data="replies-open-on"
          name="Opens on"
          value={openOn}
          max={close === 'on_date' ? closeOn : null}
          onKeep={(day) => onSave({ repliesOpenOn: day }, '“Opens on”')}
          attrs={{ 'data-rsvp-setting': 'replies-open-on' }}
        />
      ) : null}
      {open === 'now' || open === 'closed' ? null : (
        <ChosenRow
          data="replies-close"
          name={REPLIES_CLOSE_NAME}
          value={close}
          options={REPLIES_CLOSE.map((key) => ({ key, label: REPLIES_CLOSE_LABEL[key] }))}
          onPick={(key) => {
            if (key === close) return;
            void onSave({ repliesClose: key === 'on_the_day' ? undefined : (key as RepliesClose) }, `“${REPLIES_CLOSE_NAME}”`);
          }}
          attrs={{ 'data-rsvp-setting': 'replies-close' }}
        />
      )}
      {open !== 'now' && open !== 'closed' && close === 'on_date' ? (
        <DateRow
          data="replies-close-on"
          name="Closes on"
          value={closeOn}
          min={open === 'on_date' ? openOn : null}
          onKeep={(day) => onSave({ repliesCloseOn: day }, '“Closes on”')}
          attrs={{ 'data-rsvp-setting': 'replies-close-on' }}
        />
      ) : null}
    </>
  );
}
