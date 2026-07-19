/**
 * Relationship Workspace feature flag.
 *
 * When enabled, the vendor↔couple surfaces render the unified, chat-first
 * TABBED shell (Chat · Quote · Payments · Files · Call · Details) instead of the
 * current long-scroll workspace / clients pages. See
 * Relationship_Workspace_and_Appointments_2026-07-11.md.
 *
 * NEXT_PUBLIC_ so both the server page (which builds the tab slots) and the
 * client shell agree on a single value. Off by default — the live long-scroll
 * pages are untouched until the owner sets
 * NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED=true.
 */
export function isRelationshipWorkspaceEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_RELATIONSHIP_WORKSPACE_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}
