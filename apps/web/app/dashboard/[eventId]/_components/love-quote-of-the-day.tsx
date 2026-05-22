'use client';

/**
 * Love-quote-of-the-day · 5-second once-per-day popup banner (client component).
 *
 * Owner directive 2026-05-22 (verbatim · 4 changes bundled in PR for this row):
 *   1. "pops up for 5 seconds ONCE per day · disappears after · reappears
 *       next day just once."
 *   2. "REWRITE all entries to align with wedding planning PRESSURE +
 *       motivate the host to KEEP PUSHING FORWARD + STAY IN LOVE through
 *       the stress."  → handled in lib/love-quotes.ts (rewrite of every
 *       entry into pressure-aware tone).
 *   3. "Visibility scoped to bride · groom · partner1 · partner2. Other
 *       hosts (parents · ninong · ninang · planner · MOH · best man ·
 *       family_helper · viewer) DON'T see the quote. It's the couple's
 *       intimate daily moment."
 *   4. "TWO parallel 365-day quote sets · one for the BRIDE · one for the
 *       GROOM."  → handled in lib/love-quotes.ts (LOVE_QUOTES_BRIDE +
 *       LOVE_QUOTES_GROOM); partner1/partner2 alternate by day-parity.
 *
 * Surface: anchored to the top of `/dashboard/[eventId]` event home, sliding
 * in from the top edge for ~5 seconds once per calendar day per browser, then
 * fading out. Rendered ABOVE the WelcomeHeader (no layout shift; uses fixed
 * positioning).
 *
 * Behavior:
 *   - `daysToWedding === null`  → returns null (no real day picked yet).
 *   - `roleSubtype === null` or not in the bride/groom/partner1/partner2 set
 *     → returns null. Parents, planners, MOH, best man, ninong, ninang,
 *     family_helper, viewer don't see the popup. It is for the couple.
 *   - localStorage key `setnayan_love_quote_shown_YYYY-MM-DD` records that
 *     today's popup already fired. Once present, the effect bails before
 *     setVisible(true), so reloads + navigations within the same calendar
 *     day don't re-fire. New day → new key → popup re-fires once.
 *   - 4500 ms visible window then 500 ms fade — net visible-to-eye duration
 *     is about 5 seconds, matching the owner's "5-second" directive.
 *
 * Accessibility:
 *   - `role="status"` + `aria-live="polite"` so screen readers announce the
 *     quote without interrupting current focus.
 *   - Semantic `<blockquote>` + `<figcaption>` markup preserved.
 *   - prefers-reduced-motion: tailwindcss-animate already respects the OS
 *     setting via the project's reduced-motion CSS in app/globals.css L106.
 *   - 4.5:1 contrast: cream/95 bg + ink/85 text clears WCAG AA on this brand.
 *
 * Voice (per [[feedback_setnayan_no_dev_text_post_launch]] + CLAUDE.md
 *   2026-05-12 "luxurious, Filipino, modern" lock):
 *   - Cormorant-italic-display blockquote
 *   - DM Mono accent eyebrow for the source attribution
 *   - cream/95 + backdrop-blur + terracotta/30 border subtle popup chrome
 *
 * No DB schema. No server side. Pure content lookup via `quoteForDay()` plus
 * one localStorage read/write per render.
 */

import { useEffect, useState } from 'react';
import { quoteForDay, type LoveQuote, type LoveQuoteRole } from '@/lib/love-quotes';

const ELIGIBLE_ROLES: ReadonlySet<string> = new Set([
  'bride',
  'groom',
  'partner1',
  'partner2',
]);

function isLoveQuoteRole(value: string | null): value is LoveQuoteRole {
  return value !== null && ELIGIBLE_ROLES.has(value);
}

/**
 * Today's localStorage key. YYYY-MM-DD format keyed on the browser's local
 * timezone so a host in PH sees a fresh quote on a fresh PH-local day, not
 * a UTC rollover at 8 AM Manila.
 */
function todayLocalDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

type Props = {
  /** Days until wedding. `null` when the host hasn't picked a real day yet. */
  daysToWedding: number | null;
  /**
   * The current viewer's event_moderators.role_subtype, or null when the
   * viewer has no event_moderators row on this event (legacy event_members
   * pattern OR not a moderator). Quote only fires for bride/groom/partner1/
   * partner2; everyone else sees nothing.
   */
  roleSubtype: string | null;
};

export function LoveQuoteOfTheDay({ daysToWedding, roleSubtype }: Props) {
  const [quote, setQuote] = useState<LoveQuote | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Gate 1: no real wedding day yet → no popup
    if (daysToWedding === null) return;
    // Gate 2: role not in the couple set → no popup (owner directive 3)
    if (!isLoveQuoteRole(roleSubtype)) return;

    // Gate 3: already shown today on this browser → no popup
    let alreadyShown = false;
    let storageKey = '';
    try {
      storageKey = `setnayan_love_quote_shown_${todayLocalDateKey()}`;
      alreadyShown = window.localStorage.getItem(storageKey) !== null;
    } catch {
      // localStorage unavailable (Safari private mode, iframe sandboxing,
      // storage-disabled). Bail without showing — the popup is best-effort
      // delight, not load-bearing UX.
      return;
    }
    if (alreadyShown) return;

    // Resolve the quote for today
    const q = quoteForDay(daysToWedding, roleSubtype);
    if (!q) return;

    setQuote(q);
    setVisible(true);

    // Persist the showed-today marker BEFORE the timer fires so a fast
    // navigation during the visible window doesn't double-show on remount.
    try {
      window.localStorage.setItem(storageKey, '1');
    } catch {
      // Storage write failed — popup still shows this once but may re-fire
      // on next reload today. Acceptable degradation; better than silent
      // failure.
    }

    // Hide after 4500 ms so the fade-out completes around the 5s mark.
    const timer = window.setTimeout(() => setVisible(false), 4500);
    return () => window.clearTimeout(timer);
  }, [daysToWedding, roleSubtype]);

  if (!quote || !visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4 sm:px-6"
    >
      <figure
        className="pointer-events-auto w-full max-w-xl rounded-2xl border border-terracotta/30 bg-cream/95 px-5 py-4 shadow-lg backdrop-blur animate-in fade-in slide-in-from-top-4 duration-500 fill-mode-forwards"
      >
        <blockquote className="font-display text-base italic leading-relaxed text-ink/85 sm:text-lg">
          &ldquo;{quote.text}&rdquo;
        </blockquote>
        {quote.source ? (
          <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/55">
            — {quote.source}
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}
