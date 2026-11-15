import { PageMasthead } from '@/app/_components/page-masthead';
import { TemplateFail, TemplateRow, TemplateRows, TemplateSection } from '@/app/_components/template-rows';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { TestResendButton } from '@/app/admin/integrations/_components/test-resend-button';
import { NotificationsSurface } from '@/app/admin/settings/_surfaces/notifications-surface';
import { AvatarScreen, SettingRow, SettingValue } from '../_components/avatar-screen';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Email delivery · Admin' };

/**
 * /admin/email-delivery — EMAIL DELIVERY, under the avatar (owner go 14 Nov 2026; the approved drawing is
 * `Setnayan-specs/prototypes/admin_five_tabs_2026-11-13/admin.html` `page('email-delivery' …)`).
 *
 * Moved here, nothing dropped:
 *   · the Settings studio's Notifications tab (`/admin/settings?tab=notifications`, earlier `/admin/notifications`) —
 *     the delivery log, the morning digest beside its last send, push on this device, the bell (`NotificationsSurface`);
 *   · the Resend card's FACTS from Integrations — key source, from address, last tested — and its "Send a test email".
 *     The key itself is still set and cleared on Integrations (`saveResendConfig` / `clearResendKey`): one writer.
 *
 * 🔒 NO SECRET VALUE. The Resend key is read as a presence boolean and nothing else, exactly as Integrations reads it.
 */
export default async function AdminEmailDeliveryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const error = typeof sp.error === 'string' ? sp.error : undefined;

  const admin = createAdminClient();
  const [secretRes, settingsRes] = await Promise.all([
    admin.from('platform_integration_secrets').select('resend_api_key_enc, last_verified_at').eq('id', 1).maybeSingle(),
    admin.from('platform_settings').select('resend_from_address').eq('id', 1).maybeSingle(),
  ]);
  if (secretRes.error) logQueryError('admin/email-delivery: resend key presence', secretRes.error);
  if (settingsRes.error) logQueryError('admin/email-delivery: from address', settingsRes.error);
  const keyUnread = Boolean(secretRes.error);

  // Booleans only — the ciphertext never leaves this line.
  const dbHasKey = Boolean(secretRes.data?.resend_api_key_enc);
  const envHasKey = Boolean(process.env.RESEND_API_KEY);
  const lastVerifiedAt = (secretRes.data?.last_verified_at as string | null | undefined) ?? null;
  const fromAddress =
    (settingsRes.data?.resend_from_address as string | null | undefined) ??
    process.env.RESEND_FROM_ADDRESS ??
    process.env.RESEND_FROM_EMAIL ??
    '';
  const source = keyUnread ? null : dbHasKey ? 'Saved here (database)' : envHasKey ? 'Environment variable (Vercel)' : 'Not configured';
  const off = !keyUnread && !dbHasKey && !envHasKey;

  return (
    <AvatarScreen data="email-delivery">
      <PageMasthead title="Email delivery" />

      {off ? (
        <TemplateFail data="email-off">
          <b>Email is switched off.</b> No Resend key is set, so nothing is being sent.
        </TemplateFail>
      ) : null}

      <TemplateSection
        first
        label="Resend"
        tip="Transactional email — every notification email, receipt and reminder. The key is write-only: it is set or cleared on Integrations and never shown back."
      >
        <TemplateRows>
          <SettingRow data="resend-source" name="Key source" right={<SettingValue>{source}</SettingValue>} />
          <SettingRow
            data="resend-from"
            name="From address"
            right={<SettingValue muted={!fromAddress && !settingsRes.error}>{settingsRes.error ? null : fromAddress || '— not set —'}</SettingValue>}
          />
          <SettingRow
            data="resend-tested"
            name="Last tested"
            right={
              <SettingValue muted={!lastVerifiedAt}>
                {keyUnread
                  ? null
                  : lastVerifiedAt
                    ? new Date(lastVerifiedAt).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })
                    : 'Not yet'}
              </SettingValue>
            }
          />
          <li className="py-2.5">
            <TestResendButton />
          </li>
          <TemplateRow title={off ? 'Set the Resend key' : 'Resend key'} line="Integrations › Resend — replace or clear the saved key" href="/admin/integrations" edge={off ? 'late' : undefined} data="resend-key" />
        </TemplateRows>
      </TemplateSection>

      <NotificationsSurface error={error} />
    </AvatarScreen>
  );
}
