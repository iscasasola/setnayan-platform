## 2026-07-31 · fix(privacy): the cross-border disclosure claimed the US and the Philippines at once

`/privacy` is a **public, legally-operative disclosure** under RA 10173 § 21. Its
cross-border transfers paragraph read:

> Cross-border data transfers — Singapore (Supabase), **United States (Cloudflare R2
> PH-region buckets)**, United States (Anthropic Console…)

Two things wrong in one phrase:

1. **It claims the United States and the Philippines simultaneously** for the same
   storage. Both cannot be true.
2. **"PH-region" is not a thing.** Cloudflare R2 has no Philippines region.

**The page already contradicted itself.** Its own *Subprocessors* section, further
down the same page, correctly says `Cloudflare (CDN + R2 object storage · APAC
region)`. This PR makes the cross-border paragraph agree with it, and with the
ADOPTED `NPC_Compliance/01_Privacy_Manual_ADOPTED_2026-07-24.md` § 5.3, which has
said APAC all along.

**Also made accurate in the same paragraph** (carrying over the 2026-07-31 compliance
sweep): the notice now says *where the biometric face vector actually lives* —
**Supabase, Singapore** (`guest_face_enrollments.face_vector`, `user_face_profiles`),
with R2 holding the **source selfie image**, not the vector. And it now states
plainly: **none of our infrastructure is hosted inside the Philippines.** A reader
could previously have come away believing their photos sat in a Philippine data
centre.

Last-updated bumped 2026-07-30 → 2026-07-31.

### Root cause, and what is deliberately left alone

The false claim originates in the spec corpus' own `CLAUDE.md` (*"Data residency:
Cloudflare R2 PH-region buckets"*), which is loaded into every Claude Code session —
so it kept getting re-asserted. **Both lines there are corrected in the same session**
(corpus commit), which is the actual fix; this PR is the public-facing half.

Several **internal** files still say "PH region" — `.env.example`, `STATUS.md`,
`lib/r2.ts`, `file-upload.tsx` comments. They are engineering shorthand, not legally
operative, and correcting them means asserting a specific region I **cannot verify
without the Cloudflare dashboard**. They are left for the owner's confirmation sweep
rather than changed on a guess. *(Note: `lib/regions.ts` and the pricing token-bands
surface also match "PH region" — those are the Philippine **geographic** taxonomy for
the planner wizard, entirely unrelated, and must not be touched.)*

⚠ **OWNER / DPO — one fact still needed:** the actual bucket location hint in the
Cloudflare dashboard. This PR aligns the page with our own adopted manual, which is
defensible today; if the dashboard says something other than APAC, the page needs one
more edit.

⚠ **Separate finding, NOT changed here:** the public notice discloses **Sentry** and
**PostHog Cloud** as subprocessors, but the NPC pack's sub-processor table
(`platform_compliance_facts.sub_processors`, 9 entries) lists neither. Our published
disclosure is broader than our filing record. Adding a sub-processor to the NPC pack
is a compliance assertion, not a copy fix — flagged for the DPO.

SPEC IMPACT: **Yes — applied in the corpus this session.**
`~/Documents/Claude/Projects/Setnayan/CLAUDE.md` lines 184 and 295 (the origin of the
claim) now state APAC + "nothing is hosted in the Philippines", and carry the
dashboard-confirmation flag. The NPC pack was corrected earlier the same day.
