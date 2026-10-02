'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { vendorAutoReplyEnabled } from '@/lib/vendor-autoreply-flag';
import { vendorVoiceMatchEnabled } from '@/lib/vendor-voice-match-flag';
import { isVendorAiLadderEnabled } from '@/lib/vendor-ai-ladder-flag';
import { vendorAiAdvancedActive } from '@/lib/vendor-ai-level';
import { isVendorAiAddonActive } from '@/lib/vendor-addon-pricing';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import {
  AUTO_ACCEPT_THRESHOLD_DEFAULT,
  DAILY_AUTO_ACCEPT_CAP_DEFAULT,
  DAILY_REPLY_CAP_DEFAULT,
  parseAutoReplyConfigForm,
  parseVoiceSwitchesForm,
} from '@/lib/vendor-autoreply/config';
import { regenerateVoicePhrasings } from '@/lib/vendor-autoreply/precompute';
import { deriveVoiceFromOwnReplies } from '@/lib/vendor-autoreply/voice-learning';
import {
  coerceVoiceProfile,
  parseVoiceProfileForm,
  toVoiceProfileJson,
  type VoiceProfile,
} from '@/lib/vendor-voice-profile';

/**
 * Server action behind the My Shop "Auto-Reply Assistant" card (Phase 4 +
 * the Phase-4A auto-accept fields). Non-redirecting (`useActionState`-shaped,
 * the inline-docs-actions idiom): the card saves optimistically and reverts +
 * toasts on an error value.
 *
 * Writes vendor_bot_config under RLS — the write policy is
 * `current_vendor_ids('admin')`, so a viewer/agent team member gets a friendly
 * refusal from the same policy that protects the row. Flag-dark: the action
 * refuses outright while NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 is off, mirroring the
 * card that never renders.
 */

export type AutoReplySaveResult =
  | {
      ok: true;
      enabled: boolean;
      dailyReplyCap: number;
      autoAcceptEnabled: boolean;
      autoAcceptThreshold: number;
      dailyAutoAcceptCap: number;
    }
  | { ok: false; error: string };

