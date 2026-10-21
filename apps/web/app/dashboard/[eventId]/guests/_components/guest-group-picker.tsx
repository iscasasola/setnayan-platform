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
import type { GuestGroupTeamSide, GuestSide } from '@/lib/guests';
import { GROUP_SIDE_WORD, listedOwnGroups, OFF_SIDE_WORD, sidesForNamesakes, teamSideForNewGroup } from '@/lib/groups-for-side';
import { clashWords, groupNameClash, type GroupNameClash } from '@/lib/group-name-clash';
import { revealAboveChrome } from '@/lib/reveal-above-chrome';

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
 * name box. Writes: create / rename / delete / the delete's count = `editGuestGroupInPlace` (`group-edit-actions.ts`)
 * (result-returning twins of the redirecting `updateGuestGroup` / `deleteGuestGroup`). All through `useGuestActions()` so
 * the dev lab's stand-ins answer there.
 *
 * 👥 THE LIST FOLLOWS THE GUEST'S SIDE (owner 2026-10-20, DECISION_LOG "THE GROUP LIST FOLLOWS THE GUEST'S SIDE"): "Your
 * groups" draws `listedOwnGroups` — the guest's side's groups and both sides' (a guest on both sides sees all), plus any
 * group they are already in, ticked, with a small "· groom's side" so nothing is silently dropped. The side is `side`, or
 * — where the side is a field of the same form (the card's Side row, /guests/new's Side) — that field's live value
 * (`sideField`), so changing Side re-filters at once. ＋ New group… makes the group on the guest's side
 * (`teamSideForNewGroup`: both → both); rename changes the name only. No `side` (an event with no sides): every group.
 * The standard groups are never filtered.
 *
 * 👥 ONE NAME, ONE GROUP (owner 2026-10-20: *"also not allow to have a group name similarly written on the group
 * already."*): a new or renamed name that `groupNameClash` finds — a standard group, or an own group sharing a list with
 * the group's side, compared without case, spaces or punctuation — is refused in place under the box ("You already have
 * “Family”.") with "Use “Family”", one tap that ticks that group instead. The server runs the same rule.
 */

export type OwnGroup = { groupId: string; label: string; teamSide: GuestGroupTeamSide };

/**
 * The live value of a field of the form `anchor` sits in — a pick raises `input`/`change` on its hidden input (`CardPick`),
 * a native select raises `change`, the card's Undo raises `sn-restore` on the input itself. No field: `initial`.
 */
function useFormFieldSide(anchor: { current: HTMLElement | null }, field: string | undefined, initial: GuestSide | null | undefined) {
  const [side, setSide] = useState(initial);
  useEffect(() => setSide(initial), [initial]);
  useEffect(() => {
    if (!field) return;
    const form = anchor.current?.closest('form');
    const el = form?.elements.namedItem(field);
    if (!form || !(el instanceof HTMLInputElement || el instanceof HTMLSelectElement)) return;
    const read = () => setSide(el.value === 'bride' || el.value === 'groom' || el.value === 'both' ? el.value : null);
    read();
    const onField = (e: Event) => {
      if (e.target === el) read();
    };
    form.addEventListener('input', onField);
    form.addEventListener('change', onField);
    el.addEventListener('sn-restore', read);
    return () => {
      form.removeEventListener('input', onField);
      form.removeEventListener('change', onField);
      el.removeEventListener('sn-restore', read);
    };
    // `anchor` is a ref; the field is read once it is mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [field]);
  return side;
}

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
  side,
  sideField,
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
  /** The guest's side — "Your groups" follows it. Undefined = the event has no sides: every group. */
  side?: GuestSide | null;
  /** The side is this field of the picker's own form: follow its live value (`side` is the value before it is read). */
  sideField?: string;
}) {
  const { editGuestGroupInPlace } = useGuestActions();
  const [open, setOpen] = useState(false);
  useOneOpen(open, setOpen);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [draft, setDraft] = useState('');
  const [err, setErrWords] = useState<string | null>(null);
  /** The group a typed name already is — said under the box with "Use “…”". */
  const [clash, setClash] = useState<GroupNameClash | null>(null);
  const setErr = (words: string | null, c: GroupNameClash | null = null) => {
    setErrWords(words);
    setClash(c);
  };
  const [count, setCount] = useState<number | null | 'unknown'>(null);
  const [pending, startGroupTransition] = useTransition();
  const [own, setOwn] = useState<OwnGroup[] | null>(groups ? [...groups] : null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** Groups made HERE — kept until the server's list has them too. */
  const madeHere = useRef(new Set<string>());
  const liveSide = useFormFieldSide(btnRef, sideField, side);
  /* The groups ticked when the list opened stay drawn until it closes — unticking another side's group by mistake must
     not take away the row that re-ticks it. */
  const [stay, setStay] = useState<readonly string[]>([]);
  /* 👥 What "Your groups" draws: the guest's side's and both sides' groups, plus any they are already in. */
  const listed = own === null ? null : listedOwnGroups(own, liveSide, [...picked, ...stay]);
  /* 👥 Same name, say the side (owner 2026-10-21, "why do i see dupes on group names"): a drawn group whose name another
     drawn row shares — an own group or a standard one — carries its side's small word; a name drawn once carries none. */
  const namesakes = listed === null ? new Map<string, GuestGroupTeamSide>() : sidesForNamesakes(listed.map((l) => l.group), standard.map((o) => o.label));

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
      el?.focus({ preventScroll: true });
      if (el) el.setSelectionRange(el.value.length, el.value.length);
    }
  }, [mode]);

  /* 📱 ABOVE THE BOTTOM BAR (2026-10-20, the owner's 375 shot: the bar drew over the open list; "＋ New group…"'s Create
     and × sat under it). The list opens in flow, so it is scrolled into the band the bars leave (`revealAboveChrome`,
     lib/reveal-above-chrome.ts): on open, the list from its pill down; with an editor open, that editor and its buttons —
     again when its sentence changes and when the phone keyboard moves the screen's edge. */
  useEffect(() => {
    if (!open) return;
    const box = boxRef.current;
    const editor = () => box?.querySelector('[data-group-rename],[data-group-delete]') ?? box?.querySelector('[data-group-new]')?.closest('li');
    const show = () => {
      const ed = editor();
      revealAboveChrome(ed ?? box, ed ? null : btnRef.current);
    };
    const frame = requestAnimationFrame(show);
    const vv = window.visualViewport;
    const onKeyboard = () => (editor() ? show() : undefined);
    vv?.addEventListener('resize', onKeyboard);
    return () => {
      cancelAnimationFrame(frame);
      vv?.removeEventListener('resize', onKeyboard);
    };
  }, [open, mode, err, clash]);

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
    /* The guest's side's group (both → both). */
    const teamSide = teamSideForNewGroup(liveSide);
    /* One name, one group: a standard group, or an own group in the same list (the other side's namesake is another family's). */
    const c = groupNameClash(name, teamSide, standard, own ?? []);
    if (c) return setErr(clashWords(c), c);
    setErr(null);
    startGroupTransition(async () => {
      const res = await hearAction(() => editGuestGroupInPlace(eventId, '', { op: 'create', label: name, side: teamSide }));
      if (!res.ok || !('group' in res)) {
        const told = !res.ok && 'clash' in res ? res.clash : undefined;
        setErr(told ? clashWords(told) : plainRefusal(res.ok ? '' : res.error, 'Couldn’t make that group. Try again.'), told ?? null);
        return;
      }
      const made: OwnGroup = { groupId: res.group.group_id, label: res.group.label, teamSide };
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
    /* Its own side's list — renaming never moves a group to another side. */
    const c = groupNameClash(name, was.teamSide, standard, own ?? [], id);
    if (c) return setErr(clashWords(c), c);
    startGroupTransition(async () => {
      const res = await hearAction(() => editGuestGroupInPlace(eventId, id, { op: 'rename', label: name }));
      if (!res.ok || !('group' in res)) {
        const told = !res.ok && 'clash' in res ? res.clash : undefined;
        setErr(told ? clashWords(told) : plainRefusal(res.ok ? '' : res.error, 'Couldn’t rename that group. Try again.'), told ?? null);
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
    startGroupTransition(async () => {
      const res = await hearAction(() => editGuestGroupInPlace(eventId, id, { op: 'count' }));
      setCount(res.ok && 'n' in res ? res.n : 'unknown');
    });
  };

  const remove = (id: string) => {
    startGroupTransition(async () => {
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

  /* "Use “Family”": tick the group the name already is, and close the box. */
  const takeClash = (c: GroupNameClash) => {
    const key = c.kind === 'standard' ? c.key : c.groupId;
    if (!picked.includes(key)) onPick(key);
    setDraft('');
    back();
  };
  const said = (
    <>
      {clash ? (
        <p role="alert" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-danger-700" data-group-clash={clash.kind === 'standard' ? clash.key : clash.groupId}>
          <span>{clashWords(clash)}</span>
          <ActionButton tone="brand" icon={Check} label={`Use “${clash.label}”`} onClick={() => takeClash(clash)} disabled={pending} />
        </p>
      ) : err ? (
        <p role="alert" className="text-xs text-danger-700">{err}</p>
      ) : null}
    </>
  );

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
      onClick={() => {
        if (open) return close();
        setStay([...picked]);
        setOpen(true);
      }}
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

  const ownRow = (g: OwnGroup, offSide: 'bride' | 'groom' | null) => {
    const on = picked.includes(g.groupId);
    const sideWord = offSide ?? namesakes.get(g.groupId) ?? null;
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
              {said}
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
          <span className="min-w-0 truncate font-semibold">
            {g.label}
            {sideWord ? (
              <span className="text-[12px] font-medium text-ink/50" data-group-off-side={offSide ?? undefined} data-group-namesake-side={offSide ? undefined : sideWord}>
                {' '}· {GROUP_SIDE_WORD[sideWord]}
              </span>
            ) : null}
          </span>
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
            {own === null || listed === null ? (
              <li role="none" className="px-3 pb-1.5 text-xs text-ink/55">Your groups couldn’t be loaded — they are kept as they are.</li>
            ) : (
              <>
                {listed.length === 0 ? (
                  <li role="none" className="px-3 pb-1.5 text-xs text-ink/45">
                    {own.length === 0 || (liveSide !== 'bride' && liveSide !== 'groom') ? 'None yet.' : `None on the ${OFF_SIDE_WORD[liveSide]} yet.`}
                  </li>
                ) : null}
                {listed.map((l) => ownRow(l.group, l.offSide))}
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
                        {said}
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
