'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  groupDisplayOptions,
  isCanonicalService,
  type ServiceGroupOption,
  type VendorCategory,
} from '@/lib/vendors';

type Props = {
  name: string;
  initial: string[];
  /**
   * Optional DISPLAY labels keyed by the enum category key, sourced live from
   * the admin taxonomy (see labelForVendorCategory). Cosmetic only — the
   * checkbox VALUE stays the enum key. Any missing key falls back to the in-code
   * VENDOR_CATEGORY_LABEL, so omitting the prop renders exactly as before.
   */
  labels?: Record<string, string>;
  /**
   * Optional EXTRA canonical leaves to offer beyond the 30 coarse
   * VENDOR_CATEGORIES (e.g. the Chinese tradition/specialty leaves
   * `date_fengshui_consultant`, `chinese_lauriat_caterer`, …). Each entry's
   * `key` is a real canonical_service leaf stored VERBATIM in
   * vendor_profiles.services[] (the same opaque string the /explore marketplace
   * matches via `.contains('services', [key])`); `label` is the public
   * marketplace display copy.
   *
   * When empty/absent, NOTHING about this picker changes — the extra group
   * isn't rendered and the customs computation is identical to before, so
   * non-Chinese / legacy vendor flows stay byte-identical. The list is
   * DB-driven (sourced from the taxonomy by the parent page), never hardcoded
   * here.
   */
  extraCanonicals?: { key: string; label: string }[];
  /**
   * Fired with the new selection whenever it changes (toggle / add / remove
   * custom) — NOT on mount. Optional; lets a parent detect "dirty" for the
   * auto-save inline editor. The hidden input stays the source of truth for
   * plain <form> submissions, so omitting this keeps every prior caller
   * byte-identical.
   */
  onChange?: (services: string[]) => void;
};

const MAX_SERVICES = 24;
const MAX_CUSTOM_LEN = 48;

