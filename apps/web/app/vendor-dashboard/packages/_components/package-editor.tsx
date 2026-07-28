'use client';

/**
 * PACKAGE EDITOR — the form a vendor fills to build a package (PR-3).
 *
 * The whole point of this surface: prod has ZERO packages because nothing has
 * ever inserted one, so the couple-side configurator at `/v/[slug]` renders for
 * nothing. This is where a package comes from.
 *
 * The form runs `validatePackageDraft` on every keystroke and shows problems
 * inline, keyed by `itemRef` / `optionRef`. That is the SAME function the server
 * action re-runs before writing — the client copy is for feedback only and is
 * never trusted. A vendor should never be able to press Save and get a
 * surprise, but the server still decides.
 *
 * NOT every server problem has an inline note: the card-text integrity gate
 * (`text_not_allowed`) is server-only by design, so the `invalid` branch of
 * `save()` renders `res.problems` into the alert rather than pointing at notes
 * that would not exist.
 *
 * Money is edited in PESOS and stored in CENTAVOS. The conversion happens once,
 * at the input boundary, so nothing downstream has to wonder which unit it holds.
 */

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Lock, ChevronDown } from 'lucide-react';

import {
  validatePackageDraft,
  type DraftPackage,
  type DraftItem,
  type DraftOption,
  type DraftProblem,
} from '@/lib/package-authoring';
import { savePackage, setPackageActive } from '../actions';

/** Client-side ref for a row that has no database id yet. */
let seq = 0;
const newRef = () => `new-${++seq}`;

