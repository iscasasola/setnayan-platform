import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { setTileEventTypeOffered, setFolderEventTypeOffered } from '../../actions';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Scope categories · Event Types · Admin' };
// Admin-client DB read → keep dynamic (same rationale as the roster page).
export const dynamic = 'force-dynamic';

/**
 * Setnayan HQ · Event Types · Scope categories — the "tailor a type's taxonomy"
 * convenience (owner 2026-06-16). Adding an event type auto-COVERS the taxonomy
 * (fail-open: a category with no event scope serves EVERY event) but does not
 * auto-TAILOR it — a brand-new type inherits the full (wedding-shaped) set. This
 * screen is the guided step: flip each category Offered / Hidden for ONE event
 * type, writing the same `service_categories.applicable_event_types` the
 * marketplace + Shortlist read. "Offered" left universal still serves all events;
 * "Hidden" scopes the category to the OTHER event types. Reached from the roster
 * row's "Scope categories →" link.
 */

type Cat = {
  id: string;
  parent_id: string | null;
  tier: number;
  label_en: string;
  sort_order: number;
  applicable_event_types: string[] | null;
};

type Params = Promise<{ eventType: string }>;
type SearchParams = Promise<{ ok?: string; error?: string }>;

const PILL_ON =
  'rounded-full bg-success-600 px-3 py-1 text-xs font-medium text-white hover:bg-success-700';
const PILL_OFF =
  'rounded-full border border-ink/20 bg-white px-3 py-1 text-xs font-medium text-ink/55 hover:border-ink/40';
const BULK_BTN =
  'rounded-md border border-ink/15 bg-white px-2.5 py-1 text-[11px] font-medium text-ink hover:border-terracotta/50 hover:text-terracotta';

export default async function ScopeCategoriesPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { eventType } = await params;
  const sp = await searchParams;
  const ok = sp.ok ? decodeURIComponent(sp.ok) : null;
  const error = sp.error ? decodeURIComponent(sp.error) : null;

  const admin = createAdminClient();
  const { data: vocab } = await admin
    .from('event_type_vocab')
    .select('event_type, label_en, emoji, status, enabled')
    .eq('event_type', eventType)
    .maybeSingle();
  if (!vocab) notFound();
  const row = vocab as { event_type: string; label_en: string; emoji: string; status: string; enabled: boolean };

  const { data: catData } = await admin
    .from('service_categories')
    .select('id, parent_id, tier, label_en, sort_order, applicable_event_types')
    .order('sort_order', { ascending: true });
  const cats = (catData ?? []) as Cat[];
  const folders = cats.filter((c) => c.tier === 1);
  const tilesByFolder = new Map<string, Cat[]>();
  for (const c of cats) {
    if (c.tier !== 2 || !c.parent_id) continue;
    const arr = tilesByFolder.get(c.parent_id);
    if (arr) arr.push(c);
    else tilesByFolder.set(c.parent_id, [c]);
  }

  // A category serves this event iff it's universal (NULL/empty) OR lists it.
  const offers = (aet: string[] | null) => !aet || aet.length === 0 || aet.includes(eventType);
  const allTiles = cats.filter((c) => c.tier === 2);
  const offeredCount = allTiles.filter((t) => offers(t.applicable_event_types)).length;
  const total = allTiles.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href="/admin/event-types" className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50 hover:text-terracotta">
        ← Event Types
      </Link>

      <header className="mb-6 mt-3 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan HQ · Scope categories</p>
        <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          <span aria-hidden className="text-3xl leading-none">{row.emoji}</span>
          {row.label_en}
        </h1>
        <p className="max-w-3xl text-base text-ink/65">
          Choose which categories a <strong>{row.label_en}</strong> offers. A category left{' '}
          <em>Offered</em> while still universal serves every event type; marking it{' '}
          <em>Hidden</em> scopes it to the other events, so it won’t appear for {row.label_en}.
          Changes are live immediately across the marketplace and the couple’s Shortlist.
        </p>
        <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
          Offers {offeredCount} of {total} categories
          {offeredCount === total ? ' · universal (not yet tailored)' : ' · tailored'}
        </p>
      </header>

      {ok ? (
        <div role="status" className="mb-6 rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-800">{ok}</div>
      ) : null}
      {error ? (
        <div role="alert" className="mb-6 rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">{error}</div>
      ) : null}

      <div className="space-y-4">
        {folders.map((folder) => {
          const tiles = (tilesByFolder.get(folder.id) ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
          if (tiles.length === 0) return null;
          const folderOffered = tiles.filter((t) => offers(t.applicable_event_types)).length;
          return (
            <section key={folder.id} className="rounded-2xl border border-ink/10 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-ink/8 pb-2">
                <h2 className="text-base font-semibold text-ink">
                  {folder.label_en}{' '}
                  <span className="font-mono text-[10px] font-normal uppercase tracking-[0.12em] text-ink/45">
                    {folderOffered}/{tiles.length} offered
                  </span>
                </h2>
                <div className="flex items-center gap-2">
                  <form action={setFolderEventTypeOffered}>
                    <input type="hidden" name="event_type" value={eventType} />
                    <input type="hidden" name="folder_id" value={folder.id} />
                    <input type="hidden" name="offered" value="1" />
                    <SubmitButton pendingLabel="Updating…" className={BULK_BTN}>Offer all</SubmitButton>
                  </form>
                  <form action={setFolderEventTypeOffered}>
                    <input type="hidden" name="event_type" value={eventType} />
                    <input type="hidden" name="folder_id" value={folder.id} />
                    <input type="hidden" name="offered" value="0" />
                    <SubmitButton pendingLabel="Updating…" className={BULK_BTN}>Hide all</SubmitButton>
                  </form>
                </div>
              </div>
              <ul className="divide-y divide-ink/8">
                {tiles.map((t) => {
                  const on = offers(t.applicable_event_types);
                  return (
                    <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                      <span className="min-w-0 truncate text-sm text-ink">{t.label_en}</span>
                      <form action={setTileEventTypeOffered}>
                        <input type="hidden" name="event_type" value={eventType} />
                        <input type="hidden" name="tile_id" value={t.id} />
                        <input type="hidden" name="offered" value={on ? '0' : '1'} />
                        <SubmitButton
                          pendingLabel="…"
                          className={on ? PILL_ON : PILL_OFF}
                          aria-label={`${on ? 'Hide' : 'Offer'} ${t.label_en} ${on ? 'from' : 'to'} ${row.label_en}`}
                        >
                          {on ? 'Offered' : 'Hidden'}
                        </SubmitButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
