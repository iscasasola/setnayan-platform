/**
 * Types for check-bundle-size.mjs, so
 * `lib/the-bundle-check-counts-what-pages-load.test.ts` can run the counting
 * itself on fixture manifests, not only read the script.
 */
export declare const MAX_SHARED_GZIP_BYTES: number;
export declare function looksLikePagesRouterChunk(file: string): boolean;
export declare function chunkPath(nextDir: string, rel: string): string;
export declare function selectSharedChunks(manifests: {
  buildManifest: unknown;
  appBuildManifest: unknown;
}): {
  appRoutes: number;
  counted: { chunk: string; reason: string }[];
  excluded: { chunk: string; reason: string }[];
  guardHits: { chunk: string; routes: string[] }[];
};
