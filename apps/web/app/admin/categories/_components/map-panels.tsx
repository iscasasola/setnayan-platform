/**
 * map-panels.tsx — the drawer panels the four-level map adds (🌳 ③b; corpus interactive-v4.html's drawer,
 * PLAN § 7.1 / § 7.4 / § 7.8): a PART, a SERVICE CARD, and the sections the shipped Category and Service
 * panels gain (parts read-only as chips, service cards). Sections always come in one order: Name & place →
 * links → service cards → where couples see it → hidden.
 *
 * 🔑 THE LINK BETWEEN A PART AND A SERVICE IS EDITED ON THE PART (Services ▾) AND SHOWN READ-ONLY ON THE
 * SERVICE AND THE CATEGORY — the page's standing one-place rule (PLAN § 2.4). A read-only chip opens the
 * part; it is the thing, not a "go edit elsewhere" link.
 *
 * Cards are never edited here. Until the card checks ship, a card's status is `is_active` + the shop's
 * visibility (PLAN § 7.8). Approve · Ask to fix · Reject are NOT drawn: they were to reuse Integrity watch ›
 * Cards' actions, and those do not exist on main yet — a second editor is exactly what the plan forbids.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
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
  peso,
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
import { KeyRow, ReadOnly, Section } from './ui';

function Head({ eyebrow, title, sub }: { eyebrow: ReactNode; title: string; sub: ReactNode }) {
  return (
    <header className="pb-3">
      <p className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-ink/70">{eyebrow}</p>
      <h2 className="text-xl font-semibold text-ink [overflow-wrap:anywhere]">{title}</h2>
      <p className="text-xs text-ink/70">{sub}</p>
    </header>
  );
}

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
            from {peso(cd.price)} · {cd.shopName}
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
        ? `all ${part.services.length} of ${home?.label ?? ''}`
        : `${plural(part.services.length, 'service')} · ${plural(cats.length, 'category', 'categories')}`;
  const role = (FIGURE_ROLES as readonly string[]).includes(part.key) ? (part.key as FigureRole) : null;
  return (
    <article data-panel="part">
      <Head
        eyebrow={
          <>
            <LevelIcon level="group" /> {group?.label ?? '—'} › <LevelIcon level="category" /> {home?.label ?? part.home} › <LevelIcon level="part" /> Part
          </>
        }
        title={part.label}
        sub={
          <>
            key {part.key} · {part.services.length === 0 ? <span className="text-terracotta-700">0 services</span> : plural(part.services.length, 'service')}
          </>
        }
      />
      <Section title="Name & place">
        <RenamePart slotKey={part.key} label={part.label} />
        <KeyRow label="Move to">
          <MovePartHomePick slotKey={part.key} home={part.home} choices={categoryChoicesFrom(data)} />
        </KeyRow>
        <ReadOnly>
          <InfoTip label="The home is one category" align="start">
            The heading this part sits under on the couple’s Inspiration board. Moving the home does not change its services — who may add photos is the services below.
          </InfoTip>
        </ReadOnly>
        <KeyRow label="Order">
          <OrderPick id={part.key} siblings={siblings} save={mapReorder.bind(null, 'parts', part.home)} />
        </KeyRow>
      </Section>
      <Section title="Services it links">
        <KeyRow label="Services">
          <ListPick
            label="Services"
            picked={part.services}
            choices={serviceChoices}
            action={mapWriteForm.bind(null, 'part-services')}
            field="services"
            hidden={{ slot_key: part.key }}
            buttonText={svcText}
          />
        </KeyRow>
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
      </Section>
      <Section title={`Cards that can add photos · ${data.cardsRead ? cards.length : '—'}`}>
        <CardList d={data} cards={cards} grouped state={state} />
      </Section>
      <Section title="Where couples see it">
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
      </Section>
      <Section title="Hidden from couples">
        <PartHiddenSwitch slotKey={part.key} hidden={part.hidden} />
        <p className="text-xs text-ink/70">Hiding keeps every saved photo.</p>
      </Section>
    </article>
  );
}

// ── the SERVICE CARD drawer ───────────────────────────────────────────────────

export function CardPanel({ card, data }: { card: MapCard; data: MapData }) {
  const sv = serviceByKey(data, card.service);
  const cat = sv?.tileId ? categoryById(data, sv.tileId) : null;
  const held = cardHeld(card);
  const reasons = [!card.active ? 'Turned off by the shop' : null, !card.shopPublic ? 'The shop is not public yet' : null].filter(Boolean) as string[];
  return (
    <article data-panel="card">
      <Head
        eyebrow={
          <>
            <LevelIcon level="category" /> {cat?.label ?? '—'} › <LevelIcon level="service" /> {sv?.label ?? card.service} › <LevelIcon level="card" /> Service card
          </>
        }
        title={card.title}
        sub={`from ${peso(card.price)} · ${card.shopName}`}
      />
      <Section title="Card">
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
              from {peso(card.price)} · under {sv?.label ?? card.service}
            </small>
          </span>
        </div>
        <KeyRow label="Shop">
          <Link href={`/admin/vendors/${card.shopId}`} className="inline-flex min-h-11 items-center rounded-full border border-ink/15 px-3 text-sm font-semibold text-ink hover:bg-ink/5">
            {card.shopName} ›
          </Link>
        </KeyRow>
        <KeyRow label="Status">
          <span className="flex items-center gap-1.5 text-sm text-ink">
            {held ? <Dot /> : null}
            {cardWord(card)}
          </span>
        </KeyRow>
      </Section>
      <Section title={`Check · ${held ? 'held' : 'live'}`}>
        {reasons.length ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink">
            {reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        ) : (
          <ReadOnly>Nothing holds it back.</ReadOnly>
        )}
        <p className="text-xs text-ink/70">
          <InfoTip label="Cards are not edited here" align="start">
            This page shows a card’s facts. Until the card checks ship, “held” means turned off or the shop is not public — the shop’s own admin page is where it changes.
          </InfoTip>
        </p>
      </Section>
      <Section title="Where couples see it">
        <ReadOnly>
          On the Suppliers page under <b>{cat?.label ?? '—'}</b> and on the shop’s own page{held ? ' — not while held' : ''}.
        </ReadOnly>
      </Section>
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
    <KeyRow label="Files shops as">
      <SavePick
        label="Files shops as"
        value={coarse ?? ''}
        buttonText={coarse ? VENDOR_CATEGORY_LABEL[coarse as VendorCategory] ?? coarse : 'Other (not filed)'}
        choices={choices}
        action={mapWriteForm.bind(null, 'coarse')}
        field="coarse_category"
        hidden={{ category_id: categoryId }}
      />
      {!coarse ? <Dot /> : null}
    </KeyRow>
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
