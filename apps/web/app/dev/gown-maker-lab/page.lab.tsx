/**
 * /dev/gown-maker-lab — the Gown Maker's stage on fixture numbers (prototypes/gown_maker_2026-11-27/gown_maker_v186.html):
 * no sign-in, no database. DEV-ONLY: production builds never compile it (`the-lab-never-ships.test.ts`).
 *
 *   ?view=body                the mannequin and her numbers: change any number and watch her change (default)
 *   ?view=designer            the bride's flow (A9): measurements, fine-tune with Skip, the design steps, undo, units
 *   ?view=faceless            front and side together: the faceless check
 *   ?view=scenes              the six lighting scenes side by side
 *   ?view=fallback            a phone that cannot draw 3D
 *   ?view=dress               the gown on her: silhouette, neckline, fabric, colour, length, train
 *   ?view=silhouettes         A-line, ball gown, mermaid and sheath side by side (&body=thin · default · severe)
 *   &scene=<id>               studio · morning · afternoon · sunset · evening · indoor
 *   &guides=1                 the measuring-tape guides (bust, underbust, waist, hips)
 *
 * Every number here is a SAMPLE body, never a person's.
 */
import { notFound } from 'next/navigation';

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function GownMakerLabPage(props: Props) {
  if (process.env.NODE_ENV === 'production') notFound();
  else {
    const { default: Lab } = await import('./lab');
    const sp = await props.searchParams;
    const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : null);
    return <Lab view={one('view') ?? 'body'} scene={one('scene') ?? 'studio'} guides={one('guides') === '1'} body={one('body') ?? 'default'} />;
  }
}
