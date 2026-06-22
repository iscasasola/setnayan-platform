import 'server-only';

// Integration Activation Console — PR2 (generalize).
//
// Data-driven registry of "simple secret" integrations: one encrypted API key on
// the deny-by-default platform_integration_secrets singleton, resolved DB-first
// with an env fallback, no extra config. One entry here gives you a console card
// (rendered generically) + a resolver (lib/integration-config.ts) for free.
//
// This is the ALLOWLIST: the generic save/clear server actions and the page read
// only ever touch a `secretColumn` that appears in this array, so a malicious
// `integration_id` form value can never write an arbitrary column.
//
// Resend (PR1) and the Setnayan-AI paywall flag (PR1) are NOT in this list — they
// have bespoke cards (extra fields: from-address / tri-state toggle). Integrations
// that need non-secret CONFIG columns or a sync->async getter refactor (the OAuth
// trio: YouTube / Google Drive / TikTok) or that sit on a LIVE path (Meta FB
// auto-publish, Maya payments, R2 public host) are deliberately staged to later
// PRs; they will extend this same shape.

export type SecretIntegrationId = 'openai';

export interface SecretIntegrationDef {
  id: SecretIntegrationId;
  label: string;
  category: 'ai' | 'social' | 'storage' | 'payments';
  /** Column on platform_integration_secrets holding the AES-256-GCM ciphertext. */
  secretColumn: string;
  /** process.env var the resolver falls back to when the DB value is unset. */
  envFallback: string;
  /** Masked input placeholder shown on the console card. */
  placeholder: string;
  /** One-line description shown on the card. */
  description: string;
}

export const SECRET_INTEGRATIONS: readonly SecretIntegrationDef[] = [
  {
    id: 'openai',
    label: 'OpenAI — content moderation',
    category: 'ai',
    secretColumn: 'openai_api_key_enc',
    envFallback: 'OPENAI_API_KEY',
    placeholder: 'sk-...',
    description:
      'Editorial NSFW / harassment screening (OpenAI Moderation API). Fails open — when unset, editorial text is never flagged.',
  },
];

/** Lookup by id; undefined for an unknown id (the generic actions reject those). */
export function getSecretIntegration(id: string): SecretIntegrationDef | undefined {
  return SECRET_INTEGRATIONS.find((i) => i.id === id);
}

// ── OAuth client-config specs (PR3) ─────────────────────────────────────────
//
// One spec per CONSUMER of an OAuth client config: the column on
// platform_integration_secrets holding the encrypted client secret, the
// platform_settings columns for the (non-secret) client id/key + redirect URI,
// and the env var each falls back to. Column names mirror migration
// 20270212398962 and are the single source of truth for both the resolvers
// (lib/integration-config.ts) and the PR3b console cards.
//
// Google Drive is SHARED: `drivePapic` and `drivePhotoDelivery` use the SAME
// secret + client-id columns but DIFFERENT redirect-URI columns/envs.
export interface OAuthResolveSpec {
  secretColumn: string;
  secretEnv: string;
  clientIdColumn: string;
  clientIdEnv: string;
  redirectUriColumn: string;
  redirectUriEnv: string;
}

export const OAUTH_SPECS = {
  youtube: {
    secretColumn: 'youtube_oauth_client_secret_enc',
    secretEnv: 'YOUTUBE_OAUTH_CLIENT_SECRET',
    clientIdColumn: 'youtube_oauth_client_id',
    clientIdEnv: 'YOUTUBE_OAUTH_CLIENT_ID',
    redirectUriColumn: 'youtube_oauth_redirect_uri',
    redirectUriEnv: 'YOUTUBE_OAUTH_REDIRECT_URI',
  },
  drivePapic: {
    secretColumn: 'google_drive_oauth_client_secret_enc',
    secretEnv: 'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET',
    clientIdColumn: 'google_drive_oauth_client_id',
    clientIdEnv: 'GOOGLE_DRIVE_OAUTH_CLIENT_ID',
    redirectUriColumn: 'google_drive_oauth_redirect_uri',
    redirectUriEnv: 'GOOGLE_DRIVE_OAUTH_REDIRECT_URI',
  },
  drivePhotoDelivery: {
    secretColumn: 'google_drive_oauth_client_secret_enc',
    secretEnv: 'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET',
    clientIdColumn: 'google_drive_oauth_client_id',
    clientIdEnv: 'GOOGLE_DRIVE_OAUTH_CLIENT_ID',
    redirectUriColumn: 'photo_delivery_oauth_redirect_uri',
    redirectUriEnv: 'PHOTO_DELIVERY_OAUTH_REDIRECT_URI',
  },
  tiktok: {
    secretColumn: 'tiktok_client_secret_enc',
    secretEnv: 'TIKTOK_CLIENT_SECRET',
    clientIdColumn: 'tiktok_client_key',
    clientIdEnv: 'TIKTOK_CLIENT_KEY',
    redirectUriColumn: 'tiktok_oauth_redirect_uri',
    redirectUriEnv: 'TIKTOK_OAUTH_REDIRECT_URI',
  },
} satisfies Record<string, OAuthResolveSpec>;

