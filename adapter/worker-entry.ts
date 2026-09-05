import { fetch as routerFetch } from "@marko/run/router";

import type { CloudflarePlatformInfo } from "./types.ts";

// Marko Run is fetch-native, so a Worker entry is just the router plus a
// fallback to the static assets binding. Assets that exist on disk are
// normally served by Cloudflare before the Worker ever runs; this fallback
// covers the rest (and produces the 404).
export default {
  async fetch(request, env, ctx) {
    const response = await routerFetch<CloudflarePlatformInfo>(request, {
      env,
      ctx,
    });
    return response || env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler;

interface ExportedHandler {
  fetch(
    request: Request,
    env: CloudflarePlatformInfo["env"],
    ctx: CloudflarePlatformInfo["ctx"],
  ): Promise<Response>;
}
