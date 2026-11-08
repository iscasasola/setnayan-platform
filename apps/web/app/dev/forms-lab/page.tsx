/**
 * /dev/forms-lab — 📋 THE FORM MAKER, THE CLIENT'S FORMS PAGE AND THE REPORT (THE ONE BUILD · C3), on fixture data: no
 * sign-in, no database. DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL bodies the picked-client pages mount, fed fixtures instead of reads — the 375 px proof against v113:
 *   ?m=forms    Clients › <client> › Forms below the shipped questions (`FormsPageBody`)
 *   ?m=load     …with the Forms Maker sheet open (Load a form)
 *   ?m=maker    the Form Maker open on a saved form (`FormMaker`)
 *   ?m=new      the Form Maker, new and empty
 *   ?m=report   Clients › <client> › Report (`ReportForm`)
 *   ?m=couple   the couple answering a sent form in the supplier's room (`SupplierFormAnswers`)
 * Buttons post the REAL actions; pressing them here needs a session (the lab draws, it does not save).
 * Names are samples: nobody real.
 */
import { notFound } from 'next/navigation';
import { FormsLabClient } from './lab-client';

export default async function FormsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const m = typeof sp.m === 'string' ? sp.m : 'forms';
  return (
    <main className="mx-auto w-full max-w-xl bg-cream px-4 py-6 pb-40">
      <FormsLabClient mode={m} />
    </main>
  );
}
