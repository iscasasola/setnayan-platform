'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Notice } from '@/app/_components/notices/notices';
import { NOTICE_ACTION } from '@/app/_components/notices/notice-action';

/*
 * 🔔 Inventory #18 — a To-do that blocks (the plan is not saved to an account), one notice system (owner approved 14
 * Nov 2026): it always comes first among the to-dos. An anonymous plan has no account, so "Not now" is kept in this
 * browser.
 */
export function SecureAccountBanner({ next = '/dashboard' }: { next?: string }) {
  return (
    <Notice
      kind="todo"
      blocking
      noticeKey="plan-not-saved"
      title="Your plan isn’t saved to an account yet"
      detail="Add an email so you can sign in on any device and never lose it."
      actions={
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className={NOTICE_ACTION}>
          <ShieldCheck aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Secure my plan
        </Link>
      }
    />
  );
}
