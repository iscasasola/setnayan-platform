import { Cloud, Lock, CheckCircle2, ExternalLink, FolderTree, Unlink2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { startRead } from '@/lib/start-read';
import { SubmitButton } from '@/app/_components/submit-button';
import { DriveSafetyPanel, DriveReconnectBanner } from '@/app/_components/drive-connect-card';
import { PAPIC_DRIVE_SUBFOLDERS } from '@/lib/papic-drive';

/**
 * drive-copy-card.tsx — Google Drive as a COPY, moved out of the Papic page (owner 2026-10-23: "Google Drive" is a
 * Gallery setting — Memories › ⚙). The card and its panels are unchanged; only their file moved.
 */

export type DriveGrant = {
  grant_id: string;
  external_account_display: string | null;
  granted_at: string;
  connection_health: 'ok' | 'needs_reauth' | null;
  metadata: {
    drive_folder_name?: string;
    drive_subfolders?: Array<{ name: string; id: string }>;
    account_name?: string;
  } | null;
};

// -----------------------------------------------------------------------------
// Yours to keep — the Google Drive copy offer
// -----------------------------------------------------------------------------

/**
 * ⚠ THIS REPLACED A CHOICE THAT NEVER DID ANYTHING.
 *
 * Until 2026-08-26 this card asked "Where your photos go" and offered a
 * radiogroup: Setnayan storage, or "Use my Google Drive only". Measured on
 * `origin/main` before the change, `events.papic_storage_target` was read by
 * exactly THREE files — the card that drew it, the actions that wrote it, and
 * the Drive disconnect route. **No capture, upload or storage path read it**,
 * and the comment describing that branch was still a `TODO(0012)`. So "only"
 * was never true: every photo has always landed in Setnayan storage, including
 * for the events sitting in `google_drive_only`.
 *
 * Owner ruling, verbatim: *"i was thinking of not asking for setnayan storage?
 * what we want is to offer them to sync this to a google drive."* Which is the
 * system as BUILT — we hold the photos, Drive is a copy on top. It also repairs
 * a promise the either/or broke: we tell couples we keep their gallery for
 * life, which is impossible for photos we never held.
 *
 * 🔑 The COLUMN is deliberately left in place. It is inert for capture, the
 * disconnect route still resets legacy `google_drive_only` rows, and dropping a
 * column to delete a question nobody is asked any more is risk with no payoff.
 */
export function DriveCopyCard({
  eventId,
  driveOAuthReady,
  driveGrant,
  loginEmail,
}: {
  eventId: string;
  driveOAuthReady: boolean;
  driveGrant: DriveGrant | null;
  loginEmail: string | null;
}) {
  const connected = !!driveGrant;

  return (
    <article
      id="papic-storage"
      className="scroll-mt-20 space-y-4 sn-tile p-5 sm:p-6"
    >
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Cloud aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
          Send a copy to your Google Drive
          {!driveOAuthReady ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
              <Lock aria-hidden className="h-3 w-3" strokeWidth={2} />
              Coming soon
            </span>
          ) : connected ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-900">
              <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
              Connected
            </span>
          ) : null}
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          Every photo lands in your own Drive too, as it arrives — so you keep
          the originals at full size, on a drive you control. We keep your
          Memories either way.
        </p>
      </div>

      {!driveOAuthReady ? (
        <p className="text-xs italic text-ink/55">
          Coming soon — Setnayan&rsquo;s Drive verified-app review is in
          progress. Your photos are safe with us today; we&rsquo;ll email you
          when Drive is ready.
        </p>
      ) : connected ? (
        <DriveConnectedPanel eventId={eventId} grant={driveGrant!} loginEmail={loginEmail} />
      ) : (
        <DriveConnectCTA eventId={eventId} />
      )}
    </article>
  );
}

function DriveConnectCTA({ eventId }: { eventId: string }) {
  return (
    <div className="space-y-3">
      <DriveSafetyPanel />
      <a
        href={`/api/oauth/drive/start?event_id=${eventId}`}
        className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream transition-colors hover:bg-mulberry-600"
      >
        <ExternalLink aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Connect Google Drive
      </a>
      <p className="text-xs text-ink/55">
        ~20 seconds. Connect once — it covers your recap and photographer hand-off too.
      </p>
    </div>
  );
}

