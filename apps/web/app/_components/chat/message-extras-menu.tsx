'use client';

/**
 * ⋯ WHAT YOU CAN DO WITH ONE MESSAGE — Edit · Unsend · Remind me (Unichat H1; approved prototype v3, DECISION_LOG
 * 2026-11-20: "Hold your own new message: Edit or Unsend." · "… voice notes, reminders …").
 *
 * Opened by holding a bubble (touch), a right-click, or the ⋯ beside it (pointer and keyboard). It carries ONLY these
 * three: the 🔒 beside the message box is still the one door to a private message (11 Nov), and a tap is still a heart.
 *
 *   Edit      your own words, for 15 minutes — the words go back into the message box; Send saves them.
 *   Unsend    your own words or voice note, for 15 minutes — at once, no second question; everyone reads
 *             "… unsent a message".
 *   Remind me any message you can read — later today · tomorrow · a date. It comes back in the bell, to you alone.
 *
 * What is offered here is the screen's guess (`canOfferEdit` / `canOfferUnsend`); the database decides, and a refusal
 * is said in words under the rows. A reminder that could not be READ says so — it never looks like "no reminder".
 */
import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, ChevronLeft, Clock, Pencil, Sunrise, Undo2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { formatChatTimestamp } from '@/lib/chat';
import { setChatReminder, unsendChatMessage } from '@/lib/chat-message-actions';
import { DateRow } from '@/app/_components/form-row-date';
import {
  CHAT_REMINDERS_NOT_LOADED,
  CHAT_REMINDER_NOT_SET,
  REMINDER_LATER_HOURS,
  manilaDayKey,
  reminderDateBounds,
  reminderWhen,
  type ReminderChoice,
} from '@/lib/chat-reminders';

export const EDIT_NEEDS_THE_BOX = 'The message box isn’t open in this chat, so it can’t be edited here.';

