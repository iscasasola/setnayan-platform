/**
 * /dev/motion-lab — 🎞 THE APPROVED MOTION SYSTEM, ON THE REAL SHARED PIECES (owner 2026-11-13, DECISION_LOG "Motion
 * system approved"; prototype `prototypes/approved_2026-11-13/grow-full-screen-fable.html`). Fixture words only: no
 * sign-in, no database. DEV-ONLY: never built for production (`page.lab.tsx`) and 404s there
 * (`app/dev/the-labs-never-ship.test.ts`).
 *
 * Draws the shipped pieces — buttons (PressFeel), rows that open one at a time (Fold), a Sheet that grows out of its
 * button, a Rise full screen that grows out of its row, a switch, chips — so the motion can be seen and measured at
 * 390 and 1280 without touching any page.
 */
import { notFound } from 'next/navigation';

export default async function MotionLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { MotionLabClient } = await import('./lab-client');
    return (
      <main className="mx-auto w-full max-w-xl bg-cream px-4 py-6 pb-40">
        <MotionLabClient />
      </main>
    );
  }
}
