import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";
import { launch } from "./headless-chrome.mjs";

const GAMES = ["reduce", "444dle"];
const FAVICON_SIZE = 32;
const APP_ICON_SIZES = [192, 512];
// Android hands the launcher a 108dp icon and only promises the middle 72dp
// survives whatever shape it masks to.
const SAFE_ZONE = 72 / 108;

const root = fileURLToPath(new URL("..", import.meta.url));

const server = await createServer({
  configFile: false,
  root: join(root, "scripts/icons"),
  logLevel: "warn",
  server: { port: 0 },
});
await server.listen();
const { port } = server.httpServer.address();

const chrome = await launch();

async function shoot(out, game, size, options = {}) {
  const parameters = new URLSearchParams({ art: game, ...options });
  const url = `http://localhost:${port}/?${parameters}`;
  await writeFile(join(root, out), await chrome.screenshot(url, size));
  console.log(`${out} — ${size}×${size}`);
}

try {
  for (const game of GAMES) {
    await shoot(`src/routes/game/${game}/favicon.png`, game, FAVICON_SIZE, {
      hug: "1",
    });
    for (const size of APP_ICON_SIZES) {
      await shoot(`public/game/${game}/icon-${size}.png`, game, size);
      await shoot(`public/game/${game}/icon-maskable-${size}.png`, game, size, {
        safe: SAFE_ZONE,
      });
    }
  }
} finally {
  await chrome.close();
  await server.close();
}
