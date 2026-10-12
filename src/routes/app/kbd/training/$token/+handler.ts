export const POST = Run.POST(
  { json: (value: unknown) => value },
  async ({ params, body, platform }) => {
    await platform.env.KBD_TRAINING.put(
      `submissions/${params.token}/${crypto.randomUUID()}.json`,
      JSON.stringify(await body),
    );
    return new Response(null, { status: 201 });
  },
);

export const DELETE = Run.DELETE(async ({ params, platform }) => {
  const bucket = platform.env.KBD_TRAINING;
  let truncated = true;
  while (truncated) {
    const page = await bucket.list({ prefix: `submissions/${params.token}/` });
    await bucket.delete(page.objects.map(({ key }) => key));
    truncated = page.truncated;
  }
});
