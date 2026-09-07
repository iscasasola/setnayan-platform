# MB8 — The paid render pipeline

**Goal:** a credit actually becomes a photograph.

**Model:** Opus · high effort — money moves, an external API can fail silently, and every failure
mode here is the *renders-identically-to-success* disease this repo keeps burying.
**Size:** 1.5 days. **Depends on:** MB2, MB7, **and the Gemini key in Vercel.**

## 🛑 Blocked until the owner provisions the key

Without `GEMINI_API_KEY` in Vercel the pipeline sends **nothing, silently** — the exact
`RESEND_API_KEY` failure shape that left the owner un-notified of payments for months. Server-side
vars are not readable from a session at all, so this cannot be verified from here. Provision it
before MB8 merges.

## Delivers

- `lib/<imageprovider>.ts` — Gemini img2img conditioned on the scene SVG + the couple's
  inspirations + `buildPrompt()` + the box note
- The render server action with the **1-credit / 5-credit debit** and instant decrement
- Every render written to R2 **and** `event_renders` — the owner keeps a copy of everything, which
  is what makes the free cache lane possible later
- Insufficient balance **says so** and offers the pack
- The couple-private gallery
- The admin all-creations gallery with the featured toggle — admin sees everything regardless of
  consent (locked decision)
- The +1 consent bonus render

## Verify

- `pnpm exec tsc --noEmit` from `apps/web`
- **guard: a failed provider call renders as a failure on the box, and does not debit** — sabotage:
  swallow the error, confirm red. A log line never changed a pixel; the measurement must reach the
  render.
- db tests for the debit RPC
- `node apps/web/scripts/lint-events-column-grants.mjs` if `events` columns are touched
- **manual E2E against a test event in prod after merge** — open the page. A flag's default in code
  is not its value in production.

## Owner decides first

The Gemini key.
