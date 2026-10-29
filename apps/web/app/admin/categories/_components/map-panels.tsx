/**
 * map-panels.tsx — the drawer panels the four-level map adds (🌳 ③b; corpus interactive-v4.html's drawer,
 * PLAN § 7.1 / § 7.4 / § 7.8): a PART, a SERVICE CARD, and the sections the shipped Category and Service
 * panels gain (parts read-only as chips, service cards). Drawn to the approved panels (owner 2026-10-29,
 * `carry-2026-10-29/admin-categories-proto`): `PanelHead` + `PanelFold`s in the prototype's order, saving in place.
 *
 * 🔑 THE LINK BETWEEN A PART AND A SERVICE IS EDITED ON THE PART (Services ▾) AND SHOWN READ-ONLY ON THE
 * SERVICE AND THE CATEGORY — the page's standing one-place rule (PLAN § 2.4). A read-only chip opens the
 * part; it is the thing, not a "go edit elsewhere" link.
 *
 * Cards are never edited here. Until the card checks ship, a card's status is `is_active` + the shop's
 * visibility (PLAN § 7.8). Approve · Ask to fix · Reject are NOT drawn: they were to reuse Integrity watch ›
 * Cards' actions, and those do not exist on main yet — a second editor is exactly what the plan forbids.
 */
import Link from 'next/link';
import { formatPhpRounded } from '@/lib/php';
import { formatCount } from '@/lib/format-number';
import { InfoTip } from '@/app/_components/info-tip';
import { ROLE_DESIGNS, FIGURE_ROLES, type FigureRole } from '@/lib/attire-designs';
import { VENDOR_CATEGORIES, VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { mapReorder, mapWriteForm } from '../four-level-actions';
import { categoriesHref, type BackState } from './back';
import {
  cardHeld,
  cardWord,
  cardsOf,
  categoryById,
  groupById,
  partCategoryIds,
  partsHomedIn,
  partsOfService,
  plural,
  serviceByKey,
  servicesOf,
  type MapCard,
  type MapData,
  type MapPart,
} from './four-level-model';
import { OrderPick } from './in-place';
import { Dot, LevelIcon } from './map-rows';
import { MovePartHomePick, PartHiddenSwitch, RenamePart } from './part-controls';
import { ListPick, SavePick, type Choice } from './pickers';
import { ReadOnly } from './ui';
import { Row } from './drawer-kit';
import { PanelFold, PanelHead } from './panel-kit';

const CHIP = 'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-ink/15 bg-raised px-3 text-sm text-ink hover:bg-ink/5';

function Chip({ href, level, label, small }: { href: string; level: 'service' | 'part' | 'category'; label: string; small?: string }) {
  return (
    <Link href={href} className={CHIP} scroll={false}>
      <LevelIcon level={level} accent />
      <span className="[overflow-wrap:anywhere]">{label}</span>
      {small ? <small className="text-xs text-ink/70">{small}</small> : null}
    </Link>
  );
}

/** Category choices grouped by group — for Move to ▾ and Services ▾. */
function categoryChoicesFrom(d: MapData): Choice[] {
  return d.groups.flatMap((g) => d.categories.filter((c) => c.groupId === g.id).map((c) => ({ key: c.id, label: c.label, group: g.label })));
}

function CardList({ d, cards, grouped, state }: { d: MapData; cards: MapCard[]; grouped: boolean; state: BackState }) {
  if (!d.cardsRead) return <p role="alert" className="text-sm text-ink">Couldn’t load the service cards — refresh to try again.</p>;
  if (cards.length === 0) return <ReadOnly>No service card yet.</ReadOnly>;
  const row = (cd: MapCard) => (
    <li key={cd.id}>
      <Link
        href={categoriesHref({ ...state, open: `k:${cd.id}` })}
        scroll={false}
        className="flex min-h-12 items-center gap-2.5 rounded-xl px-2 py-1.5 text-ink hover:bg-ink/5"
      >
        {cd.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the shop's own card photo, public bucket
          <img src={cd.photoUrl} alt="" aria-hidden className="h-9 w-9 shrink-0 rounded-lg object-cover" />
        ) : (
          <i aria-hidden className="block h-9 w-9 shrink-0 rounded-lg bg-ink/10" />
        )}
        <span className="min-w-0 flex-1">
          <b className="block text-sm font-medium [overflow-wrap:anywhere]">{cd.title}</b>
          <small className="block text-xs text-ink/70 [overflow-wrap:anywhere]">
            from {formatPhpRounded(cd.price)} · {cd.shopName}
          </small>
        </span>
        <span className={`flex shrink-0 items-center gap-1 text-xs ${cardWord(cd) === 'Live' ? 'text-success-700' : 'text-ink/70'}`}>
          {cardHeld(cd) ? <Dot /> : null}
          {cardWord(cd)}
        </span>
      </Link>
    </li>
  );
  if (!grouped) return <ul className="space-y-0.5">{cards.map(row)}</ul>;
  const by = new Map<string, MapCard[]>();
  for (const cd of cards) by.set(cd.service, [...(by.get(cd.service) ?? []), cd]);
  return (
    <div className="space-y-2">
      {[...by.entries()].map(([k, list]) => (
        <div key={k}>
          <p className="flex items-center gap-1.5 text-xs text-ink/70">
            <LevelIcon level="service" /> {serviceByKey(d, k)?.label ?? k}
          </p>
          <ul className="space-y-0.5">{list.map(row)}</ul>
        </div>
      ))}
    </div>
  );
}

