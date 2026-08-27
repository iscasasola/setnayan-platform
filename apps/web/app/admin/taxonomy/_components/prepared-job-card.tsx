'use client';

/**
 * prepared-job-card.tsx — one card, many jobs.
 *
 * Renders a single entry of `PREPARED_TAXONOMY_JOBS` as a REAL `<form action=…>`
 * posting the REAL server action, with the answers the search box gathered
 * already in the boxes. It is the reading-back end of
 * `?admin_ask=<job>&aa_<field>=<value>`; the writing end is generic already and
 * lives in the palette.
 *
 * 🔒 IT PREPARES, IT NEVER PRESSES. There is no effect here and no programmatic
 * submit — every value is a `defaultValue` the admin can change, and the action
 * runs only when THEY press the button. Owner-locked (one-person admin plan,
 * 2026-07-11) and asserted by `prepared-job-card-is-wired.test.ts`.
 *
 * 🔑 A MISS IS SAID OUT LOUD. When the words the admin typed matched no real
 * record, the picker opens on "— choose —" and a line underneath names the words
 * that missed. Nothing is guessed into place: a service filed against the wrong
 * tile, done quietly, is worse than one more question.
 *
 * 🔑 THE ACTION MAP AND THE DESCRIPTOR TABLE ARE CHECKED AGAINST EACH OTHER.
 * A descriptor with no action would render a card whose button does nothing; an
 * action with no descriptor is dead weight. The guard derives both sides and
 * compares them, because "it exists" is not "it is reachable" — a guard on this
 * very feature recently passed while the button it described was dead.
 */

import { Sparkles } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import {
  createEventTypeRoster,
  createFaithVocab,
  mapCategoryRequest,
  promoteCategoryRequest,
  relabelEventTypeVocab,
  relabelFaithVocab,
  remapCanonical,
  renameTaxonomyNode,
  reorderEventTypeVocab,
  reorderFaithVocab,
  resolveCategoryRequest,
  setCategoryHidden,
  setCategoryIcon,
  setEventTypeLaunch,
  setEventTypeVocabStatus,
  setFaithLaunchStatus,
  setFaithLaunchThreshold,
  setFaithVocabStatus,
  setServiceFaith,
  setServiceFlag,
  unretireEventTypeVocab,
  updateEventTypePresentation,
} from '../actions';
import type {
  PreparedCatalogs,
  PreparedField,
  PreparedJobSpec,
  PreparedValues,
} from './prepared-jobs';

/** Anything Next will accept as a `<form action=…>`. */
type FormAction = (formData: FormData) => void | Promise<void> | Promise<never>;

/**
 * job name → the server action its prepared form posts.
 *
 * Every key here must appear in `PREPARED_TAXONOMY_JOBS` and vice versa; the
 * guard derives both sets rather than trusting this comment.
 */
export const PREPARED_JOB_ACTIONS: Record<string, FormAction> = {
  relabelEventTypeVocab,
  setEventTypeVocabStatus,
  setEventTypeLaunch,
  unretireEventTypeVocab,
  reorderEventTypeVocab,
  updateEventTypePresentation,
  createEventTypeRoster,
  relabelFaithVocab,
  setFaithVocabStatus,
  reorderFaithVocab,
  setFaithLaunchStatus,
  setFaithLaunchThreshold,
  createFaithVocab,
  renameTaxonomyNode,
  setCategoryHidden,
  setCategoryIcon,
  setServiceFaith,
  setServiceFlag,
  remapCanonical,
  mapCategoryRequest,
  promoteCategoryRequest,
  resolveCategoryRequest,
};

const INPUT =
  'mt-0.5 w-full rounded-md border border-ink/15 bg-white px-2 py-1.5 text-sm text-ink';

