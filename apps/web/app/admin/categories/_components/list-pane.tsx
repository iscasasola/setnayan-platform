/**
 * list-pane.tsx — the left half of "Categories & event types": one list per
 * choice of the title dropdown, filtered by the one search box.
 *
 * PURE RENDER. Every value arrives as a prop (built by `load.ts` + the rules
 * in `model.ts`), so the three lists are painted in a test with
 * renderToStaticMarkup — `the-three-lists-show.test.ts`. A row is a link to its
 * panel; nothing in a row edits anything.
 */
import { formatCount } from '@/lib/format-number';
import Link from 'next/link';
import { categoriesHref, type BackState } from './back';
import {
  EVENT_TYPE_STATUS_LABEL,
  LAUNCH_STATUS_LABEL,
  eventTypeStatusWord,
  matches,
  offeredCount,
  type Category,
  type CategoryListRow,
  type EventType,
  type Religion,
  type SearchWord,
  type Service,
  type SupplierRequest,
} from './model';

const ROW =
  'flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm text-ink transition-colors hover:bg-ink/5';
const ROW_ON = 'bg-ink text-cream hover:bg-ink';
const COUNT = 'shrink-0 text-xs';

function plural(n: number, one: string, many = `${one}s`): string {
  return `${formatCount(n)} ${n === 1 ? one : many}`;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-ink/10 px-1.5 py-0.5 text-[11px] font-medium">{children}</span>;
}

// ── Supplier categories ─────────────────────────────────────────────────────

