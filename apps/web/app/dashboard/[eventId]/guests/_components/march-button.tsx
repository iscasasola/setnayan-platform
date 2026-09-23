'use client';

/**
 * march-button.tsx — one Wedding March control that does not reload the page.
 *
 * ⚖ Owner 2026-09-23: *"when it reloads, it goes back up and does not stay on
 * where we are editing."* The section arrows and the two Reset links were
 * `<form action={serverAction}>` around a `<SubmitButton>`, and every one of
 * those actions ended in `redirect()` — a 303, i.e. the browser throwing the
 * document away and loading it again, landing at the top.
 *
 * This runs the action in a transition and then `router.refresh()`s, which
 * replaces the server-rendered panel IN PLACE: no document load, no scroll
 * jump, no remount of the list the couple is working in.
 *
 * 🔑 IT SAYS NO OUT LOUD. The action returns a `MarchResult`; a refusal is
 * rendered right here rather than travelling back as `?error=…` on a
 * navigation. A control that swallowed the reason would be indistinguishable
 * from one that did nothing.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import type { MarchResult } from '@/lib/march-result';

export function MarchButton({
  run,
  className,
  children,
  pendingLabel,
  ...rest
}: {
  run: () => Promise<MarchResult>;
  className?: string;
  children: React.ReactNode;
  /** Shown in place of the label while the write is out; omit for icon buttons. */
  pendingLabel?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type' | 'onClick' | 'children'>) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        className={`${className ?? ''} ${pending ? 'cursor-wait' : ''}`.trim()}
        onClick={() => {
          setProblem(null);
          start(async () => {
            const result = await run();
            if (!result.ok) {
              setProblem(result.reason);
              return;
            }
            router.refresh();
          });
        }}
        {...rest}
      >
        {pending && pendingLabel ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 aria-hidden className="h-3 w-3 animate-spin" strokeWidth={2.25} />
            {pendingLabel}
          </span>
        ) : (
          children
        )}
      </button>
      {problem ? (
        <span role="status" className="ml-2 text-[11px] text-danger-700">
          {problem}
        </span>
      ) : null}
    </>
  );
}
