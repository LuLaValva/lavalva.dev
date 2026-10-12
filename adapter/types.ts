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

/** Counts calls under a key where they land, and keeps nothing of the key. */
export interface RateLimitLike {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface CloudflarePlatformInfo {
  env: {
    ASSETS: { fetch(request: Request): Promise<Response> };
    /** Swipes donated from the kbd app's "help me train" screen, held until a public release. */
    KBD_TRAINING: R2BucketLike;
    KBD_TRAINING_LIMIT: RateLimitLike;
    [binding: string]: unknown;
  };
  ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}
