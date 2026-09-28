import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const EXECUTABLE =
  process.env.CHROME ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Chrome's own --screenshot never exits once it is handed a --user-data-dir,
// and without one it reaches for the profile the user has open. Driving it over
// the devtools protocol avoids having to choose.
export async function launch() {
  const profile = await mkdtemp(join(tmpdir(), "headless-chrome-"));
  const chrome = spawn(
    EXECUTABLE,
    [
      "--headless",
      "--remote-debugging-port=0",
      `--user-data-dir=${profile}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  const page = await connect(await pageSocket(profile));
  await page.send("Page.enable");
  // Nothing painted behind the page, so art that lays down no background of
  // its own is captured transparent.
  await page.send("Emulation.setDefaultBackgroundColorOverride", {
    color: { r: 0, g: 0, b: 0, a: 0 },
  });

  return {
    async screenshot(url, size) {
      await page.send("Emulation.setDeviceMetricsOverride", {
        width: size,
        height: size,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const loaded = page.once("Page.loadEventFired");
      await page.send("Page.navigate", { url });
      await loaded;
      const { data } = await page.send("Page.captureScreenshot", {
        format: "png",
      });
      return Buffer.from(data, "base64");
    },
    async close() {
      page.close();
      chrome.kill();
      await rm(profile, { recursive: true, force: true });
    },
  };
}

async function pageSocket(profile) {
  const active = join(profile, "DevToolsActivePort");
  for (let attempt = 0; attempt < 100; attempt++) {
    const [port] = await readFile(active, "utf8").then(
      (contents) => contents.split("\n"),
      () => [],
    );
    if (port) {
      const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(
        (response) => response.json(),
      );
      const page = targets.find(({ type }) => type === "page");
      if (page) return page.webSocketDebuggerUrl;
    }
    await delay(100);
  }
  throw new Error("Chrome never opened a page to drive");
}

async function connect(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });

  const calls = new Map();
  const waiting = new Map();
  let lastId = 0;

  socket.addEventListener("message", ({ data }) => {
    const { id, error, result, method, params } = JSON.parse(data);
    if (id === undefined) {
      waiting.get(method)?.(params);
      waiting.delete(method);
    } else {
      const { resolve, reject } = calls.get(id);
      calls.delete(id);
      if (error) reject(error);
      else resolve(result);
    }
  });

  return {
    send: (method, params) =>
      new Promise((resolve, reject) => {
        const id = ++lastId;
        calls.set(id, {
          resolve,
          reject: ({ message }) => reject(new Error(`${method}: ${message}`)),
        });
        socket.send(JSON.stringify({ id, method, params }));
      }),
    once: (method) => new Promise((resolve) => waiting.set(method, resolve)),
    close: () => socket.close(),
  };
}
