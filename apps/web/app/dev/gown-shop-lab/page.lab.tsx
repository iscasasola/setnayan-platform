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
