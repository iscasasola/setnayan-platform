'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ChosenRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { TimeRow } from '@/app/_components/form-row-time';
import { InfoTip } from '@/app/_components/info-tip';
import { DEFAULT_MOMENT_MINUTES, clockWords, minutesBetween, momentStartFrom, shiftWall, wallTime, type Chapter } from '@/lib/schedule-chapters';
import { askStateWords, asksOnMoment, shopNameOf, type HostAsk } from '@/lib/schedule-ask';
import type { ChapterMoment } from './chapters-host';

/**
 * 🗓 ASK A SUPPLIER TO CHANGE THEIR TIMES — on the moment sheet (owner 2026-11-02, DECISION_LOG "A SUPPLIER'S SCHEDULE
 * BASICS FOR THIS WEEK" item 2: *"receive requests for schedules from hosts of the event and coordinator"*; supplier
 * gate audit D2). The host, or a coordinator who edits the day, asks a BOOKED supplier for a new time on this moment;
 * the supplier answers Accept or Decline on their own Schedule, and the answer shows here:
 *
 *   · "Asked of suppliers" — each supplier's latest ask on this moment and its state (waiting · said yes · said no,
 *     with their reason). A refused read is said, never drawn as "nothing asked".
 *   · Ask a supplier ▸ opens the ask in place: Supplier ▾ · New time · Minutes · Note, then Send ask. The sheet stays
 *     where it is (a save never resets the screen); the database decides who may ask (migration 20271303655108).
 *
 * The door: `MomentDoors.ask` → `updateScheduleBlock` (moment_op `ask_supplier`) → `lib/schedule-ask.server.ts`.
 */

type Answer = { ok: true; value: string } | { ok: false; error: string };

