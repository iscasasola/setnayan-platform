import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageMasthead } from '@/app/_components/page-masthead';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLAN_GROUPS } from '@/lib/wedding-plan-groups';
import { NAV_ICON_NAMES } from '@/lib/nav-icons';
import { ADMIN_ASK_PARAM } from '@/lib/admin-map/humanize-field';
import { AddEventType, AddReligion, AddServiceOrCategory } from './_components/add-rows';
import { AskPrefill } from './_components/ask-prefill';
import { categoriesHref, coerceShow, readState, type CategoriesList, type SearchParamsRecord } from './_components/back';
import { CategoryPanel, GroupPanel, ServicePanel, categoryChoices, type CategoriesPanelData } from './_components/category-panels';
import { EventTypePanel } from './_components/event-type-panel';
import { CategoriesList as CategoriesListPane, EventTypesList, ReligionsList } from './_components/list-pane';
import { loadCategories, loadRefinementCards, loadReligions, loadVocab, paperworkTileId } from './_components/load';
import { categoryListRows, mapTargetsClosestFirst, unfiledServices, wordsWaiting } from './_components/model';
import { NavPick } from './_components/pickers';
import { MixedFaithPanel, ReligionPanel } from './_components/religion-panel';
import { RequestRow } from './_components/request-row';
import { backRecord } from './_components/ui';

/**
 * Categories & event types — ONE admin page for supplier categories, event
 * types and religions (owner approval, DECISION_LOG 2026-10-02: "1. yes. no
 * more taxonomy 2. yes. if they have events for that as well. 3. new 4. ok").
 *
 * Replaces the Taxonomy Studio and its search-words page, the per-event-type
 * Scope / Profile / Onboarding pages and the Traditions tab of /admin/ugat —
 * their old addresses forward here (lib/legacy-redirects.ts). One title
 * dropdown picks the list; the list sits on the left with one search; a row
 * opens one panel on the right whose sections are always in the same order;
 * "+ Add" works in place. Each link between two lists is edited in ONE place
 * and shown read-only on the other side.
 *
 * Server-rendered: every save is a shipped server action that redirects back
 * here (see `_components/back.ts`); the only client code is the dropdowns and
 * the editors that were already client-side.
 */
export const metadata = { title: 'Categories & event types · Admin' };
export const dynamic = 'force-dynamic';

const LIST_LABEL: Record<CategoriesList, string> = {
  categories: 'Supplier categories',
  'event-types': 'Event types',
  religions: 'Religions',
};

const SHOW_LABEL: Record<string, string> = {
  '': 'Everything',
  requests: 'Requests',
  unfiled: 'Unfiled',
  religion: 'Religion-tagged',
  scoped: 'Event-scoped',
  hidden: 'Hidden from couples',
  words: 'Words waiting',
};

