/**
 * /dev/memories-lab — the account Memories page (`/dashboard/library`) on fixture data, with no sign-in and no
 * database, inside the account layout's own wrappers and the REAL `AccountBottomNav`. DEV-ONLY: production
 * builds 404 this route, the same kill-switch as `/dev/guests-lab`.
 *
 * Why it exists (owner 2026-10-22, "Memories must look similar to the gallery of papic"): the approved prototype
 * `prototypes/people_and_memories_template_2026-10-22.html` (M1–M4) is walked side by side against THESE renders —
 * the REAL `MemoriesChapters` and `MemoriesThumb`; the wall, the events and the frames are fixtures (inline
 * pictures, nothing fetched).
 *
 *   (default)      M1 — all events, with frames (3 events, the last with nothing yet)
 *   ?event=ev-ci   M2 — one event picked: the day's chapters, ⤓ Download all
 *   ?empty=1       M3 — nothing kept yet
 *   ?fail=1        a refused wall read — "could not be loaded", never "nothing yet"
 *   ?guest=tagged  A GUEST'S Memories on the Event Hub under Memories ⚙ › Who sees what = Only tagged (owner 2026-10-30,
 *                  the default): the REAL `PhotosOfYouGallery` (the photos they are tagged in) + `YourShotsGallery`
 *                  (their own shots), and no door to everyone's — exactly the props `site-body.tsx` passes when
 *                  `poolGalleryOpen` is false.
 *   ?guest=all     the same guest under Share all memories: the same two halves + "Everyone's photos".
 */
import { LabPageSpotlight } from '@/app/dev/_components/lab-page-spotlight';
import { TOURS } from '@/lib/tours';
import { notFound } from 'next/navigation';
import { AccountBottomNav } from '@/app/dashboard/(launcher)/_components/account-bottom-nav';
import { MemoriesChapters } from '@/app/dashboard/(account)/library/_components/memories-chapters';
import { MemoriesThumb } from '@/app/dashboard/(account)/library/_components/memories-thumb';
import type { Album } from '@/app/dashboard/(account)/library/_data/photos-albums';
import { LENSES, KEPT } from '@/app/dashboard/(account)/library/_data/library-views';
import { EMPTY_WALL, type AlaalaWall, type WallItem } from '@/lib/alaala-wall';
import { formatCount } from '@/lib/format-number';
import { PhotosOfYouGallery } from '@/app/[slug]/_components/photos-of-you-gallery';
import { YourShotsGallery } from '@/app/[slug]/_components/your-shots-gallery';
import type { GuestLiveGallery, GuestOwnShots } from '@/lib/guest-live-gallery';

