'use client';

import { useId, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';

/**
 * A CHOICE YOU MAKE ONCE, RENDERED AS ONE QUIET LINE.
 *
 * Owner, opening his own wedding's Papic page: *"entering papic inside an event
 * needs to me simpler and better to manage. if I am a customer and I see this,
 * I will be confused."* The first thing on that screen was five large gradient
 * cards asking him to pick a look — a decision he makes once, months before the
 * day, occupying the space where *"what do I do"* belongs.
 *
 * 🔑 THE RULE IS HOW OFTEN YOU TOUCH THE THING. A choice made once becomes a row
 * showing its current answer; a thing you come back to (the library, the ways
 * in, the credits) stays on the page; and a question we can answer ourselves
 * (photo quality, where photos go) was deleted outright on 2026-08-26.
 *
 * ⚠ THE PICKER ITSELF IS NOT REDRAWN — it is passed in as `children` and
 * rendered inside the sheet exactly as it ships, lock note and all. That is the
 * whole point: a row is a different DOOR to the same control, never a second
 * copy of it. A reimplementation here would be the thing this codebase pays for
 * most, and the shipped picker already carries behaviour a redraw would lose.
 *
 * ⚠ Server components pass through untouched. `children` is rendered, never
 * inspected, so an async server picker composes into this client wrapper
 * normally — no 'use client' needs to spread into the pickers themselves.
 */
export function SettingRow({
  icon,
  label,
  value,
  sheetTitle,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  /** The answer as it stands — the reason a row can replace a card at all. */
  value: string;
  sheetTitle: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]"
      >
        {icon ? <span className="shrink-0 text-ink/45">{icon}</span> : null}
        <span className="flex-1 text-sm text-ink">{label}</span>
        <span className="shrink-0 font-mono text-[11.5px] text-ink/55">{value}</span>
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
      </button>

      {/* ⚠ MOUNTED ONLY WHILE OPEN. The pickers inside carry forms and their own
          state; keeping them mounted behind a closed sheet leaves that state
          alive and, for a server child, keeps its work on the page for a screen
          nobody is looking at. */}
      {open ? (
        <Sheet open onClose={() => setOpen(false)} labelledById={headingId} title={sheetTitle}>
          <h2 id={headingId} className="sr-only">
            {sheetTitle}
          </h2>
          {children}
        </Sheet>
      ) : null}
    </>
  );
}
