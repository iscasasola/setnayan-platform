import { PROPOSAL_STATUS_LABEL, type ProposalStatus } from '@/lib/vendor-proposals';

/**
 * 🤝 "Decisions" on Details (v113 `dec`) — Build 1 is a DOOR, not the list (controller 2026-11-08: one batched read per
 * screen, the fewest requests). The decisions themselves (quotes · meetings · adjustments · logged payments · guest
 * counts) already live in the client's Chat page; the row says ONE true thing from the quote read Details already makes
 * and opens Chat. Assembling the list on Details is Build 2.
 *
 * Honest words: a refused quote read says so — never "No quote yet" for a read that failed.
 */
export function decisionsLine(
  quote: { status: ProposalStatus; totalPhp: number } | null | undefined,
  failed: boolean,
  peso: (php: number) => string,
): string {
  if (failed) return 'Couldn’t load your quote';
  if (!quote) return 'No quote sent yet';
  return `Quote · ${peso(quote.totalPhp)} · ${PROPOSAL_STATUS_LABEL[quote.status]}`;
}
