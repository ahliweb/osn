/**
 * Zod schema for the two-session weekly template ("Template dua sesi per
 * minggu") defined in §5.1 of the syllabus corpus
 * (`docs/silabus/05-format-pembelajaran-dan-sop.md`), plus the whole-file
 * wrapper for `data/session-template.json`.
 *
 * Per the layering rules in `docs/architecture/README.md`, this module must
 * never import from `src/domain/`.
 */

import { z } from "zod";
import { nonEmptyString, syllabusSectionSchema } from "./common";

/** The two session numbers §5.1 defines, in table column order. */
export const SESSION_NUMBERS = [1, 2] as const;

/** The literal union of valid session numbers (`1 | 2`). */
export const sessionNoSchema = z
  .union([z.literal(1), z.literal(2)])
  .describe(
    "One of the two §5.1 weekly sessions: 1 (konsep & guided practice) or 2 (problem solving & feedback).",
  );

/**
 * The exact minute boundaries §5.1's "Segmen" column defines, in row order:
 * five segments spanning a 120-minute session, contiguous and
 * non-overlapping from 0 to 120.
 */
export const SEGMENT_BOUNDARIES = [0, 15, 45, 90, 115, 120] as const;

/** The total length, in minutes, of one mentor session. */
export const SESSION_TOTAL_MINUTES = 120;

/**
 * One time segment of a session: its minute boundaries and the activity
 * text transcribed verbatim (in Indonesian) from the corresponding §5.1
 * table cell. `startMinute < endMinute` is enforced directly on this shape;
 * contiguity across a whole session's segments (no gaps, no overlaps,
 * starting at 0 and ending at 120) is a session-level property enforced by
 * {@link sessionSchema}'s `superRefine`, since it cannot be expressed by a
 * single segment in isolation.
 */
export const segmentSchema = z
  .object({
    startMinute: z
      .number()
      .int()
      .min(0)
      .describe("The segment's start minute within the session, e.g. 0 or 15."),
    endMinute: z
      .number()
      .int()
      .min(0)
      .describe("The segment's end minute within the session, e.g. 15 or 45."),
    activity: nonEmptyString.describe(
      "This segment's activity, verbatim (Indonesian) from the matching " +
        '§5.1 table cell, e.g. "Retrieval quiz topik lama; 2-3 pertanyaan ' +
        'constraint/complexity."',
    ),
  })
  .refine((value) => value.startMinute < value.endMinute, {
    message: "startMinute must be less than endMinute",
    path: ["startMinute"],
  })
  .describe("One 0-120 minute segment of a §5.1 session.");

/** The static type inferred from {@link segmentSchema}. */
export type Segment = z.infer<typeof segmentSchema>;

/**
 * One full §5.1 session: its number, its short focus label (the part of the
 * "Sesi N - ..." column header after the session number, verbatim), and its
 * five time segments.
 *
 * The `superRefine` below enforces the structural property no single
 * segment can express on its own: taken in array order, the five segments
 * must be contiguous and non-overlapping starting at minute 0, and the
 * final segment must end at minute 120 -- i.e. every session accounts for
 * exactly its full 120 minutes with no gap, overlap, or short/long total.
 */
export const sessionSchema = z
  .object({
    sessionNo: sessionNoSchema,
    focus: nonEmptyString.describe(
      "This session's focus, verbatim from its §5.1 column header after " +
        'the "Sesi N - " prefix, e.g. "konsep & guided practice".',
    ),
    segments: z
      .array(segmentSchema)
      .length(5)
      .describe("This session's five time segments, in §5.1 table row order."),
  })
  .superRefine((session, ctx) => {
    let expectedStart = 0;
    session.segments.forEach((segment, index) => {
      if (segment.startMinute !== expectedStart) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["segments", index, "startMinute"],
          message:
            `segment ${index} must start at minute ${expectedStart} to stay contiguous with ` +
            `the previous segment (no gap or overlap), got ${segment.startMinute}`,
        });
      }
      expectedStart = segment.endMinute;
    });

    const lastSegment = session.segments[session.segments.length - 1];
    if (lastSegment !== undefined && lastSegment.endMinute !== SESSION_TOTAL_MINUTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["segments", session.segments.length - 1, "endMinute"],
        message:
          `the final segment must end at minute ${SESSION_TOTAL_MINUTES} (a full ` +
          `${SESSION_TOTAL_MINUTES}-minute session), got ${lastSegment.endMinute}`,
      });
    }
  })
  .describe("One of the two §5.1 weekly sessions, with its five contiguous 120-minute segments.");

/** The static type inferred from {@link sessionSchema}. */
export type Session = z.infer<typeof sessionSchema>;

/**
 * The whole `data/session-template.json` file: the two §5.1 weekly sessions
 * plus the provenance fields (`syllabusVersion`, `syllabusDate`,
 * `sourceSection`) that let the corpus carry its own versioning, per
 * ADR-0005.
 */
export const sessionTemplateFileSchema = z
  .object({
    syllabusVersion: nonEmptyString.describe(
      "The source syllabus document's own version string this data was " +
        'transcribed from, e.g. "2.0" (see ADR-0005: dual versioning).',
    ),
    syllabusDate: nonEmptyString.describe(
      "The source syllabus document's own revision date this data was " +
        'transcribed from, e.g. "2026-09-04" (see ADR-0005: dual versioning).',
    ),
    sourceSection: syllabusSectionSchema.describe(
      "The syllabus section the whole collection was transcribed from, " + '"§5.1".',
    ),
    sessions: z
      .array(sessionSchema)
      .length(2)
      .describe("The two weekly sessions defined by §5.1, in table column order."),
  })
  .superRefine((file, ctx) => {
    const sessionNumbers = file.sessions.map((session) => session.sessionNo);
    const sorted = [...sessionNumbers].sort((a, b) => a - b);
    const isExactlyOneAndTwo =
      sorted.length === SESSION_NUMBERS.length &&
      sorted.every((value, index) => value === SESSION_NUMBERS[index]);
    if (!isExactlyOneAndTwo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sessions"],
        message:
          `sessions must have sessionNo values exactly ${SESSION_NUMBERS.join(", ")} with no ` +
          `duplicates or gaps; got [${sessionNumbers.join(", ")}]`,
      });
    }
  })
  .describe(
    "The full contents of `data/session-template.json`: the two §5.1 " +
      "weekly sessions, with their corpus provenance.",
  );

/** The static type inferred from {@link sessionTemplateFileSchema}. */
export type SessionTemplateFile = z.infer<typeof sessionTemplateFileSchema>;
