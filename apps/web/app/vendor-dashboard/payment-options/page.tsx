import { redirect } from 'next/navigation';
import {
  Landmark,
  QrCode,
  Link2,
  Star,
  Eye,
  EyeOff,
  Trash2,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  fetchOwnPaymentMethods,
  isVendorProActive,
  type ModerationStatus,
  type PaymentMethodType,
  type VendorPaymentMethodRow,
} from '@/lib/vendor-payment-methods';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SubmitButton } from '@/app/_components/submit-button';
import {
  deletePaymentMethod,
  setPrimaryPaymentMethod,
  togglePaymentMethodShown,
} from './actions';
import { AddPaymentMethod } from './_components/add-payment-method';
import { FormFlash } from '@/app/_components/forms/form-flash';

export const metadata = { title: 'How clients pay you · Vendor · Setnayan' };

type Props = {
  searchParams: Promise<{ msg?: string; error?: string }>;
};

/** Show only the last 4 digits of an account number; keep short ones whole. */
function maskAccountNumber(raw: string): string {
  const digits = raw.replace(/\s+/g, '');
  if (digits.length <= 4) return raw;
  return `•••• ${digits.slice(-4)}`;
}

const TYPE_META: Record<
  PaymentMethodType,
  { label: string; icon: typeof Landmark }
> = {
  bank: { label: 'Bank / e-wallet', icon: Landmark },
  qr: { label: 'QR code', icon: QrCode },
  link: { label: 'Payment link', icon: Link2 },
};

const MODERATION_BADGE: Partial<
  Record<ModerationStatus, { label: string; className: string }>
> = {
  pending_review: {
    label: 'In review',
    className: 'border-amber-300/70 bg-amber-50 text-amber-800',
  },
  held: {
    label: 'On hold',
    className: 'border-terracotta/30 bg-terracotta/10 text-terracotta-700',
  },
  removed: {
    label: 'Removed',
    className: 'border-ink/15 bg-ink/[0.04] text-ink/55',
  },
};

function cardTitle(m: VendorPaymentMethodRow): string {
  return (
    m.label ||
    m.provider ||
    m.link_domain ||
    TYPE_META[m.method_type].label
  );
}

