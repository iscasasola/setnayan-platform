/**
 * category-panels.tsx — the drawer panels of the Supplier categories map: a GROUP, a CATEGORY, a SERVICE.
 *
 * 🎨 DRAWN TO THE APPROVED PANELS (owner 2026-10-29, "Approve panels" … "build them, with the One per event
 * switch" — prototype `carry-2026-10-29/admin-categories-proto/index.html`, capture `captures/LIVE-DRAWERS.md`). The
 * live sections are KEPT — every field, control and write the drawer had — and re-drawn as the guest card's folds:
 * breadcrumb · name · one count line with the key in an ⓘ, then folds in the prototype's order, one open at a time,
 * the danger fold (Delete · Combine) last and red. Every control saves IN PLACE (`drawer-kit.tsx`): text on blur or
 * Enter, switches on press, pickers on pick, each with "Saved — <what> · Undo"; the screen never resets.
 *
 * Every link to another list is shown READ-ONLY here, in the words the other list edits it with: which event types a
 * category shows for is set on the event type; which religion a service is only for is set on the religion.
 */
import Link from 'next/link';
import { formatCount } from '@/lib/format-number';
import { InfoTip } from '@/app/_components/info-tip';
import { categoryInfoText } from '@/lib/explore-info-copy';
import { folderInfoText } from '@/lib/category-hints';
import {
  deleteTileWithDestination,
  mergeCanonicalService,
  moveTileToFolder,
  reorderCategories,
} from '../actions';
import { mapReorder, mapWriteForm } from '../four-level-actions';
import { categoriesHref, type BackState } from './back';
import { CombineService, DeleteCategory, MoveGroupPick, OrderPick } from './in-place';
import {
  deadlinesForCategory,
  showsForLabel,
  type Category,
  type Deadline,
  type Group,
  type PlanDeadline,
  type RefinementCard,
  type Religion,
  type Service,
  type VocabLabel,
} from './model';
import { PictureAndIcon } from './picture-and-icon';
import { ListPick, SavePick, type Choice } from './pickers';
import { WhatCouplesChoose } from './what-couples-choose';
import { WhatSuppliersFillIn } from './what-suppliers-fill-in';
import type { MapData } from './four-level-model';
import { cardsOf, partsHomedIn, partsOfService, servicesOf, cardHeld, plural } from './four-level-model';
import { CategoryCards, CategoryParts, FilesShopsAs, ServiceCards, ServiceParts } from './map-panels';
import { DrawerAddRow, ChipPress, DeadlineInPlace, InPlaceFields, InPlaceSwitch, LastMinuteInPlace, Row } from './drawer-kit';
import { PanelFold, PanelHead, Quiet, Says } from './panel-kit';
import { INFO_TEXT_MAX } from './taxonomy-writes';
import { LevelIcon } from './map-rows';

type PlanGroupRef = { id: string; label: string; catalogTile?: string | null; catalogFolder?: string | null };

export type CategoriesPanelData = {
  groups: Group[];
  categories: Category[];
  services: Service[];
  deadlines: Deadline[];
  planGroups: readonly PlanGroupRef[];
  paperworkTileId: string | null;
  eventLabels: VocabLabel[];
  religions: Religion[];
  iconNames: readonly string[];
  /** Couple-facing default icon per group (matches /explore). */
  groupDefaultIcon: Record<string, string>;
};

/** Category choices for a PickMenu, grouped by their group's name. */
export function categoryChoices(groups: readonly Group[], categories: readonly Category[]): Choice[] {
  const name = new Map(groups.map((g) => [g.id, g.label]));
  const order = new Map(groups.map((g, i) => [g.id, i]));
  return [...categories]
    .sort((a, b) => (order.get(a.groupId) ?? 0) - (order.get(b.groupId) ?? 0) || a.sortOrder - b.sortOrder)
    .map((c) => ({ key: c.id, label: c.label, group: name.get(c.groupId) ?? c.groupId }));
}

