/**
 * apps/web/lib/wallet-pass-pkpass.ts — PACKS AND SIGNS AN APPLE `.pkpass`.
 *
 * A `.pkpass` is a zip of `pass.json` + its PNGs + `manifest.json` (the SHA-1
 * of every file) + `signature` (a DETACHED PKCS#7 / CMS SignedData over the
 * manifest, by the Pass Type ID certificate, carrying Apple's WWDR
 * intermediate). Wallet refuses a pass whose manifest or signature is wrong,
 * silently — which is why `wallet-pass-is-the-ticket.test.ts` unzips a pass
 * built here and checks every hash and the signature byte for byte.
 *
 * Node's crypto signs RSA but cannot WRITE a CMS SignedData, so the envelope
 * is node-forge's (the library passkit-generator itself uses for this). The
 * key is decrypted by Node (`createPrivateKey`) — it reads every encryption an
 * `openssl pkcs12 -nocerts` export can produce, which forge does not.
 *
 * 🔒 NO SECRET EVER LEAVES THIS FILE IN A MESSAGE. The signer is handed in by
 * the caller (lib/wallet-pass.server.ts reads the env); every failure here is
 * a fixed sentence that names no value — `WalletSigningError` — so a log line
 * or a 503 cannot carry a key, a passphrase or a certificate.
 *
 * No `server-only` import so the Node test runner can execute it; it is only
 * ever imported by the server module and the route.
 */
import { createHash, createPrivateKey } from 'node:crypto';
import archiver from 'archiver';
import forge from 'node-forge';

export type AppleWalletSigner = {
  /** The Pass Type ID certificate, PEM (extra text around the block is fine). */
  certPem: string;
  /** Its private key, PEM — encrypted (with `keyPassphrase`) or not. */
  keyPem: string;
  keyPassphrase?: string | null;
  /** Apple's WWDR intermediate (G4), PEM. */
  wwdrPem: string;
};

/** A failure that is safe to log: a fixed sentence, never a value. */
export class WalletSigningError extends Error {
  constructor(public readonly step: 'certificate' | 'key' | 'wwdr' | 'sign' | 'zip') {
    super(`wallet-pass: could not ${step === 'sign' ? 'sign the manifest' : step === 'zip' ? 'pack the pass' : `read the ${step}`}`);
    this.name = 'WalletSigningError';
  }
}

/** The first `-----BEGIN <label>-----` block — `openssl pkcs12` puts "Bag Attributes" text before it. */
function pemBlock(text: string, label: RegExp): string | null {
  const re = new RegExp(`-----BEGIN (${label.source})-----[\\s\\S]+?-----END \\1-----`);
  return re.exec(text)?.[0] ?? null;
}

function readCert(pem: string, step: 'certificate' | 'wwdr'): forge.pki.Certificate {
  const block = pemBlock(pem, /CERTIFICATE/);
  if (!block) throw new WalletSigningError(step);
  try {
    return forge.pki.certificateFromPem(block);
  } catch {
    throw new WalletSigningError(step);
  }
}

function readKey(pem: string, passphrase: string | null | undefined): forge.pki.rsa.PrivateKey {
  const block = pemBlock(pem, /(?:ENCRYPTED |RSA )?PRIVATE KEY/);
  if (!block) throw new WalletSigningError('key');
  try {
    const key = createPrivateKey({ key: block, format: 'pem', ...(passphrase ? { passphrase } : {}) });
    const plain = key.export({ type: 'pkcs1', format: 'pem' }).toString();
    return forge.pki.privateKeyFromPem(plain) as forge.pki.rsa.PrivateKey;
  } catch {
    throw new WalletSigningError('key');
  }
}

/** `manifest.json`: every file's SHA-1, hex — Apple's format (SHA-1, not SHA-256, is what Wallet checks). */
export function pkpassManifest(files: Readonly<Record<string, Buffer>>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const name of Object.keys(files).sort()) out[name] = createHash('sha1').update(files[name]!).digest('hex');
  return out;
}

/** The DETACHED PKCS#7 signature over `manifest`, DER. */
export function signManifest(manifest: Buffer, signer: AppleWalletSigner, now: Date = new Date()): Buffer {
  const cert = readCert(signer.certPem, 'certificate');
  const wwdr = readCert(signer.wwdrPem, 'wwdr');
  const key = readKey(signer.keyPem, signer.keyPassphrase);
  try {
    const p7 = forge.pkcs7.createSignedData();
    p7.content = forge.util.createBuffer(manifest.toString('binary'));
    p7.addCertificate(cert);
    p7.addCertificate(wwdr);
    p7.addSigner({
      key,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha256!,
      authenticatedAttributes: [
        { type: forge.pki.oids.contentType!, value: forge.pki.oids.data! },
        { type: forge.pki.oids.messageDigest! },
        // forge's typings say string; it accepts (and needs) a Date here.
        { type: forge.pki.oids.signingTime!, value: now as unknown as string },
      ],
    });
    p7.sign({ detached: true });
    return Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');
  } catch {
    throw new WalletSigningError('sign');
  }
}

async function zip(files: Readonly<Record<string, Buffer>>): Promise<Buffer> {
  return await new Promise<Buffer>((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', () => reject(new WalletSigningError('zip')));
    for (const name of Object.keys(files).sort()) archive.append(files[name]!, { name });
    void archive.finalize();
  });
}

/**
 * The whole `.pkpass`. `images` are the PNGs by their Wallet names
 * (`icon.png`, `icon@2x.png`, `logo.png`, …) — `icon.png` is required.
 */
export async function buildPkpass(
  passJson: Record<string, unknown>,
  images: Readonly<Record<string, Buffer>>,
  signer: AppleWalletSigner,
  now: Date = new Date(),
): Promise<Buffer> {
  if (!images['icon.png']) throw new WalletSigningError('zip');
  const files: Record<string, Buffer> = { 'pass.json': Buffer.from(JSON.stringify(passJson), 'utf8') };
  for (const [name, bytes] of Object.entries(images)) {
    if (/^[a-z]+(@[23]x)?\.png$/.test(name)) files[name] = bytes;
  }
  const manifest = Buffer.from(JSON.stringify(pkpassManifest(files)), 'utf8');
  const signature = signManifest(manifest, signer, now);
  return await zip({ ...files, 'manifest.json': manifest, signature });
}
