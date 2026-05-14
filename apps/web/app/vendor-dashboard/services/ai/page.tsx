import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { AiCatalogGenerator } from './_components/ai-catalog-generator';

export const metadata = { title: 'AI Catalog Generator · Vendor' };

const STUB_MODE = !process.env.ANTHROPIC_API_KEY;

export default async function VendorServicesAiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  return (
    <section className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-3">
        <Link
          href="/vendor-dashboard/services"
          className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-3 w-3" strokeWidth={2} />
          Back to services
        </Link>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <Sparkles aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          {STUB_MODE ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-amber-800">
              Demo mode (stub)
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-800">
              Live AI
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Generate your catalog with AI
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Describe your services in plain English and we&rsquo;ll build a draft
          catalog you can review, edit, and publish in one click.
        </p>
      </header>

      <AiCatalogGenerator vendorProfileId={profile.vendor_profile_id} />
    </section>
  );
}
