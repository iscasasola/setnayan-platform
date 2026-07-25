'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Dices } from 'lucide-react';

// Write-only secret input for the Secrets & Rotation board.
//
// The field is UNCONTROLLED and never carries a defaultValue — the board has no
// copy of the current value to prefill, by design. Two behaviours on top of a
// plain password input:
//
//   1. WIPE ON COMPLETE. When the form action resolves, the field is cleared.
//      The successful path redirects (which remounts this anyway), but a
//      rejected save re-renders in place, and a pasted service-role key must not
//      sit in the DOM waiting for the next screenshot.
//   2. GENERATE. For self-generated secrets (CRON_SECRET & friends) the owner
//      shouldn't need a terminal. The value is minted here in the browser with
//      crypto.getRandomValues — 32 bytes, base64 — the same shape
//      `openssl rand -base64 32` produces. It never leaves the form except via
//      the server action.

function randomBase64Key(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export function SecretValueInput({
  name,
  label,
  placeholder,
  generateHint,
}: {
  name: string;
  label: string;
  placeholder?: string;
  /** When set, renders the "Generate" helper and shows the CLI equivalent. */
  generateHint?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const { pending } = useFormStatus();
  const wasPending = useRef(false);
  const [revealGenerated, setRevealGenerated] = useState(false);

  useEffect(() => {
    if (wasPending.current && !pending && ref.current) {
      ref.current.value = '';
      setRevealGenerated(false);
    }
    wasPending.current = pending;
  }, [pending]);

  const canGenerate = Boolean(generateHint) && generateHint !== undefined;

  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
        {label}
      </span>
      <input
        ref={ref}
        // A generated value is shown once so the owner can copy it into any
        // other system that needs the same secret; a pasted value stays masked.
        type={revealGenerated ? 'text' : 'password'}
        name={name}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore
        placeholder={placeholder ?? 'Paste the new value'}
        className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 font-mono text-sm outline-none focus:border-terracotta/50"
      />
      {canGenerate ? (
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (!ref.current) return;
              ref.current.value = randomBase64Key();
              setRevealGenerated(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1 text-[11px] font-medium text-ink/70 transition-colors hover:border-terracotta/50 hover:text-ink"
          >
            <Dices aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            Generate
          </button>
          <span className="font-mono text-[10px] text-ink/45">
            same as <code>{generateHint}</code>
          </span>
        </span>
      ) : null}
    </label>
  );
}
