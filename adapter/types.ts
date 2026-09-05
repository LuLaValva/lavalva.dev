export interface CloudflarePlatformInfo {
  env: {
    ASSETS: { fetch(request: Request): Promise<Response> };
    [binding: string]: unknown;
  };
  ctx: {
    waitUntil(promise: Promise<unknown>): void;
    passThroughOnException(): void;
  };
}
