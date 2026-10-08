'use client';

import { useRoleNames } from './role-names-context';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Plus, UserCheck, UserRoundPen, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { GuestPopup } from './guest-popup';
import { plainRefusal } from './plain-refusal';
import { usePeekToast } from './use-peek-toast';
import { PickMenu } from '../../website/editor/_components/pick-menu';
import {
  guestRoleLabel,
  guestRolePickLabel,
  SIDE_LABELS,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import { resolveRoleSet } from '@/lib/role-sets';
import { SIDELESS_SIDE, eventHasSides } from '@/lib/guest-side-question';
import {
  quickAddGuest,
  quickCreateGroup,
  addRoleToGuest,
  setGuestPrimaryRole,
} from '../quick-add-actions';
import { parsePersonName } from '@/lib/person-name-parse';
import { findDuplicates, norm, TAG } from '@/lib/guest-dedupe';
import { SIDE_CONTROL_BORDER } from '@/lib/side-colors';

/* ------------------------------------------------------------------ */
/* Cross-component opener — one sheet, two triggers (desktop header    */
/* button + mobile FAB). A CustomEvent avoids context/portal plumbing. */
/* ------------------------------------------------------------------ */
const OPEN_EVENT = 'setnayan:quick-add-open';

/** Open this sheet from code (the add sheet's "Add another way" dropdown) — the
 *  SAME event the button below dispatches, so the name lives in one place. */
export function openQuickAdd(): void {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function OpenQuickAddButton({
  label = '+ Add guest',
  className = 'button-primary',
  ariaLabel,
}: {
  /** Text, or an icon when the button stands in a row of icons. */
  label?: React.ReactNode;
  className?: string;
  /** Required in practice when `label` is an icon — it is then the only name. */
  ariaLabel?: string;
} = {}) {
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
    >
      {label}
    </button>
  );
}

/* Duplicate detection (nickname + typo fuzzy match) lives in the shared
   `lib/guest-dedupe` module so the detailed /guests/new form reuses the
   exact same matcher — see imports above. ExistingGuest below carries the
   role/side fields this sheet's warning UI renders on top of the match. */

export type ExistingGuest = {
  guest_id: string;
  first_name: string;
  last_name: string;
  side: GuestSide;
  role: GuestRole;
  extra_roles: GuestRole[];
};

/* role dropdown order — mirrors new/actions.ts ROLE_VALUES */
// Iteration 0053 P2: the offered role list is per event type — resolved from
// the roleSetKey prop via resolveRoleSet (client-safe, pure). Wedding resolves
// to today's 24-role list, incl. bride/groom (quick-add offers them, unlike the
// filtered full form).

/* the Side picker carries its team colour on the control border — canonical
   side-colour map (lib/side-colors.ts · SIDE_CONTROL_BORDER): gold / info-slate
   / lighter gold */
const SIDE_BORDER = SIDE_CONTROL_BORDER;
const SIDE_SHORT: Record<GuestSide, string> = {
  bride: 'Bride',
  groom: 'Groom',
  both: 'Both',
};

type GroupOpt = { group_id: string; label: string };

export function QuickAddSheet({
  eventId,
  existingGuests,
  groups,
  roleSetKey = 'wedding',
}: {
  eventId: string;
  existingGuests: ExistingGuest[];
  groups: GroupOpt[];
  roleSetKey?: string | null;
}) {
  const router = useRouter();
  // Per-event-type offered roles (iteration 0053 P2). resolveRoleSet is a pure
  // client-safe lookup; the parent passes the event's roleSetKey string.
  const roleSet = resolveRoleSet(roleSetKey);
  const offeredRoles = roleSet.offeredRoles;
  /* Sides are a wedding idea. The role set already in hand names the side
     principals, so a birthday, a wake, a corporate event or a Simple Event is
     never asked — and the seed is the same value the sideless write path has
     always used, not 'bride'. Same decision as the full form
     (lib/guest-side-question.ts); one helper, so the two cannot drift. */
  const hasSides = eventHasSides(roleSet);
  const [open, setOpen] = useState(false);
  // The couple's own words for roles (owner 2026-09-30).
  const roleNames = useRoleNames();
  const [side, setSide] = useState<GuestSide>(hasSides ? 'bride' : SIDELESS_SIDE);
  const [role, setRole] = useState<GuestRole>('guest');
  const [groupId, setGroupId] = useState<string>('');
  // groups created during this session, surfaced in the picker right away
  const [localGroups, setLocalGroups] = useState<GroupOpt[]>([]);
  const [newGroupMode, setNewGroupMode] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [groupError, setGroupError] = useState<string | null>(null);
  const [isGroupPending, startGroupTransition] = useTransition();
  const [fn, setFn] = useState('');
  const [ln, setLn] = useState('');
  const [dupDismissed, setDupDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Guests added during this session, so back-to-back adds dedupe
  // against names that aren't in the server snapshot yet.
  const [addedLocal, setAddedLocal] = useState<ExistingGuest[]>([]);
  // role changes applied this session (add-role / change-role), keyed by
  // guest_id, so the resolver reflects them before router.refresh() lands
  const [roleOverrides, setRoleOverrides] = useState<
    Record<string, { role: GuestRole; extra_roles: GuestRole[] }>
  >({});
  const [toast, toastNode] = usePeekToast();
  const [isPending, startTransition] = useTransition();

  const fnRef = useRef<HTMLInputElement>(null);
  const lnRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);

  // existing groups + ones created this session (deduped by id), so a
  // just-created group shows in the picker before router.refresh() lands
  const allGroups = useMemo(() => {
    const seen = new Set<string>();
    const merged: GroupOpt[] = [];
    for (const g of [...groups, ...localGroups]) {
      if (seen.has(g.group_id)) continue;
      seen.add(g.group_id);
      merged.push(g);
    }
    return merged;
  }, [groups, localGroups]);

  // Merge the server snapshot with this session's just-added guests
  // (router.refresh() is async, so addedLocal covers the gap), deduped
  // by normalized name so the same guest never shows twice in a warning.
  const pool = useMemo(() => {
    const seen = new Set<string>();
    const merged: ExistingGuest[] = [];
    for (const g of [...existingGuests, ...addedLocal]) {
      const key = `${norm(g.first_name)}|${norm(g.last_name)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const ov = roleOverrides[g.guest_id];
      merged.push(ov ? { ...g, ...ov } : g);
    }
    return merged;
  }, [existingGuests, addedLocal, roleOverrides]);
  const dups = useMemo(
    () => (dupDismissed ? [] : findDuplicates(fn, ln, pool)),
    [fn, ln, pool, dupDismissed],
  );
  const dupActive = dups.length > 0;

  /* open via the desktop button + body scroll lock */
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);
  /* The page behind does not scroll, Escape closes and Tab stays in the panel — all `GuestPopup`'s (usePopupBehind). */
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => fnRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  /* The approved toast from the top (`usePeekToast`) — a result is the accent with a ✓; "Skipped" is a note. */
  const showToast = useCallback((msg: string) => toast.success(msg), [toast]);

  const clearNames = useCallback(() => {
    setFn('');
    setLn('');
    setDupDismissed(false);
    setError(null);
  }, []);

  const skipDuplicate = useCallback(() => {
    clearNames();
    toast.info('Skipped — already on your list');
    fnRef.current?.focus();
  }, [clearNames, toast]);

  const doSave = useCallback(
    (keepOpen: boolean) => {
      const f = fn.trim(),
        l = ln.trim();
      if (!f && !l) {
        if (keepOpen) fnRef.current?.focus();
        else setOpen(false);
        return;
      }
      setError(null);
      startTransition(async () => {
        // The host may type a whole name ("Atty. Bob Casasola Jr.") into the
        // First box — that is how the reported bug was produced. Re-parse the
        // two boxes as one line so a title never lands in first_name, while a
        // plain "Bob" + "Casasola" is returned unchanged by the parser.
        const parts = parsePersonName(`${f} ${l}`.trim());
        const res = await quickAddGuest(eventId, {
          first_name: parts.firstName || f,
          last_name: parts.lastName || l,
          name_prefix: parts.prefix || null,
          middle_name: parts.middleName || null,
          name_suffix: parts.suffix || null,
          side,
          role,
          group_id: groupId || null,
        });
        if (!res.ok) {
          setError(plainRefusal(res.error, 'Couldn’t save that. Try again.'));
          return;
        }
        // dedupe back-to-back rapid adds against the just-saved name
        setAddedLocal((prev) => [...prev, { ...res.guest, extra_roles: [] }]);
        clearNames();
        router.refresh();
        if (keepOpen) {
          showToast(`${res.guest.first_name} added`);
          setTimeout(() => fnRef.current?.focus(), 0);
        } else {
          setOpen(false);
        }
      });
    },
    [fn, ln, side, role, groupId, eventId, clearNames, router, showToast],
  );

  const forceAdd = useCallback(
    (keepOpen: boolean) => {
      setDupDismissed(true);
      // defer to next tick so dupActive recomputes; doSave doesn't read it
      doSave(keepOpen);
    },
    [doSave],
  );

  /* primary action (bottom button / Enter): skip when a dup is up */
  const primary = useCallback(
    (keepOpen: boolean) => {
      if (dupActive) skipDuplicate();
      else doSave(keepOpen);
    },
    [dupActive, skipDuplicate, doSave],
  );

  /* single [Done] button — save the current name (if any) then close.
     With a dup showing we don't add it; the dup box has its own
     "add as a different person" path, so Done just closes. */
  const done = useCallback(() => {
    if (dupActive) {
      setOpen(false);
      return;
    }
    doSave(false);
  }, [dupActive, doSave]);

  /* multi-role resolver — same name, different role. Give the existing
     guest the picked role TOO (extra_roles), or change their primary
     role to it. Either way we clear the names + keep the rapid loop. */
  const applyAddRole = useCallback(
    (g: ExistingGuest) => {
      setError(null);
      startTransition(async () => {
        const res = await addRoleToGuest(eventId, g.guest_id, role);
        if (!res.ok) {
          setError(plainRefusal(res.error, 'Couldn’t save that. Try again.'));
          return;
        }
        setRoleOverrides((prev) => ({
          ...prev,
          [g.guest_id]: { role: res.guest.role, extra_roles: res.guest.extra_roles },
        }));
        clearNames();
        router.refresh();
        showToast(`${g.first_name} is now also ${guestRoleLabel(role, roleNames)}`);
        setTimeout(() => fnRef.current?.focus(), 0);
      });
    },
    [eventId, role, roleNames, clearNames, router, showToast],
  );
  const applyChangeRole = useCallback(
    (g: ExistingGuest) => {
      setError(null);
      startTransition(async () => {
        const res = await setGuestPrimaryRole(eventId, g.guest_id, role);
        if (!res.ok) {
          setError(plainRefusal(res.error, 'Couldn’t save that. Try again.'));
          return;
        }
        setRoleOverrides((prev) => ({
          ...prev,
          [g.guest_id]: { role: res.guest.role, extra_roles: res.guest.extra_roles },
        }));
        clearNames();
        router.refresh();
        showToast(`${g.first_name} → ${guestRoleLabel(role, roleNames)}`);
        setTimeout(() => fnRef.current?.focus(), 0);
      });
    },
    [eventId, role, roleNames, clearNames, router, showToast],
  );

  /* resolver state for the TOP name match (dups are sorted best-first) */
  const target = dups[0]?.g ?? null;
  const targetRoles = target ? [target.role, ...target.extra_roles] : [];
  const pickedIsSingleton = role === 'bride' || role === 'groom';
  const targetHasPicked = targetRoles.includes(role);

  /* inline "create a new group" from the Group picker */
  const startNewGroup = useCallback(() => {
    setGroupError(null);
    setNewGroupName('');
    setNewGroupMode(true);
    setTimeout(() => groupRef.current?.focus(), 0);
  }, []);
  const cancelNewGroup = useCallback(() => {
    setNewGroupMode(false);
    setNewGroupName('');
    setGroupError(null);
  }, []);
  const createGroup = useCallback(() => {
    const label = newGroupName.trim();
    if (!label) {
      cancelNewGroup();
      return;
    }
    setGroupError(null);
    startGroupTransition(async () => {
      const res = await quickCreateGroup(eventId, label);
      if (!res.ok) {
        setGroupError(plainRefusal(res.error, 'Couldn’t make that group. Try again.'));
        return;
      }
      setLocalGroups((prev) =>
        prev.some((g) => g.group_id === res.group.group_id)
          ? prev
          : [...prev, { group_id: res.group.group_id, label: res.group.label }],
      );
      setGroupId(res.group.group_id); // lock the new group for the next adds
      setNewGroupMode(false);
      setNewGroupName('');
      router.refresh();
      // back to the names so the rapid loop keeps going
      setTimeout(() => fnRef.current?.focus(), 0);
    });
  }, [newGroupName, eventId, cancelNewGroup, router]);

  return (
    <>
      {toastNode}
      {/* Mobile has no FAB: adding is handled by the carousel's "Add" panel
          (QuickAddInlineForm). This sheet opens on desktop only, via
          OpenQuickAddButton → OPEN_EVENT. */}
      {open ? (
        <GuestPopup
          onClose={() => setOpen(false)}
          rootClassName="fixed inset-0 z-40"
          panelClassName="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-cream shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
          label="Quick add"
        >
            {/* header */}
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">Quick add</h2>
              <ActionButton tone="neutral" quiet iconOnly icon={X} label="Close" onClick={() => setOpen(false)} />
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {/* sticky context — Side · Role · Group are picked once and
                  stay locked across rapid adds until you change them */}
              <div className={`grid gap-2 ${hasSides ? 'grid-cols-4' : 'grid-cols-3'}`}>
                {/* side (1 col) — the control border carries the team colour.
                    Absent entirely on an event whose role set has no side
                    principals; the grid drops to 3 columns so Role and Group
                    keep their widths instead of stretching over the gap. */}
                {hasSides ? (
                <div className="col-span-1 block space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                    Side
                  </span>
                  <PickMenu
                    label="Side"
                    value={side}
                    options={(['bride', 'groom', 'both'] as GuestSide[]).map((s) => ({ key: s, label: SIDE_SHORT[s] }))}
                    onPick={(key) => setSide(key as GuestSide)}
                    className={`w-full justify-between border-2 ${SIDE_BORDER[side]}`}
                  />
                </div>
                ) : null}

                {/* role (2 cols — the long labels need the room) */}
                <div className="col-span-2 block space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                    Role
                  </span>
                  <PickMenu
                    label="Role"
                    value={role}
                    options={offeredRoles.map((r) => ({ key: r, label: guestRolePickLabel(r, roleNames) }))}
                    onPick={(key) => setRole(key as GuestRole)}
                    className="w-full justify-between"
                  />
                </div>

                {/* group (1 col — always present; "No group" by default) */}
                <div className="col-span-1 block space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                    Group
                  </span>
                  <PickMenu
                    label="Group"
                    value={newGroupMode ? '__new__' : groupId}
                    options={[
                      { key: '', label: 'No group' },
                      ...allGroups.map((g) => ({ key: g.group_id, label: g.label })),
                      { key: '__new__', label: '＋ New group…' },
                    ]}
                    onPick={(v) => {
                      if (v === '__new__') {
                        startNewGroup();
                      } else {
                        setGroupId(v);
                        if (newGroupMode) cancelNewGroup();
                      }
                    }}
                    className="w-full justify-between"
                  />
                </div>
              </div>

              {/* inline create-group strip — only while naming a new group */}
              {newGroupMode ? (
                <div className="space-y-1.5 rounded-lg border border-terracotta/40 bg-terracotta/10 p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      ref={groupRef}
                      value={newGroupName}
                      onChange={(e) => {
                        setNewGroupName(e.target.value);
                        setGroupError(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          createGroup();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelNewGroup();
                        }
                      }}
                      placeholder="New group name"
                      autoComplete="off"
                      maxLength={64}
                      className="input-field min-w-0 flex-1"
                    />
                    <ActionButton
                      tone="brand"
                      main
                      icon={Check}
                      label={isGroupPending ? 'Creating…' : 'Create'}
                      onClick={createGroup}
                      disabled={isGroupPending || !newGroupName.trim()}
                    />
                    <ActionButton
                      tone="neutral"
                      quiet
                      iconOnly
                      icon={X}
                      label="Cancel new group"
                      onClick={cancelNewGroup}
                      disabled={isGroupPending}
                    />
                  </div>
                  {groupError ? (
                    <p role="alert" className="text-xs text-danger-700">
                      {groupError}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* names — first + last on one row, compact like the search field */}
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    ref={fnRef}
                    value={fn}
                    onChange={(e) => {
                      setFn(e.target.value);
                      setDupDismissed(false);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        lnRef.current?.focus();
                      }
                    }}
                    placeholder="First name"
                    autoComplete="off"
                    enterKeyHint="next"
                    className="input-field w-full"
                  />
                  <input
                    ref={lnRef}
                    value={ln}
                    onChange={(e) => {
                      setLn(e.target.value);
                      setDupDismissed(false);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        primary(true);
                      }
                    }}
                    placeholder="Last name"
                    autoComplete="off"
                    enterKeyHint="done"
                    className="input-field w-full"
                  />
                </div>

                {dupActive ? (
                  <div className="space-y-2 rounded-xl border border-warn-300/70 bg-warn-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-warn-800">
                      <AlertTriangle aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.9} />
                      {target && !targetHasPicked
                        ? `${target.first_name} is already on your list — with a different role`
                        : `You may have already added ${dups.length > 1 ? 'these guests' : 'this guest'}`}
                    </p>
                    {dups.map(({ g, kind }, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 rounded-lg border border-ink/10 bg-cream px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {g.first_name} {g.last_name}
                          </span>
                          <span className="block truncate text-[11px] text-ink/55">
                            {[g.role, ...g.extra_roles].map((r) => guestRoleLabel(r, roleNames)).join(' · ')}
                            {hasSides ? ` · ${SIDE_LABELS[g.side]}` : null}
                          </span>
                        </span>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            kind === 'exact'
                              ? 'bg-danger-100 text-danger-700'
                              : kind === 'nick'
                                ? 'bg-info-100 text-info-800'
                                : 'bg-warn-200/70 text-warn-800'
                          }`}
                        >
                          {TAG[kind]}
                        </span>
                      </div>
                    ))}

                    {target && !targetHasPicked ? (
                      /* same name, different role — resolve, don't dupe */
                      <div className="space-y-1.5 pt-0.5">
                        {!pickedIsSingleton ? (
                          <ActionButton
                            tone="brand"
                            main
                            icon={Plus}
                            label={`Add ${guestRoleLabel(role, roleNames)} too — keep both roles`}
                            onClick={() => applyAddRole(target)}
                            disabled={isPending}
                            className="!h-auto min-h-11 w-full !whitespace-normal py-2"
                          />
                        ) : null}
                        <ActionButton
                          tone="neutral"
                          icon={UserRoundPen}
                          label={`Change ${target.first_name} to ${guestRoleLabel(role, roleNames)}`}
                          onClick={() => applyChangeRole(target)}
                          disabled={isPending}
                          className="!h-auto min-h-11 w-full !whitespace-normal py-2"
                        />
                        <div className="flex gap-2">
                          <ActionButton
                            tone="neutral"
                            icon={Plus}
                            label="Different person"
                            onClick={() => forceAdd(true)}
                            disabled={isPending}
                            className="flex-1"
                          />
                          <ActionButton
                            tone="neutral"
                            quiet
                            icon={UserCheck}
                            label="Keep as is"
                            onClick={skipDuplicate}
                            disabled={isPending}
                            className="flex-1"
                          />
                        </div>
                      </div>
                    ) : (
                      /* already on the list with this same role — a true dup */
                      <div className="flex gap-2 pt-0.5">
                        <ActionButton
                          tone="neutral"
                          icon={Plus}
                          label="Different person"
                          onClick={() => forceAdd(true)}
                          disabled={isPending}
                          className="flex-1"
                        />
                        <ActionButton
                          tone="neutral"
                          quiet
                          icon={UserCheck}
                          label="Keep as is"
                          onClick={skipDuplicate}
                          disabled={isPending}
                          className="flex-1"
                        />
                      </div>
                    )}
                  </div>
                ) : null}

                {error ? (
                  <p role="alert" className="text-sm text-danger-700">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            {/* footer — one button; the ↵ loop does the rapid adds */}
            <div className="border-t border-ink/10 px-5 py-4">
              <ActionButton
                tone="brand"
                main
                icon={Check}
                label={isPending ? 'Adding…' : 'Done'}
                onClick={done}
                disabled={isPending}
                className="w-full"
              />
            </div>
        </GuestPopup>
      ) : null}
    </>
  );
}
