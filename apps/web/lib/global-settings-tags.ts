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
} as const;

export type GlobalSettingsTag = (typeof GLOBAL_SETTINGS_TAGS)[keyof typeof GLOBAL_SETTINGS_TAGS];
