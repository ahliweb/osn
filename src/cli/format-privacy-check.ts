/**
 * Formats a privacy-check scan for `osn privacy-check`'s two output modes:
 * human-readable text (grouped by file) and `--json` (a stable,
 * machine-readable shape) -- exactly the same split `src/cli/format-
 * audit.ts` provides for `osn validate`.
 */

import type { PrivacyScanFinding } from "../domain/privacy-scan";
import type { PrivacyScanParseIssue } from "./privacy-scan-loader";

/** The full result of one `osn privacy-check` run, ready to format. */
export interface PrivacyCheckResult {
  readonly ok: boolean;
  readonly findings: readonly PrivacyScanFinding[];
  readonly parseIssues: readonly PrivacyScanParseIssue[];
  readonly summary: {
    readonly filesScanned: number;
    readonly findingCount: number;
  };
}

/** Groups `findings` by `file`, preserving first-seen file order -- same grouping strategy `format-audit.ts`'s `groupByFile` uses for `osn validate`. */
function groupByFile(
  findings: readonly PrivacyScanFinding[],
): ReadonlyArray<readonly [string, PrivacyScanFinding[]]> {
  const order: string[] = [];
  const byFile = new Map<string, PrivacyScanFinding[]>();

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
    return [file, bucket] as const;
  });
}

/** Human-readable text output for `osn privacy-check`, grouped by file. Never prints a finding's value -- only `file`, in-file `path`, and `key`. */
export function formatPrivacyCheckText(result: PrivacyCheckResult, dataDir: string): string {
  const lines: string[] = [`osn privacy-check: scanning ${dataDir}`];

  if (result.ok) {
    lines.push(
      `OK -- ${result.summary.filesScanned} file(s) scanned, 0 direct-identifier-shaped key(s) found.`,
    );
  } else {
    lines.push(
      `FAILED -- ${result.summary.findingCount} direct-identifier-shaped key(s) found ` +
        `in ${result.summary.filesScanned} file(s) scanned. Values are never shown -- only file, path, and key:`,
    );
    for (const [file, findings] of groupByFile(result.findings)) {
      lines.push("");
      lines.push(`${file}:`);
      for (const finding of findings) {
        lines.push(`  - ${finding.path}: key "${finding.key}"`);
      }
    }
  }

  if (result.parseIssues.length > 0) {
    lines.push("");
    lines.push(
      `Warning: ${result.parseIssues.length} file/line(s) could not be parsed as JSON and were skipped (this is not a privacy finding -- run "osn validate" to check corpus JSON validity):`,
    );
    for (const issue of result.parseIssues) {
      lines.push(`  - ${issue.file}: ${issue.message}`);
    }
  }

  return lines.join("\n");
}

/** Machine-readable `--json` output for `osn privacy-check`: `{ ok, findings, parseIssues, summary }`, pretty-printed. */
export function formatPrivacyCheckJson(result: PrivacyCheckResult): string {
  return JSON.stringify(result, null, 2);
}
