'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Check, Lock, LogOut, Plus, UserPlus, Users } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { hostFirstName, hostInitials, type ChatHost } from '@/lib/chat-hosts';
import { showsAddAll, stripOrder } from '@/lib/chat-members';
import { setChatPeople, setPrivateTo } from './private-to';

/**
 * WHO IS IN THIS CHAT — the avatar strip under the picked client's pinned row (THE ONE BUILD, v111/v113: "Shared chat ·
 * N inside", initials 8 px apart, a sideways snap carousel when they overflow).
 *
 * The hosts come from the thread page; "You" is the viewer. Initials only — a profile photo is consent-gated
 * (`users.share_profile_photo_with_hosts`, B1 drift #8). The ring = "in this chat now", read from the stream's EXISTING
 * presence channel (`chat-presence-${threadId}` → `presentIds`, passed in) — this file opens no channel. "Online
 * elsewhere" / "N min ago" have no source in the app and are not drawn (spec §4: presence = the ring only).
 *
 * TAPPING A FACE (Supplier Build 3 · Lane A, every face a 44 px target, every action an `ActionButton`):
 *   🔒 someone else's face → **Message privately** (DECISION_LOG 2026-11-09 🔒) — the composer for this thread takes the
 *      chip (`private-to.ts`). Needs the `threadId`; without it the faces are pictures, as before.
 *   👥 YOUR OWN face, as a host → **Leave chat**, which asks first (DECISION_LOG 2026-11-09 👥, owner: the way to leave is
 *      your own face). The supplier and the coordinator have no Leave: the page passes no `leave`.
 *   👥 the ＋ after the faces — hosts and the coordinator only, NEVER the supplier (the page passes no `addable`): every
 *      event host not in this chat now, those who left included (never a coordinator or planner — always in), each with a
 *      tick; pick one or several, then Add. "Add all" sits on top when more than one is missing — ONE system line,
 *      "Lea added everyone". The rules are `lib/chat-members.ts`.
 *
 * `HostFaceMenu` and `AddHostsList` are exported only so a guard can draw each state without a click.
 */

export type AddableHost = ChatHost & {
  /** They were in this chat and left — adding them posts "… added Marco back". */
  left: boolean;
};

export type ChatHostAdd = {
  candidates: readonly AddableHost[];
  /** `how: 'all'` → the writer posts ONE line ("Lea added everyone"); `'picked'` → a line per person ("… back" if left). */
  add: (userIds: string[], how: 'all' | 'picked') => void | Promise<void>;
};

