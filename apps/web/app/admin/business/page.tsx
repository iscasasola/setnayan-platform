import { PageMasthead } from '@/app/_components/page-masthead';
import { TemplateFail, TemplateRow, TemplateRows, TemplateSection, TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchDriveSpeed, fetchPlatformSettingsMeasured, fetchVendorValidateContacts } from '@/lib/platform-settings';
import { getLoaderSettings } from '@/lib/loader-settings';
import { removeBrandIcon } from '@/app/admin/settings/actions';
import { BrandIconUploadForm } from '@/app/admin/settings/_components/brand-icon-form';
import { LoaderAppearanceCard } from '@/app/admin/settings/_components/loader-appearance-card';
import { SentrySmokeTestButton } from '@/app/admin/settings/_components/sentry-smoke-test-button';
import { ComplianceSurface } from '@/app/admin/settings/_surfaces/compliance-surface';
import { AvatarScreen, ConfirmLines, SettingRow } from '../_components/avatar-screen';
import { ConfirmButton } from '../_components/avatar-confirm';
import { BusinessIdentityForm } from './_components/business-identity-form';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Business & compliance · Admin' };

/**
 * /admin/business — BUSINESS & COMPLIANCE, under the avatar (owner go 14 Nov 2026; the approved drawing is
 * `Setnayan-specs/prototypes/admin_five_tabs_2026-11-13/admin.html` `page('business' …)`).
 *
 * Moved here, nothing dropped (the old addresses forward here):
 *   · the Settings studio's Settings tab (`/admin/settings`, `?tab=settings`) — Business identity (name · TIN ·
 *     address · email · VAT · repost-watch sensitivity · Supplier VALIDATE inbox + number · driving speed), the
 *     default brand icon (upload · reset), the loading animation, the Sentry smoke test, and the doors to Onboarding
 *     and Payment methods;
 *   · its Compliance tab (`?tab=compliance`, `/admin/compliance`) — the RA 10173 facts and the NPC data sheet.
 * Every save posts to the SAME action as before (`saveBusinessIdentity`, `removeBrandIcon`, the brand-icon and loader
 * forms, `saveComplianceFacts` inside the Compliance form).
 *
 * ⚖ These are NOT BIR Official Receipts: the business identity is printed on every transaction receipt; the actual BIR
 * Official Receipt for a paid order is issued separately, offline — these are not BIR ORs. Getting that wrong is a tax
 * problem, not a layout one, so the sentence stays on the page.
 */