// ── the PART drawer ───────────────────────────────────────────────────────────

export function PartPanel({ part, data, state }: { part: MapPart; data: MapData; state: BackState }) {
  const home = categoryById(data, part.home);
  const group = home ? groupById(data, home.groupId) : null;
  const siblings = partsHomedIn(data, part.home).map((p) => p.key);
  const cats = partCategoryIds(data, part);
  const cards = cardsOf(data, part.services);
  const serviceChoices: Choice[] = data.groups.flatMap((g) =>
    data.categories
      .filter((c) => c.groupId === g.id)
      .flatMap((c) => servicesOf(data, c.id).map((s) => ({ key: s.key, label: s.label, group: c.label }))),
  );
  const inHome = servicesOf(data, part.home);
  const allHome = inHome.length > 0 && inHome.every((s) => part.services.includes(s.key)) && cats.length === 1;
  const svcText =
    part.services.length === 0
      ? '— none yet —'
      : allHome
        ? `all ${formatCount(part.services.length)} of ${home?.label ?? ''}`
        : `${plural(part.services.length, 'service')} · ${plural(cats.length, 'category', 'categories')}`;
  const role = (FIGURE_ROLES as readonly string[]).includes(part.key) ? (part.key as FigureRole) : null;
  const idx = siblings.indexOf(part.key);
  const held = cards.filter(cardHeld).length;
  return (
    <article data-panel="part">
      <PanelHead
        crumbs={[
          ...(group ? [{ level: 'group' as const, label: group.label, href: categoriesHref({ ...state, open: `g:${group.id}` }) }] : []),
          ...(home ? [{ level: 'category' as const, label: home.label, href: categoriesHref({ ...state, open: `c:${home.id}` }) }] : []),
          { level: 'part' as const, label: 'Part' },
        ]}
        title={part.label}
        sub={[plural(part.services.length, 'service'), data.cardsRead ? plural(cards.length, 'card') : null].filter(Boolean).join(' · ')}
        gap={part.services.length === 0}
        keyText={part.key}
        keyNote="A developer key — every photo a shop adds carries it, so it never changes."
      />
      <PanelFold id="name" title="Name" summary={part.label}>
        <RenamePart slotKey={part.key} label={part.label} />
      </PanelFold>
      <PanelFold id="where" title="Where it sits" summary={`${home?.label ?? part.home}${idx >= 0 ? ` · ${idx + 1} of ${formatCount(siblings.length)}` : ''}`}>
        <Row
          label="Home"
          tip={
            <InfoTip label="" ariaLabel="About the home" align="start">
              The home is one category — the heading this part sits under on the couple’s Inspiration board. Moving the home does not change its services; who may add photos is the services below.
            </InfoTip>
          }
        >
          <MovePartHomePick slotKey={part.key} home={part.home} choices={categoryChoicesFrom(data)} />
        </Row>
        <Row label="Order" tip={<InfoTip label="" ariaLabel="About the order" align="start">Among the parts that share its home.</InfoTip>}>
          <OrderPick id={part.key} siblings={siblings} save={mapReorder.bind(null, 'parts', part.home)} />
        </Row>
      </PanelFold>
      <PanelFold id="services" title="Services it links" summary={svcText}>
        <Row
          label="Services"
          tip={
            <InfoTip label="" ariaLabel="About the services" align="start">
              Many. The services whose shops may add photos to this part — any service in any category. A new part starts with all of its home category’s services.
            </InfoTip>
          }
        >
          <ListPick
            label="Services"
            picked={part.services}
            choices={serviceChoices}
            action={mapWriteForm.bind(null, 'part-services')}
            field="services"
            hidden={{ slot_key: part.key }}
            buttonText={svcText}
            what="Services it links"
          />
        </Row>
        <div className="flex flex-wrap gap-2">
          {part.services.length === 0 ? (
            <ReadOnly>No shop yet — tick at least one service.</ReadOnly>
          ) : (
            part.services.map((k) => {
              const s = serviceByKey(data, k);
              return s ? <Chip key={k} href={categoriesHref({ ...state, open: `s:${k}` })} level="service" label={s.label} small={categoryById(data, s.tileId ?? '')?.label} /> : null;
            })
          )}
        </div>
      </PanelFold>
      <PanelFold id="cards" title="Cards that can add photos" summary={data.cardsRead ? (cards.length ? `${formatCount(cards.length)}${held ? ` · ${formatCount(held)} held` : ''}` : 'None yet') : 'Couldn’t read'}>
        <p className="text-[12.5px] text-ink/70">Derived, never stored: every card whose service is linked above. Its shop may add photos to this part the moment the card is live.</p>
        <CardList d={data} cards={cards} grouped state={state} />
      </PanelFold>
      <PanelFold id="vis" title="Visibility" summary={`Inspiration board › ${home?.label ?? part.home}${part.hidden ? ' · hidden' : ''}`} last>
        <ReadOnly>
          Under <b>{home?.label ?? part.home}</b> on the Inspiration board{part.hidden ? ' — hidden right now' : ''}.
        </ReadOnly>
        {role ? (
          <>
            <div className="flex flex-wrap gap-2">
              {ROLE_DESIGNS[role].map((r) => (
                <span key={r.style} className="inline-flex min-h-10 items-center rounded-full border border-dashed border-ink/15 px-3 text-sm text-ink/70">
                  {r.label}
                </span>
              ))}
            </div>
            <p className="text-xs text-ink/70">Styles couples pick — read-only here; they ship in lib/attire-designs.ts.</p>
          </>
        ) : null}
        <PartHiddenSwitch slotKey={part.key} hidden={part.hidden} />
      </PanelFold>
    </article>
  );
}

