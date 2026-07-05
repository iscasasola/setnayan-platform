'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Admin Compliance — server actions.
//
// The singleton platform_compliance_facts row (id = 1) holds the RA 10173 / NPC
// registration facts, including the SENSITIVE identifiers (BIR TIN, registered
// address, DPO phone) that the owner enters here at runtime — they never live in
// the repo. Writes are service-role (createAdminClient) because the table is
// admin-only RLS; requireAdmin() is the app-level gate (team-member-aware,
// mirroring the /admin/integrations pattern — NOT the SQL is_admin() helper,
// which only checks account_type='admin' and would lock out team-member admins).

export type SaveResult = { ok: true } | { ok: false; error: string };

/** A single sub-processor entry as stored in the sub_processors JSONB array. */
export type SubProcessor = {
  name: string;
  role: string;
  jurisdiction: string;
  personal_data: boolean;
  dpa_on_file: boolean;
};

/** The editable shape the client form posts to saveComplianceFacts. */
export type ComplianceFactsInput = {
  legal_name: string;
  proprietor: string;
  dti_bn: string;
  bir_tin: string;
  registered_address: string;
  npc_registration_no: string;
  dpo_name: string;
  dpo_title: string;
  dpo_email: string;
  dpo_phone: string;
  dpo_employment_basis: string;
  dpo_designation_date: string; // '' → NULL
  headcount: string; // numeric string; '' → NULL
  staff_with_data_access: string; // numeric string; '' → NULL
  breach_team: string;
  breach_contacts: string;
  sub_processors: SubProcessor[];
  sensitive_rsvp_fields: string;
  automated_decisions: string;
  maya_status: string;
  staff_controls: string;
  dpia_adoption_dates: string;
};

async function requireAdmin(): Promise<{ userId: string } | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    return null;
  }
  return { userId: user.id };
}

/** '' / whitespace → null; otherwise trimmed string. */
function textOrNull(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Numeric string → integer, else null (invalid or blank both clear the field). */
function intOrNull(v: unknown): number | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const n = Number.parseInt(v.trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** YYYY-MM-DD (from <input type="date">) → the same string, else null. */
function dateOrNull(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) ? v.trim() : null;
}

/** Coerce the posted sub-processor rows into the stored JSONB shape, dropping
 *  fully-empty rows (a row with no name AND no role is treated as blank). */
function normalizeSubProcessors(rows: unknown): SubProcessor[] {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      return {
        name: typeof o.name === 'string' ? o.name.trim() : '',
        role: typeof o.role === 'string' ? o.role.trim() : '',
        jurisdiction:
          typeof o.jurisdiction === 'string' ? o.jurisdiction.trim() : '',
        personal_data: o.personal_data === true,
        dpa_on_file: o.dpa_on_file === true,
      };
    })
    .filter((r) => r.name.length > 0 || r.role.length > 0);
}

export async function saveComplianceFacts(
  input: ComplianceFactsInput,
): Promise<SaveResult> {
  const admin = await requireAdmin();
  if (!admin) return { ok: false, error: 'Forbidden — admin access required.' };

  const db = createAdminClient();
  const { error } = await db.from('platform_compliance_facts').upsert(
    {
      id: 1,
      legal_name: textOrNull(input.legal_name),
      proprietor: textOrNull(input.proprietor),
      dti_bn: textOrNull(input.dti_bn),
      bir_tin: textOrNull(input.bir_tin),
      registered_address: textOrNull(input.registered_address),
      npc_registration_no: textOrNull(input.npc_registration_no),
      dpo_name: textOrNull(input.dpo_name),
      dpo_title: textOrNull(input.dpo_title),
      dpo_email: textOrNull(input.dpo_email),
      dpo_phone: textOrNull(input.dpo_phone),
      dpo_employment_basis: textOrNull(input.dpo_employment_basis),
      dpo_designation_date: dateOrNull(input.dpo_designation_date),
      headcount: intOrNull(input.headcount),
      staff_with_data_access: intOrNull(input.staff_with_data_access),
      breach_team: textOrNull(input.breach_team),
      breach_contacts: textOrNull(input.breach_contacts),
      sub_processors: normalizeSubProcessors(input.sub_processors),
      sensitive_rsvp_fields: textOrNull(input.sensitive_rsvp_fields),
      automated_decisions: textOrNull(input.automated_decisions),
      maya_status: textOrNull(input.maya_status),
      staff_controls: textOrNull(input.staff_controls),
      dpia_adoption_dates: textOrNull(input.dpia_adoption_dates),
      updated_at: new Date().toISOString(),
      updated_by: admin.userId,
    },
    { onConflict: 'id' },
  );

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath('/admin/compliance');
  revalidatePath('/admin/compliance/data-sheet');
  return { ok: true };
}
