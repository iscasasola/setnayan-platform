'use client';

import { useState } from 'react';
import { Share2, Check } from 'lucide-react';

/**
 * ProfileShareButton — the share doorway for a PUBLIC account profile
 * (social-share follow-through item #7c). ONE tap: the native share sheet
 * (navigator.share) on mobile, a copy-link fallback everywhere else. URL-share
 * only.
 *
 * Rendered by its callers ONLY when the profile is public AND has ≥1 public
 * chapter (public_profile_enabled = true + a listed celebration) — never on the
 * disabled or empty state. It lives in two places:
 *   • the profile settings "URL & handle" section, so the owner can find + share
 *     their public URL, and
 *   • the /u profile itself, as a discreet share affordance on the showcase.
 *
 * `url` is passed explicitly (not read from window) so the settings surface can
 * share the canonical /u/[slug] URL even though it's shown on a different page.
 */
export function ProfileShareButton({
  url,
  title,
  label = 'Share profile',
  className = 'sn-chip sn-press w-fit',
}: {
  url: string;
  title: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav && typeof nav.share === 'function') {
      try {
        await nav.share({ title, url });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy.
      }
    }
    try {
      await nav?.clipboard?.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard blocked — nothing else to do */
    }
  }

  return (
    <button
      type="button"
      onClick={share}
      className={className}
      aria-label="Share your public profile"
    >
      {copied ? (
        <>
          <Check aria-hidden className="h-3.5 w-3.5 text-success-700" strokeWidth={2} />
          Link copied
        </>
      ) : (
        <>
          <Share2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          {label}
        </>
      )}
    </button>
  );
}
