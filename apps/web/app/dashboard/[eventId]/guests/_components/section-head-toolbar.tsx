'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ActionButton, actionButtonClass, useFitRow } from '@/components/action-button';
import { PickMenu, type PickOption } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { formatCount } from '@/lib/format-number';
import { guestRoleLabel, type GuestRole } from '@/lib/guests';
import { clashWords } from '@/lib/group-name-clash';
import { roleNameMany, sectionName, type RoleNames } from '@/lib/role-names';
import { sectionUsualHeading } from '@/lib/entourage';
import { resolveRoleSet } from '@/lib/role-sets';
import { ROLE_GROUP_LABELS, type RoleGroup } from '@/lib/role-groups';
import { sectionHeadDoors, type SectionHeadAdd } from '@/lib/guest-section-head';
import { renameRole, renameSection, type RenameRoleResult } from '../role-name-actions';
import { useGuestActions } from './guest-actions-context';
import { useSetRoleNames } from './role-names-context';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';

/**
 * 🏷 THE SELECTED HEADER'S POP-UP TOOLBAR (R4 slice 4, owner 2026-10-29 — Guests prototype v20–v22, `renderToolbar`'s
 * `hubSel` branch): the selected group's name and count, then ✎ Rename · ＋ Add guest here · ✕. It floats just above
 * the thumb row, in the same seat, and leaves when the header is unselected (a second tap on it, or ✕).
 *
 *   · Rename edits IN PLACE (the toolbar becomes the name box — Enter keeps, Esc drops; the group picker's own strip
 *     shape). The write is the caller's — a shipped door (`renameRole` / `renameSection` / `editGuestGroupInPlace`);
 *     a refusal is said here, and the box stays.
 *   · ＋ Add guest here — ONE role lands here: a plain button. Several (Groomsmen = Best man · Best woman · Groomsman):
 *     ＋ ▾, a dropdown of them (any set of choices is a dropdown). The name itself is typed in the thumb row's box,
 *     which now says where it lands.
 * Nothing here writes on its own and no new server action exists for it.
 */
