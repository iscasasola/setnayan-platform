import { Plus, Trash2 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { relativeTime } from '@/lib/activity';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatCount } from '@/lib/format-number';
import {
  addCardClaimWord,
  grantCardClaimWordAllowance,
  removeCardClaimWord,
  removeCardClaimWordAllowance,
} from './actions';

/**
 * 🃏 SERVICE CARD CHECKS on the shipped Repost watch page (owner 2026-10-26, "fix before Create").
 *
 * Two pieces, both READ by admin and neither a review queue — the card maker already stopped the card, and the
 * supplier fixes it themselves:
 *   · `SupplierPhotoReports` — "It's mine — report it": the supplier who was told a photo is on another shop's card
 *     said it is theirs. A LIST of `vendor_image_flags` rows carrying `supplier_reported_at`, newest first. The same
 *     row sits in the flags list below with its Dismiss / Confirm / Escalate, so nothing new is decided here.
 *   · `CardChecksAdmin` — the claim words the maker refuses (`card_claim_words`) and the shops allowed one
 *     (`card_claim_word_allowances`).
 */

type ReportRow = {
  id: number;
  public_id: string;
  flagged_vendor_id: string;
  flagged_r2_ref: string;
  source_vendor_id: string;
  source_r2_ref: string;
  hamming_distance: number;
  status: string;
  supplier_reported_at: string;
  supplier_report_note: string | null;
};

const BTN =
  'inline-flex min-h-9 items-center gap-1.5 rounded-md border border-ink/15 bg-white/70 px-3 text-xs font-medium text-ink/80 hover:bg-ink/[0.04]';
const FIELD = 'h-9 rounded-md border border-ink/15 bg-white px-2.5 text-sm text-ink';

async function shopNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await createAdminClient()
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name')
    .in('vendor_profile_id', ids);
  if (error) logQueryError('card-checks-admin (vendor_profiles)', error);
  for (const v of (data ?? []) as { vendor_profile_id: string; business_name: string | null }[]) {
    out.set(v.vendor_profile_id, (v.business_name ?? '').trim() || 'Unnamed supplier');
  }
  return out;
}

