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
  // P-06 (final check): the page does not print the link, so a blocked clipboard left the person with nothing.
  // When the copy fails, the link itself is shown, selected-ready, under the button.
  const [blocked, setBlocked] = useState(false);

  return (
    <span className="inline-flex flex-col items-start gap-1.5">
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setBlocked(false);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          setBlocked(true);
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
    {blocked ? (
      <span role="status" className="text-xs text-ink/70">
        Couldn&rsquo;t copy on this device. Press and hold to copy:{' '}
        <span className="select-all break-all font-medium text-ink">{value}</span>
      </span>
    ) : null}
    </span>
  );
}
