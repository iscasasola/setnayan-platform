'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';

/**
 * ONE WAY INTO THE LIBRARY, AS ONE LINE.
 *
 * The Papic page used to open on three tabs — Photos · Cameras & shots · Set
 * up — and the first thing it asked a person to do was choose between them.
 * The approved control-centre drawing
 * (`prototypes/papic_control_center_2026-08-25.html`) replaces that choice with
 * the thing itself: **four ways in — crew cameras · guest cameras · your
 * uploads · suppliers** — each saying what it has contributed and what it is
 * waiting on. Its own port contract calls the tabs "Replaced", and says the
 * replacement must be *itemised, not silent*.
 *
 * 🔑 THIS IS THE SAME PRIMITIVE AS `SettingRow`, WITH A DIFFERENT JOB, and the
 * split is deliberate rather than duplication. A setting row answers *what did
 * I choose* — one value, one sheet. A source row answers *what is this way in
 * doing right now* — a blurb, a live state, and a door that is sometimes a
 * sheet and sometimes another page (the crew QR poster is a print surface; it
 * cannot live in a sheet). Folding the two together would give every settings
 * row a state slot nothing fills.
 *
 * ⚠ THE CONTROL BEHIND THE DOOR IS NEVER REDRAWN. Whatever is passed as
 * `children` is rendered inside the sheet exactly as it ships. That is the rule
 * this project pays for most when it is broken: a row is a different DOOR to
 * the same control, never a second copy of it.
 *
 * ⚠ A ROW WITH NOTHING BEHIND IT IS A GATE WITH NO HANDLE. Pass neither
 * `children` nor `href` only when the row is deliberately inert — the Suppliers
 * lane before the privacy ruling opens it — and say so in `state`. It then
 * renders as a line, not a button, so nothing offers a press that does nothing.
 */
export function SourceRow({
  icon,
  label,
  blurb,
  state,
  /** Terracotta-deep: this source is waiting on the couple for something. */
  attention = false,
  href,
  sheetTitle,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  blurb: string;
  state: string;
  attention?: boolean;
  href?: string;
  sheetTitle?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();

  const body = (
    <>
      {icon ? <span className="mt-0.5 shrink-0 text-ink/45">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink/60">{blurb}</span>
      </span>
      <span
        className={
          attention
            ? // ⚠ terracotta-700 is the DEEP terracotta (#9D3F1E, 6.3:1 on white),
              // not the gold slot. In this repo `terracotta` is the atelier GOLD
              // and the action colour lives under `mulberry` — inherited, and
              // backwards. The drawing's receipts name this exact pairing for a
              // waiting badge.
              'shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-mulberry-600'
            : 'shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-ink/50'
        }
      >
        {state}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink/[0.03]"
      >
        {body}
        <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
      </Link>
    );
  }

  if (!children) {
    // Inert on purpose — see the docblock. No button, no chevron, no promise.
    return <div className="flex w-full items-start gap-3 px-4 py-3.5 text-left">{body}</div>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink/[0.03]"
      >
        {body}
        <ChevronRight aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} />
      </button>

      {/* Mounted only while open — same reason as SettingRow: the controls
          inside carry forms and their own state, and a server child keeps doing
          its work for a screen nobody is looking at. */}
      {open ? (
        <Sheet
          open
          onClose={() => setOpen(false)}
          labelledById={headingId}
          title={sheetTitle ?? label}
        >
          <h2 id={headingId} className="sr-only">
            {sheetTitle ?? label}
          </h2>
          {children}
        </Sheet>
      ) : null}
    </>
  );
}
