/**
 * Swipes the kbd app's "Help train swipes" screen donates, kept as they were sent until they are released
 * as a dataset. The token is 128 random bits the app makes: it stands for a person without naming one,
 * and holding it is all it takes to delete what they sent.
 */
export default Run.ALL(async ({ params, request, platform }) => {
  if (!/^[0-9a-f]{32}$/.test(params.token)) {
    return new Response(null, { status: 400 });
  }
  // A caller's address is counted against the limit and never kept.
  const key = request.headers.get("cf-connecting-ip") ?? "";
  if (!(await platform.env.KBD_TRAINING_LIMIT.limit({ key })).success) {
    return new Response(null, { status: 429 });
  }
});
