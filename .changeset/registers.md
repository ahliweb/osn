---
"osn-informatika-2026": minor
---

Add the reference (R1–R41), regulation (§10), ISO/IEC standard (§11) and
mentor source-priority (§12) registers as validated data, with
`assertNoDanglingCitations()` walking the entire corpus at load so a
citation can never point at a reference that does not exist.
