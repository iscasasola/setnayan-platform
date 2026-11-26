/**
 * /dev/gown-maker-lab — the Gown Maker share on fixture data: no sign-in, no database. DEV-ONLY: production builds never
 * compile it (`the-lab-never-ships.test.ts`).
 *
 *   ?view=card       the Gown design card in the chat — the couple's face and the shop's face (&fail=1: the refused read)
 *   ?view=share      Customers › QR codes › Gown design — the share form (choose a .gown.json, Event, Shortlist/Booked)
 *
 * Every amount here is a SAMPLE; a real one comes from the Gown Maker file the supplier shares.
 */
import { notFound } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function GownMakerLabPage(props: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { default: Lab } = await import('./lab');
    const sp = await props.searchParams;
    const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
    return <Lab view={one('view') ?? 'card'} fail={one('fail') === '1'} />;
  }
}
