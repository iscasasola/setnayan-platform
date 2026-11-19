import Link from 'next/link';
import { BadgeCheck, ChevronRight, ImagePlus, Users } from 'lucide-react';

import { TODAY_WELCOME_LINE, TODAY_WELCOME_STEPS, welcomeTitle } from '@/lib/supplier-onboarding';

const ICON = { clients: Users, logo: ImagePlus, verify: BadgeCheck } as const;

/**
 * 🚪 TODAY'S WELCOME — THE LAST STOP OF EVERY SUPPLIER ONBOARDING DOOR (owner 2026-11-19, drawing `36jmQMWrANcgd2HxihAUw5`
 * v3/v4). Drawn when Today is opened with `?opened=1` (the self-serve and coordinator doors) or `?claimed=1` (a couple's
 * invite accepted — before 19 Nov nothing read it). Three next steps, in the owner's order: Add the clients you already
 * have · Add your logo (`/open-shop/logo` stays reachable from here) · Get verified. No leads are promised.
 * 🔒 lib/supplier-onboarding.test.ts
 */
export function TodayWelcome({ kind, shopName }: { kind: 'claimed' | 'opened'; shopName: string | null }) {
  return (
    <section className="sn-tile mb-4 grid gap-3 p-4 sm:p-5" aria-labelledby="today-welcome-title" data-today-welcome={kind}>
      <div className="grid gap-1">
        <h2 id="today-welcome-title" className="text-lg font-semibold text-ink">
          {welcomeTitle(kind, shopName)}
        </h2>
        <p className="text-sm text-ink/70">{TODAY_WELCOME_LINE}</p>
      </div>
      <ul className="grid gap-1.5">
        {TODAY_WELCOME_STEPS.map((s) => {
          const Icon = ICON[s.key];
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                className="flex min-h-12 items-center gap-3 rounded-xl px-2 py-2 text-[14.5px] font-medium text-ink hover:bg-ink/5"
                data-today-welcome-step={s.key}
              >
                <Icon aria-hidden className="h-5 w-5 shrink-0 text-mulberry" strokeWidth={1.75} />
                <span className="flex-1">{s.label}</span>
                <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
