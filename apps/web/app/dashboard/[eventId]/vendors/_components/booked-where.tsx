'use client';

/**
 * 📍 WHERE, ON A BOOKED TEAM ROW — the chapters a supplier works (owner 2026-11-01, DECISION_LOG "MANY VENUES PER
 * EVENT; SUPPLIERS PICK THEIR CHAPTERS; COORDINATORS ARE EVERYWHERE"; the approved prototype's `supRow`:
 * *"Where ⓘ  [ Reception · Seda Vertis North ✓ ▾ ]"* — "Pick at least 1 chapter. The venue follows the chapter.").
 *
 *   · the shared Form Row template (`ChosenRow`) with the shared dropdown and its ticks (`PickMenu`'s `picked`) —
 *     never a pill row;
 *   · each tick saves at once through `set_supplier_where` and keeps the screen (a save never resets the screen); a
 *     refusal is said in place and the ticks go back to what was saved;
 *   · the last chapter of a booked supplier cannot be un-ticked (said, not silently ignored) — the database refuses it
 *     too;
 *   · a coordinator is on every chapter: a fact, no dropdown; no chapter yet: the row says so;
 *   · an IN-HOUSE group under a venue ("Catering" with Seda) starts on the venue's chapters and has its own dropdown.
 *
 * Every word and every state is decided in `lib/supplier-where.ts`; this file draws it and calls the one action.
 */
import { useContext, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChosenRow, FactRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { ActionButton } from '@/components/action-button';
import { Check, Send, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  WHERE_ASK_WORDS,
  WHERE_WORDS,
  isLockedRefusal,
  whereAskRefusalWords,
  whereRefusalWords,
  whereSaveVerdict,
  type InHouseWhere,
  type SetWhereResult,
  type SupplierWhere,
  type WhereOption,
} from '@/lib/supplier-where';
import { BookedStandInCtx } from './booked-stand-ins';

/**
 * 📍 THE ONE WRITE — `set_supplier_where`, on the host's own session (no server action: the database gates on the host,
 * writes the chapters, and tells a booked supplier of a change in the same statement, so nothing can skip the notice).
 */
async function saveWhere(args: { vendorId: string; blockIds: string[]; coveredGroup: string | null }): Promise<SetWhereResult> {
  const { data, error } = await createClient().rpc('set_supplier_where', {
    p_vendor_id: args.vendorId,
    p_block_ids: args.blockIds,
    p_covered_group: args.coveredGroup,
  });
  if (error || !data) {
    const message = error?.message ?? '';
    return { ok: false, message: whereRefusalWords(message), locked: isLockedRefusal(message) };
  }
  const r = data as { after: string[] | null; told: boolean | null };
  return { ok: true, picked: r.after ?? [], told: r.told === true };
}

/**
 * 🔒 A supplier who LOCKED their part (migration 20271303409352) has their Where changed only by request (owner
 * 2026-11-04): `host_ask_supplier_where` writes the ask and tells them in the app, in one statement; they answer on
 * their Schedule (migration 20271308641275).
 */
async function askWhere(vendorId: string, blockIds: string[], note: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data, error } = await createClient().rpc('host_ask_supplier_where', {
    p_vendor_id: vendorId,
    p_block_ids: blockIds,
    // ✍ Optional, one line (owner 2026-11-04, answer 4 on #7260): the supplier reads why, beside the ask.
    p_note: note.trim() || null,
  });
  if (error || !data) return { ok: false, message: whereAskRefusalWords(error?.message ?? '') };
  return { ok: true };
}

/** The pill's words: the picked chapters' own names, or the ask. */
function pillText(options: readonly WhereOption[], picked: readonly string[]): string {
  const names = options.filter((o) => picked.includes(o.key)).map((o) => o.label.split(' · ')[0]);
  return names.length === 0 ? 'Pick a chapter' : names.join(', ');
}

