import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  WEDDING_TRADITIONS_GUIDE,
  type TraditionGuideKey,
  type TraditionItemRow,
} from '@/lib/wedding-traditions';
import {
  upsertTraditionItem,
  deleteTraditionItem,
  seedTraditionsFromDefaults,
  resetTraditionsToDefaults,
} from './actions';

export const metadata = { title: 'Wedding traditions · Admin' };

const RELIGIONS: TraditionGuideKey[] = [
  'catholic', 'civil', 'inc', 'christian', 'muslim', 'cultural', 'chinese', 'mixed',
];
const DIMENSIONS = ['officiant', 'ceremonial', 'food', 'custom', 'paperwork'] as const;

/**
 * Admin editor for the per-religion wedding traditions content shown on the
 * couple's /paperwork "What to expect" guide. Edit / add / remove / reorder
 * items per religion; "Load starter content" copies the code defaults in for
 * any religion that has no rows yet. This is the validation path for the
 * starter content (owner: validate INC / Muslim / Cultural / Chinese with
 * clergy before relying on it).
 */
export default async function WeddingTraditionsPage() {
  const admin = createAdminClient();
  const { data } = await admin
    .from('wedding_tradition_items')
    .select('*')
    .order('ceremony_type', { ascending: true })
    .order('sort_order', { ascending: true });
  const rows = (data ?? []) as TraditionItemRow[];
  const byReligion: Record<string, TraditionItemRow[]> = {};
  for (const r of rows) (byReligion[r.ceremony_type] ??= []).push(r);

  const totalRows = rows.length;

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Wedding traditions
        </h1>
        <p className="max-w-prose text-sm text-ink/65">
          The per-religion &ldquo;What to expect&rdquo; guide on each couple&apos;s
          paperwork page. Edit / add / remove items here — they go live for couples
          with no deploy. ⚠️ This is starter content; validate each religion&apos;s
          specifics (especially INC, Muslim, Cultural, Chinese) before relying on
          it. When a religion has no rows, the couple sees the built-in code
          defaults until you load + edit them.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <form action={seedTraditionsFromDefaults}>
            <SubmitButton
              className="inline-flex items-center rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70"
              pendingLabel="Loading…"
            >
              {totalRows === 0 ? 'Load starter content' : 'Load starter content for empty religions'}
            </SubmitButton>
          </form>
          {totalRows > 0 ? (
            <form action={resetTraditionsToDefaults}>
              <SubmitButton
                className="inline-flex items-center rounded-md border border-ink/20 bg-cream px-4 py-2 text-sm font-medium text-ink hover:border-rose-300 hover:text-rose-700 disabled:opacity-70"
                pendingLabel="Resetting…"
              >
                Reset all to latest starter content
              </SubmitButton>
            </form>
          ) : null}
        </div>
        {totalRows > 0 ? (
          <p className="text-xs text-ink/45">
            &ldquo;Reset all&rdquo; replaces every religion&rsquo;s items with the current
            built-in defaults (the latest accuracy pass) &mdash; it discards any manual edits.
          </p>
        ) : null}
      </header>

      {RELIGIONS.map((religion) => (
        <ReligionSection
          key={religion}
          religion={religion}
          items={byReligion[religion] ?? []}
        />
      ))}
    </section>
  );
}

function ReligionSection({
  religion,
  items,
}: {
  religion: TraditionGuideKey;
  items: TraditionItemRow[];
}) {
  const label = WEDDING_TRADITIONS_GUIDE[religion]?.label ?? religion;
  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight text-ink">{label}</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          {items.length} {items.length === 1 ? 'item' : 'items'}
          {items.length === 0 ? ' · using code defaults' : ''}
        </span>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.item_id}>
            <ItemForm religion={religion} item={item} />
          </li>
        ))}
      </ul>

      {/* Add a new item to this religion. */}
      <details className="rounded-lg border border-dashed border-ink/15 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-terracotta-700">
          + Add item
        </summary>
        <div className="mt-2">
          <ItemForm religion={religion} item={null} />
        </div>
      </details>
    </section>
  );
}

function ItemForm({
  religion,
  item,
}: {
  religion: TraditionGuideKey;
  item: TraditionItemRow | null;
}) {
  return (
    <div className="rounded-lg border border-ink/10 bg-cream/60 p-3">
      <form action={upsertTraditionItem} className="grid gap-2 sm:grid-cols-12 sm:items-end">
        {item ? <input type="hidden" name="item_id" value={item.item_id} /> : null}
        <input type="hidden" name="ceremony_type" value={religion} />

        <label className="sm:col-span-2 text-[11px] text-ink/55">
          Dimension
          <select
            name="dimension"
            defaultValue={item?.dimension ?? 'ceremonial'}
            className="mt-0.5 block w-full rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-sm text-ink"
          >
            {DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label className="sm:col-span-3 text-[11px] text-ink/55">
          Label
          <input
            name="label"
            defaultValue={item?.label ?? ''}
            required
            maxLength={120}
            placeholder="e.g. Catholic priest"
            className="mt-0.5 block w-full rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="sm:col-span-5 text-[11px] text-ink/55">
          Note
          <input
            name="note"
            defaultValue={item?.note ?? ''}
            maxLength={400}
            placeholder="Short helper sentence"
            className="mt-0.5 block w-full rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="sm:col-span-1 text-[11px] text-ink/55">
          Order
          <input
            name="sort_order"
            type="number"
            defaultValue={item?.sort_order ?? 0}
            className="mt-0.5 block w-full rounded-md border border-ink/15 bg-cream px-2 py-1.5 text-sm text-ink"
          />
        </label>

        <label className="sm:col-span-1 flex items-center gap-1 text-[11px] text-ink/55">
          <input
            type="checkbox"
            name="is_active"
            value="true"
            defaultChecked={item?.is_active ?? true}
          />
          Active
        </label>

        <div className="sm:col-span-12 flex gap-2 pt-1">
          <SubmitButton
            className="inline-flex items-center rounded-md bg-ink/80 px-3 py-1.5 text-xs font-medium text-cream hover:bg-ink disabled:opacity-70"
            pendingLabel="Saving…"
          >
            {item ? 'Save' : 'Add item'}
          </SubmitButton>
        </div>
      </form>

      {item ? (
        <form action={deleteTraditionItem} className="mt-1">
          <input type="hidden" name="item_id" value={item.item_id} />
          <SubmitButton
            className="inline-flex items-center rounded-md border border-ink/15 bg-cream px-3 py-1 text-xs font-medium text-ink/60 hover:border-rose-300 hover:text-rose-700 disabled:opacity-70"
            pendingLabel="Removing…"
          >
            Remove
          </SubmitButton>
        </form>
      ) : null}
    </div>
  );
}