export function CategoriesList({
  state,
  groups,
  unfiled,
  waiting,
  requests,
  eventLabel,
  failed,
}: {
  state: BackState;
  groups: Extract<CategoryListRow, { kind: 'group' }>[];
  /** event_type key → its name, for the "Birthday only" pill. */
  eventLabel: Record<string, string>;
  unfiled: Service[] | null;
  waiting: Array<{ service: Service; word: SearchWord }> | null;
  requests: SupplierRequest[] | null;
  failed: boolean;
}) {
  const href = (open: string) => categoriesHref({ ...state, open });
  if (failed) return <p role="alert" className="px-3 py-4 text-sm text-ink">Couldn’t load the categories — refresh to try again.</p>;

  if (state.show === 'unfiled' && unfiled) {
    return (
      <ul className="space-y-1" data-list="unfiled">
        {unfiled.length === 0 ? <li className="px-3 py-3 text-sm text-ink/70">Nothing unfiled — every service has a category.</li> : null}
        {unfiled.map((s) => (
          <li key={s.canonical}>
            <Link href={href(`s:${s.canonical}`)} className={`${ROW} ${state.open === `s:${s.canonical}` ? ROW_ON : ''}`}>
              <span className="min-w-0 truncate">{s.en}</span>
              <span className={COUNT}>File under ▸</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (state.show === 'words' && waiting) {
    return (
      <ul className="space-y-1" data-list="words">
        {waiting.length === 0 ? <li className="px-3 py-3 text-sm text-ink/70">No words waiting.</li> : null}
        {waiting.map(({ service, word }) => (
          <li key={word.id}>
            <Link href={href(`s:${service.canonical}`)} className={`${ROW} ${state.open === `s:${service.canonical}` ? ROW_ON : ''}`}>
              <span className="min-w-0 truncate">“{word.phrase}” → {service.en}</span>
              <span className={COUNT}>⏳</span>
            </Link>
          </li>
        ))}
      </ul>
    );
  }

  if (state.show === 'requests' && requests) {
    return (
      <ul className="space-y-1" data-list="requests">
        {requests.length === 0 ? <li className="px-3 py-3 text-sm text-ink/70">No supplier requests waiting.</li> : null}
        {requests.map((r) => (
          <li key={r.requestId}>
            <a href={`#req-${r.requestId}`} className={ROW}>
              <span className="min-w-0 truncate">“{r.proposedLabel}” · {r.supplierName}</span>
              <span className={COUNT}>{r.draft?.suggestedTileLabel ?? 'no place yet'}</span>
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (groups.length === 0) {
    return <p className="px-3 py-4 text-sm text-ink/70">Nothing matches “{state.q}”.</p>;
  }

  return (
    <ul className="space-y-3" data-list="categories">
      {groups.map((g) => (
        <li key={g.group.id}>
          <Link
            href={href(`g:${g.group.id}`)}
            className={`${ROW} font-semibold ${state.open === `g:${g.group.id}` ? ROW_ON : ''}`}
            data-row="group"
          >
            <span className="min-w-0 truncate">{g.group.label}</span>
            <span className={COUNT}>{plural(g.categoryCount, 'category', 'categories')}</span>
          </Link>
          <ul className="ml-3 border-l border-ink/10 pl-2">
            {g.categories.map((row) =>
              row.kind === 'category' ? (
                <CategoryRow key={row.category.id} row={row} state={state} eventLabel={eventLabel} />
              ) : null,
            )}
          </ul>
        </li>
      ))}
    </ul>
  );
}

function CategoryRow({
  row,
  state,
  eventLabel,
}: {
  row: Extract<CategoryListRow, { kind: 'category' }>;
  state: BackState;
  eventLabel: Record<string, string>;
}) {
  const c: Category = row.category;
  const open = `c:${c.id}`;
  return (
    <li>
      <Link
        href={categoriesHref({ ...state, open })}
        className={`${ROW} ${state.open === open ? ROW_ON : ''}`}
        data-row="category"
      >
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate">{c.label}</span>
          {c.hidden ? <Pill>Hidden</Pill> : null}
          {c.eventTypes && c.eventTypes.length > 0 ? (
            <Pill>
              {c.eventTypes.length === 1
                ? `${eventLabel[c.eventTypes[0]!] ?? c.eventTypes[0]} only`
                : `${formatCount(c.eventTypes.length)} event types`}
            </Pill>
          ) : null}
        </span>
        <span className={COUNT}>{plural(c.serviceCount, 'service')}</span>
      </Link>
      {row.services.length > 0 ? (
        <ul className="ml-3">
          {row.services.map((s) => (
            <li key={s.canonical}>
              <Link
                href={categoriesHref({ ...state, open: `s:${s.canonical}` })}
                className={`${ROW} ${state.open === `s:${s.canonical}` ? ROW_ON : ''}`}
                data-row="service"
              >
                <span className="truncate">{s.en}</span>
                {s.askedFor >= 2 ? <span className={COUNT}>asked for {s.askedFor}×</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {row.requests.length > 0 ? (
        <ul className="ml-3">
          {row.requests.map((r) => (
            <li key={r.requestId}>
              <Link
                href={`${categoriesHref({ ...state, show: 'requests', open: '' })}#req-${r.requestId}`}
                className={`${ROW} border border-dashed border-sky-300`}
                data-row="request"
              >
                <span className="truncate">“{r.proposedLabel}” from {r.supplierName}</span>
                <span className={COUNT}>request</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

// ── Event types ─────────────────────────────────────────────────────────────

export function EventTypesList({
  state,
  eventTypes,
  categories,
  failed,
}: {
  state: BackState;
  eventTypes: readonly EventType[];
  categories: readonly Category[] | null;
  failed: boolean;
}) {
  if (failed) return <p role="alert" className="px-3 py-4 text-sm text-ink">Couldn’t load the event types — refresh to try again.</p>;
  const rows = eventTypes.filter((e) => matches(state.q, e.label, e.key));
  if (rows.length === 0) return <p className="px-3 py-4 text-sm text-ink/70">Nothing matches “{state.q}”.</p>;
  return (
    <ul className="space-y-1" data-list="event-types">
      {rows.map((e) => {
        const word = eventTypeStatusWord(e);
        const counts = categories ? offeredCount(categories, e.key) : null;
        return (
          <li key={e.key}>
            <Link
              href={categoriesHref({ ...state, open: e.key })}
              className={`${ROW} ${state.open === e.key ? ROW_ON : ''}`}
              data-row="event-type"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden>{e.emoji}</span>
                <span className="truncate">{e.label}</span>
                {word !== 'picker' ? <Pill>{EVENT_TYPE_STATUS_LABEL[word]}</Pill> : null}
              </span>
              <span className={COUNT}>
                {counts === null
                  ? '—'
                  : counts.offered === counts.total
                    ? 'all categories'
                    : `${formatCount(counts.offered)} of ${formatCount(counts.total)}`}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

// ── Religions ───────────────────────────────────────────────────────────────

export function ReligionsList({
  state,
  religions,
  taggedCount,
  failed,
}: {
  state: BackState;
  religions: readonly Religion[];
  /** faith_key → how many services are only for it. Null when the read failed. */
  taggedCount: Record<string, number> | null;
  failed: boolean;
}) {
  if (failed) return <p role="alert" className="px-3 py-4 text-sm text-ink">Couldn’t load the religions — refresh to try again.</p>;
  const rows = religions.filter((r) => matches(state.q, r.label, r.key));
  return (
    <ul className="space-y-1" data-list="religions">
      {rows.map((r) => (
        <li key={r.key}>
          <Link
            href={categoriesHref({ ...state, open: r.key })}
            className={`${ROW} ${state.open === r.key ? ROW_ON : ''}`}
            data-row="religion"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate">{r.label}</span>
              {r.status !== 'active' ? <Pill>Deactivated</Pill> : null}
              {r.isCivil ? <Pill>civil</Pill> : null}
            </span>
            <span className={COUNT}>
              {taggedCount ? plural(taggedCount[r.key] ?? 0, 'service') : '—'}
              {r.launch ? ` · ${LAUNCH_STATUS_LABEL[r.launch.status]}` : ''}
            </span>
          </Link>
        </li>
      ))}
      {matches(state.q, 'mixed-faith', 'mixed') ? (
        <li>
          <Link
            href={categoriesHref({ ...state, open: 'mixed' })}
            className={`${ROW} ${state.open === 'mixed' ? ROW_ON : ''}`}
            data-row="religion"
          >
            <span className="truncate">Mixed-faith couples</span>
            <span className={COUNT}>What to expect</span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
}
