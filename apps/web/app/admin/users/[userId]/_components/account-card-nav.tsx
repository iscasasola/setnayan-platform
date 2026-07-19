import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

/**
 * Account Card — the lifecycle strip + the tab rail (admin / HQ variant).
 *
 * Design source: 03_Strategy/Customer_Card_Prototype_2026-07-03.html (admin
 * variant, owner-approved in-session 2026-07-03). Mirrors the vendor Customer
 * Card chrome (customer-card-nav.tsx) so the two surfaces read the same, but the
 * sales pipeline is replaced with an account-lifecycle strip and the tab set is
 * the HQ five (Overview / Money / Support / Activity / Governance).
 *
 * Pure server render — the tab rail is `?tab=` Link-driven so the whole card
 * stays a server component (no client state). Mobile: both rails are
 * horizontally scrollable.
 */

export type AccountCardTab = 'overview' | 'money' | 'support' | 'activity' | 'governance';

export const ACCOUNT_TABS: { key: AccountCardTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'money', label: 'Money' },
  { key: 'support', label: 'Support' },
  { key: 'activity', label: 'Activity' },
  { key: 'governance', label: 'Governance' },
];

export function normalizeAccountTab(raw: string | undefined): AccountCardTab {
  return ACCOUNT_TABS.some((t) => t.key === raw) ? (raw as AccountCardTab) : 'overview';
}

export function AccountTabs({ userId, active }: { userId: string; active: AccountCardTab }) {
  return (
    <nav
      aria-label="Account sections"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:gap-1 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ACCOUNT_TABS.map((t) => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={
              t.key === 'overview'
                ? `/admin/users/${userId}`
                : `/admin/users/${userId}?tab=${t.key}`
            }
            aria-current={on ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 text-sm font-medium transition sm:rounded-none sm:border-x-0 sm:border-t-0 sm:border-b-2 sm:px-3 sm:py-2 ${
              on
                ? 'border-ink bg-ink text-cream sm:border-terracotta sm:bg-transparent sm:text-ink'
                : 'border-ink/15 bg-white text-ink/60 hover:text-ink sm:border-transparent sm:bg-transparent'
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Lifecycle strip: Signed up → Onboarded → First event → First purchase → Active.
//
// Each step is either reached or not (a boolean derived by the page from cheap
// existing data). `reachedCount` = how many of the 5 leading steps are reached;
// the furthest reached step is highlighted as "current". Steps we can't derive
// cheaply are dropped from LIFECYCLE_STEPS entirely rather than faked.
// ---------------------------------------------------------------------------

export type LifecycleStep = { key: string; label: string; reached: boolean; at: string | null };

export function LifecycleStrip({ steps }: { steps: LifecycleStep[] }) {
  // Current = the furthest reached step (last index where reached is true).
  let currentIdx = -1;
  steps.forEach((s, i) => {
    if (s.reached) currentIdx = i;
  });
  return (
    <ol
      aria-label="Account lifecycle"
      className="-mx-4 flex items-center gap-0 overflow-x-auto px-4 py-1 sm:mx-0 sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {steps.map((s, i) => {
        const isCurrent = i === currentIdx;
        const done = s.reached && !isCurrent;
        return (
          <li key={s.key} className="flex shrink-0 items-center">
            <span className="flex shrink-0 items-center gap-2">
              <span
                aria-hidden
                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[11px] font-semibold ${
                  isCurrent
                    ? 'border-ink bg-ink text-cream ring-4 ring-ink/10'
                    : done
                      ? 'border-success-600 bg-success-600 text-white'
                      : 'border-ink/15 bg-white text-ink/40'
                }`}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} /> : i + 1}
              </span>
              <span
                className={`whitespace-nowrap text-xs font-medium ${
                  isCurrent ? 'text-ink' : s.reached ? 'text-ink/70' : 'text-ink/40'
                }`}
              >
                {s.label}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={`mx-2 h-0.5 w-6 shrink-0 ${s.reached ? 'bg-success-600' : 'bg-ink/15'}`}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
