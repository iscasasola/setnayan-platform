/**
 * 🏅 THE SHARED AWARD UI KIT (supplier badges, seals and rewards — controller build map 2026-11-15, slice K).
 * Client-only, on the device: no fetch, no server write, zero server cost. Each view opens on a tap — mount it to
 * open it, and its `onClose` unmounts it. The story recorder is lazy (`StoryVideo`), fetched only when tapped.
 */
export { BadgeFullscreen, type BadgeFullscreenProps, type AwardTier } from './badge-fullscreen';
export { RewardTicket, TICKET_COPY, type RewardTicketProps, type RewardTicketState } from './reward-ticket';
export { SealPlaque, type SealPlaqueProps } from './seal-plaque';
export { StoryVideo, type StoryVideoProps, type StoryInput } from './story-video';
export { TICKET_SPECS, type TicketKind, type TicketSpec } from './ticket-svg';
export { AWARD_TONES, SEAL_TONE, toneForTier } from './shared';
export { badgeStack, plaqueScale } from './fit';
// the No. 1 art (~150 KB) is never re-exported statically: `loadNo1Seal` fetches it by import() on a tap
export { loadNo1Seal } from './no1-seal';
export { AWARD_COPY, SEAL_KINDS, achievedAfterLine, sealPlaqueCopy, type SealCopy, type SealKind } from './award-copy';
export { AwardClose, type AwardCloseProps } from './award-close';
export { VerifiedFullscreen, VERIFIED_COPY, type VerifiedFullscreenProps } from './verified-fullscreen';
export { LockedTile, LOCKED_HOW, bronzeAtLine, type LockedGroup, type LockedTileProps } from './locked-tile';
export { CardBadgeCongrats, CARD_CONGRATS_COPY, cardCongratsTodayLine, type CardBadgeCongratsProps } from './card-badge-congrats';
export { CardBadgeRules, CARD_RULES_COPY, type CardBadgeRuleRow, type CardBadgeRulesProps } from './card-badge-rules';
