import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveEncoderIngest,
  isEncryptedIngest,
  type StoredIngest,
} from './live-studio-hosted-ingest';

const PLAIN = 'rtmp://a.rtmp.youtube.com/live2';
const TLS = 'rtmps://a.rtmps.youtube.com/live2';
const TLS_BACKUP = 'rtmps://b.rtmps.youtube.com/live2?backup=1';

test('a row with the RTMPS pair publishes encrypted, with a backup', () => {
  const r = resolveEncoderIngest({
    ingestion_url: PLAIN,
    rtmps_ingestion_url: TLS,
    rtmps_backup_ingestion_url: TLS_BACKUP,
  });
  assert.equal(r.rtmpsUrl, TLS);
  assert.equal(r.rtmpsBackupUrl, TLS_BACKUP);
  assert.equal(isEncryptedIngest(r), true);
});

test('a row from before DSK-3 still broadcasts — on plain RTMP', () => {
  // Refusing here would take working weddings off the air to gain encryption.
  const r = resolveEncoderIngest({ ingestion_url: PLAIN });
  assert.equal(r.rtmpsUrl, PLAIN);
  assert.equal(isEncryptedIngest(r), false);
});

test('a missing backup is null — NEVER the primary', () => {
  // Substituting the primary turns "three failures then try elsewhere" into
  // "retry the same dead host forever" while reporting a failover.
  const r = resolveEncoderIngest({ ingestion_url: PLAIN, rtmps_ingestion_url: TLS });
  assert.equal(r.rtmpsBackupUrl, null);
});

test('a missing backup is never the plain-RTMP address either', () => {
  const r = resolveEncoderIngest({
    ingestion_url: PLAIN,
    rtmps_ingestion_url: TLS,
    rtmps_backup_ingestion_url: null,
  });
  assert.notEqual(r.rtmpsBackupUrl, PLAIN);
  assert.equal(r.rtmpsBackupUrl, null);
});

test('blank and whitespace columns count as absent, not as an address', () => {
  const r = resolveEncoderIngest({
    ingestion_url: PLAIN,
    rtmps_ingestion_url: '   ',
    rtmps_backup_ingestion_url: '',
  });
  assert.equal(r.rtmpsUrl, PLAIN, 'a blank TLS column must not become the address');
  assert.equal(r.rtmpsBackupUrl, null);
});

test('a stored address is trimmed before it is used', () => {
  const r = resolveEncoderIngest({
    ingestion_url: PLAIN,
    rtmps_ingestion_url: `  ${TLS}\n`,
    rtmps_backup_ingestion_url: ` ${TLS_BACKUP} `,
  });
  assert.equal(r.rtmpsUrl, TLS);
  assert.equal(r.rtmpsBackupUrl, TLS_BACKUP);
});

test('a backup without a TLS primary is still honoured', () => {
  // Odd but real: YouTube returned one and not the other. The backup is a real
  // provisioned address either way, and dropping it would lose a live failover.
  const r = resolveEncoderIngest({
    ingestion_url: PLAIN,
    rtmps_backup_ingestion_url: TLS_BACKUP,
  });
  assert.equal(r.rtmpsUrl, PLAIN);
  assert.equal(r.rtmpsBackupUrl, TLS_BACKUP);
});

test('the primary is never null — every row resolves to something publishable', () => {
  const rows: StoredIngest[] = [
    { ingestion_url: PLAIN },
    { ingestion_url: PLAIN, rtmps_ingestion_url: null, rtmps_backup_ingestion_url: null },
    { ingestion_url: PLAIN, rtmps_ingestion_url: undefined },
    { ingestion_url: PLAIN, rtmps_ingestion_url: TLS },
  ];
  for (const row of rows) {
    const r = resolveEncoderIngest(row);
    assert.ok(r.rtmpsUrl && r.rtmpsUrl.length > 0, `no address for ${JSON.stringify(row)}`);
  }
});

test('isEncryptedIngest reads the scheme, not whether a column was set', () => {
  assert.equal(isEncryptedIngest({ rtmpsUrl: TLS, rtmpsBackupUrl: null }), true);
  assert.equal(isEncryptedIngest({ rtmpsUrl: PLAIN, rtmpsBackupUrl: TLS_BACKUP }), false);
});
