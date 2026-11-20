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
import { Bell, BellOff, CalendarDays, ChevronLeft, Clock, Pencil, Sunrise, Undo2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/client';
import { formatChatTimestamp } from '@/lib/chat';
import { clearChatReminder, setChatReminder, unsendChatMessage } from '@/lib/chat-message-actions';
import {
  CHAT_REMINDERS_NOT_LOADED,
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
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState('');
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

  const remind = async (choice: ReminderChoice) => {
    setBusy(true);
    setRefused(null);
    const out = await setChatReminder({ messageId, choice, date: choice === 'date' ? date : null, side });
    setBusy(false);
    if (!out.ok) {
      setRefused(out.message);
      return;
    }
    onLine(`Reminder set · ${formatChatTimestamp(out.remindAt)}`);
    onClose();
  };

  const removeReminder = async () => {
    setBusy(true);
    setRefused(null);
    const out = await clearChatReminder(messageId);
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
      className={`relative z-10 mt-1 w-[min(300px,calc(100vw-32px))] rounded-2xl bg-[color:var(--m-paper)] p-1.5 shadow-lg ring-1 ring-ink/10 ${alignEnd ? 'self-end' : 'self-start'}`}
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
          <li>
            {picking ? (
              <div className="flex items-center gap-2 px-2.5 py-1.5">
                <label className="grid min-w-0 flex-1 gap-0.5 text-[12px] text-ink/60">
                  On a date · 9:00 AM
                  <input
                    type="date"
                    value={date}
                    min={bounds.min}
                    max={bounds.max}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-11 w-full min-w-0 rounded-xl border border-ink/15 bg-[color:var(--m-paper)] px-2.5 text-[15px] text-ink"
                    data-chat-remind-date=""
                  />
                </label>
                <button
                  type="button"
                  disabled={busy || !date}
                  onClick={() => void remind('date')}
                  className="sn-press min-h-11 shrink-0 self-end px-2 text-[14px] font-semibold text-sn-accent disabled:opacity-50"
                  data-chat-remind="date"
                >
                  Set
                </button>
              </div>
            ) : (
              <button type="button" disabled={busy} onClick={() => setPicking(true)} className={rowCls} data-chat-remind="pick">
                <span aria-hidden className={dot}>
                  <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
                </span>
                <b className="truncate text-[15px] font-semibold text-ink">Pick a date</b>
              </button>
            )}
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
