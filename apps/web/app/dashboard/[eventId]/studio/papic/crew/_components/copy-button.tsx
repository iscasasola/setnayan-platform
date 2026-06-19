'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

// Tiny copy-to-clipboard button for a Papic seat claim link.

export function CopyButton({
  value,
  label = 'Copy link',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked — the visible link is still selectable */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 hover:bg-ink/5"
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-terracotta" strokeWidth={2.25} />
          Copied
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
