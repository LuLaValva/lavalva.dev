// Structural types for the bits of the Workers runtime this adapter touches,
// so the adapter doesn't drag in @cloudflare/workers-types. If wrangler ever
// generates a `worker-configuration.d.ts` here, widen `env` to that `Env`.
export interface CloudflarePlatformInfo {
  env: {
    /** Static assets binding, serving the contents of `dist/public`. */
    ASSETS: { fetch(request: Request): Promise<Response> };
    [binding: string]: unknown;
  };
  ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}
