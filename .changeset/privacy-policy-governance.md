---
"osn-informatika-2026": minor
---

Add `docs/governance/privacy.md`: the privacy policy for minors' data
required by §10, covering scope, lawful basis and parental/guardian
authorisation, data minimisation (with a must-not-collect list kept in
sync with `DIRECT_IDENTIFIER_DENYLIST` by test), a least-privilege
role-access matrix, a retention schedule with a deletion procedure,
access-logging requirements, data-subject rights handling, and a mapping
table to UU 27/2022 / UU 1/2024 / PP 71/2019. Promotes the ad hoc
`data/*.json` denylist scan into a first-class governance control, `osn
privacy-check`: recursively scans every `.json`/`.jsonl` file under
`data/` (including `data/samples/`) for direct-identifier-shaped keys,
applying the same `"name"`-for-curriculum-entities tolerance the existing
scan used, and reports every finding by file/path/key only, never the
value. Registered in the CLI's command table and run in CI (`bun run
privacy-check`) immediately after `osn validate`.
