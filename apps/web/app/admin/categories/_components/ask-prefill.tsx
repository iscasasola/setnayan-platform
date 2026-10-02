'use client';

/**
 * ask-prefill.tsx — the reading-back end of the admin search box on
 * "Categories & event types": `?admin_ask=<job>&aa_<field>=<value>`.
 *
 * Moved 2026-10-02 out of the Taxonomy Studio, with every property its guards
 * pinned there:
 *
 *   · Two hand-written readers — ADD A SERVICE (`createCanonicalLeaf`) and ADD
 *     A CATEGORY (`createTaxonomyNode`, the owner's own sentence: "add a new
 *     category on the taxonomy service") — and the generic table for the rest
 *     (`prepared-jobs.ts` + `prepared-job-card.tsx`).
 *   · 🔒 IT PREPARES, IT NEVER PRESSES. Each is a real <form action=…> whose
 *     values are defaultValues; nothing runs until the admin presses.
 *   · 🔴 THE SAME-ROUTE TRAP. The search box is on this page too, so answering
 *     here is a same-route navigation: React reconciles, `useSearchParams`
 *     hands over new values, and an effect on an EMPTY dependency array never
 *     looks again. Every effect here depends on the ask, and re-applies only
 *     when the ask params themselves change (`askSignature`) — typing in the
 *     page's own search cannot clobber edits made by hand.
 *   · A second ask remounts the inputs (`key={…nonce}`), or the first ask's
 *     answers would sit in the boxes.
 *   · 🔑 A MISS IS SAID OUT LOUD. The box only has WORDS, never ids; a word
 *     that names no real record leaves the picker empty and says so.
 *   · ⚠ PREPARED AND INVISIBLE was the Studio's recurring failure (four views
 *     replaced the pane its composer sat in). This host renders ABOVE both
 *     halves of the page, outside every list switch, so a prepared form is on
 *     screen whatever list or panel the admin was on.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { ADMIN_ASK_PARAM } from '@/lib/admin-map/humanize-field';
import { SubmitButton } from '@/app/_components/submit-button';
import { createCanonicalLeaf, createTaxonomyNode } from '../actions';
import { PreparedJobCard } from './prepared-job-card';
import {
  PREPARED_TAXONOMY_JOBS,
  buildPreparedValues,
  type PreparedCatalogs,
  type PreparedJobSpec,
  type PreparedValues,
} from './prepared-jobs';

type AddServicePrefill = {
  nonce: string;
  tileId: string;
  tileLabel: string;
  displayNameEn: string;
  faith: string;
  refinementLabel: string;
  refinementOptions: string;
  isRental: boolean;
  isPh: boolean;
};

type NewCategoryPrefill = {
  nonce: string;
  parentId: string | null;
  parentQuery: string;
  labelEn: string;
};

const FIELD = 'mt-0.5 w-full rounded-md border border-ink/15 bg-white px-2.5 py-1.5 text-sm text-ink';
const CARD = 'rounded-2xl bg-success-50/40 p-3';

export function AskPrefill({
  catalogs,
  groups,
  tiles,
}: {
  catalogs: PreparedCatalogs;
  groups: ReadonlyArray<{ id: string; label: string }>;
  tiles: ReadonlyArray<{ id: string; label: string }>;
}) {
  const searchParams = useSearchParams();
  const askSignature = useMemo(
    () =>
      [...searchParams.entries()]
        .filter(([k]) => k === ADMIN_ASK_PARAM || k.startsWith('aa_'))
        .map(([k, v]) => `${k}=${v}`)
        .sort()
        .join('&'),
    [searchParams],
  );

  // ── ADD A SERVICE (createCanonicalLeaf) ────────────────────────────────────
  const [addServicePrefill, setAddServicePrefill] = useState<AddServicePrefill | null>(null);
  const appliedAskRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchParams.get(ADMIN_ASK_PARAM) !== 'createCanonicalLeaf') return;
    if (appliedAskRef.current === askSignature) return;
    const tileQuery = (searchParams.get('aa_tile_id') ?? '').trim().toLowerCase();
    const match = tileQuery
      ? (tiles.find((t) => t.id.toLowerCase() === tileQuery) ??
        tiles.find((t) => t.label.toLowerCase() === tileQuery) ??
        tiles.find((t) => t.label.toLowerCase().includes(tileQuery)) ??
        tiles.find((t) => tileQuery.includes(t.label.toLowerCase())))
      : undefined;
    // An unresolved category is an HONEST MISS: nothing is prepared rather
    // than a service silently filed under the wrong category.
    if (!match) return;
    appliedAskRef.current = askSignature;
    setAddServicePrefill({
      nonce: askSignature,
      tileId: match.id,
      tileLabel: match.label,
      displayNameEn: searchParams.get('aa_display_name_en') ?? '',
      faith: searchParams.get('aa_faith') ?? '',
      refinementLabel: searchParams.get('aa_refinement_label') ?? '',
      refinementOptions: searchParams.get('aa_refinement_options') ?? '',
      isRental: searchParams.get('aa_is_rental') === '1',
      isPh: searchParams.get('aa_is_ph') === '1',
    });
  }, [searchParams, askSignature, tiles]);

  // ── ADD A CATEGORY (createTaxonomyNode) — the owner's own sentence ─────────
  const [newCategoryPrefill, setNewCategoryPrefill] = useState<NewCategoryPrefill | null>(null);
  const appliedCategoryAskRef = useRef<string | null>(null);
  useEffect(() => {
    if (searchParams.get(ADMIN_ASK_PARAM) !== 'createTaxonomyNode') return;
    if (appliedCategoryAskRef.current === askSignature) return;
    appliedCategoryAskRef.current = askSignature;
    const parentQuery = (searchParams.get('aa_parent_id') ?? '').trim();
    const needle = parentQuery.toLowerCase();
    const parent = needle
      ? (groups.find((f) => f.id.toLowerCase() === needle) ??
        groups.find((f) => f.label.toLowerCase() === needle) ??
        groups.find((f) => f.label.toLowerCase().includes(needle)) ??
        groups.find((f) => needle.includes(f.label.toLowerCase())))
      : undefined;
    setNewCategoryPrefill({
      nonce: askSignature,
      parentId: parent?.id ?? null,
      parentQuery,
      labelEn: searchParams.get('aa_label_en') ?? '',
    });
  }, [searchParams, askSignature, groups]);

  // ── EVERY OTHER WIRED JOB (the generic table) ──────────────────────────────
  const [preparedJob, setPreparedJob] = useState<{
    nonce: string;
    jobName: string;
    spec: PreparedJobSpec;
    prepared: PreparedValues;
  } | null>(null);
  const appliedPreparedRef = useRef<string | null>(null);
  useEffect(() => {
    const jobName = searchParams.get(ADMIN_ASK_PARAM);
    if (!jobName) return;
    const spec = PREPARED_TAXONOMY_JOBS.get(jobName);
    if (!spec) return;
    if (appliedPreparedRef.current === askSignature) return;
    appliedPreparedRef.current = askSignature;
    setPreparedJob({
      nonce: askSignature,
      jobName,
      spec,
      prepared: buildPreparedValues(spec, (key) => searchParams.get(key), catalogs),
    });
  }, [searchParams, askSignature, catalogs]);

  if (!addServicePrefill && !newCategoryPrefill && !preparedJob) return null;

  return (
    <div className="space-y-3" data-ask-prefill="">
      {preparedJob ? (
        <PreparedJobCard
          key={preparedJob.nonce}
          jobName={preparedJob.jobName}
          spec={preparedJob.spec}
          prepared={preparedJob.prepared}
          catalogs={catalogs}
          onDiscard={() => setPreparedJob(null)}
        />
      ) : null}

      {newCategoryPrefill ? (
        <form key={newCategoryPrefill.nonce} action={createTaxonomyNode} className={CARD}>
          <p className="flex items-center gap-1.5 text-xs text-success-800">
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
            Prepared from your question in the search box — check the group and the name, then press Create
            category yourself. Nothing has been added yet.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs text-ink/70">
              Group it goes under
              <select name="parent_id" required defaultValue={newCategoryPrefill.parentId ?? ''} className={FIELD}>
                <option value="" disabled>
                  — choose a group —
                </option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex-1 text-xs text-ink/70">
              Category name
              <input
                name="label_en"
                required
                minLength={2}
                maxLength={80}
                defaultValue={newCategoryPrefill.labelEn}
                className={FIELD}
              />
            </label>
            <div className="flex items-center gap-2">
              <SubmitButton className="rounded-full bg-success-600 px-3 py-1.5 text-xs font-semibold text-white" pendingLabel="Creating…">
                Create category
              </SubmitButton>
              <button
                type="button"
                onClick={() => setNewCategoryPrefill(null)}
                className="rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink"
              >
                Discard
              </button>
            </div>
          </div>
          {newCategoryPrefill.parentId === null && newCategoryPrefill.parentQuery ? (
            <p className="mt-2 text-xs text-warn-800">
              No group here is called “{newCategoryPrefill.parentQuery}” — pick the right one above before creating.
            </p>
          ) : null}
        </form>
      ) : null}

      {addServicePrefill ? (
        <form key={addServicePrefill.nonce} action={createCanonicalLeaf} className={`${CARD} space-y-2`}>
          <p className="flex items-center gap-1.5 text-xs text-success-800">
            <Sparkles className="h-3 w-3 shrink-0" aria-hidden />
            Prepared from your question in the search box — a new service under {addServicePrefill.tileLabel}. Review
            it, then press Add service yourself. Nothing has been added yet.
          </p>
          <input type="hidden" name="tile_id" value={addServicePrefill.tileId} />
          <input type="hidden" name="_open" value={`c:${addServicePrefill.tileId}`} />
          <input name="display_name_en" required defaultValue={addServicePrefill.displayNameEn} placeholder="Service name" className={FIELD} />
          <select name="faith" defaultValue={addServicePrefill.faith} className={FIELD}>
            <option value="">Everyone</option>
            {catalogs.faith.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label} only
              </option>
            ))}
          </select>
          <input name="refinement_label" defaultValue={addServicePrefill.refinementLabel} placeholder="A first field suppliers fill in (optional)" className={FIELD} />
          <input name="refinement_options" defaultValue={addServicePrefill.refinementOptions} placeholder="Its options, comma-separated" className={FIELD} />
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-ink">
              <input type="checkbox" name="is_rental" defaultChecked={addServicePrefill.isRental} /> Rental
            </label>
            <label className="flex items-center gap-1.5 text-xs text-ink">
              <input type="checkbox" name="is_ph" defaultChecked={addServicePrefill.isPh} /> PH-specific
            </label>
            <SubmitButton className="rounded-full bg-success-600 px-3 py-1.5 text-xs font-semibold text-white" pendingLabel="Adding…">
              Add service
            </SubmitButton>
            <button type="button" onClick={() => setAddServicePrefill(null)} className="rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink">
              Discard
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