// ── the SERVICE CARD drawer ───────────────────────────────────────────────────

export function CardPanel({ card, data, state }: { card: MapCard; data: MapData; state?: BackState }) {
  const sv = serviceByKey(data, card.service);
  const cat = sv?.tileId ? categoryById(data, sv.tileId) : null;
  const held = cardHeld(card);
  const reasons = [!card.active ? 'Turned off by the shop' : null, !card.shopPublic ? 'The shop is not public yet' : null].filter(Boolean) as string[];
  const at = (open: string) => (state ? categoriesHref({ ...state, open }) : categoriesHref({ open }));
  return (
    <article data-panel="card">
      <PanelHead
        crumbs={[
          ...(cat ? [{ level: 'category' as const, label: cat.label, href: at(`c:${cat.id}`) }] : []),
          ...(sv ? [{ level: 'service' as const, label: sv.label, href: at(`s:${sv.key}`) }] : []),
          { level: 'card' as const, label: 'Service card' },
        ]}
        title={card.title}
        sub={`from ${formatPhpRounded(card.price)} · ${card.shopName}`}
      />
      <PanelFold id="card" title="Card" summary={cardWord(card)} open>
        <div className="flex items-center gap-2.5">
          {card.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- the shop's own card photo, public bucket
            <img src={card.photoUrl} alt="" aria-hidden className="h-16 w-16 shrink-0 rounded-lg object-cover" />
          ) : (
            <i aria-hidden className="block h-16 w-16 shrink-0 rounded-lg bg-ink/10" />
          )}
          <span className="min-w-0">
            <b className="block text-sm font-medium text-ink [overflow-wrap:anywhere]">{card.title}</b>
            <small className="block text-xs text-ink/70">
              from {formatPhpRounded(card.price)} · under {sv?.label ?? card.service}
            </small>
          </span>
        </div>
        <Row label="Shop">
          <Link href={`/admin/vendors/${card.shopId}`} className="sn-press inline-flex min-h-11 items-center rounded-full border border-ink/15 px-3 text-sm font-semibold text-ink hover:bg-ink/5 [overflow-wrap:anywhere]">
            {card.shopName} ›
          </Link>
        </Row>
        <Row label="Status">
          <span className={`flex items-center gap-1.5 text-sm ${held ? 'text-ink' : 'text-success-700'}`}>
            {held ? <Dot /> : null}
            {cardWord(card)}
          </span>
        </Row>
        <p className="text-[12.5px] text-ink/70">
          <InfoTip label="Cards are not edited here" align="start">
            This page shows a card’s facts. Until the card checks ship, “held” means turned off or the shop is not public — the shop’s own admin page is where it changes.
          </InfoTip>
        </p>
      </PanelFold>
      <PanelFold id="check" title="Check" summary={held ? `Held · ${plural(reasons.length, 'reason')}` : 'Nothing holds it back'}>
        {reasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <ReadOnly>Nothing holds it back.</ReadOnly>
        )}
      </PanelFold>
      <PanelFold id="vis" title="Where couples see it" summary={`Suppliers page › ${cat?.label ?? '—'}${held ? ' · not while held' : ''}`} last>
        <ReadOnly>
          On the Suppliers page under <b>{cat?.label ?? '—'}</b> and on the shop’s own page{held ? ' — not while held' : ''}.
        </ReadOnly>
      </PanelFold>
    </article>
  );
}

