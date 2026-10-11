/**
 * RELEASE REHEARSAL — seeds the fixture into the throw-away stack.
 *
 *   1. The host ACCOUNT is created through GoTrue's own admin endpoint, so the
 *      real `on_auth_user_created` trigger provisions the profile row exactly
 *      as a real sign-up does. The password is made by the workflow for this
 *      run, handed in by env, and never printed.
 *   2. Everything else (the event, 30 guests, 12 suppliers, 3 orders) is
 *      `seed.sql`, run as `postgres`.
 *
 * ⛔ Both addresses must be this machine (`assertLocalUrl`).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE } from './fixture';
import { assertLocalUrl } from './local-only';

const HERE = path.dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const api = assertLocalUrl(process.env.REHEARSAL_API_URL ?? '', 'the rehearsal auth API');
  const db = assertLocalUrl(process.env.REHEARSAL_DB_URL ?? '', 'the rehearsal database');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  const password = process.env.REHEARSAL_HOST_PASSWORD ?? '';
  if (!serviceKey || !password) throw new Error('seed: the local service key or the host password is missing.');

  const res = await fetch(new URL('/auth/v1/admin/users', api), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email: FIXTURE.hostEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: FIXTURE.groomName },
    }),
  });
  if (!res.ok) {
    throw new Error(`seed: the auth server refused to create the host (${res.status} ${await res.text()})`);
  }

  const r = spawnSync(
    'psql',
    [
      '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-1',
      ...Object.entries({
        host_email: FIXTURE.hostEmail,
        event_id: FIXTURE.eventId,
        slug: FIXTURE.slug,
        event_name: FIXTURE.eventName,
        bride_name: FIXTURE.brideName,
        groom_name: FIXTURE.groomName,
        guest_id: FIXTURE.invitedGuest.id,
        guest_first: FIXTURE.invitedGuest.firstName,
        guest_last: FIXTURE.invitedGuest.lastName,
        guest_token: FIXTURE.invitedGuest.qrToken,
        other_guests: String(FIXTURE.otherGuests),
        attending: String(FIXTURE.attendingAtStart),
      }).flatMap(([k, v]) => ['-v', `${k}=${v}`]),
      '-f', path.join(HERE, 'seed.sql'),
    ],
    {
      env: {
        ...process.env,
        PGHOST: db.hostname,
        PGPORT: db.port || '5432',
        PGUSER: decodeURIComponent(db.username || 'postgres'),
        PGPASSWORD: decodeURIComponent(db.password || ''),
        PGDATABASE: db.pathname.replace(/^\//, '') || 'postgres',
      },
      encoding: 'utf8',
    },
  );
  if (r.stdout) process.stdout.write(r.stdout);
  if (r.status !== 0) throw new Error(`seed.sql failed:\n${r.stderr}`);
  if (r.stderr) process.stderr.write(r.stderr);
}

main().catch((e: unknown) => {
  console.error(`::error title=Rehearsal seed::${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
