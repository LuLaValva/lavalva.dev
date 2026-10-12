import * as v from "valibot";

const count = v.pipe(v.number(), v.integer(), v.minValue(0));

/** What the app sends, as kbd's `TrainingSubmission` encodes it: a change to one is a change to both. */
const Submission = v.object({
  v: v.literal(1),
  sets: v.pipe(
    v.array(
      v.object({
        id: v.string(),
        mode: v.picklist(["accept", "live"]),
        fingers: v.pipe(
          v.array(
            v.picklist([
              "left-thumb",
              "right-thumb",
              "left-index",
              "right-index",
            ]),
          ),
          v.minLength(1),
        ),
        setting: v.picklist(["sitting", "standing", "walking", "transit"]),
        app: v.string(),
        device: v.string(),
        screen: v.tuple([v.number(), v.number()]),
        sentences: v.array(v.string()),
        swipes: v.array(
          v.object({
            word: v.string(),
            sentence: count,
            index: count,
            attempt: count,
            gate: v.boolean(),
            samples: v.array(v.tuple([v.number(), v.number(), v.number()])),
          }),
        ),
      }),
    ),
    v.minLength(1),
  ),
});

export const POST = Run.POST(
  { json: Submission },
  async ({ params, body, platform }) => {
    const [submission, issues] = await body;
    if (issues) return new Response(null, { status: 422 });
    await platform.env.KBD_TRAINING.put(
      `submissions/${params.token}/${crypto.randomUUID()}.json`,
      JSON.stringify(submission),
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