const ord = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
const orderText = (i: number, n: number) => (i >= 0 ? `${ord(i + 1)} of ${formatCount(n)}` : '');
const unitWord = (u: string, n: number) => `${u}${n === 1 ? '' : 's'}`;

const LAST_MINUTE_TIP = 'Couples whose event is nearer than this see it as a last-minute booking in their reminders. Empty = off.';

function deadlineSummary(plan: readonly PlanDeadline[], documents: readonly Deadline[]): string {
  const p = plan[0];
  if (!p && documents.length === 0) return 'None';
  if (!p) return plural(documents.length, 'document deadline');
  const book = p.bookBy ? `Book by ${formatCount(p.bookBy.offsetValue)} ${unitWord(p.bookBy.offsetUnit, p.bookBy.offsetValue)}` : 'Book by — not set';
  return p.lastMinute != null ? `${book} · last-minute from ${formatCount(p.lastMinute)} mo` : book;
}

function DeadlineRows({ plan, documents }: { plan: PlanDeadline[]; documents: Deadline[] }) {
  if (plan.length === 0 && documents.length === 0) {
    return <Says>No deadline — the couple’s reminders do not ask about this one.</Says>;
  }
  return (
    <div className="flex flex-col gap-3">
      {plan.map((p) => (
        <div key={p.planGroupId} className="flex flex-col gap-2" data-deadline={p.planGroupId}>
          {plan.length > 1 ? <p className="text-[12.5px] font-semibold text-ink">{p.label}</p> : null}
          {p.bookBy ? (
            <DeadlineInPlace label="Book by" deadlineId={p.bookBy.deadlineId} value={p.bookBy.offsetValue} unit={p.bookBy.offsetUnit} />
          ) : (
            <Row label="Book by">
              <Says>Not set (the code default applies)</Says>
            </Row>
          )}
          <LastMinuteInPlace
            refKey={p.planGroupId}
            label={p.label}
            months={p.lastMinute}
            tip={<InfoTip label="" ariaLabel="About last-minute" align="start">{LAST_MINUTE_TIP}</InfoTip>}
          />
        </div>
      ))}
      {documents.map((d) => (
        <DeadlineInPlace key={d.deadlineId} label={d.label ?? d.refKey} deadlineId={d.deadlineId} value={d.offsetValue} unit={d.offsetUnit} />
      ))}
    </div>
  );
}

const ROW_LINK = 'sn-press flex min-h-12 w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-ink hover:bg-ink/5';
const CHIP = 'sn-press inline-flex min-h-10 items-center gap-1.5 rounded-full border border-ink/15 bg-raised px-3 text-[14px] text-ink hover:bg-ink/5';

/**
 * "ⓘ text" — where the owner writes the line a group's or a category's ⓘ shows on the Suppliers page (owner
 * 2026-10-31: "This means you need to add a place for me to write an (i)"). `service_categories.hint_en`, saved in
 * place. Empty is fine: the ⓘ is never hidden — it shows `fallback` (the old line, else one built from this list),
 * which the row's own ⓘ says in full.
 */
function InfoTextField({ id, written, fallback }: { id: string; written: string | null; fallback: string }) {
  return (
    <InPlaceFields
      kind="info-text"
      hidden={{ id }}
      fields={[
        {
          name: 'hint_en',
          label: 'ⓘ text',
          value: written ?? '',
          what: 'ⓘ text',
          placeholder: 'One line: what it covers',
          maxLength: INFO_TEXT_MAX,
          multiline: true,
          tip: (
            <InfoTip label="" ariaLabel="About the ⓘ text" align="start">
              What couples read when they press ⓘ on this row of the Suppliers page. Left empty, they see: “{fallback}”
            </InfoTip>
          ),
        },
      ]}
    />
  );
}

// ── Group ───────────────────────────────────────────────────────────────────

