import { notFound } from 'next/navigation';
import { Check, ChevronRight, Plus } from 'lucide-react';
import { CARD_ORDER } from '@/app/vendor-dashboard/performance/_components/analytics-cards';
import { ToolChip, ToolEmpty, ToolFail, ToolPage, ToolPin, ToolRow, ToolSection } from '@/app/vendor-dashboard/_components/tool-page';
import { TemplateRows } from '@/app/_components/template-rows';
import { ActionButton } from '@/components/action-button';
import { routes } from '@/lib/routes';
import { SPECIALIZED_TOOLS } from '@/lib/specialized-tools';
import {
  MAX_FOLLOWED_BADGES,
  SHELF_TITLE,
  STORE_GRAPHS,
  followedBadges,
  goalWords,
  graphGroups,
  graphStatus,
  graphWindowWords,
  isStoreShelf,
  storeToolRows,
  toolIsYours,
  type StoreShelf,
} from '@/lib/supplier-store';
import { BadgeArt } from '@/app/vendor-dashboard/shop/_components/shop-badge-row';
import { loadStore, type StoreData } from '../_components/store-data';
import { GraphShelfRow, ToolShelfRow } from '../_components/store-views';
import { GraphArrange, StoreOp, StoreThumb } from '../_components/store-client';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  return { title: `${isStoreShelf(shelf) ? SHELF_TITLE[shelf] : 'Store'} · Store · Supplier` };
}

/**
 * 🛍 ONE STORE SHELF (drawing v10 — F2 Specialized Tools · F4/F5 Graphs · F9 Badges). A Shop [+] tile lands here.
 *   Tools  — "Yours" (Open) and "More tools" (Get · the one-time price · Free trial · Price not set yet).
 *   Graphs — "On your Analytics · drag to arrange" (✕ takes one off), then the groups with Get, or the badge that opens it.
 *   Badges — "On your Shop" (up to three followed; none followed = the three closest, marked Closest), "More badges"
 *            with Follow, and Setnayan Verified (earned, never followed).
 */
export default async function StoreShelfPage({ params }: { params: Promise<{ shelf: string }> }) {
  const { shelf } = await params;
  if (!isStoreShelf(shelf)) notFound();
  const d = await loadStore();
  return (
    <ToolPage name={`store-${shelf}`}>
      <ToolPin route="/vendor-dashboard/shop/store/[shelf]" title={SHELF_TITLE[shelf]} sub={<span data-store-sub="">{subLine(shelf, d)}</span>} />
      {d.picks === null ? <ToolFail title="Couldn’t load your picks" line="Nothing was changed. Try again in a moment." retryHref={routes.vendorDashboard.shop.store.shelf(shelf)} /> : null}
      {shelf === 'tools' ? <ToolsShelf d={d} /> : shelf === 'graphs' ? <GraphsShelf d={d} /> : <BadgesShelf d={d} />}
      <p hidden data-store-none="" className="py-6 text-center text-sn-lg text-[color:var(--m-slate-2)]">
        Nothing here matches that.
      </p>
      {shelf === 'tools' ? (
        <StoreThumb
          name="tools"
          placeholder="Search tools"
          countWord="tool"
          shows={[
            { key: 'all', label: 'All' },
            { key: 'yours', label: 'Yours' },
            { key: 'free', label: 'Free' },
            { key: 'paid', label: 'One-time' },
          ]}
        />
      ) : shelf === 'graphs' ? (
        <StoreThumb
          name="graphs"
          placeholder="Search graphs"
          countWord="graph"
          shows={[
            { key: 'all', label: 'All' },
            { key: 'on', label: 'On your Analytics' },
            { key: 'off', label: 'Not added' },
          ]}
        />
      ) : (
        <StoreThumb name="badges" placeholder="Search badges" countWord="badge" />
      )}
    </ToolPage>
  );
}

function subLine(shelf: StoreShelf, d: StoreData): string {
  if (shelf === 'tools') return `${SPECIALIZED_TOOLS.length} tools. Suggested for your services first.`;
  if (shelf === 'graphs') return `${CARD_ORDER.length} graphs, all free. ${d.on.length} ${d.on.length === 1 ? 'is' : 'are'} on your Analytics.`;
  return `Earned, never sold. Pick up to ${MAX_FOLLOWED_BADGES === 3 ? 'three' : MAX_FOLLOWED_BADGES} to follow on your Shop.`;
}

function ToolsShelf({ d }: { d: StoreData }) {
  const rows = storeToolRows(d.tools);
  const yours = rows.filter((r) => toolIsYours(r.status));
  const more = rows.filter((r) => !toolIsYours(r.status));
  return (
    <>
      <ToolSection label="Yours" count={yours.length} data="store-yours">
        <div data-store-block="">
          {yours.length > 0 ? (
            <div data-store-list="">
              <TemplateRows label="Yours">
                {yours.map((r) => (
                  <ToolShelfRow key={r.tool.key} row={r} picksRead={d.picks !== null} />
                ))}
              </TemplateRows>
            </div>
          ) : (
            <ToolEmpty>None yet. Get one below.</ToolEmpty>
          )}
        </div>
      </ToolSection>
      {more.length > 0 ? (
        <ToolSection label="More tools" count={more.length} data="store-more">
          <div data-store-block="">
            <div data-store-list="">
              <TemplateRows label="More tools">
                {more.map((r) => (
                  <ToolShelfRow key={r.tool.key} row={r} picksRead={d.picks !== null} />
                ))}
              </TemplateRows>
            </div>
          </div>
        </ToolSection>
      ) : null}
    </>
  );
}

