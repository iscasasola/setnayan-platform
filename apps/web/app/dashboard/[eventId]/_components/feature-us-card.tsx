import { Check, Megaphone } from 'lucide-react';
import { SubmitButton } from '@/app/_components/submit-button';
import { grantShareConsent } from '@/app/dashboard/[eventId]/_actions/share-consent';
import type { ShareArtifactType } from '@/lib/social-sharing';

/**
 * FeatureUsCard — per-artifact opt-in for the Social Sharing & Featuring
 * Program (corpus `03_Strategy/Social_Sharing_Program_2026-06-12.md` +
 * migration 20261203000000_social_sharing_program).
 *
 * A quiet card under a creation surface (monogram maker, save-the-date
 * gallery, …) asking the couple to let Setnayan feature that creation on the
 * Setnayan Facebook page — only AFTER their event (the publish gate lives
 * app-side: lib/social-sharing.ts). Server-component friendly: a plain form
 * posting to grantShareConsent, no client JS. Already-consented renders a
 * one-line confirmation pointing at Profile → Privacy for revocation.
 */
export function FeatureUsCard({
  eventId,
  artifactType,
  artifactRef,
  alreadyConsented,
  revalidatePath,
}: {
  eventId: string;
  artifactType: ShareArtifactType;
  artifactRef: string;
  /** The live (revoked_at IS NULL) consent row for this artifact, or null. */
  alreadyConsented: { consent_id: string; credit_mode: string } | null;
  /** Path of the page rendering this card — revalidated after the grant. */
  revalidatePath: string;
}) {
  if (alreadyConsented) {
    return (
      <p className="inline-flex items-start gap-2 rounded-xl border border-ink/10 bg-cream p-4 text-sm text-ink/65">
        <Check
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          strokeWidth={2.5}
        />
        <span>
          You&rsquo;ve allowed Setnayan to feature this after your big day —
          manage in Profile &rarr; Privacy.
        </span>
      </p>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-4">
      <div className="flex items-start gap-2">
        <Megaphone
          aria-hidden
          className="mt-0.5 h-4 w-4 shrink-0 text-terracotta"
          strokeWidth={1.75}
        />
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-ink">Proud of this one?</h2>
          <p className="text-xs text-ink/65">
            Allow Setnayan to feature this creation on our Facebook page — only
            after your big day, never before. Revoke any time from Profile
            &rarr; Privacy &amp; data.
          </p>
        </div>
      </div>
      <form action={grantShareConsent} className="space-y-3">
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="artifact_type" value={artifactType} />
        <input type="hidden" name="artifact_ref" value={artifactRef} />
        <input type="hidden" name="revalidate_path" value={revalidatePath} />
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition hover:border-ink/30 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700">
            <input
              type="radio"
              name="credit_mode"
              value="first_names"
              defaultChecked
              className="h-3.5 w-3.5 border-ink/25 text-terracotta focus:ring-terracotta/40"
            />
            <span>Credit us by first names</span>
          </label>
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-ink/15 bg-cream px-3 py-1.5 text-xs text-ink/75 transition hover:border-ink/30 has-[:checked]:border-terracotta has-[:checked]:bg-terracotta/10 has-[:checked]:text-terracotta-700">
            <input
              type="radio"
              name="credit_mode"
              value="anonymous"
              className="h-3.5 w-3.5 border-ink/25 text-terracotta focus:ring-terracotta/40"
            />
            <span>Keep us anonymous</span>
          </label>
        </div>
        <SubmitButton className="button-secondary text-xs" pendingLabel="Saving…">
          Allow featuring
        </SubmitButton>
      </form>
    </section>
  );
}
