import type { RoleGroup } from './role-groups';

export type RolePalette = Partial<Record<RoleGroup, string>>;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

export function sanitizeRolePalette(raw: unknown): RolePalette {
  if (typeof raw !== 'object' || raw === null) return {};
  const out: RolePalette = {};
  const allowedKeys: ReadonlyArray<RoleGroup> = [
    'wedding_party',
    'principal_sponsors',
    'secondary_sponsors',
    'bearers_flower_girl',
    'officiants',
    'other_roles',
  ];
  for (const key of allowedKeys) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && HEX_RE.test(v)) {
      out[key] = v.toUpperCase();
    }
  }
  return out;
}

export const DEFAULT_ROLE_PALETTE_SUGGESTIONS: Record<RoleGroup, string> = {
  wedding_party: '#C97B4B',
  principal_sponsors: '#7C3AED',
  secondary_sponsors: '#D97706',
  bearers_flower_girl: '#059669',
  officiants: '#0284C7',
  other_roles: '#525252',
};
