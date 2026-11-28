/**
 * /dev/gown-shop-lab — the Attire Maker's shop side on fixture data: no sign-in, no database. DEV-ONLY: production
 * builds never compile it (`the-lab-never-ships.test.ts`).
 *
 *   ?view=supplier   Shop › Your widgets › Attire Maker, a sample price list ("covers until it costs more")
 *   ?view=extras     the same, "base plus every extra" (In base switches)
 *   ?view=fresh      a shop's first open (the template: nothing priced, every add-on Not offered)
 *   ?view=locked     not bought, or not on a plan (the lock and the Toolkit door)
 *   ?view=fabrics    Fabrics and lace (step B5): a priced, an unpriced and a hidden row; tap one for its sheet
 *   ?view=looks      Looks: one look; tap it, or Add a look
 *   ?view=stock-empty  no fabrics yet
 *   ?view=order      a supplier's client › Details: her gown design, her numbers, your tape, the cutting blocks (B7)
 *   ?view=order-lines  the same, with her own neckline, back and hem (B9, v209): said under her design, drawn on the blocks
 *   ?view=order-lines-unread  her lines didn’t read: said, and the blocks show the plain lines
 *   ?view=scan     Fabrics and lace › Scan a swatch book (step B13), opened on a sample page drawn in the browser
 *   ?view=types      Admin › Studio › Fabric types (step B5b): a checked, an unchecked and a hidden type
 *   ?view=card       the chat's gown design card, the shop's face (B8): her choices, the estimate, Make a quote
 *   ?view=card-bride   the bride's face ("Your gown design · Sent")
 *   ?view=card-ask     nothing on the list prices it yet: "Ask for a quote"
 *   ?view=card-replaced  a newer design was sent below it
 *   ?view=card-failed  the read failed: said, with Try again
 *   ?view=card-quote   Make a quote, opened from the card: the estimate as the offer, her priced add-ons as its lines
 *
 * Every amount here is a SAMPLE; prices come from each designer's own list, never from this lab.
 */
import { notFound } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function GownShopLabPage(props: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { default: Lab } = await import('./lab');
    const sp = await props.searchParams;
    return <Lab view={typeof sp.view === 'string' ? sp.view : 'supplier'} />;
  }
}
