import 'server-only';

import archiver from 'archiver';

/**
 * 🗂 Prints › Save all — the seven print files in one zip, built in memory (seven SVGs, a few hundred KB at most, so
 * there is nothing to stream). `archiver`, as the guest pass-card zip uses it. Nothing is stored.
 */
export function zipFiles(files: ReadonlyArray<{ name: string; body: string }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 6 } });
    const chunks: Buffer[] = [];
    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
    for (const f of files) archive.append(f.body, { name: f.name });
    void archive.finalize();
  });
}
