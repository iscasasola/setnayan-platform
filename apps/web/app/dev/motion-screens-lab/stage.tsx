'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Home, Plus, SlidersHorizontal, Store, Users, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { ThumbDock } from '@/components/thumb-dock';
import { BottomNav } from '@/app/_components/nav/bottom-nav';
import { useHideOnScroll } from '@/app/_components/nav/use-hide-on-scroll';
import { CollapsingTop } from '@/app/_components/collapsing-top/collapsing-top';
import { RiseScreen } from '@/app/_components/rise/rise-screen';
import { InspectorSheetAlone } from '@/app/_components/inspector/inspector-column';
import type { RiseKind } from '@/lib/rise-screen';

const BASE = '/dev/motion-screens-lab';
// The lab's own picture — a flat tile, so nothing is fetched.
const PHOTO =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 30'><rect width='40' height='30' fill='%23c9785c'/><circle cx='29' cy='10' r='5' fill='%23f6e7c8'/><path d='M0 30 14 14l9 9 6-5 11 12z' fill='%237a4a3a'/></svg>";

// The app bar's own two speeds, as front-door.css draws them: back in Quick on Settle, away in Move on the Spring.
const BAR_CSS =
  '.ms-lab-bar{position:sticky;top:0;z-index:20;height:51px;display:flex;align-items:center;padding:0 16px;font-weight:600;' +
  'background:rgb(var(--sn-page-bg));border-bottom:1px solid var(--sn-hair);transition:transform var(--sn-m-quick) var(--sn-m-settle)}' +
  '@media (max-width:700.98px){.ms-lab-bar[data-hidden="true"]{transform:translateY(-100%);transition:transform var(--sn-m-move) var(--sn-m-spring)}}';

const TABS = [
  { key: 'home', label: 'Home', href: BASE, icon: Home, activeMatch: BASE, activeMatchExact: true },
  { key: 'deeper', label: 'Guests', href: `${BASE}/deeper`, icon: Users, activeMatch: `${BASE}/deeper` },
  { key: 'dates', label: 'Dates', href: `${BASE}?tab=dates`, icon: CalendarDays, activeMatch: `${BASE}/dates` },
  { key: 'shop', label: 'Shop', href: `${BASE}?tab=shop`, icon: Store, activeMatch: `${BASE}/shop` },
];

const KINDS: { kind: RiseKind; what: string }[] = [
  { kind: 'stack', what: 'Fill in / edit — Stack' },
  { kind: 'zoom', what: 'A whole tool — Zoom through' },
  { kind: 'picture', what: 'Anything with a photo — Picture leads' },
  { kind: 'grow', what: 'Not classified yet — grow (13 Nov)' },
];

export function MotionScreensLabStage({ page }: { page: 'home' | 'deeper' }) {
  const hidden = useHideOnScroll(true);
  const [risen, setRisen] = useState<RiseKind | null>(null);
  const [peek, setPeek] = useState(false);
  return (
    <div className="min-h-screen bg-[rgb(var(--sn-page-bg))] text-ink" data-chrome="app" data-motion-screens-lab={page}>
      <style>{BAR_CSS}</style>
      <div className="shell-topbar ms-lab-bar" data-hidden={hidden ? 'true' : 'false'} data-lab-bar="">
        SETNAYAN
      </div>
      <main className="sn-vt-page">
        <div data-shell-main>
          {page === 'deeper' ? (
            <div className="px-4 pt-3">
              <Link href={BASE} className="text-[15px] font-semibold underline" data-lab-back="">
                ‹ Back up
              </Link>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PHOTO} alt="" className="mt-3 aspect-[4/3] w-full rounded-tile object-cover" data-picture-hero="" />
              <h1 className="pt-3 font-display text-3xl">Casa Lente</h1>
            </div>
          ) : (
            <CollapsingTop
              row={
                <div className="flex h-[var(--sn-pin-h)] w-full items-center gap-2 px-4" data-lab-pinned="">
                  <span className="font-semibold">Guests · 148</span>
                  <span className="ml-auto text-[12px] text-ink/60">pinned row</span>
                </div>
              }
              data={{ 'lab-cover': '' }}
            >
              <div className="flex h-40 flex-col justify-end p-4">
                <p className="font-display text-3xl">Guests</p>
                <p className="text-sm text-ink/60">148 invited · scroll down to tuck the bars</p>
              </div>
            </CollapsingTop>
          )}
          <div className="space-y-2 px-4 pb-6 pt-3">
            {KINDS.map((k) => (
              <div key={k.kind} className="flex items-center gap-3 rounded-tile bg-paper px-3 py-2" data-lab-kind={k.kind}>
                {k.kind === 'picture' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={PHOTO} alt="" className="h-11 w-14 rounded-md object-cover" />
                ) : null}
                <span className="min-w-0 flex-1 text-[15px]">{k.what}</span>
                <ActionButton tone="neutral" icon={ArrowUpRight} label="Open" onClick={() => setRisen(k.kind)} />
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-tile bg-paper px-3 py-2" data-lab-kind="peek">
              <span className="min-w-0 flex-1 text-[15px]">A person&rsquo;s card — Side peek</span>
              <ActionButton tone="neutral" icon={ArrowUpRight} label="Open" onClick={() => setPeek(true)} />
            </div>
            {page === 'home' ? (
              <>
                <Link href={`${BASE}/deeper`} className="block rounded-tile bg-paper px-3 py-3 text-[15px] font-semibold" data-lab-push="">
                  Go deeper — Push ›
                </Link>
                <Link href={`${BASE}/deeper`} data-picture-leads="" className="flex items-center gap-3 rounded-tile bg-paper px-3 py-2" data-lab-picture-link="">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PHOTO} alt="" className="h-11 w-14 rounded-md object-cover" />
                  <span className="text-[15px] font-semibold">Casa Lente — Picture leads, card → page</span>
                </Link>
              </>
            ) : null}
            {Array.from({ length: 30 }, (_, i) => (
              <div key={i} className="rounded-tile bg-paper px-3 py-4 text-[15px]">
                Row {i + 1}
              </div>
            ))}
          </div>
        </div>
      </main>
      <ThumbDock>
        <div className="sn-glass-row pointer-events-auto flex items-center gap-2 rounded-full px-2 py-1.5" data-lab-thumb="">
          <ActionButton tone="neutral" icon={SlidersHorizontal} label="Filter" onClick={() => undefined} />
          <span className="flex-1" />
          <ActionButton tone="neutral" icon={Plus} label="Add" onClick={() => undefined} />
        </div>
      </ThumbDock>
      <BottomNav items={TABS} />
      {risen ? (
        <RiseScreen title="Maria Santos" line={`kind: ${risen}`} kind={risen} onClose={() => setRisen(null)} data={`lab-${risen}`}>
          <div className="space-y-3 px-4 py-4">
            {risen === 'picture' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={PHOTO} alt="" className="aspect-[4/3] w-full rounded-tile object-cover" data-rise-photo="" />
            ) : null}
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="rounded-tile bg-paper px-4 py-3 text-[15px]">
                Section {i + 1}
              </div>
            ))}
          </div>
        </RiseScreen>
      ) : null}
      {peek ? (
        <InspectorSheetAlone onClose={() => setPeek(false)}>
          <div className="space-y-3" data-lab-peek-card="">
            <h2 className="font-display text-2xl">Maria Santos</h2>
            <p className="text-ink/70">Going · Table 4</p>
            <ActionButton tone="neutral" icon={X} label="Close" onClick={() => setPeek(false)} />
          </div>
        </InspectorSheetAlone>
      ) : null}
    </div>
  );
}
