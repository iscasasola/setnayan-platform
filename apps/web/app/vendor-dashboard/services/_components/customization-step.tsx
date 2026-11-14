'use client';

/**
 * ★ CUSTOMIZATION — the wizard step where a vendor says what a couple may
 * change about this service.
 *
 * ── WHAT THIS IS, AND WHAT IT DELIBERATELY IS NOT ──────────────────────────
 * It is NOT a new editor. Every rule it enforces, every shape it writes and
 * every sentence it shows on a bad row comes from the SHIPPED package
 * machinery: `DraftItem` / `DraftOption` from lib/package-authoring,
 * `validatePackageDraft` for the notes, `savePackage` for the write. The
 * standalone editor at `/vendor-dashboard/packages/[packageId]` keeps working
 * exactly as it does today — nothing was moved out of it.
 *
 * What is genuinely new is the VOCABULARY. `package-editor.tsx` asks a vendor
 * to build a "package" out of "inclusions" with an "always included" checkbox;
 * this asks them what a couple may change about the service they are already
 * publishing, in four zones — Included in the price · Choices · Quantities ·
 * Optional add-ons — with a new line landing in the zone it was added from.
 * The state machine behind those zones is pure and lives in
 * lib/service-customization-draft.ts, so it is unit-testable without React.
 *
 * ── THE ONE CONSTRAINT THAT SHAPES EVERYTHING ──────────────────────────────
 * The wizard is ONE `<form action={commitVendorService}>` with every step
 * mounted at once and hidden with the `hidden` attribute, so all inputs post
 * together. This component therefore renders NO form of its own (see
 * scripts/lint-nested-forms.mjs for what nesting one would cost) and
 * contributes exactly ONE hidden field: the serialised draft. See
 * CUSTOMIZATION_FIELD_NAME for why the shipped index-aligned repeater idiom
 * cannot express this structure.
 *
 * Money is edited in PESOS and stored in CENTAVOS, converted once at the input
 * boundary — same discipline as package-editor.tsx.
 */

import { useMemo, useState } from 'react';
import { Plus, Trash2, CornerDownRight } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

import {
  validatePackageDraft,
  type DraftItem,
  type DraftOption,
  type DraftProblem,
} from '@/lib/package-authoring';
import {
  AMOUNT_PREFIX,
  CUSTOMIZATION_FIELD_NAME,
  INCLUDED_PLACEHOLDER,
  LINE_GROUP_LABEL,
  LINE_GROUP_ORDER,
  allowedLineStates,
  applyLineState,
  autoNameDraftItems,
  autoNamePlaceholder,
  canonicalServiceForVendorCategory,
  countAutoNamed,
  followUpLineage,
  formatAmountInput,
  isFollowUp,
  lineGroupOf,
  lineStateOf,
  newFollowUpLine,
  newLine,
  parseAmountInput,
  refsToRemoveWith,
  serializeCustomizationDraft,
  type LineGroup,
  type LineState,
} from '@/lib/service-customization-draft';
import { formatCount } from '@/lib/format-number';

/** Client-side ref for a row that has no database id yet. */
let seq = 0;
const newRef = () => `c${++seq}`;

const STATE_LABEL: Record<LineState, string> = {
  required: 'Always',
  included: 'Included',
  optional: 'Optional',
  choice: 'They pick',
  quantity: 'By the hour',
};

/** Which state a "+ Add" inside each zone should create. */
const GROUP_SEED_STATE: Record<LineGroup, LineState> = {
  included: 'included',
  choices: 'choice',
  quantities: 'quantity',
  addons: 'optional',
};

const GROUP_BLURB: Record<LineGroup, string> = {
  included: 'Part of the price. Nothing to decide — the couple just gets it.',
  choices: 'The couple picks. The standard pick is in the price; the rest add to it.',
  quantities: 'The couple adds more of this — you set the price each and how far they can go.',
  addons: 'Not in the price. The couple adds it if they want it.',
};

const field =
  'min-h-11 w-full rounded-lg border border-[color:var(--m-line)] bg-raised px-3 py-2 text-sm text-ink focus:border-terracotta focus:outline-none';