export function GroupPanel({ group, data, state }: { group: Group; data: CategoriesPanelData; state: BackState }) {
  const groupOrder = data.groups.map((g) => g.id);
  const cats = data.categories.filter((c) => c.groupId === group.id);
  const scoped = cats.filter((c) => c.eventTypes && c.eventTypes.length > 0);
  const groupPlans = data.planGroups.filter((g) => !g.catalogTile && g.catalogFolder === group.id);
  const plan: PlanDeadline[] = groupPlans.map((g) => ({
    planGroupId: g.id,
    label: g.label,
    bookBy: data.deadlines.find((d) => d.kind === 'service' && d.scope === 'category' && d.refKey === g.id) ?? null,
    lastMinute: data.deadlines.find((d) => d.kind === 'last_minute_start' && d.refKey === g.id)?.offsetValue ?? null,
  }));
  const shows = scoped.length === 0 ? 'All events' : `${formatCount(cats.length - scoped.length)} for all · ${formatCount(scoped.length)} for some`;
  return (
    <article data-panel="group">
      <PanelHead crumbs={[{ level: 'group', label: 'Group' }]} title={group.label} sub={plural(cats.length, 'category', 'categories')} keyText={group.id} />

      <PanelFold
        id="name"
        title="Name"
        summary={`${group.short && group.short !== group.label ? `${group.label} · ${group.short}` : group.label}${group.hint ? '' : ' · ⓘ not written'}`}
      >
        <InPlaceFields
          kind="rename-node"
          hidden={{ id: group.id }}
          fields={[
            { name: 'label_en', label: 'English', value: group.label, what: 'Name' },
            {
              name: 'label_short',
              label: 'Short',
              value: group.short === group.label ? '' : group.short,
              what: 'Short name',
              maxLength: 40,
              tip: <InfoTip label="" ariaLabel="About the short name" align="start">The short word the /explore strip and the bottom of a tile use when the full name will not fit.</InfoTip>,
            },
          ]}
        />
        <InfoTextField
          id={group.id}
          written={group.hint}
          fallback={folderInfoText({ folder: group.id, label: group.label, categoryLabels: cats.map((c) => c.label) })}
        />
      </PanelFold>

      <PanelFold id="where" title="Where it sits" summary={orderText(groupOrder.indexOf(group.id), groupOrder.length)}>
        <Row label="Order" tip={<InfoTip label="" ariaLabel="About the order" align="start">Among the groups, on this page and on the couple’s /explore strip.</InfoTip>}>
          <OrderPick id={group.id} siblings={groupOrder} save={mapReorder.bind(null, 'groups', '')} />
        </Row>
      </PanelFold>

      <PanelFold id="cats" title="Categories" summary={formatCount(cats.length)}>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <Link key={c.id} href={categoriesHref({ ...state, open: `c:${c.id}` })} scroll={false} className={CHIP}>
              <LevelIcon level="category" accent />
              <span className="[overflow-wrap:anywhere]">{c.label}</span>
              <small className="text-xs text-ink/70">{formatCount(c.serviceCount)}</small>
            </Link>
          ))}
        </div>
        <DrawerAddRow text={`Add a category to ${group.label}`} placeholder="New category name" door={{ op: 'addCategory', groupId: group.id }} what="Category" />
      </PanelFold>

      <PanelFold id="vis" title="Visibility" summary={`${shows} · shown`} last={plan.length === 0}>
        <Says>
          {scoped.length === 0 ? (
            <>
              Every category here shows for <b>all events</b>.
            </>
          ) : (
            <>
              {formatCount(cats.length - scoped.length)} categories for all events · {formatCount(scoped.length)} for some event types only.
            </>
          )}
        </Says>
        <Quiet>Which events a category shows for is set on the event type (Event types list).</Quiet>
        <Says>A new group is hidden from couples until it holds a category — then it shows on its own.</Says>
      </PanelFold>

      {plan.length > 0 ? (
        <PanelFold id="deadline" title="Deadline" summary={deadlineSummary(plan, [])} last>
          <DeadlineRows plan={plan} documents={[]} />
        </PanelFold>
      ) : null}
    </article>
  );
}

// ── Category ────────────────────────────────────────────────────────────────

