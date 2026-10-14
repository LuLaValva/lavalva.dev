export default Run.POST(async ({ request, platform }) => {
  // A caller's address is counted against the limit and never kept.
  const key = request.headers.get("cf-connecting-ip") ?? "";
  if (!(await platform.env.KBD_TRAINING_LIMIT.limit({ key })).success) {
    return new Response(null, { status: 429 });
  }
});
