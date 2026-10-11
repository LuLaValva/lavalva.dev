/** The parts of an R2 bucket a route here uses. */
export interface R2BucketLike {
  put(
    key: string,
    value: string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  list(options: { prefix: string; cursor?: string; limit?: number }): Promise<{
    objects: { key: string }[];
    truncated: boolean;
    cursor?: string;
  }>;
  delete(keys: string | string[]): Promise<void>;
}

export interface CloudflarePlatformInfo {
  env: {
    ASSETS: { fetch(request: Request): Promise<Response> };
    /** Swipes donated from the kbd app's "help me train" screen, held until a public release. */
    KBD_TRAINING: R2BucketLike;
    [binding: string]: unknown;
  };
  ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}
