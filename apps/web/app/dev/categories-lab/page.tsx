/**
 * /dev/categories-lab — the four-level Categories map (🌳 ③b) with NO sign-in, for the side-by-side with
 * the approved prototype (corpus prototypes/admin_taxonomy_four_levels_2026-10-26/interactive-v4.html).
 * DEV-ONLY: production builds 404 this route (`the-lab-never-ships.test.ts`), the same kill-switch as the
 * other labs.
 *
 * Why it exists: /admin/categories needs an admin session and the service-role key, and a local checkout has
 * neither (`createAdminClient()` falls back to the anon key in `next dev`), so an admin screenshot taken
 * locally is EMPTY, not merely incomplete. This lab draws the REAL `FourLevelMap` and the REAL drawer panels
 * from the same loaders: the category tree, services and cards come from whatever the anon key may read; the
 * parts, which only a signed-in account may read, come from the reader's own seed (expanded the way the
 * backfill did) when the table read is refused. Writes do nothing here (they need an admin).
 *
 *   ?in=c:<category>     stand on a category   · &at=s:<service> select a service (the Finder shift)
 *   ?open=g:|c:|s:|p:|k:  open a drawer         · &q=… / &show=needs|parts|nosvc-cat|nosvc-part|hidden
 *   &cards=fixture        three LAB FIXTURE cards on Function Hall (titled "(lab) …"), for the Cards column
 */
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { NAV_ICON_NAMES } from '@/lib/nav-icons';
import { fallbackInspirationParts } from '@/lib/inspiration-parts';
import { canonicalServicesForSlot } from '@/lib/moodboard-gallery';
import { readMapParams, readState, type SearchParamsRecord } from '@/app/admin/categories/_components/back';
import { CategoryPanel, GroupPanel, ServicePanel, type CategoriesPanelData } from '@/app/admin/categories/_components/category-panels';
import { FourLevelMap } from '@/app/admin/categories/_components/four-level-map';
import { cardById, partByKey, type MapCard, type MapData } from '@/app/admin/categories/_components/four-level-model';
import { GROUP_DEFAULT_ICON } from '@/app/admin/categories/_components/group-icons';
import { loadCategories, loadRefinementCards, loadVocab, paperworkTileId } from '@/app/admin/categories/_components/load';
import { loadMapData } from '@/app/admin/categories/_components/load-map';
import { CardPanel, PartPanel } from '@/app/admin/categories/_components/map-panels';

export const dynamic = 'force-dynamic';

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

/** The parts from the reader's seed, expanded through the categories exactly as the ③a backfill did. */
function seedParts(): MapData['parts'] {
  const seed = fallbackInspirationParts();
  return seed.parts
    .filter((p) => p.kind === 'part' && p.homeCategoryId)
    .map((p) => ({ key: p.slotKey, label: p.label, home: p.homeCategoryId!, services: canonicalServicesForSlot(p.slotKey, seed), hidden: p.hidden }));
}

function fixtureCards(d: MapData): MapCard[] {
  if (!d.services.some((s) => s.key === 'function_hall')) return [];
  return [
    { id: 'lab-1', title: '(lab) Grand ballroom, 300 pax', price: 150000, active: true, service: 'function_hall', shopId: 'lab', shopName: 'Lab fixture shop', shopPublic: true, photoUrl: null },
    { id: 'lab-2', title: '(lab) Function hall, half-day', price: 45000, active: false, service: 'function_hall', shopId: 'lab', shopName: 'Lab fixture shop', shopPublic: true, photoUrl: null },
    { id: 'lab-3', title: '(lab) Garden hall, 150 pax', price: 85000, active: true, service: 'function_hall', shopId: 'lab2', shopName: 'Lab fixture shop 2', shopPublic: false, photoUrl: null },
  ];
}

export default async function CategoriesLabPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  const state = readState(sp);
  const at = readMapParams(sp);
  const admin = createAdminClient();
  const openTile = state.open.startsWith('c:') ? state.open.slice(2) : null;
  const [vocab, cats] = await Promise.all([loadVocab(admin, { readiness: false }), loadCategories(admin, openTile)]);
  let data = await loadMapData(admin, cats);
  if (!data.partsRead) data = { ...data, parts: seedParts(), partsRead: true };
  if (first(sp.cards) === 'fixture') {
    const cards = [...data.cards, ...fixtureCards(data)];
    data = { ...data, cards, cardsRead: true, services: data.services.map((s) => ({ ...s, cards: cards.filter((c) => c.service === s.key).length })) };
  }

  const panelData: CategoriesPanelData = {
    groups: cats.groups,
    categories: cats.categories,
    services: cats.services,
    deadlines: cats.deadlines,
    planGroups: PLAN_GROUPS.map((g) => ({ id: g.id, label: g.label, catalogTile: g.catalogTile ?? null, catalogFolder: g.catalogFolder })),
    paperworkTileId: paperworkTileId(),
    eventLabels: vocab.eventLabels,
    religions: vocab.religions,
    iconNames: NAV_ICON_NAMES,
    groupDefaultIcon: GROUP_DEFAULT_ICON,
  };

  let panel = null;
  if (state.open.startsWith('g:')) {
    const g = cats.groups.find((x) => x.id === state.open.slice(2));
    if (g) panel = <GroupPanel group={g} data={panelData} state={state} />;
  } else if (openTile) {
    const c = cats.categories.find((x) => x.id === openTile);
    if (c) {
      const { cards, failed } = await loadRefinementCards(admin, c.id);
      panel = <CategoryPanel category={c} cards={cards} cardsFailed={failed} data={panelData} state={state} map={data} />;
    }
  } else if (state.open.startsWith('s:')) {
    const s = cats.services.find((x) => x.canonical === state.open.slice(2));
    if (s) panel = <ServicePanel service={s} data={panelData} state={state} map={data} />;
  } else if (state.open.startsWith('p:')) {
    const p = partByKey(data, state.open.slice(2));
    if (p) panel = <PartPanel part={p} data={data} state={state} />;
  } else if (state.open.startsWith('k:')) {
    const cd = cardById(data, state.open.slice(2));
    if (cd) panel = <CardPanel card={cd} data={data} />;
  }

  return (
    <main className="mx-auto w-full max-w-7xl bg-cream px-4 py-6 sm:px-6 lg:px-8" data-lab="categories">
      <h1 className="mb-1 text-xl font-semibold text-ink">Categories &amp; event types</h1>
      <p className="mb-3 text-xs text-ink/70">
        Dev lab · the real map on {cats.tax.source === 'db' ? 'the live tree (read-only)' : 'the code copy'}
        {first(sp.cards) === 'fixture' ? ' · three “(lab)” fixture cards on Function Hall' : ''}
      </p>
      <FourLevelMap
        data={data}
        start={{ in: at.in, at: at.at, open: state.open }}
        q={state.q}
        show={state.show}
        drawer={panel}
        counts={`${cats.groups.length} groups · ${cats.categories.length} categories · ${cats.services.length} services`}
        groupDefaultIcon={GROUP_DEFAULT_ICON}
        basePath="/dev/categories-lab"
      />
    </main>
  );
}
