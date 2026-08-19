import { z } from "zod";

/**
 * Zod schema for a raw job as returned by any source.
 * This is the validation boundary between external data and our system.
 *
 * Rules:
 * - externalId, title, company, url are REQUIRED — a job without these is not useful
 * - location and description are optional
 * - postedAt is optional; if present must be a parseable date string or ISO string
 * - We coerce strings; we do NOT fabricate missing data
 */
export const RawJobSchema = z.object({
  externalId: z
    .string()
    .min(1, "externalId must be non-empty")
    .trim(),
  title: z
    .string()
    .min(1, "title must be non-empty")
    .trim(),
  company: z
    .string()
    .min(1, "company must be non-empty")
    .trim(),
  location: z.string().trim().optional(),
  description: z.string().optional(),
  url: z
    .string()
    .url("url must be a valid URL"),
  postedAt: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: "postedAt must be a parseable date string" }
    ),
});

export type ValidatedRawJob = z.infer<typeof RawJobSchema>;

/**
 * Validate a single raw job. Returns either a success or error result.
 */
export function validateJob(
  raw: unknown
): { success: true; data: ValidatedRawJob } | { success: false; error: string } {
  const result = RawJobSchema.safeParse(raw);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const issues = result.error.issues
    .map((i) => `${i.path.join(".")}: ${i.message}`)
    .join("; ");
  return { success: false, error: issues };
}