export function ServicesPicker({ name, initial, labels, extraCanonicals, onChange }: Props) {
  const [selected, setSelected] = useState<string[]>(() => initial);
  const [customDraft, setCustomDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Notify the parent of selection changes (never on mount) so an inline
  // auto-save editor can mark itself dirty on any toggle/add/remove.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    onChangeRef.current?.(selected);
  }, [selected]);

  // The set of EXTRA canonical leaf keys offered in this render. These count as
  // canonical (NOT custom) for the chip-vs-checkbox split below, so a ticked
  // leaf renders as a checkbox in its group rather than leaking into the custom
  // pills. Empty when the prop is absent → behavior identical to before.
  const extraCanonicalKeys = useMemo(
    () => new Set((extraCanonicals ?? []).map((c) => c.key)),
    [extraCanonicals],
  );
  const isAnyCanonical = (s: string) =>
    isCanonicalService(s) || extraCanonicalKeys.has(s);

  const customs = useMemo(
    () => selected.filter((s) => !isAnyCanonical(s)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selected, extraCanonicalKeys],
  );

  const isAtMax = selected.length >= MAX_SERVICES;

  const toggle = (key: string) => {
    setError(null);
    setSelected((current) => {
      if (current.includes(key)) {
        return current.filter((x) => x !== key);
      }
      if (current.length >= MAX_SERVICES) {
        setError(`At most ${MAX_SERVICES} services. Remove one to add another.`);
        return current;
      }
      return [...current, key];
    });
  };

  // Toggle a COLLAPSED option (one or more legacy keys that share a label).
  // On = add the primary key; off = clear every folded key (so a legacy row's
  // secondary key like `videographer` is removed too).
  const toggleOption = (opt: ServiceGroupOption) => {
    setError(null);
    setSelected((current) => {
      const anyOn = opt.keys.some((k) => current.includes(k));
      if (anyOn) {
        const keySet = new Set<string>(opt.keys);
        return current.filter((x) => !keySet.has(x));
      }
      if (current.length >= MAX_SERVICES) {
        setError(`At most ${MAX_SERVICES} services. Remove one to add another.`);
        return current;
      }
      return [...current, opt.primaryKey];
    });
  };

  const addCustom = () => {
    const t = customDraft.trim();
    if (t.length === 0) return;
    if (t.length > MAX_CUSTOM_LEN) {
      setError(`Custom service must be ≤ ${MAX_CUSTOM_LEN} chars.`);
      return;
    }
    if (selected.length >= MAX_SERVICES) {
      setError(`At most ${MAX_SERVICES} services. Remove one to add another.`);
      return;
    }
    if (isAnyCanonical(t)) {
      // If they typed a canonical key (coarse category OR an offered extra
      // leaf), toggle it instead of storing it as free-text custom.
      if (!selected.includes(t)) setSelected((s) => [...s, t]);
      setCustomDraft('');
      return;
    }
    // Reject duplicates (case-insensitive).
    if (selected.some((s) => s.toLowerCase() === t.toLowerCase())) {
      setError('Already added.');
      return;
    }
    setSelected((s) => [...s, t]);
    setCustomDraft('');
    setError(null);
  };

  const removeCustom = (label: string) => {
    setSelected((s) => s.filter((x) => x !== label));
  };

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(selected)} />

      <p className="text-xs text-ink/55">
        {selected.length} of {MAX_SERVICES} selected
        {customs.length > 0 ? ` · ${customs.length} custom` : ''}
      </p>

      <fieldset className="space-y-3">
        <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Standard categories
        </legend>
        <div className="space-y-3 rounded-xl border border-ink/10 bg-cream p-3">
          {SERVICE_GROUPS.map((group) => {
            // Collapse legacy keys that share a taxonomy label (e.g.
            // photographer + videographer → one "Photo & Video" checkbox).
            const options = groupDisplayOptions(
              group.members,
              (cat: VendorCategory) => labels?.[cat] ?? VENDOR_CATEGORY_LABEL[cat],
            );
            const checkedInGroup = options.filter((o) =>
              o.keys.some((k) => selected.includes(k)),
            ).length;
            return (
              <div key={group.key} className="space-y-1.5">
                <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  <span>{group.label}</span>
                  {checkedInGroup > 0 ? (
                    <span className="text-terracotta-700">
                      {checkedInGroup} / {options.length}
                    </span>
                  ) : null}
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                  {options.map((opt) => {
                    const checked = opt.keys.some((k) => selected.includes(k));
                    return (
                      <label
                        key={opt.primaryKey}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          checked
                            ? 'bg-terracotta/10 text-terracotta-700'
                            : 'text-ink/75 hover:bg-ink/[0.04]'
                        } ${!checked && isAtMax ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleOption(opt)}
                          disabled={!checked && isAtMax}
                          className="h-4 w-4 cursor-pointer accent-terracotta disabled:cursor-not-allowed"
                        />
                        <span>{opt.label}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

      {extraCanonicals && extraCanonicals.length > 0 ? (
        <fieldset className="space-y-2">
          <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            Tradition &amp; specialty services
          </legend>
          <div className="grid grid-cols-1 gap-1 rounded-xl border border-ink/10 bg-cream p-3 sm:grid-cols-2 md:grid-cols-3">
            {extraCanonicals.map((c) => {
              const checked = selected.includes(c.key);
              return (
                <label
                  key={c.key}
                  className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                    checked
                      ? 'bg-terracotta/10 text-terracotta-700'
                      : 'text-ink/75 hover:bg-ink/[0.04]'
                  } ${!checked && isAtMax ? 'opacity-50' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(c.key)}
                    disabled={!checked && isAtMax}
                    className="h-4 w-4 cursor-pointer accent-terracotta disabled:cursor-not-allowed"
                  />
                  <span>{c.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <fieldset className="space-y-2">
        <legend className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
          Custom services
        </legend>
        <div className="flex flex-col gap-2 rounded-xl border border-ink/10 bg-cream p-3">
          {customs.length > 0 ? (
            <ul className="flex flex-wrap gap-2">
              {customs.map((c) => (
                <li
                  key={c}
                  className="inline-flex items-center gap-1 rounded-full bg-terracotta/10 px-2.5 py-1 text-xs text-terracotta-700"
                >
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() => removeCustom(c)}
                    aria-label={`Remove ${c}`}
                    className="rounded-md p-0.5 text-terracotta-700 hover:bg-terracotta/20"
                  >
                    <X className="h-3 w-3" strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              value={customDraft}
              onChange={(e) => setCustomDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustom();
                }
              }}
              maxLength={MAX_CUSTOM_LEN}
              placeholder="e.g. Vintage car rental"
              disabled={isAtMax}
              className="input-field h-10 flex-1 text-sm"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={isAtMax || customDraft.trim().length === 0}
              className="inline-flex h-10 items-center justify-center gap-1 rounded-md bg-ink/5 px-3 text-sm font-medium text-ink/70 hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
              Add
            </button>
          </div>
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-xs text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
