/**
 * Admin · Switches · Demo mode — the rows the approved drawing draws under Switches › Admins
 * (`Setnayan-specs/prototypes/admin_five_tabs_2026-11-13/admin.html` `page('switches' …)`, owner go 14 Nov 2026).
 *
 * It was the Settings studio's Demo mode tab (`/admin/settings?tab=demo-mode`, and before that
 * `/admin/settings/demo-mode`); both old addresses now forward to `/admin/switches#demo-mode`. Nothing was dropped:
 *   - the state (ON / OFF) from the cookie, for this admin session;
 *   - the ONE toggle, still a POST to /api/admin/demo-mode/toggle — now behind the confirm that names who it reaches;
 *   - "Last toggled … by … — set to …" from admin_audit_log, so the audit trail shows without leaving the page;
 *   - the quick links (the marketplace with/without demo, Manage demo suppliers), the "never bookable" rule and the
 *     ?demo=1 / ?demo=0 shortcut — the explanations now sit behind their ⓘ (T17).
 * The sample event at /sample moved to Switches › Couples (it changes what strangers see, not this session).
 *
 * Admin-only (the `/admin/*` layout gates the whole tree; `requireAdmin` re-asserts it here).
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { DEMO_MODE_COOKIE_NAME, isAdminProfile } from '@/lib/demo-mode';
import { TemplateRow } from '@/app/_components/template-rows';
import { ConfirmButton } from '@/app/admin/_components/avatar-confirm';
import { ConfirmLines, SettingRow } from '@/app/admin/_components/avatar-screen';

import { requireAdmin } from '@/lib/admin/require-admin';
import { logQueryError } from '@/lib/supabase/error-detect';

export async function DemoModeSurface({ toggled }: { toggled?: string }) {
  await requireAdmin();
  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath('/admin/switches'));

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('users')
    .select('display_name, email, account_type, is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();

  // The /admin layout already gates on admin status with notFound(); this is
  // defense in depth for a request that reaches here before the layout resolves.
  if (!isAdminProfile(profile)) redirect('/');

  const cookieStore = await cookies();
  const isOn = cookieStore.get(DEMO_MODE_COOKIE_NAME)?.value === '1';

  // The most-recent demo_mode_* row from admin_audit_log, so the row reads as an
  // audit surface, not just a toggle. A refused read says so — never "never toggled".
  const admin = createAdminClient();
  const { data: auditRows, error: auditErr } = await admin
    .from('admin_audit_log')
    .select('action, actor_user_id, created_at, after_json')
    .in('action', ['demo_mode_enabled', 'demo_mode_disabled'])
    .order('created_at', { ascending: false })
    .limit(1);
  if (auditErr) logQueryError('admin.switches.demoModeLastToggle', auditErr);
  const lastToggle = auditRows?.[0] ?? null;

  let lastToggleActorLabel: string | null = null;
  if (lastToggle?.actor_user_id) {
    const { data: actor } = await admin
      .from('users')
      .select('display_name, email')
      .eq('user_id', lastToggle.actor_user_id)
      .maybeSingle();
    lastToggleActorLabel = actor?.display_name ?? actor?.email ?? lastToggle.actor_user_id;
  }

  const justToggled = toggled === 'on' || toggled === 'off';
  const line = justToggled
    ? `Demo mode is now ${toggled === 'on' ? 'ON' : 'OFF'}. The cookie is set for the current admin session.`
    : auditErr
      ? 'Couldn’t read when it was last toggled.'
      : lastToggle
        ? `Last toggled ${new Date(lastToggle.created_at).toLocaleString('en-PH', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: 'Asia/Manila',
          })} by ${lastToggleActorLabel ?? 'admin'} — set to ${lastToggle.action === 'demo_mode_enabled' ? 'on' : 'off'}`
        : 'Demo mode has not been toggled before. The audit log will start tracking transitions from the first toggle.';

  return (
    <>
      <SettingRow
        id="demo-mode"
        data="demo-mode"
        name="Demo mode"
        tip={
          <>
            Suppliers marked is_demo = TRUE show to everyone, marked (DEMO ONLY). When demo mode is on, they also display
            their pricing publicly. Real supplier visibility (the 2026-05-16 hide-prices lock) is unchanged. Admins only —
            non-admin sessions silently ignore the flag. Shortcut: append ?demo=1 to any URL to enable it (admin session
            required); ?demo=0 clears it.
          </>
        }
        line={<span role="status">{line}</span>}
        right={
          <ConfirmButton
            action="/api/admin/demo-mode/toggle"
            fields={{ state: isOn ? 'off' : 'on' }}
            tone={isOn ? 'neutral' : 'brand'}
            icon={isOn ? 'pause' : 'play'}
            label={isOn ? 'Turn demo mode OFF' : 'Turn demo mode ON'}
            title={isOn ? 'Turn demo mode OFF' : 'Turn demo mode ON'}
            confirmLabel={isOn ? 'Turn OFF' : 'Turn ON'}
            body={
              <ConfirmLines
                what={
                  isOn
                    ? ['Demo suppliers stop displaying their pricing in this session']
                    : ['Demo suppliers display their pricing', 'Overview, Growth, Intelligence and Visits show demo data']
                }
                not={['Real supplier visibility is unchanged (the 2026-05-16 hide-prices lock)']}
                who="You, in this admin session · written to the Admin log"
              />
            }
            data="demo-mode"
          />
        }
      />
      <TemplateRow
        title={`View /vendors ${isOn ? '(demo suppliers visible)' : '(without demo)'}`}
        line="The marketplace as a visitor sees it now"
        href="/?browse=1"
        data="demo-view-vendors"
      />
      <TemplateRow
        title="Manage demo suppliers"
        line="Public, never bookable — a real event can never book, pay or message a demo shop"
        href="/admin/demo-vendors"
        data="demo-manage"
      />
    </>
  );
}