export function ChatHostStrip({
  hosts,
  presentIds,
  youId,
  threadId,
  addable = null,
  leave = null,
  viewerSide = 'vendor',
  calls = null,
}: {
  /** NULL = the hosts read was refused: said as such, never as an empty chat. */
  hosts: readonly ChatHost[] | null;
  presentIds: ReadonlySet<string>;
  youId: string;
  /** Given → the other faces open "Message privately" (the composer for this thread takes the chip). */
  threadId?: string;
  /** 👥 Hosts and the coordinator only — the supplier's page never passes it, so the ＋ is never drawn for them. */
  addable?: ChatHostAdd | null;
  /** 👥 A host only — your own face offers "Leave chat". */
  leave?: (() => void | Promise<void>) | null;
  /** Whose strip this is — the supplier's "You" stands first; a host's after the coordinator(s). */
  viewerSide?: 'vendor' | 'couple';
  /**
   * 📞 THE CHAT HEAD'S CALL · VIDEO CALL (`BookedCallButtons`) — inside a picked page the pinned row + this strip ARE the
   * head (the routed head is not drawn), so the page hands its booked call buttons here and they stand at the strip's
   * end, the same component and props as the routed head. Renders nothing for an unbooked shop (its own gate).
   * 🔒 lib/every-chat-head-has-its-calls.test.ts
   */
  calls?: ReactNode;
}) {
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // 🔒 The composer's 🔒 lists exactly these faces (you excluded) — published, never read twice. `setChatPeople`
  // emits only when the list changed, so running after every render is cheap.
  const others =
    hosts === null
      ? []
      : stripOrder(hosts, youId, viewerSide).flatMap((p) => (!p.isYou && p.host ? [{ userId: p.userId, name: hostFirstName(p.host) }] : []));
  useEffect(() => {
    if (threadId) setChatPeople(threadId, others);
  });
  if (hosts === null) {
    return (
      <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-2" data-chat-host-strip="unread">
        <p className="min-w-0 flex-1 text-xs text-ink/55" role="status">
          Couldn&rsquo;t load who is in this chat just now.
        </p>
        {calls ? <div className="shrink-0" data-chat-head-calls="">{calls}</div> : null}
      </div>
    );
  }
  // 👥 Supplier · coordinator/planner(s) · You · the other hosts — "You" in your own slot, never twice (`stripOrder`).
  const people = stripOrder(hosts, youId, viewerSide).map((p) =>
    p.isYou || !p.host
      ? { id: p.userId, initials: 'You', name: 'You' }
      : { id: p.userId, initials: hostInitials(p.host), name: hostFirstName(p.host) },
  );
  // The ＋ comes last, and only while at least one event host is not in this chat.
  const canAdd = Boolean(addable && addable.candidates.length > 0);
  const inNow = people.filter((p) => presentIds.has(p.id)).length;
  const open = menuFor ? people.find((p) => p.id === menuFor) ?? null : null;
  return (
    <div className="border-b border-ink/10 px-4 py-2" data-chat-host-strip="">
      {/* 🟢 THE RING IS NEVER CLIPPED (Build 2 #26b). `overflow-x-auto` clips on every side, and the ring draws OUTSIDE
          the avatar: ring-2 + ring-offset-2 = 4 px. So the list pads 4 px all round (`p-1`, pulled back with `-mx-1` so
          the first avatar still lines up with the line below) and snaps inside that padding (`scroll-px-1`). */}
      <div className="flex items-start gap-2">
      <ul
        className="-mx-1 flex min-w-0 flex-1 snap-x snap-mandatory scroll-px-1 gap-2 overflow-x-auto p-1 [scrollbar-width:none]"
        aria-label={`Shared chat · ${people.length} inside`}
      >
        {people.map((p) => {
          const here = presentIds.has(p.id);
          const face = (
            <span
              className={`grid h-9 w-9 place-items-center rounded-full bg-ink/[0.08] text-[11px] font-semibold text-ink/75 ${
                here ? 'ring-2 ring-success-600 ring-offset-2 ring-offset-cream' : ''
              }`}
              aria-hidden
            >
              {p.initials}
            </span>
          );
          const isYou = p.id === youId;
          const tappable = isYou ? Boolean(leave) : Boolean(threadId);
          return (
            <li key={p.id} className="flex shrink-0 snap-start flex-col items-center gap-0.5">
              {tappable ? (
                <button
                  type="button"
                  className="sn-press grid h-11 w-11 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-mulberry"
                  aria-label={isYou ? 'You — options' : `${p.name} — options`}
                  aria-controls="chat-host-menu"
                  aria-expanded={menuFor === p.id}
                  onClick={() => {
                    setAdding(false);
                    setMenuFor((was) => (was === p.id ? null : p.id));
                  }}
                  data-chat-host-face={isYou ? 'you' : p.id}
                >
                  {face}
                </button>
              ) : (
                <span className="grid h-11 w-11 place-items-center">{face}</span>
              )}
              <span className="max-w-[4.5rem] truncate text-[10.5px] text-ink/60">
                {p.name}
                <span className="sr-only">{here ? ' · in this chat now' : ''}</span>
              </span>
            </li>
          );
        })}
        {addable && canAdd ? (
          <li className="flex shrink-0 snap-start flex-col items-center gap-0.5">
            <button
              type="button"
              className="sn-press grid h-11 w-11 place-items-center rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-mulberry"
              aria-label="Add a host to this chat"
              aria-controls="chat-host-add"
              aria-expanded={adding}
              onClick={() => {
                setMenuFor(null);
                setAdding((was) => !was);
              }}
              data-chat-host-add-open=""
            >
              <span aria-hidden className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-ink/30 text-ink/60">
                <Plus className="h-4 w-4" strokeWidth={2} />
              </span>
            </button>
            <span className="text-[10.5px] text-ink/60">Add</span>
          </li>
        ) : null}
      </ul>
      {calls ? (
        <div className="flex shrink-0 items-center pt-1.5" data-chat-head-calls="">
          {calls}
        </div>
      ) : null}
      </div>
      <p className="text-[11px] text-ink/55">
        Shared chat · {people.length} inside{inNow > 0 ? ` · ${inNow} in the chat now` : ''}
      </p>
      {open ? (
        <HostFaceMenu
          who={open}
          isYou={open.id === youId}
          canMessage={Boolean(threadId)}
          leave={leave}
          onPrivate={() => {
            if (threadId) setPrivateTo(threadId, { userId: open.id, name: open.name });
            setMenuFor(null);
          }}
          onDone={() => setMenuFor(null)}
        />
      ) : null}
      {addable && canAdd && adding ? <AddHostsList addable={addable} onDone={() => setAdding(false)} /> : null}
    </div>
  );
}

