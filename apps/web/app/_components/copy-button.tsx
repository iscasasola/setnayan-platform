'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Shared one-tap copy-to-clipboard button. Use for values a user would
 * otherwise hand-type — a payment amount, a reference code, an account number —
 * where a typo costs them (e.g. a mistyped reference breaks reconciliation).
 * (A near-identical button predates this in studio/papic/crew + panood; those
 * can fold into this later.)
 */
export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  className,
}: {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      aria-label={`${label}: ${value}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — the value stays visible + selectable */
        }
      }}
      className={
        className ??
        'inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-2.5 py-1 text-xs font-medium text-ink/75 hover:bg-ink/5'
      }
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2.25} />
          {copiedLabel}
        </>
      ) : (
        <>
          <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {label}
        </>
      )}
    </button>
  );
}
