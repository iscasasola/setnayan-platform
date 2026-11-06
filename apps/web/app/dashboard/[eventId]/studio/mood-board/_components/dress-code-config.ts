import { isDressableRole, sanitizeSecondPicks } from '@/lib/attire-rows';
import { sanitizeRoleAttire } from '@/lib/role-dress-code';
import { sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import type { RoleNames } from '@/lib/role-names';
import { roleLabel } from '@/lib/entourage';
import type { GuestRole } from '@/lib/guests';
import type { DressCodeConfig } from '../dress-code-actions';

/**
 * ⚡ THE DRESS CODE'S PLAIN READERS — no component, no `'use client'` import (2026-10-21, Maker headroom).
 *
 * `foldEventRoles` and `normalizeDressCodeConfig` lived in `dress-code-fields.tsx`, beside the form body. The
 * Maker's server files (`website/editor/page.tsx`, `mood-board-editor.tsx`) import them, and Next puts EVERY
 * `'use client'` module a route's server files import into that route's first load — so importing the two
 * readers dragged the whole dress-code form (`GroupAttireField` · `RoleAttireField` and the attire tables,
 * ~8.6KB gz) into the Maker's first load, although the form draws only when the Dress code row opens.
 * Server files import from HERE; `dress-code-fields.tsx` re-exports both for everything else.
 * 🛡 `launch/_components/details-pieces-are-lazy.test.ts` test 4.
 */

/**
 * The roles on a guest list, counted and labelled, for "What each role wears"
 * — the fold the Dress code page does inline, for the Maker's Dress code scene
 * (owner 2026-09-30: the couple sets each role's outfit where they are). Only
 * roles the invitation names are offered; a plain guest is not a role.
 */
export function foldEventRoles(
  rows: ReadonlyArray<{ role: string | null }>,
  /** `events.role_names` — the couple's words for roles (#6170). Omitted → the usual words. */
  names?: RoleNames | null,
): { role: GuestRole; label: string; count: number }[] {
  const counts = new Map<GuestRole, number>();
  for (const { role } of rows) {
    if (!role || role === 'guest') continue;
    if (roleLabel(role as GuestRole) === null) continue;
    counts.set(role as GuestRole, (counts.get(role as GuestRole) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([role, count]) => ({ role, label: roleLabel(role, names) as string, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The one parser for the `events.dress_code_config` JSONB shape — shared by the
 * page and the editor panel so they can never disagree about a malformed row.
 * Moved here from the page in PR-8 (was private there).
 */
export function normalizeDressCodeConfig(raw: unknown): DressCodeConfig {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    title: typeof obj.title === 'string' ? obj.title : '',
    description: typeof obj.description === 'string' ? obj.description : '',
    dos: Array.isArray(obj.dos)
      ? obj.dos.filter((v): v is string => typeof v === 'string')
      : [],
    donts: Array.isArray(obj.donts)
      ? obj.donts.filter((v): v is string => typeof v === 'string')
      : [],
    // Per-role attire (owner 2026-09-20). Only PUBLISHED roles may carry an
    // instruction — `roleLabel` returning null means the role is not one the
    // invitation names, so an instruction for it could never be shown.
    roles: sanitizeRoleAttire(obj.roles, isDressableRole),
    // Per-GROUP attire. `sanitizeGroupAttire` drops any key that is not one of
    // the twelve, so a group retired in a later build stops being offered and
    // stops being read on the same deploy.
    groups: sanitizeGroupAttire(obj.groups),
    // 👗 Only an explicit `false` turns the outfit figure off (owner 2026-09-30).
    show_figure: obj.show_figure !== false,
    // 👗 THE SECOND PICKS — the women's and the girls' Wear and colours (2026-10-14). This parser feeds Studio › Mood
    // Board & Dress Code (`MoodBoardStudioBody` → `studio.dressConfig`); it used to drop them, so on every reload the
    // Studio drew the women as the men's shared Wear read per column ("Not said yet") and its next save wrote the
    // config back WITHOUT them (2026-10-17, "the website does not reflect what is picked").
    ...(() => {
      const women = sanitizeSecondPicks(obj.women);
      return Object.keys(women).length > 0 ? { women } : {};
    })(),
    palette: Array.isArray(obj.palette)
      ? obj.palette
          .map((row) => {
            if (!row || typeof row !== 'object') return null;
            const r = row as Record<string, unknown>;
            const name = typeof r.name === 'string' ? r.name : '';
            const hex = typeof r.hex === 'string' ? r.hex : '';
            if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
            return { name, hex };
          })
          .filter((row): row is { name: string; hex: string } => row !== null)
      : [],
  };
}