const pesos = (centavos: number) => (centavos === 0 ? '' : String(centavos / 100));
const toCentavos = (v: string) => {
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

function emptyItem(): DraftItem {
  return {
    ref: newRef(),
    service_description: '',
    canonical_service: '',
    is_default_included: true,
    is_required: false,
    replacement_value_centavos: 0,
    options: [],
  };
}

export function PackageEditor({
  packageId,
  initial,
  isActive,
  frozen,
  canonicalServices,
}: {
  packageId?: string;
  initial: DraftPackage;
  isActive: boolean;
  /** True when a live booking exists — structure is locked, metadata is not. */
  frozen: boolean;
  canonicalServices: { value: string; label: string }[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<DraftPackage>(initial);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const problems = useMemo(() => validatePackageDraft(draft), [draft]);
  const packageProblems = problems.filter((p) => !p.itemRef);
  const problemsFor = (itemRef: string, optionRef?: string) =>
    problems.filter((p) =>
      p.itemRef === itemRef && (optionRef ? p.optionRef === optionRef : !p.optionRef),
    );

  const patch = (over: Partial<DraftPackage>) => {
    setSaved(false);
    setDraft((d) => ({ ...d, ...over }));
  };
  const patchItem = (ref: string, over: Partial<DraftItem>) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) => (i.ref === ref ? { ...i, ...over } : i)),
    }));
  };
  const patchOption = (
    itemRef: string,
    optRef: string,
    over: Partial<DraftOption>,
  ) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: i.options.map((o) =>
                o.ref === optRef ? { ...o, ...over } : o,
              ),
            },
      ),
    }));
  };

  /** Exactly one standard option — picking one clears the others. */
  const makeStandard = (itemRef: string, optRef: string) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: i.options.map((o) => ({
                ...o,
                is_default: o.ref === optRef,
                // The standard option IS the baseline, so it costs nothing
                // extra — the database enforces this too.
                price_delta_centavos:
                  o.ref === optRef ? 0 : o.price_delta_centavos,
              })),
            },
      ),
    }));
  };

  const addChoice = (itemRef: string) => {
    setSaved(false);
    setDraft((d) => ({
      ...d,
      items: d.items.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              // Seed two, because one option is not a choice — and mark the
              // first standard so the row starts valid.
              options: [
                { ref: newRef(), label: '', price_delta_centavos: 0, is_default: true, is_available: true },
                { ref: newRef(), label: '', price_delta_centavos: 0, is_default: false, is_available: true },
              ],
            },
      ),
    }));
  };

  const save = () => {
    setServerError(null);
    start(async () => {
      const res = await savePackage({ ...draft, packageId });
      if (res.status === 'ok') {
        setSaved(true);
        if (!packageId) router.replace(`/vendor-dashboard/packages/${res.packageId}`);
        router.refresh();
        return;
      }
      if (res.status === 'frozen') {
        setServerError(
          `Someone has already booked this package, so its contents are locked. Changed: ${res.changed.join(', ')}. Publish a new package instead.`,
        );
        return;
      }
      if (res.status === 'invalid') {
        // The inline notes below come from the CLIENT copy of
        // validatePackageDraft, which cannot see server-only rules (the
        // card-text integrity gate raises `text_not_allowed`). Pointing the
        // vendor at "the notes below" when there are none is a dead end they
        // cannot get out of — so show what the server actually said, and keep
        // the pointer only for problems the inline notes really do render.
        setServerError(
          res.problems.length > 0
            ? res.problems.map((p) => p.message).join(' ')
            : 'Some details still need fixing — see the notes below.',
        );
        return;
      }
      setServerError(
        res.status === 'error' ? res.message : 'That package could not be saved.',
      );
    });
  };

  const togglePublished = () => {
    if (!packageId) return;
    setServerError(null);
    start(async () => {
      const res = await setPackageActive(packageId, !isActive);
      if (res.status === 'ok') router.refresh();
      else if (res.status === 'invalid')
        setServerError('Fix the notes below before publishing.');
      else setServerError('That change could not be saved.');
    });
  };

  const field =
    'w-full rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm text-ink/85 focus:border-terracotta focus:outline-none';
  const label =
    'mb-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45';

  return (
    <div className="space-y-6">
      {frozen ? (
        <p className="flex items-start gap-2 rounded-xl border border-ink/10 bg-cream/60 p-3 text-sm text-ink/70">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            Someone has booked this package, so what is in it is now fixed — that
            booking is a promise you have already made. You can still rename it or
            unlist it. To sell something different, publish a new package.
          </span>
        </p>
      ) : null}

      {/* ---- the package itself ---- */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="mb-4 font-serif text-lg text-ink/85">The package</h2>
        <div className="space-y-3">
          <div>
            <label className={label} htmlFor="pkg-name">Name</label>
            <input
              id="pkg-name"
              className={field}
              value={draft.package_name}
              placeholder="Complete Wedding Catering"
              onChange={(e) => patch({ package_name: e.target.value })}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="pkg-price">Package price (₱)</label>
              <input
                id="pkg-price"
                inputMode="decimal"
                disabled={frozen}
                className={`${field} font-mono disabled:opacity-60`}
                value={pesos(draft.total_price_centavos)}
                placeholder="120000"
                onChange={(e) =>
                  patch({ total_price_centavos: toCentavos(e.target.value) })
                }
              />
            </div>
            <div>
              <label className={label} htmlFor="pkg-budget">
                Spendable budget (₱) — optional
              </label>
              <input
                id="pkg-budget"
                inputMode="decimal"
                disabled={frozen}
                className={`${field} font-mono disabled:opacity-60`}
                value={pesos(draft.consumable_budget_centavos)}
                placeholder="0"
                onChange={(e) =>
                  patch({ consumable_budget_centavos: toCentavos(e.target.value) })
                }
              />
            </div>
          </div>
          <label className="flex items-start gap-2 text-sm text-ink/75">
            <input
              type="checkbox"
              disabled={frozen}
              checked={draft.is_consumable_flexible}
              onChange={(e) => patch({ is_consumable_flexible: e.target.checked })}
              className="mt-0.5 h-4 w-4 rounded border-ink/20 text-terracotta"
            />
            <span>
              Money freed by dropping an inclusion stays in the package
              <em className="block not-italic text-xs text-ink/45">
                Off: the couple simply pays less. On: they spend it on something
                else of yours — so you keep the full package price.
              </em>
            </span>
          </label>
        </div>

        {packageProblems.length > 0 ? (
          <ul className="mt-3 space-y-1">
            {packageProblems.map((p) => (
              <ProblemLine key={p.code} problem={p} />
            ))}
          </ul>
        ) : null}
      </section>

      {/* ---- inclusions ---- */}
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-lg text-ink/85">What&rsquo;s included</h2>
          {!frozen ? (
            <button
              type="button"
              onClick={() => patch({ items: [...draft.items, emptyItem()] })}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1.5 text-xs text-ink/70 hover:bg-ink/[0.03]"
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add inclusion
            </button>
          ) : null}
        </div>

        {draft.items.length === 0 ? (
          <p className="text-sm text-ink/50">
            Nothing yet. Add each thing the couple gets — the buffet, the cake, the
            crew meals. Anything they may swap or drop gets its own line.
          </p>
        ) : null}

        <ul className="space-y-3">
          {draft.items.map((item) => (
            <li
              key={item.ref}
              className="rounded-xl border border-ink/10 bg-white/60 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-3">
                  <input
                    aria-label="What this inclusion is"
                    className={field}
                    disabled={frozen}
                    value={item.service_description}
                    placeholder="Buffet dinner for your guest count"
                    onChange={(e) =>
                      patchItem(item.ref, { service_description: e.target.value })
                    }
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <select
                        aria-label="Category"
                        disabled={frozen}
                        className={`${field} appearance-none pr-8`}
                        value={item.canonical_service}
                        onChange={(e) =>
                          patchItem(item.ref, { canonical_service: e.target.value })
                        }
                      >
                        <option value="">Category…</option>
                        {canonicalServices.map((c) => (
                          <option key={c.value} value={c.value}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        aria-hidden
                        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35"
                        strokeWidth={1.75}
                      />
                    </div>
                    <input
                      aria-label="What this is worth in pesos"
                      inputMode="decimal"
                      disabled={frozen}
                      className={`${field} font-mono`}
                      value={pesos(item.replacement_value_centavos)}
                      placeholder="Worth (₱)"
                      onChange={(e) =>
                        patchItem(item.ref, {
                          replacement_value_centavos: toCentavos(e.target.value),
                        })
                      }
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink/70">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        disabled={frozen}
                        checked={item.is_required}
                        onChange={(e) =>
                          patchItem(item.ref, {
                            is_required: e.target.checked,
                            // Required implies included — the database refuses
                            // any other combination outright.
                            is_default_included: e.target.checked
                              ? true
                              : item.is_default_included,
                          })
                        }
                        className="h-4 w-4 rounded border-ink/20 text-terracotta"
                      />
                      Always included — the couple can&rsquo;t remove it
                    </label>
                    {item.options.length === 0 && !frozen ? (
                      <button
                        type="button"
                        onClick={() => addChoice(item.ref)}
                        className="text-xs text-terracotta underline underline-offset-2"
                      >
                        Let them choose between options
                      </button>
                    ) : null}
                  </div>

                  {item.options.length > 0 ? (
                    <OptionList
                      item={item}
                      frozen={frozen}
                      field={field}
                      problemsFor={problemsFor}
                      onPatch={patchOption}
                      onStandard={makeStandard}
                      onAdd={() =>
                        patchItem(item.ref, {
                          options: [
                            ...item.options,
                            {
                              ref: newRef(),
                              label: '',
                              price_delta_centavos: 0,
                              is_default: false,
                              is_available: true,
                            },
                          ],
                        })
                      }
                      onRemove={(optRef) =>
                        patchItem(item.ref, {
                          options: item.options.filter((o) => o.ref !== optRef),
                        })
                      }
                    />
                  ) : null}

                  {problemsFor(item.ref).map((p) => (
                    <ProblemLine key={p.code} problem={p} />
                  ))}
                </div>

                {!frozen ? (
                  <button
                    type="button"
                    aria-label="Remove this inclusion"
                    onClick={() =>
                      patch({ items: draft.items.filter((i) => i.ref !== item.ref) })
                    }
                    className="rounded-lg p-2 text-ink/35 hover:bg-ink/[0.04] hover:text-ink/60"
                  >
                    <Trash2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- save ---- */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || problems.length > 0}
          className="rounded-full bg-ink px-5 py-2.5 text-sm text-cream disabled:opacity-40"
        >
          {pending ? 'Saving…' : packageId ? 'Save changes' : 'Create package'}
        </button>
        {packageId ? (
          <button
            type="button"
            onClick={togglePublished}
            disabled={pending || (!isActive && problems.length > 0)}
            className="rounded-full border border-ink/15 px-5 py-2.5 text-sm text-ink/75 disabled:opacity-40"
          >
            {isActive ? 'Unlist from my page' : 'Publish to my page'}
          </button>
        ) : null}
        {saved ? (
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-success-700">
            Saved
          </span>
        ) : null}
        {problems.length > 0 ? (
          <span className="text-xs text-ink/45">
            {problems.length} thing{problems.length === 1 ? '' : 's'} to fix first
          </span>
        ) : null}
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-red-700">
          {serverError}
        </p>
      ) : null}
    </div>
  );
}

function ProblemLine({ problem }: { problem: DraftProblem }) {
  return (
    <li className="list-none text-xs text-red-700">{problem.message}</li>
  );
}

function OptionList({
  item,
  frozen,
  field,
  problemsFor,
  onPatch,
  onStandard,
  onAdd,
  onRemove,
}: {
  item: DraftItem;
  frozen: boolean;
  field: string;
  problemsFor: (itemRef: string, optionRef?: string) => DraftProblem[];
  onPatch: (itemRef: string, optRef: string, over: Partial<DraftOption>) => void;
  onStandard: (itemRef: string, optRef: string) => void;
  onAdd: () => void;
  onRemove: (optRef: string) => void;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/50 p-3">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/45">
        They pick one — the standard one is in the price, the rest add to it
      </p>
      <ul className="space-y-2">
        {item.options.map((o) => (
          <li key={o.ref} className="flex items-center gap-2">
            <input
              type="radio"
              name={`std-${item.ref}`}
              aria-label="Make this the standard option"
              disabled={frozen}
              checked={o.is_default}
              onChange={() => onStandard(item.ref, o.ref)}
              className="h-4 w-4 shrink-0 border-ink/20 text-terracotta"
            />
            <input
              aria-label="Option name"
              className={`${field} flex-1`}
              disabled={frozen}
              value={o.label}
              placeholder="Chicken teriyaki"
              onChange={(e) => onPatch(item.ref, o.ref, { label: e.target.value })}
            />
            <input
              aria-label="Extra cost in pesos"
              inputMode="decimal"
              disabled={frozen || o.is_default}
              className={`${field} w-28 font-mono disabled:opacity-50`}
              value={o.is_default ? '' : pesos(o.price_delta_centavos)}
              // The default pick shows a BLANK, not "included" (owner
              // 2026-07-28) — "included" reads as comes-regardless-of-the-pick.
              placeholder={o.is_default ? '' : '+₱'}
              onChange={(e) =>
                onPatch(item.ref, o.ref, {
                  price_delta_centavos: toCentavos(e.target.value),
                })
              }
            />
            <label className="flex shrink-0 items-center gap-1 text-[11px] text-ink/55">
              <input
                type="checkbox"
                disabled={frozen || o.is_default}
                checked={o.is_available}
                onChange={(e) =>
                  onPatch(item.ref, o.ref, { is_available: e.target.checked })
                }
                className="h-3.5 w-3.5 rounded border-ink/20 text-terracotta"
              />
              On
            </label>
            {!frozen && item.options.length > 2 ? (
              <button
                type="button"
                aria-label="Remove this option"
                onClick={() => onRemove(o.ref)}
                className="rounded p-1 text-ink/30 hover:text-ink/60"
              >
                <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {problemsFor(item.ref).length > 0 || item.options.some((o) => problemsFor(item.ref, o.ref).length > 0) ? (
        <ul className="mt-2 space-y-1">
          {item.options.flatMap((o) =>
            problemsFor(item.ref, o.ref).map((p) => (
              <ProblemLine key={`${o.ref}-${p.code}`} problem={p} />
            )),
          )}
        </ul>
      ) : null}
      {!frozen ? (
        <button
          type="button"
          onClick={onAdd}
          className="mt-2 text-xs text-terracotta underline underline-offset-2"
        >
          Add another option
        </button>
      ) : null}
    </div>
  );
}
