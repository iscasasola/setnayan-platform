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