export function CategoryPanel({
  category,
  cards,
  cardsFailed,
  data,
  state,
  map,
}: {
  category: Category;
  cards: RefinementCard[];
  cardsFailed: boolean;
  data: CategoriesPanelData;
  state: BackState;
  /** The four-level map's data (③b) — parts, service cards, the coarse filing. */
  map?: MapData;
}) {
  const group = data.groups.find((g) => g.id === category.groupId);
  const services = data.services.filter((s) => s.tileId === category.id);
  const siblings = data.categories.filter((c) => c.groupId === category.groupId).map((c) => c.id);
  const { plan, documents } = deadlinesForCategory(category.id, data.planGroups, data.deadlines, data.paperworkTileId);
  const holds = category.serviceCount + category.refinementCount;
  const destinations = categoryChoices(data.groups, data.categories).filter((c) => c.key !== category.id);
  const religionLabel = new Map(data.religions.map((r) => [r.key, r.label]));
  const mapCat = map?.categories.find((c) => c.id === category.id) ?? null;
  const coarse = mapCat?.coarse ?? null;
  const homeParts = map ? partsHomedIn(map, category.id) : [];
  const keys = map ? servicesOf(map, category.id).map((s) => s.key) : [];
  const fed = map ? map.parts.filter((p) => p.home !== category.id && p.services.some((k) => keys.includes(k))) : [];
  const catCards = map?.cardsRead ? cardsOf(map, keys) : null;
  const heldN = catCards ? catCards.filter(cardHeld).length : 0;
  const shows = showsForLabel(category.eventTypes, data.eventLabels);
  const one = category.onePerEvent;
  const crumbs = [
    { level: 'group' as const, label: group?.label ?? 'Group', href: group ? categoriesHref({ ...state, open: `g:${group.id}` }) : undefined },
    { level: 'category' as const, label: 'Category' },
  ];
  const sub = [
    plural(services.length, 'service'),
    map?.partsRead ? plural(homeParts.length, 'part') : null,
    catCards ? plural(catCards.length, 'card') : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <article data-panel="category">
      <PanelHead
        crumbs={crumbs}
        title={category.label}
        sub={sub}
        gap={services.length === 0}
        keyText={category.id}
        keyNote={`A developer key — what the database and a shop’s card point at; its address on /explore is “${category.slug}”. It never changes, even when the name does.`}
      />

      <PanelFold id="name" title="Name" summary={`${category.label}${category.hint ? '' : ' · ⓘ not written'}`}>
        <InPlaceFields kind="rename-node" hidden={{ id: category.id }} fields={[{ name: 'label_en', label: 'Name', value: category.label, what: 'Name' }]} />
        <InfoTextField
          id={category.id}
          written={category.hint}
          fallback={categoryInfoText({ tile: category.id, label: category.label, serviceLabels: services.filter((s) => !s.hidden).map((s) => s.en) })}
        />
      </PanelFold>

      <PanelFold
        id="where"
        title="Where it sits"
        summary={`${group?.label ?? '—'} · ${orderText(siblings.indexOf(category.id), siblings.length)}${map && !coarse ? ' · not filed' : ''}`}
      >
        <Row label="Group">
          <MoveGroupPick groupId={category.groupId} groups={data.groups.map((g) => ({ key: g.id, label: g.label }))} move={moveTileToFolder.bind(null, category.id)} />
        </Row>
        <Row label="Order" tip={<InfoTip label="" ariaLabel="About the order" align="start">Among its neighbours in this group — on this page, on /explore and on the Suppliers page.</InfoTip>}>
          <OrderPick id={category.id} siblings={siblings} save={reorderCategories.bind(null, category.groupId)} />
        </Row>
        {map ? <FilesShopsAs categoryId={category.id} coarse={coarse} /> : null}
      </PanelFold>

      <PanelFold id="services" title="Services" summary={formatCount(services.length)}>
        <Quiet>What suppliers pick in their shop — the last level before the parts.</Quiet>
        <ul className="flex flex-col">
          {services.map((s) => (
            <li key={s.canonical}>
              <Link href={categoriesHref({ ...state, open: `s:${s.canonical}` })} scroll={false} className={ROW_LINK}>
                <LevelIcon level="service" accent />
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] font-medium [overflow-wrap:anywhere]">{s.en}</b>
                  {s.faith || s.askedFor >= 2 ? (
                    <small className="block text-xs text-ink/70">
                      {s.faith ? religionLabel.get(s.faith) ?? s.faith : ''}
                      {s.askedFor >= 2 ? `${s.faith ? ' · ' : ''}asked for ${formatCount(s.askedFor)}×` : ''}
                    </small>
                  ) : null}
                </span>
                {map ? <span className="shrink-0 text-xs text-ink/70">{plural(map.services.find((x) => x.key === s.canonical)?.cards ?? 0, 'card')}</span> : null}
              </Link>
            </li>
          ))}
        </ul>
        <DrawerAddRow text={`Add a service to ${category.label}`} placeholder="New service name" door={{ op: 'addService', categoryId: category.id }} what="Service" />
      </PanelFold>

      {map ? (
        <PanelFold id="parts" title="Parts" summary={map.partsRead ? `${formatCount(homeParts.length)}${fed.length ? ` · ${formatCount(fed.length)} fed` : ''}` : 'Couldn’t read'}>
          <Quiet>What couples see on the Inspiration board. The link between a part and a service is set on the part.</Quiet>
          <CategoryParts categoryId={category.id} data={map} state={state} />
        </PanelFold>
      ) : null}

      {map ? (
        <PanelFold id="cards" title="Service cards" summary={catCards ? (catCards.length ? `${formatCount(catCards.length)}${heldN ? ` · ${formatCount(heldN)} held` : ''}` : 'None yet') : 'Couldn’t read'}>
          <CategoryCards categoryId={category.id} data={map} state={state} />
        </PanelFold>
      ) : null}

      <PanelFold id="look" title="Look" summary={`${category.iconName ?? 'Group icon'} · ${category.photoRaw ? 'photo' : 'no photo'}`}>
        <PictureAndIcon
          id={category.id}
          label={category.label}
          iconName={category.iconName}
          defaultIcon={data.groupDefaultIcon[category.groupId] ?? null}
          photoRaw={category.photoRaw}
          photoUrl={category.photoUrl}
          iconNames={data.iconNames}
        />
      </PanelFold>

      <PanelFold id="choose" title="What couples choose" summary={cardsFailed ? 'Couldn’t read' : plural(cards.length, 'card')}>
        {cardsFailed ? (
          <p role="alert" className="text-sm text-ink">Couldn’t load the cards — refresh to try again.</p>
        ) : (
          <>
            <Quiet>The question cards a couple answers under this category. Each option needs a photo.</Quiet>
            <WhatCouplesChoose tile={{ id: category.id, label: category.label }} refinements={cards} />
          </>
        )}
      </PanelFold>

      <PanelFold id="vis" title="Visibility" summary={`${shows} · ${category.hidden ? 'hidden' : 'shown'}`}>
        <Says>
          Shows for <b>{shows}</b>
        </Says>
        <Quiet>Set on the event type (Event types list) — read-only here.</Quiet>
        <InPlaceSwitch
          label="Hidden from couples"
          on={category.hidden}
          door={{ form: 'category-hidden', hidden: { category_id: category.id }, field: 'hidden' }}
          help="Hidden on /explore, the Suppliers page and the Inspiration board. Shops keep their cards."
        />
      </PanelFold>

      <PanelFold id="one" title="One per event" summary={one == null ? 'Couldn’t read' : one ? 'On' : 'Off'}>
        {one == null ? (
          <p role="alert" className="text-sm text-ink">Couldn’t read this switch — refresh to try again.</p>
        ) : (
          <>
            <InPlaceSwitch
              label="One per event"
              on={one}
              door={{ op: 'onePerEvent', categoryId: category.id }}
              help="A couple books exactly one of this per event — a second lock asks them to switch."
            />
            {map && !coarse ? <Quiet>Its shops are not filed yet (Where it sits › Files shops as) — the switch bites once they are.</Quiet> : null}
          </>
        )}
      </PanelFold>

      <PanelFold id="deadline" title="Deadline" summary={deadlineSummary(plan, documents)}>
        <DeadlineRows plan={plan} documents={documents} />
      </PanelFold>

      <PanelFold id="danger" title="Delete category…" summary={`Holds ${plural(category.serviceCount, 'service')} · ${plural(category.refinementCount, 'card')}`} danger last>
        <Says>Everything it holds moves to the category you pick — nothing is stranded. Keys and links stay the same.</Says>
        <DeleteCategory
          label={category.label}
          holds={holds}
          destinations={destinations}
          remove={deleteTileWithDestination.bind(null, category.id)}
          goToAfter={categoriesHref({ ...state, open: `g:${category.groupId}` })}
        />
      </PanelFold>
    </article>
  );
}

