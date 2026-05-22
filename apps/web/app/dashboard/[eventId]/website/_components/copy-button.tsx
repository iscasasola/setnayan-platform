'use client';

import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';

/**
 * Polite-brand-voice copy-to-clipboard button. Server-rendered parent passes
 * the URL + the icon/label children + the className for styling. We swap the
 * label to "Copied" with a check icon for ~1.6s after success.
 *
 * Falls back silently if the Clipboard API is blocked (some embedded PWA
 * contexts) — the parent surface still shows the URL in plain text so a
 * long-press / manual copy works.
 */
export function CopyButton({
  text,
  className,
  children,
  copiedLabel = 'Copied',
}: {
  text: string;
  className?: string;
  children: ReactNode;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard API blocked — surface remains usable via plain-text URL.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={className}
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          <span>{copiedLabel}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}
