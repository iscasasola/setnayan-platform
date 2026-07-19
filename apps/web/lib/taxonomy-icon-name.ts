/**
 * Pure validation for a taxonomy node's Lucide icon override
 * (service_categories.icon_name). Kept in its own client-safe module — no
 * 'use server', no Next imports — so the admin server action AND the unit test
 * can both import it. The allowlist SSOT is the nav-registry curated Lucide set
 * (lib/nav-icons.ts), the same one the /admin/menus icon picker uses.
 */
import { getLucideIcon } from './nav-icons';

/**
 * Normalize a raw icon-name input:
 *   - ''            → a deliberate CLEAR (fall back to the code default)
 *   - a valid name  → the trimmed name (on the Lucide allowlist)
 *   - null          → REJECT (off the allowlist; caller must error, not store)
 */
export function normalizeIconName(raw: string): '' | string | null {
  const name = raw.trim();
  if (!name) return '';
  return getLucideIcon(name) ? name : null;
}
