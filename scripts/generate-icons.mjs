import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "vite";
import { launch } from "./headless-chrome.mjs";

const GAMES = ["reduce", "444dle"];
const FAVICON_SIZE = 32;
const APP_ICON_SIZES = [192, 512];

const root = new URL("..", import.meta.url).pathname;

const backgroundOf = async (game) =>
  JSON.parse(
    await readFile(join(root, `public/game/${game}/manifest.json`), "utf8"),
  ).background_color;

const server = await createServer({
  configFile: false,
  root: join(root, "scripts/icons"),
  logLevel: "warn",
  server: { port: 0 },
});
await server.listen();
const { port } = server.httpServer.address();

const chrome = await launch();

async function shoot(out, game, size, options) {
  const parameters = new URLSearchParams({ art: game, ...options });
  const url = `http://localhost:${port}/?${parameters}`;
  await writeFile(join(root, out), await chrome.screenshot(url, size));
  const how = options.background ? "" : ", transparent";
  console.log(`${out} — ${size}×${size}${how}${options.hug ? ", hugged" : ""}`);
}

try {
  for (const game of GAMES) {
    // A favicon is a handful of pixels in a tab, and spends none of them on
    // margin. An app icon keeps its own, to clear the corner iOS rounds off.
    await shoot(`src/routes/game/${game}/favicon.png`, game, FAVICON_SIZE, {
      hug: "1",
    });
    // An app icon is only ever cut out down to the colour its manifest already
    // paints behind it, so it may as well carry that colour itself.
    const background = await backgroundOf(game);
    for (const size of APP_ICON_SIZES) {
      await shoot(`public/game/${game}/icon-${size}.png`, game, size, {
        background,
      });
    }
  }
} finally {
  await chrome.close();
  await server.close();
}