/** Rule 2's section label — small grey capitals, no box. */
const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-[color:var(--m-slate-2)]';
/** The line under a label — the template's dark grey. */
const SUBLINE = 'text-sm text-[color:var(--m-slate-2)]';

export function CustomizationStep({
  categoryValue,
  categoryLabel,
  initialItems,
}: {
  categoryValue: string;
  categoryLabel: string;
  /**
   * The lines a card copied from another starts with (SUP-40). Already re-keyed
   * on the server (`rekeyCopiedItems`), so they carry no id of the source's.
   * Omitted everywhere else — a fresh card starts empty, exactly as before.
   */
  initialItems?: DraftItem[];
}) {
  const [items, setItems] = useState<DraftItem[]>(initialItems ?? []);

  // Every line this service authors sits under the service's OWN category —
  // the couple meets one card, so there is no per-line category picker here
  // (the standalone package editor keeps its own, because a package genuinely
  // spans categories). Resolved once: the two namespaces differ, see
  // canonicalServiceForVendorCategory.
  const canonicalService = useMemo(
    () => canonicalServiceForVendorCategory(categoryValue),
    [categoryValue],
  );

  /**
   * Inline notes, from the SAME validator the server re-runs.
   *
   * Two deliberate narrowings. Blank names are auto-named BEFORE validating,
   * so `item_description_empty` can never fire — a blank name is filled in,
   * never refused (owner-locked). And only ITEM-scoped problems are kept: the
   * package-level rules are about a name and a price this step does not own
   * (they come from the wizard's other steps and are checked server-side), so
   * surfacing them here would point the vendor at fields that are not on this
   * screen.
   */
  const problems = useMemo(
    () =>
      validatePackageDraft({
        package_name: 'placeholder',
        total_price_centavos: Number.MAX_SAFE_INTEGER,
        consumable_budget_centavos: 0,
        is_consumable_flexible: false,
        items: autoNameDraftItems(items),
      }).filter((p) => p.itemRef),
    [items],
  );
  const problemsFor = (itemRef: string, optionRef?: string) =>
    problems.filter(
      (p) => p.itemRef === itemRef && (optionRef ? p.optionRef === optionRef : !p.optionRef),
    );

  const patchItem = (ref: string, over: Partial<DraftItem>) =>
    setItems((cur) => cur.map((i) => (i.ref === ref ? { ...i, ...over } : i)));

  const patchOption = (itemRef: string, optRef: string, over: Partial<DraftOption>) =>
    setItems((cur) =>
      cur.map((i) =>
        i.ref !== itemRef
          ? i
          : { ...i, options: i.options.map((o) => (o.ref === optRef ? { ...o, ...over } : o)) },
      ),
    );

  /** Exactly one standard option — picking one clears the others, and the
   *  standard IS the baseline so its extra cost is pinned to zero (the
   *  database enforces the same thing). */
  const makeStandard = (itemRef: string, optRef: string) =>
    setItems((cur) =>
      cur.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: i.options.map((o) => ({
                ...o,
                is_default: o.ref === optRef,
                price_delta_centavos: o.ref === optRef ? 0 : o.price_delta_centavos,
              })),
            },
      ),
    );

  const setState = (ref: string, state: LineState) =>
    setItems((cur) => cur.map((i) => (i.ref === ref ? applyLineState(i, state) : i)));

  /** Removes the line AND everything that follows one of its options — an
   *  orphaned follow-up is a red note the vendor cannot clear. */
  const removeLine = (ref: string) =>
    setItems((cur) => {
      const doomed = refsToRemoveWith(ref, cur);
      return cur.filter((i) => !doomed.has(i.ref));
    });

  const addLine = (group: LineGroup) =>
    setItems((cur) => [...cur, newLine(newRef(), canonicalService, GROUP_SEED_STATE[group])]);

  const addFollowUp = (itemRef: string, optionRef: string) =>
    setItems((cur) => [
      ...cur,
      newFollowUpLine(newRef(), canonicalService, { itemRef, optionRef }),
    ]);

  const addOption = (itemRef: string) =>
    setItems((cur) =>
      cur.map((i) =>
        i.ref !== itemRef
          ? i
          : {
              ...i,
              options: [
                ...i.options,
                {
                  ref: newRef(),
                  label: '',
                  price_delta_centavos: 0,
                  is_default: false,
                  is_available: true,
                },
              ],
            },
      ),
    );

  const removeOption = (itemRef: string, optRef: string) =>
    setItems((cur) => {
      // Dropping an option orphans anything that followed it, so those go too.
      const orphans = new Set(
        cur.filter((i) => i.parentRef?.optionRef === optRef).map((i) => i.ref),
      );
      const doomed = new Set<string>();
      for (const ref of orphans) for (const r of refsToRemoveWith(ref, cur)) doomed.add(r);
      return cur
        .filter((i) => !doomed.has(i.ref))
        .map((i) =>
          i.ref !== itemRef ? i : { ...i, options: i.options.filter((o) => o.ref !== optRef) },
        );
    });

  const autoNamed = countAutoNamed(items);
  const autoNamedWords = `line${autoNamed === 1 ? '' : 's'} without a name will be saved under the grey name shown in the box. You can rename ${autoNamed === 1 ? 'it' : 'them'} any time.`;

  return (
    <div className="space-y-4">
      {/* THE ONLY FIELD THIS STEP CONTRIBUTES. Every step of the wizard is
          mounted at once inside one <form>, so this posts with everything else
          and `commitVendorService` reads it by name. */}
      <input
        type="hidden"
        name={CUSTOMIZATION_FIELD_NAME}
        value={serializeCustomizationDraft(items)}
      />

      <div>
        <InfoTip label="What can a couple change?" labelAs="p" labelClassName="text-sm font-semibold text-ink" align="start">
          Add lines here and couples can swap, skip, or add to what you offer — before they ever message you.
        </InfoTip>
        <p className={`mt-1 ${SUBLINE}`}>
          Optional. Leave this empty and your {categoryLabel.toLowerCase()} card works exactly as it does today.
        </p>
      </div>

      {LINE_GROUP_ORDER.map((group) => {
        const rows = items
          .map((item, index) => ({ item, index }))
          .filter(({ item }) => lineGroupOf(item) === group);
        return (
          <section key={group} className="pt-2" data-customization-group={group}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className={SECTION_LABEL}>{LINE_GROUP_LABEL[group]}</h3>
              <ActionButton tone="neutral" icon={Plus} label="Add" onClick={() => addLine(group)} className="!h-11" />
            </div>
            <p className={`mt-1 ${SUBLINE}`}>{GROUP_BLURB[group]}</p>

            {rows.length === 0 ? (
              <p className={`mt-2 ${SUBLINE}`}>Nothing here yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[color:var(--m-line)]">
                {rows.map(({ item, index }) => (
                  <LineRow
                    key={item.ref}
                    item={item}
                    index={index}
                    allItems={items}
                    problemsFor={problemsFor}
                    onPatch={patchItem}
                    onState={setState}
                    onRemove={removeLine}
                    onPatchOption={patchOption}
                    onStandard={makeStandard}
                    onAddOption={addOption}
                    onRemoveOption={removeOption}
                    onAddFollowUp={addFollowUp}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {autoNamed > 0 ? (
        <p className={SUBLINE}>
          {formatCount(autoNamed)} {autoNamedWords}
        </p>
      ) : null}
    </div>
  );
}

function LineRow({
  item,
  index,
  allItems,
  problemsFor,
  onPatch,
  onState,
  onRemove,
  onPatchOption,
  onStandard,
  onAddOption,
  onRemoveOption,
  onAddFollowUp,
}: {
  item: DraftItem;
  index: number;
  allItems: ReadonlyArray<DraftItem>;
  problemsFor: (itemRef: string, optionRef?: string) => DraftProblem[];
  onPatch: (ref: string, over: Partial<DraftItem>) => void;
  onState: (ref: string, state: LineState) => void;
  onRemove: (ref: string) => void;
  onPatchOption: (itemRef: string, optRef: string, over: Partial<DraftOption>) => void;
  onStandard: (itemRef: string, optRef: string) => void;
  onAddOption: (itemRef: string) => void;
  onRemoveOption: (itemRef: string, optRef: string) => void;
  onAddFollowUp: (itemRef: string, optionRef: string) => void;
}) {
  const state = lineStateOf(item);
  const lineage = followUpLineage(item, allItems);
  const pickN = item.pickMin != null && item.pickMax != null;

  return (
    <li className="min-h-14 py-3">
      {lineage ? (
        <p className="mb-2 flex items-center gap-1 text-xs text-[color:var(--m-slate-2)]">
          <CornerDownRight aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {lineage}
        </p>
      ) : null}

      <div className="flex items-start gap-2">
        <input
          aria-label="What this line is"
          className={`${field} flex-1`}
          value={item.service_description}
          // The auto-name the SERVER will write, shown before the save so the
          // vendor can see what a blank line becomes. Blank is never refused.
          placeholder={autoNamePlaceholder('item', index)}
          onChange={(e) => onPatch(item.ref, { service_description: e.target.value })}
        />
        <ActionButton tone="danger" quiet iconOnly icon={Trash2} label="Remove this line" onClick={() => onRemove(item.ref)} className="!h-11 !w-11" />
      </div>

      {/* State. A FOLLOW-UP is never offered "Always" or "Included" — the
          database refuses both outright, so the control does not draw them. */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <PickMenu
          label="How a couple gets this line"
          value={state}
          options={allowedLineStates(item).map((s) => ({ key: s, label: STATE_LABEL[s] }))}
          onPick={(k) => onState(item.ref, k as LineState)}
          compact
          dataAttr="data-line-state"
          className="!min-h-11"
        />
        {isFollowUp(item) ? (
          <span className={SUBLINE}>
            Only the couples who pick that option see this, so it can&rsquo;t be in the price.
          </span>
        ) : null}
      </div>

      {/* State-specific fields. */}
      {state === 'optional' ? (
        <div className="mt-2 max-w-[14rem]">
          <AmountInput
            ariaLabel="What this is worth"
            centavos={item.replacement_value_centavos}
            onChange={(c) => onPatch(item.ref, { replacement_value_centavos: c })}
          />
          <p className={`mt-1 ${SUBLINE}`}>What it adds if they take it.</p>
        </div>
      ) : null}

      {state === 'quantity' ? (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <div>
            <AmountInput
              ariaLabel="Price for each extra hour"
              centavos={item.replacement_value_centavos}
              onChange={(c) => onPatch(item.ref, { replacement_value_centavos: c })}
            />
            <p className={`mt-1 ${SUBLINE}`}>Each extra hour.</p>
          </div>
          <div>
            <input
              aria-label="Most extra hours a couple may add"
              type="number"
              min={0}
              step={1}
              className={`${field} tabular-nums`}
              value={item.maxExtraHours ?? 0}
              onChange={(e) =>
                onPatch(item.ref, {
                  maxExtraHours: Math.max(0, Math.floor(Number(e.target.value) || 0)),
                })
              }
            />
            <p className={`mt-1 ${SUBLINE}`}>Most extra hours they can add.</p>
          </div>
        </div>
      ) : null}

      {state === 'choice' ? (
        <div className="mt-2 space-y-2">
          <ul className="space-y-2">
            {item.options.map((o, oIdx) => (
              <li key={o.ref} className="flex flex-wrap items-center gap-2">
                <input
                  type="radio"
                  name={`std-${item.ref}`}
                  aria-label="Make this the standard pick"
                  checked={o.is_default}
                  onChange={() => onStandard(item.ref, o.ref)}
                  className="h-4 w-4 shrink-0 border-[color:var(--m-line)] text-terracotta"
                />
                <input
                  aria-label="Option name"
                  className={`${field} min-w-[8rem] flex-1`}
                  value={o.label}
                  placeholder={autoNamePlaceholder('option', oIdx)}
                  onChange={(e) => onPatchOption(item.ref, o.ref, { label: e.target.value })}
                />
                {/* AMOUNT ONLY. The vendor types digits; 0 or blank renders as
                    a BLANK (owner 2026-07-28 — never the word "included", which
                    read as comes-regardless). The standard pick IS the
                    baseline, so its field is pinned at zero (DB CHECK
                    vendor_package_item_options_default_is_free). */}
                <AmountInput
                  ariaLabel="Extra cost of this option"
                  centavos={o.price_delta_centavos}
                  disabled={o.is_default}
                  className="w-32"
                  onChange={(c) =>
                    onPatchOption(item.ref, o.ref, { price_delta_centavos: c })
                  }
                />
                <label className="flex min-h-11 shrink-0 items-center gap-1 text-sm text-[color:var(--m-slate-2)]">
                  <input
                    type="checkbox"
                    disabled={o.is_default}
                    checked={o.is_available}
                    onChange={(e) =>
                      onPatchOption(item.ref, o.ref, { is_available: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-[color:var(--m-line)] text-terracotta"
                  />
                  On
                </label>
                <ActionButton
                  tone="neutral"
                  quiet
                  icon={CornerDownRight}
                  label="Ask something else"
                  onClick={() => onAddFollowUp(item.ref, o.ref)} className="!h-11" />
                {item.options.length > 2 ? (
                  <ActionButton
                    tone="danger"
                    quiet
                    iconOnly
                    icon={Trash2}
                    label="Remove this option"
                    onClick={() => onRemoveOption(item.ref, o.ref)} className="!h-11 !w-11" />
                ) : null}
                {problemsFor(item.ref, o.ref).map((p) => (
                  <span key={p.code} className="basis-full text-sm text-danger-700">
                    {p.message}
                  </span>
                ))}
              </li>
            ))}
          </ul>

          <ActionButton tone="neutral" quiet icon={Plus} label="Add another option" onClick={() => onAddOption(item.ref)} className="!h-11" />

          {/* PICK-N. Both bounds or neither — the DB refuses a half-set pair
              (vendor_package_items_pick_range_ck), so the toggle writes and
              clears them together rather than offering two fields that can
              disagree. */}
          <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={pickN}
              onChange={(e) =>
                onPatch(item.ref,
                  e.target.checked
                    ? { pickMin: 1, pickMax: Math.min(2, item.options.length) }
                    : { pickMin: null, pickMax: null },
                )
              }
              className="h-4 w-4 rounded border-[color:var(--m-line)] text-terracotta"
            />
            Let them pick more than one
          </label>
          {pickN ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink">
              <span>Pick at least</span>
              <input
                aria-label="Smallest number of picks"
                type="number"
                min={1}
                step={1}
                className={`${field} w-20 tabular-nums`}
                value={item.pickMin ?? 1}
                onChange={(e) =>
                  onPatch(item.ref, {
                    pickMin: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  })
                }
              />
              <span>and at most</span>
              <input
                aria-label="Largest number of picks"
                type="number"
                min={1}
                step={1}
                className={`${field} w-20 tabular-nums`}
                value={item.pickMax ?? 1}
                onChange={(e) =>
                  onPatch(item.ref, {
                    pickMax: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                  })
                }
              />
              <span>of {formatCount(item.options.length)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {problemsFor(item.ref).map((p) => (
        <p key={p.code} className="mt-2 text-sm text-danger-700">
          {p.message}
        </p>
      ))}
    </li>
  );
}

/**
 * The amount-only money field: a STATIC `+₱` prefix that is never part of the
 * value, and live thousands-grouping as the vendor types (`80000` → `80,000`).
 *
 * A zero shows nothing at all — a blank, never the word "included" (owner
 * 2026-07-28: the word read as comes-regardless-of-the-pick). Prose typed into
 * the field still parses to 0, never to a stray number.
 */
function AmountInput({
  ariaLabel,
  centavos,
  onChange,
  disabled = false,
  className = '',
}: {
  ariaLabel: string;
  centavos: number;
  onChange: (centavos: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <span className={`relative inline-flex items-center ${className || 'w-full'}`}>
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 text-sm font-bold tabular-nums text-[color:var(--m-slate-3)]"
      >
        {AMOUNT_PREFIX}
      </span>
      <input
        aria-label={ariaLabel}
        inputMode="numeric"
        disabled={disabled}
        className={`${field} pl-11 font-bold tabular-nums disabled:opacity-50`}
        value={formatAmountInput(centavos)}
        placeholder={INCLUDED_PLACEHOLDER}
        // `parseAmountInput` strips everything that is not a digit, so the
        // grouping commas it rendered a moment ago round-trip cleanly and a
        // pasted "₱80,000" reads as 80,000 rather than as 80.
        onChange={(e) => onChange(parseAmountInput(e.target.value))}
      />
    </span>
  );
}
