'use client';

/**
 * Dynamic palette swatch editor for the dress-code editor.
 *
 * Each row carries a swatch name + a hex color (with the native color
 * picker so hosts don't have to type hex). The form picks up both via
 * parallel repeated fields — `palette_name[]` + `palette_hex[]`.
 *
 * Browsers normalize <input type="color"> to lowercase hex; the server
 * action uppercases it for stable display.
 */
import { useState } from 'react';
import { Plus, X } from 'lucide-react';

const NAME_MAX = 32;
const PALETTE_MAX = 6;

const SAMPLE_HEX = '#C97B4B';

type Swatch = { name: string; hex: string };

export function PaletteField({ initial }: { initial: Swatch[] }) {
  // Seed with one empty swatch row so the editor isn't blank on first load.
  const [rows, setRows] = useState<Swatch[]>(
    initial.length > 0 ? initial : [{ name: '', hex: SAMPLE_HEX }],
  );

  const handleHexChange = (index: number, hex: string) => {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, hex } : row)));
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={i}
            className="flex flex-wrap items-center gap-2 rounded-md border border-ink/10 bg-white p-2"
          >
            <span
              aria-hidden
              className="inline-block h-9 w-9 shrink-0 rounded-full ring-1 ring-ink/10"
              style={{ backgroundColor: row.hex }}
            />
            <input
              type="text"
              name="palette_name"
              defaultValue={row.name}
              maxLength={NAME_MAX}
              placeholder="Swatch name (Cream, Capiz, Terracotta)"
              className="min-w-0 flex-1 min-h-[40pt] rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus-visible:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta"
            />
            <input
              type="color"
              name="palette_hex"
              value={row.hex}
              onChange={(e) => handleHexChange(i, e.target.value)}
              className="h-11 w-14 cursor-pointer rounded-md border border-ink/15 bg-cream p-0.5"
              aria-label={`Color picker for swatch ${i + 1}`}
            />
            {rows.length > 1 ? (
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                aria-label={`Remove swatch ${i + 1}`}
                className="inline-flex h-11 w-11 min-h-[44pt] items-center justify-center rounded-md border border-ink/15 bg-cream text-ink/60 transition-colors hover:border-ink/30 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
              >
                <X aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      {rows.length < PALETTE_MAX ? (
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { name: '', hex: SAMPLE_HEX }])}
          className="inline-flex h-11 min-h-[44pt] items-center gap-2 rounded-md border border-dashed border-ink/25 bg-cream px-4 text-sm font-medium text-terracotta transition-colors hover:border-ink/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          <Plus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          <span>Add another swatch</span>
        </button>
      ) : (
        <p className="text-xs italic text-ink/55">
          Six swatches is the cap — keeps the palette readable on the landing page.
        </p>
      )}
    </div>
  );
}
