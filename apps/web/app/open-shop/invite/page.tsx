import { redirect } from 'next/navigation';
import { Check, Clock } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { resolveOwnedActiveShop } from '@/lib/active-shop';
import { renderUrlQrSvg } from '@/lib/qr';
import { siteOrigin } from '@/lib/site-origin';
import { supplierInvitePath, INVITE_SHARE_NOTE } from '@/lib/supplier-invite';
import { shopConsolePath } from '@/lib/shop-console-path';
import { INVITE_SHOPS_HEAD, INVITE_SHOPS_LINE, INVITE_SHOPS_PATH, WELCOME_OPENED_PATH } from '@/lib/supplier-onboarding';
import { QrCard } from '@/app/_components/qr-card';
import { ActionButton } from '@/components/action-button';
import { FirstRunBrand } from '@/app/_components/first-run-brand';
import { OpenShopHeadMark } from '../_components/open-shop-layer';
import '@/app/vendor-dashboard/_components/supplier-look.css';

/**
 * 🚪 `/open-shop/invite` — "INVITE SHOPS YOU TRUST", Door C's screen after the shop opens (owner 2026-11-19,
 * "COORDINATOR ONBOARDING (Door C) APPROVED", pick C-6): the coordinator's OWN `/i/<slug>` invite QR — the shipped
 * code Shop › Trusted partners shows (`supplierInvitePath`, `QrCard` with Share) — and the owner's line, verbatim:
 * "Only invite those you trust." Then Done, on to where the first card's way lands (`?next=`, Today's welcome by
 * default — read through `shopConsolePath`, so it can only ever be a page of the Shop console).
 * A shop that scans it gets the blue invite door (`/i/<slug>`), then the self-serve door.
 * 🔒 lib/supplier-onboarding.test.ts
 */
export const metadata = { title: 'Invite shops you trust' };

export default async function InviteShopsYouTrustPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const done = next ? shopConsolePath(next) : WELCOME_OPENED_PATH;
  const user = await getCurrentUser();
  // ship review 21 Nov: keep the first card's landing (`?next=`) through the sign-in.
  if (!user) redirect(`/login?next=${encodeURIComponent(next ? `${INVITE_SHOPS_PATH}?next=${encodeURIComponent(next)}` : INVITE_SHOPS_PATH)}&as=vendor`);

  const supabase = await createClient();
  const shop = await resolveOwnedActiveShop(supabase, user.id);
  if (!shop.ok) redirect('/open-shop?as=coordinator');
  // The shop's own definer view (never the table — see app/open-shop/page.tsx). A refused read is not "no shop".
  const { data, error } = await supabase
    .from('vendor_profiles_self')
    .select('business_name, business_slug')
    .eq('vendor_profile_id', shop.vendorProfileId)
    .maybeSingle();
  if (error) throw new Error(`open-shop/invite: could not read your shop (${error.message})`);
  const row = data as { business_name: string | null; business_slug: string | null } | null;
  if (!row?.business_name?.trim()) redirect('/open-shop?as=coordinator');

  // A held name has no address yet — no link to share. Say so rather than draw a code to nowhere.
  const url = row.business_slug ? `${siteOrigin()}${supplierInvitePath(row.business_slug)}` : null;
  const svg = url ? await renderUrlQrSvg(url).catch(() => null) : null;
  const [title, line] = INVITE_SHOPS_HEAD;
  const name = row.business_name.trim();

  return (
    // ⤴ The closing step of the one open-shop layer (final check B3): its title and line ride in the head; Later and
    // Done sit in the bar at its foot and both land where the first card's way lands (as does ✕ — the shop is open).
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-clip overscroll-contain" data-supplier-look="" data-onboarding-invite="">
      <OpenShopHeadMark title={title} line={line} leaveTo={done} />
      <div className="mx-auto grid w-full max-w-[620px] flex-1 content-start gap-5 px-4 pt-6 md:px-7">
      <FirstRunBrand color="var(--m-ink)" size={13} />
      {url ? (
        <QrCard
          svg={svg}
          url={url}
          title={name}
          line={INVITE_SHOPS_LINE}
          filename={`${name.replace(/[^\w-]+/g, '-').toLowerCase() || 'setnayan'}-invite-a-supplier`}
          data="invite-shops-you-trust"
          note={<p className="mt-2 text-xs text-ink/55">{INVITE_SHARE_NOTE}</p>}
        />
      ) : (
        <p className="text-sm" style={{ color: 'var(--m-slate)' }}>
          Your invite QR is ready once your shop name is approved.
        </p>
      )}
      {/* The owner's line once (final check A5-G1-06): the QR card carries it; without a code it stands alone. */}
      {url ? null : (
        <p className="text-sm font-medium" style={{ color: 'var(--m-ink)' }} data-onboarding-invite-line="">
          {INVITE_SHOPS_LINE}
        </p>
      )}
      </div>
      {/* PC7: "Later" — share another time (the QR stays in Shop › Partnerships); both go where the first card lands.
          The layer's bar at its foot (final check B3) — the same bar the steps before it carry. */}
      <div
        className="sticky bottom-0 z-10 mt-auto flex items-center gap-2 border-t px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 md:px-7"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
        data-open-shop-bar=""
      >
        <ActionButton tone="neutral" quiet icon={<Clock aria-hidden className="h-4 w-4" strokeWidth={1.75} />} label="Later" href={done} data-onboarding-invite-later="" />
        <ActionButton tone="brand" main icon={<Check aria-hidden className="h-4 w-4" strokeWidth={1.9} />} label="Done" href={done} className="ml-auto" />
      </div>
    </div>
  );
}