// ── OAuth console cards (PR3b) ──────────────────────────────────────────────
//
// Card metadata for /admin/integrations: ONE card per OAuth client (Google
// Drive is one card even though two consumers share it). Each card edits one
// encrypted client SECRET + N non-secret CONFIG fields (client id/key + redirect
// URI[s]) on platform_settings. The column names are the ALLOWLIST the generic
// saveOAuthConfig action writes — a form value can never target another column.
// Mirrors the OAUTH_SPECS column names exactly (migration 20270212398962).
export interface OAuthConfigField {
  /** platform_settings column == the form field name. */
  column: string;
  /** env var the resolver falls back to (shown as the current value when DB is unset). */
  env: string;
  label: string;
  placeholder: string;
  /**
   * Save-time validation for this field's value (the value flows into a live
   * OAuth redirect or a Graph API URL path, so a malformed save is rejected
   * before it persists). 'url' = http(s) absolute URL; 'numeric' = digits only.
   */
  validate?: 'url' | 'numeric';
}

// "Credentialed" integration: one encrypted SECRET + N non-secret CONFIG text
// fields. Used for the OAuth clients (PR3b) AND for social-publish credentials
// like Meta (PR4a) — the config fields are just labelled differently (redirect
// URIs vs Page/IG ids); the card + actions are shape-identical.
export interface OAuthIntegrationDef {
  id: string;
  label: string;
  category: 'video' | 'storage' | 'social';
  /** platform_integration_secrets column holding the encrypted secret. */
  secretColumn: string;
  secretEnv: string;
  secretLabel: string;
  configFields: OAuthConfigField[];
  guidance: string;
}

export const OAUTH_INTEGRATIONS: readonly OAuthIntegrationDef[] = [
  {
    id: 'youtube',
    label: 'YouTube — Panood livestream',
    category: 'video',
    secretColumn: 'youtube_oauth_client_secret_enc',
    secretEnv: 'YOUTUBE_OAUTH_CLIENT_SECRET',
    secretLabel: 'OAuth client secret',
    configFields: [
      {
        column: 'youtube_oauth_client_id',
        env: 'YOUTUBE_OAUTH_CLIENT_ID',
        label: 'Client ID',
        placeholder: '…apps.googleusercontent.com',
      },
      {
        column: 'youtube_oauth_redirect_uri',
        env: 'YOUTUBE_OAUTH_REDIRECT_URI',
        label: 'Redirect URI',
        placeholder: 'https://www.setnayan.com/api/oauth/youtube/callback',
        validate: 'url',
      },
    ],
    guidance:
      'Google Cloud console → OAuth 2.0 client. The redirect URI must match the registered one exactly.',
  },
  {
    id: 'google_drive',
    label: 'Google Drive — Papic + Photo Delivery',
    category: 'storage',
    secretColumn: 'google_drive_oauth_client_secret_enc',
    secretEnv: 'GOOGLE_DRIVE_OAUTH_CLIENT_SECRET',
    secretLabel: 'OAuth client secret',
    configFields: [
      {
        column: 'google_drive_oauth_client_id',
        env: 'GOOGLE_DRIVE_OAUTH_CLIENT_ID',
        label: 'Client ID',
        placeholder: '…apps.googleusercontent.com',
      },
      {
        column: 'google_drive_oauth_redirect_uri',
        env: 'GOOGLE_DRIVE_OAUTH_REDIRECT_URI',
        label: 'Papic redirect URI',
        placeholder: 'https://www.setnayan.com/api/oauth/drive/callback',
        validate: 'url',
      },
      {
        column: 'photo_delivery_oauth_redirect_uri',
        env: 'PHOTO_DELIVERY_OAUTH_REDIRECT_URI',
        label: 'Photo Delivery redirect URI',
        placeholder: 'https://www.setnayan.com/api/oauth/photo-delivery/callback',
        validate: 'url',
      },
    ],
    guidance:
      'One shared Google OAuth client powers both Papic and Photo Delivery — register BOTH redirect URIs against it.',
  },
  {
    id: 'tiktok',
    label: 'TikTok — Patiktok',
    category: 'social',
    secretColumn: 'tiktok_client_secret_enc',
    secretEnv: 'TIKTOK_CLIENT_SECRET',
    secretLabel: 'Client secret',
    configFields: [
      {
        column: 'tiktok_client_key',
        env: 'TIKTOK_CLIENT_KEY',
        label: 'Client key',
        placeholder: 'aw…',
      },
      {
        column: 'tiktok_oauth_redirect_uri',
        env: 'TIKTOK_OAUTH_REDIRECT_URI',
        label: 'Redirect URI',
        placeholder: 'https://www.setnayan.com/api/tiktok/auth/callback',
        validate: 'url',
      },
    ],
    guidance:
      'TikTok developer portal → your app. The redirect URI must match the registered one exactly.',
  },
];

