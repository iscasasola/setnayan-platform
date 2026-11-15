import { PageMasthead } from '@/app/_components/page-masthead';
import { TemplateFail, TemplateRow, TemplateRows, TemplateSection } from '@/app/_components/template-rows';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { envFlagEnabled } from '@/lib/env-flag';
import { packageCreditEnabled } from '@/lib/package-credit-flag';
import { liveStudioRoamEnabled } from '@/lib/live-studio-roam';
import { DEFAULT_VENDOR_VALIDATE_EMAIL } from '@/lib/platform-settings';
import { setAiPaywall } from '@/app/admin/integrations/actions';
import { setReferralProgramEnabled } from '@/app/admin/referrals/actions';
import { SampleEventSwitch } from '@/app/admin/settings/_components/sample-event-switch';
import { DemoModeSurface } from '@/app/admin/settings/_surfaces/demo-mode-surface';
import { AvatarScreen, ConfirmLines, SettingRow, SettingValue } from '../_components/avatar-screen';
import { ConfirmButton, ConfirmPick } from '../_components/avatar-confirm';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Switches · Admin' };

/**
 * /admin/switches — SWITCHES, under the avatar (owner go 14 Nov 2026: *"Yes, queue the builds"*; the approved drawing is
 * `Setnayan-specs/prototypes/admin_five_tabs_2026-11-13/admin.html` `page('switches' …)`).
 *
 * Every for-everyone setting in one place. Each flip opens the house confirm that names who it reaches, and posts to
 * the SAME action it posted to before — nothing here is a new writer:
 *   · Setnayan AI paywall   ← the Integrations card (`setAiPaywall`); env default · on · off
 *   · Referral program      ← Studio › Referrals (`setReferralProgramEnabled`); the reward stays there
 *   · Sample at /sample     ← Settings › Demo mode (`SampleEventSwitch`, saves in place as it did)
 *   · Demo mode             ← Settings › Demo mode (POST /api/admin/demo-mode/toggle)
 *   · Morning digest        ← its switch stays beside its last send, on Email delivery (one writer on screen)
 * Read-only here, said so: the flags NO control writes today (`fee_unlocks_event_enforced`,
 * `spotlight_homepage_enabled`, `radar_enabled`, `radar_min_n_floor` — the drawing marks their writers NEW; a writer
 * for the fee lock governs money and needs the owner's one-person rule, so it is not invented here) and the env-only
 * flags (a redeploy changes those). The Supplier VALIDATE inbox + number stay with Business identity, because ONE
 * save writes them with it (`saveBusinessIdentity`).
 *
 * ⚖ A refused read of the saved settings switches every control OFF ("—", never a guessed value): a flip drawn over a
 * value nobody read could overwrite the real one.
 */

type Settings = {
  setnayan_ai_paywall_enabled?: boolean | null;
  referral_program_enabled?: boolean | null;
  referral_reward_php?: number | null;
  sample_event_enabled?: boolean | null;
  fee_unlocks_event_enforced?: boolean | null;
  spotlight_homepage_enabled?: boolean | null;
  radar_enabled?: boolean | null;
  radar_min_n_floor?: number | null;
  admin_digest_enabled?: boolean | null;
  vendor_validate_email?: string | null;
  vendor_validate_phone?: string | null;
};

const onOff = (v: boolean | null | undefined): string | null => (typeof v === 'boolean' ? (v ? 'On' : 'Off') : null);

