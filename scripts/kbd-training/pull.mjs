/**
 * Mirrors the swipes donated from the kbd app into a folder, as the bucket holds them:
 * `submissions/<token>/<id>.json`. What has been deleted from the bucket is deleted from the folder
 * too, so a copy never outlives a request to delete.
 *
 *   npm run kbd-training -- <folder>           the bucket, through this machine's `wrangler login`
 *   npm run kbd-training -- <folder> --local   what `wrangler dev --local` has taken
 */
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPlatformProxy } from "wrangler";

/** The only keys the worker writes: anything else is not written to disk. */
const KEY = /^submissions\/[0-9a-f]{32}\/[0-9a-f]{32}\.json$/;

const args = process.argv.slice(2);
const local = args.includes("--local");
const [folder] = args.filter((arg) => !arg.startsWith("--"));
if (!folder) {
  console.error("usage: npm run kbd-training -- <folder> [--local]");
  process.exit(1);
}

const { env, dispose } = await getPlatformProxy({
  configPath: fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)),
  remoteBindings: !local,
  persist: {
    path: fileURLToPath(new URL("../../.wrangler/state/v3", import.meta.url)),
  },
});

try {
  const bucket = env.KBD_TRAINING;
  const held = new Set();
  let cursor;
  do {
    const page = await bucket.list({
      prefix: "submissions/",
      cursor,
      limit: 1000,
    });
    for (const { key } of page.objects) {
      if (KEY.test(key)) held.add(key);
      else console.warn(`skipped ${JSON.stringify(key)}`);
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  const kept = new Set();
  const submissions = path.join(folder, "submissions");
  let removed = 0;
  for (const token of await names(submissions)) {
    const files = await names(path.join(submissions, token));
    for (const file of files) {
      const key = `submissions/${token}/${file}`;
      if (held.has(key)) {
        kept.add(key);
      } else if (KEY.test(key)) {
        await rm(path.join(folder, key));
        removed++;
      }
    }
    if (files.every((file) => !held.has(`submissions/${token}/${file}`))) {
      await rm(path.join(submissions, token), { recursive: true });
    }
  }

  let added = 0;
  for (const key of held) {
    if (kept.has(key)) continue;
    const object = await bucket.get(key);
    // Deleted since it was listed.
    if (!object) continue;
    await mkdir(path.dirname(path.join(folder, key)), { recursive: true });
    await writeFile(path.join(folder, key), await object.text());
    added++;
  }

  const people = new Set([...held].map((key) => key.split("/")[1])).size;
  console.log(
    `submissions: ${held.size} (${added} new, ${removed} removed), people: ${people}, in ${submissions}`,
  );
} finally {
  await dispose();
}

async function names(directory) {
  try {
    return (await readdir(directory)).filter((name) => !name.startsWith("."));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}
