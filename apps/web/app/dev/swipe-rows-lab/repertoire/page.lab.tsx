/**
 * /dev/swipe-rows-lab/repertoire — the REAL "Your set list" (`repertoire/_components/set-list.tsx`) on
 * fixture songs, for the swipe-to-delete screenshots (owner 2026-11-03). Dev only — 404s in production (first statement); the
 * swipe's Delete would call the shipped action, which refuses with no session.
 */
import { notFound } from 'next/navigation';
import { SetList, type SetListSong } from '@/app/vendor-dashboard/repertoire/_components/set-list';

const SONGS: SetListSong[] = [
  { song_id: 9001, title: 'Forevermore', artist: 'Side A', performance_url: 'https://youtube.com/watch?v=lab' },
  { song_id: 9002, title: 'Ikaw', artist: 'Yeng Constantino', performance_url: null },
  { song_id: 9003, title: 'Perfect', artist: 'Ed Sheeran', performance_url: null },
];

export default function SwipeRowsRepertoireLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mx-auto min-h-screen w-full max-w-xl bg-cream px-4 pb-32 pt-6 text-ink">
      <div className="space-y-3 sn-tile p-4">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">Your set list ({SONGS.length})</h2>
        <SetList
          songs={SONGS}
          links={Object.fromEntries(
            SONGS.map((s) => [
              s.song_id,
              <span key={s.song_id} className="input-field mt-1 flex h-8 w-full basis-full items-center text-xs text-ink/55">
                {s.performance_url ?? 'Link a video of you playing it (optional)'}
              </span>,
            ]),
          )}
        />
      </div>
    </div>
  );
}
