import { fetch as routerFetch } from "@marko/run/router";

import type { CloudflarePlatformInfo } from "./types.ts";

export default {
  async fetch(
    request: Request,
    env: CloudflarePlatformInfo["env"],
    ctx: CloudflarePlatformInfo["ctx"],
  ): Promise<Response> {
    const response = await routerFetch<CloudflarePlatformInfo>(request, {
      env,
      ctx,
    });
    return response || env.ASSETS.fetch(request);
  },
};