export default async function AdminSwitchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const admin = createAdminClient();
  const { data, error } = await admin.from('platform_settings').select('*').eq('id', 1).maybeSingle();
  if (error) logQueryError('admin/switches: platform_settings', error);
  const unread = Boolean(error) || !data;
  const s = (data ?? {}) as Settings;

  // Setnayan AI paywall — tri-state (NULL = defer to env), resolved DB-first exactly as the Integrations card does.
  const paywallEnvOn = envFlagEnabled(process.env.SETNAYAN_AI_PAYWALL_ENABLED);
  const paywallDb = typeof s.setnayan_ai_paywall_enabled === 'boolean' ? s.setnayan_ai_paywall_enabled : null;
  const paywallMode = paywallDb === true ? 'on' : paywallDb === false ? 'off' : 'env';
  const paywallOn = paywallDb ?? paywallEnvOn;
  const referralOn = s.referral_program_enabled === true;
  const sampleMode = s.sample_event_enabled === true ? 'on' : s.sample_event_enabled === false ? 'off' : 'default';
  const reward = typeof s.referral_reward_php === 'number' ? `₱${s.referral_reward_php.toLocaleString('en-PH')}` : null;

  const saved = one('saved');
  const failed = one('error');

  return (
    <AvatarScreen data="switches">
      <PageMasthead title="Switches" />

      {failed ? <TemplateFail data="switches-error">{failed.slice(0, 300)}</TemplateFail> : null}
      {saved ? (
        <p role="status" data-switches-saved={saved} className="py-2 text-[14px] text-[rgb(var(--color-ok))]">
          Saved.
        </p>
      ) : null}
      {unread ? (
        <TemplateFail retryHref="/admin/switches" data="switches-unread">
          Couldn’t load the saved settings · switching is off until they load, so a flip can’t overwrite the real value
        </TemplateFail>
      ) : null}

      <TemplateSection
        first
        label="Couples"
        tip="Every switch here changes Setnayan for everyone. Each flip opens a confirm that names who it reaches and writes the Admin log where the action already did."
      >
        <TemplateRows>
          <SettingRow
            data="ai-paywall"
            name="Setnayan AI paywall"
            tip="When ON, Setnayan AI (the ranked match, % fit, proximity sort, deadlines) requires a purchased per-event unlock. When OFF, the full intelligence is free during launch. Takes effect on the next request — no redeploy."
            line={
              unread
                ? 'Couldn’t read what is saved'
                : `${paywallOn ? 'On — couples pay to unlock' : 'Off — free for everyone'} · ${
                    paywallDb === null ? `environment default (env says ${paywallEnvOn ? 'ON' : 'OFF'})` : 'set here (database)'
                  }`
            }
            below={
              <ConfirmPick
                action={setAiPaywall}
                fieldName="mode"
                fields={{ back: '/admin/switches' }}
                label="Setnayan AI paywall"
                value={paywallMode}
                disabled={unread}
                data="ai-paywall"
                choices={[
                  {
                    key: 'env',
                    label: `Use environment default (env says ${paywallEnvOn ? 'ON' : 'OFF'})`,
                    title: 'Use the environment default',
                    body: <ConfirmLines what={[`The paywall follows the Vercel env, which says ${paywallEnvOn ? 'ON' : 'OFF'}`]} who="Every active event, on its next visit" />,
                    confirmLabel: 'Use the default',
                  },
                  {
                    key: 'on',
                    label: 'On — require a purchase to unlock',
                    title: 'Require a purchase for Setnayan AI',
                    body: (
                      <ConfirmLines
                        what={['The ranked match, % fit, proximity sort and deadlines need a per-event unlock', 'Events that already unlocked keep it']}
                        who="Every active event without an unlock loses free Setnayan AI on its next visit"
                      />
                    ),
                    confirmLabel: 'Turn on',
                  },
                  {
                    key: 'off',
                    label: 'Off — free for everyone',
                    title: 'Make Setnayan AI free for everyone',
                    body: <ConfirmLines what={['Every event gets the full intelligence free', 'Overrides the env default']} who="Every event" />,
                    confirmLabel: 'Turn off',
                  },
                ]}
              />
            }
          />
          <SettingRow
            data="referral-program"
            name="Referral program"
            tip="The couple referral master switch. When off, the couple “Refer a couple” page is hidden and no referrals are recorded. The reward amount stays in Studio › Referrals."
            line={unread ? 'Couldn’t read what is saved' : `${referralOn ? 'On' : 'Off'}${reward ? ` · reward ${reward} set in Studio` : ''}`}
            right={
              <ConfirmButton
                action={setReferralProgramEnabled}
                fields={referralOn ? { back: '/admin/switches' } : { back: '/admin/switches', referral_program_enabled: 'on' }}
                tone={referralOn ? 'neutral' : 'brand'}
                icon={referralOn ? 'pause' : 'play'}
                label={referralOn ? 'Turn off' : 'Turn on'}
                disabled={unread}
                title={referralOn ? 'Turn the referral program off' : 'Turn the referral program on'}
                confirmLabel={referralOn ? 'Turn off' : 'Turn on'}
                body={
                  <ConfirmLines
                    what={
                      referralOn
                        ? ['The “Refer a couple” page is hidden', 'No new referrals are recorded']
                        : ['Couples see their invite link and earn the reward']
                    }
                    not={referralOn ? ['Rewards already earned are kept'] : []}
                    who="Every couple, on their Home"
                  />
                }
                data="referral-program"
              />
            }
          />
          <SettingRow
            data="sample-event"
            name="Sample event at /sample"
            tip="Maria and Jose at /sample. While it is off, only internal accounts can open it; everyone else gets a page-not-found. A pick saves at once."
            below={unread ? <SettingValue>{null}</SettingValue> : <SampleEventSwitch initial={sampleMode} />}
          />
          <TemplateRow title="Open the sample" line="/sample — Maria and Jose" href="/sample" data="sample-open" />
        </TemplateRows>
      </TemplateSection>

      <TemplateSection label="Suppliers" tip="Read-only rows say where their value lives. No control writes the first two today — they are read here, never guessed.">
        <TemplateRows>
          <SettingRow
            data="fee-unlocks-event"
            name="Booking fee unlocks the event"
            tip="platform_settings.fee_unlocks_event_enforced — read by both halves (event access + the supplier’s fee bill). No control writes it today; a writer governs money, so it waits for the owner’s one-person rule (typed + 24 h)."
            line="No control writes this yet"
            right={<SettingValue>{unread ? null : (onOff(s.fee_unlocks_event_enforced) ?? 'Not set')}</SettingValue>}
          />
          <SettingRow
            data="spotlight-homepage"
            name="Spotlight on the homepage"
            tip="platform_settings.spotlight_homepage_enabled — the owner switch for Spotlight awards on the homepage. No control writes it today."
            line="No control writes this yet"
            right={<SettingValue>{unread ? null : (onOff(s.spotlight_homepage_enabled) ?? 'Off')}</SettingValue>}
          />
          <SettingRow
            data="validate-contacts"
            name="Supplier VALIDATE inbox + number"
            tip="Where suppliers send “VALIDATE <shop name>” during verification. Saved with Business identity, because one save writes both."
            line={unread ? 'Couldn’t read what is saved' : `${s.vendor_validate_email || DEFAULT_VENDOR_VALIDATE_EMAIL} · ${s.vendor_validate_phone || 'number coming soon'}`}
          />
          <TemplateRow title="Change the VALIDATE inbox or number" line="Business & compliance › Business identity" href="/admin/business#identity" data="validate-edit" />
          <SettingRow
            data="radar-enabled"
            name="Demand Radar supplier feed"
            tip="platform_settings.radar_enabled. Demand Radar says it is managed in platform settings, but no control writes it. Shown read-only until an editor is approved."
            line="Database · no editor anywhere"
            right={<SettingValue>{unread ? null : (onOff(s.radar_enabled) ?? 'Not set')}</SettingValue>}
          />
          <SettingRow
            data="radar-min-n"
            name="Demand Radar min-N floor"
            tip="platform_settings.radar_min_n_floor — cells with fewer signals are hidden everywhere. No control writes it."
            line="Database · no editor anywhere"
            right={<SettingValue>{unread ? null : typeof s.radar_min_n_floor === 'number' ? String(s.radar_min_n_floor) : 'Not set'}</SettingValue>}
          />
        </TemplateRows>
      </TemplateSection>

      <TemplateSection label="Admins">
        <TemplateRows>
          <TemplateRow
            title="Morning digest"
            line={unread ? 'Couldn’t read what is saved' : `${s.admin_digest_enabled ? 'On' : 'Off'} · its switch sits beside the last send`}
            href="/admin/email-delivery#morning-digest"
            data="digest"
          />
          <DemoModeSurface toggled={one('toggled')} />
        </TemplateRows>
      </TemplateSection>

      <TemplateSection
        label="Set in Vercel (read-only here)"
        tip="Build-time flags are inlined into the app bundle — changing one needs a redeploy (Secrets › Redeploy production). A flag’s default in code is not its value in production; these show what this build reads."
      >
        <TemplateRows>
          <SettingRow data="env-package-credit" name="Package credit" line="env · NEXT_PUBLIC_PACKAGE_CREDIT" right={<SettingValue>{packageCreditEnabled() ? 'On' : 'Off'}</SettingValue>} />
          <SettingRow data="env-live-roam" name="Live Watch channel pool" line="env · NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED" right={<SettingValue>{liveStudioRoamEnabled() ? 'On' : 'Off'}</SettingValue>} />
          <SettingRow
            data="env-maya"
            name="Maya automated checkout"
            line="env · NEXT_PUBLIC_MAYA_STATUS"
            right={<SettingValue>{process.env.NEXT_PUBLIC_MAYA_STATUS === 'APPROVED' ? 'Approved' : 'Not approved'}</SettingValue>}
          />
          <SettingRow
            data="env-paywall"
            name="AI paywall environment default"
            line="env · SETNAYAN_AI_PAYWALL_ENABLED — used when the paywall says “environment default”"
            right={<SettingValue>{paywallEnvOn ? 'On' : 'Off'}</SettingValue>}
          />
        </TemplateRows>
      </TemplateSection>
    </AvatarScreen>
  );
}
