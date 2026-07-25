import { createClient } from '@/lib/supabase/server';
import { isVendorAiLadderEnabled } from '@/lib/vendor-ai-ladder-flag';
import { vendorAiAdvancedActive } from '@/lib/vendor-ai-level';
import { isVendorAiAddonActive } from '@/lib/vendor-addon-pricing';
import { vendorVoiceMatchEnabled } from '@/lib/vendor-voice-match-flag';
import { HOUSE_VOICE, coerceVoiceProfile } from '@/lib/vendor-voice-profile';

import { VoiceMatchCard } from './voice-match-card';

/**
 * Loader for the Advanced voice-match panel. Flag-DARK — returns null unless
 * NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH is on, so flag-off costs ZERO queries and
 * the page is byte-identical to today.
 *
 * Soft probe (the My Shop pattern): every read degrades to a safe default
 * rather than blanking the page. The voice columns (`mode` / `voice_profile` /
 * `learn_from_past_messages`) and `ai_addon_level` are named ONLY inside their
 * flags, because PostgREST answers a select naming an unmigrated column with
 * 42703 and nulls the whole row.
 */
export async function VoiceMatchSection({ vendorProfileId }: { vendorProfileId: string }) {
  if (!vendorVoiceMatchEnabled()) return null;

  let advancedActive = false;
  let profile = { ...HOUSE_VOICE };
  let mode = 'free';
  let learn = true;

  try {
    const supabase = await createClient();

    if (isVendorAiLadderEnabled()) {
      const { data } = await supabase
        .from('vendor_profiles')
        .select('ai_addon_level,ai_addon_expires_at')
        .eq('vendor_profile_id', vendorProfileId)
        .maybeSingle();
      const row = (data ?? null) as
        | { ai_addon_level?: string | null; ai_addon_expires_at?: string | null }
        | null;
      advancedActive = vendorAiAdvancedActive({
        level: row?.ai_addon_level ?? null,
        windowActive: isVendorAiAddonActive(row?.ai_addon_expires_at ?? null),
      });
    }

    const { data: cfg } = await supabase
      .from('vendor_bot_config')
      .select('mode,voice_profile,learn_from_past_messages')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    const c = (cfg ?? null) as
      | { mode?: string | null; voice_profile?: unknown; learn_from_past_messages?: boolean | null }
      | null;
    if (c) {
      profile = coerceVoiceProfile(c.voice_profile);
      mode = c.mode === 'smart' ? 'smart' : 'free';
      learn = c.learn_from_past_messages !== false;
    }
  } catch {
    // defaults above — the panel renders in its locked/house state.
  }

  return (
    <section id="voice-match" aria-labelledby="voice-match-heading" className="mt-4">
      <VoiceMatchCard
        advancedActive={advancedActive}
        initialProfile={profile}
        initialMode={mode}
        initialLearnFromPastMessages={learn}
      />
    </section>
  );
}
