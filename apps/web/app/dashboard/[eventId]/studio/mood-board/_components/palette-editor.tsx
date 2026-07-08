'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  PALETTE_LIMITS,
  PALETTE_ORDER,
  DEFAULT_PALETTE_SUGGESTIONS,
  resolveRoomDressing,
  type PaletteKey,
  type RolePalette,
  type RoomDressing,
} from '@/lib/mood-board';

// The four advanced room-dressing surfaces + their copy. Each is DERIVED from
// the reception palette by default; a field becomes a stored override only when
// the couple picks a custom color.
const ROOM_DRESSING_META: ReadonlyArray<{
  field: keyof RoomDressing;
  label: string;
  hint: string;
}> = [
  { field: 'linens', label: 'Linens', hint: 'Tablecloths & runners' },
  { field: 'chairs', label: 'Chairs', hint: 'Chair covers & finish' },
  { field: 'florals', label: 'Florals', hint: 'Centerpiece & arch blooms' },
  { field: 'lighting_warmth', label: 'Lighting warmth', hint: 'Ambient wash' },
];

type Props = {
  eventId: string;
  initial: RolePalette;
  visibleKeys: PaletteKey[];
  saveAction: (formData: FormData) => Promise<void>;
  /** True when `initial` is a draft seeded from the couple's onboarding feel
   *  (not their saved palette) — surfaces a "suggested, not yet saved" hint. */
  seeded?: boolean;
};

export function PaletteEditor({ eventId, initial, visibleKeys, saveAction, seeded }: Props) {
  const visibleSet = new Set(visibleKeys);
  const inView = (key: PaletteKey) => visibleSet.has(key);

  const [palette, setPalette] = useState<RolePalette>(() =>
    Object.fromEntries(
      PALETTE_ORDER.map((k) => [k, initial[k] ?? []]),
    ) as RolePalette,
  );
  // Room-dressing overrides live outside the PaletteKey grid — only overridden
  // fields are stored; the rest stay derived from the reception palette.
  const [roomDressing, setRoomDressing] = useState<RoomDressing>(
    () => initial.room_dressing ?? {},
  );
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Live derived values (ignoring any override) so the panel can preview what a
  // field would be by default and offer a "use derived" reset.
  const derivedDressing = useMemo(
    () => resolveRoomDressing({ reception: palette.reception }),
    [palette.reception],
  );

  const setDressing = (field: keyof RoomDressing, color: string) =>
    setRoomDressing((p) => ({ ...p, [field]: color.toUpperCase() }));

  const resetDressing = (field: keyof RoomDressing) =>
    setRoomDressing((p) => {
      const next = { ...p };
      delete next[field];
      return next;
    });

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
    // Fold the room-dressing overrides back into the payload; only include the
    // block when the couple actually set at least one field (empty → omitted, so
    // sanitize drops it and the room stays fully reception-derived).
    const payload: RolePalette = { ...palette };
    if (Object.keys(roomDressing).length > 0) payload.room_dressing = roomDressing;
    formData.set('palette_json', JSON.stringify(payload));
    startTransition(async () => {
      await saveAction(formData);
      setSavedAt(new Date().toISOString());
    });
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="event_id" value={eventId} />

      {seeded ? (
        <p className="rounded-lg border border-terracotta/25 bg-terracotta/[0.06] px-3 py-2 text-sm text-ink/75">
          Starting colours from your wedding feel — tweak them, then{' '}
          <span className="font-medium">Save palette</span> to keep. Nothing is
          saved until you do.
        </p>
      ) : null}

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

      <details className="group rounded-xl border border-ink/10 bg-cream">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 p-4">
          <div className="min-w-0 space-y-0.5">
            <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
              Advanced · Room dressing
            </h2>
            <p className="text-xs text-ink/55">
              Fine-tune linens, chairs, florals, and lighting. Each follows your
              reception palette until you set a custom color.
            </p>
          </div>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45 group-open:hidden">
            Show
          </span>
          <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45 group-open:inline">
            Hide
          </span>
        </summary>
        <div className="grid gap-3 border-t border-ink/10 p-4 sm:grid-cols-2">
          {ROOM_DRESSING_META.map(({ field, label, hint }) => {
            const overridden = roomDressing[field] != null;
            const value = roomDressing[field] ?? derivedDressing[field];
            return (
              <div
                key={field}
                className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3"
              >
                <input
                  type="color"
                  aria-label={`${label} color — ${value}`}
                  title={value}
                  value={value}
                  onChange={(e) => setDressing(field, e.target.value)}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-ink/10 p-0.5"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
                        overridden
                          ? 'bg-terracotta/10 text-terracotta-700'
                          : 'bg-ink/5 text-ink/50'
                      }`}
                    >
                      {overridden ? 'Custom' : 'Derived'}
                    </span>
                  </div>
                  <p className="text-xs text-ink/55">{hint}</p>
                </div>
                {overridden ? (
                  <button
                    type="button"
                    onClick={() => resetDressing(field)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:bg-ink/5 hover:text-terracotta"
                  >
                    Use derived
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-ink/55">
          {totals.configured} of {PALETTE_ORDER.length} groups configured
          {totals.belowMin > 0
            ? ` · ${totals.belowMin} below suggested minimum`
            : null}
        </div>
        <div className="flex items-center gap-3">
          {savedAt ? (
            <span className="inline-flex items-center gap-1 text-xs text-success-700">
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
                      ? 'bg-warn-100 text-warn-900'
                      : colors.length === 0
                        ? 'bg-ink/5 text-ink/50'
                        : 'bg-success-100 text-success-800'
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
                        className="rounded-md p-1 text-ink/40 hover:bg-ink/5 hover:text-danger-700"
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
                <p className="inline-flex items-center gap-1 text-xs text-warn-900">
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
