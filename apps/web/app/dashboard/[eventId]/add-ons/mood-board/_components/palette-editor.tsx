'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  PALETTE_LIMITS,
  PALETTE_ORDER,
  DEFAULT_PALETTE_SUGGESTIONS,
  type PaletteKey,
  type RolePalette,
} from '@/lib/mood-board';

type Props = {
  eventId: string;
  initial: RolePalette;
  visibleKeys: PaletteKey[];
  saveAction: (formData: FormData) => Promise<void>;
};

export function PaletteEditor({ eventId, initial, visibleKeys, saveAction }: Props) {
  const visibleSet = new Set(visibleKeys);
  const inView = (key: PaletteKey) => visibleSet.has(key);

  const [palette, setPalette] = useState<RolePalette>(() =>
    Object.fromEntries(
      PALETTE_ORDER.map((k) => [k, initial[k] ?? []]),
    ) as RolePalette,
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const updateColor = (key: PaletteKey, index: number, color: string) => {
    setPalette((p) => {
      const arr = [...(p[key] ?? [])];
      arr[index] = color.toUpperCase();
      return { ...p, [key]: arr };
    });
  };

  const addColor = (key: PaletteKey) => {
    setPalette((p) => {
      const arr = p[key] ?? [];
      const max = PALETTE_LIMITS[key].max;
      if (arr.length >= max) return p;
      const suggestions = DEFAULT_PALETTE_SUGGESTIONS[key];
      const next = suggestions[arr.length % suggestions.length] ?? '#C97B4B';
      return { ...p, [key]: [...arr, next.toUpperCase()] };
    });
  };

  const removeColor = (key: PaletteKey, index: number) => {
    setPalette((p) => ({
      ...p,
      [key]: (p[key] ?? []).filter((_, i) => i !== index),
    }));
  };

  const totals = useMemo(() => {
    let belowMin = 0;
    let configured = 0;
    for (const k of PALETTE_ORDER) {
      const count = palette[k]?.length ?? 0;
      if (count > 0) configured += 1;
      if (count > 0 && count < PALETTE_LIMITS[k].min) belowMin += 1;
    }
    return { belowMin, configured };
  }, [palette]);

  const handleSubmit = (formData: FormData) => {
    formData.set('palette_json', JSON.stringify(palette));
    startTransition(async () => {
      await saveAction(formData);
      setSavedAt(new Date().toISOString());
    });
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="event_id" value={eventId} />

      <PaletteFamily
        title="Venue"
        keys={PALETTE_ORDER.filter(
          (k) => PALETTE_LIMITS[k].family === 'venue' && inView(k),
        )}
        palette={palette}
        onUpdate={updateColor}
        onAdd={addColor}
        onRemove={removeColor}
      />

      <PaletteFamily
        title="Couple"
        keys={PALETTE_ORDER.filter(
          (k) => PALETTE_LIMITS[k].family === 'couple' && inView(k),
        )}
        palette={palette}
        onUpdate={updateColor}
        onAdd={addColor}
        onRemove={removeColor}
      />

      <PaletteFamily
        title="Roles"
        emptyHint="Add guests with roles (sponsors, bearers, officiants, wedding party) and their palette sections will appear here."
        keys={PALETTE_ORDER.filter(
          (k) => PALETTE_LIMITS[k].family === 'role' && inView(k),
        )}
        palette={palette}
        onUpdate={updateColor}
        onAdd={addColor}
        onRemove={removeColor}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-ink/55">
          {totals.configured} of {PALETTE_ORDER.length} groups configured
          {totals.belowMin > 0
            ? ` · ${totals.belowMin} below suggested minimum`
            : null}
        </div>
        <div className="flex items-center gap-3">
          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              Saved {new Date(savedAt).toLocaleTimeString()}
            </span>
          ) : null}
          <button type="submit" disabled={pending} className="button-primary">
            {pending ? 'Saving…' : 'Save palette'}
          </button>
        </div>
      </div>
    </form>
  );
}

function PaletteFamily({
  title,
  keys,
  palette,
  emptyHint,
  onUpdate,
  onAdd,
  onRemove,
}: {
  title: string;
  keys: PaletteKey[];
  palette: RolePalette;
  emptyHint?: string;
  onUpdate: (key: PaletteKey, index: number, color: string) => void;
  onAdd: (key: PaletteKey) => void;
  onRemove: (key: PaletteKey, index: number) => void;
}) {
  if (keys.length === 0) {
    if (!emptyHint) return null;
    return (
      <div className="space-y-3">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          {title}
        </h2>
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-xs text-ink/55">
          {emptyHint}
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        {title}
      </h2>
      <div className="space-y-4">
        {keys.map((key) => {
          const limits = PALETTE_LIMITS[key];
          const colors = palette[key] ?? [];
          const atMax = colors.length >= limits.max;
          const belowMin = colors.length > 0 && colors.length < limits.min;

          return (
            <section
              key={key}
              className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="min-w-0 space-y-0.5">
                  <h3 className="text-sm font-semibold text-ink">{limits.label}</h3>
                  <p className="text-xs text-ink/55">{limits.hint}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${
                    belowMin
                      ? 'bg-amber-100 text-amber-900'
                      : colors.length === 0
                        ? 'bg-ink/5 text-ink/50'
                        : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {colors.length} / {limits.min}–{limits.max}
                </span>
              </header>

              <ul className="flex flex-wrap items-end gap-2">
                {colors.map((c, i) => (
                  <li
                    key={`${key}-${i}`}
                    className="group relative flex flex-col items-stretch gap-1"
                  >
                    {limits.slotLabels?.[i] ? (
                      <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                        {limits.slotLabels[i]}
                      </span>
                    ) : null}
                    <div className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-1.5 pr-1.5">
                      <input
                        type="color"
                        aria-label={`${limits.label} color ${i + 1} — ${c}`}
                        title={c}
                        value={c}
                        onChange={(e) => onUpdate(key, i, e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded-md border border-ink/10 bg-cream p-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => onRemove(key, i)}
                        aria-label={`Remove color ${c}`}
                        className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-rose-700"
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </li>
                ))}

                <li>
                  <button
                    type="button"
                    onClick={() => onAdd(key)}
                    disabled={atMax}
                    className="inline-flex h-12 items-center gap-1 rounded-lg border border-dashed border-ink/20 px-3 text-xs font-medium text-ink/65 transition-colors hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    Add color
                  </button>
                </li>
              </ul>

              {belowMin ? (
                <p className="inline-flex items-center gap-1 text-xs text-amber-900">
                  <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
                  Below the suggested minimum of {limits.min} — you can still save, but the
                  palette will feel sparse.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
