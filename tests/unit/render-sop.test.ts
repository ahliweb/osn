/**
 * Tests for `src/render/sop.ts`'s `renderSopCard` (issue #21): a pure,
 * parameter-free rendering of the one-page mentor SOP card, checked
 * against the real corpus. Snapshot test uses Bun's built-in
 * `toMatchSnapshot()` (see `tests/unit/render-weekly.test.ts`'s docblock
 * for why fixture files were not needed instead).
 */

import { describe, expect, test } from "bun:test";
import { renderSopCard } from "../../src/render/sop";

/** Matches an unresolved template artefact that should never survive into rendered output. */
const UNRESOLVED_PLACEHOLDER = /\{\{|undefined|NaN|TODO/;

describe("renderSopCard: snapshot", () => {
  test("matches its committed snapshot", () => {
    expect(renderSopCard()).toMatchSnapshot();
  });
});

describe("renderSopCard: structural content", () => {
  const markdown = renderSopCard();

  test("contains all seven §5.2 SOP steps in order", () => {
    expect(markdown).toContain(
      "1. Mulai dari problem yang membutuhkan teknik tersebut, bukan definisi algoritma terlebih dahulu.",
    );
    expect(markdown).toContain("2. Minta siswa menulis constraint analysis");
    expect(markdown).toContain("3. Tentukan invariant/state/operasi");
    expect(markdown).toContain("4. Tulis complexity waktu dan memori sebelum coding.");
    expect(markdown).toContain("5. Implementasikan dari pemahaman");
    expect(markdown).toContain("6. Uji minimal: contoh, batas minimum");
    expect(markdown).toContain("7. Setelah Accepted, wajib jawab");
  });

  test("contains the seven-item minimum test checklist", () => {
    for (const item of [
      "contoh",
      "batas minimum",
      "batas maksimum konseptual",
      "duplikasi",
      "urutan buruk",
      "overflow",
      "disconnected/negative-edge bila relevan",
    ]) {
      expect(markdown).toContain(`- ${item}`);
    }
  });

  test("contains the four post-Accepted questions", () => {
    for (const question of [
      "mengapa benar",
      "mengapa cukup cepat",
      "apa alternatifnya",
      "kapan teknik ini tidak berlaku",
    ]) {
      expect(markdown).toContain(`- ${question}`);
    }
  });

  test("contains the five-level hint ladder and names the re-solve obligation", () => {
    for (const level of [
      "pertanyaan pemodelan",
      "arah complexity",
      "observasi kunci",
      "pseudocode parsial",
      "editorial",
    ]) {
      expect(markdown).toContain(level);
    }
    expect(markdown).toContain("requires a hint-free re-solve at the next interval");
    expect(markdown).toContain("Re-solve obligation");
  });

  test("contains no unresolved placeholders", () => {
    expect(markdown).not.toMatch(UNRESOLVED_PLACEHOLDER);
  });

  test("exceeds a sensible minimum length", () => {
    expect(markdown.length).toBeGreaterThan(600);
  });
});
