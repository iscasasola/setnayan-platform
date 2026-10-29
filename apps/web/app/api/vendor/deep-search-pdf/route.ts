import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { sharePdfPaper } from '@/lib/share-pdf-papers';
import { DEEP_SEARCH_KEEP_DAYS, deepSearchStillKept } from '@/lib/deep-search-findings';
import { deepSearchPdf, deepSearchPdfFileName } from '@/lib/deep-search-pdf';
import type { VendorDossier } from '@/lib/vendor-deep-search';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vendor/deep-search-pdf?dossier=<id>&paper=a4|letter|long
 *
 * 📄 ONE DEEP SEARCH AS A PDF (owner, with the Supplier dashboard v13 approval 2026-10-29: *"run search would also
 * create a pdf file of the search created"*) — drawn by `lib/deep-search-pdf.ts` on the shared engine, saved through
 * the shared Share button (`SharePdfButton`, Paper ▾).
 *
 * A query string, not a `[dossierId]` segment: a static route costs Vercel's route budget nothing per id
 * (`scripts/check-vercel-route-count.mjs`), and the id is not a secret — the gate below is what protects it.
 *
 * THE GATE, in order, BEFORE the result is read:
 *   1. signed in;
 *   2. the signed-in user's own shop (`fetchOwnVendorProfile`, owned or via team);
 *   3. the search is THIS shop's: a row of `vendor_deep_search_uses` for that dossier, read through the user's OWN
 *      session (its RLS policy shows a shop only its own rows). An admin's verification dossier has no use row, so it
 *      can never be drawn here — the same rule `/vendor-dashboard/deep-search` uses to list results.
 * Then the result itself (admin read — `vendor_web_dossiers` is admin-only), re-checked against the same shop, and
 * only when it is COMPLETE and still inside its keep window (`DEEP_SEARCH_KEEP_DAYS`): the PDF lives exactly as long
 * as the search, never longer. Every refusal is a sentence (the Share button shows it), never an empty file.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const say = (status: number, words: string) =>
    new NextResponse(words, { status, headers: { 'Cache-Control': 'private, no-store', 'Content-Type': 'text/plain; charset=utf-8' } });

  const raw = request.nextUrl.searchParams.get('dossier') ?? '';
  const dossierId = /^\d{1,15}$/.test(raw) ? Number(raw) : null;
  if (dossierId === null) return say(400, 'That search could not be found.');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return say(401, 'Sign in to save your Deep Search.');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return say(404, 'Your shop could not be found.');
  const vendorProfileId = profile.vendor_profile_id;

  const { data: useRow, error: useError } = await supabase
    .from('vendor_deep_search_uses')
    .select('id')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('dossier_id', dossierId)
    .limit(1)
    .maybeSingle();
  if (useError) {
    console.error('[deep-search-pdf] the search could not be checked', useError.message, { vendorProfileId, dossierId });
    return say(503, "Your search couldn't be checked just now. Please try again.");
  }
  if (!useRow) return say(404, 'That search is not one of your shop’s.');

  const { data: row, error } = await createAdminClient()
    .from('vendor_web_dossiers')
    .select('id, vendor_profile_id, status, dossier, created_at')
    .eq('id', dossierId)
    .maybeSingle();
  if (error) {
    console.error('[deep-search-pdf] the result could not be read', error.message, { vendorProfileId, dossierId });
    return say(503, "Your search couldn't be read just now. Please try again.");
  }
  const r = row as { vendor_profile_id: string; status: string; dossier: VendorDossier | null; created_at: string } | null;
  if (!r || r.vendor_profile_id !== vendorProfileId) return say(404, 'That search is no longer kept.');
  if (r.status !== 'complete' || !r.dossier) return say(409, 'That search has not finished yet.');
  if (!deepSearchStillKept(r.created_at, Date.now())) return say(410, `That search is no longer kept — results are deleted after ${DEEP_SEARCH_KEEP_DAYS} days.`);

  let bytes: Uint8Array;
  try {
    bytes = await deepSearchPdf({
      businessName: profile.business_name ?? 'Your shop',
      dossier: r.dossier,
      searchedAt: r.created_at,
      generatedAt: new Date(),
      // Paper ▾ — A4 (default) · Letter · Long bond; anything else is A4.
      paper: sharePdfPaper(request.nextUrl.searchParams.get('paper')),
    });
  } catch (e) {
    console.error('[deep-search-pdf] the PDF could not be drawn', e instanceof Error ? e.message : e, { dossierId });
    return say(500, "Your search's file couldn't be made just now. Please try again.");
  }
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${deepSearchPdfFileName(r.created_at)}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
