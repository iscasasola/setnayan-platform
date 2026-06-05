'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, X } from 'lucide-react';
import {
  ROLE_LABELS,
  SIDE_LABELS,
  type GuestRole,
  type GuestSide,
} from '@/lib/guests';
import {
  quickAddGuest,
  quickCreateGroup,
  addRoleToGuest,
  setGuestPrimaryRole,
} from '../quick-add-actions';
import { findDuplicates, norm, TAG } from '@/lib/guest-dedupe';

/* ------------------------------------------------------------------ */
/* Cross-component opener — one sheet, two triggers (desktop header    */
/* button + mobile FAB). A CustomEvent avoids context/portal plumbing. */
/* ------------------------------------------------------------------ */
const OPEN_EVENT = 'setnayan:quick-add-open';

export function OpenQuickAddButton() {
  return (
    <button
      type="button"
      className="button-primary"
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_EVENT))}
    >
      + Add guest
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
const ROLE_OPTS: GuestRole[] = [
  'guest',
  'bride',
  'groom',
  'bride_parents',
  'groom_parents',
  'bride_immediate_family',
  'groom_immediate_family',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'principal_sponsor',
  'candle_sponsor',
  'veil_sponsor',
  'cord_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

/* the Side picker carries its team colour on the control border */
const SIDE_BORDER: Record<GuestSide, string> = {
  bride: 'border-rose-400',
  groom: 'border-sky-500',
  both: 'border-violet-400',
};
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
}: {
  eventId: string;
  existingGuests: ExistingGuest[];
  groups: GroupOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<GuestSide>('bride');
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
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fnRef = useRef<HTMLInputElement>(null);
  const lnRef = useRef<HTMLInputElement>(null);
  const groupRef = useRef<HTMLInputElement>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => fnRef.current?.focus(), 80);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(t);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastT.current) clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToast(null), 1800);
  }, []);

  const clearNames = useCallback(() => {
    setFn('');
    setLn('');
    setDupDismissed(false);
    setError(null);
  }, []);

  const skipDuplicate = useCallback(() => {
    clearNames();
    showToast('Skipped — already on your list');
    fnRef.current?.focus();
  }, [clearNames, showToast]);

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
        const res = await quickAddGuest(eventId, {
          first_name: f,
          last_name: l,
          side,
          role,
          group_id: groupId || null,
        });
        if (!res.ok) {
          setError(res.error);
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
          setError(res.error);
          return;
        }
        setRoleOverrides((prev) => ({
          ...prev,
          [g.guest_id]: { role: res.guest.role, extra_roles: res.guest.extra_roles },
        }));
        clearNames();
        router.refresh();
        showToast(`${g.first_name} is now also ${ROLE_LABELS[role]}`);
        setTimeout(() => fnRef.current?.focus(), 0);
      });
    },
    [eventId, role, clearNames, router, showToast],
  );
  const applyChangeRole = useCallback(
    (g: ExistingGuest) => {
      setError(null);
      startTransition(async () => {
        const res = await setGuestPrimaryRole(eventId, g.guest_id, role);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setRoleOverrides((prev) => ({
          ...prev,
          [g.guest_id]: { role: res.guest.role, extra_roles: res.guest.extra_roles },
        }));
        clearNames();
        router.refresh();
        showToast(`${g.first_name} → ${ROLE_LABELS[role]}`);
        setTimeout(() => fnRef.current?.focus(), 0);
      });
    },
    [eventId, role, clearNames, router, showToast],
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
        setGroupError(res.error);
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
      {/* Mobile has no FAB: adding is handled by the carousel's "Add" panel
          (QuickAddInlineForm). This sheet opens on desktop only, via
          OpenQuickAddButton → OPEN_EVENT. */}
      {open ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/40"
          />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-cream shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:max-h-[86vh] sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
            {/* header */}
            <div className="flex items-center justify-between border-b border-ink/10 px-5 py-4">
              <h2 className="text-lg font-semibold text-ink">Quick add</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-ink/50 hover:text-ink"
              >
                <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>

            {/* body */}
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
              {/* sticky context — Side · Role · Group are picked once and
                  stay locked across rapid adds until you change them */}
              <div className="grid grid-cols-4 gap-2">
                {/* side (1 col) — the control border carries the team colour */}
                <label className="col-span-1 block space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                    Side
                  </span>
                  <select
                    aria-label="Side"
                    value={side}
                    onChange={(e) => setSide(e.target.value as GuestSide)}
                    className={`w-full rounded-lg border-2 bg-cream px-2 py-2 text-sm text-ink focus:outline-none ${SIDE_BORDER[side]}`}
                  >
                    {(['bride', 'groom', 'both'] as GuestSide[]).map((s) => (
                      <option key={s} value={s}>
                        {SIDE_SHORT[s]}
                      </option>
                    ))}
                  </select>
                </label>

                {/* role (2 cols — the long labels need the room) */}
                <label className="col-span-2 block space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                    Role
                  </span>
                  <select
                    aria-label="Role"
                    value={role}
                    onChange={(e) => setRole(e.target.value as GuestRole)}
                    className="w-full rounded-lg border border-ink/20 bg-cream px-2 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
                  >
                    {ROLE_OPTS.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </label>

                {/* group (1 col — always present; "No group" by default) */}
                <label className="col-span-1 block space-y-1">
                  <span className="block font-mono text-[9px] uppercase tracking-[0.14em] text-ink/45">
                    Group
                  </span>
                  <select
                    aria-label="Group"
                    value={newGroupMode ? '__new__' : groupId}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === '__new__') {
                        startNewGroup();
                      } else {
                        setGroupId(v);
                        if (newGroupMode) cancelNewGroup();
                      }
                    }}
                    className="w-full rounded-lg border border-ink/20 bg-cream px-2 py-2 text-sm text-ink focus:border-ink/40 focus:outline-none"
                  >
                    <option value="">No group</option>
                    {allGroups.map((g) => (
                      <option key={g.group_id} value={g.group_id}>
                        {g.label}
                      </option>
                    ))}
                    <option value="__new__">＋ New group…</option>
                  </select>
                </label>
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
                    <button
                      type="button"
                      onClick={createGroup}
                      disabled={isGroupPending || !newGroupName.trim()}
                      className="flex-none rounded-lg bg-mulberry px-3 py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-50"
                    >
                      {isGroupPending ? '…' : 'Create'}
                    </button>
                    <button
                      type="button"
                      aria-label="Cancel new group"
                      onClick={cancelNewGroup}
                      disabled={isGroupPending}
                      className="flex-none text-ink/45 hover:text-ink"
                    >
                      <X aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                    </button>
                  </div>
                  {groupError ? (
                    <p role="alert" className="text-xs text-rose-700">
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
                  <div className="space-y-2 rounded-xl border border-amber-300/70 bg-amber-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-semibold leading-tight text-amber-800">
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
                            {[g.role, ...g.extra_roles].map((r) => ROLE_LABELS[r]).join(' · ')}
                            {' · '}
                            {SIDE_LABELS[g.side]}
                          </span>
                        </span>
                        <span
                          className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            kind === 'exact'
                              ? 'bg-rose-100 text-rose-700'
                              : kind === 'nick'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-amber-200/70 text-amber-800'
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
                          <button
                            type="button"
                            onClick={() => applyAddRole(target)}
                            disabled={isPending}
                            className="w-full rounded-lg bg-mulberry py-2 text-sm font-semibold text-cream hover:bg-mulberry-600 disabled:opacity-60"
                          >
                            ＋ Add {ROLE_LABELS[role]} too — keep both roles
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => applyChangeRole(target)}
                          disabled={isPending}
                          className="w-full rounded-lg border border-ink/20 bg-cream py-2 text-sm font-medium text-ink hover:border-ink/40 disabled:opacity-60"
                        >
                          Change {target.first_name} to {ROLE_LABELS[role]}
                        </button>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => forceAdd(true)}
                            disabled={isPending}
                            className="flex-1 rounded-lg border border-ink/15 bg-cream py-2 text-xs font-medium text-ink/70 hover:border-ink/30"
                          >
                            Different person
                          </button>
                          <button
                            type="button"
                            onClick={skipDuplicate}
                            disabled={isPending}
                            className="flex-1 rounded-lg py-2 text-xs font-medium text-ink/55 hover:text-ink"
                          >
                            Keep as is
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* already on the list with this same role — a true dup */
                      <div className="flex gap-2 pt-0.5">
                        <button
                          type="button"
                          onClick={() => forceAdd(true)}
                          disabled={isPending}
                          className="flex-1 rounded-lg border border-ink/15 bg-cream py-2 text-sm font-medium text-ink/70 hover:border-ink/30"
                        >
                          ＋ Different person
                        </button>
                        <button
                          type="button"
                          onClick={skipDuplicate}
                          disabled={isPending}
                          className="flex-1 rounded-lg py-2 text-sm font-medium text-ink/55 hover:text-ink"
                        >
                          Keep as is
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}

                {error ? (
                  <p role="alert" className="text-sm text-rose-700">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>

            {/* footer — one button; the ↵ loop does the rapid adds */}
            <div className="border-t border-ink/10 px-5 py-4">
              <button
                type="button"
                onClick={done}
                disabled={isPending}
                className="w-full rounded-lg bg-mulberry px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600 disabled:opacity-60"
              >
                {isPending ? 'Adding…' : 'Done'}
              </button>
            </div>
          </div>

          {toast ? (
            <div className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm font-medium text-cream shadow-lg sm:bottom-8">
              {toast}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
