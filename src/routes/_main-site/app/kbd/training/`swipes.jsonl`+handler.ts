/** The month the app and the privacy policy promise before a set is published. */
const held = 30 * 24 * 60 * 60 * 1000;

export const GET = Run.GET(({ platform }) => {
  const bucket = platform.env.KBD_TRAINING;
  const encoder = new TextEncoder();
  async function* lines() {
    let cursor: string | undefined;
    do {
      const page = await bucket.list({ prefix: "submissions/", cursor });
      for (const { key, uploaded } of page.objects) {
        if (Date.now() - uploaded.getTime() < held) continue;
        const object = await bucket.get(key);
        // Deleted since it was listed.
        if (!object) continue;
        const token = key.split("/")[1];
        yield encoder.encode(
          `{"participant":"${await participant(token)}","submission":`,
        );
        yield* object.body;
        yield encoder.encode("}\n");
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
  }
  const iterator = lines();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { value, done } = await iterator.next();
      if (done) controller.close();
      else controller.enqueue(value);
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/jsonl" },
  });
});

/** As `kbd donated` names a token, so that the download and the developer's mirror agree. */
async function participant(token: string) {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return [...new Uint8Array(hash).slice(0, 6)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
