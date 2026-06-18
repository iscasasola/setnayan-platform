import { redirect } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import {
  ALLOWED_LINK_DOMAINS,
  type CoupleFacingMethod,
  type ModerationStatus,
  type PaymentMethodType,
  type VendorPaymentMethodRow,
} from '@/lib/vendor-payment-methods';
import {
  approvePaymentMethod,
  holdPaymentMethod,
  removePaymentMethod,
} from './actions';
import { DirectPayPreviewButton } from '@/app/dashboard/[eventId]/_components/vendor-direct-pay';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Payment options · Admin' };

/**
 * Admin · Vendor payment-options moderation surface.
 *
 * Vendors publish their OWN off-platform payment destinations (bank details,
 * an uploaded QR, or a payment link) so couples can pay them DIRECTLY. Setnayan
 * never holds the money (RA 11967 non-party-publisher posture). This surface is
 * a FRAUD SCREEN only — approving a link/QR does NOT make Setnayan the payment
 * processor; it just confirms the destination isn't an obvious scam before it
 * surfaces to couples.
 *
 * Two sections:
 *   • "Needs review" — rows where moderation_status IN ('pending_review','held').
 *     Per-row actions: Approve · Hold · Remove.
 *   • "Published links & QRs" — method_type IN ('link','qr') AND approved. Per-row
 *     actions: Hold · Remove (re-screen anything that already went live).
 *
 * The page is gated by the parent admin layout (notFound for non-admins); we
 * also re-assert requireAdmin() at the top defensively.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
}

type JoinedRow = VendorPaymentMethodRow & {
  vendor_profiles: { business_name: string | null } | null;
};

/** A row decorated with everything the card needs to render (incl. async QR URL). */
type CardRow = VendorPaymentMethodRow & {
  business_name: string;
  qr_display_url: string | null;
};

function isOnAllowlist(domain: string | null): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().replace(/^www\./, '');
  return ALLOWED_LINK_DOMAINS.some((a) => d === a || d.endsWith('.' + a));
}

