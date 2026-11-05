import { labCaleIceDressConfig, labCaleIceRolePalette } from '@/app/dev/maker-lab/guest/lab-sample';
import type { GuestRole } from '@/lib/guests';

/**
 * 👤 THE ME LAB'S FOUR PEOPLE (owner 2026-10-19, cale-ice's Invitation › Me for the groom's mother): a woman parent
 * ("Atty. (Woman)", as the real row reads — attire neutral), a man parent ("Mr."), a parent whose title says neither and
 * no woman / man was picked, and a plain guest. No database: every fact is here.
 */
export type LabPerson = {
  key: 'woman' | 'man' | 'unknown' | 'guest';
  label: string;
  role: GuestRole;
  name_prefix: string | null;
  display_name: string;
  gender: 'woman' | 'man' | null;
  attire: 'gown' | 'suit' | 'neutral' | null;
};

export const LAB_PEOPLE: readonly LabPerson[] = [
  { key: 'woman', label: 'Woman parent', role: 'groom_parents', name_prefix: 'Atty.', display_name: 'Eufrocina M. Sacdalan-Casasola', gender: 'woman', attire: 'neutral' },
  { key: 'man', label: 'Man parent', role: 'groom_parents', name_prefix: 'Mr.', display_name: 'Manuel Casasola', gender: 'man', attire: 'neutral' },
  { key: 'unknown', label: 'Unknown parent', role: 'groom_parents', name_prefix: 'Atty.', display_name: 'Lee Cruz', gender: null, attire: 'neutral' },
  { key: 'guest', label: 'Plain guest', role: 'guest', name_prefix: 'Ms.', display_name: 'Ana Reyes', gender: 'woman', attire: null },
];

/** The doors' time — the run of show's first block, as the programme formats it. */
export const LAB_DOORS = '2:30 PM';

/** cale-ice's dress code after the owner's Apply, with VIP · Immediate Family called at 8:00 AM (as production holds it). */
export function labMeDressConfig() {
  const base = labCaleIceDressConfig(true) as unknown as { groups: Record<string, Record<string, unknown>> } & Record<string, unknown>;
  return { ...base, groups: { ...base.groups, vip_family: { ...base.groups.vip_family, callTime: '08:00' } } };
}

export const labMeRolePalette = () => labCaleIceRolePalette(true);

/** 🧍 The proxy lab's dress code (`?proxy=1`): cale-ice after Apply, with the Principal Sponsors called at 1:30 PM. */
export function labProxyDressConfig() {
  const base = labCaleIceDressConfig(true) as unknown as { groups: Record<string, Record<string, unknown>> } & Record<string, unknown>;
  return { ...base, groups: { ...base.groups, principal_sponsors: { ...base.groups.principal_sponsors, callTime: '13:30' } } };
}
