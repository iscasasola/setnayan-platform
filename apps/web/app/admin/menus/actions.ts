'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, r2Upload } from '@/lib/r2';
import { NAV_REGISTRY_TAG } from '@/lib/nav-registry';
import { NAV_ICON_NAMES } from '@/lib/nav-icons';
import { NAV_SLOT_DEFAULTS } from '@/lib/nav-registry-defaults';

/**
 * /admin/menus server actions — single-admin writes to public.nav_slot_override
 * (governance: single-admin + audit, owner 2026-06-16). Every mutation is
 * guarded by requireAdmin, validated against the code defaults / curated icon
 * set, audit-logged, and revalidates the NAV_REGISTRY_TAG so the resolver cache
 * refreshes everywhere the nav is rendered.
 */

const KNOWN_KEYS = new Set(NAV_SLOT_DEFAULTS.map((d) => d.key));
const KNOWN_ICONS = new Set(NAV_ICON_NAMES);

const UPLOAD_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
const MAX_ICON_BYTES = 512 * 1024;

// Dangerous SVG constructs — scripts, event handlers, embedded HTML, external
// fetches, XXE. SVG rendered via <img> doesn't execute these, but an uploaded
// file is also reachable by direct URL, so we reject unsafe markup at upload
// (defense in depth; admin-only path).
const UNSAFE_SVG = [
  /<\s*script/i,
  /<\s*foreignObject/i,
  /\son\w+\s*=/i, // onload=, onclick=, …
  /javascript:/i,
  /<!DOCTYPE/i,
  /<!ENTITY/i,
  /<\s*(iframe|embed|object|audio|video|animate|set)\b/i,
  /(?:href|xlink:href|src)\s*=\s*["']?\s*(?:https?:|\/\/|data:text\/html)/i,
];

function assertSafeSvg(svgText: string) {
  if (svgText.length > MAX_ICON_BYTES) throw new Error('SVG too large');
  if (!/<svg[\s>]/i.test(svgText)) throw new Error('File is not a valid SVG');
  for (const re of UNSAFE_SVG) {
    if (re.test(svgText)) {
      throw new Error('SVG contains scripts or external references and was rejected');
    }
  }
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member, account_type')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!(me?.is_internal || me?.is_team_member || me?.account_type === 'admin')) {
    throw new Error('Forbidden');
  }
  return user;
}

function assertKnownSlot(slotKey: string) {
  if (!KNOWN_KEYS.has(slotKey)) throw new Error(`Unknown nav slot: ${slotKey}`);
}

function revalidateRegistry() {
  revalidateTag(NAV_REGISTRY_TAG);
  revalidatePath('/admin/menus');
}

type AdminDb = ReturnType<typeof createAdminClient>;

async function audit(
  admin: AdminDb,
  userId: string,
  action: string,
  slotKey: string,
  after: Record<string, unknown>,
) {
  await admin.from('admin_audit_log').insert({
    action,
    target_table: 'nav_slot_override',
    target_id: slotKey,
    after_json: after,
    actor_user_id: userId,
  });
}

/** Rename a slot (blank ⇒ revert to the code-default label). */
export async function setSlotLabel(slotKey: string, labelRaw: string) {
  const user = await requireAdmin();
  assertKnownSlot(slotKey);
  const label = labelRaw.trim();
  const admin = createAdminClient();
  await admin.from('nav_slot_override').upsert(
    {
      slot_key: slotKey,
      label: label.length ? label : null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key' },
  );
  await audit(admin, user.id, 'nav.set_label', slotKey, { label: label || null });
  revalidateRegistry();
}

/** Set the slot's icon to an allowlisted Lucide glyph. */
export async function setSlotLucideIcon(slotKey: string, lucideName: string) {
  const user = await requireAdmin();
  assertKnownSlot(slotKey);
  if (!KNOWN_ICONS.has(lucideName)) throw new Error(`Unknown icon: ${lucideName}`);
  const admin = createAdminClient();
  await admin.from('nav_slot_override').upsert(
    {
      slot_key: slotKey,
      icon_kind: 'lucide',
      lucide_name: lucideName,
      custom_url: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key' },
  );
  await audit(admin, user.id, 'nav.set_icon_lucide', slotKey, { lucide_name: lucideName });
  revalidateRegistry();
}

/** Set the slot to show no glyph (label-only). */
export async function setSlotNoIcon(slotKey: string) {
  const user = await requireAdmin();
  assertKnownSlot(slotKey);
  const admin = createAdminClient();
  await admin.from('nav_slot_override').upsert(
    {
      slot_key: slotKey,
      icon_kind: 'none',
      lucide_name: null,
      custom_url: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key' },
  );
  await audit(admin, user.id, 'nav.set_icon_none', slotKey, {});
  revalidateRegistry();
}

/** Show/hide a slot without a code change. */
export async function setSlotHidden(slotKey: string, hidden: boolean) {
  const user = await requireAdmin();
  assertKnownSlot(slotKey);
  const admin = createAdminClient();
  await admin.from('nav_slot_override').upsert(
    {
      slot_key: slotKey,
      is_hidden: hidden,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key' },
  );
  await audit(admin, user.id, 'nav.set_hidden', slotKey, { is_hidden: hidden });
  revalidateRegistry();
}

/** Clear all overrides for a slot → back to the code default. */
export async function resetSlot(slotKey: string) {
  const user = await requireAdmin();
  assertKnownSlot(slotKey);
  const admin = createAdminClient();
  await admin.from('nav_slot_override').delete().eq('slot_key', slotKey);
  await audit(admin, user.id, 'nav.reset', slotKey, {});
  revalidateRegistry();
}

/** Upload a custom icon image (SVG/PNG/JPEG/WebP) → R2 → set as the slot icon. */
export async function uploadSlotIcon(formData: FormData) {
  const user = await requireAdmin();
  const slotKey = String(formData.get('slot_key') || '');
  assertKnownSlot(slotKey);

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) throw new Error('No file uploaded');
  const ext = UPLOAD_EXT[file.type];
  if (!ext) throw new Error('Unsupported file type — use SVG, PNG, JPEG, or WebP');
  if (file.size > MAX_ICON_BYTES) throw new Error('Icon too large (max 512 KB)');

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (ext === 'svg') assertSafeSvg(new TextDecoder().decode(bytes));
  const safe = slotKey.replace(/[^a-z0-9._-]/gi, '_');
  const key = `nav-icons/${safe}-${randomUUID()}.${ext}`;
  const url = await r2Upload({ bucket: R2_BUCKETS.media, key, body: bytes, contentType: file.type });

  const admin = createAdminClient();
  await admin.from('nav_slot_override').upsert(
    {
      slot_key: slotKey,
      icon_kind: 'custom',
      custom_url: url,
      lucide_name: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'slot_key' },
  );
  await audit(admin, user.id, 'nav.set_icon_custom', slotKey, { custom_url: url });
  revalidateRegistry();
}
