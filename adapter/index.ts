import baseAdapter, {
  type Adapter,
  closeSpawnedProcess,
} from "@marko/run/adapter";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

export type { CloudflarePlatformInfo } from "./types.ts";

const workerEntry = fileURLToPath(new URL("./worker-entry", import.meta.url));

export default function cloudflareAdapter(): Adapter {
  const { startDev: startNodeDev } = baseAdapter();

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
            noExternal: true,
          },
        };
      }
    },

    getEntryFile() {
      return workerEntry;
    },

    startDev(event) {
      return startNodeDev!({
        ...event,
        entry: event.entry === workerEntry ? undefined : event.entry,
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
