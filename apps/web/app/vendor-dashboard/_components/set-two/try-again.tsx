'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { ActionButton } from '@/components/action-button';

/**
 * try-again.tsx — the Try again of an honest failed read (drawing "When a read fails: the page stays, and says so",
 * supplier pages set two, 21 Nov 2026). It RE-RUNS THE READ IN PLACE — `router.refresh()` asks the server for this
 * page again, so the page never navigates away, and the same words come back if it fails a second time.
 *
 *   · `main` — the whole page could not be read: the one main button in the thumb zone;
 *   · otherwise — one part could not be read: the small button inside that part's note.
 */
export function TryAgain({ main = false }: { main?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <ActionButton
      tone={main ? 'brand' : 'neutral'}
      main={main}
      icon={<RefreshCw aria-hidden />}
      label="Try again"
      waiting={pending}
      onClick={() => start(() => router.refresh())}
      className={main ? 'w-full tab:w-auto' : undefined}
      data-try-again=""
    />
  );
}
