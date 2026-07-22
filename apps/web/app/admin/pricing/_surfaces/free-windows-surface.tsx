import { Gift, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  fetchV2CustomerCatalog,
  formatPeso,
  type V2CustomerSku,
} from '@/lib/v2-catalog';
import { isPromoFreeWindowsEnabled } from '@/lib/promo-free-windows';
import {
  createFreeWindow,
  setFreeWindowActive,
  deleteFreeWindow,
} from './free-windows-actions';

/**
 * Catalog Studio · Free windows tab — admin-scheduled "these services are free
 * this weekend" announcements (owner ask 2026-07-22). A live row makes its
 * covered SKUs resolve as owned for every couple during its date range (via the
 * entitlement-OR in lib/entitlements.ts) and shows the couple a banner. Silent
 * auto-free: no code, no checkout — the couple just finds the services included.
 *
 * Master switch is env PROMO_FREE_WINDOWS_ENABLED (surfaced below). While OFF,
 * windows can be authored but free nothing — the owner flips the flag to go live.
 */

type PromoRow = {
  promo_window_id: string;
  title: string;
  blurb: string | null;
  covered_service_keys: string[];
  audience_type: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  show_banner: boolean;
  created_at: string;
};

type Status = 'live' | 'scheduled' | 'ended' | 'inactive';

function statusOf(row: PromoRow, now: number): Status {
  if (!row.is_active) return 'inactive';
  const s = new Date(row.starts_at).getTime();
  const e = new Date(row.ends_at).getTime();
  if (now < s) return 'scheduled';
  if (now >= e) return 'ended';
  return 'live';
}

const STATUS_STYLE: Record<Status, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'bg-emerald-100 text-emerald-800' },
  scheduled: { label: 'Scheduled', cls: 'bg-sky-100 text-sky-800' },
  ended: { label: 'Ended', cls: 'bg-ink/10 text-ink/60' },
  inactive: { label: 'Inactive', cls: 'bg-amber-100 text-amber-800' },
};

const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Manila',
  }).format(new Date(iso));

const CREATE_ERROR_COPY: Record<string, string> = {
  title: 'Give the announcement a title.',
  skus: 'Pick at least one service to make free.',
  starts: 'Set a valid start date and time.',
  ends: 'Set a valid end date and time.',
  order: 'The end must be after the start.',
  db: 'Could not save the free window. Please try again.',
};

type Props = {
  searchParams: Promise<{
    created?: string;
    saved?: string;
    deleted?: string;
    createError?: string;
    error?: string;
  }>;
};

