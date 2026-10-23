'use client';

import { useId, useState } from 'react';
import { Plus } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';

/**
 * THE LIBRARY'S ONE DOOR TO THE UPLOADER — "Add the first memory" on an empty library, "+ Add photos" on
 * the library's top bar once it has something in it.
 *
 * Owner 2026-10-23, on the separate "Add to your library" sheet: *"i think this can be integrated on the
 * gallery"* — and, pointing at the dark "Your library" card: *"this is the gallery"*. The uploader used to
 * live behind a "Your uploads" row further down the page, and the library's button only scrolled to it.
 *
 * ⚠ A DIFFERENT DOOR TO THE SAME CONTROL, NEVER A SECOND COPY. `children` is the shipped uploader
 * (`AddToLibrary`, or its "Turn this on" form) rendered as it ships — same seat, same metering, same
 * credit cost — exactly the rule `SourceRow` and `SettingRow` follow.
 *
 * 🎨 The stage is obsidian in BOTH themes (see `papic-stage.tsx`), so the colours are literals measured on
 * #17160F: the lit fill #C24E25 carries cream text (button FILL only), the quiet one is white on a 14 %
 * white wash. Both press at 44 px.
 */
export function AddPhotosDoor({
  label,
  tone,
  children,
}: {
  label: string;
  /** `lit` — the empty roll's one lit frame; `quiet` — the full library's top bar. */
  tone: 'lit' | 'quiet';
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const headingId = useId();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium ${
          tone === 'lit' ? 'text-cream' : 'text-white'
        }`}
        style={{ backgroundColor: tone === 'lit' ? '#C24E25' : 'rgba(255,255,255,0.14)' }}
      >
        {tone === 'quiet' ? <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> : null}
        {label}
      </button>
      {open ? (
        <Sheet open onClose={() => setOpen(false)} labelledById={headingId} title="Add to your library" wide>
          <h2 id={headingId} className="sr-only">
            Add to your library
          </h2>
          {children}
        </Sheet>
      ) : null}
    </>
  );
}
