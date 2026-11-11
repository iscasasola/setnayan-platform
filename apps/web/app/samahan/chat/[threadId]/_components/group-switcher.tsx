'use client';

/**
 * 💬 THE GROUP HEAD'S NAME ▾ (owner-approved drawing, 12 Nov — "Group head · name ▾ opens the group list"): the name is
 * a button; ▾ opens a SHEET of choices — your groups on this event, each "N inside · its line", the one you are in
 * ticked — never a cycle. The shipped `Sheet` (half height, drag up for more, 2026-11-12). Loaded only when a group is
 * opened (`next/dynamic` from the page).
 */
import Link from 'next/link';
import { useId, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';

export type SwitcherGroup = { threadId: string; name: string; line: string; href: string; left: boolean };

export default function GroupSwitcher({ name, currentId, groups }: { name: string; currentId: string; groups: readonly SwitcherGroup[] }) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <>
      <button
        type="button"
        className="sn-press inline-flex min-h-[44px] max-w-full items-center gap-1 text-left"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-group-switcher=""
      >
        <span className="truncate text-[17px] font-semibold text-ink">{name}</span>
        <ChevronDown aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={2.2} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId} rise>
        <div className="px-5 pb-5 pt-5" data-group-switcher-sheet="">
          <h2 id={headingId} className="pr-12 text-[17px] font-semibold text-ink">
            Your groups
          </h2>
          <ul role="listbox" aria-labelledby={headingId} className="mt-2 divide-y divide-ink/10">
            {groups.map((g) => {
              const on = g.threadId === currentId;
              return (
                <li key={g.threadId} role="option" aria-selected={on}>
                  <Link
                    href={g.href}
                    onClick={() => setOpen(false)}
                    className={`sn-press flex min-h-[48px] items-center gap-3 py-1.5 ${g.left ? 'opacity-55' : ''}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold text-ink">{g.name}</span>
                      <span className="block truncate text-[13px] text-ink/60">{g.line}</span>
                    </span>
                    {on ? <Check aria-hidden className="h-5 w-5 shrink-0 text-sn-accent" strokeWidth={2.4} /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </Sheet>
    </>
  );
}
