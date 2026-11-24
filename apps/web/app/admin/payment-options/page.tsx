import Image from 'next/image';
import { vendorPaymentQrDisplayUrl } from '@/lib/vendor-payment-qr-url.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
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
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { ADMIN_FRAME } from '@/app/admin/_components/admin-frame';
import { actionButtonClass } from '@/components/action-button-class';
import {
  TEMPLATE_SUBLINE,
  TemplateEmpty,
  TemplateFail,
  TemplateSection,
} from '@/app/_components/template-rows';
import { SubmitButton } from '@/app/_components/submit-button';

import { requireAdmin } from '@/lib/admin/require-admin';
import { PageMasthead } from '@/app/_components/page-masthead';
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
      business_name: r.vendor_profiles?.business_name || 'Unnamed supplier',
      qr_display_url:
        r.method_type === 'qr'
          ? await vendorPaymentQrDisplayUrl(r.qr_r2_key, r.vendor_profile_id)
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
    <div className="mx-auto w-full max-w-[760px] px-4 pb-8 pt-2 sm:px-6">
      <PageMasthead
        title="Payment options"
      />

      {error ? (
        <TemplateFail retryHref="/admin/payments?view=payment-options" data="payment-options">
          Payment options couldn&apos;t load right now. We&apos;ve logged the
          issue — refresh in a moment.
        </TemplateFail>
      ) : null}

      {/* ── Section 1 · Needs review ─────────────────────────────────────── */}
      <TemplateSection
        label="Needs review"
        first
        data="payment-options-review"
        right={error ? '—' : String(needsReview.length)}
      >
        {error ? null : needsReview.length === 0 ? (
          <TemplateEmpty data="payment-options-review">
            Nothing waiting for review — every payment method is approved or
            removed.
          </TemplateEmpty>
        ) : (
          <ul className="grid gap-3">
            {needsReview.map((r) => (
              <li key={r.payment_method_id}>
                <PaymentMethodCard row={r} surface="needs_review" />
              </li>
            ))}
          </ul>
        )}
      </TemplateSection>

      {/* ── Section 2 · Published links & QRs ────────────────────────────── */}
      <TemplateSection
        label="Published links & QRs"
        data="payment-options-published"
        right={error ? '—' : String(published.length)}
        tip={
          <>
            Approved links and QR codes already visible to couples. Re-screen any
            that look off with Hold or Remove.
          </>
        }
      >
        {error ? null : published.length === 0 ? (
          <TemplateEmpty data="payment-options-published">
            No approved links or QR codes yet.
          </TemplateEmpty>
        ) : (
          <ul className="grid gap-3">
            {published.map((r) => (
              <li key={r.payment_method_id}>
                <PaymentMethodCard row={r} surface="published" />
              </li>
            ))}
          </ul>
        )}
      </TemplateSection>
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
    <article className={`space-y-4 p-4 ${ADMIN_FRAME}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-ink">
            {row.business_name}
          </p>
          <p className={`mt-0.5 flex flex-wrap items-center gap-2 ${TEMPLATE_SUBLINE}`}>
            <span>{row.label || '—'}</span>
            {row.provider ? (
              <>
                <span aria-hidden>·</span>
                <span>{row.provider}</span>
              </>
            ) : null}
            <span aria-hidden>·</span>
            <span>Added {new Date(row.created_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {row.is_primary ? (
            <Badge tone="quiet">Primary</Badge>
          ) : null}
          <MethodTypeBadge type={row.method_type} />
          <ModerationBadge status={row.moderation_status} />
        </div>
      </header>

      <MethodDetail row={row} />

      {row.note ? (
        <p className="rounded-md border border-ink/15 bg-ink/[0.03] px-3 py-2 text-xs text-ink/75">
          <span className="font-medium">Supplier note:</span> {row.note}
        </p>
      ) : null}

      {row.moderation_note ? (
        <p className="rounded-md border border-warn-300/60 bg-warn-50/60 px-3 py-2 text-xs text-warn-900">
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
            <span className="text-[12px] text-ink/55 tabular-nums">
              {row.link_domain}
            </span>
          ) : null}
        </div>
        {row.link_url ? (
          <p className="break-all text-[12px] text-ink/75 tabular-nums">
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
          <span className="inline-flex h-28 w-28 shrink-0 overflow-hidden rounded-lg bg-white">
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
          <span className="inline-flex h-28 w-28 shrink-0 items-center justify-center rounded-lg bg-ink/[0.04] text-center text-[12px] text-[color:var(--m-slate-2)]">
            No QR image
          </span>
        )}
        <div className="min-w-0 space-y-1">
          <p className="font-medium text-ink/75">Decoded destination</p>
          {row.decoded_destination ? (
            <p className="break-all text-[12px] text-ink/75 tabular-nums">
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
          <span className="text-ink/75 tabular-nums">{row.account_number}</span>
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
          <SubmitButton className={actionButtonClass('ok', { main: true })} pendingLabel="Approving…">
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
            className={actionButtonClass('warn')}
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
          className={actionButtonClass('danger')}
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
  return <Badge tone="quiet">{label[type]}</Badge>;
}

function ModerationBadge({ status }: { status: ModerationStatus }) {
  const tone: Record<ModerationStatus, BadgeTone> = {
    approved: 'ok',
    pending_review: 'wait',
    held: 'wait',
    removed: 'no',
  };
  const label: Record<ModerationStatus, string> = {
    approved: 'Approved',
    pending_review: 'Pending',
    held: 'Held',
    removed: 'Removed',
  };
  return <Badge tone={tone[status]}>{label[status]}</Badge>;
}

function AllowlistBadge({ allowlisted }: { allowlisted: boolean }) {
  return allowlisted ? (
    <Badge tone="ok">on allowlist</Badge>
  ) : (
    <Badge tone="wait">off allowlist</Badge>
  );
}