export async function FreeWindowsSurface({ searchParams }: Props) {
  await requireAdmin();
  const sp = await searchParams;
  const admin = createAdminClient();

  const [{ data, error }, catalog] = await Promise.all([
    admin
      .from('promo_free_windows')
      .select(
        'promo_window_id, title, blurb, covered_service_keys, audience_type, starts_at, ends_at, is_active, show_banner, created_at',
      )
      .order('created_at', { ascending: false }),
    fetchV2CustomerCatalog(),
  ]);
  if (error) logQueryError('FreeWindowsSurface', error);
  const rows = (data ?? []) as PromoRow[];
  const now = Date.now();

  // Human title lookup for the covered-SKU chips.
  const titleFor = new Map<string, string>(
    catalog.map((s: V2CustomerSku) => [s.service_code, s.title]),
  );

  const flagOn = isPromoFreeWindowsEnabled();

  return (
    <div className="mx-auto w-full max-w-4xl">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          <h1 className="text-2xl font-semibold tracking-tight">Free windows</h1>
        </div>
        <p className="text-sm text-ink/65">
          Schedule an announcement that makes chosen services{' '}
          <strong>free for every couple</strong> during a date range. While it&rsquo;s
          live the services show as included on their dashboard (no code, no
          checkout) and a banner tells them about it. When the window ends, the
          services go back to paid unless the couple already bought them.
        </p>
      </header>

      {/* Master-switch status */}
      {flagOn ? (
        <p className="mb-5 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            Master switch <code>PROMO_FREE_WINDOWS_ENABLED</code> is{' '}
            <strong>ON</strong> — any live window below is freeing its services
            right now.
          </span>
        </p>
      ) : (
        <p className="mb-5 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>
            Master switch <code>PROMO_FREE_WINDOWS_ENABLED</code> is{' '}
            <strong>OFF</strong> — you can author windows now, but nothing is
            freed and no banner shows until it&rsquo;s set to <code>true</code>.
          </span>
        </p>
      )}

      {/* Flash banners */}
      {sp.created && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Free window created.
        </p>
      )}
      {sp.saved && (
        <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Updated.
        </p>
      )}
      {sp.deleted && (
        <p className="mb-4 rounded-md border border-ink/15 bg-ink/[0.03] px-3 py-2 text-sm text-ink/70">
          Free window deleted.
        </p>
      )}
      {sp.createError && (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          {CREATE_ERROR_COPY[sp.createError] ?? 'Could not create the free window.'}
        </p>
      )}
      {sp.error && (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">
          Something went wrong. Please try again.
        </p>
      )}

      {/* Create form */}
      <form
        action={createFreeWindow}
        className="sn-tile mb-8 space-y-4 !p-5"
      >
        <h2 className="text-sm font-semibold text-ink">New free window</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink/80">Title</span>
            <input
              name="title"
              required
              maxLength={120}
              placeholder="Free Papic weekend"
              className="input-field w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink/80">
              Banner blurb <span className="text-ink/45">(optional)</span>
            </span>
            <input
              name="blurb"
              maxLength={240}
              placeholder="Every Papic camera is on us this weekend."
              className="input-field w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink/80">
              Starts <span className="text-ink/45">(PH time)</span>
            </span>
            <input
              type="datetime-local"
              name="starts_at"
              required
              className="input-field w-full"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-ink/80">
              Ends <span className="text-ink/45">(PH time)</span>
            </span>
            <input
              type="datetime-local"
              name="ends_at"
              required
              className="input-field w-full"
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink/80">
            Services to make free
          </legend>
          {catalog.length === 0 ? (
            <p className="text-xs text-ink/55">
              No live customer SKUs found in the catalog.
            </p>
          ) : (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {catalog.map((s: V2CustomerSku) => (
                <label
                  key={s.service_code}
                  className="flex items-center gap-2 rounded-md border border-ink/10 px-2.5 py-1.5 text-sm hover:bg-ink/[0.02]"
                >
                  <input
                    type="checkbox"
                    name="service_keys"
                    value={s.service_code}
                    className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
                  />
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {s.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-ink/50">
                    ₱{formatPeso(s.retail_price_php)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="flex items-center gap-2 text-sm text-ink/80">
          <input
            type="checkbox"
            name="show_banner"
            defaultChecked
            className="h-4 w-4 rounded border-ink/30 text-terracotta focus:ring-terracotta"
          />
          Show the announcement banner to couples while it&rsquo;s live
        </label>

        <div className="flex items-center gap-3 pt-1">
          <SubmitButton className="button-primary text-sm" pendingLabel="Creating…">
            Create free window
          </SubmitButton>
          <span className="text-xs text-ink/50">
            Audience: all couples (vendor + segment targeting coming later).
          </span>
        </div>
      </form>

      {/* Existing windows */}
      <h2 className="mb-3 text-sm font-semibold text-ink">Scheduled &amp; past windows</h2>
      {rows.length === 0 ? (
        <p className="sn-tile !p-5 text-sm text-ink/55">
          No free windows yet. Create one above.
        </p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const status = statusOf(row, now);
            const style = STATUS_STYLE[status];
            return (
              <li key={row.promo_window_id} className="sn-tile !p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.cls}`}
                      >
                        {style.label}
                      </span>
                      <p className="truncate font-medium text-ink">{row.title}</p>
                    </div>
                    {row.blurb ? (
                      <p className="mt-1 text-sm text-ink/70">{row.blurb}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-ink/55">
                      {fmtDateTime(row.starts_at)} → {fmtDateTime(row.ends_at)}
                      {' · '}all couples
                      {row.show_banner ? ' · banner on' : ' · banner off'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.covered_service_keys.map((code) => (
                        <span
                          key={code}
                          className="inline-flex rounded-md bg-ink/[0.04] px-2 py-0.5 text-[11px] text-ink/70"
                        >
                          {titleFor.get(code) ?? code}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <form action={setFreeWindowActive}>
                      <input
                        type="hidden"
                        name="promo_window_id"
                        value={row.promo_window_id}
                      />
                      <input
                        type="hidden"
                        name="is_active"
                        value={row.is_active ? 'false' : 'true'}
                      />
                      <SubmitButton
                        className="button-secondary text-xs"
                        pendingLabel="…"
                      >
                        {row.is_active ? 'Deactivate' : 'Activate'}
                      </SubmitButton>
                    </form>
                    <form action={deleteFreeWindow}>
                      <input
                        type="hidden"
                        name="promo_window_id"
                        value={row.promo_window_id}
                      />
                      <SubmitButton
                        className="text-xs text-rose-700 underline underline-offset-2 hover:text-rose-900"
                        pendingLabel="…"
                      >
                        Delete
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
