/**
 * category-panels.tsx — the right-hand panel for the Supplier categories list:
 * a group, a category, or a service. Sections always come in the same order.
 *
 * Every link to another list is shown READ-ONLY here, in the words the other
 * list edits it with: which event types a category shows for is set on the
 * event type; which religion a service is only for is set on the religion.
 */
import { formatCount } from '@/lib/format-number';
import Link from 'next/link';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  clearLastMinuteStart,
  createCanonicalLeaf,
  createTaxonomyNode,
  deleteTileWithDestination,
  mergeCanonicalService,
  moveTileToFolder,
  remapCanonical,
  renameCanonicalService,
  renameTaxonomyNode,
  reorderCategories,
  setCategoryHidden,
  setLastMinuteStart,
  setServiceEventTypes,
  setServiceFlag,
  setServiceSecondaryTiles,
  updatePlanningDeadline,
} from '../actions';
import { addTradeAlias, approveTradeAlias, rejectTradeAlias, unteachTradeAlias } from '../search-word-actions';
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
import { FieldPick, ListPick, SavePick, type Choice } from './pickers';
import { BackFields, INPUT, KeyRow, ReadOnly, SAVE, Section, SwitchForm, backRecord } from './ui';
import { WhatCouplesChoose } from './what-couples-choose';
import { WhatSuppliersFillIn } from './what-suppliers-fill-in';

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

function Head({ eyebrow, title, sub }: { eyebrow: string; title: string; sub: string }) {
  return (
    <header className="pb-3">
      <p className="text-xs font-medium text-ink/70">{eyebrow}</p>
      <h2 className="text-xl font-semibold text-ink">{title}</h2>
      <p className="text-xs text-ink/70">{sub}</p>
    </header>
  );
}

/** Category choices for a PickMenu, grouped by their group's name. */
export function categoryChoices(groups: readonly Group[], categories: readonly Category[]): Choice[] {
  const name = new Map(groups.map((g) => [g.id, g.label]));
  const order = new Map(groups.map((g, i) => [g.id, i]));
  return [...categories]
    .sort((a, b) => (order.get(a.groupId) ?? 0) - (order.get(b.groupId) ?? 0) || a.sortOrder - b.sortOrder)
    .map((c) => ({ key: c.id, label: c.label, group: name.get(c.groupId) ?? c.groupId }));
}

const UNITS: Choice[] = [
  { key: 'day', label: 'days' },
  { key: 'week', label: 'weeks' },
  { key: 'month', label: 'months' },
];

function DeadlineRows({ plan, documents, state }: { plan: PlanDeadline[]; documents: Deadline[]; state: BackState }) {
  if (plan.length === 0 && documents.length === 0) {
    return <ReadOnly>No deadline — the couple’s reminders do not ask about this one.</ReadOnly>;
  }
  return (
    <div className="space-y-3">
      {plan.map((p) => (
        <div key={p.planGroupId} className="space-y-2" data-deadline={p.planGroupId}>
          {plan.length > 1 ? <p className="text-xs font-semibold text-ink">{p.label}</p> : null}
          {p.bookBy ? (
            <DeadlineForm row={p.bookBy} label="Book by" state={state} />
          ) : (
            <ReadOnly>Book by — not set (the code default applies)</ReadOnly>
          )}
          <form action={setLastMinuteStart} className="flex flex-wrap items-center gap-2">
            <BackFields state={state} />
            <input type="hidden" name="ref_key" value={p.planGroupId} />
            <input type="hidden" name="label" value={p.label} />
            <span className="w-40 shrink-0 text-xs font-medium text-ink/70">Last-minute from</span>
            <input
              type="number"
              name="months"
              min={0}
              max={60}
              defaultValue={p.lastMinute ?? ''}
              placeholder="off"
              aria-label={`Last-minute months before for ${p.label}`}
              className={`${INPUT} w-20`}
            />
            <span className="text-xs text-ink/70">months before</span>
            <SubmitButton className={SAVE} pendingLabel="Saving…" overlay={false}>
              Save
            </SubmitButton>
          </form>
          {p.lastMinute != null ? (
            <form action={clearLastMinuteStart}>
              <BackFields state={state} />
              <input type="hidden" name="ref_key" value={p.planGroupId} />
              <SubmitButton className="text-xs font-medium text-ink/70 underline" pendingLabel="Turning off…" overlay={false}>
                Turn last-minute off
              </SubmitButton>
            </form>
          ) : null}
        </div>
      ))}
      {documents.map((d) => (
        <DeadlineForm key={d.deadlineId} row={d} label={d.label ?? d.refKey} state={state} />
      ))}
    </div>
  );
}

