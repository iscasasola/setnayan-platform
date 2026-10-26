'use client';

/**
 * add-rows.tsx — "+ Add", in place, at the top of each list.
 *
 *   Supplier categories → MOVED (③b, 2026-10-26): every column of the four-level
 *                         map ends in its own "＋ Add …" row (`four-level-map.tsx`
 *                         AddRow), so the one top row with "Goes under ▾" is gone
 *                         (corpus PLAN admin_taxonomy_four_levels § 7.2). The near
 *                         matches and "add as a search word instead" moved with it.
 *   Event types         → createEventTypeRoster (the key is made from the name)
 *   Religions           → createFaithVocab (the key is made from the name;
 *                         asked on the wedding until its panel says otherwise)
 *
 * 🔑 IT WARNS BEFORE IT ADDS. As the name is typed, the closest things we
 * already have are listed — found by matching words with the shipped ranker
 * (`rankTaxonomyOptions`), not by a model — and for a service the honest
 * alternative is one press away: add the word as a search word on the service
 * we already have. A second name for the same trade splits its suppliers.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import { createEventTypeRoster, createFaithVocab } from '../actions';
import { eventTypeKeyFromName, nearMatches, religionKeyFromName } from './model';
import type { Choice } from './pickers';

const FIELD = 'w-full rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink';
const ROW = 'space-y-3 rounded-2xl bg-white p-3';

function Hidden({ back }: { back: Record<string, string> }) {
  return (
    <>
      {Object.entries(back).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
    </>
  );
}


/** Event types › + Add — the key is made from the name, and is permanent. */
export function AddEventType({
  existing,
  back,
  cancelHref,
}: {
  existing: readonly Choice[];
  back: Record<string, string>;
  cancelHref: string;
}) {
  const [name, setName] = useState('');
  const key = eventTypeKeyFromName(name);
  const near = useMemo(
    () => nearMatches(name, existing.map((e) => ({ key: e.key, label: e.label }))),
    [existing, name],
  );
  return (
    <form action={createEventTypeRoster} className={ROW} data-add-row="event-types">
      <Hidden back={back} />
      <input type="hidden" name="event_type" value="" />
      <div className="flex gap-2">
        <label className="w-16 shrink-0 text-xs font-medium text-ink/70">
          Emoji
          <input name="emoji" maxLength={16} placeholder="🎉" className={`mt-1 ${FIELD}`} />
        </label>
        <label className="min-w-0 flex-1 text-xs font-medium text-ink/70">
          Name
          <input
            name="label_en"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            autoFocus
            placeholder="e.g. House blessing"
            className={`mt-1 ${FIELD}`}
          />
        </label>
      </div>
      <p className="text-xs text-ink/70">{key ? `Key ${key} · made from the name · permanent` : 'The key is made from the name'}</p>
      {near.length > 0 ? (
        <p className="rounded-xl bg-warn-50 p-2.5 text-sm text-ink" data-near-matches="">
          Close to what we have: {near.map((n) => n.label).join(' · ')}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <SubmitButton disabled={key.length < 3} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-40" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <Link href={cancelHref} className="text-sm font-medium text-ink/70 hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}

/**
 * Religions › + Add — Title-Case key from the name; asked on the wedding only. Saving opens its panel, where "Asked on" and the
 * services only for it are set — each in its one place.
 */
export function AddReligion({
  existing,
  back,
  cancelHref,
}: {
  existing: readonly Choice[];
  back: Record<string, string>;
  cancelHref: string;
}) {
  const [name, setName] = useState('');
  const key = religionKeyFromName(name);
  const near = useMemo(
    () => nearMatches(name, existing.map((e) => ({ key: e.key, label: e.label }))),
    [existing, name],
  );
  return (
    <form action={createFaithVocab} className={ROW} data-add-row="religions">
      <Hidden back={back} />
      <label className="block text-xs font-medium text-ink/70">
        Name
        <input
          name="label_en"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          autoFocus
          placeholder="e.g. Methodist"
          className={`mt-1 ${FIELD}`}
        />
      </label>
      <p className="text-xs text-ink/70">
        {key ? `Key ${key} · made from the name · permanent` : 'The key is made from the name'} · asked on Wedding
      </p>
      {near.length > 0 ? (
        <p className="rounded-xl bg-warn-50 p-2.5 text-sm text-ink" data-near-matches="">
          Close to what we have: {near.map((n) => n.label).join(' · ')}. If its couples are already served by one of
          these, use that one instead.
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <SubmitButton disabled={name.trim().length < 2} className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-40" pendingLabel="Saving…">
          Save
        </SubmitButton>
        <Link href={cancelHref} className="text-sm font-medium text-ink/70 hover:text-ink">
          Cancel
        </Link>
      </div>
    </form>
  );
}
