'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

type Props = {
  label: string;
  url: string;
  hint?: string;
};

// Small client widget for the camera-operator setup links + broadcaster URL.
// Pure mock — the URL is a stub the parent server component computes; this
// component just exposes the copy-to-clipboard interaction with a visible
// "Copied" affirmation. No network calls.
//
// TODO(0011): once the real broadcaster orchestrator ships, the URL prop
// should be a short-lived signed link with a session token. For the scaffold
// we render the slug-shaped placeholder verbatim.
export function CopyLink({ label, url, hint }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API may be blocked in some embedded contexts (PWA in
      // restricted mode). Fall back silently — the URL is still visible in
      // the input so the user can long-press to copy manually.
    }
  }

  return (
    <div className="space-y-1.5">
      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
        {label}
      </p>
      <div className="flex items-stretch gap-2 rounded-md border border-ink/10 bg-cream p-1">
        <input
          readOnly
          value={url}
          aria-label={label}
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 font-mono text-xs text-ink/85 outline-none"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-terracotta/10 px-2.5 py-1 text-xs font-medium text-terracotta-700 transition-colors hover:bg-terracotta/20"
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Copied
            </>
          ) : (
            <>
              <Copy aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              Copy
            </>
          )}
        </button>
      </div>
      {hint ? <p className="text-[11px] text-ink/55">{hint}</p> : null}
    </div>
  );
}