function DeadlineForm({ row, label, state }: { row: Deadline; label: string; state: BackState }) {
  return (
    <form action={updatePlanningDeadline} className="flex flex-wrap items-center gap-2" data-deadline-row={row.refKey}>
      <BackFields state={state} />
      <input type="hidden" name="deadline_id" value={row.deadlineId} />
      <span className="w-40 shrink-0 text-xs font-medium text-ink/70">{label}</span>
      <input type="number" name="offset_value" min={0} defaultValue={row.offsetValue} aria-label={`${label} — how long before`} className={`${INPUT} w-20`} />
      <FieldPick label="Unit" name="offset_unit" defaultValue={row.offsetUnit} choices={UNITS} />
      <span className="text-xs text-ink/70">before</span>
      <SubmitButton className={SAVE} pendingLabel="Saving…" overlay={false}>
        Save
      </SubmitButton>
    </form>
  );
}

// ── Group ───────────────────────────────────────────────────────────────────

export function GroupPanel({ group, data, state }: { group: Group; data: CategoriesPanelData; state: BackState }) {
  const cats = data.categories.filter((c) => c.groupId === group.id);
  const scoped = cats.filter((c) => c.eventTypes && c.eventTypes.length > 0);
  const groupPlans = data.planGroups.filter((g) => !g.catalogTile && g.catalogFolder === group.id);
  const plan: PlanDeadline[] = groupPlans.map((g) => ({
    planGroupId: g.id,
    label: g.label,
    bookBy: data.deadlines.find((d) => d.kind === 'service' && d.scope === 'category' && d.refKey === g.id) ?? null,
    lastMinute: data.deadlines.find((d) => d.kind === 'last_minute_start' && d.refKey === g.id)?.offsetValue ?? null,
  }));
  return (
    <article data-panel="group">
      <Head eyebrow="Group" title={group.label} sub={`key ${group.id} · ${cats.length} categories`} />
      <Section title="Name">
        <form action={renameTaxonomyNode} className="space-y-2">
          <BackFields state={state} />
          <input type="hidden" name="id" value={group.id} />
          <KeyRow label="English">
            <input name="label_en" defaultValue={group.label} minLength={2} maxLength={80} className={`${INPUT} flex-1`} />
          </KeyRow>
          <KeyRow label="Short">
            <input name="label_short" defaultValue={group.short} maxLength={40} className={`${INPUT} flex-1`} />
          </KeyRow>
          <SubmitButton className={SAVE} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>
      <Section title={`Categories in this group (${cats.length})`}>
        <ul className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <li key={c.id}>
              <Link
                href={categoriesHref({ ...state, open: `c:${c.id}` })}
                className="inline-flex min-h-9 items-center rounded-full border border-ink/15 px-3 text-sm text-ink hover:bg-ink/5"
              >
                {c.label} · {formatCount(c.serviceCount)}
              </Link>
            </li>
          ))}
        </ul>
        <form action={createTaxonomyNode} className="flex flex-wrap items-center gap-2" data-add-category="">
          <BackFields state={state} />
          <input type="hidden" name="parent_id" value={group.id} />
          <input name="label_en" required minLength={2} maxLength={80} placeholder={`+ Add a category to ${group.label}`} className={`${INPUT} flex-1`} />
          <SubmitButton className={SAVE} pendingLabel="Adding…">
            Add
          </SubmitButton>
        </form>
      </Section>
      <Section title="Shows for events">
        <ReadOnly>
          {scoped.length === 0
            ? 'Every category here: All events'
            : `${cats.length - scoped.length} categories for all events · ${scoped.length} for some event types only`}
        </ReadOnly>
      </Section>
      {plan.length > 0 ? (
        <Section title="Deadline">
          <DeadlineRows plan={plan} documents={[]} state={state} />
        </Section>
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
}: {
  category: Category;
  cards: RefinementCard[];
  cardsFailed: boolean;
  data: CategoriesPanelData;
  state: BackState;
}) {
  const group = data.groups.find((g) => g.id === category.groupId);
  const services = data.services.filter((s) => s.tileId === category.id);
  const siblings = data.categories.filter((c) => c.groupId === category.groupId).map((c) => c.id);
  const { plan, documents } = deadlinesForCategory(category.id, data.planGroups, data.deadlines, data.paperworkTileId);
  const holds = category.serviceCount + category.refinementCount;
  const destinations = categoryChoices(data.groups, data.categories).filter((c) => c.key !== category.id);
  const religionLabel = new Map(data.religions.map((r) => [r.key, r.label]));
  return (
    <article data-panel="category">
      <Head eyebrow={group?.label ?? 'Category'} title={category.label} sub={`key ${category.slug} · ${services.length} services`} />

      <Section title="Name & place">
        <form action={renameTaxonomyNode} className="flex flex-wrap items-center gap-2">
          <BackFields state={state} />
          <input type="hidden" name="id" value={category.id} />
          <span className="w-40 shrink-0 text-xs font-medium text-ink/70">Name</span>
          <input name="label_en" defaultValue={category.label} minLength={2} maxLength={80} className={`${INPUT} flex-1`} />
          <SubmitButton className={SAVE} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
        <KeyRow label="Group">
          <MoveGroupPick
            groupId={category.groupId}
            groups={data.groups.map((g) => ({ key: g.id, label: g.label }))}
            move={moveTileToFolder.bind(null, category.id)}
          />
        </KeyRow>
        <KeyRow label="Order">
          <OrderPick id={category.id} siblings={siblings} save={reorderCategories.bind(null, category.groupId)} />
        </KeyRow>
      </Section>

      <Section title="Shows for events">
        <ReadOnly>{showsForLabel(category.eventTypes, data.eventLabels)}</ReadOnly>
      </Section>

      <Section title="Picture & icon">
        <PictureAndIcon
          id={category.id}
          label={category.label}
          iconName={category.iconName}
          defaultIcon={data.groupDefaultIcon[category.groupId] ?? null}
          photoRaw={category.photoRaw}
          photoUrl={category.photoUrl}
          iconNames={data.iconNames}
          back={backRecord(state)}
        />
      </Section>

      <Section title="What couples choose">
        {cardsFailed ? (
          <p role="alert" className="text-sm text-ink">Couldn’t load the cards — refresh to try again.</p>
        ) : (
          <WhatCouplesChoose tile={{ id: category.id, label: category.label }} refinements={cards} />
        )}
      </Section>

      <Section title="Deadline">
        <DeadlineRows plan={plan} documents={documents} state={state} />
      </Section>

      <Section title="Hidden from couples">
        <SwitchForm
          action={setCategoryHidden}
          on={category.hidden}
          label="Hidden from couples"
          fields={{ category_id: category.id }}
          valueField="hidden"
          state={state}
        />
      </Section>

      <Section title={`Services (${services.length})`}>
        <ul className="space-y-1">
          {services.map((s) => (
            <li key={s.canonical}>
              <Link
                href={categoriesHref({ ...state, open: `s:${s.canonical}` })}
                className="flex min-h-10 items-center justify-between gap-2 rounded-xl px-2 text-sm text-ink hover:bg-ink/5"
              >
                <span className="truncate">{s.en}</span>
                <span className="shrink-0 text-xs text-ink/70">
                  {s.faith ? religionLabel.get(s.faith) ?? s.faith : ''}
                  {s.askedFor >= 2 ? ` · asked for ${s.askedFor}×` : ''}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <form action={createCanonicalLeaf} className="flex flex-wrap items-center gap-2" data-add-service="">
          <BackFields state={state} />
          <input type="hidden" name="tile_id" value={category.id} />
          <input name="display_name_en" required minLength={2} maxLength={80} placeholder={`+ Add a service to ${category.label}`} className={`${INPUT} flex-1`} />
          <SubmitButton className={SAVE} pendingLabel="Adding…">
            Add
          </SubmitButton>
        </form>
      </Section>

      <Section title="Delete category…" closed>
        <ReadOnly>
          Holds {formatCount(category.serviceCount)} services and {formatCount(category.refinementCount)} “what couples choose” cards. Pick where
          they go — nothing is stranded.
        </ReadOnly>
        <DeleteCategory
          label={category.label}
          holds={holds}
          destinations={destinations}
          remove={deleteTileWithDestination.bind(null, category.id)}
          goToAfter={categoriesHref({ ...state, open: `g:${category.groupId}` })}
        />
      </Section>
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

export function ServicePanel({ service, data, state }: { service: Service; data: CategoriesPanelData; state: BackState }) {
  const category = data.categories.find((c) => c.id === service.tileId) ?? null;
  const group = category ? data.groups.find((g) => g.id === category.groupId) : null;
  const back = backRecord(state);
  const cats = categoryChoices(data.groups, data.categories);
  const religion = service.faith ? data.religions.find((r) => r.key === service.faith) : null;
  const siblings = data.services
    .filter((s) => s.tileId === service.tileId && s.canonical !== service.canonical)
    .map((s) => ({ key: s.canonical, label: s.en }));
  const leafDeadlines = data.deadlines.filter((d) => d.scope === 'leaf' && d.refKey === service.canonical);
  const eventName = new Map(data.eventLabels.map((e) => [e.key, e.label]));
  const sameAs = category ? `Same as ${category.label}` : 'Same as its category';

  return (
    <article data-panel="service">
      <Head
        eyebrow={group && category ? `${group.label} › ${category.label}` : 'Unfiled'}
        title={service.en}
        sub={`key ${service.canonical}${service.askedFor >= 2 ? ` · asked for ${service.askedFor}× — make it its own?` : ''}`}
      />

      <Section title="Name">
        <form action={renameCanonicalService} className="space-y-2">
          <BackFields state={state} />
          <input type="hidden" name="canonical_service" value={service.canonical} />
          <KeyRow label="English">
            <input name="display_name_en" defaultValue={service.en} required minLength={2} maxLength={80} className={`${INPUT} flex-1`} />
          </KeyRow>
          <KeyRow label="Tagalog">
            <input name="display_name_tl" defaultValue={service.tl ?? ''} maxLength={80} className={`${INPUT} flex-1`} />
          </KeyRow>
          <SubmitButton className={SAVE} pendingLabel="Saving…">
            Save
          </SubmitButton>
        </form>
      </Section>

      <Section title="Where it sits">
        <KeyRow label={category ? 'Category' : 'File under'}>
          <SavePick
            label={category ? 'Category' : 'File under'}
            value={service.tileId ?? ''}
            buttonText={category?.label ?? '— choose a category —'}
            choices={cats}
            action={remapCanonical}
            field="tile_id"
            hidden={{ ...back, canonical_service: service.canonical }}
          />
        </KeyRow>
        <KeyRow label="Also listed under">
          <ListPick
            label="Also listed under"
            picked={service.secondaryTiles}
            choices={cats.filter((c) => c.key !== service.tileId)}
            action={setServiceSecondaryTiles}
            field="secondary_tiles"
            hidden={{ ...back, canonical_service: service.canonical }}
            buttonText={
              service.secondaryTiles.length === 0
                ? 'None'
                : service.secondaryTiles.map((t) => data.categories.find((c) => c.id === t)?.label ?? t).join(' · ')
            }
          />
        </KeyRow>
        <KeyRow label="Shows for">
          <ListPick
            label="Shows for"
            picked={service.eventTypes ?? []}
            choices={data.eventLabels.map((e) => ({ key: e.key, label: e.label }))}
            action={setServiceEventTypes}
            field="event_types"
            hidden={{ ...back, canonical_service: service.canonical }}
            buttonText={
              !service.eventTypes || service.eventTypes.length === 0
                ? sameAs
                : `Only ${service.eventTypes.map((k) => eventName.get(k) ?? k).join(' · ')}`
            }
          />
        </KeyRow>
      </Section>

      <Section title="Religion">
        <ReadOnly>{religion ? `${religion.label} only` : 'Everyone'}</ReadOnly>
        {service.dietary ? <ReadOnly>Dietary: {service.dietary} — stays for everyone.</ReadOnly> : null}
      </Section>

      <Section title="What suppliers fill in">
        <WhatSuppliersFillIn service={service} />
      </Section>

      <Section title="Search words">
        <ul className="flex flex-wrap gap-2" data-search-words="">
          {service.words.map((w) => (
            <li key={w.id} className="inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 text-sm text-ink">
              <span>
                {w.live ? '✓' : '⏳'} {w.phrase}
              </span>
              {w.live ? (
                <form action={unteachTradeAlias}>
                  <BackFields state={state} />
                  <input type="hidden" name="id" value={w.id} />
                  <SubmitButton className="text-xs text-ink/70 underline" pendingLabel="…" overlay={false} aria-label={`Remove ${w.phrase}`}>
                    Remove
                  </SubmitButton>
                </form>
              ) : (
                <>
                  <form action={approveTradeAlias}>
                    <BackFields state={state} />
                    <input type="hidden" name="id" value={w.id} />
                    <SubmitButton className="text-xs font-semibold text-success-700" pendingLabel="…" overlay={false}>
                      Approve
                    </SubmitButton>
                  </form>
                  <form action={rejectTradeAlias}>
                    <BackFields state={state} />
                    <input type="hidden" name="id" value={w.id} />
                    <SubmitButton className="text-xs font-semibold text-danger-700" pendingLabel="…" overlay={false}>
                      Reject
                    </SubmitButton>
                  </form>
                </>
              )}
            </li>
          ))}
        </ul>
        <form action={addTradeAlias} className="flex flex-wrap items-center gap-2">
          <BackFields state={state} />
          <input type="hidden" name="canonical_service" value={service.canonical} />
          <input name="phrase" required minLength={2} maxLength={80} placeholder="+ Add a word" aria-label="Add a search word" className={`${INPUT} flex-1`} />
          <SubmitButton className={SAVE} pendingLabel="Adding…" overlay={false}>
            Add
          </SubmitButton>
        </form>
      </Section>

      <Section title="Marks">
        {MARKS.map((m) => (
          <SwitchForm
            key={m.flag}
            action={setServiceFlag}
            on={m.on(service)}
            label={m.label}
            fields={{ canonical_service: service.canonical, flag: m.flag }}
            valueField="value"
            state={state}
          />
        ))}
      </Section>

      <Section title="Deadline">
        {leafDeadlines.length === 0 ? (
          <ReadOnly>Book by: {sameAs}</ReadOnly>
        ) : (
          leafDeadlines.map((d) => <DeadlineForm key={d.deadlineId} row={d} label="Book by" state={state} />)
        )}
      </Section>

      <Section title="Combine into another service…" closed>
        <ReadOnly>
          Every supplier under {service.en} moves to the service you pick. The old name keeps working on links already
          out there. This cannot be undone.
        </ReadOnly>
        <CombineService name={service.en} targets={siblings} combine={mergeCanonicalService.bind(null, service.canonical)} />
      </Section>
    </article>
  );
}
