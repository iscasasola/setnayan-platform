import { notFound } from 'next/navigation';
import { LogIn, Handshake } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { ActionButton } from '@/components/action-button';
import { SubmitButton } from '@/app/_components/submit-button';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { SupplierInviteDoor } from '@/app/vendor/claim/[token]/_components/claim-parts';
import { readInviter } from '@/lib/supplier-invite.server';
import { cleanInviteSlug, supplierInvitePath } from '@/lib/supplier-invite';
import { joinSupplierInvite } from './actions';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'You’re invited · Setnayan', robots: { index: false } };

/**
 * 🤝 `/i/<slug>` — ANOTHER SUPPLIER'S INVITE LINK (Invite a supplier v3, owner 16 Nov 2026; specs cb1affde frame 3).
 *
 *   · signed out, or signed in with no shop → "Create my free shop" (→ `join/`, which remembers the link and opens the
 *     shipped shop setup) · "I already have a Setnayan shop" (→ sign in, back here).
 *   · signed in WITH a shop → "I already have a Setnayan shop" is the join itself (`joinSupplierInvite`): the
 *     handshake, never counted toward Invites (answer 2). Their own link says so instead.
 *
 * The inviter is read with the admin client: a still-unpublished shop can invite too, and its name is the only thing
 * this page shows of it (the person holding the link was given it by that shop).
 */
export default async function SupplierInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const [{ slug: raw }, sp] = await Promise.all([params, searchParams]);
  const slug = cleanInviteSlug(raw);
  if (!slug) notFound();

  const inviter = await readInviter(createAdminClient(), slug);
  if (inviter === 'unreadable') {
    throw new Error('supplier invite: could not read the inviting shop');
  }
  if (!inviter) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const own = user ? await fetchOwnVendorProfile(supabase, user.id) : null;
  const hasShop = Boolean((own as { business_name?: string | null } | null)?.business_name?.trim());
  const isSelf = own?.vendor_profile_id === inviter.vendorProfileId;
  const here = supplierInvitePath(slug);

  const existing = hasShop ? (
    isSelf ? null : (
      <form action={joinSupplierInvite}>
        <input type="hidden" name="slug" value={slug} />
        <SubmitButton pendingLabel="Joining…" className="button-secondary inline-flex items-center gap-2">
          <Handshake aria-hidden className="h-4 w-4" strokeWidth={1.9} />
          I already have a Setnayan shop
        </SubmitButton>
      </form>
    )
  ) : (
    <ActionButton
      tone="brand"
      icon={<LogIn aria-hidden className="h-4 w-4" strokeWidth={1.9} />}
      label="I already have a Setnayan shop"
      href={`/login?next=${encodeURIComponent(here)}&as=vendor`}
    />
  );

  return (
    <>
      {sp.error ? (
        <div className="mx-auto max-w-xl px-4 pt-6">
          <FormFlash tone="error">{decodeURIComponent(sp.error).slice(0, 200)}</FormFlash>
        </div>
      ) : null}
      <SupplierInviteDoor
        inviterName={inviter.businessName}
        createHref={hasShop ? null : `${here}/join`}
        existing={existing}
        note={
          isSelf
            ? 'This is your own invite link — share it with the suppliers you work with.'
            : hasShop
              ? `You join as each other’s preferred supplier. ${inviter.businessName} shows on your Trusted by, and you on theirs.`
              : null
        }
      />
    </>
  );
}