export default async function VendorPaymentOptionsPage({ searchParams }: Props) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const methods = await fetchOwnPaymentMethods(supabase, profile.vendor_profile_id);
  const isPro = await isVendorProActive(supabase, user.id);

  // Pre-resolve QR thumbnails. displayUrlForStoredAsset presigns r2:// refs and
  // passes legacy http(s) values through unchanged.
  const qrThumbnails: Record<string, string> = {};
  await Promise.all(
    methods
      .filter((m) => m.method_type === 'qr' && m.qr_r2_key)
      .map(async (m) => {
        const url = await displayUrlForStoredAsset(m.qr_r2_key as string);
        if (url) qrThumbnails[m.payment_method_id] = url;
      }),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <p className="m-eyebrow" style={{ color: 'var(--m-orange-2)' }}>
          Vendor dashboard · Money
        </p>
        <h1 className="m-display text-3xl font-semibold tracking-tight sm:text-4xl">
          How clients pay you
        </h1>
        <p className="text-base" style={{ color: 'var(--m-slate)' }}>
          Add the ways couples can pay you directly. Setnayan takes 0% and never touches this money —
          these show on your client&rsquo;s payment screen the moment they book you.
        </p>
      </header>

      {search.error ? (
        <FormFlash tone="error">
          {search.error}
        </FormFlash>
      ) : null}
      {search.msg ? (
        <FormFlash tone="success">
          {search.msg}
        </FormFlash>
      ) : null}

      <section className="mb-6 space-y-3">
        {methods.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/20 bg-cream px-5 py-8 text-center">
            <p className="text-sm font-medium text-ink">No payment options yet.</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-ink/55">
              Add at least one so couples know how to pay you the moment they book. Bank, e-wallet,
              and QR are free on every plan.
            </p>
          </div>
        ) : (
          methods.map((m) => {
            const Icon = TYPE_META[m.method_type].icon;
            const moderation =
              m.moderation_status !== 'approved'
                ? MODERATION_BADGE[m.moderation_status]
                : null;
            const linkHiddenForTier = m.method_type === 'link' && !isPro;
            return (
              <article
                key={m.payment_method_id}
                className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta-700">
                    <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-ink">
                        {cardTitle(m)}
                      </h2>
                      {m.is_primary ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-terracotta/30 bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-terracotta-700">
                          <Star aria-hidden className="h-3 w-3" strokeWidth={2} />
                          Primary
                        </span>
                      ) : null}
                      {moderation ? (
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${moderation.className}`}
                        >
                          {moderation.label}
                        </span>
                      ) : null}
                      {!m.is_shown ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-ink/[0.04] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/55">
                          <EyeOff aria-hidden className="h-3 w-3" strokeWidth={2} />
                          Hidden
                        </span>
                      ) : null}
                    </div>

                    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                      {TYPE_META[m.method_type].label}
                    </p>

                    {/* Type-specific details. */}
                    {m.method_type === 'bank' ? (
                      <div className="text-sm text-ink/75">
                        {m.account_name ? <p>{m.account_name}</p> : null}
                        {m.account_number ? (
                          <p className="font-mono text-ink">
                            {maskAccountNumber(m.account_number)}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {m.method_type === 'qr' ? (
                      <div className="flex items-start gap-3 pt-1">
                        {qrThumbnails[m.payment_method_id] ? (
                          <span className="inline-flex h-16 w-16 shrink-0 overflow-hidden rounded-md border border-ink/10 bg-cream">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={qrThumbnails[m.payment_method_id]}
                              alt={`QR for ${cardTitle(m)}`}
                              className="h-full w-full object-contain"
                            />
                          </span>
                        ) : null}
                        {m.decoded_destination ? (
                          <p className="self-center text-sm text-ink/75">
                            {m.decoded_destination}
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {m.method_type === 'link' ? (
                      <p className="break-all text-sm text-ink/75">
                        <a
                          href={m.link_url ?? undefined}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-terracotta-700 underline-offset-2 hover:underline"
                        >
                          {m.link_url}
                        </a>
                      </p>
                    ) : null}

                    {m.note ? (
                      <p className="text-xs italic text-ink/55">&ldquo;{m.note}&rdquo;</p>
                    ) : null}

                    {linkHiddenForTier ? (
                      <p className="inline-flex items-center gap-1 text-xs text-ink/55">
                        <Info aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                        Hidden from clients — payment links are Pro &amp; Enterprise only.
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Per-card actions. */}
                <div className="flex flex-wrap items-center gap-2 border-t border-ink/10 pt-3">
                  {!m.is_primary ? (
                    <form action={setPrimaryPaymentMethod}>
                      <input type="hidden" name="payment_method_id" value={m.payment_method_id} />
                      <SubmitButton
                        pendingLabel="Saving…"
                        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-ink/30 hover:text-ink"
                      >
                        <Star aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        Make primary
                      </SubmitButton>
                    </form>
                  ) : null}

                  <form action={togglePaymentMethodShown}>
                    <input type="hidden" name="payment_method_id" value={m.payment_method_id} />
                    {/* CURRENT value — the action toggles to the opposite. */}
                    <input type="hidden" name="is_shown" value={m.is_shown ? 'true' : 'false'} />
                    <SubmitButton
                      pendingLabel="Saving…"
                      className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/75 transition-colors hover:border-ink/30 hover:text-ink"
                    >
                      {m.is_shown ? (
                        <>
                          <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Hide from clients
                        </>
                      ) : (
                        <>
                          <Eye aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                          Show to clients
                        </>
                      )}
                    </SubmitButton>
                  </form>

                  <form
                    action={deletePaymentMethod}
                    className="ml-auto"
                  >
                    <input type="hidden" name="payment_method_id" value={m.payment_method_id} />
                    <SubmitButton
                      pendingLabel="Removing…"
                      // confirm() runs before the form submits; returning false
                      // from a formAction isn't possible, so guard the click.
                      onClick={(e) => {
                        if (!confirm('Remove this payment option? Clients will no longer see it.')) {
                          e.preventDefault();
                        }
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-transparent px-3 py-1.5 text-xs font-medium text-ink/55 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                      Delete
                    </SubmitButton>
                  </form>
                </div>
              </article>
            );
          })
        )}
      </section>

      <AddPaymentMethod vendorProfileId={profile.vendor_profile_id} isPro={isPro} />

      <p className="mt-8 flex items-start gap-2 rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3 text-xs text-ink/55">
        <ShieldAlert aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} />
        <span>
          Clients pay you directly — Setnayan never controls these transactions. Always confirm
          you&rsquo;ve received payment before delivering, and keep your own records.
        </span>
      </p>
    </div>
  );
}
