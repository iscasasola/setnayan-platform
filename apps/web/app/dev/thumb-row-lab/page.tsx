/**
 * /dev/thumb-row-lab — the account rows (Events, Discover) on fixture lists, with no sign-in and no database, so the
 * one thumb row (owner 2026-10-22) can be walked at 320 · 375 · 1280. `?screen=events` (default) · `?screen=discover`.
 * The rows are the shipped `EventsThumbRow` / `DiscoverThumbRow`; the lists are stand-ins.
 */
import { notFound } from 'next/navigation';
import { DiscoverThumbRow, EventsThumbRow } from '@/app/_components/frontdoor/shell-thumb-rows';

const EVENTS = [
  ['Cale & Ice', '14 Feb 2026 · Tagaytay · hosting'],
  ['Claire turns 8', '3 Mar 2027 · draft'],
  ['Reyes wedding', "8 Nov 2026 · you're a guest"],
];
const FOLLOW = [
  ['Reyes wedding', 'Nov 8 · Tagaytay · public'],
  ['Barangay fiesta', 'Oct 30 · San Juan'],
  ['Tan debut', 'Oct 25 · Makati'],
];

export default async function ThumbRowLabPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const discover = sp.screen === 'discover';
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-paper px-4 pb-40 pt-5 text-ink">
      {discover ? <DiscoverThumbRow /> : <EventsThumbRow />}
      {discover ? (
        <>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Upcoming from people you follow</p>
          {FOLLOW.map(([t, s]) => (
            <div key={t} className="border-b border-ink/10 py-3">
              <p className="font-semibold">{t}</p>
              <p className="text-sm text-ink/60">{s}</p>
            </div>
          ))}
        </>
      ) : (
        EVENTS.map(([t, s]) => (
          <div key={t} className="mb-3 flex h-32 flex-col justify-end rounded-2xl bg-ink/5 p-4">
            <p className="text-lg font-semibold">{t}</p>
            <p className="text-sm text-ink/60">{s}</p>
          </div>
        ))
      )}
    </main>
  );
}