/** The menu one face opens: someone else → Message privately; you (a host) → Leave chat, confirmed first. */
export function HostFaceMenu({
  who,
  isYou,
  canMessage,
  leave,
  onPrivate,
  onDone,
  initiallyConfirming = false,
}: {
  who: { id: string; name: string };
  isYou: boolean;
  canMessage: boolean;
  leave: (() => void | Promise<void>) | null;
  onPrivate: () => void;
  onDone: () => void;
  /** Guards only — draws the confirm step without a click. */
  initiallyConfirming?: boolean;
}) {
  const [confirming, setConfirming] = useState(initiallyConfirming);
  const [busy, setBusy] = useState(false);
  if (isYou) {
    if (!leave) return null;
    return (
      <div role="group" id="chat-host-menu" aria-label="You — options" className="mt-1.5 space-y-1.5" data-chat-host-menu="you">
        {confirming ? (
          <>
            <p className="text-[13px] text-ink" data-chat-leave-confirm="">
              Leave this chat? You stop seeing it until a host adds you back.
            </p>
            {/* Two equal choices, one row, equal widths. */}
            <div className="grid grid-cols-2 gap-2">
              <ActionButton tone="neutral" icon={Check} label="Stay" onClick={onDone} className="w-full" />
              <ActionButton
                tone="danger"
                main
                icon={LogOut}
                label="Leave"
                disabled={busy}
                className="w-full"
                onClick={async () => {
                  setBusy(true);
                  try {
                    await leave();
                  } finally {
                    setBusy(false);
                    onDone();
                  }
                }}
              />
            </div>
          </>
        ) : (
          <ActionButton tone="danger" icon={LogOut} label="Leave chat" onClick={() => setConfirming(true)} />
        )}
      </div>
    );
  }
  if (!canMessage) return null;
  return (
    <div role="group" id="chat-host-menu" aria-label={`${who.name} — options`} className="mt-1.5 flex" data-chat-host-menu="other">
      <ActionButton tone="info" icon={Lock} label="Message privately" name={`Message ${who.name} privately`} onClick={onPrivate} />
    </div>
  );
}

/** The ＋'s list: every event host not in this chat now (those who left too), a tick each, then one Add. */
export function AddHostsList({ addable, onDone, initiallyPicked = [] }: { addable: ChatHostAdd; onDone: () => void; initiallyPicked?: string[] }) {
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set(initiallyPicked));
  const [busy, setBusy] = useState(false);
  if (addable.candidates.length === 0) {
    return (
      <p id="chat-host-add" className="mt-1.5 text-[13px] text-ink/60" data-chat-host-add="empty">
        Every host of this event is already in this chat.
      </p>
    );
  }
  const run = async (ids: string[], how: 'all' | 'picked') => {
    setBusy(true);
    try {
      await addable.add(ids, how);
    } finally {
      setBusy(false);
      onDone();
    }
  };
  return (
    <div id="chat-host-add" className="mt-1.5 space-y-1" data-chat-host-add="">
      <ul className="divide-y divide-ink/10">
        {showsAddAll(addable.candidates) ? (
          <li>
            <button
              type="button"
              disabled={busy}
              className="sn-press flex min-h-[44px] w-full items-center gap-3 py-1 text-left"
              onClick={() => void run(addable.candidates.map((h) => h.userId), 'all')}
              data-chat-host-add-all=""
            >
              <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-sn-accent/10 text-sn-accent">
                <Users className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">Add all · {addable.candidates.length}</span>
            </button>
          </li>
        ) : null}
        {addable.candidates.map((h) => {
          const on = picked.has(h.userId);
          return (
            <li key={h.userId}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                className="sn-press flex min-h-[44px] w-full items-center gap-3 py-1 text-left"
                onClick={() =>
                  setPicked((was) => {
                    const next = new Set(was);
                    if (next.has(h.userId)) next.delete(h.userId);
                    else next.add(h.userId);
                    return next;
                  })
                }
                data-chat-host-candidate={h.userId}
              >
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.08] text-[11px] font-semibold text-ink/75">
                  {hostInitials(h)}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                  {hostFirstName(h)}
                  {h.left ? <span className="text-[12px] text-ink/55"> · left this chat</span> : null}
                </span>
                <span
                  aria-hidden
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${on ? 'border-sn-accent bg-sn-accent text-white' : 'border-ink/25'}`}
                >
                  {on ? <Check className="h-4 w-4" strokeWidth={2.4} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ActionButton
        tone="brand"
        main
        icon={UserPlus}
        label={picked.size > 1 ? `Add ${picked.size}` : 'Add'}
        disabled={picked.size === 0 || busy}
        className="w-full"
        onClick={() => void run([...picked], 'picked')}
        data-testid="chat-host-add-submit"
      />
    </div>
  );
}
