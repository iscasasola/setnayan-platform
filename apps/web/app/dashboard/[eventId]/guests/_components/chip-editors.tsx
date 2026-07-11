'use client';

/**
 * chip-editors.tsx — the inline SIDE / RSVP / ROLE / ADD-TO-GROUP editors for a
 * Living Roster row (P2). Clicking a chip on a guest row no longer means the
 * bulk bar or a trip to the `[guestId]` detail page: it opens a small anchored
 * popover (the P1 `Popover` primitive), applies the change through the P1
 * optimistic overlay so the row flips instantly, calls the matching single-guest
 * server action (`inline-actions.ts`), and drops a 6s undo snackbar — the exact
 * apply → server → reconcile → undo shape P1 established for delete.
 *
 * COMPOSITION: the row passes its existing pill visual (`<SidePill/>`,
 * `<RsvpPill/>`, `<RoleChips/>`) as `children`; this file owns only the trigger
 * button, the popover panel, and the optimistic-edit wiring — so the chip atoms
 * stay defined once in `guest-list-multiselect.tsx` (no circular import, and the
 * recursion-sensitive `RoleChip` vs `RoleChips` split is untouched).
 *
 * LOCKED chips: the bride & groom are the event foundation — always Attending,
 * never bulk-role-assigned (owner 2026-06-03) — so their RSVP and Role chips
 * render as plain, non-interactive pills here (side stays editable).
 */

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Popover } from './overlay-primitives';
import { guestOptimistic } from './guest-optimistic-store';
import { pushUndo } from './undo-toast';
import { useToast } from '@/app/_components/toast/toast-provider';
import {
  ROLE_LABELS,
  RSVP_LABELS,
  SIDE_LABELS,
  guestDisplayName,
  type GuestGroupWithCount,
  type GuestRole,
  type GuestRow,
  type GuestSide,
  type RsvpStatus,
} from '@/lib/guests';
import type { GuestFieldOverride } from '@/lib/guest-optimistic';
import type { RoleSection } from './guest-list-multiselect';
import {
  addGuestToGroup,
  setGuestRole,
  setGuestRsvp,
  setGuestSide,
} from '../inline-actions';
import { quickCreateGroup } from '../quick-add-actions';

type EditResult = { ok: boolean; error?: string };

/**
 * The shared apply → server → undo flow for a single-field chip edit, mirroring
 * `OptimisticDeleteButton` (P1): patch the overlay now, run the server action,
 * roll back + toast on failure, and on success offer a 6s undo that re-applies
 * the prior value both optimistically and on the server. Each caller passes a
 * concrete `GuestFieldOverride` literal so the overlay patch stays type-sound.
 */
function useFieldEdit(guestId: string) {
  const toast = useToast();
  const [, startTransition] = useTransition();

  return function commit({
    override,
    priorOverride,
    label,
    run,
    undoRun,
    settledOverride,
  }: {
    override: GuestFieldOverride;
    priorOverride: GuestFieldOverride;
    label: string;
    run: () => Promise<EditResult>;
    undoRun: () => Promise<EditResult>;
    /** When the server may coerce the value (bride/groom RSVP), return the
     *  settled override so reconcile-by-id can prune it; null = no re-key. */
    settledOverride?: (res: EditResult) => GuestFieldOverride | null;
  }) {
    const forward = { kind: 'setField' as const, guestIds: [guestId], override };

    guestOptimistic.apply(forward);
    startTransition(async () => {
      let res: EditResult;
      try {
        res = await run();
      } catch {
        guestOptimistic.clear(forward);
        toast.error('Could not save — check your connection and try again.');
        return;
      }
      if (!res.ok) {
        guestOptimistic.clear(forward);
        toast.error(res.error ?? 'Could not save that change.');
        return;
      }
      const settled = settledOverride?.(res);
      if (settled) {
        guestOptimistic.clear(forward);
        guestOptimistic.apply({ kind: 'setField', guestIds: [guestId], override: settled });
      }

      pushUndo({
        label,
        undo: async () => {
          const back = { kind: 'setField' as const, guestIds: [guestId], override: priorOverride };
          guestOptimistic.apply(back);
          const r = await undoRun();
          if (!r.ok) {
            guestOptimistic.clear(back);
            toast.error('Could not undo — refresh and try again.');
          }
        },
      });
    });
  };
}

// ── popover atoms ─────────────────────────────────────────────────────────────

