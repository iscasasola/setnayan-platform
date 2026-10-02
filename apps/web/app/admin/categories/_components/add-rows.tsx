'use client';

/**
 * add-rows.tsx — "+ Add", in place, at the top of each list.
 *
 *   Supplier categories → a new SERVICE under a category (createCanonicalLeaf)
 *                         or a new CATEGORY in a group (createTaxonomyNode) —
 *                         one row; "Goes under ▾" decides which.
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
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
import { createCanonicalLeaf, createTaxonomyNode, createEventTypeRoster, createFaithVocab } from '../actions';
import { addTradeAlias } from '../search-word-actions';
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

function Switch({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-terracotta" />
      {label}
    </label>
  );
}

export type AddServiceOption = { key: string; label: string; tileId: string | null; aliases: string[] };

/** Supplier categories › + Add — a new service, or a new category. */
export function AddServiceOrCategory({
  services,
  categories,
  groups,
  religions,
  back,
  cancelHref,
}: {
  services: readonly AddServiceOption[];
  /** key = category id, group = its group's name. */
  categories: readonly Choice[];
  groups: readonly Choice[];
  religions: readonly Choice[];
  back: Record<string, string>;
  cancelHref: string;
}) {
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string>('');
  const [faith, setFaith] = useState('');
  const near = useMemo(() => nearMatches(name, services), [services, name]);
  const suggestedTile = near[0]?.tileId ?? null;
  const target = picked || (suggestedTile ? `c:${suggestedTile}` : '');
  const isNewCategory = target.startsWith('g:');
  const options = [
    ...categories.map((c) => ({
      key: `c:${c.key}`,
      label: c.label,
      group: c.group,
      trail: suggestedTile === c.key ? { text: '✓ suggested', tone: 'ok' as const } : undefined,
    })),
    ...groups.map((g) => ({ key: `g:${g.key}`, label: `A new category in ${g.label}`, group: '— a new category —' })),
  ];
  const targetLabel = options.find((o) => o.key === target)?.label;
  const top = near[0];

  return (
    <div className={ROW} data-add-row="categories">
      <form action={isNewCategory ? createTaxonomyNode : createCanonicalLeaf} className="space-y-3">
        <Hidden back={back} />
        {isNewCategory ? (
          <>
            <input type="hidden" name="parent_id" value={target.slice(2)} />
            <input type="hidden" name="label_en" value={name} />
          </>
        ) : (
          <>
            <input type="hidden" name="tile_id" value={target.slice(2)} />
            <input type="hidden" name="display_name_en" value={name} />
            <input type="hidden" name="faith" value={faith} />
          </>
        )}
        <label className="block text-xs font-medium text-ink/70">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
            maxLength={80}
            autoFocus
            placeholder="e.g. Dirty ice cream cart"
            className={`mt-1 ${FIELD}`}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink/70">Goes under</span>
          <PickMenu
            label="Goes under"
            value={target}
            buttonText={targetLabel ?? '— choose —'}
            options={options}
            onPick={setPicked}
            compact
            className="border border-ink/15"
            stickyGroups
          />
        </div>
        {name.trim().length >= 2 && near.length > 0 ? (
          <div className="rounded-xl bg-warn-50 p-2.5 text-sm text-ink" data-near-matches="">
            <p className="font-semibold">Close to what we have:</p>
            <ul className="mt-1 space-y-0.5">
              {near.map((n) => (
                <li key={n.key}>{n.label}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {!isNewCategory ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-medium text-ink/70">Religion</span>
            <PickMenu
              label="Religion"
              value={faith}
              buttonText={faith ? religions.find((r) => r.key === faith)?.label : 'Everyone'}
              options={[{ key: '', label: 'Everyone' }, ...religions.map((r) => ({ key: r.key, label: r.label }))]}
              onPick={setFaith}
              compact
              className="border border-ink/15"
            />
            <Switch name="is_ph" label="PH-specific" />
            <Switch name="is_rental" label="Rental" />
            <Switch name="is_tradition" label="Cultural" />
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <SubmitButton
            disabled={name.trim().length < 2 || !target}
            className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-40"
            pendingLabel="Saving…"
          >
            Save
          </SubmitButton>
          <Link href={cancelHref} className="text-sm font-medium text-ink/70 hover:text-ink">
            Cancel
          </Link>
        </div>
      </form>
      {top && name.trim().length >= 2 && !isNewCategory ? (
        <form action={addTradeAlias} className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-2 text-sm">
          <Hidden back={{ ...back, _open: `s:${top.key}` }} />
          <input type="hidden" name="canonical_service" value={top.key} />
          <input type="hidden" name="phrase" value={name} />
          <span>Same thing as {top.label}?</span>
          <SubmitButton className="rounded-full border border-ink/20 px-3 py-1 text-xs font-semibold text-ink" pendingLabel="Adding…">
            Add “{name.trim()}” as a search word on {top.label} instead
          </SubmitButton>
        </form>
      ) : null}
    </div>
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