export async function SupplierPhotoReports() {
  const { data, error } = await createAdminClient()
    .from('vendor_image_flags')
    .select(
      'id, public_id, flagged_vendor_id, flagged_r2_ref, source_vendor_id, source_r2_ref, hamming_distance, status, supplier_reported_at, supplier_report_note',
    )
    .not('supplier_reported_at', 'is', null)
    .order('supplier_reported_at', { ascending: false })
    .limit(50);
  if (error) logQueryError('SupplierPhotoReports (vendor_image_flags)', error);
  const rows = (data ?? []) as ReportRow[];
  const names = await shopNames(Array.from(new Set(rows.flatMap((r) => [r.flagged_vendor_id, r.source_vendor_id]))));
  const urls = new Map(
    await Promise.all(
      rows.flatMap((r) => [
        (async () => [`f-${r.id}`, await displayUrlForStoredAsset(r.flagged_r2_ref)] as const)(),
        (async () => [`s-${r.id}`, await displayUrlForStoredAsset(r.source_r2_ref)] as const)(),
      ]),
    ),
  );

  return (
    <section className="mb-6" id="supplier-photo-reports" data-admin-photo-reports={rows.length}>
      <h2 className="text-base font-semibold text-ink">
        Suppliers who say a photo is theirs{rows.length > 0 ? ` · ${formatCount(rows.length)}` : ''}
      </h2>
      <p className="mt-1 text-sm text-ink/65">
        A supplier was told a photo is already on another shop’s service card and pressed “It’s mine — report it”.
        Their card stays blocked until they replace the photo; the same pair is in the list below if you want to
        record a verdict.
      </p>
      {error ? (
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--color-danger))' }}>
          Reports couldn’t load right now — refresh in a moment.
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink/55">No reports.</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/10">
          {rows.map((r) => {
            const mine = urls.get(`f-${r.id}`) ?? null;
            const theirs = urls.get(`s-${r.id}`) ?? null;
            return (
              <li key={r.id} className="flex flex-wrap items-start gap-3 py-3" data-photo-report={r.public_id}>
                <div className="flex flex-none gap-1.5">
                  {[mine, theirs].map((u, i) =>
                    u ? (
                      // eslint-disable-next-line @next/next/no-img-element -- presigned admin thumbnail
                      <img key={i} src={u} alt={i === 0 ? 'The reporting supplier’s photo' : 'The photo already on a card'} className="h-14 w-14 rounded-md object-cover" />
                    ) : (
                      <span key={i} className="h-14 w-14 rounded-md bg-ink/10" aria-hidden />
                    ),
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="text-ink">
                    <b>{names.get(r.flagged_vendor_id) ?? 'Supplier'}</b> says it’s theirs · already on{' '}
                    <b>{names.get(r.source_vendor_id) ?? 'Supplier'}</b>’s card
                  </p>
                  {r.supplier_report_note ? <p className="mt-0.5 text-ink/75">“{r.supplier_report_note}”</p> : null}
                  <p className="mt-0.5 text-xs text-ink/50">
                    {relativeTime(r.supplier_reported_at)} · distance {r.hamming_distance} · {r.status.replace('_', ' ')} · {r.public_id}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export async function CardChecksAdmin() {
  const admin = createAdminClient();
  const [wordsRes, allowRes, shopsRes] = await Promise.all([
    admin.from('card_claim_words').select('phrase, note').order('phrase'),
    admin.from('card_claim_word_allowances').select('vendor_profile_id, phrase, note, granted_at').order('granted_at', { ascending: false }),
    admin.from('vendor_profiles').select('vendor_profile_id, business_name').eq('is_demo', false).order('business_name').limit(500),
  ]);
  if (wordsRes.error) logQueryError('CardChecksAdmin (card_claim_words)', wordsRes.error);
  if (allowRes.error) logQueryError('CardChecksAdmin (card_claim_word_allowances)', allowRes.error);
  if (shopsRes.error) logQueryError('CardChecksAdmin (vendor_profiles)', shopsRes.error);
  const words = (wordsRes.data ?? []) as { phrase: string; note: string | null }[];
  const allowances = (allowRes.data ?? []) as { vendor_profile_id: string; phrase: string; note: string | null; granted_at: string }[];
  const shops = ((shopsRes.data ?? []) as { vendor_profile_id: string; business_name: string | null }[]).map((s) => ({
    id: s.vendor_profile_id,
    name: (s.business_name ?? '').trim() || 'Unnamed supplier',
  }));
  const names = await shopNames(Array.from(new Set(allowances.map((a) => a.vendor_profile_id))));

  return (
    <section className="mt-10 border-t border-ink/10 pt-6" id="card-claim-words" data-admin-claim-words={words.length}>
      <h2 className="text-base font-semibold text-ink">Claim words on service cards</h2>
      <p className="mt-1 text-sm text-ink/65">
        The card maker keeps Create shut while a card’s name, a what’s-included line or an extra carries one of these
        (whole word, any case), and shows the supplier the note as the reason. Allow a word for one shop below.
      </p>

      {wordsRes.error ? (
        <p className="mt-2 text-sm" style={{ color: 'rgb(var(--color-danger))' }}>
          The word list couldn’t load right now — refresh in a moment.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-ink/10">
          {words.map((w) => (
            <li key={w.phrase} className="flex items-center gap-3 py-2 text-sm">
              <b className="w-32 flex-none text-ink">{w.phrase}</b>
              <span className="min-w-0 flex-1 text-ink/70">{w.note ?? '—'}</span>
              <form action={removeCardClaimWord}>
                <input type="hidden" name="phrase" value={w.phrase} />
                <SubmitButton className={BTN} pendingLabel="Removing…">
                  <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addCardClaimWord} className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-xs text-ink/70">
          Word or phrase
          <input name="phrase" required maxLength={60} placeholder="e.g. cheapest" className={FIELD} />
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink/70">
          Why (the supplier reads this)
          <input name="note" maxLength={200} placeholder="A comparison with other shops we can’t check." className={`${FIELD} w-full`} />
        </label>
        <SubmitButton className={BTN} pendingLabel="Adding…">
          <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Add word
        </SubmitButton>
      </form>

      <h3 className="mt-6 text-sm font-semibold text-ink">
        Allowed for one shop{allowances.length > 0 ? ` · ${formatCount(allowances.length)}` : ''}
      </h3>
      {allowances.length === 0 ? (
        <p className="mt-1 text-sm text-ink/55">No shop holds an allowance.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink/10">
          {allowances.map((a) => (
            <li key={`${a.vendor_profile_id}:${a.phrase}`} className="flex items-center gap-3 py-2 text-sm">
              <span className="min-w-0 flex-1 text-ink">
                <b>{names.get(a.vendor_profile_id) ?? 'Supplier'}</b> may use “{a.phrase}”
                {a.note ? <span className="text-ink/60"> · {a.note}</span> : null}
              </span>
              <form action={removeCardClaimWordAllowance}>
                <input type="hidden" name="phrase" value={a.phrase} />
                <input type="hidden" name="vendor_profile_id" value={a.vendor_profile_id} />
                <SubmitButton className={BTN} pendingLabel="Removing…">
                  <Trash2 aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Remove
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}
      {words.length > 0 && shops.length > 0 ? (
        <form action={grantCardClaimWordAllowance} className="mt-3 flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink/70">
            Shop
            <select name="vendor_profile_id" required className={FIELD} defaultValue="">
              <option value="" disabled>
                Pick a shop
              </option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink/70">
            Word
            <select name="phrase" required className={FIELD} defaultValue="">
              <option value="" disabled>
                Pick a word
              </option>
              {words.map((w) => (
                <option key={w.phrase} value={w.phrase}>
                  {w.phrase}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs text-ink/70">
            Why (for admin)
            <input name="note" maxLength={200} placeholder="e.g. appointed caterer of the venue" className={`${FIELD} w-full`} />
          </label>
          <SubmitButton className={BTN} pendingLabel="Allowing…">
            <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={2} /> Allow
          </SubmitButton>
        </form>
      ) : null}
    </section>
  );
}
