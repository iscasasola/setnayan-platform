/**
 * The anonymous-tier capability object (OPEN-BROWSE PR7 — council verdict
 * 2026-07-22 §1.2, the "structural PII guarantee, made real" graft).
 *
 * The council's hard requirement: the anonymous (cookie-less) render path is
 * built from a CAPABILITY OBJECT whose construction never touches guest data,
 * rather than from an inline `PUBLIC_WIDGET_ALLOWLIST.includes(...)` scattered
 * through the renderer. The exported {@link PUBLIC_WIDGET_ALLOWLIST} constant
 * stays the firewall (unit-tested to never contain a guest-personal type);
 * THIS module is the single place that *uses* it, so there is one auditable
 * boundary instead of N call-sites.
 *
 * A capability is a pure decision over widget TYPE + audience dial — never a
 * function of any `guests`-table row. Types erase at runtime, so this
 * object + the CI zero-guest-bytes render check (not a type annotation) is the
 * real RA 10173 control (council §1.2, §6).
 */
import { PUBLIC_WIDGET_ALLOWLIST } from './public-widget-allowlist';
import {
  openBrowseWidgetVisibleTo,
  type InvitationWidgetRow,
  type WidgetType,
} from './invitation-widgets';

/**
 * What an anonymous visitor is permitted to see. Constructed from the
 * allow-list firewall alone — no guest input, by design.
 */
export type PublicCapability = {
  /** The firewall: only these hideable widget types may render anonymously.
   *  Every one carries event-level data only (no per-guest fields). */
  readonly allowedWidgetTypes: ReadonlySet<WidgetType>;
  /** Whether a widget TYPE clears the firewall (the allow-list membership
   *  test, named). Always-on + guest-personal types return false. */
  canRenderType(type: WidgetType): boolean;
  /** Whether a concrete widget ROW may render for the anonymous tier — the
   *  type firewall ANDed with the open-browse `mode`/`audience` reconciliation
   *  ({@link openBrowseWidgetVisibleTo} with identity `'anonymous'`). This is
   *  the one predicate the open-browse anonymous widget list is filtered by. */
  canRenderWidget(row: InvitationWidgetRow): boolean;
};

/**
 * Build the anonymous capability. Deliberately argument-free of any guest
 * context: the firewall is the same for every anonymous visitor of every
 * event. Memoized as a module singleton would also be valid, but a factory
 * keeps it trivially testable and side-effect-free.
 */
export function anonymousPublicCapability(): PublicCapability {
  const allowedWidgetTypes: ReadonlySet<WidgetType> = new Set(PUBLIC_WIDGET_ALLOWLIST);
  const canRenderType = (type: WidgetType): boolean => allowedWidgetTypes.has(type);
  return {
    allowedWidgetTypes,
    canRenderType,
    canRenderWidget(row: InvitationWidgetRow): boolean {
      return canRenderType(row.widget_type) && openBrowseWidgetVisibleTo(row, 'anonymous');
    },
  };
}
