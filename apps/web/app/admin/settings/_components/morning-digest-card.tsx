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
import { InfoTip } from '@/app/_components/info-tip';
import { TEMPLATE_SUBLINE } from '@/app/_components/template-rows';
import { ConfirmButton } from '@/app/admin/_components/avatar-confirm';
import { ConfirmLines } from '@/app/admin/_components/avatar-screen';
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
    <section aria-labelledby="morning-digest-heading" id="morning-digest" className="scroll-mt-28">
      <h2 id="morning-digest-heading" className="mt-[18px] flex min-h-9 items-center gap-2 pb-1 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
        <InfoTip label="Morning digest" align="start" labelClassName="uppercase">
          An 8 AM (Manila) email of what&rsquo;s waiting, only when something is. In-app notifications and phone alerts
          keep coming either way.
        </InfoTip>
      </h2>
      <div className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 py-2">
        <span className="min-w-0 flex-1 basis-48">
          <b className="block text-[15px] font-semibold leading-tight text-ink">
            {readFailed ? 'Morning digest' : `It’s ${on ? 'on' : 'off'}`}
          </b>
          <span role="status" className={`mt-0.5 block ${TEMPLATE_SUBLINE}`}>
            {lastDigestWords(last)}
          </span>
        </span>
        {readFailed ? (
          <span role="alert" className="text-[13px]" style={{ color: 'rgb(var(--color-warn))' }}>
            Couldn&rsquo;t load the setting, so the switch is off until it loads. Refresh to try again.
          </span>
        ) : (
          <ConfirmButton
            action={saveAdminDigest}
            fields={on ? {} : { admin_digest_enabled: 'on' }}
            tone={on ? 'neutral' : 'ok'}
            icon={on ? 'pause' : 'play'}
            label={on ? 'Turn off' : 'Turn on'}
            title={on ? 'Turn the morning digest off' : 'Turn the morning digest on'}
            confirmLabel={on ? 'Turn off' : 'Turn on'}
            body={
              <ConfirmLines
                what={on ? ['No 8 AM email from tomorrow'] : ['An 8 AM email of what’s waiting, from tomorrow']}
                not={on ? ['In-app notifications and phone alerts keep coming'] : []}
                who="Every admin who gets the digest"
              />
            }
            data="morning-digest"
          />
        )}
      </div>
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