export function PreparedJobCard({
  jobName,
  spec,
  prepared,
  catalogs,
  onDiscard,
}: {
  jobName: string;
  spec: PreparedJobSpec;
  prepared: PreparedValues;
  catalogs: PreparedCatalogs;
  onDiscard: () => void;
}) {
  const action = PREPARED_JOB_ACTIONS[jobName];
  // A descriptor with no action would render a button that silently does
  // nothing — exactly the dead end this feature exists to remove. Render
  // nothing at all rather than a card that cannot work.
  if (!action) return null;

  // Only a field the admin can SEE can be reported as a miss. `carry` is hidden
  // plumbing (which view to return to) — it is never resolved against a catalog,
  // so it can never miss, and it carries no label to name in the message. The
  // predicate says that in the type rather than trusting it: without it a future
  // `carry` landing in `misses` would render "Nothing here is called …" against
  // `undefined`, which is the silent-wrong-record failure this card exists to
  // prevent, wearing a different hat.
  const missed = spec.fields.filter(
    (f): f is Exclude<PreparedField, { kind: 'carry' }> =>
      f.kind !== 'carry' && Boolean(prepared.misses[f.field]),
  );

  return (
    <form
      action={action}
      className="rounded-xl border border-success-200 bg-success-50/40 p-3"
      aria-label={spec.verb}
    >
      <p className="flex items-start gap-1.5 text-[11px] text-success-800">
        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
        <span>
          Prepared from your question in the search box — check it, then press{' '}
          <strong>{spec.verb}</strong> yourself. {spec.summary} Nothing has changed yet.
        </span>
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
        {spec.fields.map((f) => {
          if (f.kind === 'carry') {
            // Hidden plumbing, carried verbatim so no gathered answer is binned.
            return (
              <input key={f.field} type="hidden" name={f.field} value={prepared.values[f.field] ?? ''} />
            );
          }

          if (f.kind === 'choice' || f.kind === 'pick') {
            const options = f.kind === 'pick' ? f.options : catalogs[f.from];
            const allowEmpty = f.kind === 'choice' && f.allowEmpty === true;
            const emptyLabel =
              f.kind === 'choice' && f.emptyLabel ? f.emptyLabel : '— choose —';
            return (
              <label key={f.field} className="min-w-[10rem] flex-1 text-[11px] text-ink/60">
                {f.label}
                <select
                  name={f.field}
                  // Required unless clearing is a legitimate answer, so an
                  // unresolved pick cannot be submitted by accident.
                  required={!allowEmpty}
                  defaultValue={prepared.values[f.field] ?? ''}
                  className={INPUT}
                >
                  <option value="">{emptyLabel}</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (f.multiline) {
            return (
              <label key={f.field} className="min-w-[12rem] flex-1 text-[11px] text-ink/60">
                {f.label}
                <textarea
                  name={f.field}
                  rows={2}
                  defaultValue={prepared.values[f.field] ?? ''}
                  className={INPUT}
                />
              </label>
            );
          }

          return (
            <label key={f.field} className="min-w-[10rem] flex-1 text-[11px] text-ink/60">
              {f.label}
              {f.hint ? <span className="text-ink/40"> · {f.hint}</span> : null}
              <input
                name={f.field}
                defaultValue={prepared.values[f.field] ?? ''}
                maxLength={200}
                className={INPUT}
              />
            </label>
          );
        })}

        <div className="flex items-center gap-2">
          <SubmitButton
            className="rounded-md bg-success-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-success-700"
            pendingLabel="Working…"
          >
            {spec.verb}
          </SubmitButton>
          <button
            type="button"
            onClick={onDiscard}
            className="rounded-md border border-ink/15 px-3 py-1.5 text-xs text-ink/60 hover:bg-ink/5"
          >
            Discard
          </button>
        </div>
      </div>

      {/* A miss is SAID OUT LOUD — silence here is how the wrong record gets
          picked without anybody deciding to pick it. */}
      {missed.length > 0 ? (
        <p className="mt-2 text-[11px] text-warn-800">
          {missed.map((f) => (
            <span key={f.field} className="mr-2 block">
              Nothing here is called “{prepared.misses[f.field]}” — pick {f.label.toLowerCase()}{' '}
              above before pressing.
            </span>
          ))}
        </p>
      ) : null}
    </form>
  );
}