const TONES = [
  ['#D7B77C', '#9A7A3C'], ['#B9856A', '#6F4A33'], ['#E2D59C', '#A7A14B'], ['#6E8296', '#2E3F50'],
  ['#B8788D', '#6D3F50'], ['#C8D27F', '#7E9A3E'], ['#E8C7A3', '#B67E57'], ['#9FB7B0', '#4E6E67'],
];
const pic = (i: number) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${TONES[i % 8]![0]}"/><stop offset="1" stop-color="${TONES[i % 8]![1]}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`,
  );

const ev = (event_id: string, display_name: string, role: 'couple' | 'guest', event_date: string, monogram_text: string) => ({
  event_id, display_name, role, event_date, monogram_text,
  event_type: 'wedding', is_primary: false, monogram_color: null, monogram_font_key: null, monogram_style: null, monogram_frame_key: null, monogram_custom_svg: null,
});

function albums(kind: 'full' | 'empty'): Album[] {
  const rows: Array<[ReturnType<typeof ev>, number]> = [
    [ev('ev-ci', 'Cale & Ice', 'couple', '2026-12-12', 'C & I'), kind === 'full' ? 12 : 0],
    [ev('ev-mj', 'Maria & Jose', 'couple', '2027-02-14', 'M & J'), kind === 'full' ? 2 : 0],
    [ev('ev-ln', 'Lola Nena 80th', 'guest', '2027-05-01', 'L N'), 0],
  ];
  return rows.map(([event, count]) => ({
    event, role: event.role, count, thumbs: [], slug: null, markPlays: false,
    href: event.role === 'couple' ? `/dashboard/${event.event_id}/memories` : null,
  })) as unknown as Album[];
}

function wall(kind: 'full' | 'empty' | 'fail'): AlaalaWall {
  if (kind !== 'full') return { ...EMPTY_WALL, unreadable: kind === 'fail', facesMeasured: true };
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 11, 12, h - 8, m)).toISOString(); // Manila wall clock
  const items: WallItem[] = [];
  const hours = [8, 8, 9, 10, 15, 15, 16, 16, 19, 19, 20, 21];
  hours.forEach((h, i) =>
    items.push({ key: `ci-${i}`, url: pic(i), isClip: i === 4, capturedAt: at(h, i * 3), eventId: 'ev-ci', eventName: 'Cale & Ice', role: 'couple', withMe: i === 0 || i === 5 }),
  );
  items.push({ key: 'mj-0', url: pic(6), isClip: false, capturedAt: '2027-02-14T06:00:00Z', eventId: 'ev-mj', eventName: 'Maria & Jose', role: 'couple', withMe: true });
  items.push({ key: 'mj-1', url: pic(7), isClip: true, capturedAt: '2027-02-14T07:00:00Z', eventId: 'ev-mj', eventName: 'Maria & Jose', role: 'couple', withMe: false });
  items.reverse();
  return { ...EMPTY_WALL, items, totals: { recent: 14, owned: 14, attended: 0, people: 0, with_me: 3 }, facesMeasured: true, hasAttendedEvents: true };
}

export default async function MemoriesLabPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  if (sp.guest === 'tagged' || sp.guest === 'all') return <GuestMemoriesLab share={sp.guest === 'all'} />;
  const kind = sp.fail === '1' ? 'fail' : sp.empty === '1' ? 'empty' : 'full';
  const list = albums(kind === 'full' ? 'full' : 'empty');
  const picked = typeof sp.event === 'string' ? list.find((a) => a.event.event_id === sp.event) ?? null : null;
  const href = (tab: string, id: string | null) => `/dev/memories-lab?tab=${tab}${id ? `&event=${id}` : ''}${kind !== 'full' ? `&${kind}=1` : ''}`;
  return (
    <div className="sn-ambient min-h-dvh">
      <div className="flex h-[61px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">SETNAYAN</span>
        <span className="sn-initials grid h-[34px] w-[34px] place-items-center rounded-full text-[12px] font-bold">IC</span>
      </div>
      <main className="pb-[calc(var(--sn-bottomdock-h,calc(env(safe-area-inset-bottom)+64px))+1.5rem)] lg:pb-0">
        <div className="sn-page-enter">
          <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-2 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-3xl">
              <MemoriesChapters
                lens="recent"
                wall={wall(kind)}
                albums={list}
                albumsMeasured
                eventId={picked?.event.event_id ?? null}
                lifeFlash
                blocksFor={async () => [
                  { blockId: 'b1', label: 'Getting ready', startAt: '2026-12-12T07:00:00', endAt: '2026-12-12T11:00:00' },
                  { blockId: 'b2', label: 'Ceremony', startAt: '2026-12-12T15:00:00', endAt: '2026-12-12T17:00:00' },
                  { blockId: 'b3', label: 'Reception', startAt: '2026-12-12T18:30:00', endAt: '2026-12-12T23:00:00' },
                ]}
              />
            </div>
            <MemoriesThumb
              events={[
                { key: 'all', label: 'All events', href: href('recent', null) },
                ...list.map((a) => ({ key: a.event.event_id, label: a.event.display_name, group: a.role === 'couple' ? 'Hosting' : 'Attended', trail: { text: formatCount(a.count), tone: 'muted' as const }, href: href('recent', a.event.event_id) })),
              ]}
              eventValue={picked?.event.event_id ?? 'all'}
              show={[
                ...LENSES.map(({ key, label }) => ({ key, label, group: 'Memories', href: href(key, null) })),
                ...KEPT.map(({ key, label }) => ({ key, label, group: 'Also kept', href: href(key, null) })),
              ]}
              showValue="recent"
              download={picked && picked.count > 0 ? '#gallery-zip' : null}
            />
          </div>
        </div>
      </main>
      <AccountBottomNav tabs={['events', 'discover', 'memories', 'people']} />
      {/* &spot=1 — this tab's first-visit spotlight (customer_library_v1), first run, nothing recorded. */}
      {sp.spot === '1' ? <LabPageSpotlight tourKey="customer_library_v1" script={TOURS.customer_library_v1.spotlight!} /> : null}
    </div>
  );
}

/** A guest's Memories under each Who sees what — the two real Event Hub halves, on fixtures (`?guest=tagged|all`). */
function GuestMemoriesLab({ share }: { share: boolean }) {
  const at = (h: number, m = 0) => new Date(Date.UTC(2026, 11, 12, h - 8, m)).toISOString();
  const tagged: GuestLiveGallery = {
    total: 4,
    photos: [9, 11, 15, 19].map((h, i) => ({
      id: `tag-${i}`,
      sourceTable: 'papic_photos' as const,
      url: pic(i + 2),
      capturedAt: at(h, i * 7),
      capturedBy: null,
      wall: 'off' as const,
    })),
  } as unknown as GuestLiveGallery;
  const own: GuestOwnShots = { total: 3, shots: [16, 18, 20].map((h, i) => ({ id: `own-${i}`, url: pic(i + 5), capturedAt: at(h) })) };
  return (
    <div className="sn-ambient min-h-dvh" data-lab-guest-memories={share ? 'all' : 'tagged'}>
      <div className="flex h-[61px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">SETNAYAN</span>
        <span className="text-[12px] text-ink/60">{share ? 'Share all memories' : 'Only tagged'}</span>
      </div>
      <main className="mx-auto w-full max-w-3xl space-y-12 px-4 py-6">
        <PhotosOfYouGallery
          gallery={tagged}
          eventId="ev-ci"
          isLive={false}
          isPost
          showClaimAccountCta={false}
          occasion="wedding"
          eventWord="wedding"
          timeZone="Asia/Manila"
        />
        <YourShotsGallery shots={own} qrToken={null} cameraOn everyoneHref={share ? '#everyones-photos' : null} />
      </main>
    </div>
  );
}
