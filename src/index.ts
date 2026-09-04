/**
 * Entrypoint for osn-informatika-2026.
 *
 * This package expresses the OSN Informatika 2026 operational syllabus as
 * code: schema, domain model, and rendering pipeline. This file is currently
 * a minimal placeholder so that the build and typecheck pipelines have a
 * real target to act on; schema, domain, CLI, and render modules land in
 * later issues.
 */

/** The authoritative source document this project encodes. */
export const CURRICULUM_SOURCE =
  "Silabus Operasional Pembinaan OSN Informatika 2026, versi 2.0, 4 September 2026";

/** Basic package identity, re-exported for programmatic consumers. */
export const packageInfo = {
  name: "osn-informatika-2026",
  source: CURRICULUM_SOURCE,
} as const;