// ── Social-publish credentials (PR4a) ───────────────────────────────────────
//
// Same card/action shape as the OAuth clients (secret + config fields), but a
// LIVE social-publish credential rather than an OAuth client. Meta's ONE Page
// access token authorizes BOTH Facebook + Instagram; its config fields are the
// (non-secret) Page id + IG Business account id. resolveMetaConfig() reads these
// DB-first / env-fallback.
export const SOCIAL_INTEGRATIONS: readonly OAuthIntegrationDef[] = [
  {
    id: 'meta',
    label: 'Facebook + Instagram — auto-publish',
    category: 'social',
    secretColumn: 'meta_page_access_token_enc',
    secretEnv: 'META_PAGE_ACCESS_TOKEN',
    secretLabel: 'Page access token',
    configFields: [
      {
        column: 'meta_page_id',
        env: 'META_PAGE_ID',
        label: 'Facebook Page ID',
        placeholder: 'numeric Page id',
        validate: 'numeric',
      },
      {
        column: 'ig_user_id',
        env: 'IG_USER_ID',
        label: 'Instagram Business account ID',
        placeholder: 'numeric IG Business id (optional — FB-only if blank)',
        validate: 'numeric',
      },
    ],
    guidance:
      'Meta Business → System User token with pages_manage_posts + instagram_content_publish. The SAME token authorizes both Facebook and Instagram. ⚠ This is the LIVE auto-publish path — a wrong token stops posting.',
  },
  {
    id: 'tiktok_social',
    label: 'TikTok — auto-publish',
    category: 'social',
    secretColumn: 'tiktok_access_token_enc',
    secretEnv: 'TIKTOK_ACCESS_TOKEN',
    secretLabel: 'Account access token',
    configFields: [],
    guidance:
      'The Setnayan TikTok account user access token (path B auto-publish). Distinct from the TikTok OAuth client above (per-couple Patiktok). Dormant until a token is set AND the Content-Posting-API audit clears.',
  },
];

/** OAuth clients + social-publish credentials — the union the console manages. */
export const CREDENTIAL_INTEGRATIONS: readonly OAuthIntegrationDef[] = [
  ...OAUTH_INTEGRATIONS,
  ...SOCIAL_INTEGRATIONS,
];

/** Lookup by id across all credentialed integrations; undefined when unknown. */
export function getOAuthIntegration(id: string): OAuthIntegrationDef | undefined {
  return CREDENTIAL_INTEGRATIONS.find((i) => i.id === id);
}

// ── Maya / PayMaya payments (PR4c) ──────────────────────────────────────────
//
// Maya breaks the single-secret card shape: it needs TWO secrets (the public +
// secret key form one HTTP Basic-auth pair) + one config (checkout endpoint), so
// it has a bespoke card (MayaCard) + action (saveMayaConfig). This metadata is
// the column allowlist for that action + the presence map. The build-time
// activation gate (NEXT_PUBLIC_MAYA_STATUS) is NOT here — it stays redeploy-gated.
export const MAYA_INTEGRATION = {
  id: 'maya',
  label: 'Maya — automated checkout',
  publicKeyColumn: 'maya_public_api_key_enc',
  publicKeyEnv: 'MAYA_PUBLIC_API_KEY',
  secretKeyColumn: 'maya_secret_api_key_enc',
  secretKeyEnv: 'MAYA_SECRET_API_KEY',
  endpointColumn: 'maya_checkout_endpoint',
  endpointEnv: 'MAYA_CHECKOUT_ENDPOINT',
} as const;

/** All secret columns across every registry — for the console presence map. */
export const ALL_SECRET_COLUMNS: readonly string[] = [
  ...SECRET_INTEGRATIONS.map((i) => i.secretColumn),
  ...CREDENTIAL_INTEGRATIONS.map((i) => i.secretColumn),
  MAYA_INTEGRATION.publicKeyColumn,
  MAYA_INTEGRATION.secretKeyColumn,
];
