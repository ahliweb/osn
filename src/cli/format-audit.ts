/**
 * Formats an `AuditResult` (`src/domain/corpus-audit.ts`) for `osn
 * validate`'s two output modes: human-readable text (grouped by file) and
 * `--json` (a stable, machine-readable shape).
 */

import type { AuditResult } from "../domain/corpus-audit";

/** Groups `findings` by `file`, preserving first-seen file order, then sorts each file's own findings by `path` for deterministic output. */
function groupByFile(
  findings: AuditResult["findings"],
): ReadonlyArray<readonly [string, AuditResult["findings"]]> {
  const order: string[] = [];
  const byFile = new Map<string, AuditResult["findings"][number][]>();

  for (const finding of findings) {
    let bucket = byFile.get(finding.file);
    if (bucket === undefined) {
      bucket = [];
      byFile.set(finding.file, bucket);
      order.push(finding.file);
    }
    bucket.push(finding);
  }

  return order.map((file) => {
    const bucket = byFile.get(file);
    if (bucket === undefined) {
      throw new Error("groupByFile: unreachable -- bucket created for every order entry");
    }
    return [file, [...bucket].sort((a, b) => a.path.localeCompare(b.path))] as const;
  });
}

/** Human-readable text output for `osn validate`, grouped by file so every problem in one file is easy to see together. */
export function formatAuditText(result: AuditResult, dataDir: string): string {
  const lines: string[] = [`osn validate: corpus at ${dataDir}`];

  if (result.ok) {
    lines.push(
      `OK -- ${result.summary.filesValidated} data file(s) validated, 0 problem(s) found.`,
    );
    return lines.join("\n");
  }

  lines.push(
    `FAILED -- ${result.summary.findingCount} problem(s) found ` +
      `(${result.summary.errorCount} error(s), ${result.summary.warningCount} warning(s)):`,
  );

  for (const [file, findings] of groupByFile(result.findings)) {
    lines.push("");
    lines.push(`${file}:`);
    for (const finding of findings) {
      lines.push(`  - [${finding.severity}] ${finding.path}: ${finding.message}`);
    }
  }

  return lines.join("\n");
}

/** Machine-readable `--json` output for `osn validate`: `{ ok, findings, summary }`, pretty-printed. */
export function formatAuditJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}
