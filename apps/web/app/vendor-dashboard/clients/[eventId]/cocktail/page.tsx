import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Martini } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { CocktailEditor, type CocktailEditorData } from './cocktail-editor';

export const metadata = { title: 'Cocktail Area · Vendor' };

/**
 * Vendor-facing cocktail / waiting-area editor — the FIRST surface where a
 * booked vendor WRITES to a couple's planning blueprint (cocktail area + its
 * booths only; never reception seating or guest PII). All gating lives in the
 * get_vendor_cocktail_editor RPC + the vendor_*_cocktail_* write RPCs
 * (SECURITY DEFINER); this page just renders what the RPC allows.
 */

type Props = { params: Promise<{ eventId: string }> };

export default async function VendorCocktailPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // not_a_vendor / not_booked / category_not_cocktail / vendor_edit_off all
  // land here → the brief is the right fallback.
  const { data, error } = await supabase.rpc('get_vendor_cocktail_editor', {
    p_event_id: eventId,
  });
  if (error || !data) redirect(`/vendor-dashboard/clients/${eventId}`);
  const plan = data as CocktailEditorData;

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/vendor-dashboard/clients/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Event brief
      </Link>

      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <Martini aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{plan.cocktail.label}</h1>
        <p className="max-w-prose text-base text-ink/65">
          {plan.can_arrange
            ? 'Arrange the cocktail / waiting area — drag the room to fit the space and place the booths. The couple sees your changes on their blueprint.'
            : 'Place and move your booth inside the couple’s cocktail / waiting area. The reception is shown for reference only — counts, never guest names.'}
        </p>
      </header>

      <CocktailEditor eventId={eventId} data={plan} />
    </section>
  );
}
