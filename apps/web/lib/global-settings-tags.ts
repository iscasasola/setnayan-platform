/**
 * global-settings-tags.ts — the data-cache tags of the platform's remembered
 * settings (`lib/global-settings-cache.ts`). Their own file so a writer (an
 * admin action) and a test can name a tag without loading Next's cache.
 */
/** One tag per table. Every admin write to the table clears its tag. */
export const GLOBAL_SETTINGS_TAGS = {
  bundleComponents: 'global-settings:bundle_components',
  promoFreeWindows: 'global-settings:promo_free_windows',
  dataPrivacyControls: 'global-settings:data_privacy_controls',
  revealStudioConfig: 'global-settings:reveal_studio_config',
  eventTypeProfiles: 'global-settings:event_type_profiles',
  /** The event-type roster (labels, launch lever, Setnayan AI price band). 2026-10-20. */
  eventTypeVocab: 'global-settings:event_type_vocab',
  /**
   * The `platform_settings` singleton — the reads that ride on every render
   * (the booking-fee schedule, `fetchPlatformSettings`, the Setnayan AI
   * switches). 2026-10-20. Every app file that writes the table clears it
   * (`lib/global-settings-cache.test.ts` §4). The brand icons and the loader
   * keep their own older tags (`BRAND_SETTINGS_TAG`, `LOADER_SETTINGS_TAG`).
   */
  platformSettings: 'global-settings:platform_settings',
} as const;

export type GlobalSettingsTag = (typeof GLOBAL_SETTINGS_TAGS)[keyof typeof GLOBAL_SETTINGS_TAGS];
