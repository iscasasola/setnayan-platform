import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QrCode, Users, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import {
  buildVendorInviteUrl,
  vendorCoverageCategories,
} from '@/lib/vendor-couple-invite';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import { VENDOR_CATEGORY_LABEL, type VendorCategory } from '@/lib/vendors';
import { CopyButton } from '@/app/_components/copy-button';
import { SubmitButton } from '@/app/_components/submit-button';

export const metadata = { title: 'Shortlist QR · Vendor · Setnayan' };

/**
 * Shortlist QR generator (the "Shortlist QR" My Shop tile). The vendor picks an
 * EVENT (event-type) + a SERVICE (one of the categories they cover), and the QR
 * encodes those onto the stateless slug invite URL. A couple scans it, signs up
 * / picks-or-creates their event, and the vendor is imported onto THAT event's
 * shortlist under the chosen category — free, no token (it's an import).
 *
 * Server-rendered: the pickers are a GET form, so choosing an event/service
 * re-renders the page with the QR for the composed URL (no client JS).
 */
export default async function VendorShortlistQrPage({
  searchParams,
}: {
  searchParams: Promise<{ et?: string; cat?: string }>;
}) {
  const search = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  const isPublished = (profile as { is_published?: boolean }).is_published ?? false;
  const canShare = Boolean(slug && isPublished);

  // The vendor's own service categories (for the "pick a service" selector) +
  // the creatable event-type roster (for "pick an event").
  const { data: profRow } = await supabase
    .from('vendor_profiles')
    .select('services')
    .eq('vendor_profile_id', (profile as { vendor_profile_id: string }).vendor_profile_id)
    .maybeSingle();
  const coverage = vendorCoverageCategories(
    ((profRow?.services ?? []) as string[]) ?? [],
  );
  const eventTypes = await getCreatableEventTypes();

  // Validate the selections — ignore anything not in the vendor's coverage /
  // the creatable roster, so a hand-edited URL can't inject junk.
  const selectedCat =
    search.cat && coverage.includes(search.cat as VendorCategory)
      ? (search.cat as VendorCategory)
      : null;
  const selectedEt =
    search.et && eventTypes.some((t) => t.key === search.et) ? search.et : null;
  const selectedEtLabel = eventTypes.find((t) => t.key === selectedEt)?.label ?? null;

  const inviteUrl = slug
    ? buildVendorInviteUrl(slug, { eventType: selectedEt, category: selectedCat })
    : null;
  const qrSvg = inviteUrl ? await renderUrlQrSvg(inviteUrl, 220) : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard/shop"
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.18em] text-ink/50 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> My Shop
      </Link>

      <header className="mt-4 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <QrCode className="h-6 w-6 text-terracotta" strokeWidth={1.75} /> Shortlist QR
        </h1>
        <p className="text-sm text-ink/60">
          Pick the event and service, then show or send this QR. A couple scans
          it, sets up their free Setnayan plan, and you land on their shortlist —
          the whole event managed in one place. Free, for you and for them.
        </p>
      </header>

      {!canShare ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 bg-cream p-6 text-center">
          <Users className="mx-auto h-6 w-6 text-ink/40" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink/70">
            Publish your business profile first — your Shortlist QR is built from
            your public profile.
          </p>
          <Link
            href="/vendor-dashboard/profile"
            className="mt-4 inline-flex items-center justify-center rounded-xl bg-ink px-4 py-2 text-sm font-medium text-cream hover:bg-ink/90"
          >
            Go to my profile
          </Link>
        </div>
      ) : (
        <>
          {/* Pickers — GET form; changing a selection re-renders the QR. */}
          <form method="GET" className="mt-6 space-y-4 rounded-2xl border border-ink/10 bg-white/60 p-5">
            <div className="space-y-1.5">
              <label htmlFor="et" className="block text-sm font-medium text-ink/80">
                Pick an event
              </label>
              <select
                id="et"
                name="et"
                defaultValue={selectedEt ?? ''}
                className="input-field w-full"
              >
                <option value="">Any event type</option>
                {eventTypes.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink/50">
                We use this to set up the couple&apos;s event when they scan.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="cat" className="block text-sm font-medium text-ink/80">
                Pick a service
              </label>
              <select
                id="cat"
                name="cat"
                defaultValue={selectedCat ?? ''}
                className="input-field w-full"
              >
                <option value="">All my services</option>
                {coverage.map((c) => (
                  <option key={c} value={c}>
                    {VENDOR_CATEGORY_LABEL[c] ?? c}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink/50">
                The category you&apos;re shortlisted under on their plan.
              </p>
            </div>

            <SubmitButton
              pendingLabel="Updating…"
              className="w-full rounded-xl bg-ink px-4 py-2.5 text-sm font-medium text-cream hover:bg-ink/90"
            >
              Generate QR
            </SubmitButton>
          </form>

          <div className="mt-6 rounded-3xl border border-ink/10 bg-cream p-6">
            <div className="flex justify-center">
              <div
                className="rounded-2xl bg-white p-4 shadow-sm [&_svg]:h-[220px] [&_svg]:w-[220px]"
                dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }}
              />
            </div>

            {(selectedEtLabel || selectedCat) && (
              <p className="mt-4 text-center text-sm text-ink/70">
                Scans add you{selectedCat ? ` as ${VENDOR_CATEGORY_LABEL[selectedCat] ?? selectedCat}` : ''}
                {selectedEtLabel ? ` to the couple's ${selectedEtLabel.toLowerCase()} plan` : ' to the couple’s plan'}.
              </p>
            )}

            <div className="mt-5">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
                Your Shortlist link
              </p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-ink/15 bg-white px-3 py-2 text-xs text-ink/75">
                  {inviteUrl}
                </code>
                <CopyButton value={inviteUrl ?? ''} label="Copy link" />
              </div>
            </div>

            <ol className="mt-5 space-y-2 text-sm text-ink/65">
              <li>1. Couple scans the QR (or opens your link).</li>
              <li>2. They sign up free and pick or create their event.</li>
              <li>3. You appear on their shortlist — chat + reviews unlock from there.</li>
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
