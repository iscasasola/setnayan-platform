'use client';

import { useMemo, useState, useTransition } from 'react';
import { Plus, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  PALETTE_LIMITS,
  PALETTE_ORDER,
  DEFAULT_PALETTE_SUGGESTIONS,
  MAX_CUSTOM_ROLES,
  MAX_CUSTOM_ROLE_COLORS,
  MAX_CUSTOM_ROLE_LABEL_LENGTH,
  resolveRoomDressing,
  slugifyCustomRoleKey,
  type CustomPaletteRole,
  type PaletteKey,
  type RolePalette,
  type RoomDressing,
} from '@/lib/mood-board';
import { progressiveReceptionSuggestion } from '@/lib/palette-recommender';

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
   *  (not their saved palette) — surfaces a "suggested, not yet saved" hint.
   *  ⚠ DORMANT since MB3 (2026-09-03): the page-level auto-seed this hint
   *  described was retired (see page.tsx's blank-start fork comment) because
   *  it silently pre-filled colors nobody had chosen. No caller currently
   *  passes `true`. Left in place — not deleted — for a future explicit,
   *  dismissible "Setnayan AI suggests a starting palette" affordance
   *  (MB4/MB5), which is a legitimate, different use of the same hint. */
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
  // Couple-authored roles beyond the fixed taxonomy (e.g. "Ring bearer's
  // dog"). The `key` re-derives from the label on save (sanitizeRolePalette),
  // so what's kept here client-side is only a display/edit convenience.
  const [customRoles, setCustomRoles] = useState<CustomPaletteRole[]>(
    () => initial.custom_roles ?? [],
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
      // Setnayan AI takes over the reception ("majors") suggestion the
      // moment the couple has actually started choosing colours —
      // progressiveReceptionSuggestion returns undefined (falls through to
      // the static default below) until then, per hasChosenMajors. Every
      // other palette key is unchanged — this session's scope is the
      // majors, where the "create-your-own" fork actually lives.
      const next =
        (key === 'reception' ? progressiveReceptionSuggestion(arr) : undefined) ??
        suggestions[arr.length % suggestions.length] ??
        '#C97B4B';
      return { ...p, [key]: [...arr, next.toUpperCase()] };
    });
  };

  const removeColor = (key: PaletteKey, index: number) => {
    setPalette((p) => ({
      ...p,
      [key]: (p[key] ?? []).filter((_, i) => i !== index),
    }));
  };

  const addCustomRole = () => {
    setCustomRoles((rs) => {
      if (rs.length >= MAX_CUSTOM_ROLES) return rs;
      return [...rs, { key: '', label: '', colors: ['#C97B4B'] }];
    });
  };

  const removeCustomRole = (index: number) => {
    setCustomRoles((rs) => rs.filter((_, i) => i !== index));
  };

  const updateCustomRoleLabel = (index: number, label: string) => {
    setCustomRoles((rs) =>
      rs.map((r, i) =>
        i === index ? { ...r, label: label.slice(0, MAX_CUSTOM_ROLE_LABEL_LENGTH) } : r,
      ),
    );
  };

  const addCustomRoleColor = (index: number) => {
    setCustomRoles((rs) =>
      rs.map((r, i) => {
        if (i !== index || r.colors.length >= MAX_CUSTOM_ROLE_COLORS) return r;
        return { ...r, colors: [...r.colors, '#C97B4B'] };
      }),
    );
  };

  const updateCustomRoleColor = (index: number, colorIndex: number, color: string) => {
    setCustomRoles((rs) =>
      rs.map((r, i) => {
        if (i !== index) return r;
        const colors = [...r.colors];
        colors[colorIndex] = color.toUpperCase();
        return { ...r, colors };
      }),
    );
  };

  const removeCustomRoleColor = (index: number, colorIndex: number) => {
    setCustomRoles((rs) =>
      rs.map((r, i) =>
        i === index ? { ...r, colors: r.colors.filter((_, ci) => ci !== colorIndex) } : r,
      ),
    );
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
    if (customRoles.length > 0) payload.custom_roles = customRoles;
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
        // Reception is the couple's five "majors" — the whole board's source
        // of truth (see hasChosenMajors, lib/mood-board.ts). MB3 (2026-09-03)
        // retired the page-level auto-seed that used to pre-fill this with
        // real colors from the couple's onboarding "feel" before they'd
        // chosen anything — the owner's correction: "it is a requirement to
        // have at least 3. but start with blank." STARTER_SLOTS renders that
        // structural minimum as genuinely EMPTY placeholders (nothing to
        // remove, nothing pre-chosen) rather than three colors that look
        // decided. Scoped to `reception` only — every other family renders
        // exactly as before.
        starterSlots={{ reception: PALETTE_LIMITS.reception.min }}
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

      <div className="space-y-3">
        <div>
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Custom roles
          </h2>
          <p className="text-xs text-ink/55">
            Anyone or anything the fixed list above doesn&rsquo;t cover — a ring bearer&rsquo;s
            dog, a family pet, a specific relative. Give it a name and its own colors.
          </p>
        </div>

        {customRoles.length > 0 ? (
          <div className="space-y-4">
            {customRoles.map((role, index) => (
              <section
                key={index}
                className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4"
              >
                <header className="flex flex-wrap items-center justify-between gap-2">
                  <input
                    type="text"
                    value={role.label}
                    onChange={(e) => updateCustomRoleLabel(index, e.target.value)}
                    placeholder="e.g. Ring bearer's dog"
                    maxLength={MAX_CUSTOM_ROLE_LABEL_LENGTH}
                    className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-3 py-1.5 text-sm font-medium text-ink placeholder:text-ink/35 focus:border-terracotta focus:outline-none"
                  />
                  {role.label.trim() ? (
                    <span className="hidden font-mono text-[10px] uppercase tracking-[0.1em] text-ink/35 sm:inline">
                      {slugifyCustomRoleKey(role.label)}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeCustomRole(index)}
                    aria-label={`Remove custom role ${role.label || index + 1}`}
                    className="shrink-0 rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-danger-700"
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </header>

                <ul className="flex flex-wrap items-end gap-2">
                  {role.colors.map((c, ci) => (
                    <li
                      key={ci}
                      className="group relative flex flex-col items-stretch gap-1"
                    >
                      <div className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-1.5 pr-1.5">
                        <input
                          type="color"
                          aria-label={`${role.label || 'Custom role'} color ${ci + 1} — ${c}`}
                          title={c}
                          value={c}
                          onChange={(e) => updateCustomRoleColor(index, ci, e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded-md border border-ink/10 bg-cream p-0.5"
                        />
                        <button
                          type="button"
                          onClick={() => removeCustomRoleColor(index, ci)}
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
                      onClick={() => addCustomRoleColor(index)}
                      disabled={role.colors.length >= MAX_CUSTOM_ROLE_COLORS}
                      className="inline-flex h-12 items-center gap-1 rounded-lg border border-dashed border-ink/20 px-3 text-xs font-medium text-ink/65 transition-colors hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                      Add color
                    </button>
                  </li>
                </ul>
              </section>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          onClick={addCustomRole}
          disabled={customRoles.length >= MAX_CUSTOM_ROLES}
          className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink/20 px-3 py-2 text-xs font-medium text-ink/65 transition-colors hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add a custom role
        </button>
      </div>

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
  starterSlots,
  onUpdate,
  onAdd,
  onRemove,
}: {
  title: string;
  keys: PaletteKey[];
  palette: RolePalette;
  emptyHint?: string;
  /** Per-key structural minimum rendered as EMPTY placeholder slots when the
   *  couple hasn't filled them yet — see the "reception" caller above. Keys
   *  with no entry here behave exactly as before (a single trailing "+ Add
   *  color" once any colors exist). */
  starterSlots?: Partial<Record<PaletteKey, number>>;
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
          // Empty starter slots: rendered ONLY up to the structural minimum,
          // and ONLY while the couple hasn't filled that many yet. Once
          // colors.length reaches the starter count, these disappear for
          // good in favor of the normal trailing "+ Add color" — there is no
          // going back to a placeholder once a real slot has been added.
          const starterCount = starterSlots?.[key] ?? 0;
          const emptyStarterSlots = Math.max(0, starterCount - colors.length);

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

                {/* Empty starter slots — a colour nobody has chosen yet.
                    Nothing to remove, so no × at all: "an empty slot ...
                    carries no × at all — no control that cannot act." */}
                {emptyStarterSlots > 0
                  ? Array.from({ length: emptyStarterSlots }).map((_, i) => {
                      const slotIndex = colors.length + i;
                      return (
                        <li
                          key={`${key}-empty-${slotIndex}`}
                          className="flex flex-col items-stretch gap-1"
                        >
                          {limits.slotLabels?.[slotIndex] ? (
                            <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/40">
                              {limits.slotLabels[slotIndex]}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => onAdd(key)}
                            aria-label={`Add ${limits.label} color ${slotIndex + 1} — not yet chosen`}
                            className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-ink/25 text-ink/35 transition hover:border-terracotta hover:text-terracotta"
                          >
                            <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                          </button>
                        </li>
                      );
                    })
                  : (
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
                    )}
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
