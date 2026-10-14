import * as v from "valibot";

import { Token } from "./token";

export const POST = Run.POST(
  { form: v.object({ token: Token }) },
  async ({ body, platform }, next) => {
    const [form, issues] = await body;
    if (issues) return next({ isDeleted: false });
    const bucket = platform.env.KBD_TRAINING;
    let deleted = 0;
    let truncated = true;
    while (truncated) {
      const page = await bucket.list({ prefix: `submissions/${form.token}/` });
      await bucket.delete(page.objects.map(({ key }) => key));
      deleted += page.objects.length;
      truncated = page.truncated;
    }
    return next({ isDeleted: deleted > 0 });
  },
);