export async function updateAutoReplyConfig(
  _prev: AutoReplySaveResult | null,
  formData: FormData,
): Promise<AutoReplySaveResult> {
  if (!vendorAutoReplyEnabled()) {
    return { ok: false, error: 'The Auto-Reply Assistant is not available yet.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };

  const parsed = parseAutoReplyConfigForm(formData);
  if (!parsed.ok) return parsed;

  // Partial upsert: only the columns in the patch are written, so the instant
  // toggle never clobbers the caps (and vice versa). A fresh row picks up the
  // schema defaults for everything else.
  const { data, error } = await supabase
    .from('vendor_bot_config')
    .upsert(
      {
        vendor_profile_id: profile.vendor_profile_id,
        ...parsed.patch,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'vendor_profile_id' },
    )
    .select('enabled,daily_reply_cap,auto_accept_enabled,auto_accept_threshold,daily_auto_accept_cap')
    .maybeSingle();

  if (error) {
    // RLS refusal (write policy is admin-role) → a human sentence, not SQL.
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change the Auto-Reply Assistant.'
      : error.message;
    return { ok: false, error: friendly };
  }

  revalidatePath('/vendor-dashboard/shop');

  const row = data as {
    enabled?: boolean;
    daily_reply_cap?: number;
    auto_accept_enabled?: boolean;
    auto_accept_threshold?: number;
    daily_auto_accept_cap?: number;
  } | null;
  return {
    ok: true,
    enabled: row ? Boolean(row.enabled) : (parsed.patch.enabled ?? false),
    dailyReplyCap:
      row && typeof row.daily_reply_cap === 'number'
        ? row.daily_reply_cap
        : (parsed.patch.daily_reply_cap ?? DAILY_REPLY_CAP_DEFAULT),
    autoAcceptEnabled: row
      ? Boolean(row.auto_accept_enabled)
      : (parsed.patch.auto_accept_enabled ?? false),
    autoAcceptThreshold:
      row && typeof row.auto_accept_threshold === 'number'
        ? row.auto_accept_threshold
        : (parsed.patch.auto_accept_threshold ?? AUTO_ACCEPT_THRESHOLD_DEFAULT),
    dailyAutoAcceptCap:
      row && typeof row.daily_auto_accept_cap === 'number'
        ? row.daily_auto_accept_cap
        : (parsed.patch.daily_auto_accept_cap ?? DAILY_AUTO_ACCEPT_CAP_DEFAULT),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   ADVANCED · voice-match (flag-dark · NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH)

   Two actions, both fully gated before they touch anything:
     1. the voice-match flag AND the assistant flag,
     2. a signed-in user who OWNS this vendor profile,
     3. the owner's `vendor_ai_autoreply` privacy control (fail-closed),
     4. the ADVANCED entitlement — `ai_addon_level='advanced'` AND a live
        `ai_addon_expires_at` window. NEVER `vendor_bot_config.mode`, which is
        vendor-writable and therefore a preference, not an entitlement.
   ═══════════════════════════════════════════════════════════════════════════ */

type VoiceGateOk = {
  ok: true;
  vendorProfileId: string;
  current: VoiceProfile;
  mode: string;
  learnFromPastMessages: boolean;
};
type VoiceGate = VoiceGateOk | { ok: false; error: string };

/** Everything both voice actions must prove before doing any work. */
async function voiceGate(): Promise<VoiceGate> {
  if (!vendorAutoReplyEnabled() || !vendorVoiceMatchEnabled()) {
    return { ok: false, error: 'Voice-match is not available yet.' };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in again.' };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false, error: 'No shop found for this account.' };
  const vendorProfileId = profile.vendor_profile_id as string;

  if (!(await isDataPrivacyControlActive('vendor_ai_autoreply'))) {
    return { ok: false, error: 'The AI assistant is not switched on for this account yet.' };
  }

  // ── the ADVANCED entitlement ────────────────────────────────────────────
  // `ai_addon_level` is named only behind the ladder flag: a select naming a
  // column the database hasn't migrated yet answers 42703 and nulls the WHOLE
  // row, which would read as "no entitlement" for every vendor at once.
  if (!isVendorAiLadderEnabled()) {
    return { ok: false, error: 'Voice-match is not available on your plan yet.' };
  }
  const { data: levelRow } = await supabase
    .from('vendor_profiles')
    .select('ai_addon_level,ai_addon_expires_at')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const levelFields = (levelRow ?? null) as
    | { ai_addon_level?: string | null; ai_addon_expires_at?: string | null }
    | null;
  const advanced = vendorAiAdvancedActive({
    level: levelFields?.ai_addon_level ?? null,
    windowActive: isVendorAiAddonActive(levelFields?.ai_addon_expires_at ?? null),
  });
  if (!advanced) {
    return {
      ok: false,
      error: 'Voice-match comes with Vendor AI — Advanced. Upgrade to switch it on.',
    };
  }

  const { data: configRow } = await supabase
    .from('vendor_bot_config')
    .select('mode,voice_profile,learn_from_past_messages')
    .eq('vendor_profile_id', vendorProfileId)
    .maybeSingle();
  const cfg = (configRow ?? null) as
    | { mode?: string | null; voice_profile?: unknown; learn_from_past_messages?: boolean | null }
    | null;

  return {
    ok: true,
    vendorProfileId,
    current: coerceVoiceProfile(cfg?.voice_profile),
    mode: cfg?.mode === 'smart' ? 'smart' : 'free',
    // Schema default is TRUE; only an explicit false is an opt-out.
    learnFromPastMessages: cfg?.learn_from_past_messages !== false,
  };
}

export type VoiceSuggestResult =
  | {
      ok: true;
      profile: Record<string, unknown>;
      sampleCount: number;
      confident: boolean;
    }
  | { ok: false; error: string };

/**
 * "Learn from my replies" — derive a voice PROPOSAL from the vendor's own sent
 * messages. Propose-don't-commit (§ 7A): nothing is saved; the vendor reviews
 * the suggestion in the card and presses Save if they like it.
 *
 * Runs on the vendor's OWN authenticated client so `chat_messages_member_read`
 * RLS re-asserts the § 2A isolation on top of the query's own predicates.
 */
export async function suggestVoiceProfile(): Promise<VoiceSuggestResult> {
  const gate = await voiceGate();
  if (!gate.ok) return gate;
  if (!gate.learnFromPastMessages) {
    return {
      ok: false,
      error: 'Learning from your past replies is switched off — turn it on first.',
    };
  }
  const supabase = await createClient();
  const derived = await deriveVoiceFromOwnReplies(supabase, gate.vendorProfileId);
  return {
    ok: true,
    profile: toVoiceProfileJson(derived.profile),
    sampleCount: derived.sampleCount,
    confident: derived.confident,
  };
}

export type VoiceSaveResult =
  | { ok: true; mode: string; learnFromPastMessages: boolean; phrasingRows: number }
  | { ok: false; error: string };

/**
 * Save the APPROVED voice profile + switches, then PRECOMPUTE the phrasing
 * library. The precompute is the whole cost of voice-match — it runs here, once
 * per edit, so the reply path stays a string substitution at ₱0 forever.
 *
 * The config row is written with the vendor's own client (RLS `admin` role
 * check); the phrasing library is written service-role, as migration
 * 20270822679405 documents (`vendor_reply_templates` grants writes to admins
 * only). Ownership was proved by `voiceGate()` immediately above.
 */
export async function updateVoiceProfile(
  _prev: VoiceSaveResult | null,
  formData: FormData,
): Promise<VoiceSaveResult> {
  const gate = await voiceGate();
  if (!gate.ok) return gate;

  const parsedProfile = parseVoiceProfileForm(formData, gate.current);
  if (!parsedProfile.ok) return { ok: false, error: parsedProfile.error };
  const parsedSwitches = parseVoiceSwitchesForm(formData);
  if (!parsedSwitches.ok) return { ok: false, error: parsedSwitches.error };

  const supabase = await createClient();
  const { error } = await supabase.from('vendor_bot_config').upsert(
    {
      vendor_profile_id: gate.vendorProfileId,
      ...parsedSwitches.patch,
      voice_profile: toVoiceProfileJson(parsedProfile.profile),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_profile_id' },
  );
  if (error) {
    const friendly = /row-level security/i.test(error.message)
      ? 'Only shop admins can change the assistant’s voice.'
      : error.message;
    return { ok: false, error: friendly };
  }

  // Precompute AFTER the profile is stored, so a failure here leaves the vendor
  // with an approved voice and no phrasings — which the serving gate reads as
  // `no_phrasings` and answers in the neutral house voice. Safe, and self-heals
  // on the next save.
  const precomputed = await regenerateVoicePhrasings(
    createAdminClient(),
    gate.vendorProfileId,
    parsedProfile.profile,
  );
  if (!precomputed.ok) {
    return {
      ok: false,
      error: 'Saved your voice, but preparing the replies failed — press Save again.',
    };
  }

  revalidatePath('/vendor-dashboard/shop');
  return {
    ok: true,
    mode: parsedSwitches.patch.mode ?? gate.mode,
    learnFromPastMessages:
      parsedSwitches.patch.learn_from_past_messages ?? gate.learnFromPastMessages,
    phrasingRows: precomputed.rows,
  };
}
