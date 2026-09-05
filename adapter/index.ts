import baseAdapter, {
  type Adapter,
  closeSpawnedProcess,
} from "@marko/run/adapter";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type { CloudflarePlatformInfo } from "./types.ts";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "worker-entry");

export interface Options {
  /** Worker name used by the generated wrangler config. */
  name?: string;
  /**
   * Compatibility date for the Worker. Bumping this opts into newer runtime
   * behavior, so it is pinned rather than tracking "today".
   */
  compatibilityDate?: string;
}

export default function cloudflareAdapter(options: Options = {}): Adapter {
  const { name = "lavalva-dev", compatibilityDate = "2026-09-01" } = options;
  // `marko-run dev` still runs the app on Node: it is the fast path, and the
  // fetch handler below is the same code either way. Use `marko-run preview`
  // (wrangler) to exercise the real Workers runtime.
  const { startDev } = baseAdapter();

  return {
    name: "cloudflare-adapter",

    viteConfig(config) {
      if (config.build?.ssr) {
        return {
          ssr: {
            target: "webworker",
            resolve: {
              dedupe: ["marko"],
              conditions: ["workerd", "worker", "browser", "import", "default"],
            },
            // Workers have no node_modules at runtime; everything must be
            // bundled into the single Worker script.
            noExternal: true,
          },
        };
      }
    },

    getEntryFile() {
      return defaultEntry;
    },

    startDev(event) {
      return startDev!({
        ...event,
        entry: event.entry === defaultEntry ? undefined : event.entry,
      });
    },

    async startPreview({ options: previewOptions }) {
      const { port = 3000, cwd, dir } = previewOptions;
      const proc = spawn(
        [
          "wrangler",
          "dev",
          "--config",
          path.join(dir, "wrangler.json"),
          "--port",
          port.toString(),
          ...previewOptions.args,
        ].join(" "),
        { cwd, shell: true, detached: process.platform !== "win32" },
      );

      if (process.env.NODE_ENV !== "test") {
        proc.stdout.pipe(process.stdout);
      }
      proc.stderr.pipe(process.stderr);

      return {
        port,
        close() {
          return closeSpawnedProcess(proc);
        },
      };
    },

    // The build output is disposable, so the wrangler config lives beside it
    // and is rewritten every build. Deploy with:
    //   wrangler deploy --config dist/wrangler.json
    async buildEnd({ builtEntries }) {
      // `config.build.outDir` here is the client output (`dist/public`); the
      // Worker script is the built server entry, and the config sits next to
      // it so `assets.directory` can stay a simple relative path.
      const entry = builtEntries[0];
      const dir = path.dirname(entry);
      await fs.writeFile(
        path.join(dir, "wrangler.json"),
        JSON.stringify(
          {
            $schema: "node_modules/wrangler/config-schema.json",
            name,
            main: `./${path.basename(entry)}`,
            compatibility_date: compatibilityDate,
            assets: { directory: "./public", binding: "ASSETS" },
          },
          null,
          2,
        ) + "\n",
      );
    },

    typeInfo(writer) {
      writer(`import type { CloudflarePlatformInfo } from '../adapter';`);
      return "CloudflarePlatformInfo";
    },
  };
}
