import { Mail } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchPlatformSettingsMeasured } from '@/lib/platform-settings';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  DIGEST_EMAIL_KIND,
  DIGEST_SUBJECT_PREFIX,
  summarizeDigestSends,
  type DigestSendRow,
  type LastDigest,
} from '@/lib/admin/digest-content';
import { SubmitButton } from '@/app/_components/submit-button';
import { saveAdminDigest } from '@/app/admin/settings/actions';

/**
 * The morning digest — its switch AND whether it actually went out (admin
 * audit row 38, owner 2026-10-01). It lived on Settings as a checkbox that only
 * said "on" or "off"; "on" told nobody whether a single email had been sent, and
 * the flush stamped "sent" before it knew. Here the switch sits next to the
 * delivery log's own answer.
 *
 * Reads the delivery log by kind ('admin_digest', since 2026-10-01) OR by
 * subject (older digests were logged as 'other'). A refused read is said as
 * such — never as "no digest sent yet".
 */
export async function MorningDigestCard() {
  const admin = createAdminClient();
  const { settings, readFailed } = await fetchPlatformSettingsMeasured(admin);

  let rows: DigestSendRow[] | null = null;
  const { data, error } = await admin
    .from('email_deliveries')
    .select('created_at, outcome, error')
    // Quoted: the prefix carries a space and a middle dot. `*` is PostgREST's
    // like-wildcard inside an .or() string.
    .or(`kind.eq.${DIGEST_EMAIL_KIND},subject.like."${DIGEST_SUBJECT_PREFIX}*"`)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) logQueryError('admin/settings: digest deliveries', error);
  else rows = (data ?? []) as DigestSendRow[];

  const last = summarizeDigestSends(rows);
  const on = settings.admin_digest_enabled;

  return (
    <section className="mb-6 space-y-3 sn-tile p-5" aria-labelledby="morning-digest">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <h2 id="morning-digest" className="text-sm font-semibold text-ink">
          Morning digest
        </h2>
      </div>
      <p className="text-xs text-ink/60">
        An 8 AM (Manila) email of what&rsquo;s waiting, only when something is.
      </p>
      <p role="status" className="text-sm text-ink">
        {lastDigestWords(last)}
      </p>
      {readFailed ? (
        <p role="alert" className="text-xs text-warn-900">
          Couldn&rsquo;t load the setting, so the switch is off until it loads. Refresh to try again.
        </p>
      ) : (
        <form action={saveAdminDigest} className="flex flex-wrap items-center gap-3">
          {/* One button: it flips to the opposite of what is saved. */}
          {on ? null : <input type="hidden" name="admin_digest_enabled" value="on" />}
          <span className="text-xs text-ink/60">
            It&rsquo;s <span className="font-semibold text-ink/80">{on ? 'on' : 'off'}</span>.
          </span>
          <SubmitButton
            className="button-secondary inline-flex items-center gap-2"
            pendingLabel="Saving…"
          >
            {on ? 'Turn off' : 'Turn on'}
          </SubmitButton>
        </form>
      )}
    </section>
  );
}

/** The delivery log's answer, in one plain sentence. */
export function lastDigestWords(last: LastDigest): string {
  const when = (iso: string) =>
    new Date(iso).toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  switch (last.state) {
    case 'unread':
      return 'Couldn’t check when the last digest went out.';
    case 'never':
      return 'No digest has been sent yet.';
    case 'sent':
      return `Last digest sent ${when(last.at)}.`;
    case 'failed':
      return (
        `Last send failed ${when(last.at)} — ${last.reason}.` +
        (last.lastSentAt ? ` The last one that went out: ${when(last.lastSentAt)}.` : '')
      );
  }
}