async function DriveConnectedPanel({
  eventId,
  grant,
  loginEmail,
}: {
  eventId: string;
  grant: DriveGrant;
  loginEmail: string | null;
}) {
  const accountLabel = grant.external_account_display ?? 'Connected Drive';

  // The 2nd Drive (owner 2026-07-11 · up to 2 Drives per event). Queried here so
  // the connected panel can show its state without threading through 3 parents.
  const overflowSupabase = await createClient();
  // ⏱ The 2nd Drive and the "storage is full" count need nothing from each other — both start now.
  const overflowGrantRead = startRead(
    overflowSupabase
      .from('oauth_grants')
      .select('external_account_display, connection_health')
      .eq('event_id', eventId)
      .eq('provider', 'drive_overflow')
      .is('revoked_at', null)
      .maybeSingle()
      .then((r) => r.data ?? null),
  );
  const strandedFullRead = startRead(
    overflowSupabase
      .from('drive_copy_artifacts')
      .select('artifact_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .is('drive_file_id', null)
      .gte('attempt_count', 5)
      .ilike('last_error_text', '%storageQuotaExceeded%'),
  );
  const overflowGrant = (await overflowGrantRead) as {
    external_account_display: string | null;
    connection_health: 'ok' | 'needs_reauth' | null;
  } | null;

  // "Storage is full" detection: originals that exhausted every retry with a
  // Drive-quota error (Drive #1 full and no usable overflow, or BOTH full). The
  // web gallery is always safe on R2 — this only means some full-res didn't reach
  // Drive. Count is capped at 1 (head:true) — we only need "any".
  const strandedFull = (await strandedFullRead).count ?? 0;
  const grantedDate = new Date(grant.granted_at).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
  const subfolders =
    grant.metadata?.drive_subfolders?.map((s) => s.name) ?? [...PAPIC_DRIVE_SUBFOLDERS];
  const folderName = grant.metadata?.drive_folder_name ?? 'Setnayan';
  const accountMismatch =
    !!grant.external_account_display &&
    !!loginEmail &&
    grant.external_account_display !== loginEmail;

  return (
    <div className="space-y-3">
      {grant.connection_health === 'needs_reauth' ? (
        <DriveReconnectBanner reconnectHref={`/api/oauth/drive/start?event_id=${eventId}`} />
      ) : null}

      {strandedFull > 0 ? (
        <div className="rounded-xl bg-amber-50/70 p-3 text-[12px] text-amber-900">
          <p className="font-medium">Your Drive is full.</p>
          <p className="mt-0.5 text-amber-800">
            Some full-resolution originals couldn&rsquo;t be saved to Drive — your
            Memories are safe here, but the full-res copies are waiting. Free up
            space{overflowGrant ? ' on either Drive' : ''}, or{' '}
            <a
              href={`/api/oauth/drive/start?event_id=${eventId}&slot=overflow`}
              className="font-medium underline underline-offset-2"
            >
              {overflowGrant ? 'connect more space' : 'connect a second Drive you own'}
            </a>{' '}
            — they&rsquo;ll finish uploading automatically.
          </p>
        </div>
      ) : null}

      <div className="space-y-3 rounded-xl bg-success-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-semibold text-ink">
              Connected to Google Drive as {accountLabel}
            </p>
            <p className="font-mono text-[11px] text-ink/55">Connected {grantedDate}</p>
            {accountMismatch ? (
              <p className="text-[11px] text-ink/60">
                Not your sign-in ({loginEmail}). That&rsquo;s fine — photos save to{' '}
                {grant.external_account_display}.{' '}
                <a
                  href={`/api/oauth/drive/start?event_id=${eventId}&switch=1`}
                  className="font-medium text-mulberry underline-offset-2 hover:underline"
                >
                  Use a different account
                </a>
              </p>
            ) : null}
            {overflowGrant ? (
              <div className="space-y-1 text-[11px]">
                <p className="text-ink/60">
                  2nd Drive connected as{' '}
                  <span className="font-medium text-ink/75">
                    {overflowGrant.external_account_display ?? 'your second Drive'}
                  </span>{' '}
                  — new photos overflow here once the first fills.
                </p>
                {overflowGrant.connection_health === 'needs_reauth' ? (
                  <p className="text-danger-600">
                    Your 2nd Drive needs to reconnect —{' '}
                    <a
                      href={`/api/oauth/drive/start?event_id=${eventId}&slot=overflow`}
                      className="font-medium underline underline-offset-2"
                    >
                      reconnect it
                    </a>
                    .
                  </p>
                ) : null}
                <form action="/api/oauth/drive/disconnect" method="post">
                  <input type="hidden" name="event_id" value={eventId} />
                  <input type="hidden" name="slot" value="overflow" />
                  <SubmitButton
                    pendingLabel="Disconnecting…"
                    className="text-ink/45 underline underline-offset-2 transition-colors hover:text-ink/70"
                  >
                    Disconnect 2nd Drive
                  </SubmitButton>
                </form>
              </div>
            ) : (
              <p className="text-[11px] text-ink/60">
                Running low on space? Full-resolution photos always live in your own
                Drive — if it fills up, add a second one.{' '}
                <a
                  href={`/api/oauth/drive/start?event_id=${eventId}&slot=overflow`}
                  className="font-medium text-mulberry underline-offset-2 hover:underline"
                >
                  Connect a second Drive you own
                </a>
                . New photos overflow into it automatically once the first is full.
              </p>
            )}
          </div>
          <form action="/api/oauth/drive/disconnect" method="post">
            <input type="hidden" name="event_id" value={eventId} />
            <SubmitButton
              pendingLabel="Disconnecting…"
              className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-1.5 text-xs font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink"
            >
              <Unlink2 aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              Disconnect
            </SubmitButton>
          </form>
        </div>

        <div className="rounded-lg bg-cream/80 p-3">
          <div className="flex items-center gap-1.5 text-ink/65">
            <FolderTree aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
              Folder structure ready in your Drive
            </span>
          </div>
          <p className="mt-1.5 font-mono text-xs text-ink/85">Setnayan / {folderName} /</p>
          <ul className="mt-1 space-y-0.5 pl-4 font-mono text-xs text-ink/65">
            {subfolders.map((name) => (
              <li key={name}>{name}/</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

