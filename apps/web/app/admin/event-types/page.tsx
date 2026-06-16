import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { ConfirmForm } from '@/app/_components/confirm-form';
import {
  createEventType,
  updateEventType,
  setEventTypeEnabled,
  retireEventType,
  unretireEventType,
} from './actions';

export const metadata = { title: 'Event Types · Admin' };
// Top-level admin-client DB read — keep this route dynamic (same rationale as
// /admin/taxonomy).
export const dynamic = 'force-dynamic';

/**
 * Setnayan HQ · Event Types — the admin CRUD over `event_type_vocab`
 * (2026-06-13 owner directive: event types are admin-driven, zero
 * engineering). Creating a row here + flipping "Show in picker" launches a
 * brand-new event type across the whole app: the couple create-event picker,
 * the add-event sheet in the top-left switcher, the vendor "event types you
 * serve" checkboxes, the marketplace event filter, and the /admin/taxonomy
 * per-tile event checkboxes all read this table live.
 */

type VocabRow = {
  event_type: string;
  label_en: string;
  emoji: string;
  enabled: boolean;
  status: string;
  sort_order: number;
  onboarding_href: string | null;
  hero_photo_url: string | null;
  description: string | null;
  created_at: string;
};

type SearchParams = Promise<{ ok?: string; error?: string }>;

const INPUT = 'w-full rounded-md border border-ink/15 bg-white px-2 py-1 text-sm text-ink';
const LABEL = 'block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55';
const BTN_SECONDARY =
  'rounded-md border border-ink/15 bg-white px-2.5 py-1 text-[11px] font-medium text-ink hover:border-terracotta/50 hover:text-terracotta';
const BTN_PRIMARY =
  'rounded-md bg-terracotta px-3 py-1.5 text-xs font-medium text-cream hover:bg-terracotta/90';