export default async function AdminBusinessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);

  const admin = createAdminClient();
  // 🔒 MEASURED, NOT FALLBACK (2026-09-30). A refused read seeds the form with FALLBACK blanks/defaults; Save would
  // write them over the real values printed on every receipt. Save is off instead.
  const { settings, readFailed: settingsReadFailed } = await fetchPlatformSettingsMeasured(admin);
  const validateContacts = await fetchVendorValidateContacts(admin);
  const driveSpeed = await fetchDriveSpeed(admin);
  const loaderConfig = await getLoaderSettings();

  const hasIcon = Boolean(settings.brand_icon_master_url);
  const bust = (url: string | null) => (url ? `${url}${url.includes('?') ? '&' : '?'}v=${settings.brand_icon_version}` : null);
  const logoSrc = bust(settings.brand_icon_png_512_url ?? settings.brand_icon_svg_url ?? settings.brand_icon_master_url);
  const tabSrc = bust(settings.brand_favicon_ico_url ?? settings.brand_icon_png_512_url ?? settings.brand_icon_master_url);

  const error = one('error');
  const flash = one('saved')
    ? 'Settings saved. Live changes propagate to all surfaces immediately.'
    : one('brand_icon')
      ? 'Brand icon updated. It now shows on the browser tab, the app icon, and the in-app logo everywhere. Browsers may keep the old tab icon cached for a bit.'
      : one('brand_icon_removed')
        ? 'Brand icon reset to the default gold Setnayan mark.'
        : one('loader_saved')
          ? 'Loading animation updated. It applies on the next navigation.'
          : null;

  return (
    <AvatarScreen data="business">
      <PageMasthead title="Business & compliance" />

      {error ? <TemplateFail data="business-error">{decodeURIComponent(error).slice(0, 300)}</TemplateFail> : null}
      {flash ? (
        <p role="status" className="py-2 text-[14px] text-[rgb(var(--color-ok))]">
          {flash}
        </p>
      ) : null}
      {settingsReadFailed ? (
        <TemplateFail retryHref="/admin/business" data="business-unread">
          Couldn&rsquo;t load the saved settings — refresh to try again. Saving is off until they load, so blank fields
          can&rsquo;t overwrite the real ones.
        </TemplateFail>
      ) : null}

      <section id="identity" className="scroll-mt-28">
        <TemplateSection
          first
          label="Business identity"
          tip="Business identity printed on every transaction receipt. Everything here is read everywhere across the app; only internal and team-member admins can edit. The actual BIR Official Receipt for a paid order is issued separately, offline — these are not BIR ORs."
          right={`Last updated ${new Date(settings.updated_at).toLocaleString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' })}`}
        >
          <BusinessIdentityForm
            readFailed={settingsReadFailed}
            values={{
              business_name: settings.business_name ?? '',
              business_tin: settings.business_tin ?? '',
              business_address: settings.business_address ?? '',
              business_email: settings.business_email ?? '',
              default_vat_rate_pct: String(settings.default_vat_rate_pct ?? ''),
              repost_watch_hamming_threshold: String(settings.repost_watch_hamming_threshold ?? ''),
              vendor_validate_email: validateContacts.vendor_validate_email,
              vendor_validate_phone: validateContacts.vendor_validate_phone ?? '',
              drive_speed_kmh: driveSpeed.read ? (driveSpeed.kmh !== null ? String(driveSpeed.kmh) : '') : null,
            }}
          />
        </TemplateSection>
      </section>

      <TemplateSection
        label="Default brand icon"
        tip="Upload one square image and we’ll generate the whole set — the browser-tab favicon, the iOS/Android home-screen icon, and the in-app logo. It propagates everywhere immediately. PNG, JPEG, WebP, or SVG; a square logo on a transparent background works best. Safari may keep the old tab icon until its website data is cleared (Safari → Settings → Privacy → Manage Website Data → remove setnayan.com)."
      >
        {hasIcon && logoSrc ? (
          <div className="flex flex-wrap items-center gap-5 py-2">
            <figure className="flex flex-col items-center gap-1.5">
              <span className="flex h-9 items-center rounded-md border border-[color:var(--m-line)] bg-white px-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={tabSrc ?? logoSrc} alt="" width={16} height={16} className="block" />
              </span>
              <figcaption className={`text-[12px] ${TEMPLATE_SUBLINE}`}>Tab · 16px</figcaption>
            </figure>
            <figure className="flex flex-col items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Current brand icon" width={48} height={48} className="block rounded-md" />
              <figcaption className={`text-[12px] ${TEMPLATE_SUBLINE}`}>Logo · 48px</figcaption>
            </figure>
            <p className={`min-w-0 flex-1 text-[14px] ${TEMPLATE_SUBLINE}`}>
              This custom icon is live across the browser tab, app icon, and in-app logo.
            </p>
            <ConfirmButton
              action={removeBrandIcon}
              tone="danger"
              icon="undo"
              label="Reset to default"
              title="Reset to the default gold Setnayan mark"
              confirmLabel="Reset"
              destructive
              body={
                <ConfirmLines
                  what={['The tab icon, app icon and in-app logo go back to the gold mark everywhere', 'The uploaded files are deleted']}
                  who="Every visitor and every installed app"
                />
              }
              data="brand-reset"
            />
          </div>
        ) : (
          <p className={`py-2 text-[14px] ${TEMPLATE_SUBLINE}`}>
            Using the default gold Setnayan mark. Upload a square image below to replace it everywhere.
          </p>
        )}
        <div className="border-t border-[color:var(--m-line)] pt-3">
          <BrandIconUploadForm replace={hasIcon} />
        </div>
      </TemplateSection>

      <TemplateSection label="Loading animation">
        <LoaderAppearanceCard
          initialVariant={loaderConfig.variant}
          initialVeilOpacity={loaderConfig.veilOpacity}
          initialStepIntervalMs={loaderConfig.stepIntervalMs}
          initialPopEnabled={loaderConfig.popEnabled}
        />
      </TemplateSection>

      <TemplateSection label="System health" tip="Verify production observability is wired and routing alerts correctly. One-shot owner actions — no background sweeps.">
        <TemplateRows>
          <SettingRow
            data="sentry-smoke-test"
            name="Sentry prod smoke test"
            tip="Triggers a controlled error tagged source=manual-smoke-test so it’s easy to find in the Sentry dashboard. POST-only — the endpoint cannot be triggered by URL paste or preview-deploy crawlers."
            below={<SentrySmokeTestButton />}
          />
        </TemplateRows>
      </TemplateSection>

      <TemplateSection label="Elsewhere">
        <TemplateRows>
          <TemplateRow title="Onboarding" line="Background music and per-flow knobs, by onboarding type" href="/admin/ugat?tab=onboarding" data="onboarding" />
          <TemplateRow title="Payment methods" line="The receiving accounts + QR codes couples see on order pages" href="/admin/settings/payment-methods" data="payment-methods" />
        </TemplateRows>
      </TemplateSection>

      <ComplianceSurface />
    </AvatarScreen>
  );
}
