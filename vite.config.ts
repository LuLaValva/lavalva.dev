import marko from "@marko/run/vite";
import { defineConfig } from "vite";

import cloudflare from "./adapter/index.ts";

export default defineConfig({
  plugins: [marko({ adapter: cloudflare() })],
});
