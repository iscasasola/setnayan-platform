'use client';

import { useEffect, useRef, useState, useTransition, type KeyboardEvent as KE, type ReactNode } from 'react';
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { useOneOpen } from '@/lib/one-open';
import type { PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-types';
import { groupHeadClass, pickArrowClass, pickButtonClass, pickOptionClass, pickTickClass } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu-place';
import { useGuestActions } from './guest-actions-context';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';

/**
 * guest-group-picker.tsx — 👥 THE ONE GROUP DROPDOWN (owner 2026-10-20: *"there are 2 groups."* · *"before we can always
 * create a new group anytime and add or delete a group name."* · *"several group, several roles"*; DECISION_LOG "GUEST
 * CARD: ONE GROUP DROPDOWN AND ONE ROLE DROPDOWN, EACH MULTI"; the contract is the approved prototype
 * `prototypes/guest_group_and_fast_add_2026-10-20.html`, strip A — A1 closed · A2 open · A3 creating · A4 renaming ·
 * A5 deleting · A6 after).
 *
 * ONE list, in order: **Standard · one of these** (the event type's groups — `group_category`, one column, so ticking another
 * swaps it) → **Your groups · as many as apply** (the couple's own — memberships, ticked freely; each with a ✎ that opens the
 * row into its name box with Save and "Delete group…") → **＋ New group…** (Quick add's shipped strip, #782: name + Create + ×;
 * Enter creates, Esc cancels; the new group comes back ticked) → "Tick as many as apply. · Done ✓" (the shipped checkmark
 * PickMenu's footer). Ticked = accent words + ✓, drawn with the PickMenu's own classes (`pick-menu-place.ts`).
 *
 * 🧩 EXPORTED FOR REUSE — the guest card (`guest-card-rows.tsx` › `CardGroup`) and the add card's sticky Group pill
 * (rd/quick-add-fast, #6696) draw THIS, so the two can never mean different things. It is CONTROLLED: it says which key was
 * tapped (`onPick`) and draws what it is given (`picked`) — `tickGroup` (lib/guest-group-role-pick.ts) is the one rule.
 *
 * WHY NOT `PickMenu` ITSELF: a ✎ inside a row and a name box inside the list are not options — `pick-menu.tsx` sits at its
 * inline-size line (`pick-menu-stays-inline.test.ts`) and a second render path there would split it into its own chunk.
 * The list therefore opens IN FLOW under its row (the prototype's A2), which is also where a phone keyboard can reach the
 * name box. Writes: create = the shipped `quickCreateGroup`; rename / delete / the delete's count = `editGuestGroupInPlace` (`group-edit-actions.ts`)
 * (result-returning twins of the redirecting `updateGuestGroup` / `deleteGuestGroup`). All through `useGuestActions()` so
 * the dev lab's stand-ins answer there.
 */

export type OwnGroup = { groupId: string; label: string };

type Mode = { kind: 'list' } | { kind: 'new' } | { kind: 'rename'; id: string } | { kind: 'delete'; id: string };

/** "12 guests are in it." · "1 guest is in it." · "Nobody is in it." */
export function inItWords(n: number): string {
  return n === 0 ? 'Nobody is in it.' : `${n} ${n === 1 ? 'guest is' : 'guests are'} in it.`;
}

export function GuestGroupPicker({
  eventId,
  label = 'Group',
  picked,
  onPick,
  standard,
  groups,
  onGroupsChange,
  className = '',
  layout,
  emptyText,
}: {
  eventId: string;
  label?: string;
  /** Ticked keys — the standard key and the own group ids. */
  picked: readonly string[];
  /** One tap on a key (a standard key or an own group id). The caller applies `tickGroup` and hands `picked` back. */
  onPick: (key: string) => void;
  standard: readonly PickOption[];
  /** The couple's own groups. Null = they could not be read: the section says so and offers nothing to tick or edit. */
  groups: readonly OwnGroup[] | null;
  /** Told when a group was made, renamed or deleted here — the caller's list follows. */
  onGroupsChange?: (next: OwnGroup[]) => void;
  className?: string;
  /** Where the pill and its list go (the card puts the list under its Form row). Default: the list under the pill. */
  layout?: (button: ReactNode, list: ReactNode) => ReactNode;
  /** The pill's words while nothing is ticked (/guests/new: "Choose…"). Default: the label. */
  emptyText?: string;
}) {
  const { quickCreateGroup, editGuestGroupInPlace } = useGuestActions();
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [count, setCount] = useState<number | null | 'unknown'>(null);
  const [pending, start] = useTransition();
  const [own, setOwn] = useState<OwnGroup[] | null>(groups ? [...groups] : null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Groups made HERE — kept until the server's list has them too. */
  const madeHere = useRef(new Set<string>());

  /* A fresh list from the server (a save landed) replaces ours — keeping any group made here the server has not drawn yet. */
  const fromServer = JSON.stringify(groups);
  useEffect(() => {
    setOwn((prev) => {
      if (!groups) return null;
      const made = (prev ?? []).filter((g) => madeHere.current.has(g.groupId) && !groups.some((s) => s.groupId === g.groupId));
      return [...groups, ...made];
    });
    // `groups` is read through `fromServer`, its stable key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromServer]);

  const tell = (next: OwnGroup[]) => {
    const sorted = [...next].sort((x, y) => x.label.localeCompare(y.label));
    setOwn(sorted);
    onGroupsChange?.(sorted);
  };

  const close = () => {
    setOpen(false);
    setMode({ kind: 'list' });
    setErr(null);
  };
  /* Closed from elsewhere (another dropdown opened — `useOneOpen`): the next open starts on the list. */
  useEffect(() => {
    if (!open) setMode({ kind: 'list' });
  }, [open]);

  /* A tap outside closes it, as the PickMenu's list does; Esc peels one layer (an open name box first). */
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !boxRef.current?.contains(t)) close();
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
    // `close` only sets this component's own state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (mode.kind === 'new' || mode.kind === 'rename') {
      const el = inputRef.current;
      el?.focus();
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [mode]);

  const back = () => {
    setMode({ kind: 'list' });
    setErr(null);
  };

  const startNew = () => {
    setDraft('');
    setErr(null);
    setMode({ kind: 'new' });
  };

  const create = () => {
    const name = draft.trim();
    if (!name) return;
    const taken = [...standard.map((o) => o.label), ...(own ?? []).map((g) => g.label)].find((l) => l.toLowerCase() === name.toLowerCase());
    if (taken) {
      setErr(`“${taken}” already exists — pick it from the list.`);
      return;
    }
    setErr(null);
    start(async () => {
      const res = await hearAction(() => quickCreateGroup(eventId, name));
      if (!res.ok) {
        setErr(plainRefusal(res.error, 'Couldn’t make that group. Try again.'));
        return;
      }
      const made = { groupId: res.group.group_id, label: res.group.label };
      madeHere.current.add(made.groupId);
      if (!(own ?? []).some((g) => g.groupId === made.groupId)) tell([...(own ?? []), made]);
      if (!picked.includes(made.groupId)) onPick(made.groupId);
      setDraft('');
      setMode({ kind: 'list' });
    });
  };

  const rename = (id: string) => {
    const name = draft.trim();
    const was = own?.find((g) => g.groupId === id);
    if (!was) return;
    if (!name || name === was.label) return back();
    start(async () => {
      const res = await hearAction(() => editGuestGroupInPlace(eventId, id, { op: 'rename', label: name }));
      if (!res.ok || !('group' in res)) {
        setErr(plainRefusal(res.ok ? '' : res.error, 'Couldn’t rename that group. Try again.'));
        return;
      }
      tell((own ?? []).map((g) => (g.groupId === id ? { ...g, label: res.group.label } : g)));
      back();
    });
  };

  const askDelete = (id: string) => {
    setErr(null);
    setCount(null);
    setMode({ kind: 'delete', id });
    start(async () => {
      const res = await hearAction(() => editGuestGroupInPlace(eventId, id, { op: 'count' }));
      setCount(res.ok && 'n' in res ? res.n : 'unknown');
    });
  };

  const remove = (id: string) => {
    start(async () => {
      const res = await hearAction(() => editGuestGroupInPlace(eventId, id, { op: 'delete' }));
      if (!res.ok) {
        setErr(plainRefusal(res.error, 'Couldn’t delete that group. Try again.'));
        return;
      }
      if (picked.includes(id)) onPick(id);
      madeHere.current.delete(id);
      tell((own ?? []).filter((g) => g.groupId !== id));
      back();
    });
  };

  const keys = (onEnter: () => void) => (e: KE<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onEnter();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      back();
    }
  };

  const text = [...standard.filter((o) => picked.includes(o.key)).map((o) => o.label), ...(own ?? []).filter((g) => picked.includes(g.groupId)).map((g) => g.label)].join(' · ');

  const button = (
    <button
      ref={btnRef}
      type="button"
      aria-label={`${label}: ${text || 'choose'}`}
      aria-haspopup="listbox"
      aria-expanded={open}
      data-group-picker=""
      onClick={() => (open ? close() : setOpen(true))}
      className={`${pickButtonClass(false)} ${className}`}
    >
      <span className="min-w-0 truncate">{text || emptyText || label}</span>
      <ChevronDown aria-hidden className={pickArrowClass(open)} strokeWidth={2} />
    </button>
  );

  const tick = (on: boolean) => (on ? <span aria-hidden data-pick-tick="" className={pickTickClass(false)}>✓</span> : null);
  const head = (word: string, how: string) => (
    <p aria-hidden className={groupHeadClass(false)}>
      {word} <span className="font-medium normal-case tracking-normal text-ink/45">· {how}</span>
    </p>
  );
  const strip = (danger: boolean, children: ReactNode) => (
    <div className={`mx-1 my-1 space-y-1.5 rounded-xl p-2.5 ${danger ? 'bg-danger-700/5' : 'bg-terracotta/10'}`}>{children}</div>
  );

  const ownRow = (g: OwnGroup) => {
    const on = picked.includes(g.groupId);
    if (mode.kind === 'rename' && mode.id === g.groupId) {
      return (
        <li key={g.groupId} role="none" data-group-rename={g.groupId}>
          {strip(
            false,
            <>
              <div className="flex flex-wrap items-center gap-2">
                <input ref={inputRef} value={draft} onChange={(e) => { setDraft(e.target.value); setErr(null); }} onKeyDown={keys(() => rename(g.groupId))} aria-label="Group name" autoComplete="off" maxLength={64} className="input-field min-w-[11rem] flex-1" />
                <ActionButton tone="brand" main icon={Check} label={pending ? 'Saving…' : 'Save'} onClick={() => rename(g.groupId)} disabled={pending || !draft.trim()} />
                <ActionButton tone="neutral" quiet iconOnly icon={X} label="Cancel rename" onClick={back} disabled={pending} />
              </div>
              <p className="flex flex-wrap items-center gap-x-1.5 text-[11px] text-ink/55">
                <span>Enter saves · Esc cancels ·</span>
                <ActionButton tone="danger" icon={Trash2} label="Delete group…" onClick={() => askDelete(g.groupId)} disabled={pending} />
              </p>
              {err ? <p role="alert" className="text-xs text-danger-700">{err}</p> : null}
            </>,
          )}
        </li>
      );
    }
    if (mode.kind === 'delete' && mode.id === g.groupId) {
      return (
        <li key={g.groupId} role="none" data-group-delete={g.groupId}>
          {strip(
            true,
            <>
              <p className="text-[13px] leading-snug text-ink">
                Delete <b className="font-bold">{g.label}</b>?{' '}
                {count === null ? (
                  <span className="text-ink/55">Counting who is in it…</span>
                ) : typeof count === 'number' ? (
                  <><b className="font-bold" data-group-count={count}>{inItWords(count)}</b>{count > 0 ? ' They stay on your list — they just leave this group.' : null}</>
                ) : (
                  'Everyone in it stays on your list — they just leave this group.'
                )}
              </p>
              <div className="flex items-center gap-2">
                <ActionButton tone="danger" main icon={Trash2} label={pending && count !== null ? 'Deleting…' : 'Delete'} onClick={() => remove(g.groupId)} disabled={pending} />
                <ActionButton tone="neutral" icon={X} label="Keep" onClick={back} disabled={pending && count !== null} />
              </div>
              {err ? <p role="alert" className="text-xs text-danger-700">{err}</p> : null}
            </>,
          )}
        </li>
      );
    }
    return (
      <li key={g.groupId} role="none" className="flex items-center">
        <button type="button" role="option" aria-selected={on} data-pick-option={g.groupId} onClick={() => onPick(g.groupId)} className={`${pickOptionClass(false, on)} min-w-0 flex-1`}>
          <span className="min-w-0 truncate font-semibold">{g.label}</span>
          {tick(on)}
        </button>
        <button
          type="button"
          aria-label={`Rename or delete ${g.label}`}
          title="Rename / delete"
          data-group-edit={g.groupId}
          onClick={() => {
            setDraft(g.label);
            setErr(null);
            setMode({ kind: 'rename', id: g.groupId });
          }}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink/55 transition-colors hover:bg-ink/5 hover:text-ink"
        >
          <Pencil aria-hidden className="h-4 w-4" strokeWidth={2} />
        </button>
      </li>
    );
  };

  const list = open ? (
    <div ref={boxRef} data-group-list="" onKeyDown={(e) => { if (e.key === 'Escape' && mode.kind === 'list') { e.stopPropagation(); close(); btnRef.current?.focus(); } }} className="sn-glass-bare mb-2.5 mt-0.5 rounded-2xl p-1.5 shadow-[0_10px_30px_-18px_rgba(30,26,18,.4)] ring-1 ring-ink/[0.08]">
      <ul role="listbox" aria-label={label} aria-multiselectable="true">
        <li role="group" aria-label="Standard" data-pick-group="Standard">
          {head('Standard', 'one of these')}
          <ul role="none">
            {standard.map((o) => {
              const on = picked.includes(o.key);
              return (
                <li key={o.key} role="none">
                  <button type="button" role="option" aria-selected={on} data-pick-option={o.key} onClick={() => onPick(o.key)} className={pickOptionClass(false, on)}>
                    <span className="font-semibold">{o.label}</span>
                    {tick(on)}
                  </button>
                </li>
              );
            })}
          </ul>
        </li>
        <li role="group" aria-label="Your groups" data-pick-group="Your groups" className="mt-1 border-t border-ink/10 pt-1">
          {head('Your groups', 'as many as apply')}
          <ul role="none">
            {own === null ? (
              <li role="none" className="px-3 pb-1.5 text-xs text-ink/55">Your groups couldn’t be loaded — they are kept as they are.</li>
            ) : (
              <>
                {own.length === 0 ? <li role="none" className="px-3 pb-1.5 text-xs text-ink/45">None yet.</li> : null}
                {own.map(ownRow)}
                <li role="none">
                  {mode.kind === 'new' ? (
                    strip(
                      false,
                      <>
                        <div className="flex flex-wrap items-center gap-2" data-group-new="">
                          <input ref={inputRef} value={draft} onChange={(e) => { setDraft(e.target.value); setErr(null); }} onKeyDown={keys(create)} placeholder="New group name" aria-label="New group name" autoComplete="off" maxLength={64} className="input-field min-w-[11rem] flex-1" />
                          <ActionButton tone="brand" main icon={Check} label={pending ? 'Creating…' : 'Create'} onClick={create} disabled={pending || !draft.trim()} />
                          <ActionButton tone="neutral" quiet iconOnly icon={X} label="Cancel new group" onClick={back} disabled={pending} />
                        </div>
                        <p className="text-[11px] text-ink/55">Enter creates · Esc cancels · the new group is ticked for this guest.</p>
                        {err ? <p role="alert" className="text-xs text-danger-700">{err}</p> : null}
                      </>,
                    )
                  ) : (
                    <button type="button" data-group-new-open="" onClick={startNew} className={pickOptionClass(false, false)}>
                      <Plus aria-hidden className="h-4 w-4 shrink-0" strokeWidth={2.2} />
                      <span className="font-semibold">New group…</span>
                    </button>
                  )}
                </li>
              </>
            )}
          </ul>
        </li>
        <li role="none" className="mt-1 border-t border-ink/10 pt-1">
          <button type="button" data-pick-done="" onClick={() => { close(); btnRef.current?.focus(); }} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-[13px] text-ink/60 hover:bg-ink/5">
            <span>Tick as many as apply.</span>
            <span className="font-semibold text-ink">Done ✓</span>
          </button>
        </li>
      </ul>
    </div>
  ) : null;

  return <>{layout ? layout(button, list) : <div className="min-w-0">{button}{list}</div>}</>;
}