export function AskSupplierSection({
  moment: m,
  chapter: c,
  suppliers,
  asks,
  ask,
  onAsked,
  askLabel = 'Ask a supplier to change their times',
  bare = false,
  opener,
  noOpenButton = false,
}: {
  /** On a held chapter (frame 2): just the button under the hours — no "Asked of suppliers" heading until one is asked. */
  bare?: boolean;
  /** The button's words — "Ask Blue Leaf to change" on a chapter a venue holds (2026-11-04). */
  askLabel?: string;
  moment: Pick<ChapterMoment, 'block_id' | 'start_at' | 'end_at' | 'vendor_ids'>;
  chapter: Chapter;
  /** The event's BOOKED suppliers (booking id + shop name). */
  suppliers: readonly { id: string; name: string }[];
  /** Every ask on the event; null = they could not be read; undefined = not read here (the Maker). */
  asks: readonly HostAsk[] | null | undefined;
  ask: (blockId: string, fields: Record<string, string>) => Promise<Answer>;
  onAsked: (row: HostAsk) => void;
  /** 🔒 "Send a request" on a locked supplier's moment (audit D7): opens the ask with that supplier picked. `n`
   *  changes on every press, so a second press re-opens it. */
  opener?: { vendorId: string; n: number } | null;
  /** 🔒 A locked moment: no "Ask a supplier" button of its own — the sheet's "Send them a request" is the one door. */
  noOpenButton?: boolean;
}) {
  // The moment's own suppliers first, then every other booked one.
  const options = useMemo(
    () =>
      [...suppliers]
        .sort((a, b) => Number(m.vendor_ids.includes(b.id)) - Number(m.vendor_ids.includes(a.id)))
        .map((s) => ({ key: s.id, label: s.name })),
    [suppliers, m.vendor_ids],
  );
  const length = minutesBetween(m.start_at, m.end_at) ?? DEFAULT_MOMENT_MINUTES;
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<string | null>(null);
  const [start, setStart] = useState<string>(m.start_at);
  const [minutes, setMinutes] = useState(length);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'sending'>('idle');
  const [said, setSaid] = useState<{ tone: 'ok' | 'bad'; words: string } | null>(null);
  useEffect(() => {
    if (!opener) return;
    setOpen(true);
    setWho(opener.vendorId);
  }, [opener]);

  if (suppliers.length === 0 || asks === undefined) return null;
  const mine = asks ? asksOnMoment(asks, m.block_id) : [];
  const moved = start !== m.start_at || minutes !== length;
  const ready = Boolean(who) && moved && state === 'idle';

  const send = async () => {
    if (!who) return;
    setState('sending');
    setSaid(null);
    const end = shiftWall(start, minutes);
    const r = await ask(m.block_id, { vendor_id: who, start_at: start.slice(0, 16), end_at: end.slice(0, 16), note: note.trim() });
    setState('idle');
    if (!r.ok) {
      setSaid({ tone: 'bad', words: r.error });
      return;
    }
    const shop = suppliers.find((s) => s.id === who)?.name ?? 'The supplier';
    // The door answers `<ask id>:<shop id>` — the shop id keeps "each supplier's latest ask once" true at once.
    const [askId, shopId] = r.value.split(':');
    onAsked({
      suggestion_id: askId ?? r.value,
      block_id: m.block_id,
      vendor_profile_id: shopId || `booking:${who}`,
      suggested_by_name: null,
      asked_as: null,
      proposed_start_at: start,
      proposed_end_at: end,
      note: note.trim(),
      status: 'open',
      answer_note: null,
      created_at: new Date().toISOString(),
      shop: { business_name: shop },
    });
    setSaid({ tone: 'ok', words: `Asked. ${shop} answers on their schedule — you’ll get a notice.` });
    setOpen(false);
    setWho(null);
    setNote('');
  };

  return (
    <section data-moment-asks={mine.length} aria-label="Asked of suppliers" className={bare ? '' : 'mt-2 border-t border-ink/10 pt-3'}>
      {bare && mine.length === 0 ? null : (
      <InfoTip label="Asked of suppliers" labelAs="h4" labelClassName="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55" align="start">
        Ask a booked supplier to change their times on this moment. They answer Accept or Decline on their schedule; a
        Yes moves the moment for you, and either way you get a notice here in the app.
      </InfoTip>
      )}
      {asks === null ? (
        <p role="alert" data-moment-asks-failed="" className="mt-2 text-[13px] font-semibold text-danger-700">
          What you asked suppliers couldn’t be read just now. Nothing is lost — close and open the moment again.
        </p>
      ) : mine.length > 0 ? (
        <ul className="mt-1 divide-y divide-ink/10">
          {mine.map((a) => (
            <li key={a.suggestion_id} data-moment-ask={a.status} className="py-2 text-[13px]">
              <span className="font-medium">{shopNameOf(a)}</span>
              {a.proposed_start_at ? <span className="text-ink/60"> · to {clockWords(a.proposed_start_at)}</span> : null}
              <span className={`block ${a.status === 'open' ? 'text-warn-900' : a.status === 'accepted' ? 'text-success-900' : 'text-ink/65'}`}>
                {askStateWords(a, shopNameOf(a))}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {said ? (
        <p role={said.tone === 'bad' ? 'alert' : 'status'} className={`mt-2 text-[13px] ${said.tone === 'bad' ? 'font-semibold text-danger-700' : 'text-success-900'}`}>
          {said.words}
        </p>
      ) : null}

      {open ? (
        <div data-moment-ask-form="" className="mt-2 flex flex-col gap-3">
          <FormRows width="wide">
            <ChosenRow
              name="Supplier"
              value={who}
              options={options}
              buttonText={who ? undefined : 'Pick a supplier'}
              onPick={(k) => setWho(k)}
              data="moment-ask-supplier"
            />
            <TimeRow
              name="New time"
              value={wallTime(start)}
              onKeep={(t) => {
                const at = momentStartFrom(c, t);
                if (!at) return { ok: false as const, error: 'That time isn’t in this chapter.' };
                setStart(at);
                return { ok: true as const };
              }}
              data="moment-ask-time"
            />
            <TypedRow
              name="Minutes"
              value={String(minutes)}
              maxLength={4}
              inputMode="numeric"
              required
              check={(t) => (/^\d{1,4}$/.test(t.trim()) && Number(t) >= 1 && Number(t) <= 1440 ? null : 'Between 1 and 1440 minutes.')}
              onKeep={(t) => {
                setMinutes(Number(t.trim()));
                return { ok: true as const };
              }}
              data="moment-ask-minutes"
            />
            <TypedRow
              name="Note"
              about={{ words: 'Optional. Why you are asking — they read it beside the new time.' }}
              value={note}
              empty="The church moved the vows 30 minutes earlier"
              long
              boxed
              maxLength={1000}
              onKeep={(t) => {
                setNote(t);
                return { ok: true as const };
              }}
              data="moment-ask-note"
            />
          </FormRows>
          {!moved && who ? <p className="text-[12px] text-ink/60">Change the time or the minutes first.</p> : null}
          <div className="flex justify-end gap-2">
            <ActionButton tone="neutral" icon={X} label="Not now" quiet onClick={() => setOpen(false)} />
            <ActionButton
              tone="brand"
              main
              icon={Send}
              label={state === 'sending' ? 'Sending…' : 'Send ask'}
              disabled={!ready}
              data-testid="moment-ask-send"
              onClick={() => void send()}
            />
          </div>
        </div>
      ) : noOpenButton ? null : (
        <div className="mt-2">
          <ActionButton
            tone="neutral"
            icon={Send}
            label={askLabel}
            data-testid="moment-ask-open"
            onClick={() => {
              setOpen(true);
              setSaid(null);
              setStart(m.start_at);
              setMinutes(length);
            }}
          />
        </div>
      )}
    </section>
  );
}
