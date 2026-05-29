import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AlertTriangle, ArrowLeft, ShieldCheck } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  FLAG_STATUS_LABEL,
  FLAG_STATUS_TONE,
  FLAG_TYPE_LABEL,
  RESOLUTION_ACTIONS,
  formatAutoResolveCountdown,
  type FlagStatus,
  type FlagType,
} from '@/lib/force-majeure';
import { resolveFlag, takeOwnership } from '../actions';

export const metadata = { title: 'Flag · Admin · Force Majeure' };

type FlagRow = {
  flag_id: string;
  public_id: string;
  event_id: string;
  event_vendor_id: string | null;
  couple_user_id: string | null;
  flag_type: FlagType;
  status: FlagStatus;
  description: string;
  evidence_urls: string[] | null;
  resolution_notes: string | null;
  admin_handler_user_id: string | null;
  auto_resolve_at: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

type EventLookup = {
  event_id: string;
  display_name: string;
  public_id: string;
  event_date: string | null;
};

type EventVendorLookup = {
  vendor_id: string;
  vendor_name: string;
  category: string;
};

type UserLookup = {
  user_id: string;
  display_name: string | null;
  email: string | null;
};

type Props = {
  params: Promise<{ flagId: string }>;
};

export default async function AdminForceMajeureDetailPage({ params }: Props) {
  const { flagId } = await params;
  const admin = createAdminClient();

  const { data: flag, error } = await admin
    .from('force_majeure_flags')
    .select(
      'flag_id, public_id, event_id, event_vendor_id, couple_user_id, flag_type, status, description, evidence_urls, resolution_notes, admin_handler_user_id, auto_resolve_at, resolved_at, created_at, updated_at',
    )
    .eq('flag_id', flagId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!flag) notFound();
  const row = flag as FlagRow;

  const [eventRes, vendorRes, coupleRes, handlerRes] = await Promise.all([
    admin
      .from('events')
      .select('event_id, display_name, public_id, event_date')
      .eq('event_id', row.event_id)
      .maybeSingle(),
    row.event_vendor_id
      ? admin
          .from('event_vendors')
          .select('vendor_id, vendor_name, category')
          .eq('vendor_id', row.event_vendor_id)
          .maybeSingle()
      : Promise.resolve({ data: null as EventVendorLookup | null, error: null }),
    row.couple_user_id
      ? admin
          .from('users')
          .select('user_id, display_name, email')
          .eq('user_id', row.couple_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null as UserLookup | null, error: null }),
    row.admin_handler_user_id
      ? admin
          .from('users')
          .select('user_id, display_name, email')
          .eq('user_id', row.admin_handler_user_id)
          .maybeSingle()
      : Promise.resolve({ data: null as UserLookup | null, error: null }),
  ]);

  const event = eventRes.data as EventLookup | null;
  const vendor = vendorRes.data as EventVendorLookup | null;
  const couple = coupleRes.data as UserLookup | null;
  const handler = handlerRes.data as UserLookup | null;

  const isResolved = Boolean(row.resolved_at);
  const countdown = isResolved
    ? `Resolved ${row.resolved_at?.slice(0, 10) ?? ''}`
    : formatAutoResolveCountdown(row.auto_resolve_at);

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/admin/force-majeure"
        className="mb-4 inline-flex items-center gap-1 text-sm text-terracotta hover:underline"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to queue
      </Link>

      <header className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <AlertTriangle aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">
            {row.public_id}
          </h1>
          <span
            className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${FLAG_STATUS_TONE[row.status]}`}
          >
            {FLAG_STATUS_LABEL[row.status]}
          </span>
        </div>
        <p className="text-sm text-ink/65">
          {FLAG_TYPE_LABEL[row.flag_type]} · filed {row.created_at.slice(0, 10)}{' '}
          {countdown ? `· ${countdown}` : ''}
        </p>
      </header>

      <dl className="mb-6 grid gap-4 rounded-xl border border-ink/10 bg-cream p-5 sm:grid-cols-2">
        <Field
          label="Event"
          value={
            event ? (
              <>
                <span className="font-medium text-ink">
                  {event.display_name}
                </span>
                <br />
                <span className="font-mono text-[11px] text-ink/55">
                  {event.public_id}
                  {event.event_date ? ` · ${event.event_date}` : ''}
                </span>
              </>
            ) : (
              '—'
            )
          }
        />
        <Field
          label="Scope"
          value={
            vendor ? (
              <>
                <span className="font-medium text-ink">{vendor.vendor_name}</span>
                <br />
                <span className="font-mono text-[11px] text-ink/55">
                  {vendor.category}
                </span>
              </>
            ) : (
              <span className="text-ink/65">Whole event</span>
            )
          }
        />
        <Field
          label="Filed by"
          value={
            couple ? (
              <a
                href={`mailto:${couple.email ?? ''}`}
                className="text-terracotta hover:underline"
              >
                {couple.display_name ?? couple.email ?? '—'}
              </a>
            ) : (
              '—'
            )
          }
        />
        <Field
          label="Handler"
          value={
            handler ? (
              <span className="inline-flex items-center gap-1 font-medium text-ink">
                <ShieldCheck
                  aria-hidden
                  className="h-3.5 w-3.5 text-terracotta"
                  strokeWidth={2}
                />
                {handler.display_name ?? handler.email ?? '—'}
              </span>
            ) : (
              <span className="text-ink/55">Unassigned</span>
            )
          }
        />
      </dl>

      <section className="mb-6 space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Description
        </h2>
        <p className="whitespace-pre-wrap rounded-md bg-ink/[0.03] p-4 text-sm text-ink/85">
          {row.description}
        </p>
      </section>

      <section className="mb-6 space-y-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Evidence ({row.evidence_urls?.length ?? 0})
        </h2>
        {row.evidence_urls && row.evidence_urls.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {row.evidence_urls.map((url, idx) => (
              <li key={url} className="overflow-hidden rounded-md border border-ink/10">
                <a href={url} target="_blank" rel="noreferrer" className="block">
                  <span className="relative block aspect-square">
                    <Image
                      src={url}
                      alt={`Evidence ${idx + 1}`}
                      fill
                      sizes="(max-width: 768px) 50vw, 200px"
                      className="object-cover"
                      unoptimized
                    />
                  </span>
                  <span className="block px-2 py-1 text-center font-mono text-[10px] uppercase tracking-[0.1em] text-ink/55">
                    file {idx + 1}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed border-ink/15 px-4 py-3 text-sm text-ink/55">
            No evidence attached.
          </p>
        )}
      </section>

      {row.resolution_notes ? (
        <section className="mb-6 space-y-2">
          <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
            Resolution notes
          </h2>
          <p className="whitespace-pre-wrap rounded-md bg-emerald-50/60 p-4 text-sm text-emerald-900">
            {row.resolution_notes}
          </p>
        </section>
      ) : null}

      <section className="space-y-4 rounded-xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Actions
        </h2>

        <form action={takeOwnership} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="flag_id" value={row.flag_id} />
          <SubmitButton
            className="inline-flex min-h-[44px] items-center gap-1 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/10 disabled:opacity-60"
            pendingLabel="…"
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
            Take ownership
          </SubmitButton>
          <span className="text-xs text-ink/55">
            Assigns this flag to you and moves it to Under review.
          </span>
        </form>

        <div className="space-y-3 border-t border-ink/10 pt-4">
          <p className="text-xs font-medium text-ink/75">Resolve as</p>
          <ul className="space-y-3">
            {RESOLUTION_ACTIONS.map((act) => (
              <li key={act}>
                <details className="rounded-md border border-ink/10">
                  <summary
                    className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm font-medium ${FLAG_STATUS_TONE[act]} rounded-md`}
                  >
                    <span>{FLAG_STATUS_LABEL[act]}</span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.15em]">
                      open
                    </span>
                  </summary>
                  <form
                    action={resolveFlag}
                    className="space-y-3 border-t border-ink/10 p-3"
                  >
                    <input type="hidden" name="flag_id" value={row.flag_id} />
                    <input type="hidden" name="action" value={act} />
                    <label className="block space-y-1">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
                        Resolution notes{' '}
                        {act === 'refund_issued' || act === 'partial_credit'
                          ? '(required — amount + channel)'
                          : '(optional)'}
                      </span>
                      <textarea
                        name="resolution_notes"
                        rows={3}
                        required={
                          act === 'refund_issued' || act === 'partial_credit'
                        }
                        placeholder={
                          act === 'refund_issued'
                            ? 'e.g. ₱8,000 refunded via GCash on 2026-05-15 — ref 0123…'
                            : 'Short note for the couple and the audit trail.'
                        }
                        className="input-field min-h-[72px] py-2 text-sm"
                      />
                    </label>
                    <SubmitButton
                      className="button-primary h-9 px-3 text-xs"
                      pendingLabel="Saving…"
                    >
                      Apply {FLAG_STATUS_LABEL[act]}
                    </SubmitButton>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
