/**
 * /dev/collapsing-top-lab — THE ONE BUILD F2 (8 Nov 2026): the shared `CollapsingTop` on fixture content, with no sign-in
 * and no database, so the scroll-up-and-lock can be walked at 375 px beside prototype v113. `?stack=1` stacks two tops
 * (a cover, then a week strip) the way Clients does. The parts are the shipped `CollapsingTop` / `CollapsingTopStack`;
 * the words are stand-ins.
 */
import { notFound } from 'next/navigation';
import { CollapsingTop, CollapsingTopStack } from '@/app/_components/collapsing-top/collapsing-top';

const ROWS = Array.from({ length: 24 }, (_, i) => `Row ${i + 1}`);

function Row({ title }: { title: string }) {
  return (
    <div className="flex h-[var(--sn-pin-h)] items-center gap-2 bg-paper px-4">
      <span className="font-semibold">{title}</span>
      <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">pinned</span>
    </div>
  );
}

export default async function CollapsingTopLabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const stacked = sp.stack === '1';
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-paper pb-40 text-ink" data-lab-collapsing-top="">
      <CollapsingTopStack>
        <CollapsingTop row={<Row title="SetnaProd" />} data={{ 'lab-cover': '' }}>
          <div className="flex h-56 flex-col justify-end bg-ink/5 p-4">
            <p className="text-2xl font-semibold">SetnaProd</p>
            <p className="text-sm text-ink/60">Tagaytay · Photo &amp; video</p>
          </div>
        </CollapsingTop>
        {stacked ? (
          <CollapsingTop row={<Row title="Week of 9 Nov" />} data={{ 'lab-week': '' }}>
            <div className="flex h-24 items-end bg-ink/[0.03] p-4 text-sm text-ink/60">Mon · Tue · Wed · Thu · Fri · Sat · Sun</div>
          </CollapsingTop>
        ) : null}
      </CollapsingTopStack>
      {ROWS.map((r) => (
        <div key={r} className="border-b border-ink/10 px-4 py-4">
          {r}
        </div>
      ))}
    </main>
  );
}
