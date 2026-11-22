/**
 * /dev/memories-lab?gallery=event — THE EVENT'S MEMORIES (`EventMemoriesGallery`, the event bar's fifth tab) on fixture
 * data, as the couple sees it: the real grid, the real full-screen viewer, its real action bar. Fixture pictures are
 * inline SVGs (nothing fetched); a press that would save reaches no database, so it answers "couldn't save" — the
 * screens are what is walked here. DEV-ONLY: `page.tsx` 404s the whole route in production before it reads a param.
 *
 *   ?gallery=event            the couple (host) — Download · Tag · Delete · ⋯
 *   ?gallery=event&guest=1    a coordinator / non-host — Download only
 */
import { EventMemoriesGallery } from '@/app/_components/memories/event-memories-gallery';
import type { MemoriesItem } from '@/lib/event-memories';

const TONES = [
  ['#D7B77C', '#9A7A3C'], ['#B9856A', '#6F4A33'], ['#E2D59C', '#A7A14B'], ['#6E8296', '#2E3F50'],
  ['#B8788D', '#6D3F50'], ['#C8D27F', '#7E9A3E'], ['#E8C7A3', '#B67E57'], ['#9FB7B0', '#4E6E67'],
];

/** A "photograph" with detail to zoom into — a gradient, rings and a numbered label, at a real camera's proportions. */
function pic(i: number, w: number, h: number): string {
  const [a, b] = TONES[i % TONES.length]!;
  const rings = Array.from({ length: 9 }, (_, k) => `<circle cx="${w / 2}" cy="${h / 2}" r="${(k + 1) * Math.min(w, h) * 0.05}" fill="none" stroke="rgba(255,255,255,${0.12 + k * 0.03})" stroke-width="3"/>`).join('');
  return (
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#g)"/>${rings}<text x="50%" y="54%" text-anchor="middle" font-family="Georgia,serif" font-size="${Math.round(Math.min(w, h) * 0.16)}" fill="rgba(255,255,255,0.92)">${i + 1}</text><text x="50%" y="66%" text-anchor="middle" font-family="Helvetica,Arial" font-size="${Math.round(Math.min(w, h) * 0.025)}" letter-spacing="4" fill="rgba(255,255,255,0.8)">FRAME ${i + 1} · FINE DETAIL TO ZOOM INTO</text></svg>`,
    )
  );
}

type Fix = Partial<MemoriesItem> & Pick<MemoriesItem, 'id' | 'memSource' | 'table'>;

const at = (h: number, m: number) => new Date(Date.UTC(2026, 11, 12, h - 8, m)).toISOString();

const FIXTURES: Fix[] = [
  { id: 'g-1', memSource: 'papic', table: 'papic_guest_captures', capturedBy: 'Tita Lorna', guestId: 'guest-lorna' },
  { id: 's-2', memSource: 'papic', table: 'papic_photos', capturedBy: 'Paolo', source: 'seat' },
  { id: 'g-3', memSource: 'papic', table: 'papic_guest_captures', capturedBy: 'Bea', guestId: 'guest-bea', kind: 'clip' },
  { id: 'h-4', memSource: 'hub', table: 'hub', hubUse: 'Scene photo' },
  { id: 'v-5', memSource: 'suppliers', table: 'vendor_papic_captures', capturedBy: 'Lumen Studio', source: 'vendor', vendorProfileId: 'vp-lumen' },
  { id: 'g-6', memSource: 'papic', table: 'papic_guest_captures', capturedBy: 'Migs', guestId: 'guest-migs', look: 'screened' },
  { id: 'u-7', memSource: 'uploads', table: 'papic_photos', capturedBy: 'You', uploads: true },
  { id: 'g-8', memSource: 'papic', table: 'papic_guest_captures', capturedBy: 'Tita Lorna', guestId: 'guest-lorna', look: 'hidden' },
  { id: 's-9', memSource: 'papic', table: 'papic_photos', capturedBy: 'Paolo', source: 'seat' },
  { id: 'g-10', memSource: 'papic', table: 'papic_guest_captures', capturedBy: 'Carla', guestId: 'guest-carla', look: 'reported' },
  { id: 's-11', memSource: 'papic', table: 'papic_photos', capturedBy: 'Paolo', source: 'seat' },
  { id: 'g-12', memSource: 'papic', table: 'papic_guest_captures', capturedBy: 'Bea', guestId: 'guest-bea' },
];

const SIZES: Array<[number, number]> = [[1200, 900], [900, 1200], [1200, 800], [1000, 1000]];

function items(): MemoriesItem[] {
  return FIXTURES.map((f, i) => {
    const [w, h] = SIZES[i % SIZES.length]!;
    const big = pic(i, w, h);
    const small = pic(i, 300, 300);
    const clip = f.kind === 'clip';
    return {
      url: small,
      viewUrl: big,
      largeUrl: big,
      playUrl: null,
      saveUrl: clip || f.memSource === 'hub' ? null : big,
      downloadUrl: f.memSource === 'hub' || clip ? big : null,
      kind: 'photo',
      source: 'guest',
      tagged: false,
      tagSource: 'untagged',
      capturedAt: at(15 + Math.floor(i / 3), (i * 7) % 60),
      capturedBy: null,
      look: 'ok',
      challengeId: null,
      hubUse: null,
      guestId: null,
      vendorProfileId: null,
      ...f,
    } as MemoriesItem;
  });
}

export function EventGalleryLab({ host }: { host: boolean }) {
  return (
    <div className="sn-ambient min-h-dvh">
      <div className="flex h-[56px] items-center justify-between border-b border-ink/10 bg-paper px-4" data-lab-topbar="">
        <span className="text-[14px] font-semibold tracking-[0.18em] text-[#a9834b]">CALE &amp; ICE</span>
        <span className="text-[12px] text-ink/60">Memories</span>
      </div>
      <main className="mx-auto w-full max-w-7xl px-4 pt-2 sm:px-6 lg:px-8">
        <EventMemoriesGallery
          eventId="ev-lab"
          items={items()}
          host={host}
          totals={{ all: FIXTURES.length, papic: null }}
          footLine={null}
          cappedLine={null}
          emptyLine="Your photos land here as your guests and suppliers shoot."
          unreadable={false}
          timeZone="Asia/Manila"
          blockedGuests={[]}
          suppliers={[{ vendorProfileId: 'vp-lumen', vendorRowId: 'vr-lumen', name: 'Lumen Studio', hidden: false }]}
        />
      </main>
    </div>
  );
}
