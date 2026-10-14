export interface CloudflarePlatformInfo {
  env: {
    ASSETS: { fetch(request: Request): Promise<Response> };
    KBD_TRAINING: {
      put(key: string, value: string): Promise<unknown>;
      get(key: string): Promise<{ body: ReadableStream<Uint8Array> } | null>;
      list(options: {
        prefix: string;
      }): Promise<{ objects: { key: string }[]; truncated: boolean }>;
      delete(keys: string[]): Promise<void>;
    };
    KBD_TRAINING_LIMIT: {
      limit(options: { key: string }): Promise<{ success: boolean }>;
    };
    [binding: string]: unknown;
  };
  ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}
