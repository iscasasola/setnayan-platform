/** Types for route-builders.mjs (read by TypeScript tests). */
export declare const SEG: string;
export declare function loadRoutes(): Promise<Record<string, unknown>>;
export declare function readCallArgs(source: string, openParen: number): { argText: string; end: number } | null;
export declare function resolveBuilder(routes: object, chain: string, argText: string): string | null;
export declare function resolveAllBuilderCalls(
  routes: object,
  source: string,
): Array<{ chain: string; url: string | null; index: number; end: number }>;
export declare function loadScreenRoutes(): string[];
export declare function routeExists(url: string): boolean;
export declare function inlineBuilderCalls(
  src: string,
  routes: object,
  onBuilder?: (url: string, file?: string) => void,
  file?: string,
): string;
