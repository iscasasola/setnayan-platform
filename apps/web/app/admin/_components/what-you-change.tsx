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
 * 🔑 THE NUMBERS ARE LIVE, NEVER TYPED. The tiles used to print the snapshot above
 * ("34 changes · 52%") as if it were current. They now read `admin_audit_log`
 * over the trailing window (`lib/admin/what-you-change.ts`). A count that could
 * not be read prints NO number — never "0 changes".
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
import { formatCount } from '@/lib/format-number';
import {
  WHAT_YOU_CHANGE_WINDOW_DAYS,
  type WhatYouChangeCounts,
} from '@/lib/admin/what-you-change';

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
  Icon: LucideIcon;
};

export const WHAT_YOU_CHANGE: readonly Job[] = [
  { key: 'pricing',      label: 'Prices & what we sell', Icon: Tag },
  { key: 'taxonomy',     label: 'Categories',            Icon: Shapes },
  { key: 'demo-vendors', label: 'Test data',             Icon: FlaskConical },
  { key: 'verify',       label: 'Shops',                 Icon: Store },
  { key: 'website',      label: 'The website',           Icon: Globe },
  { key: 'users',        label: 'Your team',             Icon: UserCog },
];

/** "4 changes · 6%" — or nothing at all when the count could not be read. */
function noteFor(count: number | null, percent: number | null): string | null {
  if (count === null) return null;
  const n = `${formatCount(count)} ${count === 1 ? 'change' : 'changes'}`;
  return percent === null ? n : `${n} · ${percent}%`;
}

export function WhatYouChange({ counts }: { counts: WhatYouChangeCounts }) {
  // The hairline is each job's count against the busiest job, so it is always live too.
  const busiest = Math.max(0, ...WHAT_YOU_CHANGE.map((j) => counts.byKey[j.key]?.count ?? 0));
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
      <p className="mt-1 text-xs text-ink/55">
        Your admin changes over the last {WHAT_YOU_CHANGE_WINDOW_DAYS} days.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {WHAT_YOU_CHANGE.map(({ key, label, Icon }) => {
          const c = counts.byKey[key];
          const note = noteFor(c?.count ?? null, c?.percent ?? null);
          const share = busiest > 0 && c?.count ? Math.round((c.count / busiest) * 100) : 0;
          return (
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
            {note ? (
              <span className="mt-auto font-mono text-[10px] tracking-wide text-ink/55">
                {note}
              </span>
            ) : null}
            {/* The hairline is decoration carrying real information: how much of
                the owner's recorded work this job is. Gold is legal here because
                it is a RULE, not text (it measures 3.37:1 and must never be read). */}
            {note ? (
              <span
                aria-hidden
                className="mt-1.5 h-[3px] rounded-full bg-terracotta"
                style={{ width: `${share}%` }}
              />
            ) : null}
          </Link>
          );
        })}
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
