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
import { useContext, useState, useTransition } from 'react';
import { ChosenRow, FactRow } from '@/app/_components/form-row';
import { WHERE_WORDS, whereSaveVerdict, type InHouseWhere, type SupplierWhere, type WhereOption } from '@/lib/supplier-where';
import { setSupplierWhere, type SetSupplierWhereResult } from '../_actions/supplier-where';
import { BookedStandInCtx } from './booked-stand-ins';

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
  const [picked, setPicked] = useState<string[]>([...initial]);
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const [, start] = useTransition();

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
    const before = picked;
    setPicked(next);
    setSaid(null);
    start(async () => {
      const args = { eventId, vendorId, blockIds: next, coveredGroup: covered?.key ?? null, coveredLabel: covered?.label ?? null };
      const res: SetSupplierWhereResult = standIn.setWhere ? await standIn.setWhere(args) : await setSupplierWhere(args);
      if (!res.ok) {
        setPicked(before);
        setSaid({ tone: 'error', text: res.message });
        return;
      }
      setSaid(res.told ? { tone: 'ok', text: 'Saved. They were told in the app.' } : null);
    });
  };

  return (
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
  );
}

/** The supplier's Where, then each in-house group's — drawn in the opened row. */
export function BookedWhere({ eventId, vendorId, where }: { eventId: string; vendorId: string; where: SupplierWhere }) {
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
        keepOne
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
          keepOne
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
      <span className="block truncate text-[13px] text-ink/55" data-where-line="everywhere">
        {WHERE_WORDS.everywhere}
      </span>
    );
  }
  return where.needsOne ? (
    <span className="block truncate text-[13px] text-[rgb(var(--color-warn))]" data-where-line="needs-one">
      {WHERE_WORDS.needsOne}
    </span>
  ) : (
    <span className="block truncate text-[13px] text-ink/55" data-where-line="set">
      {where.names}
    </span>
  );
}
