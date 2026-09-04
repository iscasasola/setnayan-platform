'use client';

/**
 * Section 02 — "Define" — the palette, ported from atelier-board.html's
 * `#palette`. Live derivation: change a major at 00 (`<MajorsEditor>`) and
 * every untouched role here re-derives immediately, on the palette-style
 * engine (`lib/palette-styles.ts` via `lib/mood-board-derive.ts`).
 *
 * FOUR GROUPS, matching `PALETTE_LIMITS[key].family` (mood-board.ts) plus
 * room dressing as its own group (that field lives outside the PaletteKey
 * machinery entirely — see `resolveRoomDressing`):
 *   Venue    — Ceremony (editable, derived) + the Reception MIRROR
 *              (read-only — the majors are edited at 00 only, see
 *              `<ReceptionMirror>` below and the one-directional rule).
 *   Couple   — Bride, Groom.
 *   Roles    — every other derivable role, in SIX-RANK VISIBILITY ORDER
 *              (`DERIVABLE_ROLES_IN_RANK_ORDER`, lib/mood-board-derive.ts —
 *              read from the engine's own `VISIBILITY_RANK`, never a
 *              hand-copied order) — couple → family → principal sponsors
 *              (+ Nikah principals) → best man & maid of honor / bridesmaids
 *              / groomsmen / wedding party → secondary sponsors & bearers →
 *              guests. Officiants (never derived) sits at the end.
 *   Room dressing — linens / chairs / florals / lighting warmth. Reuses the
 *              existing `resolveRoomDressing` derivation (the live 3D room's
 *              own resolver) unchanged — MB5 does not touch what the room
 *              already renders from, only how the couple edits its
 *              override.
 *
 * `visibleKeys` narrows the Roles group to families the guest list actually
 * has (unchanged contract from the pre-MB5 `<PaletteEditor>`) plus a
 * muslim_principals addition — the engine already ranks it (rank 3, same as
 * principal_sponsors) and production's taxonomy already carries it; the
 * atelier-board.html demo simply never modeled a Nikah wedding. Extending
 * the richer, already-shipped taxonomy rather than the simpler demo.
 */

import { Plus, X } from 'lucide-react';
import {
  MAX_CUSTOM_ROLES,
  MAX_CUSTOM_ROLE_COLORS,
  MAX_CUSTOM_ROLE_LABEL_LENGTH,
  PALETTE_LIMITS,
  slugifyCustomRoleKey,
  type PaletteKey,
  type RoomDressing,
} from '@/lib/mood-board';
import { nearestColorName } from '@/lib/color-names';
import { boardReduced, DERIVABLE_ROLES_IN_RANK_ORDER } from '@/lib/mood-board-derive';
import type { PaletteStyle } from '@/lib/palette-styles';
import { usePaletteBoard } from './palette-board-context';
import { SwatchPopover } from './swatch-popover';

const PALETTE_STYLES: ReadonlyArray<{ key: PaletteStyle; label: string; gloss: string }> = [
  { key: 'simple', label: 'Our colours only', gloss: 'Everyone wears the colours you picked.' },
  { key: 'depth', label: 'Softer room, richer people', gloss: 'Same colours; the room steps back.' },
  { key: 'complex', label: 'Room and people', gloss: 'The room keeps your theme; the party gets its own colour.' },
];

const ROOM_DRESSING_META: ReadonlyArray<{ field: keyof RoomDressing; label: string; hint: string }> = [
  { field: 'linens', label: 'Linens', hint: 'Tablecloths & runners' },
  { field: 'chairs', label: 'Chairs', hint: 'Chair covers & finish' },
  { field: 'florals', label: 'Florals', hint: 'Centerpiece & arch blooms' },
  { field: 'lighting_warmth', label: 'Lighting warmth', hint: 'Ambient wash' },
];

type Props = {
  visibleKeys: PaletteKey[];
  /** The reception venue's display label ("Beach", "Garden Estate", …),
   *  already resolved by the caller (`VENUE_SETTING_LABEL`, MB6). Shown
   *  READ-ONLY in the Venue group — the Reception designer (Seat Plan lab)
   *  and 04's "Make it real" already read this same fact; 02 only reflects
   *  it, never re-asks it. Undefined when it can't be honestly asserted
   *  (unrecognised or never-chosen `venue_setting`). */
  venueLabel?: string;
};

