import { MAX_BODY_BYTES, parseSubmission } from "../submission.ts";

/**
 * Swipes donated from the kbd app's "help me train" screen, held in R2 until a public release.
 *
 * A token is 128 random bits the app makes and keeps: it names a person's donations without a name,
 * and holding it is the only way to delete them. Nothing here logs the caller.
 */

const TOKEN = /^[0-9a-f]{32}$/;
const headers = { "cache-control": "no-store" };

function reply(body: unknown, status: number) {
  return Response.json(body, { status, headers });
}

export const POST = Run.POST(async (context) => {
  const { token } = context.params;
  if (!TOKEN.test(token)) return reply({ error: "bad token" }, 400);
  if (
    !context.request.headers.get("content-type")?.startsWith("application/json")
  ) {
    return reply({ error: "send application/json" }, 415);
  }
  const declared = Number(context.request.headers.get("content-length"));
  if (!(declared > 0)) return reply({ error: "send a content-length" }, 411);
  if (declared > MAX_BODY_BYTES) return reply({ error: "too large" }, 413);

  const body = await context.request.text();
  if (new TextEncoder().encode(body).length > MAX_BODY_BYTES)
    return reply({ error: "too large" }, 413);
  const parsed = parseSubmission(body);
  if ("error" in parsed) return reply({ error: parsed.error }, 422);

  const id = crypto.randomUUID().replaceAll("-", "");
  await context.platform.env.KBD_TRAINING.put(
    `submissions/${token}/${id}.json`,
    JSON.stringify(parsed.submission),
    {
      httpMetadata: { contentType: "application/json" },
    },
  );
  return reply({ id }, 201);
});

/** Deletes everything under the token. Always answers the same, so a token's existence can't be probed. */
export const DELETE = Run.DELETE(async (context) => {
  const { token } = context.params;
  if (!TOKEN.test(token)) return reply({ error: "bad token" }, 400);
  const bucket = context.platform.env.KBD_TRAINING;
  let deleted = 0;
  let cursor: string | undefined;
  do {
    const page = await bucket.list({
      prefix: `submissions/${token}/`,
      cursor,
      limit: 1000,
    });
    if (page.objects.length > 0) {
      await bucket.delete(page.objects.map((object) => object.key));
      deleted += page.objects.length;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  return reply({ deleted }, 200);
});
