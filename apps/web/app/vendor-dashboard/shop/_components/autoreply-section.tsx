import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  AUTO_ACCEPT_THRESHOLD_DEFAULT,
  DAILY_AUTO_ACCEPT_CAP_DEFAULT,
  DAILY_REPLY_CAP_DEFAULT,
} from '@/lib/vendor-autoreply/config';
import { AutoReplyCard } from './autoreply-card';
// Advanced voice-match panel — self-gating on NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH (returns null, zero queries, when off).
import { VoiceMatchSection } from './voice-match-section';

/*
 * AUTO-REPLY — MOVED, NOT REWRITTEN, from `shop/page.tsx` (simpler supplier dashboard step 5, 2026-10-14). It sat at
 * the foot of My Shop; it is now Your page › Auto-reply (the prototype's row "Auto-reply · Answers the first
 * message"), still behind NEXT_PUBLIC_VENDOR_AUTOREPLY_V1, still `#auto-reply`.
 */
/** Loads the vendor's Auto-Reply config for the Phase-4 card. Soft probe (the
 *  My Shop pattern): a pre-migration DB or a vendor with no row yet degrades
 *  to the schema defaults (off · cap 30) instead of blanking the page. Only
 *  ever runs behind the flag, so flag-off costs zero queries. */
export async function AutoReplySection({ vendorProfileId }: { vendorProfileId: string }) {
  let enabled = false;
  let dailyCap = DAILY_REPLY_CAP_DEFAULT;
  let autoAcceptEnabled = false;
  let autoAcceptThreshold = AUTO_ACCEPT_THRESHOLD_DEFAULT;
  let dailyAutoAcceptCap = DAILY_AUTO_ACCEPT_CAP_DEFAULT;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('vendor_bot_config')
      .select(
        'enabled,daily_reply_cap,auto_accept_enabled,auto_accept_threshold,daily_auto_accept_cap',
      )
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    // ⚠ their front-desk assistant's settings. Refused, `if (row)` is skipped
    // ⚠ and every value stays at its default, so a reply cap or an auto-accept
    // ⚠ threshold they configured reads as though they never touched it.
    if (error) {
      logQueryError(
        'VendorShopPage.botConfig',
        error,
        { vendorProfileId },
        'graceful_degrade',
      );
    }
    const row = data as {
      enabled?: boolean;
      daily_reply_cap?: number;
      auto_accept_enabled?: boolean;
      auto_accept_threshold?: number;
      daily_auto_accept_cap?: number;
    } | null;
    if (row) {
      enabled = Boolean(row.enabled);
      if (typeof row.daily_reply_cap === 'number') dailyCap = row.daily_reply_cap;
      autoAcceptEnabled = Boolean(row.auto_accept_enabled);
      if (typeof row.auto_accept_threshold === 'number') {
        autoAcceptThreshold = row.auto_accept_threshold;
      }
      if (typeof row.daily_auto_accept_cap === 'number') {
        dailyAutoAcceptCap = row.daily_auto_accept_cap;
      }
    }
  } catch {
    // defaults above
  }
  return (
    <section id="auto-reply" aria-labelledby="auto-reply-heading">
      <AutoReplyCard
        initialEnabled={enabled}
        initialDailyCap={dailyCap}
        initialAutoAcceptEnabled={autoAcceptEnabled}
        initialAutoAcceptThreshold={autoAcceptThreshold}
        initialDailyAutoAcceptCap={dailyAutoAcceptCap}
      />
      <VoiceMatchSection vendorProfileId={vendorProfileId} />
    </section>
  );
}