// ── Service ─────────────────────────────────────────────────────────────────

const MARKS: Array<{ flag: string; label: string; on: (s: Service) => boolean }> = [
  { flag: 'is_ph', label: 'PH-specific', on: (s) => s.ph },
  { flag: 'is_rental', label: 'Rental', on: (s) => s.rental },
  { flag: 'is_tradition', label: 'Cultural / tradition', on: (s) => s.tradition },
  { flag: 'marketplace_hidden', label: 'Hidden from suppliers’ picker', on: (s) => s.hidden },
];

export function ServicePanel({
  service,
  data,
  state,
  map,
}: {
  service: Service;
  data: CategoriesPanelData;
  state: BackState;
  /** The four-level map's data (③b) — the parts it feeds, its cards, its place. */
  map?: MapData;
}) {
  const serviceOrder = map && service.tileId ? map.services.filter((s) => s.tileId === service.tileId).map((s) => s.key) : [];
  const category = data.categories.find((c) => c.id === service.tileId) ?? null;
  const group = category ? data.groups.find((g) => g.id === category.groupId) : null;
  const cats = categoryChoices(data.groups, data.categories);
  const religion = service.faith ? data.religions.find((r) => r.key === service.faith) : null;
  const siblings = data.services
    .filter((s) => s.tileId === service.tileId && s.canonical !== service.canonical)
    .map((s) => ({ key: s.canonical, label: s.en }));
  const leafDeadlines = data.deadlines.filter((d) => d.scope === 'leaf' && d.refKey === service.canonical);
  const eventName = new Map(data.eventLabels.map((e) => [e.key, e.label]));
  const sameAs = category ? `Same as ${category.label}` : 'Same as its category';
  const alsoText =
    service.secondaryTiles.length === 0 ? 'None' : service.secondaryTiles.map((t) => data.categories.find((c) => c.id === t)?.label ?? t).join(' · ');
  const showsText = !service.eventTypes || service.eventTypes.length === 0 ? sameAs : `Only ${service.eventTypes.map((k) => eventName.get(k) ?? k).join(' · ')}`;
  const parts = map ? partsOfService(map, service.canonical) : [];
  const svcCards = map?.cardsRead ? cardsOf(map, [service.canonical]) : null;
  const heldN = svcCards ? svcCards.filter(cardHeld).length : 0;
  const waiting = service.words.filter((w) => !w.live).length;
  const onMarks = MARKS.filter((m) => m.on(service)).map((m) => m.label);
  const crumbs = [
    ...(group ? [{ level: 'group' as const, label: group.label, href: categoriesHref({ ...state, open: `g:${group.id}` }) }] : []),
    ...(category ? [{ level: 'category' as const, label: category.label, href: categoriesHref({ ...state, open: `c:${category.id}` }) }] : []),
    { level: 'service' as const, label: category ? 'Service' : 'Service · unfiled' },
  ];
  const sub = [svcCards ? plural(svcCards.length, 'card') : null, map?.partsRead ? plural(parts.length, 'part') : null, service.askedFor >= 2 ? `asked for ${formatCount(service.askedFor)}×` : null]
    .filter(Boolean)
    .join(' · ');
  const nameFields = [
    { name: 'display_name_en', label: 'English', value: service.en, what: 'Name' },
    { name: 'display_name_tl', label: 'Tagalog', value: service.tl ?? '', what: 'Tagalog name', placeholder: '—' },
  ];

  return (
    <article data-panel="service">
      <PanelHead
        crumbs={crumbs}
        title={service.en}
        sub={sub || plural(0, 'card')}
        keyText={service.canonical}
        keyNote="A developer key — what a shop’s card (vendor_services.category) and every link point at. It never changes, even when the name does."
      />

      <PanelFold id="name" title="Name" summary={service.tl && service.tl !== service.en ? `${service.en} · ${service.tl}` : service.en}>
        <InPlaceFields kind="rename-service" hidden={{ canonical_service: service.canonical }} fields={nameFields} />
      </PanelFold>

      <PanelFold
        id="where"
        title="Where it sits"
        summary={`${category?.label ?? 'Unfiled'}${service.secondaryTiles.length ? ` · also ${alsoText}` : ''} · ${showsText === sameAs ? 'all events' : showsText}`}
      >
        <Row label={category ? 'Category' : 'File under'} tip={<InfoTip label="" ariaLabel="About the category" align="start">Suppliers pick this service inside this category. Moving it moves every card under it.</InfoTip>}>
          <SavePick
            label={category ? 'Category' : 'File under'}
            value={service.tileId ?? ''}
            buttonText={category?.label ?? '— choose a category —'}
            choices={cats}
            action={mapWriteForm.bind(null, 'service-category')}
            field="tile_id"
            hidden={{ canonical_service: service.canonical }}
            what="Category"
          />
        </Row>
        <Row label="Also listed under" tip={<InfoTip label="" ariaLabel="About also listed under" align="start">Other categories whose page also lists this service’s cards. The service still has one home.</InfoTip>}>
          <ListPick
            label="Also listed under"
            picked={service.secondaryTiles}
            choices={cats.filter((c) => c.key !== service.tileId)}
            action={mapWriteForm.bind(null, 'service-also')}
            field="secondary_tiles"
            hidden={{ canonical_service: service.canonical }}
            buttonText={alsoText}
            what="Also listed under"
          />
        </Row>
        <Row label="Shows for" tip={<InfoTip label="" ariaLabel="About shows for" align="start">Which event types see it. “Same as the category” follows the category.</InfoTip>}>
          <ListPick
            label="Shows for"
            picked={service.eventTypes ?? []}
            choices={data.eventLabels.map((e) => ({ key: e.key, label: e.label }))}
            action={mapWriteForm.bind(null, 'service-events')}
            field="event_types"
            hidden={{ canonical_service: service.canonical }}
            buttonText={showsText}
            what="Shows for"
          />
        </Row>
        {map && service.tileId && serviceOrder.length > 1 ? (
          <Row label="Order" tip={<InfoTip label="" ariaLabel="About the order" align="start">Among the services of this category on this page only — couples and shops still see services A–Z.</InfoTip>}>
            <OrderPick id={service.canonical} siblings={serviceOrder} save={mapReorder.bind(null, 'services', service.tileId)} />
          </Row>
        ) : null}
      </PanelFold>

      {map ? (
        <PanelFold id="cards" title="Service cards" summary={svcCards ? (svcCards.length ? `${formatCount(svcCards.length)}${heldN ? ` · ${formatCount(heldN)} held` : ''}` : 'None yet') : 'Couldn’t read'}>
          <Quiet>Each row is one card a shop published under this service. Cards are not edited here — press one for its facts.</Quiet>
          <ServiceCards serviceKey={service.canonical} data={map} state={state} />
        </PanelFold>
      ) : null}

      {map ? (
        <PanelFold id="parts" title="Inspiration parts" summary={map.partsRead ? formatCount(parts.length) : 'Couldn’t read'}>
          <Quiet>The parts a shop selling this service may add photos to. Set on the part (Services ▾) — press a part to open it.</Quiet>
          <ServiceParts serviceKey={service.canonical} data={map} state={state} />
        </PanelFold>
      ) : null}

      <PanelFold id="fields" title="What suppliers fill in" summary={plural(service.fields.filter((f) => !f.retired).length, 'field')}>
        <Quiet>The facts a shop fills in on its card under this service.</Quiet>
        <WhatSuppliersFillIn service={service} />
      </PanelFold>

      <PanelFold id="words" title="Search words" summary={`${formatCount(service.words.length)}${waiting ? ` · ${formatCount(waiting)} waiting` : ''}`}>
        <Quiet>What a couple might type to find this service. ⏳ = suggested by a shop, waiting for you.</Quiet>
        <ul className="flex flex-wrap gap-2" data-search-words="">
          {service.words.map((w) => (
            <li key={w.id} className="inline-flex min-h-10 items-center gap-1 rounded-full border border-ink/15 bg-raised pl-3 pr-1 text-[14px] text-ink">
              <span>
                {w.live ? '✓' : '⏳'} {w.phrase}
              </span>
              {w.live ? (
                <ChipPress label="×" name={`Remove ${w.phrase}`} kind="word-remove" hidden={{ id: String(w.id) }} said={`Removed — ${w.phrase}`} />
              ) : (
                <>
                  <ChipPress label="Approve" name={`Approve ${w.phrase}`} tone="ok" kind="word-approve" hidden={{ id: String(w.id) }} said={`Approved — ${w.phrase}`} />
                  <ChipPress label="Reject" name={`Reject ${w.phrase}`} tone="danger" kind="word-reject" hidden={{ id: String(w.id) }} said={`Rejected — ${w.phrase}`} />
                </>
              )}
            </li>
          ))}
        </ul>
        <DrawerAddRow text="Add a word" placeholder="A word couples type" door={{ form: 'word-add', hidden: { canonical_service: service.canonical }, field: 'phrase' }} what="Search word" />
      </PanelFold>

      <PanelFold id="marks" title="Marks" summary={onMarks.length ? onMarks.join(' · ') : 'None'}>
        {MARKS.map((m) => (
          <InPlaceSwitch
            key={m.flag}
            label={m.label}
            on={m.on(service)}
            door={{ form: 'service-flag', hidden: { canonical_service: service.canonical, flag: m.flag }, field: 'value' }}
          />
        ))}
      </PanelFold>

      <PanelFold id="religion" title="Religion" summary={religion ? `${religion.label} only` : 'Everyone'}>
        <Says>
          {religion ? (
            <>
              <b>{religion.label}</b> only
            </>
          ) : (
            'Everyone'
          )}
        </Says>
        {service.dietary ? <Says>Dietary: {service.dietary} — stays for everyone.</Says> : null}
        <Quiet>Which religion a service is only for is set on the religion (Religions list) — read-only here.</Quiet>
      </PanelFold>

      <PanelFold
        id="deadline"
        title="Deadline"
        summary={leafDeadlines[0] ? `Book by ${formatCount(leafDeadlines[0].offsetValue)} ${unitWord(leafDeadlines[0].offsetUnit, leafDeadlines[0].offsetValue)}` : sameAs}
      >
        {leafDeadlines.length === 0 ? (
          <Says>
            Book by: <b>{sameAs}</b>
          </Says>
        ) : (
          leafDeadlines.map((d) => <DeadlineInPlace key={d.deadlineId} label="Book by" deadlineId={d.deadlineId} value={d.offsetValue} unit={d.offsetUnit} />)
        )}
      </PanelFold>

      <PanelFold id="danger" title="Combine into another service…" summary="Can’t be undone" danger last>
        <Says>
          Every supplier under {service.en} moves to the service you pick. The old name keeps working on links already out there. <b>This cannot be undone.</b>
        </Says>
        <CombineService name={service.en} targets={siblings} combine={mergeCanonicalService.bind(null, service.canonical)} />
      </PanelFold>
    </article>
  );
}
