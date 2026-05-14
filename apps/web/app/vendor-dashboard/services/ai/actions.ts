'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import {
  generateCatalogWithClaude,
  type GeneratedCatalogEntry,
} from '@/lib/anthropic-catalog';
import { transcribeWithWhisper } from '@/lib/openai-whisper';
import { parseStoredAsset, presignDisplayUrl } from '@/lib/uploads';
import { VENDOR_CATEGORIES, type VendorCategory } from '@/lib/vendors';

const CATEGORY_SET: ReadonlySet<string> = new Set(VENDOR_CATEGORIES);

async function ensureProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');
  return { supabase, profile };
}

export type GenerateCatalogResult =
  | { ok: true; entries: GeneratedCatalogEntry[] }
  | { ok: false; error: string };

/**
 * Calls Claude (or the stub) to turn a vendor's plain-English description
 * into a structured catalog preview. Auth-checked: only the signed-in vendor
 * profile owner may call this.
 */
export async function generateCatalog(
  description: string,
): Promise<GenerateCatalogResult> {
  // Validate auth (and redirect if missing) BEFORE doing any other work.
  await ensureProfile();

  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: 'Description cannot be empty.' };
  }
  if (trimmed.length > 4000) {
    return {
      ok: false,
      error: 'Description is too long (max 4000 characters).',
    };
  }

  try {
    const entries = await generateCatalogWithClaude(trimmed);
    return { ok: true, entries };
  } catch (e) {
    return {
      ok: false,
      error: `AI generation failed: ${(e as Error).message}`,
    };
  }
}

export type PublishGeneratedCatalogResult = {
  ok: boolean;
  created: number;
  skipped: number;
  errors: string[];
};

/**
 * Persist the (possibly vendor-edited) AI catalog preview to `vendor_services`.
 *
 * Constraints from the existing flat schema (iteration 0022):
 *   • `vendor_services` has UNIQUE (vendor_profile_id, category) — so
 *     multiple "packages" per category (Bronze/Silver/Gold catering) must
 *     collapse into a single row. We take the LOWEST `starting_price_php`
 *     per category since the column is "starting price".
 *   • The table has no `name` column — names are review-only hints from
 *     iteration 0040's eventual modifier-groups schema. Not persisted here.
 *   • A category that already has a row for this vendor is skipped (the
 *     vendor edits it via the manual /vendor-dashboard/services page).
 *
 * Returns `{ created, skipped, errors }` so the UI can show what happened
 * without making this action a redirect (the client component drives the
 * confirmation screen).
 */
