import { HomeProfile } from '@/app/dashboard/(launcher)/_components/home-profile';
import { HomeFindRow, HomePinnedRow } from '@/app/dashboard/(launcher)/_components/home-pin';
import { EventsFindInput } from '@/app/_components/frontdoor/shell-thumb-rows';
import { MemoriesThumb } from '@/app/dashboard/(account)/library/_components/memories-thumb';
import { HOME_SEG_LABEL, homeSegments, resolveHomeSeg, type HomeSeg } from '@/lib/home-segments';
import { CollectionCard, CollectionGrid } from '@/app/_components/collection-card';
import { EventPoster } from '@/app/_components/event-poster';
import { samplePoster } from '@/app/dashboard/(launcher)/_components/board-examples';
import { SAMPLE_PLANNING } from '@/lib/empty-look-samples';

/**
 * /dev/bar-lab/dashboard — HOME (owner 11 Nov 2026, "One profile page approve", DECISION_LOG "HOME PAGE v3 APPROVED")
 * on fixtures: the REAL `HomeProfile` header + section bar and the REAL pinned rows (`HomePinnedRow`, Memories'
 * `MemoriesThumb`), no sign-in and no database. The Events body draws the board's REAL Planning card (`CollectionCard`
 * + `EventPoster`) on the shipped sample events (`SAMPLE_PLANNING`, the board's own Examples), so a review sees the real
 * body; the other section BODIES are the shipped pages, which read the database — the lab says so in their place. ?seg=events|people|shop|memories · ?shop=0 (no shop).
 */
export function HomeLab({ sp }: { sp: Record<string, string | undefined> }) {
  const ownsShop = sp.shop !== '0';
  const segs = homeSegments({ ownsShop });
  const seg = resolveHomeSeg(sp.seg, { ownsShop });
  return (
    <HomeProfile
      seg={seg}
      segs={segs}
      me={{ displayName: 'Ana Mercado', email: 'ana@example.test', photoUrl: null, photoFrame: null }}
      handle={{ slug: 'ana-mercado', publicOn: true }}
      eventCount={3}
      asking={2}
      cardCount={ownsShop ? 6 : null}
    >
      <LabBody seg={seg} segs={segs} />
    </HomeProfile>
  );
}

function Stand({ seg }: { seg: HomeSeg }) {
  return (
    // Tall like a real section, so the pinned row has a page to stay pinned over.
    <p className="w-full py-8 text-[14px] text-ink/60" style={{ minHeight: '160vh' }} data-home-lab-body={seg}>
      Lab: the shipped {HOME_SEG_LABEL[seg]} page draws here (it reads the database, so the lab does not).
    </p>
  );
}

function LabBody({ seg, segs }: { seg: HomeSeg; segs: readonly HomeSeg[] }) {
  if (seg === 'events') {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pt-5 sm:px-6 lg:px-8">
          <HomePinnedRow
            seg="events"
            segs={segs}
            sub={[
              { key: 'ev:planning', label: 'Planning', group: 'Events', href: '#events' },
              { key: 'ev:celebrated', label: 'Celebrated', group: 'Events', href: '#finished' },
            ]}
            doors={[
              { key: 'planning', n: 2, word: 'planning', href: '#events' },
              { key: 'celebrated', n: 1, word: 'celebrated', href: '#finished' },
            ]}
            action={{ label: 'Event', ariaLabel: 'Create event', href: '/dashboard/create-event', mark: 'new-event' }}
          />
          <HomeFindRow words="Search events" tour="events-search">
            <EventsFindInput />
          </HomeFindRow>
        <h2 className="mb-3 mt-2 flex items-center gap-2.5 whitespace-nowrap text-sm font-extrabold tracking-tight text-ink after:h-px after:flex-1 after:bg-ink/10" id="events">
          Planning
        </h2>
        <CollectionGrid layout="poster">
          {SAMPLE_PLANNING.map((e, i) => (
            <CollectionCard
              key={e.id}
              href={null}
              layout="poster"
              coverTone="dark"
              index={i}
              cover={<EventPoster poster={samplePoster(e)} markText={e.name.slice(0, 1)} nameOnly />}
              kicker={[e.badge]}
              title={e.name}
              meta={e.meta}
              progress={{ pct: e.pct, remainder: e.remainder ?? '', srLabel: 'planned' }}
            />
          ))}
        </CollectionGrid>
        <div style={{ minHeight: '60vh' }} />
      </div>
    );
  }
  if (seg === 'shop') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 pb-10 sm:px-6">
        <HomePinnedRow
          seg="shop"
          segs={segs}
          sub={[{ key: 'shop:dashboard', label: 'Shop dashboard', group: 'Shop', href: '/vendor-dashboard' }]}
          doors={[
            { key: 'cards', n: 6, word: 'service cards', href: '/vendor-dashboard/shop' },
            { key: 'online', n: 4, word: 'online', href: '/vendor-dashboard/shop' },
          ]}
          action={{ label: 'Card', ariaLabel: 'New service card', href: '/vendor-dashboard/services/new', mark: 'new-card' }}
        />
        <Stand seg="shop" />
      </div>
    );
  }
  if (seg === 'memories') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <MemoriesThumb
          events={null}
          eventValue=""
          show={[
            { key: 'all', label: 'Everything', href: '/dashboard?seg=memories' },
            { key: 'photos', label: 'Photos', href: '/dashboard?seg=memories&tab=photos' },
          ]}
          showValue="all"
          download={null}
          homeSegs={segs}
        />
        <Stand seg="memories" />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
      <HomePinnedRow
        seg="people"
        segs={segs}
        doors={[{ key: 'asking', n: 2, word: 'asking you', href: '/dashboard?seg=people&view=requests', hot: true }]}
        action={{ label: 'Invite', ariaLabel: 'Invite someone', href: '/dashboard?seg=people', mark: 'invite' }}
      />
      <p className="py-3 text-[13px] text-ink/50">Lab: in the app this row is People&apos;s own shipped pinned row, with the same Home group.</p>
      <Stand seg="people" />
    </div>
  );
}
