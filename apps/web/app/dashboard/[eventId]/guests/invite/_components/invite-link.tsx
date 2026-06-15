'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * InviteLink — the couple's one shareable join link with a copy-to-clipboard
 * affirmation. Local to the Invite stage (kept out of a shared module to avoid a
 * cross-feature import per [[project_setnayan_app_linking_contract]]); mirrors the
 * panood CopyLink interaction. The URL stays visible so a long-press copy still
 * works if the Clipboard API is blocked (restricted PWA contexts).
 */
export function InviteLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard blocked — the URL is still selectable in the field.
    }
  }

  return (
    <div className="flex items-stretch gap-2 rounded-lg border border-ink/10 bg-cream p-1">
      <input
        readOnly
        value={url}
        aria-label="Your guest invite link"
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 bg-transparent px-2.5 py-2 font-mono text-xs text-ink/85 outline-none"
      />
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-terracotta/10 px-3 py-2 text-sm font-medium text-terracotta-700 transition-colors hover:bg-terracotta/20"
        aria-live="polite"
      >
        {copied ? (
          <>
            <Check aria-hidden className="h-4 w-4" strokeWidth={2} /> Copied
          </>
        ) : (
          <>
            <Copy aria-hidden className="h-4 w-4" strokeWidth={2} /> Copy link
          </>
        )}
      </button>
    </div>
  );
}
