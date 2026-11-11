'use client';

/**
 * 🔒 THE COMPOSER'S 🔒 DOOR — DOOR 2 OF TWO (owner, 12 Nov: "Both doors + pick several" — DECISION_LOG "PRIVATE MESSAGES
 * — TWO DOORS, SEVERAL PEOPLE"; door 1 is a face in the "who is on" strip, one person). The 🔒 beside the ＋ opens this
 * list — the people in this chat, exactly the strip's faces (you excluded, published by the strip through
 * `private-to.ts`) — each row a TICK (role="checkbox"), and ONE button under them that says who it is for:
 * "Message Ana privately" · "Message 3 people privately". It puts the message box in private mode for them ("Private
 * message to Miguel and Tita Lu"). A reply opens with the same people ticked (`initiallyTicked` — the sender and the
 * other recipients of the newest private line written to you). Words only, never a filing picker.
 * 🔒 lib/a-private-message-looks-private.test.ts · lib/private-to-several-people.test.ts
 */
import { useState } from 'react';
import { Check, Lock } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { hostInitials } from '@/lib/chat-hosts';
import type { PrivateTo } from '@/lib/chat-private';

export const PRIVATE_PEOPLE_LIST_ID = 'chat-private-people';

/** The one button's words — how many it is for, never a bare "Send". */
export function privatePickLabel(picked: readonly PrivateTo[]): string {
  if (picked.length === 0) return 'Pick who';
  if (picked.length === 1) return `Message ${picked[0]!.name} privately`;
  return `Message ${picked.length} people privately`;
}

export function PrivatePeopleList({
  people,
  onPick,
  initiallyTicked = [],
}: {
  people: readonly PrivateTo[];
  onPick: (to: readonly PrivateTo[]) => void;
  /** User ids ticked when the list opens (a reply: the same people). Ids not in this chat are ignored. */
  initiallyTicked?: readonly string[];
}) {
  const [ticked, setTicked] = useState<ReadonlySet<string>>(
    () => new Set(initiallyTicked.filter((id) => people.some((p) => p.userId === id))),
  );
  const picked = people.filter((p) => ticked.has(p.userId));
  return (
    <div
      role="group"
      id={PRIVATE_PEOPLE_LIST_ID}
      aria-label="Message someone privately"
      className="flex flex-col gap-1 self-stretch"
      data-chat-private-people=""
    >
      <p className="text-[12px] text-ink/60">Only you and who you tick see it. Words only.</p>
      <ul className="divide-y divide-ink/10">
        {people.map((p) => {
          const on = ticked.has(p.userId);
          return (
            <li key={p.userId}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                className="sn-press flex min-h-[44px] w-full items-center gap-3 py-1 text-left"
                onClick={() =>
                  setTicked((was) => {
                    const next = new Set(was);
                    if (next.has(p.userId)) next.delete(p.userId);
                    else next.add(p.userId);
                    return next;
                  })
                }
                data-testid={`chat-private-person-${p.userId}`}
              >
                <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.08] text-[11px] font-semibold text-ink/75">
                  {hostInitials({ firstName: p.name, name: p.name })}
                </span>
                <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{p.name}</span>
                <span
                  aria-hidden
                  className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border ${
                    on ? 'border-[rgb(var(--color-private))] bg-[rgb(var(--color-private))] text-white' : 'border-ink/25'
                  }`}
                >
                  {on ? <Check className="h-4 w-4" strokeWidth={2.4} /> : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <ActionButton
        tone="info"
        main
        icon={Lock}
        label={privatePickLabel(picked)}
        disabled={picked.length === 0}
        className="w-full"
        onClick={() => onPick(picked)}
        data-testid="chat-private-pick"
      />
    </div>
  );
}
