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
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
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
import { nearMatches } from './model';

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
  /** true = filled in from the search box; false = opened empty by the Catalogue ＋ (`?new=category`). */
  prepared: boolean;
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
      prepared: true,
    });
  }, [searchParams, askSignature, groups]);

  // ── THE SAME FORM, OPENED EMPTY — the Catalogue tab's one ＋ (`?new=category`, 14 Nov 2026 build). ONE form for
  // "add a new category", whichever door the admin came through: the box prepares it, the ＋ opens it blank.
  const newCategoryAsked = searchParams.get('new') === 'category';
  useEffect(() => {
    if (!newCategoryAsked || searchParams.get(ADMIN_ASK_PARAM)) return;
    setNewCategoryPrefill((cur) => cur ?? { nonce: 'new', parentId: null, parentQuery: '', labelEn: '', prepared: false });
  }, [newCategoryAsked, searchParams]);

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
        <NewCategoryForm
          key={newCategoryPrefill.nonce}
          prefill={newCategoryPrefill}
          groups={groups}
          tiles={tiles}
          unresolvedParent={
            newCategoryPrefill.parentId === null && newCategoryPrefill.parentQuery ? newCategoryPrefill.parentQuery : null
          }
          onDiscard={() => setNewCategoryPrefill(null)}
        />
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

/**
 * New category — the ONE form for "add a new category" (approved drawing `catalogue.html`, sheet `add-category`:
 * "Group it goes under ▾ · Name it · Close to what we have · Add"). Posts to the shipped `createTaxonomyNode`; the
 * group rides a hidden input behind the house dropdown (never a raw select). Lands last in its group.
 *
 * 🔒 IT PREPARES, IT NEVER PRESSES: a prefill only fills the boxes — nothing is added until the admin presses Add.
 */
function NewCategoryForm({
  prefill,
  groups,
  tiles,
  unresolvedParent,
  onDiscard,
}: {
  prefill: NewCategoryPrefill;
  /** The group words the search box carried that named no group — said out loud, never guessed. */
  unresolvedParent: string | null;
  groups: ReadonlyArray<{ id: string; label: string }>;
  tiles: ReadonlyArray<{ id: string; label: string }>;
  onDiscard: () => void;
}) {
  const [parentId, setParentId] = useState(prefill.parentId ?? '');
  const [name, setName] = useState(prefill.labelEn);
  const near = useMemo(() => nearMatches(name, tiles.map((t) => ({ key: t.id, label: t.label }))), [name, tiles]);
  const groupLabel = groups.find((g) => g.id === parentId)?.label;
  return (
    <form action={createTaxonomyNode} className="border-b border-ink/10 pb-4" data-new-category="">
      <h2 className="text-lg font-semibold text-ink">
        <InfoTip label="New category" labelAs="span" align="start">
          A category is the heading couples see on their Inspiration board, under one group. It lands last in its group;
          a new group shows to couples once it holds a category.
        </InfoTip>
      </h2>
      {prefill.prepared ? (
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink/70">
          <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Prepared from your search — nothing is added until you press Add.
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-ink/70">Lands last in its group</p>
      )}
      <input type="hidden" name="parent_id" value={parentId} />
      <div className="mt-3 flex min-h-11 items-center justify-between gap-3 border-y border-ink/10 py-1.5">
        <span className="text-[15px] text-ink">Group it goes under</span>
        <PickMenu
          label="Group it goes under"
          value={parentId || null}
          buttonText={groupLabel ?? 'Choose a group'}
          options={groups.map((g) => ({ key: g.id, label: g.label }))}
          onPick={setParentId}
          compact
          dataAttr="data-new-category-group"
          className="border border-ink/15"
        />
      </div>
      {!parentId && unresolvedParent ? (
        <p role="status" className="mt-2 text-[13px] text-warn-800">
          No group here is called “{unresolvedParent}” — choose the right one before adding.
        </p>
      ) : null}
      <label className="mt-3 block text-[13px] font-medium text-ink/70">
        Name it
        <input
          name="label_en"
          required
          minLength={2}
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ceremony essentials"
          className="input-field mt-1 min-h-11 w-full text-[15px]"
        />
      </label>
      {name.trim().length >= 2 && near.length > 0 ? (
        <p className="mt-2 text-[13px] text-warn-800" data-near-matches="">
          Close to what we have: {near.map((m) => m.label).join(' · ')}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <SubmitButton
          disabled={!parentId || name.trim().length < 2}
          className="sn-btn sn-btn-primary min-h-11 rounded-full px-5 text-sm font-semibold"
          pendingLabel="Adding…"
        >
          Add
        </SubmitButton>
        <button
          type="button"
          onClick={onDiscard}
          className="min-h-11 rounded-full border border-ink/15 px-5 text-sm font-medium text-ink"
        >
          {prefill.prepared ? 'Discard' : 'Cancel'}
        </button>
      </div>
    </form>
  );
}