export async function publishGeneratedCatalog(
  entries: GeneratedCatalogEntry[],
): Promise<PublishGeneratedCatalogResult> {
  const { supabase, profile } = await ensureProfile();

  if (!Array.isArray(entries) || entries.length === 0) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: ['No services to publish.'],
    };
  }

  // 1. Validate entries and group by category (take min price per category).
  type Bucket = { category: VendorCategory; starting_price_php: number };
  const byCategory = new Map<VendorCategory, Bucket>();
  const errors: string[] = [];

  for (const e of entries) {
    if (!e || typeof e !== 'object') continue;
    const categoryRaw =
      typeof e.category === 'string' ? e.category.trim() : '';
    if (!CATEGORY_SET.has(categoryRaw)) {
      errors.push(`Skipped entry with invalid category: ${categoryRaw}`);
      continue;
    }
    const category = categoryRaw as VendorCategory;

    const priceRaw = e.starting_price_php;
    if (
      typeof priceRaw !== 'number' ||
      !Number.isFinite(priceRaw) ||
      priceRaw < 0
    ) {
      errors.push(`Skipped "${e.name ?? '(unnamed)'}" — invalid price.`);
      continue;
    }
    const price = Math.round(priceRaw);

    const existing = byCategory.get(category);
    if (!existing || price < existing.starting_price_php) {
      byCategory.set(category, { category, starting_price_php: price });
    }
  }

  if (byCategory.size === 0) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: errors.length > 0 ? errors : ['No valid services to publish.'],
    };
  }

  // 2. Find which categories the vendor already has — those get skipped
  //    rather than throwing a UNIQUE-violation. Vendor can edit them on the
  //    manual /vendor-dashboard/services page.
  const { data: existingRows, error: fetchErr } = await supabase
    .from('vendor_services')
    .select('category')
    .eq('vendor_profile_id', profile.vendor_profile_id);
  if (fetchErr) {
    return {
      ok: false,
      created: 0,
      skipped: 0,
      errors: [`Could not load existing services: ${fetchErr.message}`],
    };
  }
  const existingCategories = new Set(
    (existingRows ?? []).map((r) => r.category as string),
  );

  let created = 0;
  let skipped = 0;
  const inserts: Array<{
    vendor_profile_id: string;
    category: VendorCategory;
    starting_price_php: number;
    is_active: boolean;
  }> = [];

  for (const bucket of byCategory.values()) {
    if (existingCategories.has(bucket.category)) {
      skipped += 1;
      errors.push(
        `Skipped "${bucket.category}" — you already have a service in that category. Edit it on the Services page.`,
      );
      continue;
    }
    inserts.push({
      vendor_profile_id: profile.vendor_profile_id,
      category: bucket.category,
      starting_price_php: bucket.starting_price_php,
      is_active: true,
    });
  }

  if (inserts.length === 0) {
    return { ok: false, created: 0, skipped, errors };
  }

  // 3. One batch insert — RLS policy `vendor_services_owner` already gates by
  //    user_id, and the explicit vendor_profile_id filter on the read above
  //    guarantees we only write rows the caller owns.
  const { error: insertErr } = await supabase
    .from('vendor_services')
    .insert(inserts);
  if (insertErr) {
    return {
      ok: false,
      created: 0,
      skipped,
      errors: [`Insert failed: ${insertErr.message}`],
    };
  }
  created = inserts.length;

  revalidatePath('/vendor-dashboard/services');
  return { ok: true, created, skipped, errors };
}

// ============================================================================
// Voice input (iteration 0040 slice — Filipino/Taglish via OpenAI Whisper)
// ============================================================================

export type TranscribeAudioResult =
  | { ok: true; transcript: string }
  | { ok: false; error: string };

// Maximum number of characters we accept from Whisper. A 60-second
// recording transcribes to roughly 600–900 chars in Tagalog, so 4000 leaves
// generous headroom while still cutting off pathological returns (looped
// audio, model glitching) before they hit the Claude prompt builder.
const MAX_TRANSCRIPT_CHARS = 4000;

// `r2://` ref shape we expect from the upload route, scoped to the
// thread-files bucket + the `vendors/{vendorProfileId}/voice-input/` prefix.
// We re-derive the prefix per-call from the authenticated vendor profile,
// so a vendor can't transcribe another vendor's recording even if they
// guess the key.
function audioPrefixFor(vendorProfileId: string): string {
  return `vendors/${vendorProfileId}/voice-input/`;
}

/**
 * Transcribe an uploaded voice recording.
 *
 * Inputs:
 *   • `r2Ref` — the `r2://thread-files/vendors/{id}/voice-input/{uuid}.webm`
 *     string the upload route returned when the browser PUT the recording.
 *
 * Auth & ownership:
 *   • Caller must be signed in and own a vendor profile (`ensureProfile`).
 *   • The ref must point at the caller's own voice-input prefix — we never
 *     transcribe an arbitrary R2 key just because the URL is valid.
 *
 * Returns the trimmed transcript (string) or an error message safe to show
 * the vendor. Network / model failures surface a generic "Could not
 * transcribe…" message; the underlying error is logged server-side.
 */
