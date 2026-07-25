// Secrets & Rotation board — the registry.
//
// The single source of truth for "every platform secret Setnayan holds": where
// its canonical value lives, how old it's allowed to get, how the owner gets a
// fresh one, and what breaks if it's wrong.
//
// This is the ALLOWLIST. Every server action on /admin/secrets resolves the
// posted `secret_id` through getSecretDef() before it touches anything, so a
// crafted form value can never select an arbitrary Vercel env var name or DB
// column — exactly the posture lib/integrations/registry.ts holds for the
// Integration console.
//
// NO SECRET VALUES LIVE HERE. Only public metadata: env var NAMES, provider
// URLs, plain-English instructions. That is deliberate — it's why this module
// carries no `import 'server-only'` (the libs that touch real secret material —
// vercel-env.ts, reencrypt.ts, encryption.ts — all do). Keeping it dependency-
// light also makes it importable by the Node test runner, which is how the
// registry-integrity test locks the invariants below.

export type SecretGroup =
  | 'supabase'
  | 'storage'
  | 'email'
  | 'ai'
  | 'social'
  | 'payments'
  | 'observability'
  | 'internal'
  | 'infra';

/** Where the CANONICAL value lives — determines the store badge + the control. */
export type SecretStore = 'vercel' | 'db' | 'github' | 'local';

/**
 * How (if at all) the board lets the owner change it in-app.
 *   • 'vercel-api'        — paste here → written to the Vercel project env via
 *                           the REST API → needs a production redeploy to apply.
 *   • 'db-paste'          — the Integration console already owns this secret
 *                           (encrypted, DB-first, no redeploy); the board links
 *                           to that card rather than duplicating the write path.
 *   • 'instructions-only' — the value lives somewhere we can't write (GitHub
 *                           Actions, a provider dashboard). Read the runbook,
 *                           do it there, then "Mark rotated" here.
 */
export type SecretEditable = 'vercel-api' | 'db-paste' | 'instructions-only';

export interface SecretDef {
  /** Stable slug — the primary key in platform_secret_rotations. Never renamed. */
  id: string;
  label: string;
  group: SecretGroup;
  store: SecretStore;
  /** Env var names involved. Also drives the Vercel `updatedAt` age lookup. */
  envVars: string[];
  editable: SecretEditable;
  /** For db-paste: deep link into the Integration console card. */
  consoleHref?: string;
  /** null = "rotate only on compromise" (manual — no age alarm). */
  policyDays: number | null;
  /** Deep link to the provider page that mints a fresh value. */
  providerUrl: string;
  /** Numbered plain-English instructions. Never empty. */
  steps: string[];
  /** What breaks / what to verify after. */
  impact: string;
  /** Self-generated secrets: the one-liner that mints a value. */
  generateHint?: string;
  /** Multi-input vercel-api rows (e.g. the R2 key PAIR). */
  fields?: { envVar: string; label: string }[];
}

const VERCEL_ENV_SETTINGS =
  'https://vercel.com/icasa-offroad/setnayan-platform-web/settings/environment-variables';
const GITHUB_ACTIONS_SECRETS =
  'https://github.com/iscasasola/setnayan-platform/settings/secrets/actions';
const SUPABASE_API_KEYS =
  'https://supabase.com/dashboard/project/njrupjnvkjkitfctetvi/settings/api-keys';
const GOOGLE_CREDENTIALS = 'https://console.cloud.google.com/apis/credentials';
const OPENSSL_HINT = 'openssl rand -base64 32';

/** Steps every self-generated (internal) secret shares. */
const SELF_GENERATED_STEPS = [
  'Click "Generate" below — it mints a fresh 32-byte random value in your browser. (Or run `openssl rand -base64 32` yourself.)',
  'Click Save. The new value is written to the Vercel project env for Production + Preview.',
  'Click "Redeploy production" — the running app only picks up env changes on a new deployment.',
  'Nothing external holds this value, so there is nothing else to update.',
];

