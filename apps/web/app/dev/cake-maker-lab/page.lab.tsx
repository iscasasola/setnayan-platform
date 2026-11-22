/**
 * /dev/cake-maker-lab — the Cake Maker on fixture data (prototypes/cake_maker_2026-11-21/cake_maker_fable.html): no
 * sign-in, no database. DEV-ONLY: production builds never compile it (`the-lab-never-ships.test.ts`).
 *
 *   ?view=supplier            01 · Shop › Specialized tools › Cake Maker, with the drawing's sample extras
 *   ?view=fresh               01 · the same page on a shop's first open (the template, every extra ₱0)
 *   ?view=locked              01 · below Pro after the start date ("Included in Pro · Upgrade")
 *   ?view=start               02 · Design a cake — the two starts (&fail=1: the refused read)
 *   ?view=designer            02 · the designer itself, from a sample design (Change my design)
 *   ?view=couple              02 · "Your cake design · Sent" in the couple's chat  ·  ?view=replaced  · its old version
 *   ?view=invite              03 · the shop's invite as the couple sees it  ·  ?view=invite-shop  · as the shop sees it
 *   ?view=received            03 · the Cake design card in the shop's chat (&fail=1: the refused read)
 *   ?view=order               03 · the same card on the order
 *   ?view=figures             the ONE figure model: tiers 1–10, every arrangement, every shape (tall bottom), in 2D
 *   ?view=figure              one sample cake, 3D first
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
    return <Lab view={one('view') ?? 'supplier'} fail={one('fail') === '1'} n={Number(one('n') ?? 0) || 0} />;
  }
}
