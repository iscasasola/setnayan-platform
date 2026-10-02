'use client';

/**
 * request-controls.tsx — the three answers to a supplier's category request,
 * on its ghost row: Approve as new (promoteCategoryRequest), Map to ▾
 * (mapCategoryRequest) and Decline ▾ (resolveCategoryRequest: keep as their
 * private label, or reject with a note). Same four shipped outcomes as the
 * Studio's queue; Promote · Map · Keep private · Reject became three words.
 *
 * ⛔ NOTHING HERE PRESSES BY ITSELF. The draft's name and category arrive as
 * editable defaults; the admin presses.
 */
import { useState, useTransition } from 'react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { SubmitButton } from '@/app/_components/submit-button';
// The key `promoteCategoryRequest` will actually mint, computed by the same
// rule the action runs — never a second hand-typed slugifier.
import { mintKeyFor } from '@/lib/category-proposal-draft';
import { mapCategoryRequest, promoteCategoryRequest, resolveCategoryRequest } from '../actions';
import type { Choice } from './pickers';

/**
 * APPROVE AS NEW — the shipped mint, with the draft's name and category filled
 * in. The name is an INPUT, not a label: the mint slugifies whatever it is
 * given, and the key it will make is shown live.
 *
 * ⚠ THE CATEGORY IS THE WEAKEST PART OF ANY DRAFT — prefilled, never locked;
 * an undrafted request still opens on "— choose a category —".
 */
export function PromoteRequestForm({
  requestId,
  defaultLabel,
  suggestedTileId,
  categories,
  back,
}: {
  requestId: string;
  defaultLabel: string;
  suggestedTileId: string | null;
  categories: readonly Choice[];
  back: Record<string, string>;
}) {
  const [label, setLabel] = useState(defaultLabel);
  const [tile, setTile] = useState(suggestedTileId ?? '');
  const key = mintKeyFor(label);
  return (
    <form action={promoteCategoryRequest} className="flex flex-wrap items-center gap-2" data-promote-form="">
      {Object.entries(back).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <input type="hidden" name="request_id" value={requestId} />
      <input type="hidden" name="tile_id" value={tile} />
      <label className="sr-only" htmlFor={`promote-label-${requestId}`}>
        Name for the new service
      </label>
      <input
        id={`promote-label-${requestId}`}
        name="proposed_label_override"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        minLength={2}
        maxLength={80}
        className="w-44 rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink"
      />
      <span className="text-xs text-ink/70">{key ? `key ${key}` : 'needs letters or numbers'}</span>
      <PickMenu
        label="Approve under"
        value={tile}
        buttonText={tile ? categories.find((c) => c.key === tile)?.label : '— choose a category —'}
        options={categories.map((c) => ({ key: c.key, label: c.label, group: c.group }))}
        compact
        className="border border-ink/15"
        onPick={setTile}
      />
      <SubmitButton
        disabled={!tile}
        className="rounded-full bg-success-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        pendingLabel="Approving…"
      >
        Approve as new
      </SubmitButton>
    </form>
  );
}

/** MAP TO ▾ — the closest service first (`mapTargetsClosestFirst`). */
export function MapToPick({
  requestId,
  targets,
  back,
}: {
  requestId: string;
  targets: ReadonlyArray<{ canonical: string; label: string; closest: boolean }>;
  back: Record<string, string>;
}) {
  const [pending, start] = useTransition();
  return (
    <span className={pending ? 'opacity-60' : undefined} data-map-to="">
      <PickMenu
        label="Map to"
        value=""
        buttonText={pending ? 'Mapping…' : 'Map to'}
        options={targets.map((t) => ({
          key: t.canonical,
          label: t.label,
          trail: t.closest ? { text: '✓ closest', tone: 'ok' as const } : undefined,
        }))}
        compact
        className="border border-ink/15"
        onPick={(canonical) => {
          const fd = new FormData();
          for (const [k, v] of Object.entries(back)) fd.set(k, v);
          fd.set('request_id', requestId);
          fd.set('mapped_to_canonical', canonical);
          start(async () => {
            await mapCategoryRequest(fd);
          });
        }}
      />
    </span>
  );
}

/** DECLINE ▾ — keep it as their private label, or reject it with a note. */
export function DeclinePick({ requestId, back }: { requestId: string; back: Record<string, string> }) {
  const [rejecting, setRejecting] = useState(false);
  const [pending, start] = useTransition();
  const post = (outcome: 'kept_private' | 'rejected', note = '') => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(back)) fd.set(k, v);
    fd.set('request_id', requestId);
    fd.set('outcome', outcome);
    fd.set('resolution_note', note);
    start(async () => {
      await resolveCategoryRequest(fd);
    });
  };
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${pending ? 'opacity-60' : ''}`} data-decline="">
      <PickMenu
        label="Decline"
        value=""
        buttonText="Decline"
        options={[
          { key: 'kept_private', label: 'Keep as their private label' },
          { key: 'rejected', label: 'Reject… (with a note)' },
        ]}
        compact
        className="border border-ink/15"
        onPick={(k) => (k === 'kept_private' ? post('kept_private') : setRejecting(true))}
      />
      {rejecting ? (
        <form
          className="inline-flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const note = String(new FormData(e.currentTarget).get('resolution_note') ?? '');
            post('rejected', note);
          }}
        >
          <input
            name="resolution_note"
            placeholder="A note the supplier sees"
            aria-label="Reject note"
            className="w-48 rounded-lg border border-ink/15 bg-white px-2.5 py-1.5 text-sm"
          />
          <button type="submit" className="rounded-full border border-danger-300 px-3 py-1.5 text-xs font-semibold text-danger-700">
            Reject
          </button>
        </form>
      ) : null}
    </span>
  );
}