function GraphsShelf({ d }: { d: StoreData }) {
  const groups = graphGroups(d.on);
  return (
    <>
      <ToolSection label="On your Analytics · drag to arrange" data="store-on">
        <div data-store-block="" data-store-list="">
          {d.on.length > 0 ? (
            <GraphArrange graphs={d.on.map((k) => ({ key: k, title: STORE_GRAPHS[k].title, window: graphWindowWords(k) }))} />
          ) : (
            <ToolEmpty>No graphs on your Analytics. Get one below.</ToolEmpty>
          )}
        </div>
      </ToolSection>
      {groups.map(({ group, graphs }) => (
        <ToolSection key={group} label={group} data={`store-group-${group}`}>
          <div data-store-block="">
            <div data-store-list="">
              <TemplateRows label={group}>
                {graphs.map((k) => (
                  <GraphShelfRow key={k} k={k} status={graphStatus(k, d.on, d.unlocks, d.badges)} picksRead={d.picks !== null} />
                ))}
              </TemplateRows>
            </div>
          </div>
        </ToolSection>
      ))}
    </>
  );
}

function BadgesShelf({ d }: { d: StoreData }) {
  if (!d.badges) return <ToolFail title="Couldn’t load your badges" retryHref={routes.vendorDashboard.shop.store.shelf('badges')} />;
  const followed = followedBadges(d.picks?.badges ?? null, d.badges);
  const tiles = d.badges;
  const on = followed.keys.map((k) => tiles.find((t) => t.key === k)!).filter(Boolean);
  const more = tiles.filter((t) => t.key !== 'verified' && !followed.keys.includes(t.key as never));
  const verified = tiles.find((t) => t.key === 'verified');
  const full = followed.pinned && followed.keys.length >= MAX_FOLLOWED_BADGES;
  const canWrite = d.picks !== null;
  return (
    <>
      <ToolSection label="On your Shop" count={on.length} data="store-badges-on">
        <div data-store-block="">
          <div data-store-list="">
              <TemplateRows label="On your Shop">
              {on.map((t) => (
                <ToolRow
                  key={t.key}
                  attrs={{ 'data-store-row': '', 'data-store-name': t.title, 'data-store-badge': t.key }}
                  lead={<BadgeArt tile={t} size={44} />}
                  title={t.title}
                  lines={[[goalWords(t), t.tierName ? `${t.tierName} now` : null].filter(Boolean).join(' · ') || t.sub]}
                  right={
                    !canWrite ? null : followed.pinned ? (
                      <StoreOp op="badge_unfollow" fields={{ badge: t.key }} tone="ok" icon={<Check aria-hidden strokeWidth={2.2} />} label="Following" />
                    ) : (
                      <StoreOp op="badge_follow" fields={{ badge: t.key }} tone="neutral" quiet icon={<Check aria-hidden strokeWidth={2.2} />} label="Closest" />
                    )
                  }
                />
              ))}
            </TemplateRows>
          </div>
        </div>
      </ToolSection>
      {more.length > 0 ? (
        <ToolSection label="More badges" count={more.length} data="store-badges-more">
          <div data-store-block="">
            <div data-store-list="">
              <TemplateRows label="More badges">
                {more.map((t) => (
                  <ToolRow
                    key={t.key}
                    attrs={{ 'data-store-row': '', 'data-store-name': t.title, 'data-store-badge': t.key }}
                    lead={<BadgeArt tile={t} size={44} />}
                    title={t.title}
                    lines={[goalWords(t) ?? t.sub]}
                    right={
                      !canWrite ? null : full ? (
                        <ToolChip tone="quiet">Unfollow one first</ToolChip>
                      ) : (
                        <StoreOp op="badge_follow" fields={{ badge: t.key }} tone="info" icon={<Plus aria-hidden strokeWidth={2} />} label="Follow" />
                      )
                    }
                  />
                ))}
                {verified ? (
                  <ToolRow
                    attrs={{ 'data-store-row': '', 'data-store-name': verified.title, 'data-store-badge': 'verified' }}
                    lead={<BadgeArt tile={verified} size={44} />}
                    title={verified.title}
                    lines={[verified.state === 'earned' ? 'Earned. Your papers were approved.' : verified.state === 'unread' ? verified.sub : 'Send your papers to earn it.']}
                    right={verified.state === 'earned' ? <ToolChip tone="ok">Earned</ToolChip> : null}
                  />
                ) : null}
              </TemplateRows>
            </div>
          </div>
        </ToolSection>
      ) : null}
      <div className="mt-4">
        <ActionButton tone="neutral" icon={<ChevronRight aria-hidden strokeWidth={2} />} label="Every badge and its steps" href={routes.vendorDashboard.shop.badges()} />
      </div>
    </>
  );
}