export async function transcribeAudio(
  r2Ref: string,
): Promise<TranscribeAudioResult> {
  const { profile } = await ensureProfile();

  if (typeof r2Ref !== 'string' || r2Ref.length === 0) {
    return { ok: false, error: 'No audio file supplied.' };
  }

  // Validate the ref structure + ownership BEFORE we issue a presign — the
  // signing call hits AWS SDK and we don't want to spend a round trip on a
  // bogus input.
  const ref = parseStoredAsset(r2Ref);
  if (!ref || ref.kind !== 'r2') {
    return { ok: false, error: 'Audio file reference is invalid.' };
  }
  if (ref.bucket !== 'setnayan-thread-files') {
    return {
      ok: false,
      error: 'Audio file must live in the thread-files bucket.',
    };
  }
  const expectedPrefix = audioPrefixFor(profile.vendor_profile_id);
  if (!ref.key.startsWith(expectedPrefix)) {
    // Either a typo or a probing attempt — don't leak which.
    return { ok: false, error: 'Audio file does not belong to your account.' };
  }

  // Whisper needs to download the audio. We use the same presigned-GET
  // helper that powers thumbnail rendering, capped at 10 minutes — long
  // enough for Whisper's queue latency on a cold day, short enough that a
  // leaked URL stops working before the next session starts.
  let signedUrl: string;
  try {
    signedUrl = await presignDisplayUrl(ref.bucket, ref.key, 60 * 10);
  } catch (e) {
    console.error('[transcribeAudio] presign failed', e);
    return { ok: false, error: 'Could not access audio file. Please try again.' };
  }

  try {
    const raw = await transcribeWithWhisper(signedUrl);
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return {
        ok: false,
        error:
          'We did not hear anything in that recording. Try again somewhere quieter.',
      };
    }
    // Hard cap on length — Whisper rarely returns more than ~1k chars for
    // a 60s clip but we'd rather truncate than ship a pathological payload
    // to Claude.
    const transcript =
      trimmed.length > MAX_TRANSCRIPT_CHARS
        ? trimmed.slice(0, MAX_TRANSCRIPT_CHARS)
        : trimmed;
    return { ok: true, transcript };
  } catch (e) {
    console.error('[transcribeAudio] whisper failed', e);
    return {
      ok: false,
      error: `Could not transcribe audio: ${(e as Error).message}`,
    };
  }
}

/**
 * Generate a structured catalog from a voice transcript.
 *
 * This is a thin alias over `generateCatalog` that exists for two reasons:
 *   1. Analytics — keeps text-input vs. voice-input call counts cleanly
 *      separable in server logs (we don't ship analytics from this action
 *      yet, but the affordance is here for iteration 0042's tracking).
 *   2. UX — the vendor can edit the transcript before submitting, so the
 *      call site reads more honestly as "generate from this (possibly
 *      edited) transcript" rather than "generate from a fresh description".
 *
 * The actual prompt + Claude call are unchanged — Whisper output is just
 * plain text, and the catalog extractor already handles Tagalog / Taglish
 * (Claude is multilingual).
 *
 * Signature accepts the vendor profile id for symmetry with the future
 * per-vendor prompting hook, but the current `generateCatalogWithClaude`
 * doesn't use it. We validate ownership via `ensureProfile` regardless.
 */
export async function generateCatalogFromVoice(
  vendorProfileId: string,
  transcript: string,
): Promise<GenerateCatalogResult> {
  const { profile } = await ensureProfile();

  // Defense-in-depth: the client passes the vendor profile id it knows
  // about; we cross-check against the session-bound profile so a stale
  // tab can't smuggle in a different id.
  if (
    typeof vendorProfileId === 'string' &&
    vendorProfileId.length > 0 &&
    vendorProfileId !== profile.vendor_profile_id
  ) {
    return {
      ok: false,
      error: 'Vendor profile mismatch — please refresh and try again.',
    };
  }

  const trimmed = typeof transcript === 'string' ? transcript.trim() : '';
  if (trimmed.length === 0) {
    return {
      ok: false,
      error: 'Transcript is empty. Record again or switch to text input.',
    };
  }
  if (trimmed.length > MAX_TRANSCRIPT_CHARS) {
    return {
      ok: false,
      error: `Transcript is too long (max ${MAX_TRANSCRIPT_CHARS} characters).`,
    };
  }

  try {
    const entries = await generateCatalogWithClaude(trimmed);
    return { ok: true, entries };
  } catch (e) {
    return {
      ok: false,
      error: `AI generation failed: ${(e as Error).message}`,
    };
  }
}