export default async function AdminPaymentOptionsPage() {
  await requireAdmin();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('vendor_payment_methods')
    .select(
      'payment_method_id,vendor_profile_id,method_type,label,provider,account_name,account_number,qr_r2_key,decoded_destination,link_url,link_domain,note,is_primary,is_shown,moderation_status,moderation_note,created_at,updated_at,vendor_profiles(business_name)',
    )
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    logQueryError('AdminPaymentOptionsPage (vendor_payment_methods)', error);
  }

  const rows = (data ?? []) as unknown as JoinedRow[];

  // Resolve QR display URLs in parallel (each is a separate signing round trip).
  const decorated: CardRow[] = await Promise.all(
    rows.map(async (r) => ({
      ...r,
      business_name: r.vendor_profiles?.business_name || 'Unnamed vendor',
      qr_display_url:
        r.method_type === 'qr'
          ? await displayUrlForStoredAsset(r.qr_r2_key)
          : null,
    })),
  );

  const needsReview = decorated.filter(
    (r) =>
      r.moderation_status === 'pending_review' || r.moderation_status === 'held',
  );
  const published = decorated.filter(
    (r) =>
      (r.method_type === 'link' || r.method_type === 'qr') &&
      r.moderation_status === 'approved',
  );

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow text-[color:var(--m-orange-2)]">
          Vendor payment options · Moderation
        </p>
        <h1 className="m-display-tight text-2xl text-[color:var(--m-ink)] sm:text-3xl">
          Payment options
        </h1>
        <p className="max-w-2xl text-sm text-ink/65">
          Vendors publish their own payment destinations so couples pay them{' '}
          <span className="font-medium">directly</span>. Approving here does{' '}
          <span className="font-medium">not</span> make Setnayan the payment
          processor — it only screens links &amp; QR codes for fraud before they
          reach couples. Vendor&nbsp;↔&nbsp;couple money is always off-platform.
        </p>
      </header>

      {error ? (
        <FormFlash tone="error">
          Payment options couldn&apos;t load right now. We&apos;ve logged the
          issue — refresh in a moment or check Sentry for the full detail.
        </FormFlash>
      ) : null}

      {/* ── Section 1 · Needs review ─────────────────────────────────────── */}
      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          Needs review
          <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-900">
            {needsReview.length}
          </span>
        </h2>
        {needsReview.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-10 text-center text-sm text-ink/55">
            Nothing waiting for review — every payment method is approved or
            removed.
          </p>
        ) : (
          <ul className="grid gap-3">
            {needsReview.map((r) => (
              <li key={r.payment_method_id}>
                <PaymentMethodCard row={r} surface="needs_review" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Section 2 · Published links & QRs ────────────────────────────── */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
          Published links &amp; QRs
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
            {published.length}
          </span>
        </h2>
        <p className="mb-3 max-w-2xl text-xs text-ink/55">
          Approved links and QR codes already visible to couples. Re-screen any
          that look off with Hold or Remove.
        </p>
        {published.length === 0 ? (
          <p className="rounded-xl border border-dashed border-ink/20 bg-cream p-10 text-center text-sm text-ink/55">
            No approved links or QR codes yet.
          </p>
        ) : (
          <ul className="grid gap-3">
            {published.map((r) => (
              <li key={r.payment_method_id}>
                <PaymentMethodCard row={r} surface="published" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function PaymentMethodCard({
  row,
  surface,
}: {
  row: CardRow;
  surface: 'needs_review' | 'published';
}) {
  return (
    <article className="space-y-4 rounded-xl border border-ink/10 bg-cream p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-ink">
            {row.business_name}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
            <span>{row.label || '—'}</span>
            {row.provider ? (
              <>
                <span aria-hidden>·</span>
                <span>{row.provider}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>Added {new Date(row.created_at).toLocaleString('en-PH')}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.is_primary ? (
            <span className="rounded-full bg-ink/8 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
              Primary
            </span>
          ) : null}
          <MethodTypeBadge type={row.method_type} />
          <ModerationBadge status={row.moderation_status} />
        </div>
      </header>

      <MethodDetail row={row} />

      {row.note ? (
        <p className="rounded-md border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/75">
          <span className="font-medium">Vendor note:</span> {row.note}
        </p>
      ) : null}

      {row.moderation_note ? (
        <p className="rounded-md border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900">
          <span className="font-medium">Moderation note:</span>{' '}
          {row.moderation_note}
        </p>
      ) : null}

      <ActionRow row={row} surface={surface} />
    </article>
  );
}

function MethodDetail({ row }: { row: CardRow }) {
  if (row.method_type === 'link') {
    const allowlisted = isOnAllowlist(row.link_domain);
    return (
      <div className="space-y-1 text-xs text-ink/65">
        <div className="flex flex-wrap items-center gap-2">
          <AllowlistBadge allowlisted={allowlisted} />
          {row.link_domain ? (
            <span className="font-mono text-[11px] text-ink/55">
              {row.link_domain}
            </span>
          ) : null}
        </div>
        {row.link_url ? (
          <p className="break-all font-mono text-[11px] text-ink/75">
            {row.link_url}
          </p>
        ) : (
          <p className="text-ink/45">No link URL on file.</p>
        )}
      </div>
    );
  }

  if (row.method_type === 'qr') {
    return (
      <div className="flex flex-wrap items-start gap-4 text-xs text-ink/65">
        {row.qr_display_url ? (
          <span className="inline-flex h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-ink/10 bg-white">
            <Image
              src={row.qr_display_url}
              alt={`QR code for ${row.business_name}`}
              width={112}
              height={112}
              loading="lazy"
              className="h-full w-full object-contain"
            />
          </span>
        ) : (
          <span className="inline-flex h-28 w-28 shrink-0 items-center justify-center rounded-lg border border-dashed border-ink/20 bg-cream text-center text-[10px] text-ink/45">
            No QR image
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-ink/75">Decoded destination</p>
          {row.decoded_destination ? (
            <p className="break-all font-mono text-[11px] text-ink/75">
              {row.decoded_destination}
            </p>
          ) : (
            <p className="text-ink/45">
              QR not decoded — inspect the image manually.
            </p>
          )}
        </div>
      </div>
    );
  }

  // bank
  return (
    <div className="space-y-0.5 text-xs text-ink/65">
      {row.account_name ? (
        <p>
          <span className="text-ink/45">Account name:</span>{' '}
          <span className="text-ink/75">{row.account_name}</span>
        </p>
      ) : null}
      {row.account_number ? (
        <p>
          <span className="text-ink/45">Account number:</span>{' '}
          <span className="font-mono text-ink/75">{row.account_number}</span>
        </p>
      ) : null}
      {!row.account_name && !row.account_number ? (
        <p className="text-ink/45">No bank details on file.</p>
      ) : null}
    </div>
  );
}

function ActionRow({
  row,
  surface,
}: {
  row: CardRow;
  surface: 'needs_review' | 'published';
}) {
  // Faithful preview of what the couple sees for THIS destination — reuses the
  // exact couple-facing sheet (disclosure + method card). Read-only: admins
  // moderate, they don't pay vendors. Lets a moderator confirm a bank/QR/link
  // reads correctly before approving it.
  const previewMethod: CoupleFacingMethod = {
    payment_method_id: row.payment_method_id,
    method_type: row.method_type,
    label: row.label,
    provider: row.provider,
    account_name: row.account_name,
    account_number: row.account_number,
    decoded_destination: row.decoded_destination,
    link_url: row.link_url,
    link_domain: row.link_domain,
    note: row.note,
    is_primary: row.is_primary,
    qr_display_url: row.qr_display_url,
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-4">
      <DirectPayPreviewButton vendorName={row.business_name} methods={[previewMethod]} />
      {surface === 'needs_review' && row.moderation_status !== 'approved' ? (
        <form action={approvePaymentMethod}>
          <input
            type="hidden"
            name="payment_method_id"
            value={row.payment_method_id}
          />
          <SubmitButton className="button-primary h-9 px-3 text-xs" pendingLabel="Approving…">
            Approve
          </SubmitButton>
        </form>
      ) : null}

      {row.moderation_status !== 'held' ? (
        <form action={holdPaymentMethod}>
          <input
            type="hidden"
            name="payment_method_id"
            value={row.payment_method_id}
          />
          <SubmitButton
            className="inline-flex h-9 items-center rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-medium text-amber-900 hover:bg-amber-100"
            pendingLabel="Holding…"
          >
            Hold
          </SubmitButton>
        </form>
      ) : null}

      <form action={removePaymentMethod}>
        <input
          type="hidden"
          name="payment_method_id"
          value={row.payment_method_id}
        />
        <SubmitButton
          className="inline-flex h-9 items-center rounded-md border border-terracotta/30 bg-terracotta/5 px-3 text-xs font-medium text-terracotta-700 hover:bg-terracotta/15"
          pendingLabel="Removing…"
        >
          Remove
        </SubmitButton>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badges
// ---------------------------------------------------------------------------

function MethodTypeBadge({ type }: { type: PaymentMethodType }) {
  const label: Record<PaymentMethodType, string> = {
    bank: 'Bank',
    qr: 'QR',
    link: 'Link',
  };
  const tone: Record<PaymentMethodType, string> = {
    bank: 'bg-ink/8 text-ink/65',
    qr: 'bg-indigo-100 text-indigo-800',
    link: 'bg-sky-100 text-sky-800',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone[type]}`}
    >
      {label[type]}
    </span>
  );
}

function ModerationBadge({ status }: { status: ModerationStatus }) {
  const tone: Record<ModerationStatus, string> = {
    approved: 'bg-emerald-100 text-emerald-800',
    pending_review: 'bg-amber-100 text-amber-900',
    held: 'bg-amber-50 text-amber-900 border border-amber-300',
    removed: 'bg-terracotta/10 text-terracotta-700',
  };
  const label: Record<ModerationStatus, string> = {
    approved: 'Approved',
    pending_review: 'Pending',
    held: 'Held',
    removed: 'Removed',
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] ${tone[status]}`}
    >
      {label[status]}
    </span>
  );
}

function AllowlistBadge({ allowlisted }: { allowlisted: boolean }) {
  return allowlisted ? (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-emerald-800">
      on allowlist
    </span>
  ) : (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-amber-900">
      off allowlist
    </span>
  );
}
