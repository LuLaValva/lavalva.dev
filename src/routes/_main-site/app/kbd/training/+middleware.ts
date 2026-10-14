/**
 * Swipes the kbd app's Train swipes screen donates, kept as they were sent until they are released
 * as a dataset, and deleted on this page by the ID they were sent under.
 */
export default Run.POST(async ({ request, platform }) => {
  // A caller's address is counted against the limit and never kept.
  const key = request.headers.get("cf-connecting-ip") ?? "";
  if (!(await platform.env.KBD_TRAINING_LIMIT.limit({ key })).success) {
    return new Response(null, { status: 429 });
  }
});
