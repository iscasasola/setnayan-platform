'use client';

import { useRef, useState, type ReactNode } from 'react';
import { SUPERSEDED, makerLatestWrite, makerNeedsRender, makerSave, requestMakerRefresh } from '@/lib/maker-refresh';
import { RSVP_REPLY_BY_EVENT, rsvpReplyByLine } from '@/lib/rsvp-stage';
import { HUB_DRAFT_FIELD } from '@/lib/hub-draft';
import type { updatePaxSettings } from '../../actions';
import { HubSavesImmediately } from '../../website/_components/hub-draft-field';

export const REPLY_BY_LABEL = 'Reply by';
/**
 * The row's sentence. ⚠ DELIBERATELY NOT the prototype's *"Replies close that
 * day and the headcount locks"*: since the owner's 2026-09-30 ruling ("i must
 * click a finalize to finalize it", `lib/guest-list-closed.ts`) NO date closes
 * replies or locks the count — only Finalize does. The reply-by date is what
 * the invitation PRINTS. Saying it closes anything would be a false promise
 * about money (a caterer prices the locked count).
 */
export const REPLY_BY_LINE = 'Your invitation asks guests to reply by this day.';

type PaxAction = typeof updatePaxSettings;

/**
 * 📅 REPLY BY — `events.guest_list_edit_deadline`, ONE part in every door
 * (owner 2026-10-07, HOME_AND_GUESTS_CHECK G31 and § "Setup ↔ Event Hub Maker"):
 *
 *   · `layout="frame"` also Guests › Setup (2026-10-09, step 3) — the SAME frame the Maker hands in, with `draft` off: the date
 *                      writes live (there is no Apply there), the row says so with `data-writes-live`;
 *   · `layout="stack"` Event Details' RSVP item and the RSVP stage's form — the
 *                      date, "· your date / · 30 days before", Use the default;
 *   · `layout="frame"` the Maker's Studio › RSVP and the RSVP stage's form — ONE
 *                      row, drawn by the door itself (`frame`): the Maker hands in
 *                      the app's Form row with a date (`DateRow`, the approved
 *                      gallery's "Reply by" — a pill with a calendar mark that opens
 *                      the one calendar), so this file carries no template and
 *                      Guests › Setup's page does not download one. THIS part still
 *                      owns the value, the one writer and what a refusal does; the
 *                      frame only draws. (It PRINTED the date, read only, until the
 *                      owner's preview check 2026-10-08: *"where it the reply by
 *                      date?"* → *"date is not changeable on studio."* — no
 *                      go-elsewhere: the control is right there. Always mounted with
 *                      `draft`.)
 *
 * One writer: `updatePaxSettings` (it writes the pricing view beside the date,
 * so the current one is posted back unchanged). Saved behind the pick, one
 * write per pause (`makerLatestWrite`), `held` + `maker_quiet` (no page render
 * rides on the answer); a refused save puts the date back and says so. The
 * stage's frames hear the new line (`RSVP_REPLY_BY_EVENT`); off the Maker
 * nobody listens and nothing happens.
 *
 * ⏳ TWO DOORS, ONE RULE EACH (owner 2026-10-08, "draft 1-3", over the 2026-10-07
 * part): in the MAKER (`draft`) the date goes into the hub draft and reaches
 * guests at ✓ Apply — `updatePaxSettings` reads `HUB_DRAFT_FIELD` — so it does
 * not say "Guests see this right away", never says "Saved.", and a drafted pick
 * ends in the one render that moves the count on ✓ Apply (`makerNeedsRender`).
 * On Guests › Setup there is no Apply: the date writes live, as before, and the
 * stack layout says so.
 */
