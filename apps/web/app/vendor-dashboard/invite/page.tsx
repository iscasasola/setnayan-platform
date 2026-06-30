import Link from 'next/link';
import { redirect } from 'next/navigation';
import { QrCode, Users, ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';
import { CopyButton } from '@/app/_components/copy-button';

export const metadata = { title: 'Invite a couple · Setnayan' };

export default async function VendorInviteQrPage() {
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
  const inviteUrl = slug ? buildVendorInviteUrl(slug) : null;
  const qrSvg = inviteUrl ? await renderUrlQrSvg(inviteUrl, 220) : null;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6">
      <Link
        href="/vendor-dashboard"
        className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-[0.18em] text-ink/50 hover:text-terracotta"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Dashboard
      </Link>

      <header className="mt-4 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <QrCode className="h-6 w-6 text-terracotta" strokeWidth={1.75} /> Invite a couple
        </h1>
        <p className="text-sm text-ink/60">
          Show or send this to your couples. They scan it, set up their free
          Setnayan plan, and you land on their vendor shortlist — so the whole
          wedding is managed in one place. It’s free, for you and for them.
        </p>
      </header>

      {!canShare ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink/20 bg-cream p-6 text-center">
          <Users className="mx-auto h-6 w-6 text-ink/40" strokeWidth={1.5} />
          <p className="mt-2 text-sm text-ink/70">
            Publish your business profile first — your invite link is built from
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
        <div className="mt-6 rounded-3xl border border-ink/10 bg-cream p-6">
          <div className="flex justify-center">
            <div
              className="rounded-2xl bg-white p-4 shadow-sm [&_svg]:h-[220px] [&_svg]:w-[220px]"
              dangerouslySetInnerHTML={{ __html: qrSvg ?? '' }}
            />
          </div>

          <div className="mt-5">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
              Your invite link
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
      )}
    </div>
  );
}
