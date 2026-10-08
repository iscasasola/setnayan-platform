'use client';

import { useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { TimelineProblem } from './timeline-row';

/**
 * A LIST THAT COULD NOT BE READ, WITH ITS "TRY AGAIN" (gallery § 16; owner rule: a failure never renders as success,
 * zero or empty). For a server page that found its read refused: it says so in plain words where the list would be,
 * and Try again asks the server for that page once more — ONE re-read per tap, started by the person. Nothing here
 * retries by itself, and this is never used after a write.
 */
export function TimelineReadProblem({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const [asking, start] = useTransition();
  return (
    <div data-timeline-read-problem="" aria-busy={asking}>
      <TimelineProblem title={title} onRetry={asking ? null : () => start(() => router.refresh())}>
        {children}
      </TimelineProblem>
    </div>
  );
}
