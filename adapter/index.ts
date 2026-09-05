import baseAdapter, {
  type Adapter,
  closeSpawnedProcess,
} from "@marko/run/adapter";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type { CloudflarePlatformInfo } from "./types.ts";

const __dirname = fileURLToPath(path.dirname(import.meta.url));
const defaultEntry = path.join(__dirname, "worker-entry");

export default function cloudflareAdapter(): Adapter {
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
      const { port = 3000, cwd } = previewOptions;
      const proc = spawn(
        [
          "wrangler",
          "dev",
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

    typeInfo(writer) {
      writer(`import type { CloudflarePlatformInfo } from '../adapter';`);
      return "CloudflarePlatformInfo";
    },
  };
}