// ── what the shipped Category and Service panels gain ────────────────────────

/** Category › "Files shops as ▾" (③0-c's column; an explicit pick overrides what the group gave it). */
export function FilesShopsAs({ categoryId, coarse }: { categoryId: string; coarse: string | null }) {
  const choices: Choice[] = [
    { key: '', label: 'Other (not filed)' },
    ...[...VENDOR_CATEGORIES].map((k) => ({ key: k, label: VENDOR_CATEGORY_LABEL[k as VendorCategory] ?? k })),
  ];
  return (
    <Row
      label="Files shops as"
      tip={
        <InfoTip label="" ariaLabel="About files shops as" align="start">
          The coarse bucket this category’s shops are filed under in Accounts › Suppliers and in plan limits. A new category inherits its group’s; pick here to override. An amber dot = not filed.
        </InfoTip>
      }
    >
      <span className="inline-flex items-center gap-2">
        <SavePick
          label="Files shops as"
          value={coarse ?? ''}
          buttonText={coarse ? VENDOR_CATEGORY_LABEL[coarse as VendorCategory] ?? coarse : 'Other (not filed)'}
          choices={choices}
          action={mapWriteForm.bind(null, 'coarse')}
          field="coarse_category"
          hidden={{ category_id: categoryId }}
          what="Files shops as"
        />
        {!coarse ? <Dot /> : null}
      </span>
    </Row>
  );
}

/** Category › its parts (home ones; read-only chips — the link is edited on the part). */
export function CategoryParts({ categoryId, data, state }: { categoryId: string; data: MapData; state: BackState }) {
  if (!data.partsRead) return <p role="alert" className="text-sm text-ink">Couldn’t load the parts — refresh to try again.</p>;
  const heads = partsHomedIn(data, categoryId);
  const keys = new Set(servicesOf(data, categoryId).map((s) => s.key));
  const fed = data.parts.filter((p) => p.home !== categoryId && p.services.some((k) => keys.has(k)));
  return (
    <div className="space-y-2" data-category-parts="">
      <div className="flex flex-wrap gap-2">
        {heads.length === 0 ? <ReadOnly>No part is headed here yet.</ReadOnly> : null}
        {heads.map((p) => (
          <Chip key={p.key} href={categoriesHref({ ...state, open: `p:${p.key}` })} level="part" label={p.label} />
        ))}
      </div>
      {fed.length ? (
        <>
          <p className="text-xs text-ink/70">Also fed by this category’s services:</p>
          <div className="flex flex-wrap gap-2">
            {fed.map((p) => (
              <Chip key={p.key} href={categoriesHref({ ...state, open: `p:${p.key}` })} level="part" label={p.label} small={`home ${categoryById(data, p.home)?.label ?? p.home}`} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function CategoryCards({ categoryId, data, state }: { categoryId: string; data: MapData; state: BackState }) {
  return <CardList d={data} cards={cardsOf(data, servicesOf(data, categoryId).map((s) => s.key))} grouped state={state} />;
}

/** Service › "Inspiration parts (n)" — read-only chips, each opens the part. */
export function ServiceParts({ serviceKey, data, state }: { serviceKey: string; data: MapData; state: BackState }) {
  if (!data.partsRead) return <p role="alert" className="text-sm text-ink">Couldn’t load the parts — refresh to try again.</p>;
  const parts = partsOfService(data, serviceKey);
  return (
    <div className="flex flex-wrap gap-2" data-service-parts="">
      {parts.length === 0 ? <ReadOnly>No part links this service yet. Open a part and tick it under Services ▾, or use “＋ Add a part” in the map.</ReadOnly> : null}
      {parts.map((p) => (
        <Chip key={p.key} href={categoriesHref({ ...state, open: `p:${p.key}` })} level="part" label={p.label} small={`home ${categoryById(data, p.home)?.label ?? p.home}`} />
      ))}
    </div>
  );
}

export function ServiceCards({ serviceKey, data, state }: { serviceKey: string; data: MapData; state: BackState }) {
  return <CardList d={data} cards={cardsOf(data, [serviceKey])} grouped={false} state={state} />;
}
