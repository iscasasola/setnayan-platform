/**
 * /dev/date-sheet-lab — 📆 THE ONE DATE SHEET (Build 3 · Lane D part 1), on fixture data: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL shared sheet (`app/_components/date-sheet.tsx`, through its one lazy door) on the four uses of the
 * approved prototype v3.1 (`Setnayan-specs/prototypes/date_picker_2026-11-09/`): a payment ask's "By when", a quotation's
 * "Valid until", a meeting (both sides' availability, then the slot list) and the supplier's "Check a date". Three are
 * the shipped `DateRow` with `sheet`; the meeting is a FormRow pill that mounts the sheet with its slots, folded from
 * raw-shaped fixtures by the same rule a real meeting uses (`lib/meeting-availability.ts`).
 * Today is fixed at Nov 9, 2026 and the sample event at Nov 28, so every screenshot reads the same. Names are samples:
 * nobody real.
 */
import { notFound } from 'next/navigation';

// 📦 The lab's client code is imported only in the branch a production build folds away (`NODE_ENV` is a build-time
// constant), so it never enters the production module graph — a 404ing lab adds no chunk to the webpack runtime, which
// ships on every page under the 202.3 KB shared-bundle lock (Build 3 integration, #7416). Same shape as `/dev/chat-cards-lab`.
export default async function DateSheetLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { DateSheetLabClient } = await import('./lab-client');
    return (
      <main className="mx-auto w-full max-w-xl bg-cream px-4 py-6 pb-40">
        <DateSheetLabClient />
      </main>
    );
  }
}