export function SectionHeadToolbar({
  label,
  count,
  rename,
  add,
  adding,
  onRename,
  onAdd,
  onClose,
  line,
  addWord = 'Add guest here',
  addMenuAlways = false,
  onDelete,
  onAddGroup,
  openRename = false,
}: {
  label: string;
  count: number;
  /** The small words beside the name, in place of "N guests" (the March: "3 walks · 5 walking"). */
  line?: string;
  /** The ＋'s word ("Walk" in the March). */
  addWord?: string;
  /** ＋ always opens its list, even with one choice (the March's ＋ Walk names who walks). */
  addMenuAlways?: boolean;
  /** 🗑 The group's Delete (the March: everyone in it to Not walking, one Undo). Absent = none. */
  onDelete?: () => void;
  /** 🏷 ＋ Group — a new group of the couple's own right after this one (the March, owner 2026-10-29). Absent = none. */
  onAddGroup?: () => void;
  /** ✎ Open with the name box already up (a group just made is named first — prototype v13 `newMarchGroup`). */
  openRename?: boolean;
  /** The word the box starts with, and whether an empty box is allowed (= the usual word again). Null = no Rename. */
  rename: { current: string; usual: string | null } | null;
  /** The roles a name added here takes (one = plain ＋; several = ＋ ▾); null = no add here. [] = an add with no role pick. */
  add: readonly PickOption[] | null;
  /** The thumb row's box is adding INTO this group right now. */
  adding: boolean;
  /** Keep the new word — answers a refusal to say, or null when it was kept. */
  onRename: (text: string) => Promise<string | null>;
  onAdd: (roleKey: string | null) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLInputElement>(null);
  const verbs = useRef<HTMLDivElement>(null);
  useFitRow(verbs);
  useEffect(() => {
    if (editing) box.current?.focus();
  }, [editing]);
  // A different header selected: the box closes, nothing is carried over — unless this one opens named-first.
  useEffect(() => {
    setEditing(Boolean(openRename && rename));
    if (openRename && rename) setDraft(rename.current || rename.usual || '');
    setErr(null);
    // Only a new selection decides it — not every render of the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  const keep = () => {
    if (!rename) return;
    const text = draft.trim();
    if (text === (rename.current || rename.usual || '').trim()) return setEditing(false);
    if (!text && rename.usual === null) return setErr('A group needs a name.');
    // The usual word typed back = no word of their own (blank is what the doors store for it).
    const send = rename.usual !== null && text === rename.usual ? '' : text;
    start(async () => {
      const refused = await onRename(send);
      if (refused) return setErr(refused);
      setEditing(false);
      setErr(null);
    });
  };

  return (
    <div className="sn-glass-bare flex min-w-0 flex-col gap-1.5 rounded-2xl p-1.5 ring-1 ring-ink/10" data-section-head-toolbar="" role="toolbar" aria-label={`${label} — group actions`}>
      {editing && rename ? (
        <div className="flex min-w-0 items-center gap-2" data-section-head-rename="">
          <input
            ref={box}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                keep();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(false);
                setErr(null);
              }
            }}
            placeholder={rename.usual ?? 'Group name'}
            aria-label={`New name for ${label}`}
            autoComplete="off"
            maxLength={rename.usual === null ? 64 : 40}
            className="input-field min-w-0 flex-1"
          />
          <ActionButton tone="brand" main icon={Check} label={pending ? 'Saving…' : 'Save'} waiting={pending} onClick={keep} />
          <ActionButton tone="neutral" quiet iconOnly icon={X} label="Cancel rename" disabled={pending} onClick={() => { setEditing(false); setErr(null); }} />
        </div>
      ) : (
        <>
          {/* The group on one line (its whole name, wrapped — never cut), ✕ at its end; the verbs on the line under it,
              so neither squeezes the other at 320. */}
          <div className="flex min-w-0 items-center gap-2 pl-1.5">
            <span className="min-w-0 flex-1 text-[13.5px] leading-tight text-ink [overflow-wrap:anywhere]">
              <b className="font-semibold">{label}</b>
              <span className="text-ink/60">
                {' · '}
                {adding ? 'type a name below — it lands here' : (line ?? `${formatCount(count)} ${count === 1 ? 'guest' : 'guests'}`)}
              </span>
            </span>
            <ActionButton tone="neutral" quiet iconOnly icon={X} label={`Unselect ${label}`} onClick={onClose} data-testid="section-head-close" />
          </div>
          {/* ONE ROW of verbs (owner's prototype v13 `renderToolbar`: Rename · ＋ Walk · ＋ Group · Delete on one line at
              390): compact pills (9 px sides, 16 px icons, 4 px gaps — every word whole), never a wrap; below that the house fit
              pass (`useFitRow`) drops icons, then secondary words, AS ONE — a word is never cut. */}
          <div ref={verbs} className="flex min-w-0 flex-nowrap items-center gap-1 [&_.ab]:gap-1 [&_.ab]:px-[9px] [&_.ab_svg]:size-4" data-section-head-verbs="">
            {rename ? (
              <ActionButton
                tone="neutral"
                icon={Pencil}
                label="Rename"
                onClick={() => {
                  setDraft(rename.current || rename.usual || '');
                  setErr(null);
                  setEditing(true);
                }}
                data-testid="section-head-rename"
              />
            ) : null}
            {add === null ? null : add.length > 1 || (addMenuAlways && add.length > 0) ? (
              <PickMenu
                label={`${addWord} — ${label}`}
                value={null}
                options={add}
                onPick={(k) => onAdd(k)}
                dataAttr="data-section-head-add"
                buttonText={addWord}
                className={actionButtonClass('brand', { main: true })}
                trigger={
                  <>
                    <Plus aria-hidden strokeWidth={1.9} />
                    <span className="lbl">{addWord}</span>
                    <ChevronDown aria-hidden className="-mr-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  </>
                }
              />
            ) : (
              <ActionButton tone="brand" main icon={Plus} label={addWord} onClick={() => onAdd(add[0]?.key ?? null)} data-testid="section-head-add" />
            )}
            {onAddGroup ? <ActionButton tone="neutral" icon={Plus} label="Group" onClick={onAddGroup} data-testid="section-head-add-group" /> : null}
            {onDelete ? <ActionButton tone="danger" icon={Trash2} label="Delete" onClick={onDelete} data-testid="section-head-delete" /> : null}
          </div>
        </>
      )}
      {err ? (
        <p role="alert" className="px-1.5 text-[12.5px] text-danger-700" data-section-head-error="">
          {err}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The toolbar for ONE selected section of the List — its doors read off `sectionHeadDoors` (lib/guest-section-head.ts),
 * its Rename run through the shipped doors: a role's word (`renameRole`), a section's heading (`renameSection`) — both
 * the ONE writer of `events.role_names`, and the list takes the new word at once (`useSetRoleNames`) — or an own group's
 * name (`editGuestGroupInPlace`, which revalidates the list). The add hands the screen the picks a name typed now needs.
 */
export function SectionHeadTools({
  eventId,
  section,
  groups,
  roleSetKey,
  roleNames,
  adding,
  onAdd,
  onRenamed,
  onClose,
}: {
  eventId: string;
  section: { key: string; label: string; count: number };
  groups: readonly { group_id: string; label: string }[];
  roleSetKey: string | null | undefined;
  roleNames: RoleNames | null | undefined;
  adding: boolean;
  /** What a name typed now takes so it lands in this section. */
  onAdd: (picks: SectionHeadAdd & { role?: GuestRole }) => void;
  /** A group renamed → its section's new key (the List is keyed by the group's name). */
  onRenamed: (nextKey: string) => void;
  onClose: () => void;
}) {
  const setNames = useSetRoleNames();
  const { editGuestGroupInPlace } = useGuestActions();
  const doors = sectionHeadDoors(section.key, { groups, offeredRoles: resolveRoleSet(roleSetKey ?? 'wedding').offeredRoles });
  const door = doors.rename;
  const rename =
    door === null
      ? null
      : door.kind === 'role'
        ? { current: roleNameMany(door.role, roleNames) ?? '', usual: ROLE_GROUP_LABELS[section.key.slice('role:'.length) as RoleGroup] ?? section.label }
        : door.kind === 'section'
          ? { current: sectionName(door.section, roleNames) ?? '', usual: sectionUsualHeading(door.section, roleNames) ?? section.label }
          : { current: section.label, usual: null };
  const words = async (run: () => Promise<RenameRoleResult>): Promise<string | null> => {
    const res = await hearAction(run);
    if (!res.ok) return plainRefusal('reason' in res ? res.reason : res.error, 'The new name was not saved — nothing was changed.');
    setNames(res.names);
    return null;
  };
  const onRename = async (text: string): Promise<string | null> => {
    if (door === null) return null;
    if (door.kind === 'role') return words(() => renameRole(eventId, door.role, text, null));
    if (door.kind === 'section') return words(() => renameSection(eventId, door.section, text));
    const res = await hearAction(() => editGuestGroupInPlace(eventId, door.groupId, { op: 'rename', label: text }));
    if (!res.ok || !('group' in res)) {
      const told = !res.ok && 'clash' in res ? res.clash : undefined;
      return told ? clashWords(told) : plainRefusal(res.ok ? '' : res.error, 'Couldn’t rename that group. Try again.');
    }
    onRenamed(`group:${res.group.label}`);
    return null;
  };
  const add = doors.add;
  const options: readonly PickOption[] | null =
    add === null ? null : (add.roles ?? []).map((r) => ({ key: r, label: guestRoleLabel(r, roleNames) }));
  return (
    <SectionHeadToolbar
      label={section.label}
      count={section.count}
      rename={rename}
      add={options}
      adding={adding}
      onRename={onRename}
      onAdd={(k) => {
        if (!add) return;
        const picks = { side: add.side, groupIds: add.groupIds };
        onAdd(k ? { ...picks, role: k as GuestRole } : picks);
      }}
      onClose={onClose}
    />
  );
}
