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
export { no1Seal, no1SealSvg } from './no1-seal-svg';
export { AWARD_COPY, SEAL_KINDS, sealPlaqueCopy, type SealCopy, type SealKind } from './award-copy';