export const SECRET_REGISTRY: readonly SecretDef[] = [
  // ── supabase ──────────────────────────────────────────────────────────────
  {
    id: 'supabase_service_role',
    label: 'Supabase service-role key',
    group: 'supabase',
    store: 'vercel',
    envVars: ['SUPABASE_SERVICE_ROLE_KEY'],
    editable: 'vercel-api',
    policyDays: 90,
    providerUrl: SUPABASE_API_KEYS,
    steps: [
      'Open the Supabase API-keys page.',
      'Reveal/roll the `service_role` secret key (or generate a new secret API key).',
      'Paste it below and Save.',
      'Click "Redeploy production".',
      'Open /api/health/deep — it must stay ok:true.',
    ],
    impact:
      "This key is the server's master database credential. A wrong value breaks nearly every server feature — always verify /api/health/deep right after redeploy.",
  },
  {
    id: 'supabase_anon',
    label: 'Supabase anon (public) key',
    group: 'supabase',
    store: 'vercel',
    envVars: ['NEXT_PUBLIC_SUPABASE_ANON_KEY'],
    editable: 'vercel-api',
    policyDays: 365,
    providerUrl: SUPABASE_API_KEYS,
    steps: [
      'Open the same Supabase API-keys page and copy the `anon` / publishable key.',
      'This key is PUBLIC by design — it ships to every browser. It only changes when the JWT secret / key family is rolled, not on a routine schedule.',
      'Paste it below and Save, then click "Redeploy production".',
      'Also update `apps/web/.env.local` on the dev machine so local dev keeps working.',
    ],
    impact:
      'Browser clients use this to reach Supabase. Rotating the JWT secret logs every user out.',
  },
  {
    id: 'supabase_db_password',
    label: 'Supabase database password (migrations)',
    group: 'supabase',
    store: 'github',
    envVars: ['SUPABASE_DB_URL', 'SUPABASE_DB_PASSWORD'],
    editable: 'instructions-only',
    policyDays: 180,
    providerUrl:
      'https://supabase.com/dashboard/project/njrupjnvkjkitfctetvi/settings/database',
    steps: [
      'Reset the database password in the Supabase dashboard.',
      `Update the GitHub Actions secrets SUPABASE_DB_PASSWORD and SUPABASE_DB_URL (the URL embeds the password) at ${GITHUB_ACTIONS_SECRETS}.`,
      'Run the supabase-migrations workflow once to confirm it still connects.',
      'Come back here and click "Mark rotated".',
    ],
    impact:
      'Only the GitHub migrations workflow uses this. Until BOTH secrets are updated, migration deploys fail.',
  },
  {
    id: 'supabase_access_token',
    label: 'Supabase personal access token (CI)',
    group: 'supabase',
    store: 'github',
    envVars: ['SUPABASE_ACCESS_TOKEN'],
    editable: 'instructions-only',
    policyDays: 180,
    providerUrl: 'https://supabase.com/dashboard/account/tokens',
    steps: [
      'Generate a new personal access token in the Supabase account settings.',
      `Update the SUPABASE_ACCESS_TOKEN GitHub Actions secret at ${GITHUB_ACTIONS_SECRETS}.`,
      'Revoke the OLD token in Supabase once the workflow has run green.',
      'Come back here and click "Mark rotated".',
    ],
    impact: 'Used by the migrations workflow to talk to the Supabase API.',
  },

  // ── storage ───────────────────────────────────────────────────────────────
  {
    id: 'r2_keys',
    label: 'Cloudflare R2 access key pair',
    group: 'storage',
    store: 'vercel',
    envVars: ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'],
    editable: 'vercel-api',
    fields: [
      { envVar: 'R2_ACCESS_KEY_ID', label: 'New Access Key ID' },
      { envVar: 'R2_SECRET_ACCESS_KEY', label: 'New Secret Access Key' },
    ],
    policyDays: 90,
    providerUrl: 'https://dash.cloudflare.com/?to=/:account/r2/api-tokens',
    steps: [
      'Create a NEW R2 API token (Object Read & Write on the 4 Setnayan buckets). Do not delete the old one yet.',
      'Paste the new Access Key ID and Secret Access Key below, Save, then Redeploy.',
      'Check /api/health/deep — it exercises R2.',
      'Only now, delete the OLD token in Cloudflare.',
    ],
    impact:
      'All media upload/download signing. Create-then-delete (not edit) so there is no gap where neither key works.',
  },
  {
    id: 'cloudflare_turn',
    label: 'Cloudflare TURN key (in-app calls)',
    group: 'storage',
    store: 'vercel',
    envVars: ['CLOUDFLARE_TURN_KEY_ID', 'CLOUDFLARE_TURN_API_TOKEN'],
    editable: 'vercel-api',
    fields: [
      { envVar: 'CLOUDFLARE_TURN_KEY_ID', label: 'New TURN key ID' },
      { envVar: 'CLOUDFLARE_TURN_API_TOKEN', label: 'New TURN API token' },
    ],
    policyDays: 180,
    providerUrl: 'https://dash.cloudflare.com/?to=/:account/calls',
    steps: [
      'Open Cloudflare → Calls and create a new TURN key.',
      'Paste the key ID and API token below, Save, then Redeploy.',
      'Delete the old TURN key in Cloudflare.',
    ],
    impact:
      'Video/voice call relay (feature currently env-dark). Safe to rotate anytime.',
  },

  // ── email ─────────────────────────────────────────────────────────────────
  {
    id: 'resend',
    label: 'Resend API key (all email)',
    group: 'email',
    store: 'db',
    envVars: ['RESEND_API_KEY'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 90,
    providerUrl: 'https://resend.com/api-keys',
    steps: [
      'Create a new key in Resend.',
      'Paste it on the Integrations console (Resend card) — it takes effect immediately, no redeploy.',
      'Click Verify on the Resend card.',
      'Delete the old key in Resend.',
      'Optional: also refresh the RESEND_API_KEY Vercel env fallback so the backup stays current.',
    ],
    impact:
      'Every transactional email. The DB value wins over the env var.',
  },

  // ── ai ────────────────────────────────────────────────────────────────────
  {
    id: 'openai',
    label: 'OpenAI key (moderation)',
    group: 'ai',
    store: 'db',
    envVars: ['OPENAI_API_KEY'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 90,
    providerUrl: 'https://platform.openai.com/api-keys',
    steps: [
      'Create a new secret key in the OpenAI dashboard.',
      'Paste it on the Integrations console (OpenAI card) — immediate, no redeploy.',
      'Delete the old key in OpenAI.',
    ],
    impact: 'Editorial NSFW screening only; fails open when unset.',
  },
  {
    id: 'recraft',
    label: 'Recraft API key (image gen)',
    group: 'ai',
    store: 'vercel',
    envVars: ['RECRAFT_API_KEY'],
    editable: 'vercel-api',
    policyDays: 180,
    providerUrl: 'https://www.recraft.ai/profile/api',
    steps: [
      'Generate a new API key on the Recraft profile page.',
      'Paste it below, Save, then Redeploy.',
      'Revoke the old key in Recraft.',
      'Also update the local copy in ~/.claude/settings.json on the dev machine.',
    ],
    impact:
      'Marketing image generation. Also update the local copy in ~/.claude/settings.json on the dev machine.',
  },

  // ── social ────────────────────────────────────────────────────────────────
  {
    id: 'meta_page_token',
    label: 'Meta Page access token (FB+IG auto-publish)',
    group: 'social',
    store: 'db',
    envVars: ['META_PAGE_ACCESS_TOKEN'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 60,
    providerUrl: 'https://business.facebook.com/settings/system-users',
    steps: [
      'Meta Business → System Users → generate a new token with pages_manage_posts + instagram_content_publish.',
      'Paste it on the Integrations console (Facebook + Instagram card).',
      'Post one test item to confirm publishing still works before you revoke the old token.',
    ],
    impact: '⚠ LIVE auto-publish path — a wrong token stops posting.',
  },
  {
    id: 'ig_app_secret',
    label: 'Instagram app secret (vendor IG connect)',
    group: 'social',
    store: 'vercel',
    envVars: ['IG_APP_SECRET'],
    editable: 'vercel-api',
    policyDays: 180,
    providerUrl: 'https://developers.facebook.com/apps/',
    steps: [
      'Open the Meta app → Settings → Basic → App secret → Reset.',
      'Paste the new secret below, Save, then Redeploy.',
      'Ask one vendor to re-run the Instagram connect flow to confirm.',
    ],
    impact: 'Per-vendor IG portfolio connect flow.',
  },
  {
    id: 'youtube_oauth',
    label: 'YouTube OAuth client secret',
    group: 'social',
    store: 'db',
    envVars: ['YOUTUBE_OAUTH_CLIENT_SECRET'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 180,
    providerUrl: GOOGLE_CREDENTIALS,
    steps: [
      'Google Cloud console → Credentials → open the EXISTING YouTube OAuth client.',
      'Reset the client secret on that same client — do NOT create a new client (a new one changes the client ID too).',
      'Paste the new secret on the Integrations console (YouTube card).',
    ],
    impact:
      'Live Studio YouTube pairing. Reset the secret on the SAME OAuth client — a new client would also change the client ID.',
  },
  {
    id: 'gdrive_oauth',
    label: 'Google Drive OAuth client secret',
    group: 'social',
    store: 'db',
    envVars: ['GOOGLE_DRIVE_OAUTH_CLIENT_SECRET'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 180,
    providerUrl: GOOGLE_CREDENTIALS,
    steps: [
      'Google Cloud console → Credentials → open the EXISTING Drive OAuth client.',
      'Reset the client secret on that same client (the client ID must stay).',
      'Paste the new secret on the Integrations console (Google Drive card).',
    ],
    impact: 'Papic Drive handover + Photo Delivery.',
  },
  {
    id: 'google_signin_oauth',
    label: 'Google sign-in OAuth client secret',
    group: 'social',
    store: 'vercel',
    envVars: ['GOOGLE_OAUTH_CLIENT_SECRET'],
    editable: 'vercel-api',
    policyDays: 180,
    providerUrl: GOOGLE_CREDENTIALS,
    steps: [
      'Google Cloud console → Credentials → open the EXISTING sign-in OAuth client and Reset its secret (the client ID must stay).',
      '⚠ The OPERATIVE copy lives in Supabase → Authentication → Providers → Google. Paste the new secret THERE first — that is what actually signs users in.',
      'Then paste it below and Save so the Vercel mirror stays in step, and Redeploy.',
      'Test "Continue with Google" on the live site before you close the tab.',
    ],
    impact:
      "'Continue with Google' login. Supabase Auth holds the operative copy (Authentication → Providers); the Vercel env var is a build-time mirror. Reset the secret on the SAME client (client ID must stay).",
  },
  {
    id: 'tiktok_oauth',
    label: 'TikTok client secret (Patiktok)',
    group: 'social',
    store: 'db',
    envVars: ['TIKTOK_CLIENT_SECRET'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 180,
    providerUrl: 'https://developers.tiktok.com/',
    steps: [
      'TikTok developer portal → your app → regenerate the client secret.',
      'Paste it on the Integrations console (TikTok card).',
    ],
    impact: 'Per-couple Patiktok OAuth connect flow.',
  },
  {
    id: 'tiktok_publish',
    label: 'TikTok auto-publish token',
    group: 'social',
    store: 'db',
    envVars: ['TIKTOK_ACCESS_TOKEN'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 180,
    providerUrl: 'https://developers.tiktok.com/',
    steps: [
      'Re-authorize the Setnayan TikTok account to mint a fresh user access token.',
      'Paste it on the Integrations console (TikTok auto-publish card).',
    ],
    impact:
      'Setnayan-account auto-publish (dormant until the Content-Posting-API audit clears).',
  },

  // ── payments ──────────────────────────────────────────────────────────────
  {
    id: 'maya_keys',
    label: 'Maya checkout key pair',
    group: 'payments',
    store: 'db',
    envVars: ['MAYA_PUBLIC_API_KEY', 'MAYA_SECRET_API_KEY'],
    editable: 'db-paste',
    consoleHref: '/admin/integrations',
    policyDays: 180,
    providerUrl: 'https://developers.maya.ph/',
    steps: [
      'Maya developer portal → regenerate the public + secret API key pair.',
      'Paste BOTH on the Integrations console (Maya card).',
    ],
    impact: 'Dormant until Maya activation.',
  },

  // ── observability ─────────────────────────────────────────────────────────
  {
    id: 'sentry_auth',
    label: 'Sentry auth token (build sourcemaps)',
    group: 'observability',
    store: 'vercel',
    envVars: ['SENTRY_AUTH_TOKEN'],
    editable: 'vercel-api',
    policyDays: 180,
    providerUrl: 'https://sentry.io/settings/account/api/auth-tokens/',
    steps: [
      'Create a new Sentry auth token with project:releases scope.',
      'Paste it below, Save, then Redeploy — the next build uploads sourcemaps with it.',
      'Revoke the old token in Sentry.',
    ],
    impact:
      'Only sourcemap upload during builds; the app keeps running either way.',
  },
  {
    id: 'posthog_key',
    label: 'PostHog project key',
    group: 'observability',
    store: 'vercel',
    envVars: ['NEXT_PUBLIC_POSTHOG_KEY'],
    editable: 'instructions-only',
    policyDays: null,
    providerUrl: 'https://app.posthog.com/settings/project',
    steps: [
      'This key is PUBLIC by design — it ships to every browser, so leaking it is not a breach.',
      'It only changes if you rotate the PostHog PROJECT itself, which starts analytics history over.',
      'If you do: update NEXT_PUBLIC_POSTHOG_KEY in Vercel, redeploy, then Mark rotated here.',
    ],
    impact:
      'Public by design (ships to the browser); rotate only if you also rotate the PostHog project.',
  },

  // ── internal (self-generated shared secrets) ──────────────────────────────
  {
    id: 'cron_secret',
    label: 'CRON_SECRET (manual job triggers)',
    group: 'internal',
    store: 'vercel',
    envVars: ['CRON_SECRET'],
    editable: 'vercel-api',
    policyDays: 90,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: [
      ...SELF_GENERATED_STEPS.slice(0, 3),
      'ONE external copy exists: Supabase Vault secret `cron_secret` (Dashboard → Project Settings → Vault) — the quarterly BIR 2307 pg_cron job sends it as its X-Cron-Secret header. Update it to the same value, or that job gets 401s until the next rotation.',
    ],
    impact:
      'Manual curl triggers of the sweep routes + the re-encrypt endpoint on this page, and the quarterly BIR 2307 pg_cron job (via the Supabase Vault copy — see steps).',
  },
  {
    id: 'oauth_refresh_cron_secret',
    label: 'OAUTH_REFRESH_CRON_SECRET',
    group: 'internal',
    store: 'vercel',
    envVars: ['OAUTH_REFRESH_CRON_SECRET'],
    editable: 'vercel-api',
    policyDays: 90,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: SELF_GENERATED_STEPS,
    impact: 'Guards the OAuth token-refresh cron route. Nothing external holds it.',
  },
  {
    id: 'internal_worker_secret',
    label: 'INTERNAL_WORKER_SECRET',
    group: 'internal',
    store: 'vercel',
    envVars: ['INTERNAL_WORKER_SECRET'],
    editable: 'vercel-api',
    policyDays: 90,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: [
      ...SELF_GENERATED_STEPS.slice(0, 3),
      'If a pg_cron job or an external scheduler was ever configured with the OLD value, update it there too — otherwise it starts getting 401s.',
    ],
    impact:
      'Patiktok worker stub + telemetry auto-resolve. If a pg_cron job is ever configured with this value, update it there too.',
  },
  {
    id: 'guest_claim_otp_secret',
    label: 'GUEST_CLAIM_OTP_SECRET',
    group: 'internal',
    store: 'vercel',
    envVars: ['GUEST_CLAIM_OTP_SECRET'],
    editable: 'vercel-api',
    policyDays: 90,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: SELF_GENERATED_STEPS,
    impact:
      'Rotating invalidates OTP codes currently in flight (minutes); guests just request a new code. Note: no runtime code path reads this today — it is declared in turbo.json and set in prod, so it stays inventoried here.',
  },
  {
    id: 'notify_webhook_secret',
    label: 'NOTIFY_WEBHOOK_SECRET (Supabase→app webhook)',
    group: 'internal',
    store: 'vercel',
    envVars: ['NOTIFY_WEBHOOK_SECRET'],
    editable: 'vercel-api',
    policyDays: null,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: [
      'Generate a fresh random value below.',
      'Save + Redeploy so the app knows the new value.',
      'Set the SAME value as the `x-webhook-secret` header on the Supabase Dashboard webhook config — both sides must match or /api/notify rejects every call.',
    ],
    impact:
      'Currently UNSET — the /api/notify path is fail-closed/dormant. To enable: set the same value here AND as the x-webhook-secret header in the Supabase Dashboard webhook config.',
  },
  {
    id: 'device_hash_salt',
    label: 'DEVICE_HASH_SALT',
    group: 'internal',
    store: 'vercel',
    envVars: ['DEVICE_HASH_SALT'],
    editable: 'vercel-api',
    policyDays: null,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: [
      'Only rotate this if you believe the salt leaked. There is no schedule.',
      'Generate a fresh value below, Save, Redeploy.',
      'Expect trial-abuse clustering to start from zero — old device fingerprints will never match new ones again.',
    ],
    impact:
      '⚠ Not a credential. Rotating resets device-fingerprint continuity (trial-abuse clustering starts over). Rotate only on compromise.',
  },
  {
    id: 'vapid_keys',
    label: 'Web-push VAPID key pair',
    group: 'internal',
    store: 'vercel',
    envVars: ['VAPID_PRIVATE_KEY', 'NEXT_PUBLIC_VAPID_PUBLIC_KEY'],
    editable: 'instructions-only',
    policyDays: null,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: 'npx web-push generate-vapid-keys',
    steps: [
      'Only rotate on compromise — see the impact note below before you do anything.',
      'Run `npx web-push generate-vapid-keys` to mint a matched public/private pair.',
      'Set BOTH VAPID_PRIVATE_KEY and NEXT_PUBLIC_VAPID_PUBLIC_KEY in Vercel — they must come from the SAME generated pair.',
      'Redeploy (the public key is inlined into the client bundle at build time).',
      'Come back here and click "Mark rotated".',
    ],
    impact:
      '⚠ Rotating invalidates EVERY existing push subscription — users must re-enable notifications. Rotate only on compromise.',
  },
  {
    id: 'encryption_key',
    label: 'ENCRYPTION_KEY (at-rest crypto for stored secrets)',
    group: 'internal',
    store: 'vercel',
    envVars: ['ENCRYPTION_KEY', 'ENCRYPTION_KEY_PREVIOUS'],
    editable: 'instructions-only',
    policyDays: null,
    providerUrl: VERCEL_ENV_SETTINGS,
    generateHint: OPENSSL_HINT,
    steps: [
      'Generate a NEW key: `openssl rand -base64 32`. Keep the CURRENT key in front of you — you need both.',
      'In Vercel, set ENCRYPTION_KEY_PREVIOUS = the CURRENT key, and ENCRYPTION_KEY = the NEW key. Two variables, one save.',
      'Redeploy production. The app now encrypts with the new key and still decrypts anything written under the old one.',
      'Click "Run re-encrypt sweep" on this page. Repeat until it reports failed = 0.',
      'Only then: delete ENCRYPTION_KEY_PREVIOUS in Vercel and redeploy again.',
    ],
    impact:
      'Encrypts the Integration-console secrets + stored OAuth tokens. NEVER rotate it without the dual-key procedure below — a naive swap silently kills email + stored OAuth.',
  },

  // ── infra ─────────────────────────────────────────────────────────────────
  {
    id: 'vercel_api_token',
    label: 'Vercel API token',
    group: 'infra',
    store: 'vercel',
    envVars: ['VERCEL_API_TOKEN'],
    editable: 'vercel-api',
    policyDays: 90,
    providerUrl: 'https://vercel.com/account/settings/tokens',
    steps: [
      'Create the NEW token first — the old one stays valid meanwhile.',
      'Paste it below and Save. (The save itself still authenticates with the OLD token — that is fine and expected.)',
      'Click "Redeploy production".',
      `Update the VERCEL_API_TOKEN copy in GitHub Actions at ${GITHUB_ACTIONS_SECRETS}.`,
      'Only now, delete the OLD token in Vercel.',
    ],
    impact:
      "Powers BYO custom domains AND this board's own Vercel writes — create-then-delete, never delete first.",
  },
  {
    id: 'signing_secrets',
    label: 'App-store signing (Apple + Android)',
    group: 'infra',
    store: 'github',
    envVars: [
      'APPLE_CERTIFICATE',
      'APPLE_PASSWORD',
      'APPLE_SIGNING_IDENTITY',
      'ANDROID_KEYSTORE_BASE64',
      'ANDROID_KEYSTORE_PASSWORD',
    ],
    editable: 'instructions-only',
    policyDays: null,
    providerUrl: GITHUB_ACTIONS_SECRETS,
    steps: [
      'Rotate ONLY if a signing identity is compromised — a new certificate changes the identity users already trust.',
      'Re-issue the certificate / keystore with Apple or Google.',
      'Update every affected GitHub Actions secret, then run the build-desktop / build-android workflow once.',
      'Come back here and click "Mark rotated".',
    ],
    impact:
      'Desktop/app signing identities. Rotate only if compromised — new certificates change the signing identity.',
  },
];

/** Lookup by id; undefined for an unknown id (every action rejects those). */
export function getSecretDef(id: string): SecretDef | undefined {
  return SECRET_REGISTRY.find((s) => s.id === id);
}

/**
 * The input fields a vercel-api row edits. Defaults to a single field bound to
 * the first env var — `fields` is only needed for pairs (R2, TURN).
 */
export function secretFields(def: SecretDef): { envVar: string; label: string }[] {
  if (def.fields && def.fields.length > 0) return def.fields;
  const primary = def.envVars[0];
  // No env var to bind to → no input. The registry test asserts every
  // vercel-api row declares at least one, so this is unreachable in practice.
  if (!primary) return [];
  return [{ envVar: primary, label: 'New value' }];
}

/** Human label for the store badge. */
export const STORE_LABEL: Record<SecretStore, string> = {
  vercel: 'Vercel env',
  db: 'In-app DB',
  github: 'GitHub Actions',
  local: 'Dev machine',
};

/** Display order + human headings for the grouped sections on the board. */
export const GROUP_ORDER: readonly SecretGroup[] = [
  'supabase',
  'storage',
  'email',
  'ai',
  'social',
  'payments',
  'observability',
  'internal',
  'infra',
];

export const GROUP_LABEL: Record<SecretGroup, string> = {
  supabase: 'Database — Supabase',
  storage: 'Storage & media — Cloudflare',
  email: 'Email',
  ai: 'AI services',
  social: 'Social & Google',
  payments: 'Payments',
  observability: 'Monitoring',
  internal: 'Setnayan-internal secrets',
  infra: 'Infrastructure & release',
};

/**
 * Integration-console secret column → registry id. Lets the existing
 * /admin/integrations save actions stamp a rotation row without duplicating the
 * registry. Columns mirror lib/integrations/registry.ts exactly.
 */
export const CONSOLE_COLUMN_TO_SECRET_ID: Readonly<Record<string, string>> = {
  resend_api_key_enc: 'resend',
  openai_api_key_enc: 'openai',
  meta_page_access_token_enc: 'meta_page_token',
  youtube_oauth_client_secret_enc: 'youtube_oauth',
  google_drive_oauth_client_secret_enc: 'gdrive_oauth',
  tiktok_client_secret_enc: 'tiktok_oauth',
  tiktok_access_token_enc: 'tiktok_publish',
  maya_public_api_key_enc: 'maya_keys',
  maya_secret_api_key_enc: 'maya_keys',
};

/**
 * The console secret column(s) backing a registry id — the inverse of the map
 * above. Lets the board say "currently set" / "not configured yet" for db-paste
 * rows from the console's boolean presence map, WITHOUT ever reading a value.
 */
export function consoleColumnsForSecret(id: string): string[] {
  return Object.entries(CONSOLE_COLUMN_TO_SECRET_ID)
    .filter(([, secretId]) => secretId === id)
    .map(([column]) => column);
}