export default async function AdminEventTypesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const ok = params.ok ? decodeURIComponent(params.ok) : null;
  const error = params.error ? decodeURIComponent(params.error) : null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('event_type_vocab')
    .select(
      'event_type, label_en, emoji, enabled, status, sort_order, onboarding_href, hero_photo_url, description, created_at',
    )
    .order('sort_order', { ascending: true })
    .order('event_type', { ascending: true });
  const rows = (data ?? []) as VocabRow[];

  // Taxonomy coverage per type — how many categories (tier-2 tiles) each event
  // currently offers. A tile with NULL/empty applicable_event_types is universal
  // (serves every event); else only its listed types. Powers the "Scope
  // categories" CTA + a "not tailored" hint so a new type's inherited (untailored)
  // taxonomy is visible at a glance.
  const { data: tileData } = await admin
    .from('service_categories')
    .select('applicable_event_types')
    .eq('tier', 2);
  const tiles = (tileData ?? []) as { applicable_event_types: string[] | null }[];
  const totalTiles = tiles.length;
  const offeredByType = new Map<string, number>();
  for (const r of rows) offeredByType.set(r.event_type, 0);
  for (const t of tiles) {
    const aet = t.applicable_event_types;
    if (!aet || aet.length === 0) {
      for (const r of rows) offeredByType.set(r.event_type, (offeredByType.get(r.event_type) ?? 0) + 1);
    } else {
      for (const et of aet) {
        if (offeredByType.has(et)) offeredByType.set(et, (offeredByType.get(et) ?? 0) + 1);
      }
    }
  }

  const liveCount = rows.filter((r) => r.status === 'active' && r.enabled).length;
  const activeCount = rows.filter((r) => r.status === 'active').length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">Setnayan HQ · Platform</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Event Types</h1>
        <p className="max-w-3xl text-base text-ink/65">
          The roster of events Setnayan plans — create a new one here and the whole app picks it up
          on its own: the couple’s create-event picker, the add-event sheet in the top-left
          switcher, the vendor “event types you serve” checkboxes, the marketplace event filter,
          and the event checkboxes on the Taxonomy page.
        </p>
      </header>

      {ok ? (
        <div role="status" className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {ok}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      ) : null}

      {/* Plain-English lifecycle explainer — what the two switches mean. */}
      <section className="mb-8 grid gap-3 rounded-2xl border border-ink/10 bg-white/60 p-5 text-sm text-ink/70 sm:grid-cols-3">
        <div>
          <p className="font-medium text-ink">Show in picker</p>
          <p className="mt-1">
            The launch switch. On = couples can pick it when creating an event. Off = hidden from
            couples, but vendors can already tag themselves as serving it — so you can build the
            vendor pool before a public launch.
          </p>
        </div>
        <div>
          <p className="font-medium text-ink">Retired</p>
          <p className="mt-1">
            Off the books for NEW events — it leaves every picker, checkbox, and filter. Events
            already created with it keep working exactly as before. You can un-retire any time.
          </p>
        </div>
        <div>
          <p className="font-medium text-ink">Categories it offers</p>
          <p className="mt-1">
            A new type starts offering <em>every</em> category (the wedding-shaped set). Use{' '}
            <span className="font-medium text-ink">Scope categories</span> on the type to tailor
            which ones it offers — hide the ones that don’t fit. Until you do, it inherits them all.
          </p>
        </div>
      </section>

      {/* Add form */}
      <section id="add" className="mb-10 rounded-2xl border border-ink/10 bg-white p-5">
        <h2 className="text-lg font-semibold text-ink">Add an event type</h2>
        <p className="mt-1 text-sm text-ink/60">
          New types start hidden from couples (“Show in picker” off) so you can prepare photos and
          the vendor pool first. The key is permanent — it becomes the internal ID on every event.
        </p>
        <form action={createEventType} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1">
            <span className={LABEL}>Key (permanent)</span>
            <input
              name="event_type"
              required
              pattern="[a-z][a-z0-9_]{2,30}"
              title="3–31 chars: lowercase letters, numbers, underscores; starts with a letter"
              placeholder="house_blessing"
              className={`${INPUT} font-mono`}
            />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Display name</span>
            <input name="label_en" required maxLength={80} placeholder="House Blessing" className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Emoji</span>
            <input name="emoji" maxLength={16} placeholder="🏠" className={INPUT} />
          </label>
          <label className="space-y-1 lg:col-span-1">
            <span className={LABEL}>Tagline</span>
            <input name="description" maxLength={300} placeholder="A home, blessed." className={INPUT} />
          </label>
          <label className="space-y-1">
            <span className={LABEL}>Sort</span>
            <input name="sort_order" type="number" min={0} defaultValue={100} className={INPUT} />
          </label>
          <div className="sm:col-span-2 lg:col-span-5">
            <button type="submit" className={BTN_PRIMARY}>
              Create event type
            </button>
          </div>
        </form>
      </section>

      {/* Roster table */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-ink">Roster</h2>
          <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50">
            {liveCount} in picker · {activeCount} active · {rows.length} total
          </p>
        </div>

        <ul className="space-y-3">
          {rows.map((r) => {
            const retired = r.status === 'retired';
            const offered = offeredByType.get(r.event_type) ?? 0;
            const tailored = offered < totalTiles;
            return (
              <li
                key={r.event_type}
                id={`et-${r.event_type}`}
                className={`rounded-2xl border bg-white p-4 ${retired ? 'border-ink/10 opacity-70' : 'border-ink/10'}`}
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span aria-hidden className="text-2xl leading-none">
                    {r.emoji}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {r.label_en}{' '}
                      <code className="ml-1 font-mono text-[11px] font-normal text-ink/45">{r.event_type}</code>
                    </p>
                    <p className="truncate text-xs text-ink/55">{r.description ?? '—'}</p>
                  </div>

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                        retired
                          ? 'bg-ink/10 text-ink/60'
                          : r.enabled
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {retired ? 'Retired' : r.enabled ? 'In picker' : 'Hidden from picker'}
                    </span>
                    <span className="font-mono text-[10px] text-ink/40">sort {r.sort_order}</span>
                    <span className="font-mono text-[10px] text-ink/40">
                      since {new Date(r.created_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </span>

                    {!retired ? (
                      <form action={setEventTypeEnabled}>
                        <input type="hidden" name="event_type" value={r.event_type} />
                        <input type="hidden" name="enabled" value={r.enabled ? '0' : '1'} />
                        <button type="submit" className={BTN_SECONDARY}>
                          {r.enabled ? 'Hide from picker' : 'Show in picker'}
                        </button>
                      </form>
                    ) : null}

                    {retired ? (
                      <form action={unretireEventType}>
                        <input type="hidden" name="event_type" value={r.event_type} />
                        <button type="submit" className={BTN_SECONDARY}>
                          Un-retire
                        </button>
                      </form>
                    ) : r.event_type !== 'wedding' ? (
                      <ConfirmForm
                        action={retireEventType}
                        title={`Retire ${r.label_en}?`}
                        message={`${r.label_en} leaves every picker, vendor checkbox, and marketplace filter — nobody can choose it for NEW events. Every existing ${r.label_en} event keeps working exactly as it is. You can un-retire it any time.`}
                        confirmLabel="Retire it"
                      >
                        <input type="hidden" name="event_type" value={r.event_type} />
                        <button type="submit" className="rounded-md border border-rose-200 bg-white px-2.5 py-1 text-[11px] font-medium text-rose-700 hover:bg-rose-50">
                          Retire
                        </button>
                      </ConfirmForm>
                    ) : null}
                  </div>
                </div>

                {/* Taxonomy coverage + the guided "scope this type's
                    categories" jump — closes the add-a-type → tailor-its-
                    taxonomy loop so the two never drift (owner 2026-06-16). */}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ink/8 pt-2 text-[11px]">
                  <span className="font-mono uppercase tracking-[0.12em] text-ink/45">
                    Offers {offered} of {totalTiles} categories
                  </span>
                  {!retired && !tailored ? (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-amber-700">
                      Not tailored
                    </span>
                  ) : null}
                  {!retired ? (
                    <Link
                      href={`/admin/event-types/${r.event_type}/categories`}
                      className="font-medium text-terracotta hover:underline"
                    >
                      Scope categories →
                    </Link>
                  ) : null}
                </div>

                <details className="mt-3">
                  <summary className="cursor-pointer font-mono text-[11px] uppercase tracking-[0.15em] text-ink/50 hover:text-terracotta">
                    Edit details
                  </summary>
                  <form action={updateEventType} className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <input type="hidden" name="event_type" value={r.event_type} />
                    <label className="space-y-1">
                      <span className={LABEL}>Display name</span>
                      <input name="label_en" required maxLength={80} defaultValue={r.label_en} className={INPUT} />
                    </label>
                    <label className="space-y-1">
                      <span className={LABEL}>Emoji</span>
                      <input name="emoji" maxLength={16} defaultValue={r.emoji} className={INPUT} />
                    </label>
                    <label className="space-y-1">
                      <span className={LABEL}>Sort</span>
                      <input name="sort_order" type="number" min={0} defaultValue={r.sort_order} className={INPUT} />
                    </label>
                    <label className="space-y-1 lg:col-span-3">
                      <span className={LABEL}>Tagline (picker card one-liner)</span>
                      <input name="description" maxLength={300} defaultValue={r.description ?? ''} className={INPUT} />
                    </label>
                    <label className="space-y-1 lg:col-span-1">
                      <span className={LABEL}>Onboarding link (optional)</span>
                      <input
                        name="onboarding_href"
                        maxLength={300}
                        defaultValue={r.onboarding_href ?? ''}
                        placeholder="/onboarding/wedding"
                        className={`${INPUT} font-mono`}
                      />
                      <span className="block text-[11px] text-ink/45">
                        Set = tapping the picker card jumps straight into this flow. Blank = the
                        simple “name your event” form.
                      </span>
                    </label>
                    <label className="space-y-1 lg:col-span-2">
                      <span className={LABEL}>Hero photo URL (optional)</span>
                      <input
                        name="hero_photo_url"
                        maxLength={300}
                        defaultValue={r.hero_photo_url ?? ''}
                        placeholder="https://… or /event-types/wedding.webp"
                        className={`${INPUT} font-mono`}
                      />
                      <span className="block text-[11px] text-ink/45">
                        Blank = the built-in photo for this key, or a default photo until one is
                        set.
                      </span>
                    </label>
                    <div className="lg:col-span-3">
                      <button type="submit" className={BTN_PRIMARY}>
                        Save
                      </button>
                    </div>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-ink/15 p-8 text-center text-sm text-ink/55">
            No event types yet — the vocabulary table is unseeded. Run the pending migration first.
          </p>
        ) : null}
      </section>
    </div>
  );
}
