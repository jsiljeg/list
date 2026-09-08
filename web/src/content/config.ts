import { defineCollection, z } from "astro:content";

/* Filip's own writing. Markdown files in src/content/zapisi/, one per piece —
 * he sends the text, it gets committed. No CMS: at a couple of pieces a year
 * an editor would be more machinery than the thing it manages, and Markdown in
 * git means every version is kept without anyone maintaining a database.
 *
 * A file starting with an underscore is ignored by Astro, which is why the
 * template beside this one never becomes a page. */
const zapisi = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    /* Written as YYYY-MM-DD in the frontmatter; Astro parses it to a Date. */
    date: z.date(),
    /* One or two sentences for the listing and the meta description. Written
       rather than sliced from the body: an excerpt cut at 160 characters reads
       like a truncation, because it is one. */
    summary: z.string(),
    /* Optional dateline — "New York", "Norveška". */
    place: z.string().optional(),
    /* Set true and it stays out of the build entirely. */
    draft: z.boolean().default(false),
  }),
});

export const collections = { zapisi };
