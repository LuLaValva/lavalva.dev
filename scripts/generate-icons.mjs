import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { launch } from "./headless-chrome.mjs";

const ICONS = [
  { art: "reduce", size: 96, out: "src/routes/game/reduce/favicon.png" },
  { art: "reduce", size: 192, out: "public/game/reduce/icon-192.png" },
  { art: "reduce", size: 512, out: "public/game/reduce/icon-512.png" },
  { art: "444dle", size: 96, out: "src/routes/game/444dle/favicon.png" },
  { art: "444dle", size: 192, out: "public/game/444dle/icon-192.png" },
  { art: "444dle", size: 512, out: "public/game/444dle/icon-512.png" },
];

const root = new URL("..", import.meta.url).pathname;

const server = await createServer({
  configFile: false,
  root: join(root, "scripts/icons"),
  logLevel: "warn",
  server: { port: 0 },
});
await server.listen();
const { port } = server.httpServer.address();

const chrome = await launch();
try {
  for (const { art, size, out } of ICONS) {
    const url = `http://localhost:${port}/?art=${encodeURIComponent(art)}`;
    await writeFile(join(root, out), await chrome.screenshot(url, size));
    console.log(`${out} — ${size}×${size}`);
  }
} finally {
  await chrome.close();
  await server.close();
}
