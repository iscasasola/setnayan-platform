import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { AUTO_ACCEPT_THRESHOLD_DEFAULT } from '@/lib/vendor-autoreply/config';
import { isVendorAiAddonActive } from '@/lib/vendor-addon-pricing';
import { vendorAiBasicActive } from '@/lib/vendor-ai-level';
import { papersProgress } from '@/lib/locks';
import { REQUIRED_DOC_COUNT, countCompleteRequiredSlots, fetchLatestApplication, type DocUploadMap } from '@/lib/vendor-verification';
import { LockedFeature } from '@/app/_components/lock/locked-feature';
import { AutoReplyCard } from './autoreply-card';
import { CouldNotLoad } from './could-not-load';
// Advanced voice-match panel — self-gating on NEXT_PUBLIC_VENDOR_AI_VOICE_MATCH (returns null, zero queries, when off).
import { VoiceMatchSection } from './voice-match-section';

/*
 * AUTO-REPLY — MOVED, NOT REWRITTEN, from `shop/page.tsx` (simpler supplier dashboard step 5, 2026-10-14). It sat at
 * the foot of My Shop; it was Your page › Auto-reply, and since THE ONE BUILD (spec §9 #6, 8 Nov 2026) it is in the
 * Clients ⚙ sheet — it answers a client's first message. Still behind NEXT_PUBLIC_VENDOR_AUTOREPLY_V1.
 */
/** Loads the vendor's Auto-Reply config for the Phase-4 card. Soft probe (the
 *  My Shop pattern): a pre-migration DB or a vendor with no row yet degrades
 *  to the schema defaults (off) instead of blanking the page. Only
 *  ever runs behind the flag, so flag-off costs zero queries. */
export async function AutoReplySection({ vendorProfileId }: { vendorProfileId: string }) {
  // 🔒 Owner 21 Nov: "AI Chatbot is for verified and up". The inbox gate (`vendorAiBasicActive`, inbox-hook.ts) answers
  // nothing for an unverified Free shop, so its switch is shown as the shared lock — never a switch that does nothing.
  // Unread → the card is drawn as before (the server gate still decides; a lock on a guess would be the dishonest half).
  const locked = await chatbotLocked(vendorProfileId);
  if (locked) {
    return (
      <section aria-labelledby="auto-reply-heading" data-chatbot-locked="">
        <h3 id="auto-reply-heading" className="sr-only">
          AI chatbot
        </h3>
        <LockedFeature lock="chatbot" need={{ kind: 'verify', progress: locked.progress }} />
      </section>
    );
  }
  let enabled = false;
  let autoAcceptEnabled = false;
  let autoAcceptThreshold = AUTO_ACCEPT_THRESHOLD_DEFAULT;
  // S-6 (supplier audit 2026-11-17): a REFUSED read drew both switches OFF, and a re-save then turned them off for
  // real. Unread draws no switches at all — "Couldn't load" — so nothing can be saved over settings nobody saw.
  let unread = false;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('vendor_bot_config')
      .select('enabled,auto_accept_enabled,auto_accept_threshold')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    // ⚠ their front-desk assistant's settings. Refused, `if (row)` is skipped
    // ⚠ and every value stays at its default, so a switch or an auto-accept
    // ⚠ threshold they configured reads as though they never touched it.
    if (error) {
      logQueryError(
        'VendorShopPage.botConfig',
        error,
        { vendorProfileId },
        'graceful_degrade',
      );
      unread = true;
    }
    const row = data as {
      enabled?: boolean;
      auto_accept_enabled?: boolean;
      auto_accept_threshold?: number;
    } | null;
    if (row) {
      enabled = Boolean(row.enabled);
      autoAcceptEnabled = Boolean(row.auto_accept_enabled);
      if (typeof row.auto_accept_threshold === 'number') {
        autoAcceptThreshold = row.auto_accept_threshold;
      }
    }
  } catch (err) {
    logQueryError('VendorShopPage.botConfig', err, { vendorProfileId }, 'graceful_degrade');
    unread = true;
  }
  return (
    // Mounted once, in the Clients ⚙ sheet (`customers-settings-body.tsx`, spec §9 #6) — no longer on Your page or Shop.
    <section aria-labelledby="auto-reply-heading">
      {unread ? (
        <div data-autoreply-unread="">
          <CouldNotLoad what="your auto-reply settings" />
        </div>
      ) : (
        <AutoReplyCard
          initialEnabled={enabled}
          initialAutoAcceptEnabled={autoAcceptEnabled}
          initialAutoAcceptThreshold={autoAcceptThreshold}
        />
      )}
      <VoiceMatchSection vendorProfileId={vendorProfileId} />
    </section>
  );
}

/** Is the chatbot locked for this shop? `{ progress }` when it is (an unverified Free shop with no bought window), null
 *  when it is open or the row could not be read. Same inputs as the inbox gate, so the lock and the gate agree. */
async function chatbotLocked(vendorProfileId: string): Promise<{ progress: string } | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('vendor_profiles')
      .select('ai_addon_expires_at, tier_state, tier_expires_at, verification_state')
      .eq('vendor_profile_id', vendorProfileId)
      .maybeSingle();
    if (error || !data) {
      if (error) logQueryError('VendorShopPage.chatbotGate', error, { vendorProfileId }, 'graceful_degrade');
      return null;
    }
    const row = data as {
      ai_addon_expires_at?: string | null;
      tier_state?: string | null;
      tier_expires_at?: string | null;
      verification_state?: string | null;
    };
    const open = vendorAiBasicActive({
      level: null,
      windowActive: isVendorAiAddonActive(row.ai_addon_expires_at ?? null),
      plan: row,
    });
    if (open) return null;
    const papers = await fetchLatestApplication(supabase, vendorProfileId)
      .then((a) => ({ done: countCompleteRequiredSlots((a?.doc_uploads ?? {}) as DocUploadMap), of: REQUIRED_DOC_COUNT }))
      .catch((err) => {
        console.error('[supabase-error] shop/autoreply-section · latest application', err);
        return null;
      });
    return { progress: papersProgress(papers) };
  } catch {
    return null;
  }
}