/** One Where dropdown — the supplier's own, or one in-house group's. */
function WherePick({
  eventId,
  vendorId,
  name,
  about,
  options,
  initial,
  keepOne,
  covered,
  data,
}: {
  eventId: string;
  vendorId: string;
  name: string;
  about: string;
  options: readonly WhereOption[];
  initial: readonly string[];
  /** Booked: at least one stays ticked. */
  keepOne: boolean;
  covered?: { key: string; label: string } | null;
  data: string;
}) {
  const standIn = useContext(BookedStandInCtx);
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([...initial]);
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  // 🔒 The set the lock refused — kept so "Send them a request" asks for exactly it.
  const [refused, setRefused] = useState<string[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [askNote, setAskNote] = useState('');
  // Ticks save IN ORDER (each save sends the whole set, so the last tap is what stays), and only the newest answer
  // speaks; a refusal puts back what was last saved.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const seq = useRef(0);
  const saved = useRef<string[]>([...initial]);

  const pick = (key: string) => {
    const set = new Set(picked);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    // In the list's own order (time order), never tap order.
    const next = options.map((o) => o.key).filter((k) => set.has(k));
    const verdict = whereSaveVerdict({
      groupId: null,
      booked: keepOne,
      picked: next,
      chapterIds: options.map((o) => o.key),
    });
    if (!verdict.ok) {
      setSaid({ tone: 'error', text: verdict.words });
      return;
    }
    setPicked(next);
    setSaid(null);
    const mine = ++seq.current;
    chain.current = chain.current.then(async () => {
      const args = { eventId, vendorId, blockIds: next, coveredGroup: covered?.key ?? null, coveredLabel: covered?.label ?? null };
      let res: SetWhereResult;
      try {
        res = standIn.setWhere ? await standIn.setWhere(args) : await saveWhere(args);
      } catch {
        res = { ok: false, message: 'That didn’t save. Nothing changed — try again.' };
      }
      if (res.ok) saved.current = next;
      if (mine !== seq.current) return;
      if (!res.ok) {
        setPicked(saved.current);
        setSaid({ tone: 'error', text: res.message });
        setRefused(res.locked && !covered ? next : null);
        return;
      }
      setRefused(null);
      setSaid(res.told ? { tone: 'ok', text: 'Saved. They were told in the app.' } : null);
      // The row's own line and the "need a chapter" count read again — in place, the screen kept.
      // one-render: keep (client-write) — the write is the browser's own rpc, so nothing on the server revalidated
      if (!standIn.setWhere) router.refresh();
    });
  };

  const sendAsk = async () => {
    if (!refused) return;
    setAsking(true);
    const r = await askWhere(vendorId, refused, askNote);
    setAsking(false);
    if (!r.ok) return setSaid({ tone: 'error', text: r.message });
    setRefused(null);
    setAskNote('');
    setSaid({ tone: 'ok', text: 'Request sent. They answer on their Schedule.' });
  };

  return (
    <>
    <ChosenRow
      name={name}
      about={{ words: about }}
      label={name}
      value={null}
      options={options}
      picked={picked}
      onPick={pick}
      buttonText={pillText(options, picked)}
      data={data}
      attrs={{ 'data-where-picked': picked.join(' ') }}
      problem={said?.tone === 'error' ? said.text : undefined}
      note={said?.tone === 'ok' ? said.text : undefined}
    />
    {refused && !standIn.setWhere ? (
      <div className="flex flex-col gap-1 pt-1" data-where-locked-ask="">
        <TypedRow
          name="Note"
          about={{ words: 'Optional, one line. They read it beside your request.' }}
          value={askNote}
          empty="Why the change"
          maxLength={200}
          onKeep={(t) => {
            setAskNote(t.trim());
            return { ok: true as const };
          }}
          data="where-locked-ask-note"
        />
        <div className="flex justify-end">
        <ActionButton
          tone="brand"
          main
          icon={Send}
          label={asking ? 'Sending…' : 'Send them a request'}
          disabled={asking}
          onClick={() => void sendAsk()}
          data-testid="where-locked-ask"
        />
        </div>
      </div>
    ) : null}
    </>
  );
}

/** The supplier's Where, then each in-house group's — drawn in the opened row (and on the quote, for the couple). */
export function BookedWhere({
  eventId,
  vendorId,
  where,
  booked = true,
}: {
  eventId: string;
  vendorId: string;
  where: SupplierWhere;
  /** Booked keeps at least one chapter; on a quote not yet booked it may be emptied. */
  booked?: boolean;
}) {
  if (where.kind === 'everywhere') {
    return <FactRow name="Where" value={WHERE_WORDS.everywhere} where="Coordinators are on every chapter" data="booked-where" attrs={{ 'data-where': 'everywhere' }} />;
  }
  if (where.kind === 'no_chapters') {
    return <FactRow name="Where" value={null} where={WHERE_WORDS.noChapters} data="booked-where" attrs={{ 'data-where': 'no-chapters' }} />;
  }
  if (where.kind === 'unread') {
    return <FactRow name="Where" value={null} where={WHERE_WORDS.unread} data="booked-where" attrs={{ 'data-where': 'unread' }} />;
  }
  return (
    <div data-where="set">
      <WherePick
        eventId={eventId}
        vendorId={vendorId}
        name="Where"
        about={WHERE_WORDS.info}
        options={where.options}
        initial={where.picked}
        keepOne={booked}
        data="booked-where"
      />
      {where.inHouse.map((g: InHouseWhere) => (
        <WherePick
          // While it follows the venue it re-reads the venue's chapters whenever they change.
          key={g.followsVenue ? `${g.key}:${where.picked.join(',')}` : g.key}
          eventId={eventId}
          vendorId={vendorId}
          name={g.label}
          about={WHERE_WORDS.inHouseInfo}
          options={where.options}
          initial={g.picked}
          keepOne={booked}
          covered={{ key: g.key, label: g.label }}
          data={`booked-where-${g.key}`}
        />
      ))}
    </div>
  );
}

/** The collapsed row's Where line: the chapters, "Every chapter", or the warning. */
export function BookedWhereLine({ where }: { where: SupplierWhere | null }) {
  if (!where || where.kind === 'unread' || where.kind === 'no_chapters') return null;
  if (where.kind === 'everywhere') {
    return (
      <span className="block truncate text-[13px] text-ink/70" data-where-line="everywhere">
        {WHERE_WORDS.everywhere}
      </span>
    );
  }
  return where.needsOne ? (
    <span className="block truncate text-[13px] text-[rgb(var(--color-warn))]" data-where-line="needs-one">
      {WHERE_WORDS.needsOne}
    </span>
  ) : (
    <span className="block truncate text-[13px] text-ink/70" data-where-line="set">
      {where.names}
    </span>
  );
}

/**
 * 📍 WHERE, AS THE SUPPLIER WHO SENT THE QUOTE READS IT — the chapters the couple picked, so the price can follow
 * (plan: "best set on the quote, since it changes the price"). Only the couple picks it; a shop reads it.
 */
export function QuoteWhereFact({ where }: { where: SupplierWhere }) {
  if (where.kind === 'everywhere') return <FactRow name="Where" value={WHERE_WORDS.everywhere} where="Coordinators are on every chapter" data="quote-where" />;
  if (where.kind === 'unread') return <FactRow name="Where" value={null} where={WHERE_WORDS.unread} data="quote-where" />;
  if (where.kind === 'no_chapters' || where.picked.length === 0) {
    return <FactRow name="Where" value={null} where="The couple hasn’t picked the chapters yet" data="quote-where" />;
  }
  const labels = where.options.filter((o) => where.picked.includes(o.key)).map((o) => o.label);
  return <FactRow name="Where" value={labels.join('\n')} where="Picked by the couple" data="quote-where" />;
}

/**
 * 📖 "WHICH CHAPTERS WILL THEY SERVE?" — ASKED ONCE A SUPPLIER IS BOOKED (owner 2026-11-04; approved prototype "Event
 * chapters — 4 Nov 2026", frame 5: *"the moment a supplier is booked, one sheet asks 'Which chapters will they
 * serve?', prefilled from the trade's default parts … The host confirms."*).
 *
 * The couple learns a supplier said yes whenever they next open Suppliers, so the sheet opens THERE: for the first
 * booked supplier that is on no chapter yet (the row already says "Needs at least 1 chapter"), prefilled from the
 * trade's usual chapters (`row.suggestWhere`, lib/trade-chapters.ts). Confirm writes through the ONE door
 * (`set_supplier_where`, which also tells a booked supplier); Not now keeps it closed for this visit — the row and the
 * count still say it is missing. Ticks here are only the draft: nothing is saved before Confirm.
 */
export function WhereAsk({
  eventId,
  rows,
}: {
  eventId: string;
  rows: readonly { vendorId: string; name: string; where: SupplierWhere | null; suggestWhere: readonly string[] }[];
}) {
  const standIn = useContext(BookedStandInCtx);
  const router = useRouter();
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(WHERE_ASK_SKIPPED) ?? '[]') as string[]);
    } catch {
      return new Set();
    }
  });
  const row = rows.find((r) => r.where?.kind === 'set' && r.where.needsOne && !skipped.has(r.vendorId)) ?? null;
  if (!row || row.where?.kind !== 'set') return null;
  return (
    <WhereAskSheet
      key={row.vendorId}
      name={row.name}
      options={row.where.options}
      initial={row.suggestWhere.filter((id) => row.where?.kind === 'set' && row.where.options.some((o) => o.key === id))}
      onSkip={() => {
        const next = new Set(skipped).add(row.vendorId);
        setSkipped(next);
        try {
          sessionStorage.setItem(WHERE_ASK_SKIPPED, JSON.stringify([...next]));
        } catch {
          // No storage: it stays closed for this render only.
        }
      }}
      onConfirm={async (blockIds) => {
        const args = { eventId, vendorId: row.vendorId, blockIds, coveredGroup: null, coveredLabel: null };
        let res: SetWhereResult;
        try {
          res = standIn.setWhere ? await standIn.setWhere(args) : await saveWhere(args);
        } catch {
          res = { ok: false, message: 'That didn’t save. Nothing changed — try again.' };
        }
        // one-render: keep (client-write) — the browser's own rpc; the row's line and the count read again in place.
        if (res.ok && !standIn.setWhere) router.refresh();
        return res;
      }}
    />
  );
}