export function PaletteSection({ visibleKeys, venueLabel }: Props) {
  const board = usePaletteBoard();
  if (!board) return null;

  const visible = new Set(visibleKeys);
  const roleKeys = DERIVABLE_ROLES_IN_RANK_ORDER.filter((k) => visible.has(k));
  const hasCeremony = visible.has('ceremony');
  const reduced = boardReduced(board.derived);

  return (
    <div className="space-y-5">
      {reduced ? (
        <p className="rounded-lg border border-warn-400/40 bg-warn-50 px-3 py-2 text-xs text-warn-900">
          Your colours all sit very close in tone — the roles below can only repeat them, so
          outfits won’t stand apart until a deeper colour joins.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink/10 bg-cream p-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/50">
          Palette style
        </span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Palette style">
          {PALETTE_STYLES.map((s) => (
            <button
              key={s.key}
              type="button"
              aria-pressed={board.style === s.key}
              onClick={() => board.setStyle(s.key)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                board.style === s.key
                  ? 'border-terracotta bg-terracotta/10 text-terracotta-700'
                  : 'border-ink/15 text-ink/65 hover:border-terracotta/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <span className="w-full text-xs text-ink/55 sm:w-auto">
          {PALETTE_STYLES.find((s) => s.key === board.style)?.gloss}
        </span>
      </div>

      <PaletteGroup
        title="Venue"
        note={
          venueLabel
            ? `Reception venue — ${venueLabel} · from your event, correct it on Details if it's wrong`
            : undefined
        }
      >
        {hasCeremony ? <RoleCard paletteKey="ceremony" label={PALETTE_LIMITS.ceremony.label} /> : null}
        <ReceptionMirror />
      </PaletteGroup>

      <PaletteGroup title="Couple">
        {visible.has('bride') ? <RoleCard paletteKey="bride" label={PALETTE_LIMITS.bride.label} /> : null}
        {visible.has('groom') ? <RoleCard paletteKey="groom" label={PALETTE_LIMITS.groom.label} /> : null}
      </PaletteGroup>

      {roleKeys.length > 0 ? (
        <PaletteGroup title="Wedding party, family & sponsors" defaultOpen={false}>
          {roleKeys.map((k) => (
            <RoleCard key={k} paletteKey={k} label={PALETTE_LIMITS[k].label} />
          ))}
        </PaletteGroup>
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-cream p-4 text-xs text-ink/55">
          Add guests with roles (sponsors, bearers, officiants, wedding party) and their palette
          sections will appear here.
        </p>
      )}

      <PaletteGroup title="Room dressing" defaultOpen={false}>
        <div className="grid gap-3 sm:grid-cols-2">
          {ROOM_DRESSING_META.map(({ field, label, hint }) => {
            const overridden = board.roomDressingOverride[field] != null;
            const value = board.roomDressing[field];
            return (
              <div key={field} className="flex items-center gap-3 rounded-lg border border-ink/10 bg-white p-3">
                <input
                  type="color"
                  aria-label={`${label} color — ${value}`}
                  title={value}
                  value={value}
                  onChange={(e) => board.setRoomDressing(field, e.target.value)}
                  className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-ink/10 p-0.5"
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{label}</span>
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] ${
                        overridden ? 'bg-terracotta/10 text-terracotta-700' : 'bg-ink/5 text-ink/50'
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
                    onClick={() => board.resetRoomDressing(field)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-ink/55 hover:bg-ink/5 hover:text-terracotta"
                  >
                    Use derived
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </PaletteGroup>

      <CustomRolesEditor />
    </div>
  );
}

function PaletteGroup({
  title,
  note,
  defaultOpen = true,
  children,
}: {
  title: string;
  /** A read-only line under the title, above the group's cards — e.g. the
   *  couple's own reception venue (MB6), reflected here, never a second
   *  place to change it. Absent = nothing renders. */
  note?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-xl border border-ink/10 bg-white" open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
        {title}
      </summary>
      <div className="space-y-3 border-t border-ink/10 p-4">
        {note ? <p className="text-xs text-ink/55">{note}</p> : null}
        {children}
      </div>
    </details>
  );
}

/**
 * The Reception row in 02's Venue group — a READ-ONLY reflection of the five
 * majors on the 00 theme card. Plain `<span>` swatches, no `<SwatchPopover>`,
 * no click handler: so no picker, copy, paste, or swap machinery can attach
 * to it — the one-directional rule enforced by construction here, and by
 * `mood-board-board-ops.ts`'s own guards underneath.
 */
function ReceptionMirror() {
  const board = usePaletteBoard()!;
  const colors = board.palette.reception ?? [];
  return (
    <section className="space-y-2 rounded-xl border border-ink/10 bg-cream p-4">
      {colors.length > 0 ? (
        <div className="flex flex-wrap gap-1.5" aria-hidden="true">
          {colors.map((hex, i) => (
            <span key={i} className="h-8 w-8 rounded-md border border-ink/10" style={{ background: hex }} />
          ))}
        </div>
      ) : null}
      <div className="space-y-1">
        <p className="text-sm font-semibold text-ink">
          Reception{' '}
          <span className="rounded-full bg-terracotta/10 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.15em] text-terracotta-700">
            your main colours
          </span>
        </p>
        <p className="text-xs text-ink/55">
          {colors.length > 0
            ? 'Your main colours — every role here follows them.'
            : 'Your main colours — none picked yet.'}{' '}
          They’re set at the top, in Your theme.
        </p>
        <a href="#theme" className="inline-block text-xs font-medium text-terracotta hover:underline">
          ↑ Edit at 00 — Your theme
        </a>
      </div>
    </section>
  );
}

function RoleCard({ paletteKey, label }: { paletteKey: PaletteKey; label: string }) {
  const board = usePaletteBoard()!;
  const limits = PALETTE_LIMITS[paletteKey];
  const colors = board.colorsFor(paletteKey);
  const touched = board.isTouched(paletteKey);
  const canRemove = colors.length > 0;
  const atMax = colors.length >= limits.max;
  const isOfficiants = paletteKey === 'officiants';

  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0 space-y-0.5">
          <h3 className="text-sm font-semibold text-ink">
            {label}
            {touched ? (
              <span
                className="ml-1.5 rounded-full bg-ink/5 px-1.5 py-0.5 align-middle font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55"
                title="Set by you — a change to your main colours won’t touch it"
              >
                yours
              </span>
            ) : null}
          </h3>
          {isOfficiants ? (
            <p className="text-xs text-ink/55">
              Follows the church’s own calendar — not set by your theme.
            </p>
          ) : (
            <p className="text-xs text-ink/55">{limits.hint}</p>
          )}
        </div>
      </header>

      {colors.length === 0 ? (
        <button
          type="button"
          onClick={() => board.addRoleColor(paletteKey)}
          aria-label={`Pick a ${label} colour`}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-ink/25 text-ink/35 transition hover:border-terracotta hover:text-terracotta"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      ) : (
        <ul className="flex flex-wrap items-end gap-2">
          {colors.map((hex, i) => (
            <li key={`${paletteKey}-${i}`} className="flex flex-col items-stretch gap-1">
              {limits.slotLabels?.[i] ? (
                <span className="font-mono text-[9px] uppercase tracking-[0.15em] text-ink/55">
                  {limits.slotLabels[i]}
                </span>
              ) : null}
              <SwatchPopover
                paletteKey={paletteKey}
                index={i}
                hex={hex}
                slotLabel={limits.slotLabels?.[i] ?? label}
                onChange={(h) => board.setRoleColor(paletteKey, i, h)}
                onRemove={canRemove ? () => board.removeRoleColor(paletteKey, i) : undefined}
                removeLabel={`Remove ${nearestColorName(hex) ?? hex} from ${label}`}
                interactive={{ enabled: true }}
              />
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => board.addRoleColor(paletteKey)}
              disabled={atMax}
              aria-label={`Add another ${label} colour`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-ink/20 text-ink/50 transition hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </li>
        </ul>
      )}

      {touched ? (
        <button
          type="button"
          onClick={() => board.releaseRole(paletteKey)}
          title={`Let ${label} follow your five main colours again`}
          className="text-xs font-medium text-ink/60 underline underline-offset-2 hover:text-terracotta"
        >
          ↺ Match my main colours
        </button>
      ) : null}
    </section>
  );
}

function CustomRolesEditor() {
  const board = usePaletteBoard()!;
  const roles = board.customRoles;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Custom roles</h2>
        <p className="text-xs text-ink/55">
          Anyone or anything the fixed list above doesn&rsquo;t cover — a ring bearer&rsquo;s dog, a
          family pet, a specific relative. Give it a name and its own colors.
        </p>
      </div>

      {roles.length > 0 ? (
        <div className="space-y-4">
          {roles.map((role, index) => (
            <section key={index} className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <input
                  type="text"
                  value={role.label}
                  onChange={(e) => board.updateCustomRoleLabel(index, e.target.value.slice(0, MAX_CUSTOM_ROLE_LABEL_LENGTH))}
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
                  onClick={() => board.removeCustomRole(index)}
                  aria-label={`Remove custom role ${role.label || index + 1}`}
                  className="shrink-0 rounded-md p-1.5 text-ink/40 hover:bg-ink/5 hover:text-danger-700"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </header>

              <ul className="flex flex-wrap items-end gap-2">
                {role.colors.map((c, ci) => (
                  <li key={ci} className="flex flex-col items-stretch gap-1">
                    <div className="flex items-center gap-1.5 rounded-lg border border-ink/10 bg-cream p-1.5 pr-1.5">
                      <input
                        type="color"
                        aria-label={`${role.label || 'Custom role'} color ${ci + 1} — ${c}`}
                        title={c}
                        value={c}
                        onChange={(e) => board.updateCustomRoleColor(index, ci, e.target.value)}
                        className="h-9 w-9 cursor-pointer rounded-md border border-ink/10 bg-cream p-0.5"
                      />
                      <button
                        type="button"
                        onClick={() => board.removeCustomRoleColor(index, ci)}
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
                    onClick={() => board.addCustomRoleColor(index)}
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
        onClick={() => board.addCustomRole()}
        disabled={roles.length >= MAX_CUSTOM_ROLES}
        className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ink/20 px-3 py-2 text-xs font-medium text-ink/65 transition-colors hover:border-terracotta hover:text-terracotta disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} />
        Add a custom role
      </button>

      <div aria-live="polite" className="text-xs text-ink/55">
        {board.saveStatus === 'saving'
          ? 'Saving…'
          : board.saveStatus === 'saved'
            ? 'Saved'
            : board.saveStatus === 'error'
              ? 'Could not save — try again.'
              : ''}
      </div>
    </div>
  );
}
