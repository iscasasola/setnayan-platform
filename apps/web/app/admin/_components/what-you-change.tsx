/**
 * WHAT YOU CHANGE — the six things the owner's own record shows he actually does,
 * on the screen he lands on.
 *
 * WHY. The Overview is a well-designed QUEUE page: the exception desk, the lane
 * bento and More queues all answer "what needs me". Nothing on it answers "what
 * do I want to change" — and that is the half the record says he spends his time
 * in. Measured from `admin_audit_log`, 20 May – 8 Aug 2026: **65 admin actions,
 * every one of which falls into six groups, with nothing left over.**
 *
 *   Prices & what we sell  34 · 52%      Shops           6 ·  9%
 *   Categories              9 · 14%      The website     4 ·  6%
 *   Test data               9 · 14%      Your team       3 ·  5%
 *
 * 🔑 THE WORD "PRICING" APPEARED **ZERO TIMES** ON THIS PAGE. More than half of
 * everything he has ever done in the console had no entry on its front screen,
 * while twelve queue tiles reading zero did. That is the whole defect; the rest
 * of the Overview is deliberate and is left exactly as it is.
 *
 * ⚠ NOTHING HERE IS A NEW DESTINATION. Every tile resolves its href from the
 * canonical ADMIN_NAV_GROUPS by key, so a nav change carries the tile with it and
 * the two can never drift. A key that stops existing throws at build time rather
 * than shipping a dead tile — see `hrefFor`.
 *
 * ⚖ The shares are FIXED, not recomputed per render. A leaderboard that reorders
 * itself under you is worse than a stable list: the six are a statement about what
 * this product needs, not a scoreboard, and a home that rearranges on a stray
 * click teaches you to stop trusting where things are.
 */

import Link from 'next/link';
import {
  Tag,
  Shapes,
  FlaskConical,
  Store,
  Globe,
  UserCog,
  Laptop,
  type LucideIcon,
} from 'lucide-react';

import { ADMIN_NAV_GROUPS } from './admin-nav-groups';

/** Every nav item, flattened once, so a tile can find its own destination. */
function hrefFor(key: string): string {
  for (const group of ADMIN_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.key === key) return item.href;
    }
  }
  // A tile pointing nowhere is a dead tap. Fail loudly at render, not silently.
  throw new Error(
    `what-you-change: no nav item with key "${key}". The six tiles derive their ` +
      'destinations from ADMIN_NAV_GROUPS — if a key was renamed there, rename it here too.',
  );
}

type Job = {
  /** Nav key — the destination is DERIVED from it, never typed twice. */
  key: string;
  /** What the owner calls the job, which is not always what the page is called. */
  label: string;
  /** The share of his recorded admin actions this job accounts for. */
  note: string;
  /** 0–100, for the hairline under the label. */
  share: number;
  Icon: LucideIcon;
};

export const WHAT_YOU_CHANGE: readonly Job[] = [
  { key: 'pricing',      label: 'Prices & what we sell', note: '34 changes · 52%', share: 100, Icon: Tag },
  { key: 'taxonomy',     label: 'Categories',            note: '9 changes',        share: 26,  Icon: Shapes },
  { key: 'demo-vendors', label: 'Test data',             note: '9 changes',        share: 26,  Icon: FlaskConical },
  { key: 'verify',       label: 'Shops',                 note: '6 changes',        share: 18,  Icon: Store },
  { key: 'website',      label: 'The website',           note: '4 changes',        share: 12,  Icon: Globe },
  { key: 'users',        label: 'Your team',             note: '3 changes',        share: 9,   Icon: UserCog },
];

export function WhatYouChange() {
  return (
    /* 📱 HIDDEN ON A PHONE — owner 2026-08-26: *"for mobile version, we only
     * provide quick answers. no editing of settings or features. just responses
     * for those that needs decision and response."*
     *
     * Every one of these six is an editing door — prices, categories, the
     * website, test data. On a phone the console is the list of things waiting
     * on a decision and the means to answer them, so these stand down and the
     * screen says where they went instead of leaving a silent gap. */
    <section aria-label="What you change" className="mb-8 hidden lg:block">
      <h2 className="sn-sec">What you change</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {WHAT_YOU_CHANGE.map(({ key, label, note, share, Icon }) => (
          <Link
            key={key}
            href={hrefFor(key)}
            className="group flex min-h-[92px] flex-col gap-1 rounded-xl border border-ink/15 bg-paper p-4 transition-colors hover:border-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-mulberry"
          >
            <Icon
              aria-hidden
              strokeWidth={1.7}
              className="h-[18px] w-[18px] text-terracotta transition-transform group-hover:scale-110"
            />
            <span className="text-sm font-semibold leading-tight text-ink">{label}</span>
            {/* Space Mono for the count — the data face this console already uses. */}
            <span className="mt-auto font-mono text-[10px] tracking-wide text-ink/55">
              {note}
            </span>
            {/* The hairline is decoration carrying real information: how much of
                the owner's recorded work this job is. Gold is legal here because
                it is a RULE, not text (it measures 3.37:1 and must never be read). */}
            <span
              aria-hidden
              className="mt-1.5 h-[3px] rounded-full bg-terracotta"
              style={{ width: `${share}%` }}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * What a phone sees where the six would have been.
 *
 * ⚖ A GAP IS NOT AN ANSWER. Hiding the tiles without saying so reads as a
 * broken screen or a missing feature; saying it reads as a decision. Kept in
 * this file next to the thing it explains, so the two cannot drift apart.
 */
export function EditingIsOnTheComputer() {
  return (
    <p className="mb-8 flex items-start gap-2.5 rounded-xl border border-dashed border-ink/15 p-4 text-sm text-ink/70 lg:hidden">
      <Laptop aria-hidden strokeWidth={1.7} className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" />
      <span>
        <strong className="font-semibold text-ink">
          Prices, the website and settings are on the computer.
        </strong>{' '}
        This screen is for answering what needs a decision — it does not change how
        Setnayan works.
      </span>
    </p>
  );
}
