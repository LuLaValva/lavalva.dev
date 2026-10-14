/** kbd's `scripts/release-swipes` writes it each month: read whole here, it would outrun a request's R2 calls. */
export const GET = Run.GET(async ({ platform }) => {
  const release = await platform.env.KBD_TRAINING.get("release/swipes.jsonl");
  return new Response(release?.body, {
    headers: { "content-type": "application/jsonl" },
  });
});
