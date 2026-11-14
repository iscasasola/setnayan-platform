'use client';

/**
 * AdminModeToggle — the top bar's Focus | Full switch (owner approved 14 Nov 2026, DECISION_LOG "ADMIN FOCUS | FULL —
 * APPROVED (v6)" (1)): icons only on a phone (a search bar = Focus, stacked rows = Full), icon + word from the dock
 * point up; the filled half is the mode you are in. Admin opens in Focus.
 *
 * The choice is a cookie the layout reads on the next render (`lib/admin/admin-mode.ts`), so the server draws the
 * right shell with no flash and no server action. Both halves are real links to /admin as well, so a press with no
 * script still lands somewhere sensible.
 */
import { useRouter } from 'next/navigation';
import { Rows3, Search } from 'lucide-react';
import { ADMIN_MODE_COOKIE, ADMIN_MODE_MAX_AGE, type AdminMode } from '@/lib/admin/admin-mode';

const HALVES: ReadonlyArray<{ mode: AdminMode; label: string; Icon: typeof Search }> = [
  { mode: 'focus', label: 'Focus', Icon: Search },
  { mode: 'full', label: 'Full', Icon: Rows3 },
];

export function AdminModeToggle({ mode }: { mode: AdminMode }) {
  const router = useRouter();
  const choose = (next: AdminMode) => {
    try {
      document.cookie = `${ADMIN_MODE_COOKIE}=${next}; path=/; max-age=${ADMIN_MODE_MAX_AGE}; samesite=lax`;
    } catch {
      /* A refused cookie only means the choice is not remembered; the link below still lands. */
    }
    router.push('/admin');
    router.refresh();
  };
  return (
    <div
      role="radiogroup"
      aria-label="Mode"
      className="inline-flex shrink-0 gap-0.5 rounded-full p-[3px]"
      style={{ background: 'var(--sn-paper)' }}
      data-admin-mode={mode}
    >
      {HALVES.map(({ mode: m, label, Icon }) => {
        const on = m === mode;
        return (
          <a
            key={m}
            href="/admin"
            role="radio"
            aria-checked={on}
            aria-label={label}
            title={label}
            onClick={(e) => {
              e.preventDefault();
              if (!on) choose(m);
            }}
            className="inline-flex min-h-10 min-w-11 items-center justify-center gap-1.5 rounded-full px-3 text-[13px] font-semibold"
            style={
              on
                ? { background: 'rgb(var(--sn-accent))', color: 'rgb(var(--sn-on-accent))' }
                : { color: 'var(--sn-ink-500)' }
            }
          >
            <Icon aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span className="hidden lg:inline">{label}</span>
          </a>
        );
      })}
    </div>
  );
}
