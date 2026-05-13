'use client';

import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import {
  SERVICE_GROUPS,
  VENDOR_CATEGORY_LABEL,
  isCanonicalService,
} from '@/lib/vendors';

type Props = {
  name: string;
  initial: string[];
};

const MAX_SERVICES = 24;
const MAX_CUSTOM_LEN = 48;

export function ServicesPicker({ name, initial }: Props) {
  const [selected, setSelected] = useState<string[]>(() => initial);
  const [customDraft, setCustomDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const customs = useMemo(() => selected.filter((s) => !isCanonicalService(s)), [selected]);

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
    if (isCanonicalService(t)) {
      // If they typed the canonical key, toggle it instead.
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
            const checkedInGroup = group.members.filter((m) => selected.includes(m)).length;
            return (
              <div key={group.key} className="space-y-1.5">
                <p className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                  <span>{group.label}</span>
                  {checkedInGroup > 0 ? (
                    <span className="text-terracotta-700">
                      {checkedInGroup} / {group.members.length}
                    </span>
                  ) : null}
                </p>
                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 md:grid-cols-3">
                  {group.members.map((cat) => {
                    const checked = selected.includes(cat);
                    return (
                      <label
                        key={cat}
                        className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                          checked
                            ? 'bg-terracotta/10 text-terracotta-700'
                            : 'text-ink/75 hover:bg-ink/[0.04]'
                        } ${!checked && isAtMax ? 'opacity-50' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(cat)}
                          disabled={!checked && isAtMax}
                          className="h-4 w-4 cursor-pointer accent-terracotta disabled:cursor-not-allowed"
                        />
                        <span>{VENDOR_CATEGORY_LABEL[cat]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </fieldset>

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
