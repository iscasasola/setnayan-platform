/**
 * /dev/cake-maker-lab — the Cake Maker on fixture data (prototypes/cake_maker_2026-11-21/cake_maker_fable.html): no
 * sign-in, no database. DEV-ONLY: production builds never compile it (`the-lab-never-ships.test.ts`).
 *
 *   ?view=supplier            01 · Your cake options (the Card Maker part), from the cake template with sample extras
 *   ?view=couple              02 · Design your cake (&mood=none|unread: an empty board · a refused board read)
 *   ?view=received            03 · the Cake design card in the chat (&fail=1: the refused read)
 *   ?view=order               03 · the same card on the order
 *
 * Every amount here is a SAMPLE (the drawing's); prices come from a supplier's card, never from this lab.
 */
import { notFound } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function CakeMakerLabPage(props: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { default: Lab } = await import('./lab');
    const sp = await props.searchParams;
    const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
    return <Lab view={one('view') ?? 'couple'} mood={one('mood')} fail={one('fail') === '1'} />;
  }
}