/** What a door's own frame is handed to draw the row with (`layout="frame"`). */
export type ReplyByFrame = {
  /** The row's name — "Reply by". */
  name: string;
  /** The couple's own date as it stands now (`YYYY-MM-DD`, '' = the default applies). */
  own: string;
  /** The 30-day default the row reads while there is no date of their own. */
  fallback: string | null;
  /** Keep this day: the ONE write. Answers whether it landed and, if not, why — the date is already back as it was. */
  keep: (day: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** The part's own marks, for the row the frame draws (never a wrapper: a row must stay a direct child of its list). */
  attrs: Readonly<Record<`data-${string}`, string>>;
};

export function ReplyBy({
  eventId,
  own,
  pricingMode,
  fallback = null,
  action,
  layout,
  draft = false,
  frame,
}: {
  /** `layout="frame"`: the door's own row (the Maker's Form row with a date). */
  frame?: (row: ReplyByFrame) => ReactNode;
  eventId: string;
  /** The couple's own date (null = the 30-day default). */
  own: string | null;
  pricingMode: 'realtime' | 'final_only';
  /** The 30-day default the field reads while no date of their own is set. */
  fallback?: string | null;
  action?: PaxAction;
  layout: 'stack' | 'frame';
  /** ⏳ The Maker's door: the date waits in the hub draft for ✓ Apply (owner 2026-10-08, "draft 1-3"). */
  draft?: boolean;
}) {
  const [value, setValue] = useState(own ?? '');
  const saved = useRef(own ?? '');
  const newest = useRef(0);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const shown = value || fallback;

  const pick = (next: string): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!action) return Promise.resolve({ ok: false, error: 'It cannot be changed here.' });
    setValue(next);
    setNote(null);
    announceReplyByLine(rsvpReplyByLine(next || fallback));
    const tap = ++newest.current;
    return (async () => {
      let res: { ok: boolean; message?: string } | typeof SUPERSEDED;
      try {
        res = await makerSave(
          () =>
            makerLatestWrite('events.guest_list_edit_deadline', () => {
              const fd = new FormData();
              fd.set('event_id', eventId);
              fd.set('guest_list_edit_deadline', next);
              fd.set('adaptive_pricing_mode', pricingMode);
              fd.set('maker_quiet', '1');
              /* ⏳ Reply by waits for ✓ Apply in the Maker (owner 2026-10-08, "draft 1-3"). */
              if (draft) fd.set(HUB_DRAFT_FIELD, '1');
              return action(fd);
            }),
          requestMakerRefresh,
          { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
        );
      } catch {
        res = { ok: false, message: 'Please try again.' };
      }
      /* A later pick carried this one, or is on its way: it answers for both. */
      if (res === SUPERSEDED || tap !== newest.current) return { ok: true as const };
      if (res.ok) {
        saved.current = next;
        /* ⏳ Drafted (the Maker): the pick is held and its answer carries no bar, so nothing moved the
           count on ✓ Apply — ask for the ONE render a held burst owes (`makerNeedsRender`, as the
           thank-you words do), and say nothing: a date guests do not read yet is not "Saved." */
        if (draft) makerNeedsRender();
        else setNote({ ok: true, text: 'Saved.' });
        return { ok: true as const };
      }
      setValue(saved.current);
      announceReplyByLine(rsvpReplyByLine(saved.current || fallback));
      const why = `It is back as it was. ${res.message ?? ''}`.trim();
      setNote({ ok: false, text: `The reply-by date did not save, so it is back as it was. ${res.message ?? ''}`.trim() });
      return { ok: false as const, error: why };
    })();
  };

  /* 🧭 The Maker's doors (Studio › RSVP, the RSVP stage's form): the door draws the row — no box, no sentence, no
     "Saved", no "Guests see this right away" (the date waits for ✓ Apply). A refused pick is SAID by the row itself
     (`keep` answers why), and the date is already back as it was. */
  if (layout === 'frame') {
    return <>{frame ? frame({ name: REPLY_BY_LABEL, own: value, fallback, keep: pick, attrs: draft ? { 'data-setup-row': 'reply-by', 'data-rsvp-setting': 'reply-by', 'data-reply-by-field': 'draft' } : { 'data-setup-row': 'reply-by', 'data-rsvp-setting': 'reply-by', 'data-reply-by-field': 'live', 'data-writes-live': '' } }) : null}</>;
  }

  const field = (
    <input
      type="date"
      value={value || fallback || ''}
      onChange={(e) => void pick(e.target.value)}
      aria-label={layout === 'stack' ? 'Reply by — your own date' : REPLY_BY_LABEL}
      className="min-h-10 rounded-full border border-ink/15 bg-white px-3 text-[13px] text-ink"
    />
  );
  const status = note ? (
    <p role={note.ok ? 'status' : 'alert'} className={`text-[13px] ${note.ok ? 'text-success-800' : 'text-terracotta-700'}`}>
      {note.text}
    </p>
  ) : null;

  return (
    <div className="flex flex-col gap-1.5" data-reply-by-field="live" data-writes-live="">
      {shown ? (
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-base font-semibold text-ink" data-reply-by={shown}>
            {formatReplyDay(shown)}
          </span>
          <span className="text-sm text-ink/60">{value ? '· your date' : '· 30 days before'}</span>
        </p>
      ) : (
        <p className="text-sm text-ink/60">Set your event date first.</p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {field}
        {value ? (
          <button
            type="button"
            onClick={() => void pick('')}
            className="sn-press inline-flex min-h-11 items-center px-2 text-[13px] font-semibold text-ink/70 underline underline-offset-2"
          >
            Use the default
          </button>
        ) : null}
      </div>
      {/* ⏳ Drafted in the Maker since 2026-10-08 ("draft 1-3") — no "Guests see this right away" there. */}
      {draft ? null : <HubSavesImmediately />}
      {status}
    </div>
  );
}

/** "December 12, 2026" from `YYYY-MM-DD`, without a timezone shift — the Maker's one date format (owner 2026-10-05). */
export function formatReplyDay(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** The reply-by sentence, drawn — the RSVP stage lays it on the form's "Please reply by …". */
function announceReplyByLine(line: string): void {
  window.dispatchEvent(new CustomEvent(RSVP_REPLY_BY_EVENT, { detail: { line } }));
}
