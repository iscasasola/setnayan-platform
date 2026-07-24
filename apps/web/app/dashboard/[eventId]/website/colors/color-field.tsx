'use client';

import { useId, useState } from 'react';
import { RotateCcw } from 'lucide-react';

/**
 * One colour input for the Website Pro "Site colours" editor (§4.4 · PR-C).
 * A native swatch picker + a synced hex text box + a "Use my palette" reset.
 *
 * The emitted form value (the `name`d text input) is EITHER a `#rrggbb` hex or
 * the empty string. Empty = "clear" — the couple falls back to their Mood-Board
 * palette for this role. The parent server action (`updateSiteColors`) is the
 * validator of record; this component just keeps the picker + text in sync and
 * offers a clean way to reset to empty (the native `<input type=color>` cannot
 * hold an empty value, so a separate Reset is the only way to clear it).
 */
export function ColorField({
  name,
  label,
  help,
  initial,
  fallbackHex,
}: {
  name: string;
  label: string;
  help: string;
  /** Current stored value (`#rrggbb`) or '' when unset (using the palette). */
  initial: string;
  /** The swatch shown while cleared — the palette/brand colour this overrides. */
  fallbackHex: string;
}) {
  const [value, setValue] = useState(initial);
  const id = useId();
  const cleared = value === '';
  // The native picker always needs a concrete colour; show the fallback while cleared.
  const swatch = cleared ? fallbackHex : value;

  return (
    <div className="sn-tile space-y-3 p-5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="color"
          aria-label={`${label} — pick a colour`}
          value={swatch}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          className="h-10 w-14 shrink-0 cursor-pointer rounded-md border border-ink/15 bg-transparent p-0.5"
        />
        <input
          id={id}
          name={name}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Using your palette"
          pattern="^#[0-9a-fA-F]{6}$"
          className="input-field w-40 font-mono text-sm"
        />
        <button
          type="button"
          onClick={() => setValue('')}
          disabled={cleared}
          className="inline-flex items-center gap-1.5 rounded-full border border-ink/20 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors enabled:hover:border-ink/40 disabled:opacity-40"
        >
          <RotateCcw aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          Use my palette
        </button>
      </div>
      <p className="text-xs text-ink/55">{help}</p>
    </div>
  );
}