function OptionRow({
  onClick,
  active,
  swatch,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  swatch?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
        active ? 'bg-terracotta/10 font-medium text-terracotta-700' : 'text-ink/80 hover:bg-ink/[0.04]'
      }`}
    >
      {swatch ? (
        <span aria-hidden className={`h-2.5 w-2.5 shrink-0 rounded-full ${swatch}`} />
      ) : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

/** A chip rendered as an editable trigger button, wrapping the row's pill. */
function ChipTrigger({
  triggerRef,
  onOpen,
  label,
  children,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onOpen: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={onOpen}
      aria-haspopup="menu"
      aria-label={label}
      className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
    >
      {children}
    </button>
  );
}

// ── Side ─────────────────────────────────────────────────────────────────────

const SIDE_OPTIONS: { value: GuestSide; swatch: string }[] = [
  { value: 'bride', swatch: 'bg-danger-400' },
  { value: 'groom', swatch: 'bg-sky-500' },
  { value: 'both', swatch: 'bg-warn-400' },
];

export function SideChipEditor({
  eventId,
  guest,
  children,
}: {
  eventId: string;
  guest: GuestRow;
  children: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const commit = useFieldEdit(guest.guest_id);
  const name = guestDisplayName(guest);

  const pick = (value: GuestSide) => {
    setOpen(false);
    if (value === guest.side) return;
    commit({
      override: { side: value },
      priorOverride: { side: guest.side },
      label: `${name} → ${SIDE_LABELS[value]}`,
      run: () => setGuestSide(eventId, guest.guest_id, value),
      undoRun: () => setGuestSide(eventId, guest.guest_id, guest.side),
    });
  };

  return (
    <>
      <ChipTrigger triggerRef={ref} onOpen={() => setOpen(true)} label={`Change ${name}’s side`}>
        {children}
      </ChipTrigger>
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} width={180}>
          {SIDE_OPTIONS.map((o) => (
            <OptionRow
              key={o.value}
              onClick={() => pick(o.value)}
              active={guest.side === o.value}
              swatch={o.swatch}
            >
              {SIDE_LABELS[o.value]}
            </OptionRow>
          ))}
        </Popover>
      ) : null}
    </>
  );
}

// ── RSVP ─────────────────────────────────────────────────────────────────────

const RSVP_OPTIONS: RsvpStatus[] = ['attending', 'pending', 'declined', 'maybe'];
// One-tap mobile cycle (prototype RSVP_NEXT, :283) — skips 'maybe' (reachable
// via the desktop popover).
const RSVP_CYCLE: Record<RsvpStatus, RsvpStatus> = {
  attending: 'pending',
  pending: 'declined',
  declined: 'attending',
  maybe: 'attending',
};

/** True when this guest's RSVP is locked to Attending (the couple). */
function rsvpLocked(guest: GuestRow): boolean {
  return guest.role === 'bride' || guest.role === 'groom';
}

export function RsvpChipEditor({
  eventId,
  guest,
  children,
  mobileCycle = false,
}: {
  eventId: string;
  guest: GuestRow;
  children: ReactNode;
  /** Mobile one-tap: clicking advances attending→pending→declined→attending. */
  mobileCycle?: boolean;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const commit = useFieldEdit(guest.guest_id);
  const name = guestDisplayName(guest);

  // Couple RSVP is locked — render the plain pill, no interaction.
  if (rsvpLocked(guest)) return <>{children}</>;

  const pick = (value: RsvpStatus) => {
    setOpen(false);
    if (value === guest.rsvp_status) return;
    commit({
      override: { rsvp_status: value },
      priorOverride: { rsvp_status: guest.rsvp_status },
      label: `${name} · ${RSVP_LABELS[value]}`,
      run: () => setGuestRsvp(eventId, guest.guest_id, value),
      undoRun: () => setGuestRsvp(eventId, guest.guest_id, guest.rsvp_status),
      settledOverride: (res) => {
        const eff = (res as { effective?: RsvpStatus }).effective;
        return eff && eff !== value ? { rsvp_status: eff } : null;
      },
    });
  };

  if (mobileCycle) {
    return (
      <button
        type="button"
        onClick={() => pick(RSVP_CYCLE[guest.rsvp_status])}
        aria-label={`Advance ${name}’s RSVP`}
        className="inline-flex rounded-full outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
      >
        {children}
      </button>
    );
  }

  return (
    <>
      <ChipTrigger triggerRef={ref} onOpen={() => setOpen(true)} label={`Change ${name}’s RSVP`}>
        {children}
      </ChipTrigger>
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} width={180}>
          {RSVP_OPTIONS.map((s) => (
            <OptionRow key={s} onClick={() => pick(s)} active={guest.rsvp_status === s}>
              {RSVP_LABELS[s]}
            </OptionRow>
          ))}
        </Popover>
      ) : null}
    </>
  );
}

// ── Role ─────────────────────────────────────────────────────────────────────

export function RoleChipEditor({
  eventId,
  guest,
  children,
  roleSections,
}: {
  eventId: string;
  guest: GuestRow;
  children: ReactNode;
  roleSections: RoleSection[];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const commit = useFieldEdit(guest.guest_id);
  const name = guestDisplayName(guest);

  // Bride/groom aren't a bulk-assignable role (owner 2026-06-03) — plain chips.
  if (guest.role === 'bride' || guest.role === 'groom') return <>{children}</>;

  const pick = (value: GuestRole) => {
    setOpen(false);
    if (value === guest.role) return;
    commit({
      override: { role: value },
      priorOverride: { role: guest.role },
      label: `${name} → ${ROLE_LABELS[value]}`,
      run: () => setGuestRole(eventId, guest.guest_id, value),
      undoRun: () => setGuestRole(eventId, guest.guest_id, guest.role),
    });
  };

  return (
    <>
      <ChipTrigger triggerRef={ref} onOpen={() => setOpen(true)} label={`Change ${name}’s role`}>
        {children}
      </ChipTrigger>
      {open ? (
        <Popover anchorRef={ref} onClose={() => setOpen(false)} width={230}>
          <div className="max-h-72 overflow-y-auto">
            {roleSections.map((sec) => (
              <div key={sec.label} className="mb-1 last:mb-0">
                <p className="px-2.5 pb-0.5 pt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
                  {sec.label}
                </p>
                {sec.roles.map((r) => (
                  <OptionRow key={r} onClick={() => pick(r)} active={guest.role === r}>
                    {ROLE_LABELS[r]}
                  </OptionRow>
                ))}
              </div>
            ))}
          </div>
        </Popover>
      ) : null}
    </>
  );
}

// ── Add to group ─────────────────────────────────────────────────────────────

export function AddToGroupControl({
  eventId,
  guest,
  groups,
  memberGroupIds,
}: {
  eventId: string;
  guest: GuestRow;
  groups: GuestGroupWithCount[];
  memberGroupIds: string[];
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [, startTransition] = useTransition();
  const toast = useToast();
  const guestName = guestDisplayName(guest);

  const member = new Set(memberGroupIds);
  const available = groups.filter((g) => !member.has(g.group_id));

  const close = () => {
    setOpen(false);
    setCreating(false);
    setName('');
  };

  const add = (groupId: string) => {
    close();
    startTransition(async () => {
      const res = await addGuestToGroup(eventId, guest.guest_id, groupId);
      if (!res.ok) toast.error(res.error);
    });
  };

  const createAndAdd = () => {
    const label = name.trim();
    if (!label) return;
    close();
    startTransition(async () => {
      const made = await quickCreateGroup(eventId, label);
      if (!made.ok) {
        toast.error(made.error);
        return;
      }
      const res = await addGuestToGroup(eventId, guest.guest_id, made.group.group_id);
      if (!res.ok) toast.error(res.error);
    });
  };

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Add ${guestName} to a group`}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-ink/25 text-ink/45 outline-none hover:border-terracotta/50 hover:text-terracotta-700 focus-visible:ring-2 focus-visible:ring-terracotta"
      >
        <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {open ? (
        <Popover anchorRef={ref} onClose={close} width={220}>
          <p className="px-2.5 pb-1 pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-ink/40">
            Add to group
          </p>
          <div className="max-h-56 overflow-y-auto">
            {available.length > 0 ? (
              available.map((g) => (
                <OptionRow key={g.group_id} onClick={() => add(g.group_id)}>
                  {g.label}
                </OptionRow>
              ))
            ) : (
              <p className="px-2.5 py-1.5 text-xs text-ink/45">In every group already.</p>
            )}
          </div>
          {creating ? (
            <div className="mt-1 flex items-center gap-1 border-t border-ink/10 px-1.5 pt-1.5">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    createAndAdd();
                  }
                }}
                placeholder="New group name…"
                aria-label="New group name"
                className="min-w-0 flex-1 rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm outline-none focus:border-terracotta"
              />
              <button
                type="button"
                onClick={createAndAdd}
                aria-label="Create group and add"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-terracotta text-cream hover:bg-terracotta-700"
              >
                <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setName('');
                }}
                aria-label="Cancel new group"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-ink/50 hover:bg-ink/5"
              >
                <X aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-1 flex w-full items-center gap-2 border-t border-ink/10 px-2.5 py-1.5 text-left text-sm text-terracotta-700 hover:bg-terracotta/[0.06]"
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              New group…
            </button>
          )}
        </Popover>
      ) : null}
    </>
  );
}
