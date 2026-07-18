/**
 * Vendor Auto-Reply Assistant feature flag.
 *
 * Gates the whole vendor AI Auto-Reply Assistant ("BotCake, no flows"): the
 * deterministic front desk, compatibility auto-accept, voice-matched replies,
 * "Deep Search your business", and the My Shop config surface. See
 * ~/Documents/Claude/Projects/Setnayan/Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md.
 *
 * NEXT_PUBLIC_ so the server surfaces (My Shop config page, inbox hook) and the
 * client shell agree on one value. Off by default — nothing ships until the
 * owner sets NEXT_PUBLIC_VENDOR_AUTOREPLY_V1=true. The counsel-gated pieces
 * (couple-faith consumption, §7C) stay behind this flag pending the DPO review.
 */
export function vendorAutoReplyEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_VENDOR_AUTOREPLY_V1;
  return v === 'true' || v === '1' || v === 'TRUE';
}
