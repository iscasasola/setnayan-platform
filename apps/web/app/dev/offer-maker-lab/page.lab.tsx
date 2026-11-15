/**
 * /dev/offer-maker-lab — 🏷 THE OFFER MAKER (Build 6 · Lane D), on fixture data: no sign-in, no database.
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`).
 *
 * Draws the REAL `OffersScreen` + `OfferEditor` on the approved prototype's sample shop (Setnayan-specs
 * `prototypes/shop_discounts_bundle_card_open_2026-11-09/src/data.js`: SetnaProd's Mobile Bar cards and offers) so the
 * built screen can be photographed beside the prototype frame. `?open=<offer id>` draws that offer risen; `?empty=1`
 * draws a shop with no offers; `?new=season` opens a new season offer on the sample slow months. The figures are the
 * prototype's DRAWING samples — the app reads every gift price, fee and limit live; nothing here reaches a real page.
 * Saving from the lab is refused by the server (no session) and says so.
 */
import { notFound } from 'next/navigation';

export default async function OfferMakerLabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const sp = await searchParams;
    const { OfferMakerLabClient } = await import('./lab-client');
    return <OfferMakerLabClient open={sp.open ?? null} empty={sp.empty === '1'} newSeason={sp.new === 'season'} />;
  }
}
