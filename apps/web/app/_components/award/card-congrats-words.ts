/**
 * 🎗 The Today line that opens the service-card congratulations, verbatim (badge-milestones_v86.html `.sctl`):
 * "Congratulations, your [card] service card earned [badge]". A plain module — not `'use client'` — so the server
 * sweep that sends the line (lib/card-badges.server.ts) and the client congratulations share ONE copy.
 */
export function cardCongratsTodayLine(cardName: string, badgeName: string): string {
  return `Congratulations, your ${cardName} service card earned ${badgeName}`;
}
