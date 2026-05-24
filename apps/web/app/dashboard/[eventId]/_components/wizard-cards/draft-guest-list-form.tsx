'use client';

/**
 * Card 4b · Draft VIP Guest List · client form.
 *
 * 2026-05-24 owner directive · Step 2 spec verbatim:
 *
 *   TOTAL GUEST LIST [total: real time]
 *   Enter Bride's Name, [First] [Last]  (only if not yet added)
 *   Enter Groom's Name [First] [Last]   (only if not yet added)
 *   Best Man [First] [Last]             (only if not yet added)
 *   Maid of Honor [First] [Last]        (only if not yet added)
 *   Continue Adding
 *   [First] [Last]  (Quick Add List pattern · Enter chains rows)
 *   [Save List]
 *
 * The four VIP roles only render when the event doesn't already have
 * that role on file (the spec says "only if not yet added"). Bride and
 * groom are singleton (DB-enforced via partial unique indexes). Best
 * man and maid of honor surface here as ONE input each for the first
 * draft pass — hosts add multiple best men / matrons of honor via the
 * full Guests editor later.
 *
 * Keyboard flow matches QuickAddList from /guests/quick (the spec's
 * "use the Quick Add List on Concept as well") · First → Enter → Last
 * → Enter → next row finalized. The VIP scaffold inputs share the
 * same chain so the host can tab/Enter from Bride First → Bride Last
 * → Groom First → ... → first Continue Adding row without leaving
 * the keyboard.
 *
 * Settles via completeDraftGuestListTask · in_flight if the scaffold
 * isn't complete yet, completed once bride + groom + ≥1 entourage land.
 */

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import {
  CheckCircle2,
  Heart,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import {
  completeDraftGuestListTask,
  type DraftGuestListResult,
} from '../../wizard-actions';

type VipRole = 'bride' | 'groom' | 'best_man' | 'maid_of_honor';

type VipScaffoldRow = {
  role: VipRole;
  label: string;
  firstName: string;
  lastName: string;
};

type ExtraGuest = { firstName: string; lastName: string };

type Props = {
  eventId: string;
  /** Roles already saved against this event · hides the matching scaffold row. */
  filledRoles: ReadonlyArray<VipRole>;
  /** Live guest count read at server-render time · the local total adds the
   *  in-flight VIP scaffold + Continue Adding rows on top so the host sees
   *  the real-time future state. */
  initialTotal: number;
};

const SCAFFOLD_DEFINITIONS: ReadonlyArray<{ role: VipRole; label: string }> = [
  { role: 'bride', label: "Bride's name" },
  { role: 'groom', label: "Groom's name" },
  { role: 'best_man', label: 'Best Man' },
  { role: 'maid_of_honor', label: 'Maid of Honor' },
];

export function DraftGuestListForm({ eventId, filledRoles, initialTotal }: Props) {
  const filledSet = new Set(filledRoles);
  const scaffoldSeeded: VipScaffoldRow[] = SCAFFOLD_DEFINITIONS.filter(
    (def) => !filledSet.has(def.role),
  ).map((def) => ({ ...def, firstName: '', lastName: '' }));

  const [scaffold, setScaffold] = useState<VipScaffoldRow[]>(scaffoldSeeded);
  const [extras, setExtras] = useState<ExtraGuest[]>([]);
  const [extraFirst, setExtraFirst] = useState('');
  const [extraLast, setExtraLast] = useState('');
  const [editingExtra, setEditingExtra] = useState<number | null>(null);
  const [result, setResult] = useState<DraftGuestListResult | null>(null);

  // The keyboard chain walks: scaffold[0].first → scaffold[0].last →
  // scaffold[1].first → ... → extras-first → extras-last → finalize → loop.
  // We keep one ref array per field for tab/Enter focus management.
  const firstRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastRefs = useRef<Array<HTMLInputElement | null>>([]);
  const extraFirstRef = useRef<HTMLInputElement | null>(null);
  const extraLastRef = useRef<HTMLInputElement | null>(null);
  const editRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    // Focus the first available scaffold input on mount · if every
    // scaffold role is already on file, jump straight to Continue Adding.
    if (scaffold.length > 0) {
      firstRefs.current[0]?.focus();
    } else {
      extraFirstRef.current?.focus();
    }
    // Intentional · we only want this on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real-time total ──────────────────────────────────────────────────
  const pendingScaffoldCount = scaffold.filter(
    (row) => row.firstName.trim().length > 0 || row.lastName.trim().length > 0,
  ).length;
  const pendingExtraCount = extras.length;
  const liveDraft =
    extraFirst.trim().length > 0 || extraLast.trim().length > 0 ? 1 : 0;
  const totalLive = initialTotal + pendingScaffoldCount + pendingExtraCount + liveDraft;

  // ── Scaffold row helpers ─────────────────────────────────────────────
  function updateScaffold(idx: number, patch: Partial<VipScaffoldRow>) {
    setScaffold((prev) => {
      const next = [...prev];
      const existing = next[idx];
      if (!existing) return prev;
      next[idx] = { ...existing, ...patch };
      return next;
    });
  }

  function focusNextAfterScaffoldLast(idx: number) {
    const nextIdx = idx + 1;
    if (nextIdx < scaffold.length) {
      firstRefs.current[nextIdx]?.focus();
    } else {
      extraFirstRef.current?.focus();
    }
  }

  function onScaffoldFirstKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    lastRefs.current[idx]?.focus();
  }

  function onScaffoldLastKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    idx: number,
  ) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    focusNextAfterScaffoldLast(idx);
  }

  // ── Continue Adding · QuickAddList pattern ───────────────────────────
  function finalizeExtraRow(): boolean {
    const f = extraFirst.trim();
    const l = extraLast.trim();
    if (!f && !l) return false;
    setExtras((prev) => [...prev, { firstName: f, lastName: l }]);
    setExtraFirst('');
    setExtraLast('');
    queueMicrotask(() => extraFirstRef.current?.focus());
    return true;
  }

  function onExtraFirstKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (extraFirst.trim().length === 0) {
      // Spec · "once we arrive at the last, press enter and it saves it"
      // Empty Enter on First Name = submit the whole form.
      document.getElementById('draft-guest-list-submit')?.click();
      return;
    }
    extraLastRef.current?.focus();
  }

  function onExtraLastKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    finalizeExtraRow();
  }

  function commitExtraEdit(i: number, raw: string) {
    setExtras((prev) => {
      const next = [...prev];
      const parts = raw.trim().split(/\s+/);
      const f = parts[0] ?? '';
      const l = parts.slice(1).join(' ');
      next[i] = { firstName: f, lastName: l };
      return next;
    });
    setEditingExtra(null);
  }

  function removeExtraAt(i: number) {
    setExtras((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Submission ───────────────────────────────────────────────────────
  // Serialize vips + guests as hidden JSON fields so the server action
  // gets one stable payload shape regardless of how many VIP roles are
  // surfaced (varies by event state) and how many Continue-Adding rows
  // the host typed (0..N).
  const vipsPayload = scaffold
    .filter(
      (row) => row.firstName.trim().length > 0 || row.lastName.trim().length > 0,
    )
    .map((row) => ({
      role: row.role,
      firstName: row.firstName.trim(),
      lastName: row.lastName.trim(),
    }));
  const guestsPayload = extras.map((g) => ({
    firstName: g.firstName,
    lastName: g.lastName,
  }));

  const hasAnything = vipsPayload.length > 0 || guestsPayload.length > 0;

  async function handleAction(formData: FormData) {
    // Patch in the live extras row so a name half-typed when the host
    // hits Save isn't silently dropped · matches QuickAddList pattern.
    if (extraFirst.trim() || extraLast.trim()) {
      const extrasWithLive = [
        ...guestsPayload,
        { firstName: extraFirst.trim(), lastName: extraLast.trim() },
      ];
      formData.set('guests', JSON.stringify(extrasWithLive));
    } else {
      formData.set('guests', JSON.stringify(guestsPayload));
    }
    formData.set('vips', JSON.stringify(vipsPayload));
    formData.set('event_id', eventId);
    const res = await completeDraftGuestListTask(formData);
    setResult(res);
    if (res.ok) {
      // Wipe the live row + extras so the form clears for the next pass.
      // Scaffold stays seeded because revalidatePath re-fetches the
      // server component which re-derives filledRoles.
      setExtraFirst('');
      setExtraLast('');
      setExtras([]);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────
  const scaffoldIcon = (role: VipRole) => {
    if (role === 'bride' || role === 'groom') {
      return <Heart aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />;
    }
    return <Sparkles aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />;
  };

  return (
    <form action={handleAction} className="space-y-6">
      {/* TOTAL GUEST LIST · real-time counter */}
      <div className="flex items-center justify-between rounded-xl border border-terracotta/30 bg-cream/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            Total guest list
          </span>
        </div>
        <span className="font-display text-2xl italic text-ink">
          {totalLive}
        </span>
      </div>

      {/* VIP scaffold · one input row per role not yet on file */}
      {scaffold.length > 0 ? (
        <div className="space-y-3">
          {scaffold.map((row, idx) => (
            <div
              key={row.role}
              className="rounded-lg border border-ink/10 bg-white px-3 py-3"
            >
              <div className="mb-2 flex items-center gap-2">
                {scaffoldIcon(row.role)}
                <span className="text-sm font-medium text-ink">{row.label}</span>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  ref={(el) => {
                    firstRefs.current[idx] = el;
                  }}
                  type="text"
                  value={row.firstName}
                  onChange={(e) => updateScaffold(idx, { firstName: e.target.value })}
                  onKeyDown={(e) => onScaffoldFirstKeyDown(e, idx)}
                  placeholder="First name"
                  aria-label={`${row.label} first name`}
                  autoComplete="off"
                  className="input-field flex-1"
                />
                <input
                  ref={(el) => {
                    lastRefs.current[idx] = el;
                  }}
                  type="text"
                  value={row.lastName}
                  onChange={(e) => updateScaffold(idx, { lastName: e.target.value })}
                  onKeyDown={(e) => onScaffoldLastKeyDown(e, idx)}
                  placeholder="Last name (optional)"
                  aria-label={`${row.label} last name`}
                  autoComplete="off"
                  className="input-field flex-1"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-emerald-300/60 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-900">
          Bride · groom · best man · maid of honor are all on your guest list
          already. Add the rest below.
        </p>
      )}

      {/* Continue Adding · QuickAddList pattern */}
      <div>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
          Continue adding
        </p>

        {extras.length > 0 ? (
          <ul className="mb-3 space-y-2">
            {extras.map((g, i) => {
              const fullName = [g.firstName, g.lastName].filter(Boolean).join(' ').trim();
              const isEditing = editingExtra === i;
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-emerald-300/60 bg-emerald-50/40 px-3 py-2"
                >
                  <CheckCircle2
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-emerald-700"
                    strokeWidth={2}
                  />
                  {isEditing ? (
                    <input
                      ref={(el) => {
                        editRefs.current[i] = el;
                      }}
                      defaultValue={fullName}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          commitExtraEdit(i, (e.target as HTMLInputElement).value);
                        } else if (e.key === 'Escape') {
                          setEditingExtra(null);
                        }
                      }}
                      onBlur={(e) => commitExtraEdit(i, e.currentTarget.value)}
                      className="flex-1 rounded-md border border-emerald-300 bg-white px-2 py-1 text-sm font-medium text-ink focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                      aria-label={`Edit guest ${i + 1}`}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingExtra(i)}
                      className="flex-1 cursor-text text-left text-sm font-medium text-emerald-950 hover:text-emerald-700"
                      aria-label={`Edit ${fullName || 'guest ' + (i + 1)}`}
                    >
                      {fullName || (
                        <span className="italic text-emerald-700/70">(no name)</span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingExtra((curr) => (curr === i ? null : i))}
                    aria-label={`Toggle edit for guest ${i + 1}`}
                    className="rounded p-1 text-emerald-800/60 hover:bg-emerald-100 hover:text-emerald-900"
                  >
                    <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeExtraAt(i)}
                    aria-label={`Remove guest ${i + 1}`}
                    className="rounded p-1 text-emerald-800/60 hover:bg-rose-100 hover:text-rose-700"
                  >
                    <X className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="rounded-xl border border-terracotta/40 bg-cream p-3 ring-1 ring-terracotta/10">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-terracotta">
            New guest · row {extras.length + 1}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              ref={extraFirstRef}
              type="text"
              value={extraFirst}
              onChange={(e) => setExtraFirst(e.target.value)}
              onKeyDown={onExtraFirstKeyDown}
              placeholder="First name"
              aria-label="First name"
              autoComplete="off"
              className="input-field flex-1"
            />
            <input
              ref={extraLastRef}
              type="text"
              value={extraLast}
              onChange={(e) => setExtraLast(e.target.value)}
              onKeyDown={onExtraLastKeyDown}
              placeholder="Last name (optional)"
              aria-label="Last name"
              autoComplete="off"
              className="input-field flex-1"
            />
          </div>
          <p className="mt-2 text-xs text-ink/55">
            <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[10px]">
              Enter
            </kbd>{' '}
            jumps first &rarr; last, then finalizes the row.{' '}
            {extras.length > 0 ? (
              <>
                Press{' '}
                <kbd className="rounded bg-ink/10 px-1.5 py-0.5 font-mono text-[10px]">
                  Enter
                </kbd>{' '}
                on an empty first name to save the list.
              </>
            ) : (
              <>Add as many guests as you need, then press Save list below.</>
            )}
          </p>
        </div>
      </div>

      {/* Result toast · last submission outcome */}
      {result && result.ok ? (
        <p className="rounded-lg border border-emerald-300/60 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-900">
          Saved {result.addedVips} VIP{result.addedVips === 1 ? '' : 's'} and{' '}
          {result.addedGuests} guest{result.addedGuests === 1 ? '' : 's'}.
          {result.skipped > 0 ? (
            <>
              {' '}
              Skipped {result.skipped} row{result.skipped === 1 ? '' : 's'} already
              on file.
            </>
          ) : null}
        </p>
      ) : null}
      {result && !result.ok ? (
        <p className="rounded-lg border border-rose-300/60 bg-rose-50/60 px-3 py-2 text-sm text-rose-900">
          {result.error === 'empty'
            ? 'Type at least one name before saving.'
            : `Couldn’t save: ${result.error}`}
        </p>
      ) : null}

      {/* Save list */}
      <div className="flex items-center justify-between gap-3 border-t border-ink/10 pt-4">
        <p className="text-sm text-ink/60">
          {hasAnything || extraFirst.trim() || extraLast.trim() ? (
            <>Your additions save into the canonical guest list.</>
          ) : (
            <>Type at least one name to enable Save list.</>
          )}
        </p>
        <SaveButton
          hasContent={
            hasAnything ||
            extraFirst.trim().length > 0 ||
            extraLast.trim().length > 0
          }
        />
      </div>
    </form>
  );
}

function SaveButton({ hasContent }: { hasContent: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      id="draft-guest-list-submit"
      type="submit"
      disabled={pending || !hasContent}
      aria-busy={pending}
      className="button-primary inline-flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2.25} />
          Saving…
        </>
      ) : (
        <>
          <Save className="h-4 w-4" strokeWidth={1.75} />
          Save list
        </>
      )}
    </button>
  );
}
