/**
 * DSK-3 · WHICH ADDRESS DOES THE HOSTED ENCODER PUBLISH TO?
 *
 * A stored broadcast row carries up to three addresses and the encoder needs two
 * of them, so the choice is a small pure function rather than a `??` chain
 * inlined at the one call site — the fallback DIRECTION is the thing that can be
 * got wrong, and getting it wrong is silent in both directions:
 *
 * · fall back the wrong way on the PRIMARY and a wedding that could have gone out
 *   encrypted goes out on 1935 instead, which is the port that fails behind a
 *   hotel firewall;
 * · fall back at all on the BACKUP and the encoder alternates to an address
 *   YouTube never provisioned, which is worse than having no backup: the
 *   reconnect spends every other attempt on a host that cannot accept it.
 *
 * ── WHY THE PRIMARY FALLS BACK AND THE BACKUP DOES NOT ──────────────────────
 * They are not the same kind of value. `ingestion_url` is NOT NULL and has been
 * written for every broadcast this product has ever created, so it is a real
 * address that definitely works — just unencrypted. Falling back to it means "we
 * could not do better than plain RTMP for this row", which is exactly true for
 * every row created before DSK-3 shipped, and is strictly better than refusing to
 * broadcast.
 *
 * There is no equivalent for the backup. The plain-RTMP backup address is not
 * stored (nothing has ever read it), and the primary is not a backup for itself —
 * pointing the failover at the primary would turn "three failures then try
 * somewhere else" into "retry the same dead host forever" while REPORTING that it
 * failed over. `null` is the honest answer, and `reconnect::supervise` already
 * treats a missing backup correctly: `ingest_for_attempt` returns Primary for
 * every attempt when `has_backup` is false.
 *
 * Whitespace counts as absent. A column written as '' by some future path is not
 * an address, and `RtmpEndpoint::parse` would reject it in Rust anyway — but it
 * would reject it at GO-LIVE, which is the wrong place to discover it.
 */

/** The three address columns as they come off `panood_broadcasts`. */
export type StoredIngest = {
  /** NOT NULL. The plain-RTMP primary — what OBS has always been given. */
  ingestion_url: string;
  /** Nullable: absent on every row created before DSK-3, and whenever YouTube omitted it. */
  rtmps_ingestion_url?: string | null;
  /** Nullable. NULL means there is NO backup — never substitute one. */
  rtmps_backup_ingestion_url?: string | null;
};

export type ResolvedIngest = {
  /** Always a usable address. TLS when we have one, plain RTMP when we do not. */
  rtmpsUrl: string;
  /** `null` means the encoder must retry the primary; it must NOT alternate. */
  rtmpsBackupUrl: string | null;
};

function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : null;
}

export function resolveEncoderIngest(row: StoredIngest): ResolvedIngest {
  return {
    rtmpsUrl: present(row.rtmps_ingestion_url) ?? row.ingestion_url,
    rtmpsBackupUrl: present(row.rtmps_backup_ingestion_url),
  };
}

/**
 * Is this row actually going out encrypted? Read by the test that stops the
 * fallback silently becoming the normal case, and available to any surface that
 * wants to say so honestly rather than assuming.
 *
 * Deliberately asks the RESOLVED address, not whether the column was populated:
 * what matters is the scheme the socket will use.
 */
export function isEncryptedIngest(resolved: ResolvedIngest): boolean {
  return /^rtmps:\/\//i.test(resolved.rtmpsUrl);
}
