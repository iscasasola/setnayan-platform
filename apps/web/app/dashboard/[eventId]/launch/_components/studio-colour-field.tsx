'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
/* The ONE picker — the Mood Board's. A static import on purpose: every caller of this field is
   itself lazy (Studio tools, the QR look, the Logo — all in the `maker-details` chunk), so the sheet
   rides that chunk and adds nothing to the Maker's first load (507 KB). */
import { ColourPickerSheet } from '../../studio/mood-board/_components/colour-picker-sheet';

/**
 * 🎨 A STUDIO COLOUR CONTROL (owner 2026-10-08: *"we already have a design for the color palettes and
 * how to pick colors on the moodboard. apply that same concept on the background and on any other
 * color rules parts"*). The row the prototype draws (`.lk-col` — the colour, its name and job, its
 * hex, a chevron); a tap opens the Mood Board's colour sheet, the SAME component the Attire colours
 * open — Your Mood Board (the five) · Goes with your Mood Board · From your photos · Swatches · Custom.
 * A pick is handed to `onPick` (the caller's own save); opening writes nothing.
 */
export function StudioColourField({
  name,
  job,
  value,
  palette,
  fromPhotos = [],
  onPick,
  extra,
  reset,
  slots = false,
  readsOn,
  data,
}: {
  /** The ground this colour's words sit on, where the caller KNOWS it — the sheet's "Against the background" line. */
  readsOn?: string | null;
  /** `palette` IS the five main colours in slot order — the sheet names them Dominant … Accent 2. */
  slots?: boolean;
  /** One way back to the default ("Use the plain ink") — a quiet button that closes the sheet and runs. */
  reset?: { label: string; onReset: () => void };
  /** "Headings", "Background". */
  name: string;
  /** What it colours — said under the name and beside the sheet's title. */
  job: string;
  value: string;
  /** The Mood Board's five — the sheet's first row. */
  palette: readonly string[];
  fromPhotos?: readonly string[];
  onPick: (hex: string) => void;
  /** One quiet row under the swatches ("Remove this colour"). */
  extra?: ReactNode;
  /** `data-studio-colour-field="<data>"`. */
  data: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-studio-colour-field={data}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${job} colour: ${value}`}
        onClick={() => setOpen(true)}
        className="sn-press relative mb-2 flex min-h-11 w-full items-center gap-2.5 rounded-full bg-cream py-1 pl-1.5 pr-3 text-left ring-1 ring-ink/10"
      >
        <span aria-hidden className="h-[30px] w-[30px] shrink-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]" style={{ backgroundColor: value }} />
        <span className="flex min-w-0 flex-1 flex-col leading-tight">
          <b className="text-[13.5px] font-semibold text-ink">{name}</b>
          <small className="text-[11px] text-ink/50">{job}</small>
        </span>
        <span className="font-mono text-[11px] text-ink/50">{value}</span>
        <ChevronDown aria-hidden className="h-3.5 w-3.5 shrink-0 text-gild" strokeWidth={2} />
      </button>
      {open ? (
        <ColourPickerSheet
          title={name}
          job={job}
          current={value}
          palette={palette}
          slots={slots}
          readsOn={readsOn}
          fromPhotos={fromPhotos}
          onPick={(hex) => {
            setOpen(false);
            onPick(hex);
          }}
          onClose={() => setOpen(false)}
          extra={
            <>
              {extra}
              {reset ? (
                <button
                  type="button"
                  data-studio-colour-reset={data}
                  onClick={() => {
                    setOpen(false);
                    reset.onReset();
                  }}
                  className="sn-press min-h-11 self-start rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink"
                >
                  {reset.label}
                </button>
              ) : null}
            </>
          }
        />
      ) : null}
    </>
  );
}
