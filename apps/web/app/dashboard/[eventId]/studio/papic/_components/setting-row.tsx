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
 *
 * ── ⚖ A ROW WHOSE SHEET HOLDS ONE SWITCH CARRIES THE SWITCH (owner 2026-09-22)
 * *"set the toggles here if it only needs toggle switches."* Opening a sheet to
 * find a single On/Off is two taps and a context change to do what the row
 * could have done in one — and the row was ALREADY showing the answer, so the
 * sheet added nothing but the act of closing it.
 *
 * `switchControl` is that switch, rendered ON the row. It is passed, never
 * derived: the shipped control keeps its own form, its own server action and
 * its own pending state, so this is still a different DOOR to the same control
 * rather than a second copy of it.
 *
 * ⚠ THE RULE HAS A HARD EDGE AND IT MATTERS. Only a sheet holding NOTHING BUT a
 * switch qualifies. A report the couple cannot set (blurred faces) and an OAuth
 * connect (Google Drive) keep their panels — neither is a switch, and flattening
 * them would put a control on the row that cannot do the thing it names.
 *
 * ⚠ AND THE ROW STAYS A DOOR. With a switch on it, the row itself is still
 * pressable and still opens the sheet, because the sheet holds the EXPLANATION —
 * what turning it off actually does to a guest. A switch with no way to read
 * what it means is a worse control than a sheet.
 */
export function SettingRow({
  icon,
  label,
  value,
  sheetTitle,
  switchControl,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  /** The answer as it stands — the reason a row can replace a card at all. */
  value: string;
  sheetTitle: string;
  /**
   * The ONE switch this setting needs, rendered on the row itself (owner
   * 2026-09-22: *"set the toggles here if it only needs toggle switches"*).
   * Omit it for anything that is not a switch — the sheet is still the door.
   */
  switchControl?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  return (
    <>
      {/* ⚠ THE SWITCH IS A SIBLING OF THE BUTTON, NEVER INSIDE IT. A <form> —
          and its submit button — nested in a <button> is invalid HTML, and the
          browser's recovery is to hoist it out, which silently detaches the
          control from the row it belongs to. `lint-nested-forms` holds this. */}
      <div className="flex w-full items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-ink/[0.03]"
        >
          {icon ? <span className="shrink-0 text-ink/45">{icon}</span> : null}
          <span className="min-w-0 flex-1 truncate text-sm text-ink">{label}</span>
          {/* With a switch on the row the switch IS the answer, so repeating
              "On" beside it is the same fact written twice. */}
          {switchControl ? null : (
            <span className="shrink-0 font-mono text-[11.5px] text-ink/55">{value}</span>
          )}
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
        </button>
        {switchControl ? <div className="shrink-0 pr-4">{switchControl}</div> : null}
      </div>

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