const WHERE_ASK_SKIPPED = 'sn:where-ask-skipped';

function WhereAskSheet({
  name,
  options,
  initial,
  onSkip,
  onConfirm,
}: {
  name: string;
  options: readonly WhereOption[];
  initial: readonly string[];
  onSkip: () => void;
  onConfirm: (blockIds: string[]) => Promise<SetWhereResult>;
}) {
  const headingId = useId();
  const [picked, setPicked] = useState<string[]>([...initial]);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; text: string } | { kind: 'done' }>({ kind: 'idle' });
  if (state.kind === 'done') return null;
  return (
    <Sheet open onClose={onSkip} labelledById={headingId} title={`${name} is booked`}>
      <div data-where-ask={name} className="flex flex-col gap-3 px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-2">
        <InfoTip label={WHERE_ASK_WORDS.question} labelAs="h3" labelId={headingId} labelClassName="text-[17px] font-semibold text-ink" align="start">
          {WHERE_ASK_WORDS.info}
        </InfoTip>
        <FormRows width="wide">
          <ChosenRow
            name="Chapters"
            label="Chapters"
            value={null}
            options={options}
            picked={picked}
            onPick={(key) => {
              const set = new Set(picked);
              if (set.has(key)) set.delete(key);
              else set.add(key);
              setPicked(options.map((o) => o.key).filter((k) => set.has(k)));
              setState({ kind: 'idle' });
            }}
            buttonText={pillText(options, picked)}
            data="where-ask"
            attrs={{ 'data-where-picked': picked.join(' ') }}
            problem={state.kind === 'error' ? state.text : undefined}
          />
        </FormRows>
        <div className="flex justify-end gap-2">
          <ActionButton tone="neutral" icon={X} label="Not now" quiet onClick={onSkip} />
          <ActionButton
            tone="brand"
            icon={Check}
            main
            label={state.kind === 'saving' ? 'Saving…' : 'Confirm'}
            data-testid="where-ask-confirm"
            disabled={picked.length === 0 || state.kind === 'saving'}
            onClick={async () => {
              setState({ kind: 'saving' });
              const res = await onConfirm(picked);
              setState(res.ok ? { kind: 'done' } : { kind: 'error', text: res.message });
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}
