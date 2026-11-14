/**
 * /dev/files-lab — 📁 PIECE 3b on fixture data (no sign-in, no database). DEV-ONLY: production builds 404 this route
 * (`the-lab-never-ships.test.ts`). Buttons post the REAL actions; pressing them here needs a session (the lab draws).
 *
 *   ?m=files      Clients › <client> › Files — This booking · From the chat · Links · the quoted services' grids
 *   ?m=plus       …with the ＋ sheet open (From your portfolio · Upload new)
 *   ?m=upload     …with Upload new open ("For a service" · "For this booking")
 *   ?m=portfolio  …with "Your portfolio · for this event" open (maps, never copies)
 *   ?m=hub        the Hub's "Event photos · by service" (service groups only, the count line)
 *   ?m=hub-fee    …while the booking fee is unsettled (tiles greyed)
 *   ?m=couple     the couple's approval line + sheet
 *   ?m=filechat   📥 Piece 3c — a chat photo opened: "File under a service"
 *   ?m=now        the SHIPPED Files body (FilesFinder), unchanged — the screenshots' "Now"
 */
import { notFound } from 'next/navigation';
import { FilesLabClient } from './lab-client';

export default async function FilesLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'files';
  return (
    <main className="mx-auto w-full max-w-xl bg-cream px-4 py-6 pb-40">
      <FilesLabClient mode={m} />
    </main>
  );
}