export function MessageExtrasMenu({
  messageId,
  side,
  alignEnd,
  canEdit,
  canUnsend,
  onClose,
  onEdit,
  onUnsent,
  onLine,
}: {
  messageId: string;
  /** The side of the chat this screen is — which door the reminder's notice opens. */
  side: 'couple' | 'vendor';
  alignEnd: boolean;
  canEdit: boolean;
  canUnsend: boolean;
  onClose: () => void;
  /** Put the words into the message box. `false` = no box took them (nothing to edit in here). */
  onEdit: () => boolean;
  onUnsent: (unsentAt: string) => void;
  /** A quiet line under the bubble once the menu has closed ("Reminder set · Tomorrow, 9:00 AM"). */
  onLine: (text: string) => void;
}) {
  const [view, setView] = useState<'rows' | 'remind'>('rows');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);
  // undefined = still reading · null = the read was refused · { at } = what is set (at null = none).
  const [reminder, setReminder] = useState<{ at: string | null } | null | undefined>(undefined);
  const [now] = useState(() => Date.now());
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    boxRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    boxRef.current?.scrollIntoView({ block: 'nearest' });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The reminder already on this message, read when "Remind me" opens — one small own-rows read, on demand.
  useEffect(() => {
    if (view !== 'remind' || reminder !== undefined) return;
    let live = true;
    void createClient()
      .from('chat_message_reminders')
      .select('remind_at')
      .eq('message_id', messageId)
      .is('delivered_at', null)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live) return;
        setReminder(error ? null : { at: (data as { remind_at: string } | null)?.remind_at ?? null });
      });
    return () => {
      live = false;
    };
  }, [view, reminder, messageId]);

  const unsend = async () => {
    setBusy(true);
    setRefused(null);
    const out = await unsendChatMessage(messageId);
    setBusy(false);
    if (!out.ok) {
      setRefused(out.message);
      return;
    }
    onUnsent(out.unsentAt);
    onClose();
  };

  /** Set (or move) the reminder. `true` = set, and the menu has closed. */
  const remind = async (choice: ReminderChoice, date: string | null = null): Promise<boolean> => {
    setBusy(true);
    setRefused(null);
    const out = await setChatReminder({ messageId, choice, date, side });
    setBusy(false);
    if (!out.ok) {
      setRefused(out.message);
      return false;
    }
    onLine(out.remindAt ? `Reminder set · ${formatChatTimestamp(out.remindAt)}` : 'Reminder set');
    onClose();
    return true;
  };

  const removeReminder = async () => {
    setBusy(true);
    setRefused(null);
    const out = await setChatReminder({ messageId, choice: 'later', side, intent: 'clear' });
    setBusy(false);
    if (!out.ok) {
      setRefused(out.message);
      return;
    }
    onLine('Reminder removed');
    onClose();
  };

  const rowCls =
    'sn-press grid min-h-11 w-full grid-cols-[28px_minmax(0,1fr)] items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left disabled:opacity-50';
  const dot = 'grid h-7 w-7 place-items-center rounded-full bg-ink/[0.05] text-ink/70';
  const later = reminderWhen('later', now);
  const tomorrow = reminderWhen('tomorrow', now);
  // "Later today" only while it still IS today (Manila); late at night the same choice is called what it is.
  const laterIsToday = later.ok && manilaDayKey(later.at) === manilaDayKey(now);
  const bounds = reminderDateBounds(now);

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label={view === 'remind' ? 'Remind me' : 'Message options'}
      className={`relative z-10 mt-1 w-[min(300px,calc(100vw-32px))] rounded-2xl bg-frame p-1.5 shadow-sn-frame ${alignEnd ? 'self-end' : 'self-start'}`}
      data-chat-extras-menu={view}
      data-no-heart=""
    >
      <div className="flex items-center gap-1 px-1">
        {view === 'remind' ? (
          <button
            type="button"
            onClick={() => {
              setView('rows');
              setRefused(null);
            }}
            aria-label="Back"
            className="sn-press grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink hover:bg-ink/[0.05]"
          >
            <ChevronLeft aria-hidden className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : null}
        <h4 className={`min-w-0 flex-1 truncate text-[14px] font-semibold text-ink ${view === 'remind' ? '' : 'pl-1.5'}`}>{view === 'remind' ? 'Remind me' : 'This message'}</h4>
        <button type="button" onClick={onClose} className="sn-press min-h-11 px-2 text-[13px] font-semibold text-sn-accent">
          Done
        </button>
      </div>

      {view === 'rows' ? (
        <ul className="grid">
          {canEdit ? (
            <li>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (onEdit()) onClose();
                  else setRefused(EDIT_NEEDS_THE_BOX);
                }}
                className={rowCls}
                data-chat-extras="edit"
              >
                <span aria-hidden className={dot}>
                  <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <b className="truncate text-[15px] font-semibold text-ink">Edit</b>
              </button>
            </li>
          ) : null}
          {canUnsend ? (
            <li>
              <button type="button" disabled={busy} onClick={() => void unsend()} className={rowCls} data-chat-extras="unsend">
                <span aria-hidden className={dot}>
                  <Undo2 className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <span className="grid min-w-0">
                  <b className="truncate text-[15px] font-semibold text-ink">Unsend</b>
                  <span className="truncate text-[12px] text-ink/60">Removes it for everyone</span>
                </span>
              </button>
            </li>
          ) : null}
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setView('remind');
                setRefused(null);
              }}
              className={rowCls}
              data-chat-extras="remind"
            >
              <span aria-hidden className={dot}>
                <Bell className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="grid min-w-0">
                <b className="truncate text-[15px] font-semibold text-ink">Remind me</b>
                <span className="truncate text-[12px] text-ink/60">Only you are reminded</span>
              </span>
            </button>
          </li>
        </ul>
      ) : (
        <ul className="grid">
          {reminder === undefined ? (
            <li className="px-2.5 py-2 text-[13px] text-ink/60">Loading your reminder…</li>
          ) : reminder === null ? (
            <li role="alert" className="px-2.5 py-2 text-[13px]" style={{ color: 'rgb(var(--color-danger))' }} data-chat-reminder-unread="">
              {CHAT_REMINDERS_NOT_LOADED}
            </li>
          ) : reminder.at ? (
            <li className="px-2.5 py-1.5 text-[13px] text-ink/70" data-chat-reminder-set="">
              Reminder set · {formatChatTimestamp(reminder.at)}. Pick a new time to move it.
            </li>
          ) : null}
          <li>
            <button type="button" disabled={busy} onClick={() => void remind('later')} className={rowCls} data-chat-remind="later">
              <span aria-hidden className={dot}>
                <Clock className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="grid min-w-0">
                <b className="truncate text-[15px] font-semibold text-ink">{laterIsToday ? 'Later today' : `In ${REMINDER_LATER_HOURS} hours`}</b>
                <span className="truncate text-[12px] text-ink/60">{later.ok ? formatChatTimestamp(new Date(later.at).toISOString(), now) : ''}</span>
              </span>
            </button>
          </li>
          <li>
            <button type="button" disabled={busy} onClick={() => void remind('tomorrow')} className={rowCls} data-chat-remind="tomorrow">
              <span aria-hidden className={dot}>
                <Sunrise className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="grid min-w-0">
                <b className="truncate text-[15px] font-semibold text-ink">Tomorrow</b>
                <span className="truncate text-[12px] text-ink/60">{tomorrow.ok ? formatChatTimestamp(new Date(tomorrow.at).toISOString(), now) : ''}</span>
              </span>
            </button>
          </li>
          <li className="px-2.5 py-1" data-chat-remind="date">
            {/* The app's one date row: a tap on a day IS the answer — the reminder is set for 9:00 AM that day. */}
            <DateRow
              name="On a date"
              value={null}
              empty="Pick a date"
              today={manilaDayKey(now)}
              min={bounds.min}
              max={bounds.max}
              onKeep={async (day) => {
                const out = await remind('date', day);
                return out ? undefined : { ok: false as const, error: CHAT_REMINDER_NOT_SET };
              }}
            />
          </li>
          {reminder?.at ? (
            <>
              <li role="none" className="mx-2.5 my-1 border-t border-ink/10" />
              <li>
                <button type="button" disabled={busy} onClick={() => void removeReminder()} className={rowCls} data-chat-remind="remove">
                  <span aria-hidden className={dot}>
                    <BellOff className="h-3.5 w-3.5" strokeWidth={2} />
                  </span>
                  <b className="truncate text-[15px] font-semibold text-ink">Remove reminder</b>
                </button>
              </li>
            </>
          ) : null}
        </ul>
      )}
      {refused ? (
        <p role="alert" className="px-2.5 pb-1.5 pt-1 text-[13px]" style={{ color: 'rgb(var(--color-danger))' }} data-chat-extras-refused="">
          {refused}
        </p>
      ) : null}
    </div>
  );
}
