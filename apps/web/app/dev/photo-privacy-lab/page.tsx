/**
 * /dev/photo-privacy-lab — the 7-day guest notice on fixture data, with no sign-in and no database. DEV-ONLY:
 * production builds 404 this route, the same kill-switch as `/dev/memories-lab`.
 *
 * Why it exists (owner 2026-10-28, "OWNER: Agree to all" (1)): the two screens the notice changes are walked here at
 * 390/375, light/dark, before anybody signs in —
 *   · the supplier's album tile: Put on my page → "Goes up Nov 4"; the other states drawn beside it;
 *   · the guest's Event Hub line: "<Supplier> will show N photos from this event on their page" · See them · Remove.
 * Both are the REAL components; only their server doors are stand-ins (lab-client.tsx).
 */
import { notFound } from 'next/navigation';
import { InfoTip } from '@/app/_components/info-tip';
import { PutOnMyPageButton } from '@/app/vendor-dashboard/collections/_components/put-on-my-page-button';
import { SUPPLIER_PAGE_NOTICE_DAYS, type GuestNoticeGroup } from '@/lib/supplier-page-notice';
import { GuestLineLab, PutButtonLab } from './lab-client';

const TONES = [
  ['#D7B77C', '#9A7A3C'], ['#B9856A', '#6F4A33'], ['#E2D59C', '#A7A14B'], ['#6E8296', '#2E3F50'],
];
const pic = (i: number) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${TONES[i % 4]![0]}"/><stop offset="1" stop-color="${TONES[i % 4]![1]}"/></linearGradient></defs><rect width="300" height="300" fill="url(#g)"/></svg>`,
  );

const SOON = '2026-11-04T02:00:00Z';
const PAST = '2026-10-20T02:00:00Z';

const GROUPS: GuestNoticeGroup[] = [
  {
    supplierName: 'Lumen Studio',
    photos: [
      { noticeId: 'n1', photoId: 'p1', url: pic(0), onPage: false, publicFrom: SOON },
      { noticeId: 'n2', photoId: 'p2', url: pic(1), onPage: false, publicFrom: SOON },
      { noticeId: 'n3', photoId: 'p3', url: pic(2), onPage: true, publicFrom: PAST },
    ],
  },
  { supplierName: 'Bloom & Co', photos: [{ noticeId: 'n4', photoId: 'p4', url: pic(3), onPage: true, publicFrom: PAST }] },
];

export default async function PhotoPrivacyLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto max-w-xl space-y-10 px-4 py-6" style={{ background: 'var(--m-bg, transparent)' }}>
      <section data-lab="supplier" className="space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--m-slate-3)' }}>
          Your private portfolio
        </p>
        <div className="flex items-start gap-1.5 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          <InfoTip label="Only you see this album. A photo you put on your page goes up after the guests’ notice." labelClassName="text-xs" align="start">
            Each photo you import spends one Papic credit. When you put one on your page, everyone at this event is told
            in their Event Hub and has {SUPPLIER_PAGE_NOTICE_DAYS} days to remove it. If nobody does, it goes up on your
            page by itself. A guest can still remove it later, and a photo taken down at a guest&rsquo;s request comes
            off your page too.
          </InfoTip>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          <li className="flex flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic(0)} alt="" className="h-full w-full object-cover" />
            </div>
            <PutButtonLab photoId="lab-a" publicFrom={SOON} />
          </li>
          <li className="flex flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic(1)} alt="" className="h-full w-full object-cover" />
            </div>
            <PutOnMyPageButton photoId="lab-b" notice={{ state: 'waiting', publicFrom: SOON }} />
          </li>
          <li className="flex flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic(2)} alt="" className="h-full w-full object-cover" />
            </div>
            <PutOnMyPageButton photoId="lab-c" notice={{ state: 'on_page', publicFrom: PAST }} />
          </li>
          <li className="flex flex-col gap-1">
            <div className="aspect-square overflow-hidden rounded-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pic(3)} alt="" className="h-full w-full object-cover" />
            </div>
            <PutOnMyPageButton photoId="lab-d" notice={{ state: 'removed_by_guest', publicFrom: PAST }} />
          </li>
        </ul>
      </section>

      <section data-lab="guest" className="space-y-3">
        <GuestLineLab groups={GROUPS} />
      </section>
    </main>
  );
}