/** Couple-facing default icon per group — mirrors the /explore strip. */
const GROUP_DEFAULT_ICON: Record<string, string> = {
  venue: 'Building2',
  planning: 'ClipboardList',
  feast: 'UtensilsCrossed',
  design: 'Flower2',
  program: 'Music',
  documentary: 'Camera',
  look: 'Shirt',
  booths: 'Tent',
  prints: 'Mail',
  transport: 'Car',
  experience: 'Compass',
  dining: 'Utensils',
  logistics_safety: 'ShieldCheck',
  insurance: 'Umbrella',
  specialty: 'Sparkles',
};

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? '';
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<SearchParamsRecord> }) {
  await requireAdmin();
  const sp = await searchParams;
  const state = readState(sp);
  const adding = first(sp.add) === '1';
  const asking = Boolean(first(sp[ADMIN_ASK_PARAM]));
  const ok = first(sp.ok);
  const error = first(sp.error);
  const back = backRecord(state);
  const openTile = state.open.startsWith('c:') ? state.open.slice(2) : null;

  const admin = createAdminClient();
  const vocab = await loadVocab(admin, { readiness: state.list === 'religions' || asking });
  const cats = state.list !== 'religions' || asking ? await loadCategories(admin, openTile) : null;
  const rel = state.list === 'religions' ? await loadReligions(admin) : null;

  const failed = [...vocab.failed, ...(cats?.failed ?? []), ...(rel?.failed ?? [])];
  const eventLabel = Object.fromEntries(vocab.eventTypes.map((e) => [e.key, e.label]));

  // ── The counts line ───────────────────────────────────────────────────────
  let counts = '';
  if (state.list === 'categories' && cats) {
    const unfiled = cats.services.filter((s) => !s.tileId).length;
    const waiting = cats.services.reduce((n, s) => n + s.words.filter((w) => !w.live).length, 0);
    const noDeadline = PLAN_GROUPS.filter(
      (g) => g.countsTowardLockable !== false && !cats.deadlines.some((d) => d.kind === 'service' && d.refKey === g.id),
    ).length;
    counts = [
      `${cats.groups.length} groups`,
      `${cats.categories.length} categories`,
      `${cats.services.length} services`,
      `${cats.requests.length} requests`,
      `${waiting} words waiting`,
      unfiled > 0 ? `${unfiled} unfiled` : null,
      noDeadline > 0 ? `${noDeadline} categories have no deadline` : null,
      cats.brokenCoupleLinks > 0 ? `${cats.brokenCoupleLinks} couple-side links broken` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  } else if (state.list === 'event-types') {
    const inPicker = vocab.eventTypes.filter((e) => e.status === 'active' && e.enabled).length;
    const retired = vocab.eventTypes.filter((e) => e.status === 'retired').length;
    counts = `${vocab.eventTypes.length} event types · ${inPicker} in the picker · ${vocab.eventTypes.length - inPicker - retired} hidden · ${retired} retired`;
  } else if (state.list === 'religions' && rel) {
    const live = vocab.religions.filter((r) => r.launch?.status === 'active').length;
    const soon = vocab.religions.filter((r) => r.launch?.status === 'coming_soon').length;
    const tagged = rel.services.filter((s) => s.faith).length;
    counts = `${vocab.religions.length} religions · ${live} live for couples · ${soon} coming soon · ${tagged} services tagged`;
  }

  // ── The list ──────────────────────────────────────────────────────────────
  const panelData: CategoriesPanelData | null = cats
    ? {
        groups: cats.groups,
        categories: cats.categories,
        services: cats.services,
        deadlines: cats.deadlines,
        planGroups: PLAN_GROUPS.map((g) => ({
          id: g.id,
          label: g.label,
          catalogTile: g.catalogTile ?? null,
          catalogFolder: g.catalogFolder,
        })),
        paperworkTileId: paperworkTileId(),
        eventLabels: vocab.eventLabels,
        religions: vocab.religions,
        iconNames: NAV_ICON_NAMES,
        groupDefaultIcon: GROUP_DEFAULT_ICON,
      }
    : null;
  const catChoices = cats ? categoryChoices(cats.groups, cats.categories) : [];

  let list: ReactNode = null;
  if (state.list === 'categories' && cats) {
    list = (
      <CategoriesListPane
        state={state}
        groups={categoryListRows({
          groups: cats.groups,
          categories: cats.categories,
          services: cats.services,
          requests: cats.requests,
          q: state.q,
          show: state.show,
        })}
        unfiled={unfiledServices(cats.services, state.q)}
        waiting={wordsWaiting(cats.services, state.q)}
        requests={cats.requests}
        eventLabel={eventLabel}
        failed={cats.failed.includes('the category tree')}
      />
    );
  } else if (state.list === 'event-types') {
    list = (
      <EventTypesList
        state={state}
        eventTypes={vocab.eventTypes}
        categories={cats?.categories ?? null}
        failed={vocab.failed.includes('event types')}
      />
    );
  } else if (rel) {
    const tagged: Record<string, number> = {};
    for (const s of rel.services) if (s.faith) tagged[s.faith] = (tagged[s.faith] ?? 0) + 1;
    list = (
      <ReligionsList
        state={state}
        religions={vocab.religions}
        taggedCount={rel.failed.includes('services') ? null : tagged}
        failed={vocab.failed.includes('religions')}
      />
    );
  }

  // ── The panel ─────────────────────────────────────────────────────────────
  let panel: ReactNode = null;
  if (state.list === 'categories' && cats && panelData) {
    if (state.show === 'requests' && !state.open) {
      panel = (
        <section aria-label="Supplier requests" data-panel="requests">
          <h2 className="pb-3 text-xl font-semibold text-ink">Requests ({cats.requests.length})</h2>
          <ul className="space-y-3">
            {cats.requests.map((r) => (
              <RequestRow
                key={r.requestId}
                request={r}
                targets={mapTargetsClosestFirst(r, cats.services)}
                categories={catChoices}
                back={back}
              />
            ))}
          </ul>
        </section>
      );
    } else if (state.open.startsWith('g:')) {
      const g = cats.groups.find((x) => x.id === state.open.slice(2));
      if (g) panel = <GroupPanel group={g} data={panelData} state={state} />;
    } else if (openTile) {
      const c = cats.categories.find((x) => x.id === openTile);
      if (c) {
        const { cards, failed: cardsFailed } = await loadRefinementCards(admin, c.id);
        panel = <CategoryPanel category={c} cards={cards} cardsFailed={cardsFailed} data={panelData} state={state} />;
      }
    } else if (state.open.startsWith('s:')) {
      const s = cats.services.find((x) => x.canonical === state.open.slice(2));
      if (s) panel = <ServicePanel service={s} data={panelData} state={state} />;
    }
  } else if (state.list === 'event-types' && cats) {
    const et = vocab.eventTypes.find((e) => e.key === state.open);
    if (et) {
      panel = (
        <EventTypePanel
          vocab={et}
          eventTypes={vocab.eventTypes}
          groups={cats.groups}
          categories={cats.categories}
          religions={vocab.religions}
          state={state}
        />
      );
    }
  } else if (state.list === 'religions' && rel) {
    if (state.open === 'mixed') panel = <MixedFaithPanel data={rel} state={state} />;
    const r = vocab.religions.find((x) => x.key === state.open);
    if (r) panel = <ReligionPanel religion={r} eventLabels={vocab.eventLabels} data={rel} state={state} />;
  }

  // ── + Add ─────────────────────────────────────────────────────────────────
  const cancelHref = categoriesHref({ ...state });
  let addRow: ReactNode = null;
  if (adding && state.list === 'categories' && cats) {
    addRow = (
      <AddServiceOrCategory
        services={cats.services.map((s) => ({
          key: s.canonical,
          label: s.en,
          tileId: s.tileId,
          aliases: s.words.filter((w) => w.live).map((w) => w.phrase),
        }))}
        categories={catChoices}
        groups={cats.groups.map((g) => ({ key: g.id, label: g.label }))}
        religions={vocab.religions.filter((r) => r.status === 'active').map((r) => ({ key: r.key, label: r.label }))}
        back={back}
        cancelHref={cancelHref}
      />
    );
  } else if (adding && state.list === 'event-types') {
    addRow = (
      <AddEventType existing={vocab.eventTypes.map((e) => ({ key: e.key, label: e.label }))} back={back} cancelHref={cancelHref} />
    );
  } else if (adding && state.list === 'religions') {
    addRow = (
      <AddReligion existing={vocab.religions.map((r) => ({ key: r.key, label: r.label }))} back={back} cancelHref={cancelHref} />
    );
  }

  const listHref = (l: CategoriesList) => categoriesHref({ list: l });
  const showHrefs = Object.fromEntries(
    Object.keys(SHOW_LABEL).map((k) => [k || 'everything', categoriesHref({ ...state, show: coerceShow(k), open: '' })]),
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <PageMasthead title="Categories & event types" />

      {ok || error ? (
        <div
          role={error ? 'alert' : 'status'}
          className={`sticky top-2 z-20 mb-3 rounded-xl px-4 py-2.5 text-sm shadow-sm ${
            error ? 'bg-danger-50 text-danger-800' : 'bg-success-50 text-success-800'
          }`}
        >
          {error || ok}
        </div>
      ) : null}

      {failed.length > 0 ? (
        <p role="alert" className="mb-3 rounded-xl bg-[var(--sn-warning-soft)] px-4 py-2.5 text-sm text-ink">
          Couldn’t load {failed.join(', ')} — anything that reads “—” below is unknown, not zero.
        </p>
      ) : null}

      {asking && cats ? (
        <div className="mb-4">
          <AskPrefill
            groups={cats.groups.map((g) => ({ id: g.id, label: g.label }))}
            tiles={cats.categories.map((c) => ({ id: c.id, label: c.label }))}
            catalogs={{
              eventType: vocab.eventTypes.map((e) => ({ value: e.key, label: e.label })),
              faith: vocab.religions.map((r) => ({ value: r.key, label: r.label })),
              tile: cats.categories.map((c) => ({ value: c.id, label: c.label })),
              node: [
                ...cats.groups.map((g) => ({ value: g.id, label: g.label })),
                ...cats.categories.map((c) => ({ value: c.id, label: c.label })),
              ],
              service: cats.services.map((s) => ({ value: s.canonical, label: s.en })),
              request: cats.requests.map((r) => ({ value: r.requestId, label: `${r.proposedLabel} — ${r.supplierName}` })),
              icon: NAV_ICON_NAMES.map((n) => ({ value: n, label: n })),
            }}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(300px,380px)_1fr]">
        <aside className={state.open || (state.show === 'requests' && panel) ? 'hidden lg:block' : ''} data-pane="list">
          <div className="flex items-center justify-between gap-2">
            <NavPick
              label="List"
              value={state.list}
              choices={(Object.keys(LIST_LABEL) as CategoriesList[]).map((k) => ({ key: k, label: LIST_LABEL[k] }))}
              hrefs={{ categories: listHref('categories'), 'event-types': listHref('event-types'), religions: listHref('religions') }}
            />
            <Link
              href={categoriesHref({ ...state, add: true })}
              className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-cream"
            >
              + Add
            </Link>
          </div>
          <form method="get" action="/admin/categories" className="mt-3 flex items-center gap-2" role="search">
            {state.list !== 'categories' ? <input type="hidden" name="list" value={state.list} /> : null}
            {state.show ? <input type="hidden" name="show" value={state.show} /> : null}
            <input
              type="search"
              name="q"
              defaultValue={state.q}
              maxLength={80}
              placeholder={
                state.list === 'categories'
                  ? 'Find a group, category or service'
                  : state.list === 'event-types'
                    ? 'Find an event type'
                    : 'Find a religion'
              }
              aria-label="Search this list"
              className="min-h-10 min-w-0 flex-1 rounded-full border border-ink/15 bg-white px-4 text-sm text-ink"
            />
            {state.list === 'categories' ? (
              <NavPick
                label="Show"
                value={state.show || 'everything'}
                compact
                choices={Object.entries(SHOW_LABEL).map(([k, v]) => ({ key: k || 'everything', label: v }))}
                hrefs={showHrefs}
              />
            ) : null}
          </form>
          {counts ? <p className="mt-2 px-1 text-xs text-ink/70" data-counts="">{counts}</p> : null}
          {addRow ? <div className="mt-3">{addRow}</div> : null}
          <nav aria-label={LIST_LABEL[state.list]} className="mt-3">
            {list}
          </nav>
        </aside>

        <section className={state.open || (state.show === 'requests' && panel) ? '' : 'hidden lg:block'} data-pane="panel">
          {state.open ? (
            <Link href={categoriesHref({ ...state, open: '' })} className="mb-3 inline-flex min-h-10 items-center text-sm font-medium text-ink lg:hidden">
              ‹ {LIST_LABEL[state.list]}
            </Link>
          ) : null}
          {panel ?? (
            <p className="rounded-2xl border border-dashed border-ink/15 px-4 py-10 text-center text-sm text-ink/70">
              {state.open ? 'That one no longer exists.' : 'Pick a row on the left.'}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
